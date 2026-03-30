"""
MKW Short Setup Detector — 6 Systematic Short Patterns
Each detector returns a dict with setup_type, confidence (0-100), entry/stop/targets,
thesis text, and required conditions, or None if no setup detected.
"""

import logging
import numpy as np
import pandas as pd

log = logging.getLogger("mkw.short_setups")

# ─────────────────────────────────────────────
# SETUP 1: STAGE 4 BREAKDOWN
# ─────────────────────────────────────────────
def detect_stage4_breakdown(df, wein, rs, phase, finra_data, technicals, sr_levels):
    """
    Weinstein Stage 4A/4B + inverse template 6/8+ + RS < 30 + Kell Red Light.
    Classic institutional distribution breakdown.
    """
    if df is None or len(df) < 252:
        return None

    try:
        stage = wein.get("stage", "?")
        if stage not in ("4A", "4B"):
            return None

        c = df["Close"]
        price = float(c.iloc[-1])
        sma50 = float(c.rolling(50).mean().iloc[-1])
        sma150 = float(c.rolling(150).mean().iloc[-1])
        sma200 = float(c.rolling(200).mean().iloc[-1])
        sma200_20ago = float(c.rolling(200).mean().iloc[-21])

        # Build inverse template score
        inv_criteria = [
            price < sma50, price < sma150, price < sma200,
            sma50 < sma150, sma150 < sma200, sma200 < sma200_20ago,
            price <= float(df["High"].rolling(252).max().iloc[-1]) * 0.75,
            rs <= 30,
        ]
        inv_score = sum(inv_criteria)

        if inv_score < 6:
            return None

        # Confidence scoring
        confidence = 40
        if inv_score >= 8: confidence += 20
        elif inv_score >= 7: confidence += 15
        elif inv_score >= 6: confidence += 10

        if rs <= 15: confidence += 10
        elif rs <= 30: confidence += 5

        if phase in ("Red Light", "Wedge"): confidence += 10
        if stage == "4A": confidence += 5

        svr = finra_data.get("svr_today")
        if svr and svr > 50: confidence += 5

        rsi = technicals.get("rsi", 50)
        if rsi < 40: confidence += 5

        confidence = min(confidence, 95)

        # Targets
        stop = round(sma50 * 1.02, 2)
        target1 = round(price * 0.88, 2)
        target2 = round(price * 0.75, 2)

        # Find nearest support for refined target
        for lvl in sorted(sr_levels, key=lambda l: l.get("price", 0), reverse=True):
            if lvl.get("type") == "support" and lvl["price"] < price * 0.95:
                target1 = round(lvl["price"], 2)
                break

        return {
            "setup_type": "STAGE_4_BREAKDOWN",
            "confidence": confidence,
            "entry": round(price, 2),
            "stop": stop,
            "target1": target1,
            "target2": target2,
            "thesis": (
                f"Stage {stage} breakdown — inverse template {inv_score}/8, RS {rs}. "
                f"Price below all major MAs with declining 200d SMA. "
                f"Classic institutional distribution pattern."
            ),
            "conditions": {
                "stage_4": True,
                "inv_template_6plus": inv_score >= 6,
                "rs_below_30": rs <= 30,
                "kell_red_light": phase in ("Red Light", "Wedge"),
                "below_all_mas": price < sma50 and price < sma150,
                "sma200_declining": sma200 < sma200_20ago,
            },
            "inv_score": inv_score,
        }
    except Exception as e:
        log.warning(f"detect_stage4_breakdown: {e}")
        return None


# ─────────────────────────────────────────────
# SETUP 2: FAILED BREAKOUT
# ─────────────────────────────────────────────
def detect_failed_breakout(df, wein, rs, phase, finra_data, technicals, sr_levels):
    """
    Stock broke above resistance in last 10 days then reversed below it.
    Failed breakout + volume expansion on reversal = short trigger.
    """
    if df is None or len(df) < 60:
        return None

    try:
        c = df["Close"]
        h = df["High"]
        v = df["Volume"]
        price = float(c.iloc[-1])

        # Find recent resistance levels
        resistance_levels = [l["price"] for l in sr_levels if l.get("type") == "resistance" and l["price"] > price * 0.95]
        if not resistance_levels:
            return None

        nearest_resistance = min(resistance_levels, key=lambda r: abs(r - price))

        # Check if price broke above resistance in last 10 days then came back below
        broke_above = False
        reversal_day = None
        for i in range(-10, 0):
            if float(h.iloc[i]) > nearest_resistance * 1.01:
                broke_above = True
            if broke_above and float(c.iloc[i]) < nearest_resistance * 0.99:
                reversal_day = i
                break

        if not broke_above or reversal_day is None:
            return None

        # Current price must be below the resistance
        if price > nearest_resistance:
            return None

        # Volume on reversal should be elevated
        vol_avg = float(v.iloc[-50:].mean()) if len(v) >= 50 else float(v.mean())
        vol_reversal = float(v.iloc[reversal_day]) if reversal_day else vol_avg
        vol_ratio = vol_reversal / vol_avg if vol_avg > 0 else 1.0

        confidence = 45
        if vol_ratio > 2.0: confidence += 15
        elif vol_ratio > 1.5: confidence += 10
        elif vol_ratio > 1.2: confidence += 5

        if rs < 50: confidence += 10
        elif rs < 70: confidence += 5

        if phase in ("Red Light", "Wedge", "Extension"): confidence += 5

        rsi = technicals.get("rsi", 50)
        if rsi < 45: confidence += 5

        # Bearish MACD
        macd = technicals.get("macd", {})
        if macd.get("histogram", 0) < 0: confidence += 5

        confidence = min(confidence, 90)

        stop = round(float(h.iloc[-10:].max()) * 1.02, 2)
        target1 = round(price * 0.90, 2)
        target2 = round(price * 0.82, 2)

        return {
            "setup_type": "FAILED_BREAKOUT",
            "confidence": confidence,
            "entry": round(price, 2),
            "stop": stop,
            "target1": target1,
            "target2": target2,
            "thesis": (
                f"Failed breakout above ${nearest_resistance:.2f} resistance. "
                f"Reversed on {vol_ratio:.1f}x average volume. "
                f"Trapped longs above resistance create selling pressure."
            ),
            "conditions": {
                "broke_above_resistance": True,
                "reversed_below": True,
                "volume_expansion": vol_ratio > 1.2,
                "below_resistance_now": price < nearest_resistance,
                "bearish_macd": macd.get("histogram", 0) < 0,
            },
            "resistance_level": round(nearest_resistance, 2),
            "vol_ratio": round(vol_ratio, 2),
        }
    except Exception as e:
        log.warning(f"detect_failed_breakout: {e}")
        return None


# ─────────────────────────────────────────────
# SETUP 3: DISTRIBUTION TOP
# ─────────────────────────────────────────────
def detect_distribution_top(df, wein, rs, phase, finra_data, technicals, sr_levels):
    """
    Weinstein Stage 3 (top) + high FINRA SVR + declining RS + bearish divergence.
    Distribution phase where smart money sells into retail buying.
    """
    if df is None or len(df) < 100:
        return None

    try:
        stage = wein.get("stage", "?")
        if stage != "3":
            return None

        c = df["Close"]
        price = float(c.iloc[-1])
        sma200 = float(c.rolling(200).mean().iloc[-1]) if len(c) >= 200 else float(c.rolling(50).mean().iloc[-1])

        confidence = 40

        # FINRA SVR signals distribution
        svr = finra_data.get("svr_today")
        svr_trend = finra_data.get("svr_trend", "flat")
        if svr and svr > 55:
            confidence += 15
        elif svr and svr > 50:
            confidence += 8

        if svr_trend == "rising":
            confidence += 5

        # RS declining
        if rs < 40:
            confidence += 10
        elif rs < 60:
            confidence += 5

        # Kell phase
        if phase in ("Red Light", "Wedge"):
            confidence += 10
        elif phase == "Extension":
            confidence += 5

        # RSI bearish divergence: price flat/up but RSI declining
        rsi = technicals.get("rsi", 50)
        if rsi < 50:
            confidence += 5

        # Volume profile: above average selling
        vol_profile = technicals.get("volumeProfile", {})
        vol_ratio = vol_profile.get("ratio", 1.0)
        if vol_ratio > 1.3:
            confidence += 5

        # OBV trend
        if technicals.get("obv_trend") == "falling":
            confidence += 5

        confidence = min(confidence, 90)

        if confidence < 50:
            return None

        stop = round(float(df["High"].iloc[-20:].max()) * 1.02, 2)
        target1 = round(sma200, 2)
        target2 = round(price * 0.80, 2)

        return {
            "setup_type": "DISTRIBUTION_TOP",
            "confidence": confidence,
            "entry": round(price, 2),
            "stop": stop,
            "target1": target1,
            "target2": target2,
            "thesis": (
                f"Stage 3 distribution top — RS declining to {rs}. "
                f"{'SVR ' + str(svr) + '% signals institutional selling. ' if svr else ''}"
                f"Smart money distributing into retail demand."
            ),
            "conditions": {
                "stage_3": True,
                "svr_elevated": svr is not None and svr > 50,
                "rs_declining": rs < 60,
                "kell_bearish": phase in ("Red Light", "Wedge", "Extension"),
                "obv_falling": technicals.get("obv_trend") == "falling",
                "volume_expansion": vol_ratio > 1.2,
            },
            "svr": svr,
        }
    except Exception as e:
        log.warning(f"detect_distribution_top: {e}")
        return None


# ─────────────────────────────────────────────
# SETUP 4: PARABOLIC EXHAUSTION
# ─────────────────────────────────────────────
def detect_parabolic_exhaustion(df, wein, rs, phase, finra_data, technicals, sr_levels):
    """
    50-200% surge + 3+ consecutive up days + extended 30%+ above 20 EMA + volume climax.
    Qullamaggie-style parabolic short on first crack.
    """
    if df is None or len(df) < 60:
        return None

    try:
        c = df["Close"]
        h = df["High"]
        v = df["Volume"]
        price = float(c.iloc[-1])

        # Check for big surge in last 60 days
        low_60d = float(c.iloc[-60:].min())
        surge_pct = ((price - low_60d) / low_60d * 100) if low_60d > 0 else 0

        if surge_pct < 50:
            return None

        # Check extension above 20 EMA
        ema20 = float(c.ewm(span=20, adjust=False).mean().iloc[-1])
        extension = ((price - ema20) / ema20 * 100) if ema20 > 0 else 0

        if extension < 20:
            return None

        # Consecutive up days (last 5)
        up_days = 0
        for i in range(-5, 0):
            if float(c.iloc[i]) > float(c.iloc[i - 1]):
                up_days += 1
            else:
                up_days = 0

        # Volume climax: today or recent day had 3x+ average volume
        vol_avg = float(v.iloc[-50:].mean()) if len(v) >= 50 else float(v.mean())
        vol_climax = any(float(v.iloc[i]) > vol_avg * 3 for i in range(-5, 0)) if vol_avg > 0 else False

        # First crack: price reversing from recent high
        recent_high = float(h.iloc[-5:].max())
        first_crack = price < recent_high * 0.97

        confidence = 35
        if surge_pct >= 200: confidence += 15
        elif surge_pct >= 100: confidence += 10
        elif surge_pct >= 50: confidence += 5

        if extension >= 50: confidence += 10
        elif extension >= 30: confidence += 7
        elif extension >= 20: confidence += 4

        if up_days >= 5: confidence += 10
        elif up_days >= 3: confidence += 5

        if vol_climax: confidence += 10
        if first_crack: confidence += 10

        rsi = technicals.get("rsi", 50)
        if rsi > 80: confidence += 5
        elif rsi > 70: confidence += 3

        confidence = min(confidence, 95)

        if confidence < 45:
            return None

        stop = round(recent_high * 1.03, 2)
        target1 = round(ema20, 2)
        target2 = round(ema20 * 0.90, 2)

        return {
            "setup_type": "PARABOLIC_EXHAUSTION",
            "confidence": confidence,
            "entry": round(price, 2),
            "stop": stop,
            "target1": target1,
            "target2": target2,
            "thesis": (
                f"Parabolic exhaustion — {surge_pct:.0f}% surge, "
                f"{extension:.0f}% above 20 EMA. "
                f"{'Volume climax detected. ' if vol_climax else ''}"
                f"{'First crack forming. ' if first_crack else 'Watching for first crack. '}"
                f"Mean reversion to 20 EMA at ${ema20:.2f}."
            ),
            "conditions": {
                "surge_50pct_plus": surge_pct >= 50,
                "extended_above_ema": extension >= 20,
                "consecutive_up_days": up_days >= 3,
                "volume_climax": vol_climax,
                "first_crack": first_crack,
                "rsi_overbought": rsi > 70,
            },
            "surge_pct": round(surge_pct, 1),
            "extension_pct": round(extension, 1),
        }
    except Exception as e:
        log.warning(f"detect_parabolic_exhaustion: {e}")
        return None


# ─────────────────────────────────────────────
# SETUP 5: EMA REJECTION SHORT
# ─────────────────────────────────────────────
def detect_ema_rejection(df, wein, rs, phase, finra_data, technicals, sr_levels):
    """
    In downtrend, price rallied to 10/20 EMA and got rejected (bearish candle at EMA).
    Continuation short on EMA rejection.
    """
    if df is None or len(df) < 50:
        return None

    try:
        stage = wein.get("stage", "?")
        if stage not in ("3", "4A", "4B"):
            return None

        c = df["Close"]
        h = df["High"]
        o = df["Open"] if "Open" in df.columns else c
        v = df["Volume"]
        price = float(c.iloc[-1])

        ema10 = float(c.ewm(span=10, adjust=False).mean().iloc[-1])
        ema20 = float(c.ewm(span=20, adjust=False).mean().iloc[-1])
        ema50 = float(c.ewm(span=50, adjust=False).mean().iloc[-1])

        # Downtrend: EMAs stacking bearish
        in_downtrend = ema10 < ema20 < ema50

        if not in_downtrend:
            return None

        # Price touched or exceeded EMA in last 3 days then rejected
        touched_ema = False
        rejection_ema = None
        for i in range(-3, 0):
            high_i = float(h.iloc[i])
            close_i = float(c.iloc[i])
            ema10_i = float(c.ewm(span=10, adjust=False).mean().iloc[i])
            ema20_i = float(c.ewm(span=20, adjust=False).mean().iloc[i])

            # Touched 10 EMA and closed below
            if high_i >= ema10_i * 0.99 and close_i < ema10_i:
                touched_ema = True
                rejection_ema = "10 EMA"
            # Touched 20 EMA and closed below
            elif high_i >= ema20_i * 0.99 and close_i < ema20_i:
                touched_ema = True
                rejection_ema = "20 EMA"

        if not touched_ema:
            return None

        # Bearish candle today (close < open)
        today_open = float(o.iloc[-1])
        bearish_candle = price < today_open

        confidence = 45
        if in_downtrend: confidence += 10
        if bearish_candle: confidence += 10
        if rs < 30: confidence += 10
        elif rs < 50: confidence += 5

        if phase in ("Red Light", "Wedge"): confidence += 5

        vol_avg = float(v.iloc[-50:].mean()) if len(v) >= 50 else float(v.mean())
        vol_today = float(v.iloc[-1])
        vol_ratio = vol_today / vol_avg if vol_avg > 0 else 1.0
        if vol_ratio > 1.3: confidence += 5

        svr = finra_data.get("svr_today")
        if svr and svr > 50: confidence += 5

        confidence = min(confidence, 90)

        stop = round(max(ema20, float(h.iloc[-5:].max())) * 1.02, 2)
        target1 = round(price * 0.90, 2)
        target2 = round(price * 0.82, 2)

        return {
            "setup_type": "EMA_REJECTION_SHORT",
            "confidence": confidence,
            "entry": round(price, 2),
            "stop": stop,
            "target1": target1,
            "target2": target2,
            "thesis": (
                f"EMA rejection short — price touched {rejection_ema} and got rejected. "
                f"Bearish EMA stack (10 < 20 < 50). "
                f"RS {rs}, Stage {stage}. Continuation short."
            ),
            "conditions": {
                "in_downtrend": in_downtrend,
                "ema_touch_rejection": True,
                "bearish_candle": bearish_candle,
                "rs_weak": rs < 50,
                "kell_bearish": phase in ("Red Light", "Wedge"),
                "volume_on_rejection": vol_ratio > 1.2,
            },
            "rejection_ema": rejection_ema,
        }
    except Exception as e:
        log.warning(f"detect_ema_rejection: {e}")
        return None


# ─────────────────────────────────────────────
# SETUP 6: EARNINGS GAP FADE
# ─────────────────────────────────────────────
def detect_earnings_gap_fade(df, wein, rs, phase, finra_data, technicals, sr_levels):
    """
    Post-earnings gap up that fails: gap up > 5% on earnings, then reversal within 3 days.
    Fading the gap when follow-through fails.
    """
    if df is None or len(df) < 20:
        return None

    try:
        c = df["Close"]
        o = df["Open"] if "Open" in df.columns else c
        h = df["High"]
        v = df["Volume"]
        price = float(c.iloc[-1])

        # Look for gap up > 5% in last 5 trading days
        gap_found = False
        gap_day = None
        gap_pct = 0

        for i in range(-5, 0):
            prev_close = float(c.iloc[i - 1])
            day_open = float(o.iloc[i])
            gap = ((day_open - prev_close) / prev_close * 100) if prev_close > 0 else 0

            # Also check for massive volume (earnings proxy)
            vol_avg = float(v.iloc[-50:].mean()) if len(v) >= 50 else float(v.mean())
            day_vol = float(v.iloc[i])
            vol_spike = day_vol / vol_avg if vol_avg > 0 else 1.0

            if gap > 5 and vol_spike > 2.0:
                gap_found = True
                gap_day = i
                gap_pct = gap
                break

        if not gap_found or gap_day is None:
            return None

        # Price must have reversed: now below the gap day's close
        gap_close = float(c.iloc[gap_day])
        gap_high = float(h.iloc[gap_day])
        faded = price < gap_close * 0.98

        if not faded:
            return None

        confidence = 45
        if gap_pct > 15: confidence += 10
        elif gap_pct > 10: confidence += 7
        elif gap_pct > 5: confidence += 4

        # How much has it faded?
        fade_pct = ((gap_high - price) / gap_high * 100) if gap_high > 0 else 0
        if fade_pct > 10: confidence += 10
        elif fade_pct > 5: confidence += 5

        if rs < 50: confidence += 5
        if phase in ("Red Light", "Wedge", "Extension"): confidence += 5

        rsi = technicals.get("rsi", 50)
        if rsi < 50: confidence += 5

        confidence = min(confidence, 85)

        stop = round(gap_high * 1.02, 2)
        # Target: gap fill (pre-gap close)
        pre_gap_close = float(c.iloc[gap_day - 1])
        target1 = round(pre_gap_close, 2)
        target2 = round(pre_gap_close * 0.95, 2)

        return {
            "setup_type": "EARNINGS_GAP_FADE",
            "confidence": confidence,
            "entry": round(price, 2),
            "stop": stop,
            "target1": target1,
            "target2": target2,
            "thesis": (
                f"Earnings gap fade — {gap_pct:.1f}% gap up failed, "
                f"price faded {fade_pct:.1f}% from gap high. "
                f"Gap fill target at ${pre_gap_close:.2f}."
            ),
            "conditions": {
                "gap_up_5pct_plus": gap_pct >= 5,
                "volume_spike_on_gap": True,
                "price_faded_below_gap_close": faded,
                "bearish_follow_through": fade_pct > 3,
                "rs_weak": rs < 50,
            },
            "gap_pct": round(gap_pct, 1),
            "fade_pct": round(fade_pct, 1),
        }
    except Exception as e:
        log.warning(f"detect_earnings_gap_fade: {e}")
        return None


# ─────────────────────────────────────────────
# MASTER: DETECT ALL SHORT SETUPS
# ─────────────────────────────────────────────
def detect_all_short_setups(ticker, df, wein, rs, phase, finra_data, technicals, sr_levels, fund):
    """
    Run all 6 short setup detectors and return list of detected setups
    sorted by confidence (highest first).
    """
    setups = []
    detectors = [
        detect_stage4_breakdown,
        detect_failed_breakout,
        detect_distribution_top,
        detect_parabolic_exhaustion,
        detect_ema_rejection,
        detect_earnings_gap_fade,
    ]

    for detector in detectors:
        try:
            result = detector(df, wein, rs, phase, finra_data, technicals, sr_levels)
            if result:
                result["ticker"] = ticker
                # Add fundamental context
                if fund:
                    if fund.get("eps", 0) < 0:
                        result["confidence"] = min(result["confidence"] + 3, 95)
                    if fund.get("rev", 0) < 0:
                        result["confidence"] = min(result["confidence"] + 2, 95)
                setups.append(result)
        except Exception as e:
            log.warning(f"Short detector error for {ticker}: {e}")

    # Sort by confidence descending
    setups.sort(key=lambda s: s.get("confidence", 0), reverse=True)
    return setups
