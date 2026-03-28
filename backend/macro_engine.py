"""
Macro Intelligence Engine — FRED API integration for MKW Command Center
Tracks rates, inflation, labor, growth, financial conditions.
Provides macro score (0-10) and economic event calendar.
"""

import os, json, logging, time
from datetime import datetime, timedelta, date
from typing import Optional

import requests

log = logging.getLogger("mkw.macro")

FRED_KEY = os.getenv("FRED_API_KEY", "")
FRED_BASE = "https://api.stlouisfed.org/fred"

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_MACRO_CACHE_PATH = os.path.join(_DATA_DIR, "macro_cache.json")

# ─────────────────────────────────────────────
# FRED API HELPERS
# ─────────────────────────────────────────────
_session = requests.Session()


def _fred_get(series_id: str, limit: int = 10, sort_order: str = "desc") -> Optional[list]:
    """Fetch FRED series observations."""
    if not FRED_KEY:
        return None
    try:
        r = _session.get(
            f"{FRED_BASE}/series/observations",
            params={
                "series_id": series_id, "api_key": FRED_KEY,
                "file_type": "json", "limit": limit,
                "sort_order": sort_order,
            },
            timeout=10,
        )
        if r.ok:
            obs = r.json().get("observations", [])
            return [{"date": o["date"], "value": float(o["value"])} for o in obs if o.get("value", ".") != "."]
        return None
    except Exception as e:
        log.warning(f"FRED {series_id}: {e}")
        return None


def is_available() -> bool:
    return bool(FRED_KEY)


# ─────────────────────────────────────────────
# SERIES DEFINITIONS
# ─────────────────────────────────────────────
SERIES = {
    # Rates
    "DFF": {"name": "Fed Funds Rate", "category": "rates", "frequency": "daily"},
    "DGS10": {"name": "10-Year Treasury", "category": "rates", "frequency": "daily"},
    "DGS2": {"name": "2-Year Treasury", "category": "rates", "frequency": "daily"},
    "T10Y2Y": {"name": "Yield Curve (10Y-2Y)", "category": "rates", "frequency": "daily"},

    # Inflation
    "CPIAUCSL": {"name": "CPI (All Urban)", "category": "inflation", "frequency": "monthly"},
    "PCEPILFE": {"name": "Core PCE", "category": "inflation", "frequency": "monthly"},
    "T10YIE": {"name": "Breakeven Inflation", "category": "inflation", "frequency": "daily"},

    # Labor
    "UNRATE": {"name": "Unemployment Rate", "category": "labor", "frequency": "monthly"},
    "ICSA": {"name": "Weekly Jobless Claims", "category": "labor", "frequency": "weekly"},

    # Growth
    "GDPC1": {"name": "Real GDP", "category": "growth", "frequency": "quarterly"},
    "RSXFS": {"name": "Retail Sales", "category": "growth", "frequency": "monthly"},

    # Financial Conditions
    "NFCI": {"name": "Chicago Fed Fin. Conditions", "category": "conditions", "frequency": "weekly"},
    "BAMLH0A0HYM2": {"name": "HY OAS Spread", "category": "conditions", "frequency": "daily"},

    # Market
    "VIXCLS": {"name": "VIX (Historical)", "category": "market", "frequency": "daily"},
}


# ─────────────────────────────────────────────
# DATA FETCHING
# ─────────────────────────────────────────────
def fetch_all_series() -> dict:
    """
    Fetch latest values for all tracked FRED series.
    Returns: {series_id: {name, category, latest_value, latest_date, prior_value, change}}
    """
    if not FRED_KEY:
        return {}

    result = {}
    for sid, meta in SERIES.items():
        obs = _fred_get(sid, limit=5)
        if obs and len(obs) >= 1:
            latest = obs[0]
            prior = obs[1] if len(obs) >= 2 else latest
            change = round(latest["value"] - prior["value"], 4)
            result[sid] = {
                "name": meta["name"],
                "category": meta["category"],
                "value": latest["value"],
                "date": latest["date"],
                "prior": prior["value"],
                "change": change,
                "direction": "up" if change > 0 else "down" if change < 0 else "flat",
            }
        time.sleep(0.15)  # Respect rate limits

    return result


# ─────────────────────────────────────────────
# MACRO SCORE (0-10)
# ─────────────────────────────────────────────
def calc_macro_score(data: dict) -> dict:
    """
    Calculate macro environment score (0-10).
    8-10: TAILWIND, 5-7: NEUTRAL, 3-4: HEADWIND, 0-2: CRISIS
    """
    score = 0
    breakdown = []

    # Yield curve positive (T10Y2Y > 0): +2
    t10y2y = data.get("T10Y2Y", {}).get("value")
    if t10y2y is not None:
        if t10y2y > 0:
            score += 2
            breakdown.append({"factor": "Yield Curve", "points": 2, "detail": f"Positive ({t10y2y:.2f}%)"})
        else:
            breakdown.append({"factor": "Yield Curve", "points": 0, "detail": f"Inverted ({t10y2y:.2f}%)"})

    # Financial conditions loose (NFCI < 0): +2
    nfci = data.get("NFCI", {}).get("value")
    if nfci is not None:
        if nfci < 0:
            score += 2
            breakdown.append({"factor": "Fin. Conditions", "points": 2, "detail": f"Loose (NFCI {nfci:.2f})"})
        else:
            breakdown.append({"factor": "Fin. Conditions", "points": 0, "detail": f"Tight (NFCI {nfci:.2f})"})

    # Inflation trending down: +1
    cpi = data.get("CPIAUCSL", {})
    if cpi.get("change") is not None:
        if cpi["change"] <= 0 or cpi.get("direction") == "down":
            score += 1
            breakdown.append({"factor": "CPI Trend", "points": 1, "detail": "Declining"})
        else:
            breakdown.append({"factor": "CPI Trend", "points": 0, "detail": "Rising"})

    # Core PCE below 3%: +1
    pce = data.get("PCEPILFE", {}).get("value")
    if pce is not None:
        # PCE is index, need YoY. Approximate: if latest < 3 (as rate proxy)
        # FRED provides the index, not the rate. We compare change.
        # For simplicity, use the breakeven inflation as proxy
        bei = data.get("T10YIE", {}).get("value")
        if bei is not None and bei < 3.0:
            score += 1
            breakdown.append({"factor": "Inflation Expect.", "points": 1, "detail": f"Breakeven {bei:.2f}%"})
        elif bei is not None:
            breakdown.append({"factor": "Inflation Expect.", "points": 0, "detail": f"Breakeven {bei:.2f}%"})

    # Unemployment below 5%: +1
    unrate = data.get("UNRATE", {}).get("value")
    if unrate is not None:
        if unrate < 5.0:
            score += 1
            breakdown.append({"factor": "Unemployment", "points": 1, "detail": f"{unrate:.1f}%"})
        else:
            breakdown.append({"factor": "Unemployment", "points": 0, "detail": f"{unrate:.1f}%"})

    # HY spread below 400bps: +1
    hy = data.get("BAMLH0A0HYM2", {}).get("value")
    if hy is not None:
        if hy < 4.0:
            score += 1
            breakdown.append({"factor": "HY Spread", "points": 1, "detail": f"{round(hy * 100)}bps"})
        else:
            breakdown.append({"factor": "HY Spread", "points": 0, "detail": f"{round(hy * 100)}bps"})

    # 10Y below 5%: +1
    dgs10 = data.get("DGS10", {}).get("value")
    if dgs10 is not None:
        if dgs10 < 5.0:
            score += 1
            breakdown.append({"factor": "10Y Yield", "points": 1, "detail": f"{dgs10:.2f}%"})
        else:
            breakdown.append({"factor": "10Y Yield", "points": 0, "detail": f"{dgs10:.2f}%"})

    # GDP growth positive: +1
    gdp = data.get("GDPC1", {})
    if gdp.get("change") is not None:
        if gdp["change"] > 0:
            score += 1
            breakdown.append({"factor": "GDP Growth", "points": 1, "detail": "Positive"})
        else:
            breakdown.append({"factor": "GDP Growth", "points": 0, "detail": "Contracting"})

    # Determine regime
    if score >= 8:
        regime = "TAILWIND"
        color = "green"
        sizing = "Full position sizing permitted"
    elif score >= 5:
        regime = "NEUTRAL"
        color = "yellow"
        sizing = "Standard position sizing"
    elif score >= 3:
        regime = "HEADWIND"
        color = "orange"
        sizing = "Half position sizes"
    else:
        regime = "CRISIS"
        color = "red"
        sizing = "No new trades. Capital preservation only."

    return {
        "score": score,
        "max": 10,
        "regime": regime,
        "color": color,
        "sizing": sizing,
        "breakdown": breakdown,
    }


# ─────────────────────────────────────────────
# KEY RATES SUMMARY
# ─────────────────────────────────────────────
def get_key_rates(data: dict) -> dict:
    """Extract key rates for dashboard display."""
    return {
        "fed_funds": data.get("DFF", {}).get("value"),
        "ten_year": data.get("DGS10", {}).get("value"),
        "two_year": data.get("DGS2", {}).get("value"),
        "yield_curve": data.get("T10Y2Y", {}).get("value"),
        "vix": data.get("VIXCLS", {}).get("value"),
        "hy_spread": data.get("BAMLH0A0HYM2", {}).get("value"),
        "nfci": data.get("NFCI", {}).get("value"),
        "unemployment": data.get("UNRATE", {}).get("value"),
        "claims": data.get("ICSA", {}).get("value"),
    }


# ─────────────────────────────────────────────
# ECONOMIC EVENTS CALENDAR
# ─────────────────────────────────────────────
# Major economic events with approximate dates (updated manually or via data source)
# In production, this would be fetched from an API. For now, maintain a rolling list.
_ECONOMIC_EVENTS = [
    # Format: (month, day_approx, event, impact)
    # These repeat monthly/quarterly — logic below generates upcoming dates
]

# Known recurring events
RECURRING_EVENTS = [
    {"name": "FOMC Meeting", "frequency": "6-weekly", "impact": "HIGH",
     "dates_2026": ["01-28", "03-18", "05-06", "06-17", "07-29", "09-16", "11-04", "12-16"]},
    {"name": "CPI Release", "frequency": "monthly", "impact": "HIGH", "day_of_month": 12},
    {"name": "Jobs Report (NFP)", "frequency": "monthly", "impact": "HIGH", "day_of_month": 5},
    {"name": "Core PCE", "frequency": "monthly", "impact": "HIGH", "day_of_month": 28},
    {"name": "GDP (Advance)", "frequency": "quarterly", "impact": "MEDIUM",
     "dates_2026": ["01-30", "04-29", "07-30", "10-29"]},
    {"name": "Retail Sales", "frequency": "monthly", "impact": "MEDIUM", "day_of_month": 15},
]


def get_upcoming_events(days_ahead: int = 14) -> list:
    """
    Get economic events within the next N days.
    Returns sorted list: [{name, date, impact, days_until}]
    """
    today = date.today()
    end = today + timedelta(days=days_ahead)
    events = []

    for event in RECURRING_EVENTS:
        # Check specific dates first
        if "dates_2026" in event:
            for d_str in event["dates_2026"]:
                try:
                    event_date = date(today.year, int(d_str[:2]), int(d_str[3:5]))
                    if today <= event_date <= end:
                        days_until = (event_date - today).days
                        events.append({
                            "name": event["name"],
                            "date": event_date.isoformat(),
                            "impact": event["impact"],
                            "days_until": days_until,
                            "imminent": days_until <= 2,
                        })
                except ValueError:
                    continue

        # Check recurring monthly events
        if "day_of_month" in event:
            for month_offset in [0, 1]:
                m = today.month + month_offset
                y = today.year
                if m > 12:
                    m -= 12
                    y += 1
                try:
                    event_date = date(y, m, min(event["day_of_month"], 28))
                    if today <= event_date <= end:
                        days_until = (event_date - today).days
                        events.append({
                            "name": event["name"],
                            "date": event_date.isoformat(),
                            "impact": event["impact"],
                            "days_until": days_until,
                            "imminent": days_until <= 2,
                        })
                except ValueError:
                    continue

    events.sort(key=lambda e: e["days_until"])
    # Deduplicate by name+date
    seen = set()
    unique = []
    for e in events:
        key = f"{e['name']}_{e['date']}"
        if key not in seen:
            seen.add(key)
            unique.append(e)

    return unique


# ─────────────────────────────────────────────
# POSITION SIZING MODIFIER
# ─────────────────────────────────────────────
def sizing_modifier(macro_score: int) -> float:
    """
    Returns position sizing multiplier based on macro score.
    8+: 1.0 (full), 5-7: 0.75 (standard), 3-4: 0.5 (half), 0-2: 0.0 (no new trades)
    """
    if macro_score >= 8:
        return 1.0
    if macro_score >= 5:
        return 0.75
    if macro_score >= 3:
        return 0.5
    return 0.0


# ─────────────────────────────────────────────
# SECTOR-SPECIFIC MACRO CONTEXT
# ─────────────────────────────────────────────
def sector_macro_context(sector: str, data: dict) -> str:
    """
    Generate sector-specific macro commentary for Analyze page.
    """
    dgs10 = data.get("DGS10", {}).get("value", 0) or 0
    nfci = data.get("NFCI", {}).get("value", 0) or 0
    hy = data.get("BAMLH0A0HYM2", {}).get("value", 0) or 0

    sector_lower = (sector or "").lower()

    if "tech" in sector_lower or "software" in sector_lower:
        rate_impact = "favorable" if dgs10 < 4.5 else "headwind" if dgs10 > 5 else "neutral"
        return f"Tech: Rates {rate_impact} (10Y: {dgs10:.2f}%). Growth stocks sensitive to discount rate. NFCI: {'loose' if nfci < 0 else 'tight'}."

    if "financ" in sector_lower or "bank" in sector_lower:
        curve = data.get("T10Y2Y", {}).get("value", 0) or 0
        return f"Financials: Yield curve {'positive' if curve > 0 else 'inverted'} ({curve:.2f}%). NIM {'expanding' if curve > 0.5 else 'compressing'}."

    if "energy" in sector_lower:
        return f"Energy: Macro {'supportive' if nfci < 0 else 'cautious'}. Watch for demand signals in GDP/retail data."

    if "health" in sector_lower:
        return f"Healthcare: Defensive sector. Less rate-sensitive. HY spread: {round((hy or 0) * 100)}bps."

    if "consumer" in sector_lower or "retail" in sector_lower:
        unrate = data.get("UNRATE", {}).get("value", 0) or 0
        return f"Consumer: Unemployment {unrate:.1f}%. Labor market {'strong' if unrate < 4.5 else 'softening'}."

    if "industrial" in sector_lower or "material" in sector_lower:
        gdp_dir = data.get("GDPC1", {}).get("direction", "flat")
        return f"Industrials: GDP {gdp_dir}. Cyclical — tracks economic expansion."

    if "real estate" in sector_lower:
        return f"Real Estate: Rate-sensitive. 10Y at {dgs10:.2f}%. {'Favorable' if dgs10 < 4 else 'Challenging'} environment."

    if "utilit" in sector_lower:
        return f"Utilities: Yield play. 10Y at {dgs10:.2f}%. {'Less attractive vs bonds' if dgs10 > 4.5 else 'Competitive yield'}."

    return f"Macro backdrop: NFCI {'loose' if nfci < 0 else 'tight'}, 10Y: {dgs10:.2f}%."


# ─────────────────────────────────────────────
# FULL MACRO DASHBOARD
# ─────────────────────────────────────────────
def get_full_macro() -> dict:
    """
    Get complete macro intelligence package.
    Returns: {series, score, rates, events, sizing, timestamp}
    """
    # Try loading from cache first
    cached = _load_cache()
    if cached and _is_fresh(cached):
        return cached

    data = fetch_all_series()
    if not data:
        return _empty_macro()

    score = calc_macro_score(data)
    rates = get_key_rates(data)
    events = get_upcoming_events(14)

    result = {
        "series": data,
        "score": score,
        "rates": rates,
        "events": events,
        "sizing_modifier": sizing_modifier(score["score"]),
        "timestamp": datetime.utcnow().isoformat(),
    }

    _save_cache(result)
    return result


def _empty_macro() -> dict:
    return {
        "series": {},
        "score": {"score": 5, "max": 10, "regime": "NEUTRAL", "color": "yellow",
                  "sizing": "Standard (FRED unavailable)", "breakdown": []},
        "rates": {},
        "events": get_upcoming_events(14),
        "sizing_modifier": 0.75,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────
# FILE CACHE (refresh daily at 7 AM ET)
# ─────────────────────────────────────────────
def _ensure_data_dir():
    os.makedirs(_DATA_DIR, exist_ok=True)


def _load_cache() -> Optional[dict]:
    try:
        with open(_MACRO_CACHE_PATH) as f:
            return json.load(f)
    except Exception:
        return None


def _save_cache(data: dict):
    _ensure_data_dir()
    try:
        with open(_MACRO_CACHE_PATH, "w") as f:
            json.dump(data, f)
    except Exception as e:
        log.warning(f"Failed to save macro cache: {e}")


def _is_fresh(cached: dict) -> bool:
    """Check if cached data is still fresh (< 24 hours for daily, < 1 week for monthly)."""
    ts = cached.get("timestamp", "")
    if not ts:
        return False
    try:
        cache_time = datetime.fromisoformat(ts)
        age_hours = (datetime.utcnow() - cache_time).total_seconds() / 3600
        return age_hours < 20  # Refresh every ~20 hours
    except Exception:
        return False
