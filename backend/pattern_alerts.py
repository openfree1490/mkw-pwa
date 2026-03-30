"""
MKW Pattern Alert System — Phase 4
Flags setups that are FORMING but not yet triggered.
"""

import logging
import pandas as pd
import numpy as np

log = logging.getLogger("mkw.alerts")


def scan_approaching_ema(df: pd.DataFrame, ticker: str) -> dict:
    """
    Alert: Price within 2% of 10 or 20 EMA in an uptrend.
    """
    if df is None or len(df) < 50:
        return None

    try:
        close = df["Close"]
        price = float(close.iloc[-1])
        ema10 = float(close.ewm(span=10, adjust=False).mean().iloc[-1])
        ema20 = float(close.ewm(span=20, adjust=False).mean().iloc[-1])
        ema50 = float(close.ewm(span=50, adjust=False).mean().iloc[-1])

        # Must be in uptrend (EMA stacking)
        in_uptrend = ema10 > ema20 > ema50

        if not in_uptrend:
            return None

        dist_10 = abs(price - ema10) / price * 100
        dist_20 = abs(price - ema20) / price * 100

        if dist_10 <= 2 and price >= ema10 * 0.98:
            return {
                "type": "approaching_ema",
                "ticker": ticker,
                "title": "Approaching 10 EMA",
                "detail": f"Price ${price:.2f} is {dist_10:.1f}% from 10 EMA (${ema10:.2f})",
                "ema_target": "10 EMA",
                "distance_pct": round(dist_10, 2),
                "urgency": "high" if dist_10 < 1 else "medium",
            }
        elif dist_20 <= 2 and price >= ema20 * 0.98:
            return {
                "type": "approaching_ema",
                "ticker": ticker,
                "title": "Approaching 20 EMA",
                "detail": f"Price ${price:.2f} is {dist_20:.1f}% from 20 EMA (${ema20:.2f})",
                "ema_target": "20 EMA",
                "distance_pct": round(dist_20, 2),
                "urgency": "medium",
            }
    except Exception as e:
        log.warning(f"scan_approaching_ema {ticker}: {e}")

    return None


def scan_volume_drying_up(df: pd.DataFrame, ticker: str) -> dict:
    """
    Alert: Stock in uptrend with pullback volume < 0.7x average for 2+ consecutive days.
    """
    if df is None or len(df) < 55:
        return None

    try:
        close = df["Close"]
        volume = df["Volume"]
        ema20 = float(close.ewm(span=20, adjust=False).mean().iloc[-1])
        price = float(close.iloc[-1])

        # Must be in uptrend
        if price < ema20:
            return None

        vol_50d = float(volume.iloc[-50:].mean())
        if vol_50d <= 0:
            return None

        # Check last 5 days for consecutive low volume
        recent_vol = volume.iloc[-5:]
        consecutive_dry = 0
        for v in recent_vol:
            if float(v) < vol_50d * 0.7:
                consecutive_dry += 1
            else:
                consecutive_dry = 0

        if consecutive_dry >= 2:
            avg_recent = float(recent_vol.iloc[-consecutive_dry:].mean())
            ratio = round(avg_recent / vol_50d, 2)
            return {
                "type": "volume_drying_up",
                "ticker": ticker,
                "title": "Volume Drying Up",
                "detail": f"Pullback volume at {ratio:.2f}x average for {consecutive_dry} consecutive days",
                "dry_days": consecutive_dry,
                "dryup_ratio": ratio,
                "urgency": "high" if ratio < 0.5 else "medium",
            }
    except Exception as e:
        log.warning(f"scan_volume_drying_up {ticker}: {e}")

    return None


def scan_rs_breakout(df: pd.DataFrame, spy_df: pd.DataFrame, ticker: str) -> dict:
    """
    Alert: RS line vs SPY just made a new 3-month high.
    """
    if df is None or spy_df is None or len(df) < 65 or len(spy_df) < 65:
        return None

    try:
        min_len = min(len(df), len(spy_df))
        stock = df["Close"].iloc[-min_len:].values.astype(float)
        spy = spy_df["Close"].iloc[-min_len:].values.astype(float)
        rs_line = stock / np.where(spy > 0, spy, 1.0)

        if len(rs_line) < 63:
            return None

        rs_today = rs_line[-1]
        rs_3m_high = np.max(rs_line[-63:-1])  # Exclude today

        if rs_today > rs_3m_high:
            return {
                "type": "rs_breakout",
                "ticker": ticker,
                "title": "RS Line New 3-Month High",
                "detail": f"Relative strength vs SPY just broke out to new 3-month high",
                "rs_value": round(float(rs_today), 4),
                "prior_high": round(float(rs_3m_high), 4),
                "urgency": "high",
            }
    except Exception as e:
        log.warning(f"scan_rs_breakout {ticker}: {e}")

    return None


def scan_ema_reclaim(df: pd.DataFrame, ticker: str) -> dict:
    """
    Alert: Price crossed above 10 EMA today after being below it.
    Volume confirmation pending.
    """
    if df is None or len(df) < 15:
        return None

    try:
        close = df["Close"]
        volume = df["Volume"]
        ema10 = close.ewm(span=10, adjust=False).mean()

        price_today = float(close.iloc[-1])
        price_yesterday = float(close.iloc[-2])
        ema10_today = float(ema10.iloc[-1])
        ema10_yesterday = float(ema10.iloc[-2])

        # Crossed above today
        crossed_above = price_today > ema10_today and price_yesterday < ema10_yesterday

        if crossed_above:
            vol_today = float(volume.iloc[-1])
            vol_50d = float(volume.iloc[-50:].mean()) if len(volume) >= 50 else float(volume.mean())
            vol_ratio = vol_today / vol_50d if vol_50d > 0 else 0
            vol_confirmed = vol_ratio >= 1.5

            return {
                "type": "ema_reclaim",
                "ticker": ticker,
                "title": "10 EMA Reclaim Attempt",
                "detail": (
                    f"Price crossed above 10 EMA (${ema10_today:.2f}) today. "
                    f"Volume {'CONFIRMED' if vol_confirmed else 'PENDING'} ({vol_ratio:.1f}x avg)."
                ),
                "volume_confirmed": vol_confirmed,
                "volume_ratio": round(vol_ratio, 2),
                "urgency": "high" if vol_confirmed else "medium",
            }
    except Exception as e:
        log.warning(f"scan_ema_reclaim {ticker}: {e}")

    return None


def count_conditions_met(graded_setup: dict) -> int:
    """Count how many of the 6 conditions are already met (scored points)."""
    conditions = graded_setup.get("conditions", {})
    count = 0
    for cond in conditions.values():
        if cond.get("points", 0) > 0:
            count += 1
    return count


def conditions_still_needed(graded_setup: dict) -> list:
    """List which conditions still need to be met."""
    conditions = graded_setup.get("conditions", {})
    needed = []
    cond_labels = {
        "c1_rs_ranking": "RS Ranking",
        "c2_rs_line_behavior": "RS Line Behavior",
        "c3_volume_dryup": "Volume Dry-Up",
        "c4_volume_expansion": "Volume Expansion",
        "c5_adr_range": "ADR% Range",
        "c6_htf_alignment": "HTF Alignment",
    }
    for key, label in cond_labels.items():
        cond = conditions.get(key, {})
        if cond.get("points", 0) == 0:
            needed.append(label)
    return needed


def scan_all_patterns(tickers: list, fetch_ohlcv_fn, spy_df, grade_fn) -> list:
    """
    Scan all tickers for forming patterns.
    Returns list of alerts sorted by urgency and conditions met.
    """
    alerts = []

    for ticker in tickers:
        try:
            df = fetch_ohlcv_fn(ticker, "2y")
            if df is None or len(df) < 60:
                continue

            # Run pattern scans
            alert_fns = [
                lambda: scan_approaching_ema(df, ticker),
                lambda: scan_volume_drying_up(df, ticker),
                lambda: scan_rs_breakout(df, spy_df, ticker),
                lambda: scan_ema_reclaim(df, ticker),
            ]

            ticker_alerts = []
            for fn in alert_fns:
                alert = fn()
                if alert:
                    ticker_alerts.append(alert)

            if ticker_alerts:
                # Get partial score
                graded = grade_fn(df, spy_df, ticker)
                met = count_conditions_met(graded)
                needed = conditions_still_needed(graded)

                for alert in ticker_alerts:
                    alert["conditionsMet"] = met
                    alert["conditionsTotal"] = 6
                    alert["conditionsNeeded"] = needed
                    alert["partialScore"] = graded["composite"]["score"]
                    alerts.append(alert)
        except Exception as e:
            log.warning(f"scan_all_patterns {ticker}: {e}")

    # Sort: high urgency first, then by conditions met
    urgency_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: (urgency_order.get(a.get("urgency", "low"), 2), -a.get("conditionsMet", 0)))
    return alerts
