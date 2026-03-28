"""
MKW Multi-Strategy Trade Idea Generator
Generates 2-3 execution strategies per qualifying setup at different aggression levels.
"""

import math
import logging
from datetime import datetime
from typing import Optional

from options_engine import (
    black_scholes_price, calc_greeks, greeks_projection,
    calc_expected_move, compare_move_to_breakeven,
    build_strategy_card,
)
from grading import grade_trade

log = logging.getLogger("mkw.ideas")


# ─────────────────────────────────────────────────────────
# STRIKE SELECTION HELPERS
# ─────────────────────────────────────────────────────────

def _round_strike(price: float, increment: float = 5.0) -> float:
    """Round to nearest standard strike increment."""
    if price < 20:
        increment = 1.0
    elif price < 50:
        increment = 2.5
    elif price < 200:
        increment = 5.0
    else:
        increment = 10.0
    return round(price / increment) * increment

def _find_best_option(chain_snapshot: list, option_type: str, target_delta: float,
                      dte_range: tuple = (25, 60)) -> Optional[dict]:
    """
    Find the best option from chain snapshot matching target delta and DTE range.
    Returns the option dict or None.
    """
    best = None
    best_score = 999

    for snap in chain_snapshot:
        dte = snap.get("dte", 0)
        if dte < dte_range[0] or dte > dte_range[1]:
            continue

        options = snap.get("calls" if option_type == "call" else "puts", [])
        for opt in options:
            delta = abs(opt.get("greeks", {}).get("delta", 0))
            if delta < 0.1:
                continue

            # Score by delta proximity and liquidity
            delta_diff = abs(delta - target_delta)
            mid = opt.get("mid", 0)
            if mid <= 0:
                continue

            score = delta_diff
            if opt.get("volume", 0) < 10 and opt.get("openInterest", 0) < 50:
                score += 0.5  # penalize illiquid

            if score < best_score:
                best_score = score
                best = {**opt, "expiry": snap["expiry"], "dte": dte}

    return best

def _find_spread_option(chain_snapshot: list, option_type: str,
                        base_strike: float, spread_width_pct: float = 0.10,
                        dte_target: int = 45) -> Optional[dict]:
    """Find the short leg for a spread (OTM from base strike)."""
    target_strike = base_strike * (1 + spread_width_pct) if option_type == "call" else base_strike * (1 - spread_width_pct)

    best = None
    best_diff = 999

    for snap in chain_snapshot:
        dte = snap.get("dte", 0)
        if abs(dte - dte_target) > 15:
            continue

        options = snap.get("calls" if option_type == "call" else "puts", [])
        for opt in options:
            diff = abs(opt["strike"] - target_strike)
            if diff < best_diff and opt.get("mid", 0) > 0:
                best_diff = diff
                best = {**opt, "expiry": snap["expiry"], "dte": dte}

    return best

def _find_leap_option(chain_snapshot: list, option_type: str,
                      target_delta: float = 0.75) -> Optional[dict]:
    """Find deep ITM LEAP option (longest dated, high delta)."""
    best = None
    best_dte = 0

    for snap in chain_snapshot:
        dte = snap.get("dte", 0)
        if dte < 90:
            continue

        options = snap.get("calls" if option_type == "call" else "puts", [])
        for opt in options:
            delta = abs(opt.get("greeks", {}).get("delta", 0))
            if delta >= target_delta - 0.1 and dte > best_dte:
                best_dte = dte
                best = {**opt, "expiry": snap["expiry"], "dte": dte}

    return best


# ─────────────────────────────────────────────────────────
# STRATEGY BUILDERS
# ─────────────────────────────────────────────────────────

def _build_aggressive_strategy(spot: float, chain: list, is_short: bool,
                               target1: float, target2: float, stop: float,
                               iv_rank: int) -> Optional[dict]:
    """
    AGGRESSIVE: Straight long call/put, ATM, 30-45 DTE.
    """
    option_type = "put" if is_short else "call"
    opt = _find_best_option(chain, option_type, target_delta=0.55, dte_range=(25, 50))
    if not opt:
        opt = _find_best_option(chain, option_type, target_delta=0.50, dte_range=(20, 65))
    if not opt:
        return None

    strike = opt["strike"]
    mid = opt["mid"]
    iv = opt.get("iv", 0.30)
    dte = opt["dte"]
    bid = opt.get("bid", mid * 0.95)
    ask = opt.get("ask", mid * 1.05)

    card = build_strategy_card(
        spot=spot, strike=strike, expiry=opt["expiry"], dte=dte,
        option_type=option_type, iv=iv, bid=bid, ask=ask,
        strategy_name=f"AGGRESSIVE — Long {'Put' if is_short else 'Call'}",
        aggression="aggressive",
        target1=target1, target2=target2, stop_price=stop, contracts=1,
    )

    card["description"] = (
        f"Straight long {option_type}. ATM strike ${strike:.0f}, {dte} DTE. "
        f"Maximum directional leverage. Full recommended position."
    )
    card["whenToUse"] = "AAA setup, IV Rank < 30, full convergence, strong market"

    return card


def _build_moderate_strategy(spot: float, chain: list, is_short: bool,
                             target1: float, target2: float, stop: float,
                             iv_rank: int) -> Optional[dict]:
    """
    MODERATE: Debit spread (bull call / bear put spread).
    """
    option_type = "put" if is_short else "call"
    long_opt = _find_best_option(chain, option_type, target_delta=0.55, dte_range=(25, 65))
    if not long_opt:
        return None

    # Find short leg
    spread_dir = -0.10 if is_short else 0.10
    short_opt = _find_spread_option(chain, option_type, long_opt["strike"], spread_dir, long_opt["dte"])
    if not short_opt:
        # Try wider spread
        short_opt = _find_spread_option(chain, option_type, long_opt["strike"], spread_dir * 1.5, long_opt["dte"])

    if not short_opt:
        return None

    long_mid = long_opt["mid"]
    short_mid = short_opt["mid"]
    net_debit = round(long_mid - short_mid, 2)

    if net_debit <= 0:
        return None

    # Calculate max profit
    strike_diff = abs(long_opt["strike"] - short_opt["strike"])
    max_profit = round(strike_diff - net_debit, 2)
    max_profit_pct = round(max_profit / net_debit * 100, 1) if net_debit > 0 else 0

    long_greeks = long_opt.get("greeks", {})
    short_greeks = short_opt.get("greeks", {})

    # Net Greeks
    net_delta = round(long_greeks.get("delta", 0) - short_greeks.get("delta", 0), 4)
    net_theta = round(long_greeks.get("theta", 0) - short_greeks.get("theta", 0), 4)
    net_vega = round(long_greeks.get("vega", 0) - short_greeks.get("vega", 0), 4)

    # Breakeven
    if option_type == "call":
        breakeven = long_opt["strike"] + net_debit
        spread_name = "Bull Call Spread"
    else:
        breakeven = long_opt["strike"] - net_debit
        spread_name = "Bear Put Spread"

    breakeven_pct = round(abs(breakeven / spot - 1) * 100, 2)
    rr_ratio = round(max_profit / net_debit, 1) if net_debit > 0 else 0

    return {
        "strategyName": f"MODERATE — {spread_name}",
        "aggression": "moderate",
        "optionType": option_type,
        "longStrike": long_opt["strike"],
        "shortStrike": short_opt["strike"],
        "expiry": long_opt["expiry"],
        "dte": long_opt["dte"],
        "longPremium": long_mid,
        "shortPremium": short_mid,
        "netDebit": net_debit,
        "maxProfit": max_profit,
        "maxProfitPct": max_profit_pct,
        "maxRisk": round(net_debit * 100, 2),
        "breakeven": round(breakeven, 2),
        "breakevenPct": breakeven_pct,
        "rrRatio": rr_ratio,
        "greeks": {
            "delta": net_delta,
            "theta": net_theta,
            "vega": net_vega,
        },
        "thetaPerDay": round(net_theta * 100, 2),
        "contracts": 1,
        "description": (
            f"{'Bear put' if is_short else 'Bull call'} spread: BUY ${long_opt['strike']:.0f} / "
            f"SELL ${short_opt['strike']:.0f} {option_type}s for ${net_debit:.2f} net debit. "
            f"Max profit ${max_profit:.2f} ({max_profit_pct:.0f}%). Capped upside but much less capital at risk."
        ),
        "whenToUse": "AA setup, IV Rank 30-50, or deploying less capital",
        "targets": [],
    }


def _build_conservative_strategy(spot: float, chain: list, is_short: bool,
                                 target1: float, target2: float, stop: float,
                                 iv_rank: int) -> Optional[dict]:
    """
    CONSERVATIVE: Deep ITM LEAP (delta 0.75+), or calendar/diagonal spread.
    """
    option_type = "put" if is_short else "call"
    leap = _find_leap_option(chain, option_type, target_delta=0.75)

    if not leap:
        # Try finding any long-dated option
        leap = _find_best_option(chain, option_type, target_delta=0.70, dte_range=(90, 500))

    if not leap:
        return None

    strike = leap["strike"]
    mid = leap["mid"]
    iv = leap.get("iv", 0.30)
    dte = leap["dte"]
    bid = leap.get("bid", mid * 0.95)
    ask = leap.get("ask", mid * 1.05)
    greeks = leap.get("greeks", {})

    # Breakeven
    if option_type == "call":
        breakeven = strike + mid
    else:
        breakeven = strike - mid
    breakeven_pct = round(abs(breakeven / spot - 1) * 100, 2)

    # Theta per day
    theta_day = round(greeks.get("theta", 0) * 100, 2)

    # Project at targets
    r = 0.05
    T = dte / 365
    T_mid = max(0, T - 30 / 365)

    targets = []
    for t_price in [target1, target2]:
        if t_price > 0:
            opt_val = black_scholes_price(t_price, strike, T_mid, r, iv, option_type)
            pnl = round((opt_val - mid) * 100, 2)
            pnl_pct = round((opt_val / mid - 1) * 100, 1) if mid > 0 else 0
            targets.append({
                "stockPrice": round(t_price, 2),
                "optionValue": round(opt_val, 2),
                "pnl": pnl,
                "pnlPct": pnl_pct,
            })

    rr = 0
    if targets and mid > 0:
        best_gain = max(t.get("pnl", 0) for t in targets)
        rr = round(best_gain / (mid * 100), 1)

    return {
        "strategyName": f"CONSERVATIVE — Deep ITM LEAP {'Put' if is_short else 'Call'}",
        "aggression": "conservative",
        "optionType": option_type,
        "strike": strike,
        "expiry": leap["expiry"],
        "dte": dte,
        "bid": bid,
        "ask": ask,
        "mid": mid,
        "iv": round(iv, 4),
        "greeks": greeks,
        "breakeven": round(breakeven, 2),
        "breakevenPct": breakeven_pct,
        "maxRisk": round(mid * 100, 2),
        "contracts": 1,
        "targets": targets,
        "rrRatio": rr,
        "thetaPerDay": theta_day,
        "description": (
            f"Deep ITM LEAP {option_type}: ${strike:.0f} strike, {dte} DTE. "
            f"Delta {greeks.get('delta', 0):.2f} — acts as synthetic stock at fraction of cost. "
            f"Theta: ${abs(theta_day):.2f}/day. Rides the full stage advance."
        ),
        "whenToUse": "High conviction long-term thesis, hold through full stage advance",
    }


# ─────────────────────────────────────────────────────────
# EDUCATIONAL THESIS GENERATOR
# ─────────────────────────────────────────────────────────

def generate_thesis(ticker: str, wein: dict, tpl_score: int, rs: int,
                    phase: str, vcp: dict, conv_zone: str, conv_score: int,
                    ema_d: str, ema_w: str, ema_m: str,
                    fundamentals: dict, iv_data: dict, grade_info: dict,
                    price: float, is_short: bool = False) -> str:
    """
    Generate a detailed educational thesis explaining the setup.
    Pure template logic — no AI required.
    """
    lines = []

    # Stage context
    stage = wein.get("stage", "?")
    slope_weeks = wein.get("slopeWeeks", 0)
    pct_from_ma = wein.get("pctFromMA", 0)

    stage_desc = {
        "1A": "Stage 1A (basing/accumulation) — the 30-week MA is flat or declining. No trend established.",
        "1B": "Stage 1B (late basing) — the 30-week MA is beginning to flatten. Early signs of potential transition.",
        "2A": f"Weinstein Stage 2A with the 30-week MA rising for {slope_weeks} weeks, indicating a confirmed uptrend.",
        "2B": f"Weinstein Stage 2B (mature advance) — the 30-week MA has been rising for {slope_weeks} weeks. Later-stage moves carry higher risk.",
        "3": "Stage 3 (distribution/topping) — the 30-week MA is flattening. Price oscillating around the MA.",
        "4A": f"Weinstein Stage 4A with the 30-week MA declining, indicating a confirmed downtrend.",
        "4B": "Stage 4B (mature decline) — extended downtrend. Potential capitulation or basing.",
    }
    lines.append(f"{ticker} is in {stage_desc.get(stage, f'Stage {stage}')}.")

    # Minervini template
    if tpl_score == 8:
        lines.append(f"The Minervini Trend Template passes all 8/8 criteria with RS {rs}, placing it in the top {100-rs}% of all stocks by relative performance.")
    elif tpl_score >= 6:
        lines.append(f"The Minervini Trend Template passes {tpl_score}/8 criteria with RS {rs}. Partial qualification — some structural weakness remains.")
    else:
        lines.append(f"The Minervini Trend Template passes only {tpl_score}/8 criteria with RS {rs}. This does NOT meet minimum criteria for a high-probability setup.")

    # Kell phase
    phase_desc = {
        "EMA Crossback": "an EMA Crossback — the highest-probability entry phase. Price has pulled back to the rising 20 EMA and bounced, confirming institutional support.",
        "Pop": "a Pop — price breaking out with volume confirmation above all EMAs. Strong momentum.",
        "Base n Break": "a Base n Break — continuation from a higher base. Good for swing entries on confirmed trends.",
        "Wedge": "a Wedge — volatility contracting as Bollinger Bands narrow. A breakout is being set up, but direction is uncertain.",
        "Extension": "an Extension — price is extended well above the 10 EMA. Chasing here carries high risk of mean reversion.",
        "Reversal": "a Reversal attempt — the 10 EMA is turning up but the setup isn't confirmed yet.",
        "Red Light": "Red Light — price is below key EMAs. This is NOT a buy zone under Kell's framework.",
    }
    lines.append(f"Kell's framework identifies the current phase as {phase_desc.get(phase, f'{phase}')}.")

    # EMA alignment
    alignments = sum(1 for x in [ema_d, ema_w, ema_m] if x == ("bull" if not is_short else "bear"))
    if alignments == 3:
        lines.append("All three EMA timeframes (daily, weekly, monthly) are aligned bullish — maximum trend confirmation." if not is_short else "All three EMA timeframes are aligned bearish — maximum downtrend confirmation.")
    elif alignments == 2:
        lines.append(f"Two of three EMA timeframes are aligned. Good but not perfect alignment.")

    # VCP
    if vcp.get("count", 0) >= 2:
        lines.append(f"A {vcp['count']}-contraction VCP has formed with depths tightening from {vcp['depths']}, confirming seller exhaustion." +
                     (f" The pivot at ${vcp['pivot']:.2f} {'was cleared' if price > vcp['pivot'] else 'is the key breakout level to watch'}." if vcp.get("pivot") else ""))
        if vcp.get("volDryup"):
            lines.append("Volume has dried up during the contraction — a classic sign of supply exhaustion before a breakout.")
    elif vcp.get("count", 0) == 1:
        lines.append("Only one contraction detected — a VCP typically needs 2-3 contractions to confirm seller exhaustion.")
    else:
        lines.append("No VCP pattern detected. Without a volatility contraction pattern, the entry is less defined.")

    # Convergence assessment
    lines.append("")
    if conv_zone == "CONVERGENCE":
        lines.append(f"This setup scores {conv_score}/22 on the convergence checklist, classifying it as FULL CONVERGENCE — the highest conviction category. All three frameworks (Weinstein, Minervini, Kell) agree on this name.")
    elif conv_zone == "SECONDARY":
        lines.append(f"This setup scores {conv_score}/22, classifying it as SECONDARY — a continuation play in a confirmed trend. Good but not the highest conviction entry.")
    elif conv_zone == "BUILDING":
        lines.append(f"This setup scores {conv_score}/22, classifying it as BUILDING — approaching convergence but missing key criteria. Watch for improvement.")
    else:
        lines.append(f"This setup scores {conv_score}/22 — WATCH ONLY. Significant gaps prevent this from being a tradeable setup.")

    # Grade context
    grade = grade_info.get("grade", "?")
    score = grade_info.get("totalScore", 0)
    lines.append(f"Overall trade grade: {grade} ({score}/100).")

    # IV context
    iv_rank = iv_data.get("ivRank", 50)
    iv_verdict = iv_data.get("verdict", "NEUTRAL")
    if iv_rank > 0:
        lines.append("")
        if iv_verdict == "FAVORABLE":
            lines.append(f"The IV environment is FAVORABLE (IV Rank {iv_rank}). Options are relatively cheap — straight directional plays are viable.")
        elif iv_verdict == "UNFAVORABLE":
            lines.append(f"The IV environment is UNFAVORABLE (IV Rank {iv_rank}). Options premium is expensive. Consider debit spreads to reduce cost, or wait for IV to normalize.")
        else:
            lines.append(f"The IV environment is NEUTRAL (IV Rank {iv_rank}). Both straight options and spreads are reasonable.")

    # Fundamentals
    eps = fundamentals.get("eps", 0)
    rev = fundamentals.get("rev", 0)
    if eps > 20 and rev > 15:
        lines.append(f"Fundamentals support the thesis: EPS growth {eps}%, revenue growth {rev}%.")
    elif eps > 0:
        lines.append(f"Fundamentals are mixed: EPS growth {eps}%, revenue growth {rev}%.")
    elif eps < 0:
        lines.append(f"Note: EPS growth is negative ({eps}%). This is a technical/momentum play, not a fundamental one.")

    # What would need to change
    lines.append("")
    if conv_zone == "CONVERGENCE":
        lines.append("KEY RISK: The primary risk is a market-wide pullback or sector rotation. Protect with the stop below the VCP pivot or 20 EMA.")
    elif conv_zone == "SECONDARY" or conv_zone == "BUILDING":
        issues = []
        if rs < 70: issues.append(f"RS improving from {rs} to 70+")
        if tpl_score < 8: issues.append(f"template improving from {tpl_score}/8 to 8/8")
        if vcp.get("count", 0) < 2: issues.append("a VCP pattern forming")
        if phase in ("Extension", "Red Light", "Wedge"): issues.append(f"phase shifting from {phase} to EMA Crossback or Pop")
        if issues:
            lines.append(f"What would need to change for higher conviction: {', '.join(issues)}.")
    else:
        lines.append("This is NOT a tradeable setup. Too many criteria fail. Watch only.")

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────
# MAIN: GENERATE TRADE IDEAS
# ─────────────────────────────────────────────────────────

def generate_trade_ideas(
    ticker: str, spot: float, chain_snapshot: list,
    wein: dict, tpl_score: int, rs: int, phase: str,
    vcp: dict, conv_zone: str, conv_score: int, conv_max: int,
    ema_d: str, ema_w: str, ema_m: str,
    fundamentals: dict, iv_data: dict,
    vol_ratio: float = 1.0,
    is_short: bool = False,
) -> dict:
    """
    Generate 2-3 strategy cards for a qualifying stock.
    Returns dict with grade, strategies, thesis, and no-trade message if applicable.
    """

    # Calculate targets and stop
    if is_short:
        stop = spot * 1.07
        target1 = spot * 0.85
        target2 = spot * 0.75
    else:
        if vcp.get("pivot") and vcp["pivot"] > 0:
            stop = vcp["pivot"] * 0.97
        else:
            stop = spot * 0.93
        target1 = spot * 1.12
        target2 = spot * 1.22

    # Grade the trade
    iv_rank = iv_data.get("ivRank", 50)
    iv_verdict = iv_data.get("verdict", "NEUTRAL")
    skew_verdict = iv_data.get("skewVerdict", "neutral")

    # Expected move ratio (compare to breakeven of aggressive option)
    expected_move_ratio = 1.0
    expected = iv_data.get("expectedMove", {}) if "expectedMove" in iv_data else {}
    # Will be filled in after we find the option

    theta_pct = 15.0

    grade_result = grade_trade(
        conv_score=conv_score, conv_max=conv_max, conv_zone=conv_zone,
        wein_stage=wein.get("stage", "?"), tpl_score=tpl_score, rs=rs,
        phase=phase, ema_d=ema_d, ema_w=ema_w, ema_m=ema_m,
        iv_rank=iv_rank, iv_verdict=iv_verdict,
        expected_move_ratio=expected_move_ratio,
        theta_pct_of_premium=theta_pct,
        skew_verdict=skew_verdict,
        vcp_pivot=vcp.get("pivot"), current_price=spot,
        vol_ratio=vol_ratio,
        stop_price=stop, target1=target1, target2=target2,
        is_short=is_short,
    )

    # Generate thesis
    thesis = generate_thesis(
        ticker, wein, tpl_score, rs, phase, vcp, conv_zone, conv_score,
        ema_d, ema_w, ema_m, fundamentals, iv_data, grade_result, spot, is_short,
    )

    # Check if tradeable
    grade = grade_result.get("grade", "F")
    if grade in ("BB", "B", "F"):
        failing = []
        if rs < 70 and not is_short: failing.append(f"RS {rs} below 70")
        if tpl_score < 6 and not is_short: failing.append(f"Template {tpl_score}/8 too weak")
        if phase in ("Extension", "Red Light"): failing.append(f"Phase '{phase}' — no entry")
        if conv_zone == "WATCH": failing.append("Convergence zone WATCH — criteria not met")
        if iv_rank > 70: failing.append(f"IV Rank {iv_rank} — premium too expensive")

        return {
            "ticker": ticker,
            "grade": grade_result,
            "tradeable": False,
            "noTradeReason": f"Does not meet minimum criteria. Failing: {'; '.join(failing) if failing else 'Score too low'}.",
            "strategies": [],
            "thesis": thesis,
        }

    # Generate strategies
    strategies = []

    # Aggressive
    agg = _build_aggressive_strategy(spot, chain_snapshot, is_short, target1, target2, stop, iv_rank)
    if agg:
        strategies.append(agg)

    # Moderate
    mod = _build_moderate_strategy(spot, chain_snapshot, is_short, target1, target2, stop, iv_rank)
    if mod:
        strategies.append(mod)

    # Conservative
    cons = _build_conservative_strategy(spot, chain_snapshot, is_short, target1, target2, stop, iv_rank)
    if cons:
        strategies.append(cons)

    # If no strategies could be built (no options data), create synthetic cards
    if not strategies:
        option_type = "put" if is_short else "call"
        atm_strike = _round_strike(spot)
        otm_strike = _round_strike(spot * 1.10) if not is_short else _round_strike(spot * 0.90)
        itm_strike = _round_strike(spot * 0.90) if not is_short else _round_strike(spot * 1.10)

        strategies = [
            {
                "strategyName": f"AGGRESSIVE — Long {'Put' if is_short else 'Call'}",
                "aggression": "aggressive",
                "optionType": option_type,
                "strike": atm_strike,
                "expiry": "~30-45 DTE",
                "dte": 35,
                "mid": 0,
                "greeks": {"delta": 0.55, "gamma": 0, "theta": 0, "vega": 0},
                "breakeven": atm_strike * 1.05 if not is_short else atm_strike * 0.95,
                "breakevenPct": 5.0,
                "maxRisk": 0,
                "contracts": 1,
                "description": f"ATM ${atm_strike:.0f} {'put' if is_short else 'call'}, 30-45 DTE, delta ~0.55. Full position. (No live options data — check broker for pricing.)",
                "whenToUse": "AAA setup, IV Rank < 30, full convergence",
                "targets": [],
                "rrRatio": 0,
                "thetaPerDay": 0,
                "synthetic": True,
            },
            {
                "strategyName": f"MODERATE — {'Bear Put' if is_short else 'Bull Call'} Spread",
                "aggression": "moderate",
                "optionType": option_type,
                "longStrike": atm_strike,
                "shortStrike": otm_strike,
                "expiry": "~30-60 DTE",
                "dte": 45,
                "netDebit": 0,
                "maxProfit": abs(otm_strike - atm_strike),
                "maxRisk": 0,
                "description": f"{'Bear put' if is_short else 'Bull call'} spread: ${atm_strike:.0f}/${otm_strike:.0f}. Reduced cost. (No live options data.)",
                "whenToUse": "AA setup, IV Rank 30-50",
                "targets": [],
                "rrRatio": 0,
                "thetaPerDay": 0,
                "synthetic": True,
            },
            {
                "strategyName": f"CONSERVATIVE — Deep ITM LEAP {'Put' if is_short else 'Call'}",
                "aggression": "conservative",
                "optionType": option_type,
                "strike": itm_strike,
                "expiry": "~180-365 DTE",
                "dte": 210,
                "mid": 0,
                "greeks": {"delta": 0.78, "gamma": 0, "theta": 0, "vega": 0},
                "description": f"Deep ITM ${itm_strike:.0f} {'put' if is_short else 'call'}, 180+ DTE, delta ~0.78. Synthetic stock. (No live options data.)",
                "whenToUse": "High conviction long-term thesis",
                "targets": [],
                "rrRatio": 0,
                "thetaPerDay": 0,
                "synthetic": True,
            },
        ]

    return {
        "ticker": ticker,
        "grade": grade_result,
        "tradeable": True,
        "strategies": strategies,
        "thesis": thesis,
        "stopPrice": round(stop, 2),
        "target1": round(target1, 2),
        "target2": round(target2, 2),
    }
