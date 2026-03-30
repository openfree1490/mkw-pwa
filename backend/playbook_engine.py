"""
MKW Four-Tier Options Playbook Engine — Phase 2
Generates specific options trade strategies across 4 aggression levels
for setups scoring 7+ (B or better).
"""

import logging
import math
from typing import Optional

log = logging.getLogger("mkw.playbook")


# ─────────────────────────────────────────────────────────
# TIER DEFINITIONS
# ─────────────────────────────────────────────────────────
TIERS = {
    1: {
        "name": "Conservative",
        "structure_long": "Buy slightly ITM call, 30-45 DTE",
        "structure_short": "Buy slightly ITM put, 30-45 DTE",
        "dte_range": [30, 45],
        "moneyness": "ITM",
        "risk_pct": "3-5%",
        "min_score": 7,
    },
    2: {
        "name": "Standard",
        "structure_long": "Buy ATM call, 14-30 DTE",
        "structure_short": "Buy ATM put, 14-30 DTE",
        "dte_range": [14, 30],
        "moneyness": "ATM",
        "risk_pct": "5-7%",
        "min_score": 8,
    },
    3: {
        "name": "Aggressive",
        "structure_long": "Buy slightly OTM call, 7-21 DTE, or debit spread (ATM/OTM)",
        "structure_short": "Buy slightly OTM put, 7-21 DTE, or debit spread (ATM/OTM)",
        "dte_range": [7, 21],
        "moneyness": "OTM",
        "risk_pct": "7-10%",
        "min_score": 9,
    },
    4: {
        "name": "Maximum Aggression (5K Challenge)",
        "structure_long": "OTM call, <7 DTE or 0DTE on trigger day",
        "structure_short": "OTM put, <7 DTE or 0DTE on trigger day",
        "dte_range": [0, 7],
        "moneyness": "deep OTM",
        "risk_pct": "10-15%",
        "min_score": 10,
    },
}


def _round_strike(price: float) -> float:
    """Round to nearest standard strike increment."""
    if price < 20:
        inc = 1.0
    elif price < 50:
        inc = 2.5
    elif price < 200:
        inc = 5.0
    else:
        inc = 10.0
    return round(price / inc) * inc


def _estimate_premium(price, strike, dte, is_call=True):
    """Rough premium estimate based on moneyness and DTE."""
    intrinsic = max(0, price - strike) if is_call else max(0, strike - price)
    time_value = price * 0.02 * math.sqrt(max(1, dte) / 365)
    return round(intrinsic + time_value, 2)


# ─────────────────────────────────────────────────────────
# THESIS GENERATORS
# ─────────────────────────────────────────────────────────

def _build_thesis_tier1(ticker, setup, levels, conditions, is_short=False):
    """Tier 1 — Conservative thesis."""
    setup_type = setup.get("type", "pullback")
    ema_level = setup.get("ema_level", "20 EMA")
    rs_detail = conditions.get("c2_rs_line_behavior", {}).get("detail", {})
    rs_behavior = rs_detail.get("behavior", "stable")

    direction = "short" if is_short else "long"
    option_type = "put" if is_short else "call"
    price = levels.get("price", 0)
    stop = levels.get("stop", 0)
    atr = levels.get("atr14", 0)
    target = price + atr if not is_short else price - atr

    return (
        f"{ticker} is pulling back to the {ema_level} on declining volume with "
        f"{rs_behavior}. Weekly and monthly trends are aligned. "
        f"Buying ITM {option_type} with 30-45 DTE provides intrinsic value cushion "
        f"and time for the thesis to develop. "
        f"Target: ${target:.2f} (1x ADR move from entry). "
        f"Stop: daily close {'above' if is_short else 'below'} ${stop:.2f}."
    )


def _build_thesis_tier2(ticker, setup, levels, conditions, is_short=False):
    """Tier 2 — Standard thesis."""
    setup_type = setup.get("type", "pullback")
    ema_level = setup.get("ema_level", "20 EMA")
    dryup = conditions.get("c3_volume_dryup", {}).get("detail", {}).get("dryup_ratio", 0)
    vol_exp = conditions.get("c4_volume_expansion", {}).get("detail", {}).get("expansion_ratio", 0)
    rs_3m = conditions.get("c1_rs_ranking", {}).get("detail", {}).get("rs_3m_excess", 0)

    option_type = "put" if is_short else "call"
    price = levels.get("price", 0)
    stop = levels.get("stop", 0)
    atr = levels.get("atr14", 0)
    target = price + 1.5 * atr if not is_short else price - 1.5 * atr

    return (
        f"{ticker} shows {setup_type} at the {ema_level} with volume confirmation "
        f"({dryup:.2f}x on pullback, {vol_exp:.1f}x on trigger). "
        f"RS ranking is top {max(1, 100 - abs(rs_3m * 5)):.0f}% over 3 and 6 months. "
        f"ATM {option_type} with 14-30 DTE balances leverage with reasonable time decay. "
        f"Target: ${target:.2f} (1.5x ADR move). "
        f"Stop: ${stop:.2f}."
    )


def _build_thesis_tier3(ticker, setup, levels, conditions, composite, is_short=False):
    """Tier 3 — Aggressive thesis."""
    score = composite.get("score", 0)
    option_type = "put" if is_short else "call"
    price = levels.get("price", 0)
    stop = levels.get("stop", 0)
    atr = levels.get("atr14", 0)
    target = price + 2 * atr if not is_short else price - 2 * atr

    # Find strongest conditions
    strongest = []
    for key, cond in conditions.items():
        if cond.get("points", 0) == cond.get("max", 1):
            label = key.replace("c1_", "").replace("c2_", "").replace("c3_", "").replace(
                "c4_", "").replace("c5_", "").replace("c6_", "").replace("_", " ").title()
            strongest.append(label)

    return (
        f"{ticker} is a high-conviction {setup.get('type', 'setup')} with {score}/10 alignment. "
        f"Strongest conditions: {', '.join(strongest[:3])}. "
        f"OTM {option_type} or spread structure maximizes leverage on a defined-risk basis. "
        f"Target: ${target:.2f} (2x ADR move). Stop: ${stop:.2f}. Max loss is premium paid."
    )


def _build_thesis_tier4(ticker, setup, levels, conditions, composite, is_short=False):
    """Tier 4 — Maximum Aggression thesis."""
    option_type = "put" if is_short else "call"
    price = levels.get("price", 0)
    atr = levels.get("atr14", 0)

    # Build full condition breakdown
    breakdown = []
    cond_names = {
        "c1_rs_ranking": "RS Ranking",
        "c2_rs_line_behavior": "RS Line Behavior",
        "c3_volume_dryup": "Volume Dry-Up",
        "c4_volume_expansion": "Volume Expansion",
        "c5_adr_range": "ADR% Range",
        "c6_htf_alignment": "HTF Alignment",
    }
    for key, label in cond_names.items():
        cond = conditions.get(key, {})
        pts = cond.get("points", 0)
        mx = cond.get("max", 1)
        breakdown.append(f"{label}: {pts}/{mx}")

    target = price + 3 * atr if not is_short else price - 3 * atr
    rr = round(3 * atr / atr, 1) if atr > 0 else 3

    return (
        f"{ticker} is a perfect 10 setup — all six conditions confirmed simultaneously. "
        f"{'; '.join(breakdown)}. "
        f"Taking an asymmetric bet with {rr}:1 risk/reward. "
        f"This is a low win-rate, high payoff play. "
        f"Position sized so total loss is acceptable."
    )


# ─────────────────────────────────────────────────────────
# GENERATE TRADE FOR ONE TIER
# ─────────────────────────────────────────────────────────
def generate_tier_trade(tier_num: int, ticker: str, setup: dict, levels: dict,
                        conditions: dict, composite: dict, is_short: bool = False) -> Optional[dict]:
    """Generate a specific trade plan for one tier."""
    tier = TIERS.get(tier_num)
    if not tier:
        return None

    score = composite.get("score", 0)
    if score < tier["min_score"]:
        return None

    price = levels.get("price", 0)
    atr = levels.get("atr14", 0)
    if price <= 0:
        return None

    option_type = "put" if is_short else "call"
    dte_min, dte_max = tier["dte_range"]
    dte_target = (dte_min + dte_max) // 2

    # Strike selection based on moneyness
    if tier["moneyness"] == "ITM":
        strike = _round_strike(price - atr * 0.5) if not is_short else _round_strike(price + atr * 0.5)
    elif tier["moneyness"] == "ATM":
        strike = _round_strike(price)
    elif tier["moneyness"] == "OTM":
        strike = _round_strike(price + atr * 0.5) if not is_short else _round_strike(price - atr * 0.5)
    else:  # deep OTM
        strike = _round_strike(price + atr) if not is_short else _round_strike(price - atr)

    premium = _estimate_premium(price, strike, dte_target, is_call=(not is_short))

    # Thesis generation
    if tier_num == 1:
        thesis = _build_thesis_tier1(ticker, setup, levels, conditions, is_short)
    elif tier_num == 2:
        thesis = _build_thesis_tier2(ticker, setup, levels, conditions, is_short)
    elif tier_num == 3:
        thesis = _build_thesis_tier3(ticker, setup, levels, conditions, composite, is_short)
    else:
        thesis = _build_thesis_tier4(ticker, setup, levels, conditions, composite, is_short)

    # Target based on tier aggressiveness
    multipliers = {1: 1.0, 2: 1.5, 3: 2.0, 4: 3.0}
    move_mult = multipliers.get(tier_num, 1.0)
    if is_short:
        target = round(price - atr * move_mult, 2)
    else:
        target = round(price + atr * move_mult, 2)

    return {
        "tier": tier_num,
        "tierName": tier["name"],
        "direction": "SHORT" if is_short else "LONG",
        "optionType": option_type,
        "structure": tier[f"structure_{'short' if is_short else 'long'}"],
        "strike": strike,
        "dte": f"{dte_min}-{dte_max} DTE",
        "dteTarget": dte_target,
        "estimatedPremium": premium,
        "riskPct": tier["risk_pct"],
        "thesis": thesis,
        "entry": levels.get("price", 0),
        "stop": levels.get("stop", 0),
        "target": target,
        "emaLevel": setup.get("ema_level", ""),
    }


# ─────────────────────────────────────────────────────────
# GENERATE FULL PLAYBOOK
# ─────────────────────────────────────────────────────────
def generate_playbook(graded_setup: dict) -> dict:
    """
    Generate options playbook for all eligible tiers.
    Input: output from entry_criteria.grade_setup()
    """
    composite = graded_setup.get("composite", {})
    conditions = graded_setup.get("conditions", {})
    setup = graded_setup.get("setup", {})
    levels = graded_setup.get("levels", {})
    ticker = graded_setup.get("ticker", "")
    score = composite.get("score", 0)
    eligible_tiers = composite.get("eligibleTiers", [])

    if score < 7:
        return {
            "ticker": ticker,
            "score": score,
            "grade": composite.get("grade", "F"),
            "tradeable": False,
            "trades": [],
            "shortTrades": [],
            "message": f"Score {score}/10 — below minimum for trade execution",
        }

    # Determine direction
    setup_type = setup.get("type", "pullback")
    is_bearish = setup_type == "breakdown"

    # Generate long trades
    long_trades = []
    if not is_bearish:
        for t in eligible_tiers:
            trade = generate_tier_trade(t, ticker, setup, levels, conditions, composite, is_short=False)
            if trade:
                long_trades.append(trade)

    # Generate short trades (mirror) if bearish setup
    short_trades = []
    if is_bearish or setup_type == "transition":
        for t in eligible_tiers:
            trade = generate_tier_trade(t, ticker, setup, levels, conditions, composite, is_short=True)
            if trade:
                short_trades.append(trade)

    return {
        "ticker": ticker,
        "score": score,
        "grade": composite.get("grade", "F"),
        "tradeable": True,
        "setupType": setup_type,
        "direction": "SHORT" if is_bearish else "LONG",
        "trades": long_trades,
        "shortTrades": short_trades,
        "levels": levels,
        "flags": graded_setup.get("flags", []),
    }
