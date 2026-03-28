"""
Qullamaggie Trade Rules Engine
Entry/stop/exit plan generation for Breakouts, Parabolic Shorts, and Episodic Pivots.
"""

import logging

log = logging.getLogger("mkw.trade_rules")


def generate_trade_plan(setup_type, setup_data, current_price, atr):
    """
    Generate complete entry/stop/exit plan for each Qullamaggie setup.
    Returns a trade plan dict with all management rules.
    """
    if current_price <= 0 or atr <= 0:
        return None

    if setup_type == 'BREAKOUT':
        return _breakout_plan(setup_data, current_price, atr)
    elif setup_type == 'PARABOLIC_SHORT':
        return _parabolic_short_plan(setup_data, current_price, atr)
    elif setup_type == 'PARABOLIC_LONG':
        return _parabolic_long_plan(setup_data, current_price, atr)
    elif setup_type == 'EPISODIC_PIVOT':
        return _ep_plan(setup_data, current_price, atr)
    else:
        return None


def _breakout_plan(setup_data, current_price, atr):
    """Breakout trade plan: buy on range expansion, stop at day lows / 1x ATR."""
    entry = setup_data.get('consolidation_high', current_price)

    # Stop: day low or 1x ATR, whichever is tighter
    day_low = setup_data.get('day_low', current_price - atr)
    initial_stop = max(current_price - atr, day_low)
    stop_distance = current_price - initial_stop

    # Ensure stop not wider than 1.5x ATR
    if stop_distance > atr * 1.5:
        initial_stop = current_price - atr
        stop_distance = atr

    stop_pct = (stop_distance / current_price) * 100

    # R-multiple targets
    risk = stop_distance
    target_3r = current_price + (risk * 3)
    target_5r = current_price + (risk * 5)
    target_10r = current_price + (risk * 10)
    target_20r = current_price + (risk * 20)

    sma_10 = setup_data.get('sma_10', current_price)
    sma_20 = setup_data.get('sma_20', current_price)

    return {
        'setup_type': 'BREAKOUT',
        'entry_price': round(entry, 2),
        'entry_trigger': f"Buy on break above ${entry:.2f} with volume > 1.5x average",
        'initial_stop': round(initial_stop, 2),
        'stop_distance': round(stop_distance, 2),
        'stop_pct': round(stop_pct, 1),
        'stop_rule': f"Stop at ${initial_stop:.2f} (low of day or 1x ATR, whichever is tighter)",
        'management': [
            f"Days 1-2: Hold full position. Stop at ${initial_stop:.2f}",
            f"Days 3-5: Sell 1/3 to 1/2 of position. Move stop to breakeven (${entry:.2f})",
            f"Remaining: Trail with 10-day SMA (${sma_10:.2f}). If closes below, exit.",
            "Extended move: Switch trail to 20-day SMA for wider hold",
        ],
        'targets': {
            '3R': round(target_3r, 2),
            '5R': round(target_5r, 2),
            '10R': round(target_10r, 2),
            '20R': round(target_20r, 2),
        },
        'risk_reward': {
            '3R_ratio': '3:1',
            '5R_ratio': '5:1',
            '10R_ratio': '10:1',
            '20R_ratio': '20:1 (trail for this)',
        },
        'risk_per_share': round(risk, 2),
        'position_size_note': "Size so that if stopped out, loss = 0.5-1% of portfolio",
    }


def _parabolic_short_plan(setup_data, current_price, atr):
    """Parabolic short: short on first crack, stop above high."""
    entry = current_price

    # Stop above the parabolic high
    recent_high = setup_data.get('recent_high', current_price * 1.05)
    initial_stop = recent_high * 1.01
    stop_distance = initial_stop - current_price

    # Targets: 10 and 20 day SMAs
    target_10sma = setup_data.get('sma_10', current_price * 0.9)
    target_20sma = setup_data.get('sma_20', current_price * 0.85)

    reward_1 = current_price - target_10sma
    risk = stop_distance
    rr_1 = reward_1 / risk if risk > 0 else 0

    return {
        'setup_type': 'PARABOLIC_SHORT',
        'entry_price': round(entry, 2),
        'entry_trigger': "Short on opening range lows or first fail at VWAP. Wait for first crack.",
        'initial_stop': round(initial_stop, 2),
        'stop_distance': round(stop_distance, 2),
        'stop_rule': f"Stop above parabolic high at ${initial_stop:.2f}",
        'management': [
            f"Target 1: 10-day SMA at ${target_10sma:.2f} — cover 1/2",
            f"Target 2: 20-day SMA at ${target_20sma:.2f} — cover remaining",
            "If stock reclaims VWAP after entry, exit immediately",
        ],
        'targets': {
            '10SMA': round(target_10sma, 2),
            '20SMA': round(target_20sma, 2),
        },
        'risk_reward': f"{rr_1:.1f}:1 to 10 SMA (typically 5-10x R/R)",
        'risk_per_share': round(risk, 2),
        'win_rate_note': "Higher win rate than breakouts (50-60%) but capped upside. Quick trades.",
    }


def _parabolic_long_plan(setup_data, current_price, atr):
    """Parabolic long bounce: buy oversold snap-back."""
    entry = current_price

    # Stop below the capitulation low
    initial_stop = current_price - atr * 1.5
    stop_distance = current_price - initial_stop

    target_10sma = setup_data.get('sma_10', current_price * 1.1)
    target_20sma = setup_data.get('sma_20', current_price * 1.15)

    reward_1 = target_10sma - current_price
    risk = stop_distance
    rr_1 = reward_1 / risk if risk > 0 else 0

    return {
        'setup_type': 'PARABOLIC_LONG',
        'entry_price': round(entry, 2),
        'entry_trigger': "Buy on first green day after 3+ consecutive down days with capitulation volume.",
        'initial_stop': round(initial_stop, 2),
        'stop_distance': round(stop_distance, 2),
        'stop_rule': f"Stop at ${initial_stop:.2f} (1.5x ATR below entry)",
        'management': [
            f"Target 1: 10-day SMA at ${target_10sma:.2f} — sell 1/2",
            f"Target 2: 20-day SMA at ${target_20sma:.2f} — sell remaining",
            "Quick trade — mean reversion, not trend following",
        ],
        'targets': {
            '10SMA': round(target_10sma, 2),
            '20SMA': round(target_20sma, 2),
        },
        'risk_reward': f"{rr_1:.1f}:1 to 10 SMA",
        'risk_per_share': round(risk, 2),
    }


def _ep_plan(setup_data, current_price, atr):
    """Episodic Pivot: buy on opening range highs, stop at EP day lows, trail wide."""
    entry = current_price

    # Stop at EP day lows
    ep_day_low = setup_data.get('day_low', current_price * 0.95)
    initial_stop = ep_day_low
    stop_distance = current_price - initial_stop
    stop_pct = (stop_distance / current_price) * 100

    risk = stop_distance
    target_3r = current_price + (risk * 3)
    target_5r = current_price + (risk * 5)

    return {
        'setup_type': 'EPISODIC_PIVOT',
        'entry_price': round(entry, 2),
        'entry_trigger': "Buy on opening range highs. Must have 10%+ gap AND 3x+ volume.",
        'initial_stop': round(initial_stop, 2),
        'stop_distance': round(stop_distance, 2),
        'stop_pct': round(stop_pct, 1),
        'stop_rule': f"Stop at EP day lows ${initial_stop:.2f}",
        'management': [
            f"Days 1-3: Hold full position. Stop at EP day low ${initial_stop:.2f}",
            "Days 3-5: Sell 1/3 on strength. Move stop to breakeven.",
            "Trail remaining with 10-day SMA. EPs can run for months.",
            "If stock bases constructively above 20-day SMA, add on breakout of that base.",
        ],
        'targets': {
            '3R': round(target_3r, 2),
            '5R': round(target_5r, 2),
            'trail': "10-day SMA trailing — let it run",
        },
        'risk_per_share': round(risk, 2),
        'ep_note': "EPs can trigger multi-month or multi-year moves. Trail wide. Be patient.",
    }


def calculate_r_multiple(entry_price, exit_price, stop_price, direction="LONG"):
    """Calculate the R-multiple achieved on a closed trade."""
    if entry_price <= 0 or stop_price <= 0:
        return 0

    risk = abs(entry_price - stop_price)
    if risk == 0:
        return 0

    if direction == "LONG":
        profit = exit_price - entry_price
    else:
        profit = entry_price - exit_price

    return round(profit / risk, 2)
