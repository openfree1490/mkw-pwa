"""
MKW Enrichment Engine — Phase 6
Supplementary data for each ticker: sector performance, earnings proximity,
news sentiment, options flow, 52-week proximity, float/cap.
Feeds into thesis narratives and prioritization.
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import numpy as np
import requests

log = logging.getLogger("mkw.enrichment")

FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")

# Sector ETF mapping
SECTOR_ETFS = {
    "Technology": "XLK", "Healthcare": "XLV", "Financials": "XLF",
    "Consumer Cyclical": "XLY", "Consumer Defensive": "XLP",
    "Industrials": "XLI", "Energy": "XLE", "Basic Materials": "XLB",
    "Real Estate": "XLRE", "Utilities": "XLU", "Communication Services": "XLC",
    # Common alternate names
    "Financial Services": "XLF", "Consumer Discretionary": "XLY",
    "Consumer Staples": "XLP",
}


def enrich_ticker(ticker: str, df: pd.DataFrame, fundamentals: dict,
                  fetch_ohlcv_fn=None) -> dict:
    """
    Gather all supplementary enrichment data for a ticker.
    Returns a dict with enrichment fields.
    """
    result = {
        "sector_performance": {},
        "earnings_proximity": {},
        "news_sentiment": {},
        "options_flow": {},
        "week52_proximity": {},
        "float_cap": {},
    }

    # 1. Sector Performance
    try:
        sector = fundamentals.get("sector", "")
        etf = SECTOR_ETFS.get(sector, "")
        if etf and fetch_ohlcv_fn:
            sector_df = fetch_ohlcv_fn(etf, "6mo")
            if sector_df is not None and len(sector_df) > 20:
                sc = sector_df["Close"]
                ret_1w = round((float(sc.iloc[-1]) / float(sc.iloc[-5]) - 1) * 100, 2) if len(sc) > 5 else 0
                ret_1m = round((float(sc.iloc[-1]) / float(sc.iloc[-21]) - 1) * 100, 2) if len(sc) > 21 else 0
                ret_3m = round((float(sc.iloc[-1]) / float(sc.iloc[-63]) - 1) * 100, 2) if len(sc) > 63 else 0

                # Is sector rotating in (positive momentum)?
                rotating_in = ret_1w > 0 and ret_1m > 0

                result["sector_performance"] = {
                    "sector": sector,
                    "etf": etf,
                    "return_1w": ret_1w,
                    "return_1m": ret_1m,
                    "return_3m": ret_3m,
                    "rotating_in": rotating_in,
                    "verdict": "Sector tailwind" if rotating_in else "Sector headwind",
                }
    except Exception as e:
        log.warning(f"Sector enrichment {ticker}: {e}")

    # 2. Earnings Proximity
    try:
        next_earnings = fundamentals.get("nextEarningsDate", "")
        if next_earnings:
            try:
                earn_date = datetime.strptime(next_earnings[:10], "%Y-%m-%d")
                days_to_earnings = (earn_date - datetime.utcnow()).days
                within_14 = 0 < days_to_earnings <= 14

                result["earnings_proximity"] = {
                    "date": next_earnings[:10],
                    "daysAway": max(0, days_to_earnings),
                    "within14Days": within_14,
                    "warning": "EARNINGS WITHIN 14 DAYS — affects options pricing" if within_14 else None,
                }
            except ValueError:
                result["earnings_proximity"] = {"date": next_earnings, "daysAway": None}
        else:
            result["earnings_proximity"] = {"date": None, "daysAway": None}
    except Exception as e:
        log.warning(f"Earnings enrichment {ticker}: {e}")

    # 3. News Sentiment (via Finnhub if available)
    try:
        if FINNHUB_KEY:
            from_date = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
            to_date = datetime.utcnow().strftime("%Y-%m-%d")
            resp = requests.get(
                f"https://finnhub.io/api/v1/company-news",
                params={"symbol": ticker, "from": from_date, "to": to_date, "token": FINNHUB_KEY},
                timeout=5,
            )
            if resp.ok:
                news = resp.json()
                if isinstance(news, list):
                    # Simple sentiment: count positive/negative keywords
                    pos_words = {"upgrade", "beat", "raise", "bullish", "growth", "record", "strong", "outperform"}
                    neg_words = {"downgrade", "miss", "cut", "bearish", "decline", "weak", "lawsuit", "investigation"}

                    pos_count = 0
                    neg_count = 0
                    headlines = []
                    for n in news[:10]:
                        hl = n.get("headline", "").lower()
                        if any(w in hl for w in pos_words):
                            pos_count += 1
                        if any(w in hl for w in neg_words):
                            neg_count += 1
                        headlines.append({
                            "headline": n.get("headline", ""),
                            "source": n.get("source", ""),
                            "time": n.get("datetime", 0),
                        })

                    total = pos_count + neg_count
                    if total > 0:
                        sentiment = "positive" if pos_count > neg_count else "negative" if neg_count > pos_count else "mixed"
                    else:
                        sentiment = "neutral"

                    result["news_sentiment"] = {
                        "sentiment": sentiment,
                        "positiveCount": pos_count,
                        "negativeCount": neg_count,
                        "totalArticles": len(news),
                        "recentHeadlines": headlines[:5],
                    }
        else:
            result["news_sentiment"] = {"sentiment": "unavailable", "note": "Set FINNHUB_API_KEY for news"}
    except Exception as e:
        log.warning(f"News enrichment {ticker}: {e}")

    # 4. Options Flow (basic: put/call volume ratio from recent data)
    try:
        if df is not None and len(df) > 20:
            # We can't get real options flow without paid APIs, but we can
            # note volume patterns that suggest institutional activity
            vol = df["Volume"]
            vol_avg = float(vol.iloc[-20:].mean())
            vol_today = float(vol.iloc[-1])
            vol_ratio = vol_today / vol_avg if vol_avg > 0 else 1

            result["options_flow"] = {
                "volumeRatio": round(vol_ratio, 2),
                "unusualVolume": vol_ratio > 2.0,
                "note": "Unusual stock volume (possible institutional activity)" if vol_ratio > 2 else "Normal volume",
                "dataSource": "stock volume proxy (no options flow API)",
            }
    except Exception as e:
        log.warning(f"Options flow enrichment {ticker}: {e}")

    # 5. 52-Week High/Low Proximity
    try:
        if df is not None and len(df) > 200:
            high = df["High"]
            low = df["Low"]
            close = df["Close"]
            price = float(close.iloc[-1])

            lookback = min(252, len(high))
            h52 = float(high.iloc[-lookback:].max())
            l52 = float(low.iloc[-lookback:].min())

            pct_from_high = round((price / h52 - 1) * 100, 1)
            pct_from_low = round((price / l52 - 1) * 100, 1)

            near_high = pct_from_high >= -5
            near_low = pct_from_low <= 10

            result["week52_proximity"] = {
                "high52": round(h52, 2),
                "low52": round(l52, 2),
                "pctFromHigh": pct_from_high,
                "pctFromLow": pct_from_low,
                "nearHigh": near_high,
                "nearLow": near_low,
                "verdict": ("Near 52-week high — leadership" if near_high
                           else "Near 52-week low — weakness" if near_low
                           else "Mid-range"),
            }
    except Exception as e:
        log.warning(f"52-week enrichment {ticker}: {e}")

    # 6. Float and Market Cap
    try:
        mcap = fundamentals.get("marketCap", 0)
        if mcap:
            if mcap >= 200e9:
                cap_class = "Mega Cap"
            elif mcap >= 10e9:
                cap_class = "Large Cap"
            elif mcap >= 2e9:
                cap_class = "Mid Cap"
            elif mcap >= 300e6:
                cap_class = "Small Cap"
            else:
                cap_class = "Micro Cap"

            result["float_cap"] = {
                "marketCap": mcap,
                "marketCapFormatted": _format_number(mcap),
                "capClass": cap_class,
                "sector": fundamentals.get("sector", ""),
                "industry": fundamentals.get("industry", ""),
            }
        else:
            result["float_cap"] = {"marketCap": 0, "capClass": "Unknown"}
    except Exception as e:
        log.warning(f"Float/cap enrichment {ticker}: {e}")

    return result


def _format_number(n):
    """Format large numbers for display."""
    if n >= 1e12:
        return f"${n/1e12:.1f}T"
    elif n >= 1e9:
        return f"${n/1e9:.1f}B"
    elif n >= 1e6:
        return f"${n/1e6:.0f}M"
    else:
        return f"${n:,.0f}"
