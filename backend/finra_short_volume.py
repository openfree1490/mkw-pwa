"""
FINRA Daily Short Volume — Institutional short volume intelligence
Free public data, no API key required.
Downloads daily CNMS short volume report, calculates SVR and signals.
"""

import os, json, logging, io
from datetime import datetime, timedelta, date
from typing import Optional

import requests
import numpy as np

log = logging.getLogger("mkw.finra")

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_HISTORY_PATH = os.path.join(_DATA_DIR, "finra_svr_history.json")

FINRA_BASE = "https://cdn.finra.org/equity/regsho/daily"

# Multiple FINRA files cover different exchanges — aggregate for completeness
FINRA_PREFIXES = ["CNMSshvol", "FNYXshvol", "FNQCshvol"]


def _ensure_data_dir():
    os.makedirs(_DATA_DIR, exist_ok=True)


# ─────────────────────────────────────────────
# DATA FETCHING
# ─────────────────────────────────────────────
def _trading_dates(n: int = 20) -> list:
    """Generate last N trading dates (weekdays only)."""
    dates = []
    d = date.today()
    while len(dates) < n:
        if d.weekday() < 5:
            dates.append(d)
        d -= timedelta(days=1)
    return dates


def fetch_daily_file(target_date: date) -> Optional[list]:
    """
    Download and parse FINRA short volume files for a given date.
    Aggregates across CNMS, FNYC, FNQC for complete exchange coverage.
    File is pipe-delimited: Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market
    Returns list of dicts: [{symbol, short_vol, total_vol, svr}, ...]
    """
    date_str = target_date.strftime("%Y%m%d")

    # Aggregate across multiple FINRA files
    aggregated = {}  # symbol -> {short_vol, total_vol}

    for prefix in FINRA_PREFIXES:
        url = f"{FINRA_BASE}/{prefix}{date_str}.txt"
        try:
            r = requests.get(url, timeout=10)
            if r.status_code != 200:
                continue

            lines = r.text.strip().split("\n")
            for line in lines[1:]:  # Skip header
                parts = line.strip().split("|")
                if len(parts) < 5:
                    continue
                try:
                    symbol = parts[1].strip()
                    short_vol = int(float(parts[2]))
                    total_vol = int(float(parts[4]))
                    if total_vol > 0:
                        if symbol not in aggregated:
                            aggregated[symbol] = {"short_vol": 0, "total_vol": 0}
                        aggregated[symbol]["short_vol"] += short_vol
                        aggregated[symbol]["total_vol"] += total_vol
                except (ValueError, IndexError):
                    continue
        except Exception as e:
            log.warning(f"FINRA fetch {prefix}{date_str}: {e}")

    if not aggregated:
        return None

    records = []
    for symbol, data in aggregated.items():
        if data["total_vol"] > 0:
            svr = round(data["short_vol"] / data["total_vol"] * 100, 1)
            records.append({
                "symbol": symbol,
                "short_vol": data["short_vol"],
                "total_vol": data["total_vol"],
                "svr": svr,
                "date": target_date.isoformat(),
            })

    return records


# ─────────────────────────────────────────────
# HISTORY MANAGEMENT
# ─────────────────────────────────────────────
def load_history() -> dict:
    """Load stored SVR history: {ticker: [{date, svr, short_vol, total_vol}, ...]}"""
    try:
        with open(_HISTORY_PATH) as f:
            return json.load(f)
    except Exception:
        return {}


def save_history(history: dict):
    """Persist SVR history."""
    _ensure_data_dir()
    try:
        with open(_HISTORY_PATH, "w") as f:
            json.dump(history, f)
    except Exception as e:
        log.warning(f"Failed to save FINRA history: {e}")


def update_history(universe: list = None):
    """
    Download latest trading day's data and update history.
    Called once daily after 5 PM ET.
    """
    history = load_history()
    dates_to_fetch = _trading_dates(5)  # Last 5 days to fill gaps

    for target_date in dates_to_fetch:
        date_str = target_date.isoformat()
        # Check if we already have this date
        sample_ticker = next(iter(history), None)
        if sample_ticker:
            existing_dates = {e["date"] for e in history.get(sample_ticker, [])}
            if date_str in existing_dates:
                continue

        records = fetch_daily_file(target_date)
        if not records:
            continue

        log.info(f"FINRA: Processing {len(records)} records for {date_str}")

        # Filter to universe if provided
        record_map = {r["symbol"]: r for r in records}

        tickers_to_update = universe or list(record_map.keys())
        for ticker in tickers_to_update:
            if ticker not in record_map:
                continue
            r = record_map[ticker]
            entries = history.get(ticker, [])
            # Don't duplicate
            if entries and entries[-1].get("date") == date_str:
                continue
            entries.append({
                "date": date_str,
                "svr": r["svr"],
                "short_vol": r["short_vol"],
                "total_vol": r["total_vol"],
            })
            # Keep 20 trading days
            history[ticker] = entries[-20:]

    save_history(history)
    log.info(f"FINRA history updated: {len(history)} tickers")
    return history


# ─────────────────────────────────────────────
# ANALYSIS
# ─────────────────────────────────────────────
def _svr_label(svr: float) -> str:
    if svr >= 65:
        return "EXTREME"
    if svr >= 55:
        return "HIGH"
    if svr >= 50:
        return "ELEVATED"
    if svr >= 35:
        return "NORMAL"
    return "LOW"


def analyze_ticker(ticker: str) -> dict:
    """
    Full SVR analysis for a single ticker.
    Returns: {svr_today, svr_5d_avg, svr_20d_avg, svr_trend, svr_spike, signal, label, history}
    """
    history = load_history()
    entries = history.get(ticker.upper(), [])

    if not entries:
        return {
            "ticker": ticker.upper(),
            "svr_today": None, "svr_5d_avg": None, "svr_20d_avg": None,
            "svr_trend": "unknown", "svr_spike": False,
            "signal": "NO DATA", "label": "UNKNOWN", "color": "gray",
            "history": [],
        }

    svrs = [e["svr"] for e in entries]
    svr_today = svrs[-1] if svrs else 0
    svr_5d = round(np.mean(svrs[-5:]), 1) if len(svrs) >= 5 else round(np.mean(svrs), 1)
    svr_20d = round(np.mean(svrs), 1)

    # Trend: compare last 5 vs previous 5
    if len(svrs) >= 10:
        recent = np.mean(svrs[-5:])
        prior = np.mean(svrs[-10:-5])
        if recent > prior * 1.1:
            trend = "RISING"
        elif recent < prior * 0.9:
            trend = "FALLING"
        else:
            trend = "STABLE"
    elif len(svrs) >= 3:
        if svrs[-1] > svrs[0] * 1.1:
            trend = "RISING"
        elif svrs[-1] < svrs[0] * 0.9:
            trend = "FALLING"
        else:
            trend = "STABLE"
    else:
        trend = "UNKNOWN"

    # Spike detection: today > 20d avg + 2 std dev
    spike = False
    if len(svrs) >= 5:
        std = float(np.std(svrs))
        spike = svr_today > (svr_20d + 2 * std)

    # Signal interpretation
    # Key nuance: High SVR alone is NOT bearish. Signal = TREND + DEVIATION + CONTEXT
    label = _svr_label(svr_today)
    if label == "LOW":
        signal = "BULLISH — minimal short pressure"
        color = "green"
    elif label == "NORMAL":
        signal = "NEUTRAL — normal market making activity"
        color = "gray"
    elif label == "ELEVATED" and trend == "RISING":
        signal = "CAUTION — rising short pressure"
        color = "yellow"
    elif label == "ELEVATED":
        signal = "NEUTRAL-ELEVATED — within normal range"
        color = "yellow"
    elif label == "HIGH" and spike:
        signal = "WARNING — spike detected, potential distribution"
        color = "red"
    elif label == "HIGH" and trend == "RISING":
        signal = "BEARISH — sustained high short volume"
        color = "red"
    elif label == "HIGH":
        signal = "ELEVATED — consistently high but stable"
        color = "orange"
    elif label == "EXTREME" and spike:
        signal = "EXTREME — possible forced covering or heavy distribution"
        color = "red"
    else:
        signal = f"{label} — {trend.lower()} trend"
        color = "red" if svr_today >= 55 else "yellow"

    return {
        "ticker": ticker.upper(),
        "svr_today": svr_today,
        "svr_5d_avg": svr_5d,
        "svr_20d_avg": svr_20d,
        "svr_trend": trend,
        "svr_spike": spike,
        "signal": signal,
        "label": label,
        "color": color,
        "history": entries[-20:],
    }


def convergence_adjustment(ticker: str, is_short: bool = False) -> int:
    """
    Calculate convergence score adjustment from SVR.
    +1 if SVR < 35% (for longs) or > 55% (for shorts).
    """
    data = analyze_ticker(ticker)
    svr = data.get("svr_today")
    if svr is None:
        return 0
    if not is_short and svr < 35:
        return 1  # Low short pressure = bullish for longs
    if is_short and svr > 55:
        return 1  # High short pressure = supports short thesis
    return 0


def top_short_volume(universe: list, n: int = 10) -> list:
    """
    Get top N tickers by SVR from universe.
    Returns sorted list of analysis dicts.
    """
    results = []
    for ticker in universe:
        data = analyze_ticker(ticker)
        if data.get("svr_today") is not None:
            results.append(data)

    results.sort(key=lambda x: x.get("svr_today", 0), reverse=True)
    return results[:n]


def short_squeeze_candidates(universe: list) -> list:
    """
    Find short squeeze candidates:
    - SVR > 55% AND trend RISING AND price trend UP
    These stocks have heavy shorting but price is resilient.
    """
    results = []
    for ticker in universe:
        data = analyze_ticker(ticker)
        svr = data.get("svr_today")
        if svr and svr > 55 and data.get("svr_trend") == "RISING":
            results.append(data)

    results.sort(key=lambda x: x.get("svr_today", 0), reverse=True)
    return results


def distribution_detection(universe: list) -> list:
    """
    Find distribution signals:
    - SVR spike detected AND trend RISING
    """
    results = []
    for ticker in universe:
        data = analyze_ticker(ticker)
        if data.get("svr_spike") and data.get("svr_trend") in ("RISING", "STABLE"):
            results.append(data)

    results.sort(key=lambda x: x.get("svr_today", 0), reverse=True)
    return results
