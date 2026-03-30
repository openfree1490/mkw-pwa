"""
MKW Entry Criteria Engine — Phase 1
Six-condition scoring system (0-10 points) for pullback and breakout setups.
Each condition scored independently, rolled into a composite grade.
"""

import logging
import math
from typing import Optional
import pandas as pd
import numpy as np

log = logging.getLogger("mkw.entry_criteria")


# ─────────────────────────────────────────────────────────
# HELPER: Safe numerical extraction
# ─────────────────────────────────────────────────────────
def _safe(val, default=0.0):
    if val is None:
        return default
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


# ─────────────────────────────────────────────────────────
# CONDITION 1: Relative Strength Ranking (0-2 points)
# ─────────────────────────────────────────────────────────
def score_rs_ranking(df: pd.DataFrame, spy_df: pd.DataFrame) -> dict:
    """
    RS ranking over 3-month and 6-month periods.
    Top 20% on both = 2pts, one = 1pt, neither = 0pts.
    Disqualified if below top 30% on both.
    """
    result = {"points": 0, "max": 2, "detail": {}, "flags": [], "disqualified": False}

    if df is None or spy_df is None or len(df) < 130 or len(spy_df) < 130:
        result["detail"] = {"rs_3m_pct": 0, "rs_6m_pct": 0, "note": "Insufficient data"}
        return result

    try:
        close = df["Close"]
        spy_close = spy_df["Close"]

        # 3-month (63 trading days) relative performance
        if len(close) > 63 and len(spy_close) > 63:
            stock_ret_3m = (float(close.iloc[-1]) - float(close.iloc[-63])) / float(close.iloc[-63])
            spy_ret_3m = (float(spy_close.iloc[-1]) - float(spy_close.iloc[-63])) / float(spy_close.iloc[-63])
            rs_3m = stock_ret_3m - spy_ret_3m
        else:
            rs_3m = 0

        # 6-month (126 trading days) relative performance
        if len(close) > 126 and len(spy_close) > 126:
            stock_ret_6m = (float(close.iloc[-1]) - float(close.iloc[-126])) / float(close.iloc[-126])
            spy_ret_6m = (float(spy_close.iloc[-1]) - float(spy_close.iloc[-126])) / float(spy_close.iloc[-126])
            rs_6m = stock_ret_6m - spy_ret_6m
        else:
            rs_6m = 0

        # Convert to approximate percentile (simplified: excess return mapped to percentile)
        # Top 20% = 80th percentile+ = excess return roughly > 0.10 (10%) for 3m, > 0.15 for 6m
        # Top 30% = 70th percentile+ = excess return roughly > 0.05 for 3m, > 0.08 for 6m
        # These thresholds are calibrated for typical market conditions
        rs_3m_top20 = rs_3m > 0.08
        rs_3m_top30 = rs_3m > 0.04
        rs_6m_top20 = rs_6m > 0.12
        rs_6m_top30 = rs_6m > 0.06

        points = 0
        if rs_3m_top20 and rs_6m_top20:
            points = 2
        elif rs_3m_top20 or rs_6m_top20:
            points = 1
        else:
            points = 0

        # Disqualify if below top 30% on BOTH
        if not rs_3m_top30 and not rs_6m_top30:
            result["disqualified"] = True
            result["flags"].append("RS DISQUALIFIED — below top 30% on both timeframes")

        result["points"] = points
        result["detail"] = {
            "rs_3m_excess": round(rs_3m * 100, 1),
            "rs_6m_excess": round(rs_6m * 100, 1),
            "rs_3m_top20": rs_3m_top20,
            "rs_6m_top20": rs_6m_top20,
            "rs_3m_top30": rs_3m_top30,
            "rs_6m_top30": rs_6m_top30,
        }
    except Exception as e:
        log.warning(f"score_rs_ranking error: {e}")
        result["detail"]["error"] = str(e)

    return result


# ─────────────────────────────────────────────────────────
# CONDITION 2: RS Line Behavior During Pullback (0-2 points)
# ─────────────────────────────────────────────────────────
def score_rs_line_behavior(df: pd.DataFrame, spy_df: pd.DataFrame) -> dict:
    """
    RS line (stock/SPY) behavior during pullback phase.
    Higher highs = 2pts, flat/higher low = 1pt, declining = 0pts (disqualifier).
    """
    result = {"points": 0, "max": 2, "detail": {}, "flags": [], "disqualified": False}

    if df is None or spy_df is None or len(df) < 30 or len(spy_df) < 30:
        return result

    try:
        close = df["Close"]
        spy_close = spy_df["Close"]

        # Align indices and compute RS line
        min_len = min(len(close), len(spy_close))
        stock_prices = close.iloc[-min_len:].values.astype(float)
        spy_prices = spy_close.iloc[-min_len:].values.astype(float)
        rs_line = stock_prices / np.where(spy_prices > 0, spy_prices, 1.0)

        # Look at the last 20 trading days (pullback window)
        rs_recent = rs_line[-20:]
        if len(rs_recent) < 10:
            return result

        # Detect pullback in stock price (price declining from recent high)
        price_recent = stock_prices[-20:]
        price_high_idx = np.argmax(price_recent[:15]) if len(price_recent) >= 15 else 0

        # RS line analysis during pullback
        rs_first_half = rs_recent[:10]
        rs_second_half = rs_recent[10:]

        rs_first_max = np.max(rs_first_half)
        rs_second_max = np.max(rs_second_half)
        rs_first_min = np.min(rs_first_half)
        rs_second_min = np.min(rs_second_half)

        # Higher highs in RS line
        if rs_second_max > rs_first_max * 1.005:
            result["points"] = 2
            result["detail"]["behavior"] = "RS line making higher highs"
        # Flat or higher low
        elif rs_second_min >= rs_first_min * 0.995:
            result["points"] = 1
            result["detail"]["behavior"] = "RS line flat or making higher low"
        else:
            result["points"] = 0
            result["detail"]["behavior"] = "RS line declining"
            result["disqualified"] = True
            result["flags"].append("RS DIVERGENCE WARNING — RS line declining during pullback")

        result["detail"]["rs_line_change_pct"] = round(
            (float(rs_recent[-1]) / float(rs_recent[0]) - 1) * 100, 2
        )
    except Exception as e:
        log.warning(f"score_rs_line_behavior error: {e}")

    return result


# ─────────────────────────────────────────────────────────
# CONDITION 3: Volume Dry-Up Ratio (0-2 points)
# ─────────────────────────────────────────────────────────
def score_volume_dryup(df: pd.DataFrame) -> dict:
    """
    Pullback volume contraction vs 50-day average.
    Dry-up ratio < 0.5 = 2pts (A+), 0.5-0.7 = 1pt (B+), > 0.7 = 0pts.
    """
    result = {"points": 0, "max": 2, "detail": {}, "flags": []}

    if df is None or len(df) < 55:
        return result

    try:
        close = df["Close"]
        volume = df["Volume"]

        # Find pullback candles: recent bars where price is declining
        recent = close.iloc[-20:]
        vol_recent = volume.iloc[-20:]

        # Identify pullback bars (close < previous close)
        pullback_mask = recent.diff() < 0
        pullback_volumes = vol_recent[pullback_mask]

        if len(pullback_volumes) < 2:
            # No clear pullback — check last 5 bars volume vs avg
            pullback_avg = float(vol_recent.iloc[-5:].mean())
        else:
            pullback_avg = float(pullback_volumes.mean())

        vol_50d_avg = float(volume.iloc[-50:].mean()) if len(volume) >= 50 else float(volume.mean())

        if vol_50d_avg > 0:
            dryup_ratio = pullback_avg / vol_50d_avg
        else:
            dryup_ratio = 1.0

        if dryup_ratio < 0.5:
            result["points"] = 2
            result["detail"]["quality"] = "A+ setup — extreme volume contraction"
        elif dryup_ratio <= 0.7:
            result["points"] = 1
            result["detail"]["quality"] = "B+ setup — good volume contraction"
        else:
            result["points"] = 0
            result["detail"]["quality"] = "Sellers still active — weak pullback"

        result["detail"]["dryup_ratio"] = round(dryup_ratio, 2)
        result["detail"]["pullback_avg_vol"] = int(pullback_avg)
        result["detail"]["vol_50d_avg"] = int(vol_50d_avg)
    except Exception as e:
        log.warning(f"score_volume_dryup error: {e}")

    return result


# ─────────────────────────────────────────────────────────
# CONDITION 4: Bounce/Breakout Volume Expansion (0-1 point)
# ─────────────────────────────────────────────────────────
def score_volume_expansion(df: pd.DataFrame) -> dict:
    """
    Trigger candle volume must be >= 1.5x the 50-day average.
    Met = 1pt, Not met = 0pts.
    """
    result = {"points": 0, "max": 1, "detail": {}, "flags": []}

    if df is None or len(df) < 55:
        return result

    try:
        volume = df["Volume"]
        close = df["Close"]

        vol_today = float(volume.iloc[-1])
        vol_50d_avg = float(volume.iloc[-50:].mean()) if len(volume) >= 50 else float(volume.mean())

        expansion_ratio = vol_today / vol_50d_avg if vol_50d_avg > 0 else 0

        # Check if today's candle is a bounce (up day after pullback) or breakout
        price_change = float(close.iloc[-1]) - float(close.iloc[-2])
        is_trigger = price_change > 0  # Up day

        if expansion_ratio >= 1.5 and is_trigger:
            result["points"] = 1
            result["detail"]["confirmed"] = True
        else:
            result["points"] = 0
            result["detail"]["confirmed"] = False

        result["detail"]["expansion_ratio"] = round(expansion_ratio, 2)
        result["detail"]["vol_today"] = int(vol_today)
        result["detail"]["vol_50d_avg"] = int(vol_50d_avg)
        result["detail"]["is_trigger_candle"] = is_trigger
    except Exception as e:
        log.warning(f"score_volume_expansion error: {e}")

    return result


# ─────────────────────────────────────────────────────────
# CONDITION 5: ADR% Range (0-1 point)
# ─────────────────────────────────────────────────────────
def score_adr_range(df: pd.DataFrame) -> dict:
    """
    ADR% (14-period average daily range as % of price).
    3-6% = 1pt (all tiers), 6-8% = 1pt (aggressive tiers only),
    <3% = 0pts (insufficient), >8% = 0pts (uncontrollable).
    """
    result = {"points": 0, "max": 1, "detail": {}, "flags": [], "tier_restriction": None}

    if df is None or len(df) < 20:
        return result

    try:
        high = df["High"]
        low = df["Low"]
        close = df["Close"]

        # 14-period ADR%
        daily_range_pct = ((high - low) / close * 100).iloc[-14:]
        adr_pct = float(daily_range_pct.mean())

        if 3 <= adr_pct <= 6:
            result["points"] = 1
            result["detail"]["zone"] = "optimal"
            result["detail"]["eligible_tiers"] = [1, 2, 3, 4]
        elif 6 < adr_pct <= 8:
            result["points"] = 1
            result["detail"]["zone"] = "elevated"
            result["detail"]["eligible_tiers"] = [3, 4]
            result["tier_restriction"] = "aggressive_only"
            result["flags"].append("ELEVATED VOLATILITY — aggressive tiers only")
        elif adr_pct < 3:
            result["points"] = 0
            result["detail"]["zone"] = "insufficient"
            result["detail"]["eligible_tiers"] = []
            result["flags"].append("ADR% below 3% — insufficient movement for options")
        else:
            result["points"] = 0
            result["detail"]["zone"] = "excessive"
            result["detail"]["eligible_tiers"] = []
            result["flags"].append("ADR% above 8% — uncontrollable risk, skip")

        result["detail"]["adr_pct"] = round(adr_pct, 2)
    except Exception as e:
        log.warning(f"score_adr_range error: {e}")

    return result


# ─────────────────────────────────────────────────────────
# CONDITION 6: Higher Timeframe Alignment (0-2 points)
# ─────────────────────────────────────────────────────────
def score_htf_alignment(df: pd.DataFrame) -> dict:
    """
    Weekly and monthly EMA alignment + extension filter.
    Price above rising weekly 10/20 EMAs = 1pt.
    Price above rising monthly 10/20 EMAs = 1pt.
    Extension filter: subtract 1pt if >2x ATR above weekly/monthly 20 EMA.
    """
    result = {"points": 0, "max": 2, "detail": {}, "flags": []}

    if df is None or len(df) < 200:
        return result

    try:
        close = df["Close"]
        price = float(close.iloc[-1])

        # Simulate weekly data by resampling
        weekly = close.resample("W").last().dropna()
        if len(weekly) >= 25:
            w_ema10 = float(weekly.ewm(span=10, adjust=False).mean().iloc[-1])
            w_ema20 = float(weekly.ewm(span=20, adjust=False).mean().iloc[-1])
            w_ema10_prev = float(weekly.ewm(span=10, adjust=False).mean().iloc[-2])
            w_ema20_prev = float(weekly.ewm(span=20, adjust=False).mean().iloc[-2])

            w_ema10_rising = w_ema10 > w_ema10_prev
            w_ema20_rising = w_ema20 > w_ema20_prev
            price_above_w = price > w_ema10 and price > w_ema20

            if price_above_w and w_ema10_rising and w_ema20_rising:
                result["points"] += 1
                result["detail"]["weekly_aligned"] = True
            else:
                result["detail"]["weekly_aligned"] = False

            result["detail"]["w_ema10"] = round(w_ema10, 2)
            result["detail"]["w_ema20"] = round(w_ema20, 2)
        else:
            result["detail"]["weekly_aligned"] = False

        # Simulate monthly data
        monthly = close.resample("ME").last().dropna()
        if len(monthly) >= 15:
            m_ema10 = float(monthly.ewm(span=10, adjust=False).mean().iloc[-1])
            m_ema20 = float(monthly.ewm(span=10, adjust=False).mean().iloc[-1])
            m_ema10_prev = float(monthly.ewm(span=10, adjust=False).mean().iloc[-2])
            m_ema20_prev = float(monthly.ewm(span=10, adjust=False).mean().iloc[-2])

            m_ema10_rising = m_ema10 > m_ema10_prev
            m_ema20_rising = m_ema20 > m_ema20_prev
            price_above_m = price > m_ema10 and price > m_ema20

            if price_above_m and m_ema10_rising and m_ema20_rising:
                result["points"] += 1
                result["detail"]["monthly_aligned"] = True
            else:
                result["detail"]["monthly_aligned"] = False

            result["detail"]["m_ema10"] = round(m_ema10, 2)
            result["detail"]["m_ema20"] = round(m_ema20, 2)
        else:
            result["detail"]["monthly_aligned"] = False

        # Extension filter: ATR-based
        high = df["High"]
        low = df["Low"]
        tr = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs(),
        ], axis=1).max(axis=1)
        atr_14 = float(tr.rolling(14).mean().iloc[-1])

        extended = False
        if result["detail"].get("w_ema20") and atr_14 > 0:
            dist_from_w20 = price - result["detail"]["w_ema20"]
            if dist_from_w20 > 2 * atr_14:
                extended = True

        if result["detail"].get("m_ema20") and atr_14 > 0:
            dist_from_m20 = price - result["detail"]["m_ema20"]
            if dist_from_m20 > 2 * atr_14:
                extended = True

        if extended and result["points"] > 0:
            result["points"] -= 1
            result["flags"].append("EXTENDED — wait for deeper pullback")

        result["detail"]["atr_14"] = round(atr_14, 2)
        result["detail"]["extended"] = extended
    except Exception as e:
        log.warning(f"score_htf_alignment error: {e}")

    return result


# ─────────────────────────────────────────────────────────
# SETUP TYPE DETECTION
# ─────────────────────────────────────────────────────────
def detect_setup_type(df: pd.DataFrame) -> dict:
    """
    Distinguish between pullback and breakout setups.
    Pullback: price retreating TO 10/20 EMA from above.
    Breakout: price breaking THROUGH 10/20 EMA from below.
    """
    result = {"type": "unknown", "ema_level": None, "detail": ""}

    if df is None or len(df) < 25:
        return result

    try:
        close = df["Close"]
        price = float(close.iloc[-1])
        prev_price = float(close.iloc[-2])

        ema10 = float(close.ewm(span=10, adjust=False).mean().iloc[-1])
        ema20 = float(close.ewm(span=20, adjust=False).mean().iloc[-1])
        ema10_prev = float(close.ewm(span=10, adjust=False).mean().iloc[-2])
        ema20_prev = float(close.ewm(span=20, adjust=False).mean().iloc[-2])

        # Pullback: price was above EMA and is now approaching it from above
        price_near_ema10 = abs(price - ema10) / price < 0.025
        price_near_ema20 = abs(price - ema20) / price < 0.025

        # Check if price was clearly above recently (5 days ago)
        price_5d = float(close.iloc[-5])
        was_above_10 = price_5d > ema10 * 1.02
        was_above_20 = price_5d > ema20 * 1.02

        # Check if price was below recently
        was_below_10 = price_5d < ema10 * 0.98
        was_below_20 = price_5d < ema20 * 0.98

        if price_near_ema10 and was_above_10 and price >= ema10:
            result["type"] = "pullback"
            result["ema_level"] = "10 EMA"
            result["detail"] = f"Pulling back to 10 EMA ({ema10:.2f})"
        elif price_near_ema20 and was_above_20 and price >= ema20:
            result["type"] = "pullback"
            result["ema_level"] = "20 EMA"
            result["detail"] = f"Pulling back to 20 EMA ({ema20:.2f})"
        elif price > ema10 and (was_below_10 or prev_price < ema10_prev):
            result["type"] = "breakout"
            result["ema_level"] = "10 EMA"
            result["detail"] = f"Breaking through 10 EMA ({ema10:.2f})"
        elif price > ema20 and (was_below_20 or prev_price < ema20_prev):
            result["type"] = "breakout"
            result["ema_level"] = "20 EMA"
            result["detail"] = f"Breaking through 20 EMA ({ema20:.2f})"
        elif price > ema10 and price > ema20:
            result["type"] = "pullback"
            result["ema_level"] = "above both"
            result["detail"] = "Trending above both EMAs"
        elif price < ema10 and price < ema20:
            result["type"] = "breakdown"
            result["ema_level"] = "below both"
            result["detail"] = "Below both EMAs — potential short"
        else:
            result["type"] = "transition"
            result["ema_level"] = "between EMAs"
            result["detail"] = "Between 10 and 20 EMA"

        result["ema10"] = round(ema10, 2)
        result["ema20"] = round(ema20, 2)
    except Exception as e:
        log.warning(f"detect_setup_type error: {e}")

    return result


# ─────────────────────────────────────────────────────────
# COMPOSITE GRADE
# ─────────────────────────────────────────────────────────
GRADE_MAP = {
    "A": {"min": 9, "color": "#00c176", "label": "A Setup", "description": "All aggression levels valid, size up"},
    "B": {"min": 7, "color": "#e5a318", "label": "B Setup", "description": "Conservative and standard tiers"},
    "C": {"min": 5, "color": "#8b97b8", "label": "C Setup", "description": "Watchlist only, not actionable yet"},
    "F": {"min": 0, "color": "#e5334d", "label": "No Trade", "description": "Does not meet minimum criteria"},
}


def compute_composite_grade(conditions: dict, setup_type: str) -> dict:
    """
    Composite 10-point score from 6 conditions.
    9-10 = A, 7-8 = B, 5-6 = C, <5 = No trade.
    Breakout setups require Condition 4 (volume expansion).
    """
    total = 0
    disqualified = False
    disqualify_reasons = []

    for key, cond in conditions.items():
        total += cond.get("points", 0)
        if cond.get("disqualified"):
            disqualified = True
            disqualify_reasons.extend(cond.get("flags", []))

    # Breakout setups REQUIRE condition 4 (volume expansion)
    if setup_type == "breakout":
        vol_exp = conditions.get("c4_volume_expansion", {})
        if vol_exp.get("points", 0) == 0:
            disqualified = True
            disqualify_reasons.append("Breakout requires volume expansion (Condition 4)")

    # Determine grade
    if disqualified:
        grade_key = "F"
    elif total >= 9:
        grade_key = "A"
    elif total >= 7:
        grade_key = "B"
    elif total >= 5:
        grade_key = "C"
    else:
        grade_key = "F"

    grade_info = GRADE_MAP[grade_key]

    # Determine eligible tiers
    adr = conditions.get("c5_adr_range", {})
    tier_restriction = adr.get("tier_restriction")
    eligible_tiers = []

    if grade_key == "A":
        eligible_tiers = [1, 2, 3, 4] if total == 10 else [1, 2, 3]
    elif grade_key == "B":
        eligible_tiers = [1, 2]
    elif grade_key == "C":
        eligible_tiers = []

    # Apply ADR tier restriction
    if tier_restriction == "aggressive_only":
        eligible_tiers = [t for t in eligible_tiers if t >= 3]

    return {
        "score": total,
        "maxScore": 10,
        "grade": grade_key,
        "color": grade_info["color"],
        "label": grade_info["label"],
        "description": grade_info["description"],
        "disqualified": disqualified,
        "disqualifyReasons": disqualify_reasons,
        "eligibleTiers": eligible_tiers,
        "tradeable": grade_key in ("A", "B"),
        "setupType": setup_type,
    }


# ─────────────────────────────────────────────────────────
# MAIN ENTRY: GRADE A SETUP
# ─────────────────────────────────────────────────────────
def grade_setup(df: pd.DataFrame, spy_df: pd.DataFrame, ticker: str = "") -> dict:
    """
    Full 6-condition entry criteria grading.
    Returns composite grade + individual condition breakdowns.
    """
    if df is None or len(df) < 60:
        return {
            "ticker": ticker,
            "composite": {"score": 0, "grade": "F", "tradeable": False},
            "conditions": {},
            "setup": {"type": "unknown"},
            "flags": [],
        }

    # Detect setup type
    setup = detect_setup_type(df)

    # Score all 6 conditions
    c1 = score_rs_ranking(df, spy_df)
    c2 = score_rs_line_behavior(df, spy_df)
    c3 = score_volume_dryup(df)
    c4 = score_volume_expansion(df)
    c5 = score_adr_range(df)
    c6 = score_htf_alignment(df)

    conditions = {
        "c1_rs_ranking": c1,
        "c2_rs_line_behavior": c2,
        "c3_volume_dryup": c3,
        "c4_volume_expansion": c4,
        "c5_adr_range": c5,
        "c6_htf_alignment": c6,
    }

    # Compute composite grade
    composite = compute_composite_grade(conditions, setup["type"])

    # Aggregate all flags
    all_flags = []
    for cond in conditions.values():
        all_flags.extend(cond.get("flags", []))

    # Get key price levels for trade planning
    price = float(df["Close"].iloc[-1])
    ema10 = float(df["Close"].ewm(span=10, adjust=False).mean().iloc[-1])
    ema20 = float(df["Close"].ewm(span=20, adjust=False).mean().iloc[-1])

    # ATR for stop/target calculation
    high = df["High"]
    low = df["Low"]
    close = df["Close"]
    tr = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low - close.shift(1)).abs(),
    ], axis=1).max(axis=1)
    atr_14 = float(tr.rolling(14).mean().iloc[-1])

    # Calculate stop and targets
    if setup["type"] in ("pullback", "breakout"):
        stop = min(ema10, ema20) - atr_14  # Below nearest EMA
        target1 = price + atr_14  # 1x ADR move
        target2 = price + 2 * atr_14  # 2x ADR move
    elif setup["type"] == "breakdown":
        stop = max(ema10, ema20) + atr_14
        target1 = price - atr_14
        target2 = price - 2 * atr_14
    else:
        stop = price - atr_14
        target1 = price + atr_14
        target2 = price + 2 * atr_14

    return {
        "ticker": ticker,
        "composite": composite,
        "conditions": conditions,
        "setup": setup,
        "flags": all_flags,
        "levels": {
            "price": round(price, 2),
            "ema10": round(ema10, 2),
            "ema20": round(ema20, 2),
            "atr14": round(atr_14, 2),
            "stop": round(stop, 2),
            "target1": round(target1, 2),
            "target2": round(target2, 2),
        },
        "adr_pct": c5.get("detail", {}).get("adr_pct", 0),
        "dryup_ratio": c3.get("detail", {}).get("dryup_ratio", 0),
        "vol_expansion": c4.get("detail", {}).get("expansion_ratio", 0),
    }


# ─────────────────────────────────────────────────────────
# BATCH GRADE: Grade multiple tickers
# ─────────────────────────────────────────────────────────
def grade_watchlist(tickers: list, fetch_ohlcv_fn, spy_df: pd.DataFrame) -> list:
    """
    Grade a list of tickers. Returns sorted list by score descending.
    """
    results = []
    for ticker in tickers:
        try:
            df = fetch_ohlcv_fn(ticker, "2y")
            if df is None or len(df) < 60:
                continue
            graded = grade_setup(df, spy_df, ticker)
            results.append(graded)
        except Exception as e:
            log.warning(f"grade_watchlist {ticker}: {e}")

    results.sort(key=lambda x: x["composite"]["score"], reverse=True)
    return results
