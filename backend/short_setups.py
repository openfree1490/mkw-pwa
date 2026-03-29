"""
MKW Short Setup Detection Engine
6 systematic short setup detectors for institutional-grade short identification.
Each returns a dict with: detected, type, confidence, entry, stop, target, reason, signals
"""

import logging
import numpy as np
import pandas as pd

log = logging.getLogger("mkw.short_setups")


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _safe_float(series, idx=-1):
    try:
        return float(series.iloc[idx])
    except Exception:
        return 0.0


def _sma(series, window):
    return series.rolling(window).mean()


def _ema(series, span):
    return series.ewm(span=span, adjust=False).mean()


def _avg_volume(vol, window=50):
    if len(vol) < window:
        return float(vol.mean()) if len(vol) > 0 else 1.0
    return float(vol.tail(window).mean())


def _rsi(close, period=14):
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, adjust=False).mean()
    avg_loss = loss.ewm(com=period - 1, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _empty_result(setup_type):
    return {
        "detected": False,
        "type": setup_type,
        "confidence": 0,
        "entry": 0.0,
        "stop": 0.0,
        "target": 0.0,
        "reason": "",
        "signals": [],
    }


# ─────────────────────────────────────────────
# SETUP 1: STAGE 4 BREAKDOWN
# ─────────────────────────────────────────────

def detect_stage4_breakdown(df, wein, rs, phase, finra_data, technicals, sr_levels):
    """
    Stock confirmed in Weinstein Stage 4 (price below declining 150 SMA).
    Entry on rally to declining 50 SMA that fails. Stop above the 50 SMA.
    Target: prior support or 200 SMA below.
    """
    result = _empty_result("STAGE_4_BREAKDOWN")
    try:
        if len(df) < 200:
            return result

        c = df["Close"]
        h = df["High"]
        vol = df["Volume"]
        price = _safe_float(c)

        stage = wein.get("stage", "?")
        if stage not in ("4A", "4B"):
            return result

        sma50 = _safe_float(_sma(c, 50))
        sma150 = _safe_float(_sma(c, 150))
        sma200 = _safe_float(_sma(c, 200))

        # Check SMA 150 declining
        sma150_10ago = _safe_float(_sma(c, 150), -11)
        sma150_declining = sma150 < sma150_10ago

        if not (price < sma150 and sma150_declining):
            return result

        # Check for recent rally attempt to SMA 50 that reversed
        # Look for price that touched/approached 50 SMA in last 15 bars then fell back
        sma50_series = _sma(c, 50)
        rally_to_50 = False
        for i in range(-15, -1):
            if abs(i) >= len(c):
                continue
            bar_high = _safe_float(h, i)
            bar_sma50 = _safe_float(sma50_series, i)
            if bar_sma50 > 0 and bar_high >= bar_sma50 * 0.98:
                # Price reached near the 50 SMA
                if price < bar_sma50 * 0.97:
                    # And has since fallen back below
                    rally_to_50 = True
                    break

        if not rally_to_50:
            return result

        # Compute inverse template score
        inv_criteria = [
            price < sma50, price < sma150, price < sma200,
            sma50 < sma150,
            sma150 < sma200,
        ]
        sma200_20ago = _safe_float(_sma(c, 200), -21)
        inv_criteria.append(sma200 < sma200_20ago)
        high52 = float(h.rolling(252).max().iloc[-1]) if len(h) >= 252 else float(h.max())
        inv_criteria.append(price <= high52 * 0.75)
        inv_criteria.append(rs <= 30)
        inv_score = sum(inv_criteria)

        if inv_score < 5:
            return result

        # Entry, stop, target
        entry = round(price, 2)
        stop = round(sma50 * 1.02, 2)  # 2% above 50 SMA

        # Target: find nearest support below or use 200 SMA below
        target = None
        if sr_levels:
            supports_below = [l for l in sr_levels
                              if isinstance(l, dict) and l.get("price", 0) < price * 0.95]
            if not supports_below:
                supports_below = [l for l in sr_levels
                                  if isinstance(l, (int, float)) and l < price * 0.95]
            if supports_below:
                if isinstance(supports_below[0], dict):
                    target = round(supports_below[0]["price"], 2)
                else:
                    target = round(supports_below[0], 2)

        if target is None:
            # Use a measured move target: entry - (stop - entry) * 2
            risk = stop - entry
            target = round(entry - risk * 2, 2)

        target = max(target, 0.01)

        # Confidence scoring
        confidence = 60
        signals = [f"Stage {stage}", f"Inverse TPL {inv_score}/8", f"Rally to 50 SMA failed"]

        if inv_score >= 7:
            confidence += 10
            signals.append("Strong inverse template (7+/8)")
        if rs < 25:
            confidence += 10
            signals.append(f"Very weak RS ({rs})")

        avg_vol = _avg_volume(vol)
        recent_vol = _safe_float(vol)
        if avg_vol > 0 and recent_vol > avg_vol * 1.5:
            confidence += 10
            signals.append(f"Breakdown volume {recent_vol / avg_vol:.1f}x avg")

        confidence = min(confidence, 95)

        reason = (f"Stage {stage} confirmed — price below declining 150 SMA. "
                  f"Rally to 50 SMA ({sma50:.2f}) failed and reversed. "
                  f"Inverse template {inv_score}/8, RS {rs}.")

        result.update({
            "detected": True,
            "confidence": confidence,
            "entry": entry,
            "stop": stop,
            "target": target,
            "reason": reason,
            "signals": signals,
        })
    except Exception as e:
        log.warning(f"detect_stage4_breakdown: {e}")

    return result


# ─────────────────────────────────────────────
# SETUP 2: FAILED BREAKOUT
# ─────────────────────────────────────────────

def detect_failed_breakout(df, wein, rs, phase, finra_data, technicals, sr_levels):
    """
    Stock attempted to break above resistance/pivot but reversed on volume. Bull trap.
    """
    result = _empty_result("FAILED_BREAKOUT")
    try:
        if len(df) < 50:
            return result

        c = df["Close"]
        h = df["High"]
        vol = df["Volume"]
        price = _safe_float(c)

        # Find resistance level
        resistance = None
        if sr_levels:
            for lvl in sr_levels:
                p = lvl.get("price", lvl) if isinstance(lvl, dict) else lvl
                if isinstance(p, (int, float)) and p > price:
                    resistance = float(p)
                    break

        if resistance is None:
            # Use recent 20-day high as proxy
            resistance = float(h.tail(20).max())

        # Check: recent high within 2% of resistance
        recent_high = float(h.tail(10).max())
        if resistance > 0 and abs(recent_high - resistance) / resistance > 0.02:
            # Also check if high breached resistance
            if recent_high < resistance * 0.98:
                return result

        # Current price > 3% below that high
        if recent_high > 0 and (recent_high - price) / recent_high < 0.03:
            return result

        # Price now below the breakout level
        if price > resistance:
            return result

        # Volume on reversal
        avg_vol = _avg_volume(vol)
        # Find the day of the high and check volume
        high_idx = h.tail(10).idxmax()
        reversal_vol = float(vol.loc[high_idx]) if high_idx in vol.index else avg_vol

        if avg_vol > 0 and reversal_vol < avg_vol * 1.3:
            return result

        # Entry, stop, target
        entry = round(price, 2)
        stop = round(recent_high * 1.02, 2)
        risk = stop - entry
        target = round(max(0.01, entry - risk * 2.5), 2)

        # Confidence scoring
        confidence = 55
        signals = [f"Failed breakout at {resistance:.2f}", f"Reversed {((recent_high - price) / recent_high * 100):.1f}% from high"]

        vol_ratio = reversal_vol / avg_vol if avg_vol > 0 else 1.0
        if vol_ratio > 2.0:
            confidence += 15
            signals.append(f"Heavy reversal volume ({vol_ratio:.1f}x)")

        # RS declining
        if rs < 50 and wein.get("stage", "2A") not in ("1", "2A", "2B"):
            confidence += 10
            signals.append(f"RS declining ({rs})")

        # Stage transitioning from 2B to 3
        stage = wein.get("stage", "?")
        if stage in ("2B", "3"):
            confidence += 10
            signals.append(f"Stage {stage} — distribution phase")

        confidence = min(confidence, 95)

        reason = (f"Failed breakout — price reached {recent_high:.2f} near resistance "
                  f"({resistance:.2f}) but reversed on {vol_ratio:.1f}x volume. "
                  f"Now {((recent_high - price) / recent_high * 100):.1f}% below the high. Bull trap.")

        result.update({
            "detected": True,
            "confidence": confidence,
            "entry": entry,
            "stop": stop,
            "target": target,
            "reason": reason,
            "signals": signals,
        })
    except Exception as e:
        log.warning(f"detect_failed_breakout: {e}")

    return result


# ─────────────────────────────────────────────
# SETUP 3: DISTRIBUTION TOP
# ─────────────────────────────────────────────

def detect_distribution_top(df, wein, rs, phase, finra_data, technicals, sr_levels):
    """
    Stage 3 distribution pattern. Wide and loose with increasing volume on down days.
    """
    result = _empty_result("DISTRIBUTION_TOP")
    try:
        if len(df) < 50:
            return result

        c = df["Close"]
        h = df["High"]
        vol = df["Volume"]
        price = _safe_float(c)

        stage = wein.get("stage", "?")
        if stage != "3":
            return result

        # Down-volume > up-volume ratio over last 10 days
        recent = df.tail(10)
        up_vol = 0
        down_vol = 0
        for i in range(1, len(recent)):
            if float(recent["Close"].iloc[i]) < float(recent["Close"].iloc[i - 1]):
                down_vol += float(recent["Volume"].iloc[i])
            else:
                up_vol += float(recent["Volume"].iloc[i])

        if up_vol > 0 and down_vol / max(up_vol, 1) < 1.1:
            return result

        # ADX declining
        adx = technicals.get("adx", 25)

        # Lower highs check (last 20 bars)
        highs_10 = df.tail(20)
        first_half_high = float(highs_10["High"].iloc[:10].max())
        second_half_high = float(highs_10["High"].iloc[10:].max())
        lower_highs = second_half_high < first_half_high

        if not lower_highs:
            return result

        # Entry, stop, target
        recent_high = float(h.tail(20).max())
        entry = round(price, 2)
        stop = round(recent_high * 1.02, 2)
        risk = stop - entry
        target = round(max(0.01, entry - risk * 2), 2)

        # Confidence scoring
        confidence = 50
        signals = [f"Stage 3 distribution", "Down-volume > up-volume", "Lower highs forming"]

        # FINRA SVR check
        svr = finra_data.get("svr_today")
        svr_trend = finra_data.get("svr_trend", "UNKNOWN")
        if svr and svr > 55 and svr_trend == "RISING":
            confidence += 15
            signals.append(f"FINRA SVR {svr}% and rising")

        # Institutional selling signal (SVR spike)
        if finra_data.get("svr_spike"):
            confidence += 10
            signals.append("SVR spike — institutional selling")

        # EMA stack breaking down (10 EMA crossing below 20 EMA)
        ema10 = _safe_float(_ema(c, 10))
        ema20 = _safe_float(_ema(c, 20))
        if ema10 < ema20:
            confidence += 10
            signals.append("10 EMA below 20 EMA — bearish crossover")

        if adx < 20:
            signals.append(f"ADX declining ({adx:.0f})")

        confidence = min(confidence, 95)

        vol_ratio = down_vol / max(up_vol, 1)
        reason = (f"Stage 3 distribution — down-volume {vol_ratio:.1f}x up-volume over 10 days. "
                  f"Lower highs forming. "
                  + (f"FINRA SVR {svr}% ({svr_trend}). " if svr else "")
                  + f"RS {rs}.")

        result.update({
            "detected": True,
            "confidence": confidence,
            "entry": entry,
            "stop": stop,
            "target": target,
            "reason": reason,
            "signals": signals,
        })
    except Exception as e:
        log.warning(f"detect_distribution_top: {e}")

    return result


# ─────────────────────────────────────────────
# SETUP 4: PARABOLIC EXHAUSTION
# ─────────────────────────────────────────────

def detect_parabolic_exhaustion(df, wein, rs, phase, finra_data, technicals, sr_levels):
    """
    Massive run-up (>50% in 21 days) now showing reversal signals.
    Extension from 10 SMA > 15%.
    """
    result = _empty_result("PARABOLIC_EXHAUSTION")
    try:
        if len(df) < 30:
            return result

        c = df["Close"]
        h = df["High"]
        lo = df["Low"]
        vol = df["Volume"]
        price = _safe_float(c)

        # 21-day move > 50%
        if len(c) < 22:
            return result
        price_21ago = _safe_float(c, -22)
        if price_21ago <= 0:
            return result
        move_21d = ((price - price_21ago) / price_21ago) * 100

        if move_21d < 50:
            return result

        # Extension from 10 SMA > 15%
        sma10 = _safe_float(_sma(c, 10))
        if sma10 <= 0:
            return result
        extension = ((price - sma10) / sma10) * 100

        if extension < 15:
            return result

        # RSI > 75
        rsi_series = _rsi(c)
        rsi_val = _safe_float(rsi_series)
        if rsi_val < 75:
            return result

        # Volume declining on last push (3 consecutive declining volume on up days)
        vol_declining = False
        if len(vol) >= 5:
            last5_vol = [float(vol.iloc[i]) for i in range(-5, 0)]
            # Check if volume is generally declining
            if last5_vol[-1] < last5_vol[0] * 0.8:
                vol_declining = True

        # Reversal candle: close in lower third of range
        last_bar = df.iloc[-1]
        bar_range = float(last_bar["High"]) - float(last_bar["Low"])
        if bar_range > 0:
            close_position = (float(last_bar["Close"]) - float(last_bar["Low"])) / bar_range
            reversal_candle = close_position < 0.33
        else:
            reversal_candle = False

        if not (vol_declining or reversal_candle):
            return result

        # Entry, stop, target
        entry = round(price, 2)
        recent_high = float(h.tail(5).max())
        stop = round(recent_high * 1.03, 2)
        target = round(sma10, 2)  # First target is the 10 SMA

        # Confidence scoring
        confidence = 65
        signals = [
            f"Parabolic move +{move_21d:.0f}% in 21 days",
            f"Extended {extension:.0f}% from 10 SMA",
            f"RSI {rsi_val:.0f}",
        ]

        if extension > 25:
            confidence += 10
            signals.append(f"Extreme extension ({extension:.0f}%)")

        # Volume divergence: price higher but volume lower for 3+ days
        if vol_declining:
            confidence += 10
            signals.append("Volume divergence — declining on rally")

        if reversal_candle:
            signals.append("Reversal candle — close in lower third")

        confidence = min(confidence, 95)

        reason = (f"Parabolic exhaustion — +{move_21d:.0f}% in 21 days, "
                  f"extended {extension:.0f}% from 10 SMA. RSI {rsi_val:.0f}. "
                  + ("Volume divergence. " if vol_declining else "")
                  + ("Reversal candle. " if reversal_candle else "")
                  + "Mean reversion short setup.")

        result.update({
            "detected": True,
            "confidence": confidence,
            "entry": entry,
            "stop": stop,
            "target": target,
            "reason": reason,
            "signals": signals,
        })
    except Exception as e:
        log.warning(f"detect_parabolic_exhaustion: {e}")

    return result


# ─────────────────────────────────────────────
# SETUP 5: EMA REJECTION SHORT
# ─────────────────────────────────────────────

def detect_ema_rejection(df, wein, rs, phase, finra_data, technicals, sr_levels):
    """
    Price rallied to declining key EMA (21 or 50) and got rejected. Bear flag continuation.
    """
    result = _empty_result("EMA_REJECTION_SHORT")
    try:
        if len(df) < 55:
            return result

        c = df["Close"]
        h = df["High"]
        vol = df["Volume"]
        price = _safe_float(c)

        stage = wein.get("stage", "?")
        if stage not in ("3", "4A"):
            return result

        ema21 = _ema(c, 21)
        ema50 = _ema(c, 50)
        ema21_now = _safe_float(ema21)
        ema50_now = _safe_float(ema50)

        # Check EMAs are declining
        ema21_10ago = _safe_float(ema21, -11)
        ema50_10ago = _safe_float(ema50, -11)
        ema21_declining = ema21_now < ema21_10ago
        ema50_declining = ema50_now < ema50_10ago

        # Find which EMA was rejected
        rejected_ema = None
        rejected_ema_value = 0

        if ema21_declining:
            # Check if price touched 21 EMA (within 1%) then closed below
            for i in range(-5, -1):
                if abs(i) >= len(h):
                    continue
                bar_high = _safe_float(h, i)
                bar_ema = _safe_float(ema21, i)
                if bar_ema > 0 and bar_high >= bar_ema * 0.99 and price < bar_ema * 0.99:
                    rejected_ema = "21 EMA"
                    rejected_ema_value = ema21_now
                    break

        if rejected_ema is None and ema50_declining:
            for i in range(-5, -1):
                if abs(i) >= len(h):
                    continue
                bar_high = _safe_float(h, i)
                bar_ema = _safe_float(ema50, i)
                if bar_ema > 0 and bar_high >= bar_ema * 0.99 and price < bar_ema * 0.99:
                    rejected_ema = "50 EMA"
                    rejected_ema_value = ema50_now
                    break

        if rejected_ema is None:
            return result

        # Volume on rejection day > 1.2x avg
        avg_vol = _avg_volume(vol)
        today_vol = _safe_float(vol)
        if avg_vol > 0 and today_vol < avg_vol * 1.2:
            # Check prior days for the rejection volume
            has_vol_confirmation = False
            for i in range(-5, 0):
                if abs(i) >= len(vol):
                    continue
                v = _safe_float(vol, i)
                if v > avg_vol * 1.2:
                    has_vol_confirmation = True
                    break
            if not has_vol_confirmation:
                return result

        # Entry, stop, target
        entry = round(price, 2)
        stop = round(rejected_ema_value * 1.02, 2)
        risk = stop - entry
        target = round(max(0.01, entry - risk * 2.5), 2)

        # Confidence scoring
        confidence = 55
        signals = [f"Rejected at declining {rejected_ema}", f"Stage {stage}"]

        if rs < 35:
            confidence += 10
            signals.append(f"Weak RS ({rs})")

        # Check if prior day was up on weak volume (trap)
        if len(c) >= 2 and len(vol) >= 2:
            prev_up = _safe_float(c, -2) < _safe_float(c, -1) if len(c) > 1 else False
            # Use -2 for yesterday's volume
            prev_vol = _safe_float(vol, -2)
            if prev_up and avg_vol > 0 and prev_vol < avg_vol * 0.8:
                confidence += 10
                signals.append("Prior up day on weak volume (trap)")

        # Multiple EMA rejections in past 20 days
        rejection_count = 0
        for i in range(-20, -5):
            if abs(i) >= len(h):
                continue
            bar_h = _safe_float(h, i)
            bar_ema = _safe_float(ema21, i) if rejected_ema == "21 EMA" else _safe_float(ema50, i)
            bar_c = _safe_float(c, i)
            if bar_ema > 0 and bar_h >= bar_ema * 0.99 and bar_c < bar_ema:
                rejection_count += 1

        if rejection_count >= 2:
            confidence += 10
            signals.append(f"Multiple rejections ({rejection_count}x in 20 days)")

        confidence = min(confidence, 95)

        reason = (f"EMA rejection — price rallied to declining {rejected_ema} "
                  f"({rejected_ema_value:.2f}) and got rejected. "
                  f"Stage {stage}, RS {rs}. Bear flag continuation pattern.")

        result.update({
            "detected": True,
            "confidence": confidence,
            "entry": entry,
            "stop": stop,
            "target": target,
            "reason": reason,
            "signals": signals,
        })
    except Exception as e:
        log.warning(f"detect_ema_rejection: {e}")

    return result


# ─────────────────────────────────────────────
# SETUP 6: EARNINGS GAP FADE
# ─────────────────────────────────────────────

def detect_earnings_gap_fade(df, wein, rs, phase, finra_data, technicals, sr_levels):
    """
    Gap down on earnings with huge volume. First bounce/rally is the short entry.
    """
    result = _empty_result("EARNINGS_GAP_FADE")
    try:
        if len(df) < 15:
            return result

        c = df["Close"]
        h = df["High"]
        lo = df["Low"]
        vol = df["Volume"]
        price = _safe_float(c)

        avg_vol = _avg_volume(vol)

        # Find gap down > 5% on volume > 3x avg within last 10 days
        gap_found = False
        gap_idx = None
        gap_level = 0  # The pre-gap close (gap fill level)
        gap_low = 0
        gap_pct = 0
        gap_vol_ratio = 0

        for i in range(-10, -1):
            if abs(i) >= len(c) or abs(i - 1) >= len(c):
                continue
            prev_close = _safe_float(c, i - 1)
            day_open = _safe_float(df["Open"], i) if "Open" in df.columns else _safe_float(h, i)
            day_vol = _safe_float(vol, i)

            if prev_close <= 0:
                continue

            gap = ((day_open - prev_close) / prev_close) * 100
            vol_ratio = day_vol / avg_vol if avg_vol > 0 else 0

            if gap < -5 and vol_ratio > 3:
                gap_found = True
                gap_idx = i
                gap_level = prev_close
                gap_low = _safe_float(lo, i)
                gap_pct = gap
                gap_vol_ratio = vol_ratio
                break

        if not gap_found:
            return result

        # Current price is bouncing (up from gap low) but still below gap level
        if price <= gap_low or price >= gap_level:
            return result

        # RS < 50
        if rs >= 50:
            return result

        # Entry, stop, target
        entry = round(price, 2)
        stop = round(gap_level * 1.02, 2)  # Above the gap fill level
        risk = stop - entry
        target = round(max(0.01, gap_low * 0.97), 2)  # Below gap low

        # Confidence scoring
        confidence = 60
        signals = [
            f"Earnings gap down {gap_pct:.0f}% on {gap_vol_ratio:.0f}x volume",
            f"Bouncing but below gap fill ({gap_level:.2f})",
        ]

        if gap_pct < -10:
            confidence += 10
            signals.append(f"Large gap ({gap_pct:.0f}%)")

        # Bounce on low volume
        bounce_vol = _safe_float(vol)
        if avg_vol > 0 and bounce_vol < avg_vol * 0.7:
            confidence += 10
            signals.append(f"Bounce on weak volume ({bounce_vol / avg_vol:.1f}x)")

        # Price rejected at gap fill level
        if gap_level > 0:
            proximity_to_gap = abs(price - gap_level) / gap_level
            if proximity_to_gap < 0.03:
                confidence += 15
                signals.append("Rejecting at gap fill level")

        confidence = min(confidence, 95)

        reason = (f"Earnings gap fade — gapped down {gap_pct:.0f}% on {gap_vol_ratio:.0f}x volume. "
                  f"Bouncing to {price:.2f} but below gap fill at {gap_level:.2f}. "
                  f"RS {rs}. Short the bounce.")

        result.update({
            "detected": True,
            "confidence": confidence,
            "entry": entry,
            "stop": stop,
            "target": target,
            "reason": reason,
            "signals": signals,
        })
    except Exception as e:
        log.warning(f"detect_earnings_gap_fade: {e}")

    return result


# ─────────────────────────────────────────────
# MASTER FUNCTION
# ─────────────────────────────────────────────

ALL_DETECTORS = [
    detect_stage4_breakdown,
    detect_failed_breakout,
    detect_distribution_top,
    detect_parabolic_exhaustion,
    detect_ema_rejection,
    detect_earnings_gap_fade,
]


def detect_all_short_setups(ticker, df, wein, rs, phase, finra_data, technicals, sr_levels, fund):
    """
    Run all 6 short detectors. Return list of detected setups sorted by confidence.

    Parameters:
        ticker: str — stock symbol
        df: pd.DataFrame — OHLCV data
        wein: dict — Weinstein stage info
        rs: int — relative strength rating
        phase: str — Kell phase
        finra_data: dict — FINRA short volume analysis
        technicals: dict — technical indicators
        sr_levels: list — support/resistance levels
        fund: dict — fundamental data

    Returns:
        list of detected setup dicts sorted by confidence (highest first)
    """
    detected = []

    for detector in ALL_DETECTORS:
        try:
            result = detector(df, wein, rs, phase, finra_data, technicals, sr_levels)
            if result.get("detected"):
                result["ticker"] = ticker
                # Boost confidence for deteriorating fundamentals
                if fund.get("eps", 0) < 0:
                    result["confidence"] = min(95, result["confidence"] + 5)
                    result["signals"].append("Negative EPS growth")
                if fund.get("rev", 0) < 0:
                    result["confidence"] = min(95, result["confidence"] + 3)
                    result["signals"].append("Negative revenue growth")
                detected.append(result)
        except Exception as e:
            log.warning(f"Short detector {detector.__name__} failed for {ticker}: {e}")

    # Sort by confidence descending
    detected.sort(key=lambda x: x["confidence"], reverse=True)

    return detected
