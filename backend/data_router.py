"""
Data Router — Central data abstraction for MKW Command Center
Priority chain: Polygon → yfinance fallback
Every response includes: {data, source, timestamp, quality}
"""

import os, time, logging
from datetime import datetime
from typing import Optional

import pandas as pd
import yfinance as yf

import polygon_client as poly

log = logging.getLogger("mkw.router")

# ─────────────────────────────────────────────
# STATUS TRACKING
# ─────────────────────────────────────────────
_source_status = {
    "polygon": {"ok": False, "last_check": 0, "errors": 0},
    "yfinance": {"ok": True, "last_check": 0, "errors": 0},
    "finra": {"ok": False, "last_check": 0, "errors": 0},
    "fred": {"ok": False, "last_check": 0, "errors": 0},
}


def _mark_ok(source: str):
    _source_status[source]["ok"] = True
    _source_status[source]["last_check"] = time.time()
    _source_status[source]["errors"] = 0


def _mark_fail(source: str):
    _source_status[source]["errors"] += 1
    _source_status[source]["last_check"] = time.time()
    if _source_status[source]["errors"] > 5:
        _source_status[source]["ok"] = False


def get_status() -> dict:
    """Return current data source status for frontend status bar."""
    poly_key = bool(os.getenv("POLYGON_API_KEY", ""))
    fred_key = bool(os.getenv("FRED_API_KEY", ""))

    quality = "STANDARD" if poly_key else "BASIC"

    return {
        "polygon": {"connected": poly_key, **_source_status["polygon"]},
        "yfinance": _source_status["yfinance"],
        "finra": _source_status["finra"],
        "fred": {"connected": fred_key, **_source_status["fred"]},
        "quality": quality,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────
# OHLCV — Polygon → yfinance
# ─────────────────────────────────────────────
def fetch_ohlcv(ticker: str, period: str = "2y") -> Optional[pd.DataFrame]:
    """
    Fetch OHLCV data. Tries Polygon first, falls back to yfinance.
    Returns standard DataFrame: DatetimeIndex, columns=[Open, High, Low, Close, Volume]
    """
    source = "yfinance"

    # Try Polygon first
    if poly.is_available():
        try:
            df = poly.fetch_ohlcv(ticker, period)
            if df is not None and len(df) >= 60:
                _mark_ok("polygon")
                return df
        except Exception as e:
            log.warning(f"Polygon OHLCV {ticker}: {e}")
            _mark_fail("polygon")

    # Fallback: yfinance
    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period, auto_adjust=True)
        if df.empty or len(df) < 60:
            return None
        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.index = pd.to_datetime(df.index)
        _mark_ok("yfinance")
        return df
    except Exception as e:
        log.warning(f"yfinance OHLCV {ticker}: {e}")
        _mark_fail("yfinance")
        return None


# ─────────────────────────────────────────────
# FUNDAMENTALS — Polygon → yfinance
# ─────────────────────────────────────────────
_FUND_EMPTY = {
    "eps": 0, "rev": 0, "marginsExpanding": False, "marketCap": 0, "name": "",
    "grossMargins": 0, "operatingMargins": 0, "returnOnEquity": 0, "returnOnCapital": 0,
    "freeCashflow": 0, "debtToEquity": 0, "trailingPE": None, "forwardPE": None,
    "institutionalOwnershipPct": 0, "nextEarningsDate": "", "sector": "", "industry": "",
}


def fetch_fundamentals(ticker: str) -> dict:
    """
    Fetch company fundamentals. Polygon details + financials → yfinance fallback.
    Returns standardized dict with 16+ keys.
    """

    # Try Polygon
    if poly.is_available():
        try:
            details = poly.fetch_ticker_details(ticker)
            financials = poly.fetch_financials(ticker)

            if details:
                _mark_ok("polygon")
                result = dict(_FUND_EMPTY)
                result["name"] = details.get("name", ticker)
                result["sector"] = details.get("sector", "")
                result["industry"] = details.get("industry", "")
                result["marketCap"] = details.get("marketCap", 0)

                if financials:
                    result["eps"] = financials.get("eps", 0)
                    result["rev"] = financials.get("rev", 0)
                    result["marginsExpanding"] = financials.get("marginsExpanding", False)
                    result["grossMargins"] = financials.get("grossMargins", 0)
                    result["operatingMargins"] = financials.get("operatingMargins", 0)
                    result["returnOnEquity"] = financials.get("returnOnEquity", 0)
                    result["returnOnCapital"] = financials.get("returnOnEquity", 0)
                    result["freeCashflow"] = financials.get("freeCashflow", 0)
                    result["debtToEquity"] = financials.get("debtToEquity", 0)

                return result
        except Exception as e:
            log.warning(f"Polygon fundamentals {ticker}: {e}")
            _mark_fail("polygon")

    # Fallback: yfinance
    return _yf_fundamentals(ticker)


def _yf_fundamentals(ticker: str) -> dict:
    """yfinance fundamentals fetch (original logic)."""
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        fin = t.financials
        eps_growth, rev_growth, margins_exp = 0, 0, False
        try:
            if fin is not None and not fin.empty:
                ni = fin.loc["Net Income"] if "Net Income" in fin.index else None
                rev = fin.loc["Total Revenue"] if "Total Revenue" in fin.index else None
                gp = fin.loc["Gross Profit"] if "Gross Profit" in fin.index else None
                if ni is not None and len(ni) >= 2 and ni.iloc[1] != 0:
                    eps_growth = int((ni.iloc[0] - ni.iloc[1]) / abs(ni.iloc[1]) * 100)
                if rev is not None and len(rev) >= 2 and rev.iloc[1] != 0:
                    rev_growth = int((rev.iloc[0] - rev.iloc[1]) / abs(rev.iloc[1]) * 100)
                if gp is not None and rev is not None and len(gp) >= 2 and len(rev) >= 2:
                    m0 = gp.iloc[0] / rev.iloc[0] if rev.iloc[0] else 0
                    m1 = gp.iloc[1] / rev.iloc[1] if rev.iloc[1] else 0
                    margins_exp = m0 > m1
        except Exception:
            pass

        gross_margins = info.get("grossMargins", 0) or 0
        roe = info.get("returnOnEquity", 0) or 0
        roic = info.get("returnOnCapital", 0) or info.get("returnOnEquity", 0) or 0
        fcf = info.get("freeCashflow", 0) or 0
        operating_margins = info.get("operatingMargins", 0) or 0
        debt_equity = info.get("debtToEquity", 0) or 0
        inst_pct = info.get("heldPercentInstitutions", 0) or 0

        next_earnings = ""
        try:
            cal = t.calendar
            if cal is not None:
                if isinstance(cal, dict):
                    ed = cal.get("Earnings Date", None)
                    if ed is not None:
                        if hasattr(ed, '__iter__') and not isinstance(ed, str):
                            ed = list(ed)
                            if ed:
                                next_earnings = str(ed[0])[:10]
                        else:
                            next_earnings = str(ed)[:10]
                elif isinstance(cal, pd.DataFrame):
                    if "Earnings Date" in cal.index:
                        val = cal.loc["Earnings Date"].iloc[0] if not cal.loc["Earnings Date"].empty else ""
                        next_earnings = str(val)[:10] if val else ""
        except Exception:
            pass

        _mark_ok("yfinance")
        return {
            "eps": eps_growth, "rev": rev_growth, "marginsExpanding": margins_exp,
            "marketCap": info.get("marketCap", 0),
            "name": info.get("longName", ticker),
            "grossMargins": round(float(gross_margins), 4) if gross_margins else 0,
            "operatingMargins": round(float(operating_margins), 4) if operating_margins else 0,
            "returnOnEquity": round(float(roe), 4) if roe else 0,
            "returnOnCapital": round(float(roic), 4) if roic else 0,
            "freeCashflow": int(fcf) if fcf else 0,
            "debtToEquity": round(float(debt_equity), 2) if debt_equity else 0,
            "trailingPE": round(float(info.get("trailingPE", 0) or 0), 2) or None,
            "forwardPE": round(float(info.get("forwardPE", 0) or 0), 2) or None,
            "institutionalOwnershipPct": round(float(inst_pct) * 100, 1) if inst_pct else 0,
            "nextEarningsDate": next_earnings,
            "sector": info.get("sector", ""),
            "industry": info.get("industry", ""),
        }
    except Exception as e:
        log.warning(f"yfinance fundamentals {ticker}: {e}")
        _mark_fail("yfinance")
        return dict(_FUND_EMPTY, name=ticker)


# ─────────────────────────────────────────────
# OPTIONS CHAIN — Polygon → yfinance
# ─────────────────────────────────────────────
def fetch_options_data(ticker: str, spot: float = 0) -> dict:
    """
    Fetch options chain with Greeks.
    Returns: {snapshot, iv_analysis, source}
    Polygon gives real Greeks in one call. yfinance needs multiple calls + estimated Greeks.
    """
    # Try Polygon
    if poly.is_available():
        try:
            snapshot = poly.fetch_options_snapshot(ticker)
            if snapshot and snapshot.get("calls"):
                _mark_ok("polygon")
                iv_analysis = poly.extract_iv_analysis_from_snapshot(snapshot, spot)
                return {
                    "snapshot": snapshot,
                    "iv_analysis": iv_analysis,
                    "chain": poly.build_chain_dataframes(snapshot),
                    "source": "polygon",
                }
        except Exception as e:
            log.warning(f"Polygon options {ticker}: {e}")
            _mark_fail("polygon")

    # Fallback: yfinance (returns ticker object for options_engine to use)
    try:
        ticker_obj = yf.Ticker(ticker)
        expirations = ticker_obj.options
        if expirations:
            _mark_ok("yfinance")
            return {
                "snapshot": None,
                "iv_analysis": None,  # Will be calculated by options_engine
                "yf_ticker": ticker_obj,
                "source": "yfinance",
            }
    except Exception as e:
        log.warning(f"yfinance options {ticker}: {e}")
        _mark_fail("yfinance")

    return {"snapshot": None, "iv_analysis": None, "source": "none"}


# ─────────────────────────────────────────────
# GROUPED DAILY — Polygon only (no yfinance equivalent)
# ─────────────────────────────────────────────
def fetch_grouped_daily(target_date: str = "") -> Optional[dict]:
    """
    Fetch ALL US stock OHLCV in one call (Polygon only).
    Returns {ticker: {open, high, low, close, volume, vwap}} or None.
    """
    if not poly.is_available():
        return None
    try:
        result = poly.fetch_grouped_daily(target_date)
        if result:
            _mark_ok("polygon")
        return result
    except Exception as e:
        log.warning(f"Polygon grouped daily: {e}")
        _mark_fail("polygon")
        return None


# ─────────────────────────────────────────────
# QUOTE — Polygon → yfinance
# ─────────────────────────────────────────────
def fetch_quote(ticker: str) -> Optional[dict]:
    """Fetch current quote."""
    if poly.is_available():
        try:
            q = poly.fetch_quote(ticker)
            if q:
                _mark_ok("polygon")
                return q
        except Exception:
            _mark_fail("polygon")

    # yfinance fallback
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        _mark_ok("yfinance")
        return {
            "price": info.get("currentPrice", 0) or info.get("regularMarketPrice", 0),
            "change": info.get("regularMarketChange", 0),
            "changePct": round(info.get("regularMarketChangePercent", 0), 2),
            "volume": info.get("regularMarketVolume", 0),
            "vwap": 0,
            "prevClose": info.get("previousClose", 0),
            "open": info.get("regularMarketOpen", 0),
            "high": info.get("regularMarketDayHigh", 0),
            "low": info.get("regularMarketDayLow", 0),
        }
    except Exception:
        _mark_fail("yfinance")
        return None


# ─────────────────────────────────────────────
# DYNAMIC UNIVERSE
# ─────────────────────────────────────────────
# Static fallback universe (used when Polygon unavailable)
STATIC_UNIVERSE = [
    "NVDA", "AVGO", "TSLA", "AAPL", "MSFT", "GOOGL", "META", "AMZN", "AMD", "CRM",
    "PLTR", "CRWD", "PANW", "NET", "DDOG", "APP", "AXON", "COIN", "MELI", "SHOP",
    "SNOW", "NOW", "ADBE", "ORCL", "TSM", "ASML", "KLAC", "LRCX", "AMAT", "MRVL",
    "LLY", "UNH", "ISRG", "VRTX", "GE", "CAT", "DE", "LMT", "XOM", "COST",
    "WMT", "HD", "V", "MA", "GS", "JPM", "TSEM", "RKLB", "DELL", "CF",
    "GKOS", "CELH", "DUOL", "HIMS", "TOST", "DECK", "CMG", "LULU", "ON", "MPWR",
]


def get_universe() -> list:
    """
    Get trading universe. Uses Polygon dynamic list if available,
    falls back to static list.
    """
    if poly.is_available():
        try:
            tickers = poly.fetch_active_tickers(min_market_cap=2e9, limit=500)
            if tickers and len(tickers) > 50:
                _mark_ok("polygon")
                log.info(f"Dynamic universe: {len(tickers)} tickers")
                return tickers[:500]  # Cap at 500 for performance
        except Exception as e:
            log.warning(f"Dynamic universe failed: {e}")
            _mark_fail("polygon")

    return list(STATIC_UNIVERSE)
