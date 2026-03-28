"""
MKW Trade Grading System
100-point composite scoring: AAA to F grade for every potential trade.
"""

import logging
from typing import Optional

log = logging.getLogger("mkw.grading")


# ─────────────────────────────────────────────────────────
# GRADE SCALE
# ─────────────────────────────────────────────────────────
GRADE_SCALE = [
    (90, "AAA", "gold",   "Take full position. Everything aligned."),
    (80, "AA",  "green",  "Strong setup. Standard position size."),
    (70, "A",   "cyan",   "Good setup. Reduced position size."),
    (60, "BBB", "gray",   "Acceptable but flawed. Half position or paper trade."),
    (50, "BB",  "red",    "Do not trade. Watch only."),
    (40, "B",   "red",    "Do not trade. Significant flaws."),
    (0,  "F",   "red",    "Failed. No trade characteristics."),
]

def score_to_grade(score: int) -> dict:
    """Convert numeric score (0-100) to letter grade with metadata."""
    for threshold, grade, color, desc in GRADE_SCALE:
        if score >= threshold:
            return {
                "grade": grade,
                "score": score,
                "color": color,
                "description": desc,
                "tradeable": score >= 60,
                "fullPosition": score >= 90,
            }
    return {"grade": "F", "score": score, "color": "red", "description": "Failed.", "tradeable": False, "fullPosition": False}


# ─────────────────────────────────────────────────────────
# COMPONENT SCORERS
# ─────────────────────────────────────────────────────────

def score_directional_edge(conv_score: int, conv_max: int, conv_zone: str,
                           wein_stage: str, tpl_score: int, rs: int,
                           phase: str, ema_d: str, ema_w: str, ema_m: str,
                           is_short: bool = False) -> dict:
    """
    Directional Edge: 30 points max.
    Based on convergence score and framework alignment.
    """
    points = 0
    breakdown = []

    # Convergence score mapping (22 points max -> 22 points of directional)
    if conv_score >= 22:
        conv_pts = 22
    elif conv_score >= 18:
        conv_pts = 18
    elif conv_score >= 15:
        conv_pts = 12
    elif conv_score >= 12:
        conv_pts = 8
    else:
        conv_pts = max(0, conv_score // 2)

    # Scale to out of 22 (convergence quality)
    points += conv_pts
    breakdown.append(f"Convergence {conv_score}/{conv_max} = {conv_pts}pts")

    # Framework alignment bonus (up to 8 additional points)
    frameworks_aligned = 0

    # Weinstein aligned?
    if not is_short:
        wein_aligned = wein_stage in ("2A", "2B")
    else:
        wein_aligned = wein_stage in ("4A", "4B")

    # Minervini aligned?
    if not is_short:
        min_aligned = tpl_score >= 7 and rs >= 70
    else:
        min_aligned = tpl_score <= 2 and rs <= 30

    # Kell aligned?
    if not is_short:
        kell_aligned = phase in ("EMA Crossback", "Pop", "Base n Break")
    else:
        kell_aligned = phase in ("Red Light", "Wedge")

    if wein_aligned: frameworks_aligned += 1
    if min_aligned: frameworks_aligned += 1
    if kell_aligned: frameworks_aligned += 1

    if frameworks_aligned == 3:
        align_pts = 8
        breakdown.append("All 3 frameworks aligned = +8pts")
    elif frameworks_aligned == 2:
        align_pts = 5
        breakdown.append(f"2/3 frameworks aligned = +5pts")
    elif frameworks_aligned == 1:
        align_pts = 2
        breakdown.append(f"1/3 frameworks aligned = +2pts")
    else:
        align_pts = 0
        breakdown.append("No framework alignment = 0pts (DISQUALIFYING)")

    points += align_pts

    # Cap at 30
    points = min(30, points)

    return {
        "points": points,
        "max": 30,
        "breakdown": breakdown,
        "frameworksAligned": frameworks_aligned,
        "disqualified": frameworks_aligned <= 1,
    }


def score_options_edge(iv_rank: int, iv_verdict: str, expected_move_ratio: float,
                       theta_pct_of_premium: float, skew_verdict: str) -> dict:
    """
    Options Edge: 25 points max.
    IV environment, expected move vs breakeven, theta efficiency.
    """
    points = 0
    breakdown = []

    # IV environment (10 points)
    if iv_rank < 30 and skew_verdict != "overpaying_otm":
        iv_pts = 10
        breakdown.append(f"IV Rank {iv_rank}, no skew penalty = 10pts")
    elif iv_rank < 40:
        iv_pts = 8
        breakdown.append(f"IV Rank {iv_rank} = 8pts")
    elif iv_rank < 50:
        iv_pts = 5
        breakdown.append(f"IV Rank {iv_rank} moderate = 5pts")
    elif iv_rank < 70:
        iv_pts = 2
        breakdown.append(f"IV Rank {iv_rank} elevated = 2pts")
    else:
        iv_pts = 0
        breakdown.append(f"IV Rank {iv_rank} HIGH = 0pts (unfavorable)")
    points += iv_pts

    # Expected move vs breakeven (10 points)
    if expected_move_ratio >= 1.5:
        move_pts = 10
        breakdown.append(f"Expected move {expected_move_ratio:.1f}x breakeven = 10pts")
    elif expected_move_ratio >= 1.2:
        move_pts = 7
        breakdown.append(f"Expected move {expected_move_ratio:.1f}x breakeven = 7pts")
    elif expected_move_ratio >= 1.0:
        move_pts = 4
        breakdown.append(f"Expected move {expected_move_ratio:.1f}x breakeven = 4pts (marginal)")
    else:
        move_pts = 0
        breakdown.append(f"Expected move {expected_move_ratio:.1f}x breakeven = 0pts (UNFAVORABLE)")
    points += move_pts

    # Theta efficiency (5 points)
    if theta_pct_of_premium < 10:
        theta_pts = 5
        breakdown.append(f"Theta {theta_pct_of_premium:.0f}% of premium over hold = 5pts")
    elif theta_pct_of_premium < 15:
        theta_pts = 3
        breakdown.append(f"Theta {theta_pct_of_premium:.0f}% of premium = 3pts")
    elif theta_pct_of_premium < 25:
        theta_pts = 1
        breakdown.append(f"Theta {theta_pct_of_premium:.0f}% of premium = 1pt (high decay)")
    else:
        theta_pts = 0
        breakdown.append(f"Theta {theta_pct_of_premium:.0f}% of premium = 0pts (excessive decay)")
    points += theta_pts

    # Disqualifying: if IV unfavorable AND expected move < breakeven
    disqualified = (iv_rank >= 70 and expected_move_ratio < 1.0)

    return {
        "points": min(25, points),
        "max": 25,
        "breakdown": breakdown,
        "disqualified": disqualified,
    }


def score_timing_edge(phase: str, vcp_pivot: Optional[float], current_price: float,
                      vol_ratio: float, vol_avg50: float, volume_today: float) -> dict:
    """
    Timing Edge: 20 points max.
    Kell phase, VCP pivot proximity, volume confirmation.
    """
    points = 0
    breakdown = []

    # Kell phase (10 points)
    phase_scores = {
        "EMA Crossback": 10,
        "Pop": 10,
        "Base n Break": 7,
        "Reversal": 5,
        "Wedge": 3,
        "Extension": 0,
        "Red Light": 0,
    }
    phase_pts = phase_scores.get(phase, 0)
    points += phase_pts
    breakdown.append(f"Phase '{phase}' = {phase_pts}pts")

    # VCP pivot proximity (5 points)
    if vcp_pivot and current_price > 0:
        pct_from_pivot = abs(current_price / vcp_pivot - 1) * 100
        if pct_from_pivot <= 3:
            pivot_pts = 5
            breakdown.append(f"Within {pct_from_pivot:.1f}% of pivot ${vcp_pivot:.2f} = 5pts")
        elif pct_from_pivot <= 5:
            pivot_pts = 3
            breakdown.append(f"Within {pct_from_pivot:.1f}% of pivot = 3pts")
        elif pct_from_pivot <= 7:
            pivot_pts = 1
            breakdown.append(f"Within {pct_from_pivot:.1f}% of pivot = 1pt")
        else:
            pivot_pts = 0
            breakdown.append(f"{pct_from_pivot:.1f}% from pivot — no points")
    else:
        pivot_pts = 0
        breakdown.append("No VCP pivot defined = 0pts")
    points += pivot_pts

    # Volume confirmation (5 points)
    if vol_ratio >= 1.5:
        vol_pts = 5
        breakdown.append(f"Volume {vol_ratio:.1f}x average = 5pts (confirmed)")
    elif vol_ratio >= 1.2:
        vol_pts = 3
        breakdown.append(f"Volume {vol_ratio:.1f}x average = 3pts")
    elif vol_ratio >= 0.8:
        vol_pts = 1
        breakdown.append(f"Volume {vol_ratio:.1f}x average = 1pt (average)")
    else:
        vol_pts = 0
        breakdown.append(f"Volume {vol_ratio:.1f}x average = 0pts (dry)")
    points += vol_pts

    disqualified = (phase in ("Extension", "Red Light") and pivot_pts == 0)

    return {
        "points": min(20, points),
        "max": 20,
        "breakdown": breakdown,
        "disqualified": disqualified,
    }


def score_risk_quality(entry_price: float, stop_price: float, target1: float,
                       target2: float = 0, is_short: bool = False) -> dict:
    """
    Risk Quality: 15 points max.
    R:R ratio and stop tightness.
    """
    points = 0
    breakdown = []

    if entry_price <= 0:
        return {"points": 0, "max": 15, "breakdown": ["No entry price"], "disqualified": True}

    # Calculate risk
    if is_short:
        risk_pct = (stop_price / entry_price - 1) * 100 if stop_price > 0 else 10
        reward1 = (1 - target1 / entry_price) * 100 if target1 > 0 else 0
        reward2 = (1 - target2 / entry_price) * 100 if target2 > 0 else 0
    else:
        risk_pct = (1 - stop_price / entry_price) * 100 if stop_price > 0 else 10
        reward1 = (target1 / entry_price - 1) * 100 if target1 > 0 else 0
        reward2 = (target2 / entry_price - 1) * 100 if target2 > 0 else 0

    risk_pct = abs(risk_pct)
    best_reward = max(reward1, reward2) if reward2 > 0 else reward1
    rr_ratio = best_reward / risk_pct if risk_pct > 0 else 0

    # R:R scoring (10 points)
    if rr_ratio >= 4:
        rr_pts = 10
        breakdown.append(f"R:R {rr_ratio:.1f}:1 = 10pts (excellent)")
    elif rr_ratio >= 3:
        rr_pts = 7
        breakdown.append(f"R:R {rr_ratio:.1f}:1 = 7pts (good)")
    elif rr_ratio >= 2:
        rr_pts = 3
        breakdown.append(f"R:R {rr_ratio:.1f}:1 = 3pts (acceptable)")
    else:
        rr_pts = 0
        breakdown.append(f"R:R {rr_ratio:.1f}:1 = 0pts (poor)")
    points += rr_pts

    # Stop tightness (5 points)
    if risk_pct <= 5:
        stop_pts = 5
        breakdown.append(f"Stop {risk_pct:.1f}% from entry = 5pts (tight)")
    elif risk_pct <= 7:
        stop_pts = 3
        breakdown.append(f"Stop {risk_pct:.1f}% from entry = 3pts")
    elif risk_pct <= 10:
        stop_pts = 1
        breakdown.append(f"Stop {risk_pct:.1f}% from entry = 1pt (wide)")
    else:
        stop_pts = 0
        breakdown.append(f"Stop {risk_pct:.1f}% from entry = 0pts (too wide)")
    points += stop_pts

    return {
        "points": min(15, points),
        "max": 15,
        "breakdown": breakdown,
        "rrRatio": round(rr_ratio, 1),
        "riskPct": round(risk_pct, 1),
        "disqualified": rr_ratio < 1.5,
    }


def score_flow_confirmation(short_vol_ratio: float = 0.5, insider_buying: bool = False,
                            insider_selling: bool = False, unusual_call_vol: bool = False,
                            unusual_put_vol: bool = False, is_short: bool = False) -> dict:
    """
    Flow Confirmation: 10 points max.
    Dark pool, insider activity, unusual options flow.
    """
    points = 0
    breakdown = []

    if is_short:
        # For shorts: want high short volume, insider selling, put activity
        if short_vol_ratio >= 0.5:
            sp_pts = 4
            breakdown.append(f"Short vol {short_vol_ratio:.0%} HIGH = 4pts (bearish)")
        elif short_vol_ratio >= 0.4:
            sp_pts = 2
            breakdown.append(f"Short vol {short_vol_ratio:.0%} = 2pts")
        else:
            sp_pts = 0
            breakdown.append(f"Short vol {short_vol_ratio:.0%} low = 0pts (no short pressure)")
        points += sp_pts

        if insider_selling:
            points += 3
            breakdown.append("Insider selling = +3pts")
        elif not insider_buying:
            points += 1
            breakdown.append("No insider buying = +1pt")
        else:
            breakdown.append("Insider buying present = 0pts (conflicting)")

        if unusual_put_vol:
            points += 3
            breakdown.append("Unusual put activity = +3pts")
        else:
            breakdown.append("No unusual put activity = 0pts")
    else:
        # For longs: want low short volume, insider buying, call activity
        if short_vol_ratio < 0.4:
            sp_pts = 4
            breakdown.append(f"Short vol {short_vol_ratio:.0%} LOW = 4pts (bullish)")
        elif short_vol_ratio < 0.5:
            sp_pts = 2
            breakdown.append(f"Short vol {short_vol_ratio:.0%} = 2pts")
        else:
            sp_pts = 0
            breakdown.append(f"Short vol {short_vol_ratio:.0%} elevated = 0pts")
        points += sp_pts

        if insider_buying:
            points += 3
            breakdown.append("Insider buying = +3pts")
        elif not insider_selling:
            points += 1
            breakdown.append("No insider selling = +1pt")
        else:
            breakdown.append("Insider selling present = 0pts (red flag)")

        if unusual_call_vol:
            points += 3
            breakdown.append("Unusual call activity = +3pts")
        else:
            breakdown.append("No unusual options activity = 0pts")

    return {
        "points": min(8, points),
        "max": 8,
        "breakdown": breakdown,
        "disqualified": False,
    }


def score_macro_environment(macro_score: int = 5, event_imminent: bool = False,
                            sector_aligned: bool = True) -> dict:
    """
    Macro Environment: 5 points max (new component).
    FRED score (3pts) + no imminent event (1pt) + sector alignment (1pt).
    """
    points = 0
    breakdown = []

    # FRED macro score: 3pts
    if macro_score >= 8:
        points += 3
        breakdown.append(f"Macro TAILWIND ({macro_score}/10) = 3pts")
    elif macro_score >= 5:
        points += 2
        breakdown.append(f"Macro NEUTRAL ({macro_score}/10) = 2pts")
    elif macro_score >= 3:
        points += 1
        breakdown.append(f"Macro HEADWIND ({macro_score}/10) = 1pt")
    else:
        breakdown.append(f"Macro CRISIS ({macro_score}/10) = 0pts")

    # No imminent event: 1pt
    if not event_imminent:
        points += 1
        breakdown.append("No major event within 48h = 1pt")
    else:
        breakdown.append("Major event imminent = 0pts (hold off)")

    # Sector alignment: 1pt
    if sector_aligned:
        points += 1
        breakdown.append("Sector macro-aligned = 1pt")
    else:
        breakdown.append("Sector headwind = 0pts")

    return {
        "points": min(5, points),
        "max": 5,
        "breakdown": breakdown,
        "disqualified": False,
    }


# ─────────────────────────────────────────────────────────
# FULL GRADE CALCULATION
# ─────────────────────────────────────────────────────────

def grade_trade(
    # Directional
    conv_score: int, conv_max: int, conv_zone: str,
    wein_stage: str, tpl_score: int, rs: int,
    phase: str, ema_d: str, ema_w: str, ema_m: str,
    # Options
    iv_rank: int = 50, iv_verdict: str = "NEUTRAL",
    expected_move_ratio: float = 1.0,
    theta_pct_of_premium: float = 15.0,
    skew_verdict: str = "neutral",
    # Timing
    vcp_pivot: Optional[float] = None, current_price: float = 0,
    vol_ratio: float = 1.0, vol_avg50: float = 0, volume_today: float = 0,
    # Risk
    stop_price: float = 0, target1: float = 0, target2: float = 0,
    # Flow
    short_vol_ratio: float = 0.5, insider_buying: bool = False,
    insider_selling: bool = False, unusual_call_vol: bool = False,
    unusual_put_vol: bool = False,
    # Macro (new)
    macro_score: int = 5, event_imminent: bool = False,
    sector_aligned: bool = True,
    # Meta
    is_short: bool = False,
) -> dict:
    """
    Full 100-point trade grading.
    Returns grade, score, component breakdown, and tradability assessment.
    """

    # Score each component
    directional = score_directional_edge(
        conv_score, conv_max, conv_zone, wein_stage, tpl_score, rs,
        phase, ema_d, ema_w, ema_m, is_short)

    options = score_options_edge(
        iv_rank, iv_verdict, expected_move_ratio,
        theta_pct_of_premium, skew_verdict)

    timing = score_timing_edge(
        phase, vcp_pivot, current_price, vol_ratio, vol_avg50, volume_today)

    # Auto-calculate stop and targets if not provided
    if stop_price == 0 and current_price > 0:
        if is_short:
            stop_price = current_price * 1.07
            target1 = current_price * 0.85 if target1 == 0 else target1
            target2 = current_price * 0.75 if target2 == 0 else target2
        else:
            stop_price = current_price * 0.93
            if vcp_pivot:
                stop_price = vcp_pivot * 0.97
            target1 = current_price * 1.15 if target1 == 0 else target1
            target2 = current_price * 1.25 if target2 == 0 else target2

    risk = score_risk_quality(current_price, stop_price, target1, target2, is_short)

    flow = score_flow_confirmation(
        short_vol_ratio, insider_buying, insider_selling,
        unusual_call_vol, unusual_put_vol, is_short)

    macro = score_macro_environment(macro_score, event_imminent, sector_aligned)

    # Raw total (108 max: 30+25+20+15+8+5 = 103... actually 30+25+20+15+8+5=103)
    # Directional=30, Options=25, Timing=20, Risk=15, Flow=8, Macro=5 = 103
    raw_total = directional["points"] + options["points"] + timing["points"] + risk["points"] + flow["points"] + macro["points"]
    raw_max = directional["max"] + options["max"] + timing["max"] + risk["max"] + flow["max"] + macro["max"]

    # Normalize to 100
    total = round(raw_total / max(raw_max, 1) * 100)

    # Check for disqualifying conditions
    disqualified = False
    disqualify_reasons = []
    if directional.get("disqualified"):
        disqualified = True
        disqualify_reasons.append("Insufficient framework alignment")
    if options.get("disqualified"):
        disqualified = True
        disqualify_reasons.append("IV environment + expected move unfavorable")
    if timing.get("disqualified"):
        disqualified = True
        disqualify_reasons.append("No entry timing — chasing or no defined entry")

    if disqualified:
        total = min(total, 59)  # Cap at BB

    grade_info = score_to_grade(total)

    return {
        "totalScore": total,
        "maxScore": 100,
        "rawTotal": raw_total,
        "rawMax": raw_max,
        **grade_info,
        "components": {
            "directional": directional,
            "options": options,
            "timing": timing,
            "risk": risk,
            "flow": flow,
            "macro": macro,
        },
        "disqualified": disqualified,
        "disqualifyReasons": disqualify_reasons,
        "summary": f"Dir: {directional['points']}/{directional['max']} | Opt: {options['points']}/{options['max']} | Tim: {timing['points']}/{timing['max']} | Risk: {risk['points']}/{risk['max']} | Flow: {flow['points']}/{flow['max']} | Macro: {macro['points']}/{macro['max']} = {total}/100 = {grade_info['grade']}",
        "stopPrice": round(stop_price, 2),
        "target1": round(target1, 2),
        "target2": round(target2, 2),
        "rrRatio": risk.get("rrRatio", 0),
    }
