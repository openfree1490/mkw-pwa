"""
Qullamaggie Indicators — Technical indicators needed for momentum setups.
ADR, volume surge, consecutive days, extension from MAs, consolidation detection.
"""

import logging
import pandas as pd
import numpy as np

log = logging.getLogger("mkw.indicators")


def calculate_qullamaggie_indicators(daily_df):
    """
    Calculate all indicators needed for Qullamaggie momentum setups.
    Returns a copy of the DataFrame with additional indicator columns.
    """
    if daily_df is None or len(daily_df) < 20:
        return daily_df

    try:
        df = daily_df.copy()
        close = df['Close']
        high = df['High']
        low = df['Low']
        volume = df['Volume']

        # ── Moving Averages ──
        df['SMA_10'] = close.rolling(10).mean()
        df['SMA_20'] = close.rolling(20).mean()
        df['EMA_10'] = close.ewm(span=10).mean()
        df['EMA_20'] = close.ewm(span=20).mean()

        # ── ATR (Average True Range, 14-period) ──
        tr = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs()
        ], axis=1).max(axis=1)
        df['ATR_14'] = tr.rolling(14).mean()

        # ── ADR% (Average Daily Range as % of price) ──
        df['ADR_pct'] = (high - low) / close * 100
        df['ADR_5d'] = df['ADR_pct'].rolling(5).mean()
        df['ADR_20d'] = df['ADR_pct'].rolling(20).mean()
        df['ADR_contracting'] = df['ADR_5d'] < df['ADR_20d']

        # ── Gap % (today's open vs yesterday's close) ──
        df['Gap_pct'] = (df['Open'] - close.shift(1)) / close.shift(1) * 100

        # ── Volume Surge Detection ──
        df['Vol_50d_avg'] = volume.rolling(50).mean()
        df['Vol_ratio'] = volume / df['Vol_50d_avg'].replace(0, np.nan)
        df['Vol_surge'] = df['Vol_ratio'] > 1.5
        df['Vol_climax'] = df['Vol_ratio'] > 3

        # ── Consecutive Up/Down Days Counter ──
        changes = close.diff()
        up_streak = []
        down_streak = []
        u, d = 0, 0
        for chg in changes:
            if pd.isna(chg):
                up_streak.append(0)
                down_streak.append(0)
                continue
            if chg > 0:
                u += 1
                d = 0
            elif chg < 0:
                d += 1
                u = 0
            else:
                u = 0
                d = 0
            up_streak.append(u)
            down_streak.append(d)
        df['Consecutive_up'] = up_streak
        df['Consecutive_down'] = down_streak

        # ── Prior Move % (multi-period lookback) ──
        df['Move_21d_pct'] = close.pct_change(21) * 100
        df['Move_42d_pct'] = close.pct_change(42) * 100
        df['Move_63d_pct'] = close.pct_change(63) * 100

        # ── Extension from MAs ──
        df['Ext_from_10SMA'] = (close - df['SMA_10']) / df['SMA_10'] * 100
        df['Ext_from_20SMA'] = (close - df['SMA_20']) / df['SMA_20'] * 100

        # ── Consolidation Range (10-bar high/low) ──
        df['Consol_high_10'] = high.rolling(10).max()
        df['Consol_low_10'] = low.rolling(10).min()
        df['Consol_range_pct'] = (df['Consol_high_10'] - df['Consol_low_10']) / close * 100

        return df
    except Exception as e:
        log.warning(f"calculate_qullamaggie_indicators error: {e}")
        return daily_df


def get_qullamaggie_snapshot(daily_df):
    """
    Return a dict snapshot of the latest Qullamaggie indicator values.
    Useful for API responses without returning the full DataFrame.
    """
    df = calculate_qullamaggie_indicators(daily_df)
    if df is None or len(df) < 20:
        return {}

    try:
        last = df.iloc[-1]
        return {
            'sma_10': _safe_round(last.get('SMA_10')),
            'sma_20': _safe_round(last.get('SMA_20')),
            'ema_10': _safe_round(last.get('EMA_10')),
            'ema_20': _safe_round(last.get('EMA_20')),
            'atr_14': _safe_round(last.get('ATR_14')),
            'adr_pct': _safe_round(last.get('ADR_pct'), 2),
            'adr_5d': _safe_round(last.get('ADR_5d'), 2),
            'adr_20d': _safe_round(last.get('ADR_20d'), 2),
            'adr_contracting': bool(last.get('ADR_contracting', False)),
            'gap_pct': _safe_round(last.get('Gap_pct'), 2),
            'vol_ratio': _safe_round(last.get('Vol_ratio'), 1),
            'vol_surge': bool(last.get('Vol_surge', False)),
            'vol_climax': bool(last.get('Vol_climax', False)),
            'consecutive_up': int(last.get('Consecutive_up', 0)),
            'consecutive_down': int(last.get('Consecutive_down', 0)),
            'move_21d_pct': _safe_round(last.get('Move_21d_pct'), 1),
            'move_42d_pct': _safe_round(last.get('Move_42d_pct'), 1),
            'move_63d_pct': _safe_round(last.get('Move_63d_pct'), 1),
            'ext_from_10sma': _safe_round(last.get('Ext_from_10SMA'), 1),
            'ext_from_20sma': _safe_round(last.get('Ext_from_20SMA'), 1),
            'consol_high_10': _safe_round(last.get('Consol_high_10')),
            'consol_low_10': _safe_round(last.get('Consol_low_10')),
            'consol_range_pct': _safe_round(last.get('Consol_range_pct'), 1),
        }
    except Exception as e:
        log.warning(f"get_qullamaggie_snapshot error: {e}")
        return {}


def _safe_round(val, decimals=2):
    """Safely round a value, handling NaN/None."""
    if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
        return 0.0
    try:
        return round(float(val), decimals)
    except (TypeError, ValueError):
        return 0.0
