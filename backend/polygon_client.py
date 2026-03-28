"""
Polygon.io Client — Primary market data provider for MKW Command Center
Replaces yfinance with professional-grade data: OHLCV, options snapshots,
fundamentals, technical indicators, and grouped daily bars.
"""

import os, time, json, logging
from datetime import datetime, timedelta, date
from typing import Optional

import requests
import pandas as pd
import numpy as np

log = logging.getLogger("mkw.polygon")

POLYGON_KEY = os.getenv("POLYGON_API_KEY", "")
BASE = "https://api.polygon.io"

# ─────────────────────────────────────────────
# INTERNAL HELPERS
# ─────────────────────────────────────────────
_session = requests.Session()


def _get(path: str, params: dict = None, timeout: int = 10) -> Optional[dict]:
    """Make authenticated GET request to Polygon API."""
    if not POLYGON_KEY:
        return None
    p = params or {}
    p["apiKey"] = POLYGON_KEY
    try:
        r = _session.get(f"{BASE}{path}", params=p, timeout=timeout)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 429:
            log.warning("Polygon rate limited, waiting 1s...")
            time.sleep(1)
            r = _session.get(f"{BASE}{path}", params=p, timeout=timeout)
            return r.json() if r.ok else None
        log.warning(f"Polygon {path}: HTTP {r.status_code}")
        return None
    except Exception as e:
        log.warning(f"Polygon {path}: {e}")
        return None


def is_available() -> bool:
    """Check if Polygon API key is configured."""
    return bool(POLYGON_KEY)


# ─────────────────────────────────────────────
# 1. HISTORICAL AGGREGATES (replaces yfinance OHLCV)
# ─────────────────────────────────────────────
def fetch_ohlcv(ticker: str, period: str = "2y") -> Optional[pd.DataFrame]:
    """
    Fetch historical OHLCV data from Polygon.
    Returns DataFrame with columns: Open, High, Low, Close, Volume
    DatetimeIndex, sorted ascending.
    """
    period_map = {
        "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825,
    }
    days = period_map.get(period, 730)
    end = date.today()
    start = end - timedelta(days=days)

    data = _get(
        f"/v2/aggs/ticker/{ticker.upper()}/range/1/day/{start}/{end}",
        {"adjusted": "true", "sort": "asc", "limit": 50000},
    )
    if not data or data.get("resultsCount", 0) == 0:
        return None

    results = data.get("results", [])
    if len(results) < 60:
        return None

    df = pd.DataFrame(results)
    df["Date"] = pd.to_datetime(df["t"], unit="ms")
    df = df.set_index("Date").sort_index()
    df = df.rename(columns={"o": "Open", "h": "High", "l": "Low", "c": "Close", "v": "Volume"})
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
    df["Volume"] = df["Volume"].astype(float)
    return df


def fetch_weekly_ohlcv(ticker: str, years: int = 2) -> Optional[pd.DataFrame]:
    """Fetch weekly bars."""
    end = date.today()
    start = end - timedelta(days=years * 365)
    data = _get(
        f"/v2/aggs/ticker/{ticker.upper()}/range/1/week/{start}/{end}",
        {"adjusted": "true", "sort": "asc", "limit": 50000},
    )
    if not data or not data.get("results"):
        return None
    df = pd.DataFrame(data["results"])
    df["Date"] = pd.to_datetime(df["t"], unit="ms")
    df = df.set_index("Date").sort_index()
    df = df.rename(columns={"o": "Open", "h": "High", "l": "Low", "c": "Close", "v": "Volume"})
    return df[["Open", "High", "Low", "Close", "Volume"]].copy()


# ─────────────────────────────────────────────
# 2. OPTIONS CHAIN SNAPSHOT
# ─────────────────────────────────────────────
def fetch_options_snapshot(ticker: str) -> Optional[dict]:
    """
    Fetch entire options chain in ONE call.
    Returns dict with structured chain data including Greeks.
    """
    data = _get(
        f"/v3/snapshot/options/{ticker.upper()}",
        {"limit": 250},
        timeout=15,
    )
    if not data or not data.get("results"):
        return None

    # Paginate if needed
    all_results = data["results"]
    next_url = data.get("next_url")
    pages = 0
    while next_url and pages < 10:
        try:
            r = _session.get(f"{next_url}&apiKey={POLYGON_KEY}", timeout=10)
            if r.ok:
                page = r.json()
                all_results.extend(page.get("results", []))
                next_url = page.get("next_url")
                pages += 1
            else:
                break
        except Exception:
            break

    # Organize by expiration and type
    calls, puts = [], []
    expirations = set()

    for contract in all_results:
        details = contract.get("details", {})
        greeks = contract.get("greeks", {})
        day = contract.get("day", {})
        last_quote = contract.get("last_quote", {})

        exp = details.get("expiration_date", "")
        strike = details.get("strike_price", 0)
        ctype = details.get("contract_type", "").lower()

        entry = {
            "contractSymbol": details.get("ticker", ""),
            "strike": strike,
            "expiration": exp,
            "lastPrice": day.get("close", 0) or 0,
            "bid": last_quote.get("bid", 0) or 0,
            "ask": last_quote.get("ask", 0) or 0,
            "volume": day.get("volume", 0) or 0,
            "openInterest": contract.get("open_interest", 0) or 0,
            "impliedVolatility": contract.get("implied_volatility", 0) or 0,
            "delta": greeks.get("delta", 0) or 0,
            "gamma": greeks.get("gamma", 0) or 0,
            "theta": greeks.get("theta", 0) or 0,
            "vega": greeks.get("vega", 0) or 0,
        }

        expirations.add(exp)
        if ctype == "call":
            calls.append(entry)
        elif ctype == "put":
            puts.append(entry)

    sorted_exps = sorted(expirations)

    return {
        "ticker": ticker.upper(),
        "expirations": sorted_exps,
        "calls": calls,
        "puts": puts,
        "total_contracts": len(all_results),
        "timestamp": datetime.utcnow().isoformat(),
    }


def build_chain_dataframes(snapshot: dict) -> dict:
    """
    Convert snapshot to per-expiration DataFrames matching yfinance format.
    Returns {expiration: {"calls": DataFrame, "puts": DataFrame}}
    """
    if not snapshot:
        return {}
    result = {}
    for exp in snapshot["expirations"]:
        exp_calls = [c for c in snapshot["calls"] if c["expiration"] == exp]
        exp_puts = [p for p in snapshot["puts"] if p["expiration"] == exp]
        result[exp] = {
            "calls": pd.DataFrame(exp_calls) if exp_calls else pd.DataFrame(),
            "puts": pd.DataFrame(exp_puts) if exp_puts else pd.DataFrame(),
        }
    return result


# ─────────────────────────────────────────────
# 3. DELAYED QUOTES / SNAPSHOT
# ─────────────────────────────────────────────
def fetch_quote(ticker: str) -> Optional[dict]:
    """
    Fetch delayed quote snapshot.
    Returns: price, change, volume, VWAP, prev_close.
    """
    data = _get(f"/v2/snapshot/locale/us/markets/stocks/tickers/{ticker.upper()}")
    if not data or not data.get("ticker"):
        return None
    t = data["ticker"]
    day = t.get("day", {})
    prev = t.get("prevDay", {})
    return {
        "price": day.get("c", 0) or t.get("lastTrade", {}).get("p", 0),
        "change": round(day.get("c", 0) - prev.get("c", 0), 2) if day.get("c") and prev.get("c") else 0,
        "changePct": round(t.get("todaysChangePerc", 0), 2),
        "volume": day.get("v", 0),
        "vwap": day.get("vw", 0),
        "prevClose": prev.get("c", 0),
        "open": day.get("o", 0),
        "high": day.get("h", 0),
        "low": day.get("l", 0),
    }


# ─────────────────────────────────────────────
# 4. GROUPED DAILY (screener accelerator)
# ─────────────────────────────────────────────
def fetch_grouped_daily(target_date: str = "") -> Optional[dict]:
    """
    Fetch OHLCV for ALL US stocks in ONE call.
    Returns dict of {ticker: {open, high, low, close, volume, vwap}}.
    """
    if not target_date:
        d = date.today()
        if d.weekday() >= 5:  # weekend
            d -= timedelta(days=d.weekday() - 4)
        target_date = d.strftime("%Y-%m-%d")

    data = _get(
        f"/v2/aggs/grouped/locale/us/market/stocks/{target_date}",
        {"adjusted": "true"},
        timeout=20,
    )
    if not data or not data.get("results"):
        return None

    result = {}
    for bar in data["results"]:
        tk = bar.get("T", "")
        result[tk] = {
            "open": bar.get("o", 0),
            "high": bar.get("h", 0),
            "low": bar.get("l", 0),
            "close": bar.get("c", 0),
            "volume": bar.get("v", 0),
            "vwap": bar.get("vw", 0),
        }
    return result


# ─────────────────────────────────────────────
# 5. TECHNICAL INDICATORS (pre-calculated)
# ─────────────────────────────────────────────
def fetch_sma(ticker: str, window: int = 50, timespan: str = "day", limit: int = 100) -> Optional[list]:
    """Fetch pre-calculated SMA."""
    data = _get(
        f"/v1/indicators/sma/{ticker.upper()}",
        {"timespan": timespan, "window": window, "series_type": "close",
         "order": "desc", "limit": limit, "adjusted": "true"},
    )
    if not data or not data.get("results", {}).get("values"):
        return None
    return data["results"]["values"]


def fetch_ema(ticker: str, window: int = 20, timespan: str = "day", limit: int = 100) -> Optional[list]:
    """Fetch pre-calculated EMA."""
    data = _get(
        f"/v1/indicators/ema/{ticker.upper()}",
        {"timespan": timespan, "window": window, "series_type": "close",
         "order": "desc", "limit": limit, "adjusted": "true"},
    )
    if not data or not data.get("results", {}).get("values"):
        return None
    return data["results"]["values"]


def fetch_rsi(ticker: str, window: int = 14, timespan: str = "day", limit: int = 100) -> Optional[list]:
    """Fetch pre-calculated RSI."""
    data = _get(
        f"/v1/indicators/rsi/{ticker.upper()}",
        {"timespan": timespan, "window": window, "series_type": "close",
         "order": "desc", "limit": limit, "adjusted": "true"},
    )
    if not data or not data.get("results", {}).get("values"):
        return None
    return data["results"]["values"]


def fetch_macd(ticker: str, timespan: str = "day", limit: int = 100) -> Optional[list]:
    """Fetch pre-calculated MACD."""
    data = _get(
        f"/v1/indicators/macd/{ticker.upper()}",
        {"timespan": timespan, "short_window": 12, "long_window": 26,
         "signal_window": 9, "series_type": "close",
         "order": "desc", "limit": limit, "adjusted": "true"},
    )
    if not data or not data.get("results", {}).get("values"):
        return None
    return data["results"]["values"]


# ─────────────────────────────────────────────
# 6. TICKER DETAILS / FUNDAMENTALS
# ─────────────────────────────────────────────
def fetch_ticker_details(ticker: str) -> Optional[dict]:
    """
    Fetch company details: name, sector, market cap, shares, etc.
    """
    data = _get(f"/v3/reference/tickers/{ticker.upper()}")
    if not data or not data.get("results"):
        return None
    r = data["results"]
    return {
        "name": r.get("name", ticker),
        "sector": r.get("sic_description", ""),
        "industry": r.get("sic_description", ""),
        "marketCap": r.get("market_cap", 0) or 0,
        "sharesOutstanding": r.get("share_class_shares_outstanding", 0) or 0,
        "description": r.get("description", ""),
        "exchange": r.get("primary_exchange", ""),
        "type": r.get("type", ""),
        "locale": r.get("locale", ""),
        "listDate": r.get("list_date", ""),
    }


def fetch_financials(ticker: str) -> Optional[dict]:
    """
    Fetch company financials from Polygon.
    """
    data = _get(
        f"/vX/reference/financials",
        {"ticker": ticker.upper(), "limit": 4, "sort": "filing_date",
         "order": "desc", "timeframe": "annual"},
        timeout=10,
    )
    if not data or not data.get("results"):
        return None

    results = data["results"]
    if not results:
        return None

    # Calculate growth rates from most recent vs prior
    eps_growth, rev_growth, margins_exp = 0, 0, False

    if len(results) >= 2:
        latest = results[0].get("financials", {})
        prior = results[1].get("financials", {})

        l_income = latest.get("income_statement", {})
        p_income = prior.get("income_statement", {})

        l_ni = l_income.get("net_income_loss", {}).get("value", 0) or 0
        p_ni = p_income.get("net_income_loss", {}).get("value", 0) or 0
        if p_ni and p_ni != 0:
            eps_growth = int((l_ni - p_ni) / abs(p_ni) * 100)

        l_rev = l_income.get("revenues", {}).get("value", 0) or 0
        p_rev = p_income.get("revenues", {}).get("value", 0) or 0
        if p_rev and p_rev != 0:
            rev_growth = int((l_rev - p_rev) / abs(p_rev) * 100)

        l_gp = l_income.get("gross_profit", {}).get("value", 0) or 0
        p_gp = p_income.get("gross_profit", {}).get("value", 0) or 0
        if l_rev and p_rev and l_gp and p_gp:
            margins_exp = (l_gp / l_rev) > (p_gp / p_rev)

    # Get latest metrics
    latest_fin = results[0].get("financials", {}) if results else {}
    income = latest_fin.get("income_statement", {})
    balance = latest_fin.get("balance_sheet", {})
    cf = latest_fin.get("cash_flow_statement", {})

    total_equity = balance.get("equity", {}).get("value", 0) or 0
    total_debt = balance.get("long_term_debt", {}).get("value", 0) or 0
    net_income = income.get("net_income_loss", {}).get("value", 0) or 0
    revenue = income.get("revenues", {}).get("value", 0) or 0
    gross_profit = income.get("gross_profit", {}).get("value", 0) or 0
    operating_income = income.get("operating_income_loss", {}).get("value", 0) or 0
    fcf = cf.get("net_cash_flow_from_operating_activities", {}).get("value", 0) or 0

    return {
        "eps": eps_growth,
        "rev": rev_growth,
        "marginsExpanding": margins_exp,
        "grossMargins": round(gross_profit / revenue, 4) if revenue else 0,
        "operatingMargins": round(operating_income / revenue, 4) if revenue else 0,
        "returnOnEquity": round(net_income / total_equity, 4) if total_equity else 0,
        "freeCashflow": int(fcf),
        "debtToEquity": round(total_debt / total_equity, 2) if total_equity else 0,
    }


# ─────────────────────────────────────────────
# 7. DYNAMIC UNIVERSE
# ─────────────────────────────────────────────
def fetch_active_tickers(
    market: str = "stocks",
    min_market_cap: float = 2e9,
    exchange: str = "",
    limit: int = 1000,
) -> list:
    """
    Fetch all active US tickers. Filter by market cap.
    Returns list of ticker symbols.
    """
    params = {
        "market": market, "active": "true", "limit": limit,
        "order": "asc", "sort": "ticker",
    }
    if exchange:
        params["exchange"] = exchange

    all_tickers = []
    next_url = None
    pages = 0

    # First request
    data = _get("/v3/reference/tickers", params)
    if not data or not data.get("results"):
        return []

    for t in data["results"]:
        mc = t.get("market_cap", 0) or 0
        if mc >= min_market_cap:
            all_tickers.append(t["ticker"])
        elif mc == 0:
            # market_cap might not be in listing data, include anyway
            all_tickers.append(t["ticker"])

    next_url = data.get("next_url")

    # Paginate (up to 5 pages for ~5000 tickers)
    while next_url and pages < 5:
        try:
            r = _session.get(f"{next_url}&apiKey={POLYGON_KEY}", timeout=10)
            if r.ok:
                page = r.json()
                for t in page.get("results", []):
                    mc = t.get("market_cap", 0) or 0
                    if mc >= min_market_cap or mc == 0:
                        all_tickers.append(t["ticker"])
                next_url = page.get("next_url")
                pages += 1
            else:
                break
        except Exception:
            break

    return all_tickers


# ─────────────────────────────────────────────
# IV HISTORY STORAGE (build over time from daily snapshots)
# ─────────────────────────────────────────────
_IV_HISTORY_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "iv_history.json")


def _ensure_data_dir():
    d = os.path.dirname(_IV_HISTORY_PATH)
    os.makedirs(d, exist_ok=True)


def load_iv_history() -> dict:
    """Load stored IV history {ticker: [{date, atm_iv}, ...]}"""
    try:
        with open(_IV_HISTORY_PATH) as f:
            return json.load(f)
    except Exception:
        return {}


def save_iv_history(history: dict):
    """Persist IV history to disk."""
    _ensure_data_dir()
    try:
        with open(_IV_HISTORY_PATH, "w") as f:
            json.dump(history, f)
    except Exception as e:
        log.warning(f"Failed to save IV history: {e}")


def record_daily_iv(ticker: str, atm_iv: float):
    """Record today's ATM IV for building rank/percentile history."""
    history = load_iv_history()
    today = date.today().isoformat()
    entries = history.get(ticker, [])

    # Don't duplicate today
    if entries and entries[-1].get("date") == today:
        entries[-1]["iv"] = atm_iv
    else:
        entries.append({"date": today, "iv": atm_iv})

    # Keep 252 trading days (1 year)
    entries = entries[-252:]
    history[ticker] = entries
    save_iv_history(history)


def calc_iv_rank_from_history(ticker: str, current_iv: float) -> dict:
    """
    Calculate IV Rank and Percentile from stored history.
    Returns {iv_rank, iv_percentile, iv_high, iv_low, days_of_data}.
    """
    history = load_iv_history()
    entries = history.get(ticker, [])
    ivs = [e["iv"] for e in entries if e.get("iv", 0) > 0]

    if len(ivs) < 5:
        return {"iv_rank": 50, "iv_percentile": 50, "iv_high": current_iv, "iv_low": current_iv, "days_of_data": len(ivs)}

    iv_high = max(ivs)
    iv_low = min(ivs)
    iv_range = iv_high - iv_low

    iv_rank = round((current_iv - iv_low) / iv_range * 100) if iv_range > 0 else 50
    iv_rank = max(0, min(100, iv_rank))

    days_below = sum(1 for iv in ivs if iv < current_iv)
    iv_percentile = round(days_below / len(ivs) * 100)

    return {
        "iv_rank": iv_rank,
        "iv_percentile": iv_percentile,
        "iv_high": round(iv_high, 4),
        "iv_low": round(iv_low, 4),
        "days_of_data": len(ivs),
    }


def extract_iv_analysis_from_snapshot(snapshot: dict, spot: float) -> dict:
    """
    Calculate comprehensive IV analysis from Polygon options snapshot.
    Returns: currentIV, ivRank, ivPercentile, termStructure, skew, volOfVol, verdict.
    """
    if not snapshot or not snapshot.get("calls"):
        return _empty_iv_analysis()

    ticker = snapshot["ticker"]
    expirations = snapshot["expirations"]

    # Find ATM calls for each expiration
    atm_ivs = {}
    for exp in expirations:
        exp_calls = [c for c in snapshot["calls"] if c["expiration"] == exp and c["impliedVolatility"] > 0]
        if not exp_calls:
            continue
        # Find closest to ATM
        atm = min(exp_calls, key=lambda c: abs(c["strike"] - spot))
        atm_ivs[exp] = atm["impliedVolatility"]

    if not atm_ivs:
        return _empty_iv_analysis()

    # Current IV = nearest expiry ATM IV
    nearest_exp = min(atm_ivs.keys())
    current_iv = atm_ivs[nearest_exp]

    # Record for history
    record_daily_iv(ticker, current_iv)
    hist = calc_iv_rank_from_history(ticker, current_iv)

    # Term structure
    term_structure = []
    for exp in sorted(atm_ivs.keys())[:6]:
        term_structure.append({"expiration": exp, "iv": round(atm_ivs[exp], 4)})

    term_shape = "FLAT"
    if len(term_structure) >= 2:
        front = term_structure[0]["iv"]
        back = term_structure[-1]["iv"]
        if back > front * 1.05:
            term_shape = "CONTANGO"
        elif front > back * 1.05:
            term_shape = "BACKWARDATION"

    # Skew analysis (nearest expiry)
    nearest_calls = [c for c in snapshot["calls"] if c["expiration"] == nearest_exp and c["impliedVolatility"] > 0]
    skew_data = []
    for c in sorted(nearest_calls, key=lambda x: x["strike"]):
        moneyness = round((c["strike"] / spot - 1) * 100, 1)
        if -20 <= moneyness <= 20:
            skew_data.append({"strike": c["strike"], "moneyness": moneyness, "iv": round(c["impliedVolatility"], 4)})

    otm_put_iv = 0
    atm_iv_val = current_iv
    otm_call_iv = 0
    for c in skew_data:
        if -10 <= c["moneyness"] <= -5:
            otm_put_iv = max(otm_put_iv, c["iv"])
        if 5 <= c["moneyness"] <= 10:
            otm_call_iv = max(otm_call_iv, c["iv"])

    skew_verdict = "neutral"
    if otm_put_iv > atm_iv_val * 1.15:
        skew_verdict = "put-heavy (demand for downside protection)"
    elif otm_call_iv > atm_iv_val * 1.10:
        skew_verdict = "call-heavy (unusual upside demand)"

    # Vol of Vol (from term structure variation)
    if len(list(atm_ivs.values())) >= 3:
        vov = round(float(np.std(list(atm_ivs.values())) / np.mean(list(atm_ivs.values())) * 100), 1)
    else:
        vov = 0

    vov_verdict = "stable"
    if vov > 20:
        vov_verdict = "unstable — significant IV dispersion across expirations"
    elif vov > 10:
        vov_verdict = "moderate — some IV uncertainty"

    # Overall verdict
    iv_rank = hist["iv_rank"]
    if iv_rank < 25 and term_shape != "BACKWARDATION":
        verdict = "FAVORABLE"
        reason = f"IV Rank {iv_rank} (low) — options cheap, debit strategies preferred"
    elif iv_rank > 75:
        verdict = "UNFAVORABLE"
        reason = f"IV Rank {iv_rank} (high) — options expensive, credit strategies or wait"
    else:
        verdict = "NEUTRAL"
        reason = f"IV Rank {iv_rank} — normal pricing, spreads recommended"

    return {
        "currentIV": round(current_iv, 4),
        "ivRank": iv_rank,
        "ivPercentile": hist["iv_percentile"],
        "ivHigh52w": hist["iv_high"],
        "ivLow52w": hist["iv_low"],
        "daysOfData": hist["days_of_data"],
        "termStructure": term_shape,
        "termStructureDetail": term_structure,
        "skew": skew_data,
        "skewVerdict": skew_verdict,
        "volOfVol": vov,
        "volOfVolVerdict": vov_verdict,
        "verdict": verdict,
        "verdictReason": reason,
        "source": "polygon",
    }


def _empty_iv_analysis() -> dict:
    return {
        "currentIV": 0, "ivRank": 50, "ivPercentile": 50,
        "ivHigh52w": 0, "ivLow52w": 0, "daysOfData": 0,
        "termStructure": "UNKNOWN", "termStructureDetail": [],
        "skew": [], "skewVerdict": "unknown",
        "volOfVol": 0, "volOfVolVerdict": "unknown",
        "verdict": "NEUTRAL", "verdictReason": "Insufficient data",
        "source": "none",
    }
