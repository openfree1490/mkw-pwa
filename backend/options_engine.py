"""
MKW Options Intelligence Engine
Black-Scholes pricing, IV analysis, Greeks, expected move, strategy selection.
"""

import math
import logging
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd

log = logging.getLogger("mkw.options")

# ─────────────────────────────────────────────────────────
# BLACK-SCHOLES CORE
# ─────────────────────────────────────────────────────────

def _norm_cdf(x: float) -> float:
    """Standard normal CDF (no scipy dependency)."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

def _norm_pdf(x: float) -> float:
    """Standard normal PDF."""
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)

def black_scholes_price(S: float, K: float, T: float, r: float, sigma: float, option_type: str = "call") -> float:
    """
    Black-Scholes option price.
    S: spot price, K: strike, T: time to expiry (years), r: risk-free rate, sigma: IV (annualized)
    """
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return max(0, (S - K) if option_type == "call" else (K - S))

    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    if option_type == "call":
        return S * _norm_cdf(d1) - K * math.exp(-r * T) * _norm_cdf(d2)
    else:
        return K * math.exp(-r * T) * _norm_cdf(-d2) - S * _norm_cdf(-d1)

def implied_volatility(price: float, S: float, K: float, T: float, r: float, option_type: str = "call", tol: float = 1e-6, max_iter: int = 100) -> float:
    """Newton-Raphson IV solver."""
    if T <= 0 or price <= 0:
        return 0.0

    sigma = 0.3  # initial guess
    for _ in range(max_iter):
        bs_price = black_scholes_price(S, K, T, r, sigma, option_type)
        vega = _bs_vega(S, K, T, r, sigma)
        if vega < 1e-10:
            break
        diff = bs_price - price
        if abs(diff) < tol:
            break
        sigma -= diff / vega
        sigma = max(0.01, min(5.0, sigma))  # clamp
    return round(sigma, 4)

# ─────────────────────────────────────────────────────────
# GREEKS
# ─────────────────────────────────────────────────────────

def _bs_d1(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0:
        return 0.0
    return (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))

def _bs_vega(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0:
        return 0.0
    d1 = _bs_d1(S, K, T, r, sigma)
    return S * _norm_pdf(d1) * math.sqrt(T)

def calc_greeks(S: float, K: float, T: float, r: float, sigma: float, option_type: str = "call") -> dict:
    """
    Full Greeks for a single option.
    Returns: delta, gamma, theta (per day), vega (per 1% IV move), rho
    """
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        intrinsic = max(0, (S - K) if option_type == "call" else (K - S))
        return {"delta": 1.0 if intrinsic > 0 else 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}

    d1 = _bs_d1(S, K, T, r, sigma)
    d2 = d1 - sigma * math.sqrt(T)
    sqrt_T = math.sqrt(T)

    if option_type == "call":
        delta = _norm_cdf(d1)
        rho = K * T * math.exp(-r * T) * _norm_cdf(d2) / 100
    else:
        delta = _norm_cdf(d1) - 1
        rho = -K * T * math.exp(-r * T) * _norm_cdf(-d2) / 100

    gamma = _norm_pdf(d1) / (S * sigma * sqrt_T)

    # Theta per calendar day
    theta_term1 = -(S * _norm_pdf(d1) * sigma) / (2 * sqrt_T)
    if option_type == "call":
        theta_term2 = -r * K * math.exp(-r * T) * _norm_cdf(d2)
    else:
        theta_term2 = r * K * math.exp(-r * T) * _norm_cdf(-d2)
    theta = (theta_term1 + theta_term2) / 365

    # Vega per 1 percentage point move in IV
    vega = S * _norm_pdf(d1) * sqrt_T / 100

    return {
        "delta": round(delta, 4),
        "gamma": round(gamma, 6),
        "theta": round(theta, 4),
        "vega":  round(vega, 4),
        "rho":   round(rho, 4),
    }

def greeks_projection(S: float, K: float, T: float, r: float, sigma: float,
                      option_type: str, target_prices: list, hold_days: int = 15) -> dict:
    """
    Project how Greeks and option value change at different stock prices and over time.
    """
    current_price = black_scholes_price(S, K, T, r, sigma, option_type)
    current_greeks = calc_greeks(S, K, T, r, sigma, option_type)

    # Theta burn projection
    T_after = max(0, T - hold_days / 365)
    price_after_theta = black_scholes_price(S, K, T_after, r, sigma, option_type)
    theta_cost_total = current_price - price_after_theta
    theta_per_day = theta_cost_total / hold_days if hold_days > 0 else 0

    # Price needed to offset theta
    price_to_offset = S
    for test_pct in range(1, 200):
        test_price = S * (1 + test_pct * 0.001) if option_type == "call" else S * (1 - test_pct * 0.001)
        opt_val = black_scholes_price(test_price, K, T_after, r, sigma, option_type)
        if opt_val >= current_price:
            price_to_offset = test_price
            break

    # Project at target prices
    projections = []
    for target in target_prices:
        opt_at_target = black_scholes_price(target, K, T_after, r, sigma, option_type)
        greeks_at_target = calc_greeks(target, K, T_after, r, sigma, option_type)
        pnl = opt_at_target - current_price
        pnl_pct = (pnl / current_price * 100) if current_price > 0 else 0
        projections.append({
            "stockPrice": round(target, 2),
            "optionValue": round(opt_at_target, 2),
            "pnl": round(pnl, 2),
            "pnlPct": round(pnl_pct, 1),
            "delta": greeks_at_target["delta"],
            "gamma": greeks_at_target["gamma"],
        })

    return {
        "currentPrice": round(current_price, 2),
        "currentGreeks": current_greeks,
        "thetaBurn": {
            "perDay": round(theta_per_day, 2),
            "totalOverHold": round(theta_cost_total, 2),
            "holdDays": hold_days,
            "pctOfPremium": round(theta_cost_total / current_price * 100, 1) if current_price > 0 else 0,
            "priceToOffset": round(price_to_offset, 2),
        },
        "projections": projections,
    }


# ─────────────────────────────────────────────────────────
# IV ANALYSIS
# ─────────────────────────────────────────────────────────

def calc_historical_volatility(df: pd.DataFrame, window: int = 20) -> float:
    """Annualized historical volatility from daily returns."""
    if df is None or len(df) < window + 1:
        return 0.3
    returns = np.log(df["Close"] / df["Close"].shift(1)).dropna()
    if len(returns) < window:
        return 0.3
    hv = float(returns.iloc[-window:].std()) * math.sqrt(252)
    return round(hv, 4)

def calc_iv_from_options_chain(ticker_obj) -> dict:
    """
    Extract IV metrics from yfinance options chain.
    Returns IV rank, IV percentile, term structure, skew, vol-of-vol.
    """
    result = {
        "currentIV": 0.30,
        "ivRank": 50,
        "ivPercentile": 50,
        "ivHigh52w": 0.60,
        "ivLow52w": 0.15,
        "termStructure": "contango",
        "termStructureDetail": [],
        "skew": 0.0,
        "skewVerdict": "neutral",
        "volOfVol": 0.0,
        "volOfVolVerdict": "stable",
        "verdict": "NEUTRAL",
        "verdictReason": "",
    }

    try:
        expirations = ticker_obj.options
        if not expirations or len(expirations) < 1:
            return result

        # Collect ATM IV for each expiration
        spot = None
        try:
            hist = ticker_obj.history(period="5d")
            if hist is not None and not hist.empty:
                spot = float(hist["Close"].iloc[-1])
        except Exception:
            pass

        if spot is None or spot <= 0:
            return result

        iv_by_expiry = []
        atm_ivs_near = []
        otm_call_iv = None
        atm_iv_ref = None

        for i, exp in enumerate(expirations[:6]):  # max 6 expirations
            try:
                chain = ticker_obj.option_chain(exp)
                calls = chain.calls
                puts = chain.puts

                if calls.empty and puts.empty:
                    continue

                # Find ATM strike
                if not calls.empty:
                    calls_valid = calls[calls["impliedVolatility"] > 0.01].copy()
                    if not calls_valid.empty:
                        calls_valid["dist"] = abs(calls_valid["strike"] - spot)
                        atm_row = calls_valid.loc[calls_valid["dist"].idxmin()]
                        atm_iv = float(atm_row["impliedVolatility"])

                        exp_date = datetime.strptime(exp, "%Y-%m-%d")
                        dte = (exp_date - datetime.now()).days

                        iv_by_expiry.append({
                            "expiry": exp,
                            "dte": max(1, dte),
                            "atmIV": round(atm_iv, 4),
                        })

                        if i == 0:
                            atm_iv_ref = atm_iv

                        # For skew: find OTM call (~5% OTM)
                        if i == 0:
                            otm_strike = spot * 1.05
                            otm_calls = calls_valid[calls_valid["strike"] >= otm_strike]
                            if not otm_calls.empty:
                                otm_row = otm_calls.iloc[0]
                                otm_call_iv = float(otm_row["impliedVolatility"])

            except Exception as e:
                log.debug(f"Chain fetch error for {exp}: {e}")
                continue

        if not iv_by_expiry:
            return result

        current_iv = iv_by_expiry[0]["atmIV"]
        result["currentIV"] = current_iv
        result["termStructureDetail"] = iv_by_expiry

        # Term structure: compare near vs far
        if len(iv_by_expiry) >= 2:
            near_iv = iv_by_expiry[0]["atmIV"]
            far_iv = iv_by_expiry[-1]["atmIV"]
            if near_iv > far_iv * 1.05:
                result["termStructure"] = "backwardation"
            elif far_iv > near_iv * 1.05:
                result["termStructure"] = "contango"
            else:
                result["termStructure"] = "flat"

        # Skew: ATM vs OTM call IV
        if atm_iv_ref and otm_call_iv:
            skew = (otm_call_iv - atm_iv_ref) / atm_iv_ref * 100
            result["skew"] = round(skew, 1)
            if skew > 15:
                result["skewVerdict"] = "overpaying_otm"
            elif skew < -10:
                result["skewVerdict"] = "favorable_otm"
            else:
                result["skewVerdict"] = "neutral"

        # Estimate IV Rank and Percentile using HV as proxy for historical IV range
        # (True IV history requires paid data — we approximate with realized vol)
        try:
            hist_long = ticker_obj.history(period="1y")
            if hist_long is not None and len(hist_long) > 60:
                returns = np.log(hist_long["Close"] / hist_long["Close"].shift(1)).dropna()
                # Rolling 20-day HV as proxy for IV
                rolling_hv = returns.rolling(20).std() * math.sqrt(252)
                rolling_hv = rolling_hv.dropna()

                if len(rolling_hv) > 20:
                    hv_values = rolling_hv.values
                    iv_high = float(np.percentile(hv_values, 95))
                    iv_low = float(np.percentile(hv_values, 5))

                    result["ivHigh52w"] = round(iv_high, 4)
                    result["ivLow52w"] = round(iv_low, 4)

                    # IV Rank: (current - low) / (high - low) * 100
                    iv_range = iv_high - iv_low
                    if iv_range > 0.01:
                        iv_rank = int(min(100, max(0, (current_iv - iv_low) / iv_range * 100)))
                        result["ivRank"] = iv_rank

                    # IV Percentile: % of days IV was below current
                    below_count = int(np.sum(hv_values < current_iv))
                    iv_pct = int(below_count / len(hv_values) * 100)
                    result["ivPercentile"] = iv_pct

                    # Vol of Vol: std of rolling HV over last 20 readings
                    if len(rolling_hv) >= 40:
                        recent_hv = rolling_hv.iloc[-20:]
                        vov = float(recent_hv.std())
                        result["volOfVol"] = round(vov, 4)
                        if vov > 0.10:
                            result["volOfVolVerdict"] = "unstable"
                        elif vov > 0.05:
                            result["volOfVolVerdict"] = "moderate"
                        else:
                            result["volOfVolVerdict"] = "stable"
        except Exception as e:
            log.debug(f"IV history calc error: {e}")

        # Overall verdict
        iv_rank = result["ivRank"]
        skew_v = result["skewVerdict"]
        vov_v = result["volOfVolVerdict"]

        favorable_count = 0
        unfavorable_count = 0
        reasons = []

        if iv_rank < 30:
            favorable_count += 2
            reasons.append(f"IV Rank {iv_rank} is LOW — cheap options")
        elif iv_rank < 50:
            favorable_count += 1
            reasons.append(f"IV Rank {iv_rank} is moderate")
        elif iv_rank < 70:
            unfavorable_count += 1
            reasons.append(f"IV Rank {iv_rank} is elevated — consider spreads")
        else:
            unfavorable_count += 2
            reasons.append(f"IV Rank {iv_rank} is HIGH — premium expensive, spreads only")

        if skew_v == "overpaying_otm":
            unfavorable_count += 1
            reasons.append(f"OTM skew +{result['skew']:.0f}% — you're overpaying for OTM strikes")
        elif skew_v == "favorable_otm":
            favorable_count += 1
            reasons.append("OTM strikes relatively cheap vs ATM")

        if vov_v == "unstable":
            unfavorable_count += 1
            reasons.append("Vol-of-vol HIGH — IV could crush even on correct direction")
        elif vov_v == "stable":
            favorable_count += 1
            reasons.append("Vol-of-vol stable — IV environment predictable")

        if favorable_count >= 3 and unfavorable_count == 0:
            result["verdict"] = "FAVORABLE"
        elif unfavorable_count >= 2:
            result["verdict"] = "UNFAVORABLE"
        else:
            result["verdict"] = "NEUTRAL"

        result["verdictReason"] = " | ".join(reasons)

    except Exception as e:
        log.warning(f"IV analysis error: {e}")

    return result


# ─────────────────────────────────────────────────────────
# EXPECTED MOVE ANALYSIS
# ─────────────────────────────────────────────────────────

def calc_expected_move(df: pd.DataFrame, current_iv: float, spot: float) -> dict:
    """
    Calculate expected move based on IV and historical breakout analysis.
    Uses IV-implied move and historical realized moves for comparison.
    """
    result = {
        "ivImplied": {},
        "historical": {},
        "breakeven": {},
    }

    if df is None or len(df) < 60 or spot <= 0:
        return result

    try:
        # IV-implied expected move for various timeframes
        for days, label in [(5, "1w"), (10, "2w"), (20, "1m"), (30, "6w"), (60, "3m")]:
            move_pct = current_iv * math.sqrt(days / 252) * 100
            move_dollar = spot * move_pct / 100
            result["ivImplied"][label] = {
                "days": days,
                "movePct": round(move_pct, 1),
                "moveDollar": round(move_dollar, 2),
                "upperTarget": round(spot + move_dollar, 2),
                "lowerTarget": round(spot - move_dollar, 2),
            }

        # Historical realized moves
        c = df["Close"]
        for days in [5, 10, 20, 30, 60]:
            if len(c) > days + 20:
                # Calculate rolling N-day returns
                fwd_returns = (c.shift(-days) / c - 1).dropna() * 100
                fwd_returns = fwd_returns[fwd_returns.notna()]
                if len(fwd_returns) > 10:
                    label = {5: "1w", 10: "2w", 20: "1m", 30: "6w", 60: "3m"}[days]
                    result["historical"][label] = {
                        "days": days,
                        "medianMove": round(float(fwd_returns.abs().median()), 1),
                        "avgMove": round(float(fwd_returns.abs().mean()), 1),
                        "percentile75": round(float(np.percentile(fwd_returns.abs(), 75)), 1),
                        "percentile25": round(float(np.percentile(fwd_returns.abs(), 25)), 1),
                        "upPct": round(float((fwd_returns > 0).mean() * 100), 0),
                    }

    except Exception as e:
        log.warning(f"Expected move calc error: {e}")

    return result

def compare_move_to_breakeven(expected_move: dict, breakeven_pct: float, hold_days: int = 20) -> dict:
    """
    Compare expected stock move to option breakeven distance.
    Returns assessment: FAVORABLE, MARGINAL, or UNFAVORABLE.
    """
    label_map = {5: "1w", 10: "2w", 20: "1m", 30: "6w", 60: "3m"}

    # Find closest timeframe
    closest_label = "1m"
    min_diff = 999
    for days, label in label_map.items():
        if abs(days - hold_days) < min_diff:
            min_diff = abs(days - hold_days)
            closest_label = label

    hist = expected_move.get("historical", {}).get(closest_label, {})
    iv_impl = expected_move.get("ivImplied", {}).get(closest_label, {})

    median_move = hist.get("medianMove", 0)
    iv_move = iv_impl.get("movePct", 0)

    if median_move <= 0 and iv_move <= 0:
        return {"assessment": "UNKNOWN", "reason": "Insufficient data", "ratio": 0}

    reference_move = median_move if median_move > 0 else iv_move
    ratio = reference_move / breakeven_pct if breakeven_pct > 0 else 0

    if ratio >= 1.5:
        assessment = "FAVORABLE"
        reason = f"Historical median move {reference_move:.1f}% is {ratio:.1f}x the breakeven distance of {breakeven_pct:.1f}%"
    elif ratio >= 1.0:
        assessment = "MARGINAL"
        reason = f"Historical median move {reference_move:.1f}% barely covers breakeven of {breakeven_pct:.1f}% — consider a spread"
    else:
        assessment = "UNFAVORABLE"
        reason = f"Historical median move {reference_move:.1f}% is LESS than breakeven of {breakeven_pct:.1f}% — premium too expensive"

    return {"assessment": assessment, "reason": reason, "ratio": round(ratio, 2)}


# ─────────────────────────────────────────────────────────
# STRATEGY SELECTION ENGINE
# ─────────────────────────────────────────────────────────

STRATEGY_RULES = [
    # (condition_fn, strategy_name, description)
]

def select_strategy(iv_rank: int, iv_verdict: str, conv_zone: str, phase: str,
                    wein_stage: str, is_leap: bool = False) -> dict:
    """
    Based on IV environment, setup type, and market context, recommend optimal option structure.
    Returns strategy type and reasoning.
    """
    strategies = []

    # Determine if bullish or bearish setup
    is_short = wein_stage in ("3", "4A", "4B")
    direction = "bearish" if is_short else "bullish"

    # Stage 1/3 chop — no directional
    if wein_stage in ("1A", "1B", "3"):
        return {
            "primary": "CASH",
            "alt": "iron_condor",
            "reason": f"Stage {wein_stage} — no clear direction. Stay cash or sell premium with iron condor.",
            "direction": "neutral",
            "strategies": [{
                "type": "CASH",
                "name": "Stay Cash",
                "reason": "No directional edge in current stage. Capital preservation IS a position.",
                "aggression": "conservative",
            }],
        }

    # LEAP entries
    if is_leap:
        if iv_rank < 40:
            strat = {
                "type": "deep_itm_leap",
                "name": "Deep ITM LEAP" + (" Put" if is_short else " Call"),
                "reason": f"IV Rank {iv_rank} is low — deep ITM LEAP (delta 0.75+) acts as synthetic stock at fraction of cost",
                "aggression": "conservative",
                "targetDelta": 0.75,
                "dteRange": [180, 365],
            }
        else:
            strat = {
                "type": "pmcc" if not is_short else "pmcp",
                "name": "Poor Man's Covered " + ("Put" if is_short else "Call"),
                "reason": f"IV Rank {iv_rank} elevated — buy LEAP, sell near-term OTM monthly for income to offset premium",
                "aggression": "moderate",
                "targetDelta": 0.70,
                "dteRange": [180, 365],
            }
        return {
            "primary": strat["type"],
            "alt": "deep_itm_leap" if strat["type"] != "deep_itm_leap" else "pmcc",
            "reason": strat["reason"],
            "direction": direction,
            "strategies": [strat],
        }

    # Swing entries by IV rank
    result_strategies = []

    if iv_rank < 30 and conv_zone in ("CONVERGENCE", "SECONDARY"):
        # Low IV — straight directional is optimal
        result_strategies.append({
            "type": "long_call" if not is_short else "long_put",
            "name": f"Long {'Put' if is_short else 'Call'} (ATM)",
            "reason": f"IV Rank {iv_rank} LOW + strong convergence = straight directional. Maximum leverage.",
            "aggression": "aggressive",
            "targetDelta": 0.55,
            "dteRange": [30, 45],
        })
        result_strategies.append({
            "type": "debit_spread",
            "name": f"{'Bear Put' if is_short else 'Bull Call'} Spread",
            "reason": "Alternative: spread reduces cost basis while maintaining directional exposure",
            "aggression": "moderate",
            "targetDelta": 0.55,
            "dteRange": [30, 60],
        })

    elif iv_rank < 50:
        # Moderate IV — either works
        result_strategies.append({
            "type": "long_call" if not is_short else "long_put",
            "name": f"Long {'Put' if is_short else 'Call'}",
            "reason": f"IV Rank {iv_rank} moderate — directional viable but spread reduces risk",
            "aggression": "aggressive",
            "targetDelta": 0.55,
            "dteRange": [30, 60],
        })
        result_strategies.append({
            "type": "debit_spread",
            "name": f"{'Bear Put' if is_short else 'Bull Call'} Spread",
            "reason": f"IV Rank {iv_rank} — spread recommended to cap vega risk",
            "aggression": "moderate",
            "targetDelta": 0.55,
            "dteRange": [30, 60],
        })

    elif iv_rank < 70:
        # Elevated IV — spreads preferred
        result_strategies.append({
            "type": "debit_spread",
            "name": f"{'Bear Put' if is_short else 'Bull Call'} Spread",
            "reason": f"IV Rank {iv_rank} ELEVATED — sell higher strike to offset IV cost. Straight options too expensive.",
            "aggression": "moderate",
            "targetDelta": 0.55,
            "dteRange": [30, 60],
        })

    else:
        # IV > 70 — spreads only or skip
        result_strategies.append({
            "type": "debit_spread",
            "name": f"{'Bear Put' if is_short else 'Bull Call'} Spread ONLY",
            "reason": f"IV Rank {iv_rank} EXTREME — premium too expensive for naked options. Spread or skip.",
            "aggression": "moderate",
            "targetDelta": 0.55,
            "dteRange": [30, 60],
        })
        result_strategies.append({
            "type": "CASH",
            "name": "Consider Skipping",
            "reason": f"IV Rank {iv_rank} — even spreads are expensive. Wait for IV to normalize.",
            "aggression": "conservative",
        })

    # VCP coil special case
    if phase == "Wedge" and iv_rank < 30:
        result_strategies.append({
            "type": "long_straddle",
            "name": "Long Straddle (VCP Coil Play)",
            "reason": "VCP coiling + low IV = straddle captures breakout in either direction",
            "aggression": "aggressive",
            "targetDelta": 0.50,
            "dteRange": [30, 60],
        })

    primary = result_strategies[0] if result_strategies else {"type": "CASH", "name": "No Strategy", "reason": "Conditions unclear"}
    alt = result_strategies[1]["type"] if len(result_strategies) > 1 else "CASH"

    return {
        "primary": primary["type"],
        "alt": alt,
        "reason": primary["reason"],
        "direction": direction,
        "strategies": result_strategies,
    }


# ─────────────────────────────────────────────────────────
# BUILD OPTION CHAIN SNAPSHOT
# ─────────────────────────────────────────────────────────

def build_options_snapshot(ticker_obj, spot: float, direction: str = "bullish") -> list:
    """
    Build a snapshot of relevant options for the nearest 3 expirations.
    Returns list of {expiry, dte, calls: [...], puts: [...]} with Greeks.
    """
    snapshots = []
    r = 0.05  # risk-free rate approximation

    try:
        expirations = ticker_obj.options
        if not expirations:
            return []

        for exp in expirations[:4]:
            try:
                chain = ticker_obj.option_chain(exp)
                exp_date = datetime.strptime(exp, "%Y-%m-%d")
                dte = max(1, (exp_date - datetime.now()).days)
                T = dte / 365

                snap = {"expiry": exp, "dte": dte, "calls": [], "puts": []}

                # Process calls
                if not chain.calls.empty:
                    # Get strikes near ATM (within ~15%)
                    calls = chain.calls[
                        (chain.calls["strike"] >= spot * 0.85) &
                        (chain.calls["strike"] <= spot * 1.20) &
                        (chain.calls["impliedVolatility"] > 0.01)
                    ].head(8)

                    for _, row in calls.iterrows():
                        strike = float(row["strike"])
                        iv = float(row["impliedVolatility"])
                        bid = float(row.get("bid", 0) or 0)
                        ask = float(row.get("ask", 0) or 0)
                        mid = round((bid + ask) / 2, 2) if bid > 0 and ask > 0 else float(row.get("lastPrice", 0) or 0)
                        vol = int(row.get("volume", 0) or 0)
                        oi = int(row.get("openInterest", 0) or 0)

                        greeks = calc_greeks(spot, strike, T, r, iv, "call")
                        breakeven = strike + mid
                        breakeven_pct = round((breakeven / spot - 1) * 100, 2) if spot > 0 else 0

                        snap["calls"].append({
                            "strike": strike,
                            "bid": bid,
                            "ask": ask,
                            "mid": mid,
                            "iv": round(iv, 4),
                            "volume": vol,
                            "openInterest": oi,
                            "greeks": greeks,
                            "breakeven": round(breakeven, 2),
                            "breakevenPct": breakeven_pct,
                            "moneyness": "ITM" if strike < spot else ("ATM" if abs(strike - spot) / spot < 0.02 else "OTM"),
                        })

                # Process puts
                if not chain.puts.empty:
                    puts = chain.puts[
                        (chain.puts["strike"] >= spot * 0.80) &
                        (chain.puts["strike"] <= spot * 1.15) &
                        (chain.puts["impliedVolatility"] > 0.01)
                    ].head(8)

                    for _, row in puts.iterrows():
                        strike = float(row["strike"])
                        iv = float(row["impliedVolatility"])
                        bid = float(row.get("bid", 0) or 0)
                        ask = float(row.get("ask", 0) or 0)
                        mid = round((bid + ask) / 2, 2) if bid > 0 and ask > 0 else float(row.get("lastPrice", 0) or 0)
                        vol = int(row.get("volume", 0) or 0)
                        oi = int(row.get("openInterest", 0) or 0)

                        greeks = calc_greeks(spot, strike, T, r, iv, "put")
                        breakeven = strike - mid
                        breakeven_pct = round((1 - breakeven / spot) * 100, 2) if spot > 0 else 0

                        snap["puts"].append({
                            "strike": strike,
                            "bid": bid,
                            "ask": ask,
                            "mid": mid,
                            "iv": round(iv, 4),
                            "volume": vol,
                            "openInterest": oi,
                            "greeks": greeks,
                            "breakeven": round(breakeven, 2),
                            "breakevenPct": breakeven_pct,
                            "moneyness": "ITM" if strike > spot else ("ATM" if abs(strike - spot) / spot < 0.02 else "OTM"),
                        })

                snapshots.append(snap)
            except Exception as e:
                log.debug(f"Chain error for {exp}: {e}")
                continue
    except Exception as e:
        log.warning(f"Options snapshot error: {e}")

    return snapshots


# ─────────────────────────────────────────────────────────
# FULL OPTIONS ANALYSIS (ENTRY POINT)
# ─────────────────────────────────────────────────────────

def full_options_analysis(ticker_obj, df: pd.DataFrame, spot: float,
                          conv_zone: str, phase: str, wein_stage: str,
                          vcp_pivot: Optional[float] = None) -> dict:
    """
    Complete options intelligence for a ticker.
    Combines IV analysis, expected move, strategy selection, and chain snapshot.
    """
    result = {
        "iv": {},
        "expectedMove": {},
        "strategySelection": {},
        "chainSnapshot": [],
        "unusualActivity": [],
        "putCallRatio": None,
        "errors": [],
    }

    try:
        # 1. IV Analysis
        iv_data = calc_iv_from_options_chain(ticker_obj)
        result["iv"] = iv_data

        current_iv = iv_data.get("currentIV", 0.30)
        iv_rank = iv_data.get("ivRank", 50)
        iv_verdict = iv_data.get("verdict", "NEUTRAL")

        # 2. Expected Move
        expected = calc_expected_move(df, current_iv, spot)
        result["expectedMove"] = expected

        # 3. Strategy Selection
        strategy = select_strategy(iv_rank, iv_verdict, conv_zone, phase, wein_stage)
        result["strategySelection"] = strategy

        # 4. Chain Snapshot
        direction = "bearish" if wein_stage in ("3", "4A", "4B") else "bullish"
        chain = build_options_snapshot(ticker_obj, spot, direction)
        result["chainSnapshot"] = chain

        # 5. Put/Call ratio from chain data
        total_call_vol = 0
        total_put_vol = 0
        total_call_oi = 0
        total_put_oi = 0

        for snap in chain:
            for c in snap.get("calls", []):
                total_call_vol += c.get("volume", 0)
                total_call_oi += c.get("openInterest", 0)
            for p in snap.get("puts", []):
                total_put_vol += p.get("volume", 0)
                total_put_oi += p.get("openInterest", 0)

        if total_call_vol > 0:
            result["putCallRatio"] = {
                "volume": round(total_put_vol / total_call_vol, 2),
                "openInterest": round(total_put_oi / total_call_oi, 2) if total_call_oi > 0 else 0,
            }

        # 6. Unusual Activity Detection
        unusual = []
        for snap in chain:
            for opt_list, opt_type in [(snap.get("calls", []), "call"), (snap.get("puts", []), "put")]:
                for opt in opt_list:
                    vol = opt.get("volume", 0)
                    oi = opt.get("openInterest", 0)
                    if oi > 0 and vol > oi * 2:
                        unusual.append({
                            "type": opt_type,
                            "strike": opt["strike"],
                            "expiry": snap["expiry"],
                            "volume": vol,
                            "openInterest": oi,
                            "ratio": round(vol / oi, 1),
                            "iv": opt.get("iv", 0),
                        })

        result["unusualActivity"] = sorted(unusual, key=lambda x: x.get("ratio", 0), reverse=True)[:5]

    except Exception as e:
        log.error(f"Full options analysis error: {e}")
        result["errors"].append(str(e))

    return result


def build_strategy_card(spot: float, strike: float, expiry: str, dte: int,
                        option_type: str, iv: float, bid: float, ask: float,
                        strategy_name: str, aggression: str,
                        target1: float = 0, target2: float = 0,
                        stop_price: float = 0, contracts: int = 1) -> dict:
    """
    Build a complete strategy execution card with all details.
    """
    r = 0.05
    T = dte / 365
    mid = round((bid + ask) / 2, 2)

    greeks = calc_greeks(spot, strike, T, r, iv, option_type)
    current_value = black_scholes_price(spot, strike, T, r, iv, option_type)

    # Breakeven
    if option_type == "call":
        breakeven = strike + mid
        breakeven_pct = round((breakeven / spot - 1) * 100, 2)
    else:
        breakeven = strike - mid
        breakeven_pct = round((1 - breakeven / spot) * 100, 2)

    # Max risk
    max_risk = mid * 100 * contracts

    # Project at targets
    targets = []
    T_mid = max(0, T - 15 / 365)  # project ~15 days out

    for t_price in [target1, target2]:
        if t_price > 0:
            opt_val = black_scholes_price(t_price, strike, T_mid, r, iv, option_type)
            pnl = (opt_val - mid) * 100 * contracts
            pnl_pct = round((opt_val / mid - 1) * 100, 1) if mid > 0 else 0
            targets.append({
                "stockPrice": round(t_price, 2),
                "optionValue": round(opt_val, 2),
                "pnl": round(pnl, 2),
                "pnlPct": pnl_pct,
            })

    # R:R ratio
    if targets and max_risk > 0:
        best_gain = max(t.get("pnl", 0) for t in targets)
        rr_ratio = round(best_gain / max_risk, 1) if max_risk > 0 else 0
    else:
        rr_ratio = 0

    # Theta projection
    T_after = max(0, T - 15 / 365)
    val_after = black_scholes_price(spot, strike, T_after, r, iv, option_type)
    theta_cost_15d = round((current_value - val_after) * 100 * contracts, 2)

    return {
        "strategyName": strategy_name,
        "aggression": aggression,
        "optionType": option_type,
        "strike": strike,
        "expiry": expiry,
        "dte": dte,
        "bid": bid,
        "ask": ask,
        "mid": mid,
        "iv": round(iv, 4),
        "greeks": greeks,
        "breakeven": breakeven,
        "breakevenPct": breakeven_pct,
        "maxRisk": round(max_risk, 2),
        "contracts": contracts,
        "targets": targets,
        "rrRatio": rr_ratio,
        "thetaCost15d": theta_cost_15d,
        "thetaPerDay": round(greeks["theta"] * 100 * contracts, 2),
    }
