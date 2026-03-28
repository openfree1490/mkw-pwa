"""
Qullamaggie Momentum Setup Scanner
Three timeless setups: Breakouts, Parabolic Shorts/Longs, Episodic Pivots.
Runs alongside the MKW convergence system as a high-resolution entry timing layer.
"""

import logging
import pandas as pd
import numpy as np

log = logging.getLogger("mkw.qullamaggie")


# ─────────────────────────────────────────────
# SETUP 1: BREAKOUT SCANNER
# ─────────────────────────────────────────────

def scan_breakouts(ticker, daily_df):
    """
    Qullamaggie Breakout Scanner

    Conditions (ALL must be true):
    1. Big prior move: Price gained 30%+ in the past 60 trading days
    2. Orderly pullback: After the move, price pulled back 10-35% from high
    3. Higher lows: At least 2 higher lows in the pullback (constructive)
    4. Tight consolidation: ADR% in last 5 days < 20-day average ADR%
    5. Range expansion trigger: Today's high exceeds consolidation high on volume
    6. Volume confirmation: Today's volume > 1.5x the 50-day average
    7. Price above key MAs: Price > 10 SMA > 20 SMA (both rising)
    """
    try:
        close = daily_df['Close']
        high = daily_df['High']
        low = daily_df['Low']
        volume = daily_df['Volume']

        if len(close) < 65:
            return None

        current_price = float(close.iloc[-1])

        # 1. Big prior move (30%+ in 60 days)
        price_60d_ago = float(close.iloc[-60])
        move_pct = ((current_price - price_60d_ago) / price_60d_ago) * 100 if price_60d_ago > 0 else 0
        has_big_move = move_pct >= 30

        # 2. Orderly pullback
        recent_high = float(high.tail(60).max())
        recent_high_idx = high.tail(60).idxmax()
        pullback_slice = low.loc[recent_high_idx:]
        pullback_low = float(pullback_slice.min()) if len(pullback_slice) > 0 else current_price
        pullback_depth = ((recent_high - pullback_low) / recent_high) * 100 if recent_high > 0 else 0
        orderly_pullback = 10 <= pullback_depth <= 35

        # 3. Higher lows detection (last 20 bars, windowed)
        recent_lows = []
        window = 5
        for i in range(-20, -window, window):
            end = min(i + window, -1)
            if abs(i) <= len(low) and abs(end) <= len(low):
                segment_low = float(low.iloc[i:i + window].min())
                recent_lows.append(segment_low)
        higher_lows = (all(recent_lows[i] <= recent_lows[i + 1]
                           for i in range(len(recent_lows) - 1))
                       if len(recent_lows) >= 2 else False)

        # 4. Tight consolidation (ADR contracting)
        adr_pct = ((high - low) / close * 100)
        adr_5d = float(adr_pct.tail(5).mean())
        adr_20d = float(adr_pct.tail(20).mean())
        tight_action = adr_5d < adr_20d if adr_20d > 0 else False

        # 5. Range expansion
        consolidation_high = float(high.tail(10).max())
        breaking_out = current_price >= consolidation_high * 0.995

        # 6. Volume surge
        avg_vol_50 = float(volume.tail(50).mean()) if len(volume) >= 50 else float(volume.mean())
        today_vol = float(volume.iloc[-1])
        volume_surge = today_vol > avg_vol_50 * 1.5 if avg_vol_50 > 0 else False
        vol_ratio = round(today_vol / avg_vol_50, 1) if avg_vol_50 > 0 else 0

        # 7. Above key MAs (rising)
        sma_10 = float(close.rolling(10).mean().iloc[-1])
        sma_20 = float(close.rolling(20).mean().iloc[-1])
        above_mas = current_price > sma_10 > sma_20
        sma_10_prev = float(close.rolling(10).mean().iloc[-5]) if len(close) >= 15 else sma_10
        sma_20_prev = float(close.rolling(20).mean().iloc[-5]) if len(close) >= 25 else sma_20
        mas_rising = sma_10 > sma_10_prev and sma_20 > sma_20_prev

        # Quality Score (0-100)
        score = 0
        if has_big_move:
            score += 20
        if move_pct >= 50:
            score += 5
        if orderly_pullback:
            score += 15
        if pullback_depth <= 20:
            score += 5
        if higher_lows:
            score += 15
        if tight_action:
            score += 15
        if adr_20d > 0 and adr_5d < adr_20d * 0.7:
            score += 5
        if breaking_out:
            score += 10
        if volume_surge:
            score += 10
        if avg_vol_50 > 0 and today_vol > avg_vol_50 * 2:
            score += 5
        if above_mas and mas_rising:
            score += 5

        passed = (has_big_move and orderly_pullback and higher_lows
                  and tight_action and above_mas)

        adr_contraction = round((adr_5d / adr_20d) * 100, 1) if adr_20d > 0 else 100

        return {
            'setup': 'BREAKOUT',
            'passed': passed,
            'triggering': breaking_out and volume_surge,
            'score': min(score, 100),
            'prior_move_pct': round(move_pct, 1),
            'pullback_depth_pct': round(pullback_depth, 1),
            'higher_lows': higher_lows,
            'adr_contraction': adr_contraction,
            'volume_ratio': vol_ratio,
            'consolidation_high': round(consolidation_high, 2),
            'sma_10': round(sma_10, 2),
            'sma_20': round(sma_20, 2),
            'detail': (
                f"Prior move +{move_pct:.0f}% in 60d. Pullback {pullback_depth:.0f}%. "
                f"ADR contracting to {adr_contraction:.0f}% of normal. "
                + (f"TRIGGERING — breakout on {vol_ratio}x volume"
                   if breaking_out and volume_surge
                   else "Consolidating — watch for range expansion")
            ),
        }
    except Exception as e:
        log.warning(f"scan_breakouts({ticker}): {e}")
        return None


# ─────────────────────────────────────────────
# SETUP 2: PARABOLIC SHORT/LONG (RUBBER BAND)
# ─────────────────────────────────────────────

def scan_parabolic(ticker, daily_df, market_cap=None):
    """
    Qullamaggie Parabolic Scanner (Short and Long side)

    SHORT: Massive surge (50-100%+ large cap, 300%+ small cap), 3-5+ consecutive
    up days, extended 30%+ from 10 SMA, volume climax, first crack.

    LONG BOUNCE: Inverse — oversold stocks snapping back after capitulation.
    """
    try:
        close = daily_df['Close']
        high = daily_df['High']
        low = daily_df['Low']
        volume = daily_df['Volume']

        if len(close) < 25:
            return None

        current_price = float(close.iloc[-1])

        is_large_cap = market_cap and market_cap > 10_000_000_000
        surge_threshold = 50 if is_large_cap else 200

        # 1. Massive recent surge across multiple windows
        moves = {}
        for window in [5, 10, 20]:
            if len(close) >= window + 1:
                price_then = float(close.iloc[-(window + 1)])
                pct_move = ((current_price - price_then) / price_then) * 100 if price_then > 0 else 0
                moves[f'{window}d'] = pct_move

        best_window = max(moves, key=moves.get) if moves else None
        best_move = moves.get(best_window, 0) if best_window else 0
        has_surge = best_move >= surge_threshold

        # 2. Consecutive up days
        consecutive_up = 0
        for i in range(-1, -min(len(close), 15), -1):
            if float(close.iloc[i]) > float(close.iloc[i - 1]):
                consecutive_up += 1
            else:
                break
        many_up_days = consecutive_up >= 3

        # 3. Extended from 10-day SMA
        sma_10 = float(close.rolling(10).mean().iloc[-1])
        sma_20 = float(close.rolling(20).mean().iloc[-1])
        extension_from_10 = ((current_price - sma_10) / sma_10) * 100 if sma_10 > 0 else 0
        extension_from_20 = ((current_price - sma_20) / sma_20) * 100 if sma_20 > 0 else 0
        is_extended = extension_from_10 >= 30

        # 4. Volume climax
        avg_vol = float(volume.tail(50).mean()) if len(volume) >= 50 else float(volume.mean())
        recent_vol = float(volume.tail(3).mean())
        vol_climax = recent_vol > avg_vol * 3 if avg_vol > 0 else False

        # 5. First crack (bearish reversal signal)
        today_red = float(close.iloc[-1]) < float(close.iloc[-2]) if len(close) >= 2 else False
        today_high_rejection = ((float(high.iloc[-1]) - float(close.iloc[-1])) >
                                (float(close.iloc[-1]) - float(low.iloc[-1]))) if len(high) >= 1 else False
        first_crack = today_red or today_high_rejection

        # SHORT quality score
        short_score = 0
        if has_surge:
            short_score += 25
        if best_move >= surge_threshold * 1.5:
            short_score += 10
        if many_up_days:
            short_score += 15
        if consecutive_up >= 5:
            short_score += 10
        if is_extended:
            short_score += 15
        if vol_climax:
            short_score += 10
        if first_crack:
            short_score += 15

        # LONG side (oversold bounce)
        recent_peak = float(high.tail(30).max())
        decline_pct = ((current_price - recent_peak) / recent_peak) * 100 if recent_peak > 0 else 0
        oversold = decline_pct <= -30

        consecutive_down = 0
        for i in range(-1, -min(len(close), 15), -1):
            if float(close.iloc[i]) < float(close.iloc[i - 1]):
                consecutive_down += 1
            else:
                break

        long_bounce = oversold and consecutive_down >= 3
        today_green = float(close.iloc[-1]) > float(close.iloc[-2]) if len(close) >= 2 else False

        long_score = 0
        if oversold:
            long_score += 20
        if decline_pct <= -50:
            long_score += 10
        if consecutive_down >= 3:
            long_score += 15
        if consecutive_down >= 5:
            long_score += 10
        if today_green:
            long_score += 15
        if avg_vol > 0 and float(volume.iloc[-1]) > avg_vol * 2:
            long_score += 15

        vol_ratio = round(recent_vol / avg_vol, 1) if avg_vol > 0 else 0

        # Build detail text
        if has_surge and many_up_days and is_extended:
            detail = (
                f"SHORT: Up {best_move:.0f}% in {best_window}. {consecutive_up} consecutive up days. "
                f"Extended {extension_from_10:.0f}% from 10 SMA. "
                + ("FIRST CRACK detected — entry zone" if first_crack
                   else "Still running — wait for crack")
            )
        elif long_bounce:
            detail = (
                f"LONG BOUNCE: Down {abs(decline_pct):.0f}% from peak. {consecutive_down} down days. "
                + ("First green day — potential bounce entry" if today_green
                   else "Still declining")
            )
        else:
            detail = "No parabolic setup detected"

        return {
            'setup': 'PARABOLIC',
            'short_setup': has_surge and many_up_days and is_extended,
            'short_triggering': has_surge and many_up_days and is_extended and first_crack,
            'short_score': min(short_score, 100),
            'long_bounce': long_bounce,
            'long_triggering': long_bounce and today_green,
            'long_score': min(long_score, 100),
            'surge_pct': round(best_move, 1),
            'surge_window': best_window,
            'consecutive_up': consecutive_up,
            'consecutive_down': consecutive_down,
            'extension_from_10sma': round(extension_from_10, 1),
            'extension_from_20sma': round(extension_from_20, 1),
            'volume_ratio': vol_ratio,
            'first_crack': first_crack,
            'sma_10': round(sma_10, 2),
            'sma_20': round(sma_20, 2),
            'decline_pct': round(decline_pct, 1) if oversold else None,
            'detail': detail,
        }
    except Exception as e:
        log.warning(f"scan_parabolic({ticker}): {e}")
        return None


# ─────────────────────────────────────────────
# SETUP 3: EPISODIC PIVOT (EP) SCANNER
# ─────────────────────────────────────────────

def scan_episodic_pivot(ticker, daily_df, fundamentals=None):
    """
    Qullamaggie Episodic Pivot Scanner

    Conditions:
    1. Big price move: Gap up or surge of 10%+ in a single day
    2. Big volume: Today's volume > 3x 50-day average
    3. Prior neglect: Stock was flat or down for 3-6 months before
    4. Catalyst: Detected structurally via gap + volume + neglect
    5. Growth: If available, significant EPS beat
    """
    try:
        close = daily_df['Close']
        high = daily_df['High']
        low = daily_df['Low']
        volume = daily_df['Volume']

        if len(close) < 130:
            return None

        current_price = float(close.iloc[-1])
        prev_close = float(close.iloc[-2])

        # 1. Big single-day move
        day_move_pct = ((current_price - prev_close) / prev_close) * 100 if prev_close > 0 else 0
        gap_pct = ((float(daily_df['Open'].iloc[-1]) - prev_close) / prev_close) * 100 if prev_close > 0 else 0
        big_move = day_move_pct >= 10 or gap_pct >= 8

        # 2. Big volume
        avg_vol_50 = float(volume.tail(50).mean()) if len(volume) >= 50 else float(volume.mean())
        today_vol = float(volume.iloc[-1])
        vol_ratio = today_vol / avg_vol_50 if avg_vol_50 > 0 else 0
        big_volume = vol_ratio >= 3

        # 3. Prior neglect (flat or down for 3 months)
        price_90d_ago = float(close.iloc[-90]) if len(close) >= 90 else float(close.iloc[0])
        prior_3mo_move = ((prev_close - price_90d_ago) / price_90d_ago) * 100 if price_90d_ago > 0 else 0
        was_neglected = prior_3mo_move <= 10

        price_130d_ago = float(close.iloc[-130]) if len(close) >= 130 else float(close.iloc[0])
        prior_6mo_move = ((prev_close - price_130d_ago) / price_130d_ago) * 100 if price_130d_ago > 0 else 0
        was_in_downtrend = prior_6mo_move <= 0
        was_sideways = abs(prior_3mo_move) <= 15

        # 4. Catalyst detection (structural proxy)
        likely_catalyst = big_move and vol_ratio >= 5 and was_neglected

        # 5. Growth check
        has_growth = True
        eps_beat = None
        if fundamentals:
            eps_growth = fundamentals.get('eps_growth_yoy') or fundamentals.get('eps', 0)
            if eps_growth is not None:
                has_growth = eps_growth > 20
                eps_beat = eps_growth

        # Quality Score
        score = 0
        if big_move:
            score += 15
        if day_move_pct >= 15:
            score += 5
        if day_move_pct >= 20:
            score += 5
        if gap_pct >= 10:
            score += 5
        if big_volume:
            score += 15
        if vol_ratio >= 5:
            score += 5
        if vol_ratio >= 10:
            score += 5
        if was_neglected:
            score += 15
        if was_in_downtrend:
            score += 5
        if was_sideways:
            score += 5
        if likely_catalyst:
            score += 10
        if has_growth:
            score += 10

        passed = big_move and big_volume and was_neglected

        sma_10 = float(close.rolling(10).mean().iloc[-1])
        sma_20 = float(close.rolling(20).mean().iloc[-1])

        if passed:
            detail = (
                f"EP DETECTED: +{day_move_pct:.0f}% today on {vol_ratio:.0f}x volume. "
                f"Prior 3mo: {prior_3mo_move:+.0f}% ({'neglected' if was_neglected else 'active'}). "
                + (f"Gap +{gap_pct:.1f}%" if gap_pct >= 5 else "Rally") + ". "
                + ("Likely earnings catalyst" if likely_catalyst
                   else "Monitor for catalyst confirmation")
            )
        else:
            detail = "No Episodic Pivot detected"

        return {
            'setup': 'EPISODIC_PIVOT',
            'passed': passed,
            'triggering': passed,  # EPs trigger on the day they happen
            'score': min(score, 100),
            'day_move_pct': round(day_move_pct, 1),
            'gap_pct': round(gap_pct, 1),
            'volume_ratio': round(vol_ratio, 1),
            'prior_3mo_pct': round(prior_3mo_move, 1),
            'prior_6mo_pct': round(prior_6mo_move, 1),
            'was_neglected': was_neglected,
            'was_downtrend': was_in_downtrend,
            'was_sideways': was_sideways,
            'likely_catalyst': likely_catalyst,
            'eps_beat': eps_beat,
            'sma_10': round(sma_10, 2),
            'sma_20': round(sma_20, 2),
            'detail': detail,
        }
    except Exception as e:
        log.warning(f"scan_episodic_pivot({ticker}): {e}")
        return None


# ─────────────────────────────────────────────
# SINGLE-TICKER ANALYSIS
# ─────────────────────────────────────────────

def analyze_qullamaggie(ticker, daily_df, fundamentals=None, market_cap=None):
    """
    Run all three Qullamaggie scanners on a single ticker.
    Returns a dict with results for each setup type + best setup.
    """
    result = {
        'ticker': ticker,
        'breakout': None,
        'parabolic': None,
        'episodic_pivot': None,
        'best_setup': None,
        'best_score': 0,
        'any_setup': False,
        'any_triggering': False,
        'setups_summary': [],
    }

    # Breakout scan
    bo = scan_breakouts(ticker, daily_df)
    if bo:
        result['breakout'] = bo
        if bo['passed']:
            result['setups_summary'].append({
                'type': 'BREAKOUT',
                'score': bo['score'],
                'triggering': bo['triggering'],
                'detail': bo['detail'],
            })
            if bo['score'] > result['best_score']:
                result['best_score'] = bo['score']
                result['best_setup'] = 'BREAKOUT'

    # Parabolic scan
    para = scan_parabolic(ticker, daily_df, market_cap=market_cap)
    if para:
        result['parabolic'] = para
        if para['short_setup']:
            result['setups_summary'].append({
                'type': 'PARABOLIC_SHORT',
                'score': para['short_score'],
                'triggering': para['short_triggering'],
                'detail': para['detail'],
            })
            if para['short_score'] > result['best_score']:
                result['best_score'] = para['short_score']
                result['best_setup'] = 'PARABOLIC_SHORT'
        if para['long_bounce']:
            result['setups_summary'].append({
                'type': 'PARABOLIC_LONG',
                'score': para['long_score'],
                'triggering': para['long_triggering'],
                'detail': para['detail'],
            })
            if para['long_score'] > result['best_score']:
                result['best_score'] = para['long_score']
                result['best_setup'] = 'PARABOLIC_LONG'

    # Episodic Pivot scan
    ep = scan_episodic_pivot(ticker, daily_df, fundamentals=fundamentals)
    if ep:
        result['episodic_pivot'] = ep
        if ep['passed']:
            result['setups_summary'].append({
                'type': 'EPISODIC_PIVOT',
                'score': ep['score'],
                'triggering': ep['triggering'],
                'detail': ep['detail'],
            })
            if ep['score'] > result['best_score']:
                result['best_score'] = ep['score']
                result['best_setup'] = 'EPISODIC_PIVOT'

    result['any_setup'] = len(result['setups_summary']) > 0
    result['any_triggering'] = any(s['triggering'] for s in result['setups_summary'])

    return result


# ─────────────────────────────────────────────
# MASTER SCANNER (FULL UNIVERSE)
# ─────────────────────────────────────────────

def run_qullamaggie_scan(universe, daily_data_dict, fundamentals_dict=None):
    """
    Run all three Qullamaggie scanners across the universe.
    Returns categorized results sorted by quality score.
    """
    results = {
        'breakouts': [],
        'parabolic_shorts': [],
        'parabolic_longs': [],
        'episodic_pivots': [],
        'all_setups': [],
        'total_scanned': 0,
        'total_with_setup': 0,
    }

    for ticker in universe:
        df = daily_data_dict.get(ticker)
        if df is None or df.empty:
            continue

        results['total_scanned'] += 1
        fund = fundamentals_dict.get(ticker, {}) if fundamentals_dict else {}
        mcap = fund.get('market_cap') or fund.get('marketCap', 0)

        analysis = analyze_qullamaggie(ticker, df, fundamentals=fund, market_cap=mcap)

        if not analysis['any_setup']:
            continue

        results['total_with_setup'] += 1

        # Categorize
        bo = analysis['breakout']
        if bo and bo['passed']:
            bo['ticker'] = ticker
            results['breakouts'].append(bo)

        para = analysis['parabolic']
        if para:
            if para['short_setup']:
                results['parabolic_shorts'].append({**para, 'ticker': ticker})
            if para['long_bounce']:
                results['parabolic_longs'].append({**para, 'ticker': ticker})

        ep = analysis['episodic_pivot']
        if ep and ep['passed']:
            ep['ticker'] = ticker
            results['episodic_pivots'].append(ep)

        # All setups flat list for the master view
        for setup in analysis['setups_summary']:
            results['all_setups'].append({
                'ticker': ticker,
                **setup,
            })

    # Sort each by score descending
    results['breakouts'].sort(key=lambda x: x.get('score', 0), reverse=True)
    results['parabolic_shorts'].sort(key=lambda x: x.get('short_score', 0), reverse=True)
    results['parabolic_longs'].sort(key=lambda x: x.get('long_score', 0), reverse=True)
    results['episodic_pivots'].sort(key=lambda x: x.get('score', 0), reverse=True)
    results['all_setups'].sort(key=lambda x: x.get('score', 0), reverse=True)

    return results


# ─────────────────────────────────────────────
# DUAL CONVERGENCE DETECTION
# ─────────────────────────────────────────────

def check_dual_convergence(mkw_conv_score, mkw_conv_max, qull_breakout_score):
    """
    Check if a stock qualifies for DUAL CONVERGENCE:
    MKW convergence score >= 20 AND Qullamaggie breakout score >= 70.
    Returns bonus points and classification.
    """
    mkw_pct = (mkw_conv_score / mkw_conv_max * 100) if mkw_conv_max > 0 else 0
    is_dual = mkw_pct >= 87 and qull_breakout_score >= 70  # ~20/23

    return {
        'is_dual_convergence': is_dual,
        'bonus_points': 5 if is_dual else 0,
        'label': 'DUAL CONVERGENCE' if is_dual else None,
        'mkw_score': mkw_conv_score,
        'qull_score': qull_breakout_score,
    }


# ─────────────────────────────────────────────
# SETUP ARCHIVE (Evernote equivalent)
# ─────────────────────────────────────────────

import json
import os

ARCHIVE_FILE = "/tmp/mkw_qull_archive.json"


def _load_archive() -> list:
    try:
        if os.path.exists(ARCHIVE_FILE):
            with open(ARCHIVE_FILE) as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
    except Exception:
        pass
    return []


def _save_archive(entries: list):
    try:
        with open(ARCHIVE_FILE, "w") as f:
            json.dump(entries, f, indent=2, default=str)
    except Exception as e:
        log.warning(f"Archive save error: {e}")


def archive_setup(entry: dict) -> dict:
    """Add a setup to the historical archive."""
    import uuid
    from datetime import datetime

    entries = _load_archive()
    record = {
        "id": str(uuid.uuid4()),
        "ticker": entry.get("ticker", "").upper(),
        "setup_type": entry.get("setup_type", ""),
        "date": entry.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
        "quality_score": entry.get("quality_score", 0),
        "entry": entry.get("entry"),
        "stop": entry.get("stop"),
        "result": entry.get("result"),  # WIN / LOSS / OPEN
        "r_multiple": entry.get("r_multiple"),
        "hold_days": entry.get("hold_days"),
        "screenshot_note": entry.get("screenshot_note", ""),
        "lessons": entry.get("lessons", ""),
        "created_at": datetime.utcnow().isoformat(),
    }
    entries.append(record)
    _save_archive(entries)
    return record


def get_archive(setup_type: str = "", ticker: str = "", limit: int = 100) -> list:
    """Retrieve archived setups with optional filters."""
    entries = _load_archive()
    if setup_type:
        entries = [e for e in entries if e.get("setup_type", "").upper() == setup_type.upper()]
    if ticker:
        entries = [e for e in entries if e.get("ticker", "").upper() == ticker.upper()]
    entries.sort(key=lambda x: x.get("date", ""), reverse=True)
    return entries[:limit]


def archive_analytics() -> dict:
    """Performance analytics by setup type from the archive."""
    entries = _load_archive()
    closed = [e for e in entries if e.get("result") in ("WIN", "LOSS")]

    if not closed:
        return {"message": "No completed setups in archive yet.", "total": len(entries)}

    by_type = {}
    for e in closed:
        stype = e.get("setup_type", "UNKNOWN")
        if stype not in by_type:
            by_type[stype] = {"wins": 0, "losses": 0, "r_wins": [], "r_losses": []}
        if e["result"] == "WIN":
            by_type[stype]["wins"] += 1
            if e.get("r_multiple"):
                by_type[stype]["r_wins"].append(float(e["r_multiple"]))
        else:
            by_type[stype]["losses"] += 1
            if e.get("r_multiple"):
                by_type[stype]["r_losses"].append(float(e["r_multiple"]))

    analytics = {}
    for stype, data in by_type.items():
        total = data["wins"] + data["losses"]
        win_rate = round(data["wins"] / total * 100, 1) if total > 0 else 0
        avg_winner = round(sum(data["r_wins"]) / len(data["r_wins"]), 1) if data["r_wins"] else 0
        avg_loser = round(sum(data["r_losses"]) / len(data["r_losses"]), 1) if data["r_losses"] else 0
        expectancy = round(
            (win_rate / 100 * avg_winner) + ((1 - win_rate / 100) * avg_loser), 2
        ) if total > 0 else 0

        analytics[stype] = {
            "trades": total,
            "win_rate": win_rate,
            "avg_winner_r": avg_winner,
            "avg_loser_r": avg_loser,
            "expectancy_r": expectancy,
        }

    return {"by_setup_type": analytics, "total_archived": len(entries), "total_closed": len(closed)}
