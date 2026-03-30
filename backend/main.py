"""
MKW Command Center — FastAPI Backend v2.0
Institutional-Grade Options Intelligence Platform
Minervini x Kell x Weinstein convergence engine + options pricing + trade grading
"""

import os, time, json, logging, asyncio, uuid, sys, math
from datetime import datetime, timedelta
from typing import Optional
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
import traceback

# Local modules
sys.path.insert(0, os.path.dirname(__file__))
import data_router as router
import finra_short_volume as finra
import macro_engine as macro
import polygon_client as poly
from options_engine import (
    full_options_analysis, calc_greeks, black_scholes_price,
    calc_historical_volatility, calc_iv_from_options_chain,
    calc_expected_move, compare_move_to_breakeven, select_strategy,
    build_options_snapshot, greeks_projection,
)
from grading import grade_trade, score_to_grade
from trade_ideas import generate_trade_ideas
import llm_provider
import wizard as wiz
from journal import (
    add_trade, update_trade, delete_trade, get_trades, get_trade,
    compute_analytics,
)
import qullamaggie as qull
from trade_rules import generate_trade_plan, calculate_r_multiple
from indicators import get_qullamaggie_snapshot
from entry_criteria import grade_setup, grade_watchlist
from playbook_engine import generate_playbook
from pattern_alerts import scan_all_patterns
from notifications import (
    get_notification_status, notify_setup, notify_pattern_alert,
    notify_morning_summary, send_telegram, send_discord,
)
from enrichment import enrich_ticker

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("mkw")

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
FINNHUB_KEY  = os.getenv("FINNHUB_API_KEY", "")
CLAUDE_KEY   = os.getenv("ANTHROPIC_API_KEY", "")
POLYGON_KEY  = os.getenv("POLYGON_API_KEY", "")
FRED_KEY     = os.getenv("FRED_API_KEY", "")
CACHE_PRICES     = 300    # 5 min
CACHE_TECHNICALS = 1800   # 30 min
CACHE_FUNDAMENT  = 7200   # 2 hrs
CACHE_WATCHLIST  = 300
CACHE_BREADTH    = 300
CACHE_THREATS    = 300
CACHE_NEWS       = 900
CACHE_EARNINGS   = 3600
CACHE_BRIEF      = 1800
CACHE_OPTIONS    = 600    # 10 min

# Static fallback universe (used when Polygon dynamic universe unavailable)
WATCHLIST = router.STATIC_UNIVERSE
THREATS_LIST = ["CVNA","HIMS","SMCI","BYND","SNAP"]

SECTOR_ETFS  = ["XLE","XLK","XLF","XLV","XLI","XLY","XLP","XLB","XLRE","XLU","XLC"]
SECTOR_NAMES = {
    "XLE":"Energy","XLK":"Tech","XLF":"Financials","XLV":"Healthcare",
    "XLI":"Industrials","XLY":"Cons Disc","XLP":"Cons Stpl","XLB":"Materials",
    "XLRE":"Real Estate","XLU":"Utilities","XLC":"Comms",
}

# ─────────────────────────────────────────────
# POSITIONS FILE
# ─────────────────────────────────────────────
POSITIONS_FILE = "/tmp/mkw_positions.json"

def load_positions() -> dict:
    try:
        if os.path.exists(POSITIONS_FILE):
            with open(POSITIONS_FILE) as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def save_positions(pos: dict):
    try:
        with open(POSITIONS_FILE, "w") as f:
            json.dump(pos, f)
    except Exception as e:
        log.warning(f"save_positions: {e}")

_positions: dict = {}

_macro_cache: dict = {}  # Cached macro data from FRED


def _recalc_zone(score: int, max_score: int = 23) -> str:
    """Recalculate convergence zone with updated thresholds (max 23 with FINRA)."""
    if score >= 21:
        return "CONVERGENCE"
    if score >= 16:
        return "SECONDARY"
    if score >= 11:
        return "BUILDING"
    return "WATCH"


# ─────────────────────────────────────────────
# NUMPY SERIALIZATION
# ─────────────────────────────────────────────
def to_python(obj):
    if isinstance(obj, dict):
        return {k: to_python(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_python(v) for v in obj]
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        v = float(obj)
        if math.isnan(v) or math.isinf(v):
            return 0.0
        return v
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return 0.0
    return obj

# ─────────────────────────────────────────────
# CACHE
# ─────────────────────────────────────────────
_cache: dict = {}
_cache_ts: dict = {}

def cache_get(key: str, ttl: int):
    if key in _cache and (time.time() - _cache_ts.get(key, 0)) < ttl:
        return _cache[key]
    return None

def cache_set(key: str, val):
    _cache[key] = val
    _cache_ts[key] = time.time()

# ─────────────────────────────────────────────
# DATA FETCHING (via data_router: Polygon → yfinance)
# ─────────────────────────────────────────────
def fetch_ohlcv(ticker: str, period: str = "2y") -> Optional[pd.DataFrame]:
    return router.fetch_ohlcv(ticker, period)

def fetch_fundamentals(ticker: str) -> dict:
    return router.fetch_fundamentals(ticker)

def finnhub_get(path: str, params: dict = {}) -> dict:
    if not FINNHUB_KEY:
        return {}
    try:
        url = f"https://finnhub.io/api/v1{path}"
        params["token"] = FINNHUB_KEY
        r = requests.get(url, params=params, timeout=5)
        return r.json() if r.ok else {}
    except Exception:
        return {}

# ─────────────────────────────────────────────
# ALGORITHMS
# ─────────────────────────────────────────────
def calc_returns(df: pd.DataFrame):
    c = df["Close"]
    def pct(n):
        if len(c) > n:
            return round((float(c.iloc[-1]) - float(c.iloc[-n-1])) / float(c.iloc[-n-1]) * 100, 2)
        return 0.0
    return pct(1), pct(5), pct(21), pct(63), pct(126), pct(252)

def calc_rs_rating(df: pd.DataFrame, spy_df: pd.DataFrame) -> int:
    try:
        s_ret = (float(df["Close"].iloc[-1]) - float(df["Close"].iloc[-252])) / float(df["Close"].iloc[-252])
        m_ret = (float(spy_df["Close"].iloc[-1]) - float(spy_df["Close"].iloc[-252])) / float(spy_df["Close"].iloc[-252])
        excess = (s_ret - m_ret) * 100
        rs = int(min(99, max(1, 50 + excess * 1.5)))
        return rs
    except Exception:
        return 50

def weinstein_stage(df: pd.DataFrame) -> dict:
    if len(df) < 200:
        return {"stage": "?", "ma150": None, "slopeWeeks": 0, "slopeRising": False, "pctFromMA": 0}
    c = df["Close"]
    sma = c.rolling(150).mean()
    price = float(c.iloc[-1])
    sma_now  = float(sma.iloc[-1])
    sma_20d  = float(sma.iloc[-21]) if len(sma) > 21 else sma_now

    slope_rising = sma_now > sma_20d
    weeks_rising = 0
    for i in range(1, min(len(sma)-1, 60)):
        v_now  = sma.iloc[-i]
        v_prev = sma.iloc[-i-1]
        if pd.isna(v_now) or pd.isna(v_prev):
            break
        if float(v_now) > float(v_prev):
            weeks_rising += 1
        else:
            break

    pct = round((price - sma_now) / sma_now * 100, 1) if sma_now else 0

    if price > sma_now and slope_rising:
        stage = "2A" if weeks_rising < 20 else "2B"
    elif price > sma_now and not slope_rising:
        stage = "3"
    elif price < sma_now and not slope_rising:
        stage = "4A" if weeks_rising <= 15 else "4B"
    elif abs(pct) < 3:
        stage = "1B" if slope_rising else "1A"
    else:
        stage = "1A"

    return {
        "stage": stage, "ma150": round(sma_now, 2),
        "slopeWeeks": weeks_rising, "slopeRising": slope_rising, "pctFromMA": pct,
    }

def minervini_template(df: pd.DataFrame, rs: int) -> tuple[list, int]:
    if len(df) < 252:
        return [False]*8, 0
    c = df["Close"]
    h = df["High"]
    price   = float(c.iloc[-1])
    sma50   = float(c.rolling(50).mean().iloc[-1])
    sma150  = float(c.rolling(150).mean().iloc[-1])
    sma200  = float(c.rolling(200).mean().iloc[-1])
    sma200_20ago = float(c.rolling(200).mean().iloc[-21])
    high52  = float(h.rolling(252).max().iloc[-1])

    criteria = [
        price > sma50, price > sma150, price > sma200,
        sma50 > sma150, sma150 > sma200, sma200 > sma200_20ago,
        price >= high52 * 0.75, rs >= 70,
    ]
    return criteria, sum(criteria)

def kell_phase(df: pd.DataFrame):
    if len(df) < 30:
        return "Unknown", "gray", "neutral", "neutral", "neutral", 0.0, 0.0, 0.0, 0.0, 0.0
    c = df["Close"]
    lo = df["Low"]
    vol = df.get("Volume", pd.Series([1]*len(df)))

    e10  = c.ewm(span=10,  adjust=False).mean()
    e20  = c.ewm(span=20,  adjust=False).mean()
    e50  = c.ewm(span=50,  adjust=False).mean()
    e100 = c.ewm(span=100, adjust=False).mean()
    e200 = c.ewm(span=200, adjust=False).mean() if len(c) > 210 else e100

    price   = float(c.iloc[-1])
    ema10   = float(e10.iloc[-1])
    ema20   = float(e20.iloc[-1])
    ema50   = float(e50.iloc[-1])
    ema100  = float(e100.iloc[-1])
    ema200  = float(e200.iloc[-1])

    ema10_5d  = float(e10.iloc[-6]) if len(e10) > 6 else ema10
    ema20_5d  = float(e20.iloc[-6]) if len(e20) > 6 else ema20
    ema10_ris = ema10 > ema10_5d
    ema20_ris = ema20 > ema20_5d

    above10 = price > ema10
    above20 = price > ema20
    e10_gt_20 = ema10 > ema20

    pct_above_e10 = (price - ema10) / ema10 * 100 if ema10 else 0

    recent_lo_5d = float(lo.iloc[-5:].min())
    ema20_vals_5d = e20.iloc[-10:]
    ema20_min = float(ema20_vals_5d.min()) if not ema20_vals_5d.empty else ema20
    touched_ema20 = abs(recent_lo_5d - ema20_min) / ema20_min < 0.025 if ema20_min else False

    bb_std  = float(c.rolling(20).std().iloc[-1]) if len(c) > 20 else 1
    bb_mean = float(c.rolling(20).mean().iloc[-1]) if len(c) > 20 else price
    bb_pct  = (bb_std * 2) / bb_mean if bb_mean else 1

    vol_avg = float(vol.rolling(50).mean().iloc[-1]) if len(vol) > 50 else 1
    vol_now = float(vol.iloc[-1]) if not vol.empty else 1
    vol_ratio = vol_now / vol_avg if vol_avg > 0 else 1

    if pct_above_e10 > 4 and above20:
        phase, light = "Extension", "yellow"
    elif touched_ema20 and above10 and e10_gt_20 and ema10_ris:
        phase, light = "EMA Crossback", "green"
    elif bb_pct < 0.06 and above20:
        phase, light = "Wedge", "yellow"
    elif above10 and above20 and e10_gt_20 and vol_ratio > 1.5:
        phase, light = "Pop", "green"
    elif above10 and above20 and e10_gt_20 and not ema10_ris:
        phase, light = "Base n Break", "green"
    elif above10 and e10_gt_20 and ema10_ris:
        phase, light = "Reversal", "yellow"
    else:
        phase, light = "Red Light", "red"

    ema_d = "bull" if above10 and above20 and e10_gt_20 else ("bear" if not above20 else "neutral")
    ema_w = "bull" if price > ema50 and ema50 > ema100 else ("bear" if price < ema100 else "neutral")
    ema_m = "bull" if price > ema200 else ("bear" if price < ema200 * 0.95 else "neutral")

    return (phase, light, ema_d, ema_w, ema_m,
            round(ema10, 2), round(ema20, 2), round(ema50, 2), round(ema100, 2), round(ema200, 2))

def detect_vcp(df: pd.DataFrame) -> dict:
    if len(df) < 30:
        return {"count": 0, "depths": "—", "pivot": None, "tightness": 0, "volDryup": False}

    recent = df.iloc[-60:].copy().reset_index(drop=True)
    hi = recent["High"]
    lo = recent["Low"]
    vol = recent.get("Volume", pd.Series([1]*len(recent)))

    w = 4
    pivots_h, pivots_l = [], []
    for i in range(w, len(recent) - w):
        if all(float(hi.iloc[i]) >= float(hi.iloc[i-j]) for j in range(1,w+1)) and \
           all(float(hi.iloc[i]) >= float(hi.iloc[i+j]) for j in range(1,w+1)):
            pivots_h.append((i, float(hi.iloc[i])))
        if all(float(lo.iloc[i]) <= float(lo.iloc[i-j]) for j in range(1,w+1)) and \
           all(float(lo.iloc[i]) <= float(lo.iloc[i+j]) for j in range(1,w+1)):
            pivots_l.append((i, float(lo.iloc[i])))

    if len(pivots_h) < 2:
        return {"count": 0, "depths": "—", "pivot": None, "tightness": 0, "volDryup": False}

    contractions = []
    for i in range(min(len(pivots_h)-1, 4)):
        hi_val = pivots_h[i][1]
        hi_idx = pivots_h[i][0]
        lows_after = [(idx, v) for idx, v in pivots_l if idx > hi_idx]
        if lows_after:
            lo_val = min(lows_after, key=lambda x: x[1])[1]
            depth = (hi_val - lo_val) / hi_val * 100
            contractions.append(round(depth, 1))

    if not contractions:
        return {"count": 0, "depths": "—", "pivot": None, "tightness": 0, "volDryup": False}

    tightening = all(contractions[i] > contractions[i+1] for i in range(len(contractions)-1)) \
                 if len(contractions) > 1 else True

    vol_avg50 = float(df["Volume"].rolling(50).mean().iloc[-1]) if len(df) > 50 else 1
    vol_recent_5d = float(vol.iloc[-5:].mean()) if len(vol) >= 5 else vol_avg50
    vol_dryup = vol_recent_5d < vol_avg50 * 0.65

    pivot = pivots_h[-1][1]
    tightness = min(100, int(
        len(contractions) * 20 + (20 if tightening else 0) +
        (20 if vol_dryup else 0) + (20 if len(contractions) >= 3 else 0)
    ))
    depths_str = "→".join([f"{d:.0f}%" for d in contractions[:4]])

    return {
        "count": len(contractions), "depths": depths_str,
        "pivot": round(pivot, 2), "tightness": tightness, "volDryup": vol_dryup,
    }

def inverse_template(df: pd.DataFrame, rs: int) -> tuple[list, int]:
    if len(df) < 252:
        return [False]*8, 0
    c = df["Close"]
    h = df["High"]
    price   = float(c.iloc[-1])
    sma50   = float(c.rolling(50).mean().iloc[-1])
    sma150  = float(c.rolling(150).mean().iloc[-1])
    sma200  = float(c.rolling(200).mean().iloc[-1])
    sma200_20ago = float(c.rolling(200).mean().iloc[-21])
    high52  = float(h.rolling(252).max().iloc[-1])
    criteria = [
        price < sma50, price < sma150, price < sma200,
        sma50 < sma150, sma150 < sma200, sma200 < sma200_20ago,
        price <= high52 * 0.75, rs <= 30,
    ]
    return criteria, sum(criteria)

def convergence_score(wein, tpl_score, rs, phase, vcp, mkt, fund, df, detailed=False):
    price = float(df["Close"].iloc[-1]) if not df.empty else 0
    near_pivot = bool(vcp["pivot"] and abs(price / vcp["pivot"] - 1) <= 0.07) if vcp["pivot"] else False
    criteria = {
        "mkt_spx_stage2":  (mkt.get("spxStage") == 2,       1, f"SPX Stage {mkt.get('spxStage')}"),
        "mkt_spx_ema":     (mkt.get("spxEma") == "above",   1, f"SPX EMA {mkt.get('spxEma')}"),
        "mkt_tpl_count":   (mkt.get("tplCount", 0) > 200,   1, f"TPL count {mkt.get('tplCount',0)}"),
        "trend_stage2":    (wein["stage"] in ("2A","2B"),    1, f"Stage {wein['stage']}"),
        "trend_tpl8":      (tpl_score == 8,                  1, f"TPL {tpl_score}/8"),
        "trend_rs70":      (rs >= 70,                        1, f"RS {rs}"),
        "trend_kell_ok":   (phase in ("EMA Crossback","Pop","Base n Break","Extension","Reversal"), 1, f"Phase {phase}"),
        "trend_tpl5":      (tpl_score >= 5,                  1, f"TPL>=5 ({tpl_score})"),
        "fund_eps":        (fund.get("eps", 0) > 15,         1, f"EPS growth {fund.get('eps',0)}%"),
        "fund_rev":        (fund.get("rev", 0) > 10,         1, f"Rev growth {fund.get('rev',0)}%"),
        "fund_margins":    (bool(fund.get("marginsExpanding", False)), 1, "Margins expanding"),
        "entry_vcp":       (vcp["count"] >= 2,               1, f"VCP {vcp['count']}ct"),
        "entry_dryup":     (bool(vcp["volDryup"]),            1, "Volume dry-up"),
        "entry_phase":     (phase in ("EMA Crossback","Pop","Extension"), 1, f"Entry phase {phase}"),
        "entry_pivot":     (near_pivot,                      1, f"Near pivot {vcp.get('pivot','—')}"),
        "risk_stop":       (True,                            1, "Stop defined"),
        "risk_size":       (True,                            1, "Position sized"),
        "risk_rr":         (True,                            1, "R:R acceptable"),
    }
    s = sum(pts for (passed, pts, _) in criteria.values() if passed)
    zone = ("CONVERGENCE" if s >= 17 else "SECONDARY" if s >= 12 else
            "BUILDING"    if s >= 8  else "WATCH")
    if detailed:
        details = {k: {"pass": passed, "pts": pts, "note": note}
                   for k, (passed, pts, note) in criteria.items()}
        return s, zone, details
    return s, zone

def short_convergence_score(wein, inv_tpl, rs, phase, mkt, fund):
    s = 0
    if mkt.get("spxStage", 2) >= 3:        s += 1
    if mkt.get("spxEma") != "above":       s += 1
    if mkt.get("tplCount", 999) < 300:     s += 1
    stage = wein["stage"]
    if stage == "4A":                      s += 1
    if inv_tpl == 8:                       s += 1
    if rs <= 30:                           s += 1
    if phase in ("Red Light","Wedge"):     s += 1
    if inv_tpl >= 5:                       s += 1
    if fund.get("eps", 0)  < 0:            s += 1
    if fund.get("rev", 0)  < 0:            s += 1
    if not fund.get("marginsExpanding",True): s += 1
    s += 1; s += 1
    if phase in ("Red Light","Wedge"):     s += 1
    if rs <= 20:                           s += 1
    s += 3
    zone = ("SHORT_CONVERGENCE" if s >= 20 else
            "SHORT_SECONDARY"   if s >= 15 else
            "SHORT_WATCH"       if s >= 10 else "NEUTRAL")
    return s, zone

def build_setup_text(ticker, wein, tpl_score, rs, phase, vcp, conv_zone):
    if conv_zone == "CONVERGENCE":
        return (f"Full convergence — Stage {wein['stage']}, {tpl_score}/8 template, "
                f"RS {rs}, {phase}" +
                (f", VCP {vcp['count']}ct ({vcp['depths']})" if vcp["count"] > 0 else "") +
                ". All 3 frameworks agree.")
    elif conv_zone == "SECONDARY":
        return f"Secondary setup — {phase}, Stage {wein['stage']}, RS {rs}. Continuation watch."
    elif conv_zone == "BUILDING":
        issues = []
        if rs < 70:  issues.append(f"RS {rs} < 70")
        if tpl_score < 8: issues.append(f"{tpl_score}/8 template")
        if vcp["count"] < 2: issues.append("no VCP yet")
        return f"Building toward convergence. Issues: {', '.join(issues)}."
    else:
        return f"Early stage / watch only. Stage {wein['stage']}, RS {rs}, {tpl_score}/8 template."

# ─────────────────────────────────────────────
# TECHNICAL INDICATORS
# ─────────────────────────────────────────────
def calc_technicals(df):
    safe = {
        "rsi": 50.0,
        "macd": {"line": 0.0, "signal": 0.0, "histogram": 0.0, "bullish": False, "crossing_up": False},
        "bb": {"upper": 0.0, "lower": 0.0, "mid": 0.0, "width_pct": 0.0, "squeeze": False},
        "adx": 20.0, "adxClassification": "weak",
        "stoch": {"k": 50.0, "d": 50.0, "crossover": "none"},
        "obv_trend": "rising",
        "mas": {"ema10": 0.0, "ema20": 0.0, "sma50": 0.0, "sma150": 0.0, "sma200": 0.0},
        "maDistances": {},
        "high52": 0.0, "low52": 0.0, "pctFrom52h": 0.0, "pctFrom52l": 0.0,
        "adr_pct": 0.0, "adr5d": 0.0, "adrExpanding": False,
        "volumeProfile": {"avg50": 0, "avg20": 0, "today": 0, "ratio": 0},
    }
    if df is None or len(df) < 20:
        return safe

    try:
        c = df["Close"]
        h = df["High"]
        lo = df["Low"]
        vol = df["Volume"] if "Volume" in df.columns else pd.Series(np.ones(len(df)), index=df.index)
        price = float(c.iloc[-1])

        # RSI(14)
        delta = c.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(com=13, adjust=False).mean()
        avg_loss = loss.ewm(com=13, adjust=False).mean()
        rs_rsi = avg_gain / avg_loss.replace(0, np.nan)
        rsi_series = 100 - (100 / (1 + rs_rsi))
        safe["rsi"] = round(float(rsi_series.iloc[-1]), 1)

        # MACD(12,26,9)
        ema12 = c.ewm(span=12, adjust=False).mean()
        ema26 = c.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        macd_signal = macd_line.ewm(span=9, adjust=False).mean()
        macd_hist = macd_line - macd_signal
        ml = round(float(macd_line.iloc[-1]), 4)
        ms = round(float(macd_signal.iloc[-1]), 4)
        mh = round(float(macd_hist.iloc[-1]), 4)
        crossing_up = bool(mh > 0 and len(macd_hist) >= 2 and float(macd_hist.iloc[-2]) <= 0)
        safe["macd"] = {"line": ml, "signal": ms, "histogram": mh, "bullish": ml > ms, "crossing_up": crossing_up}

        # Bollinger Bands
        sma20 = c.rolling(20).mean()
        std20 = c.rolling(20).std()
        bb_u = float((sma20 + 2 * std20).iloc[-1])
        bb_l = float((sma20 - 2 * std20).iloc[-1])
        bb_m = float(sma20.iloc[-1])
        bw = ((bb_u - bb_l) / bb_m) if bb_m else 0
        bw_series = ((sma20 + 2*std20) - (sma20 - 2*std20)) / sma20
        avg_bw = float(bw_series.rolling(20).mean().iloc[-1]) if len(bw_series) >= 20 else bw
        safe["bb"] = {"upper": round(bb_u,2), "lower": round(bb_l,2), "mid": round(bb_m,2),
                       "width_pct": round(bw*100,2), "squeeze": bool(bw < avg_bw * 0.80)}

        # ADX
        tr1 = h - lo
        tr2 = (h - c.shift(1)).abs()
        tr3 = (lo - c.shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr14 = tr.ewm(com=13, adjust=False).mean()
        dm_plus = (h.diff()).clip(lower=0)
        dm_minus = (-lo.diff()).clip(lower=0)
        dm_plus_adj = dm_plus.where(dm_plus > dm_minus, 0)
        dm_minus_adj = dm_minus.where(dm_minus > dm_plus, 0)
        di_plus = 100 * dm_plus_adj.ewm(com=13, adjust=False).mean() / atr14.replace(0, np.nan)
        di_minus = 100 * dm_minus_adj.ewm(com=13, adjust=False).mean() / atr14.replace(0, np.nan)
        dx = 100 * (di_plus - di_minus).abs() / (di_plus + di_minus).replace(0, np.nan)
        adx_val = round(float(dx.ewm(com=13, adjust=False).mean().iloc[-1]), 1)
        safe["adx"] = adx_val
        safe["adxClassification"] = "very strong" if adx_val > 40 else ("strong" if adx_val > 20 else "weak")

        # Stochastic
        low14 = lo.rolling(14).min()
        high14 = h.rolling(14).max()
        k_series = 100 * (c - low14) / (high14 - low14).replace(0, np.nan)
        d_series = k_series.rolling(3).mean()
        sk = round(float(k_series.iloc[-1]), 1)
        sd = round(float(d_series.iloc[-1]), 1)
        cross = "bullish" if sk > sd and len(k_series) >= 2 and float(k_series.iloc[-2]) <= float(d_series.iloc[-2]) else \
                "bearish" if sk < sd and len(k_series) >= 2 and float(k_series.iloc[-2]) >= float(d_series.iloc[-2]) else "none"
        safe["stoch"] = {"k": sk, "d": sd, "crossover": cross}

        # OBV
        obv = (np.sign(c.diff()) * vol).fillna(0).cumsum()
        obv_ma20 = obv.rolling(20).mean()
        safe["obv_trend"] = "rising" if float(obv.iloc[-1]) > float(obv_ma20.iloc[-1]) else "falling"

        # Moving averages + distances
        ema10v = round(float(c.ewm(span=10, adjust=False).mean().iloc[-1]), 2)
        ema20v = round(float(c.ewm(span=20, adjust=False).mean().iloc[-1]), 2)
        sma50v = round(float(c.rolling(50).mean().iloc[-1]), 2) if len(c) >= 50 else 0.0
        sma150v = round(float(c.rolling(150).mean().iloc[-1]), 2) if len(c) >= 150 else 0.0
        sma200v = round(float(c.rolling(200).mean().iloc[-1]), 2) if len(c) >= 200 else 0.0
        safe["mas"] = {"ema10": ema10v, "ema20": ema20v, "sma50": sma50v, "sma150": sma150v, "sma200": sma200v}
        safe["maDistances"] = {
            "ema10": round((price/ema10v - 1)*100, 2) if ema10v else 0,
            "ema20": round((price/ema20v - 1)*100, 2) if ema20v else 0,
            "sma50": round((price/sma50v - 1)*100, 2) if sma50v else 0,
            "sma150": round((price/sma150v - 1)*100, 2) if sma150v else 0,
            "sma200": round((price/sma200v - 1)*100, 2) if sma200v else 0,
        }

        # 52-week
        lookback = min(252, len(h))
        h52 = round(float(h.iloc[-lookback:].max()), 2)
        l52 = round(float(lo.iloc[-lookback:].min()), 2)
        safe["high52"] = h52
        safe["low52"] = l52
        safe["pctFrom52h"] = round((price - h52) / h52 * 100, 1) if h52 else 0
        safe["pctFrom52l"] = round((price - l52) / l52 * 100, 1) if l52 else 0

        # ADR%
        adr20 = float(((h.iloc[-20:] - lo.iloc[-20:]) / c.iloc[-20:] * 100).mean()) if len(h) >= 20 else 0
        adr5 = float(((h.iloc[-5:] - lo.iloc[-5:]) / c.iloc[-5:] * 100).mean()) if len(h) >= 5 else 0
        safe["adr_pct"] = round(adr20, 2)
        safe["adr5d"] = round(adr5, 2)
        safe["adrExpanding"] = adr5 > adr20

        # Volume profile
        vol50 = int(float(vol.rolling(50).mean().iloc[-1])) if len(vol) >= 50 else 0
        vol20 = int(float(vol.rolling(20).mean().iloc[-1])) if len(vol) >= 20 else 0
        vol_today = int(float(vol.iloc[-1])) if not vol.empty else 0
        safe["volumeProfile"] = {
            "avg50": vol50, "avg20": vol20, "today": vol_today,
            "ratio": round(vol_today / vol50, 2) if vol50 > 0 else 0,
        }

    except Exception as e:
        log.warning(f"calc_technicals error: {e}")

    return safe

# ─────────────────────────────────────────────
# SUPPORT / RESISTANCE
# ─────────────────────────────────────────────
def calc_sr_levels(df):
    if df is None or len(df) < 50:
        return []
    try:
        c = df["Close"]
        h = df["High"]
        lo = df["Low"]
        price = float(c.iloc[-1])
        levels = []

        lookback = min(252, len(h))
        h52 = round(float(h.iloc[-lookback:].max()), 2)
        l52 = round(float(lo.iloc[-lookback:].min()), 2)
        levels.append({"price": h52, "type": "resistance", "label": "52W High", "strength": 3, "distance": round((h52/price-1)*100, 1)})
        levels.append({"price": l52, "type": "support", "label": "52W Low", "strength": 3, "distance": round((l52/price-1)*100, 1)})

        for sma_len, label in [(200, "200d SMA"), (150, "150d SMA"), (50, "50d SMA")]:
            if len(c) >= sma_len:
                val = round(float(c.rolling(sma_len).mean().iloc[-1]), 2)
                t = "support" if price > val else "resistance"
                levels.append({"price": val, "type": t, "label": label, "strength": 2, "distance": round((val/price-1)*100, 1)})

        if len(df) >= 80:
            ch = round(float(h.iloc[-80:-20].max()), 2)
            cl = round(float(lo.iloc[-80:-20].min()), 2)
            levels.append({"price": ch, "type": "resistance" if price < ch else "support", "label": "Prior Consol High", "strength": 2, "distance": round((ch/price-1)*100, 1)})
            levels.append({"price": cl, "type": "support" if price > cl else "resistance", "label": "Prior Consol Low", "strength": 1, "distance": round((cl/price-1)*100, 1)})

        # Round number levels
        for rnd in [int(price * 0.9 / 10) * 10, int(price / 10) * 10, int(price * 1.1 / 10) * 10]:
            if rnd > 0 and abs(rnd - price) / price > 0.02:
                t = "resistance" if rnd > price else "support"
                levels.append({"price": float(rnd), "type": t, "label": f"Round ${rnd}", "strength": 1, "distance": round((rnd/price-1)*100, 1)})

        levels.sort(key=lambda x: x["price"], reverse=True)
        deduped = []
        for lvl in levels:
            if not deduped or (deduped[-1]["price"] > 0 and abs(lvl["price"] - deduped[-1]["price"]) / deduped[-1]["price"] >= 0.01):
                deduped.append(lvl)
        return deduped[:10]
    except Exception as e:
        log.warning(f"calc_sr_levels error: {e}")
        return []

# ─────────────────────────────────────────────
# CORE ANALYSIS
# ─────────────────────────────────────────────
_spy_df: Optional[pd.DataFrame] = None
_mkt_snapshot: dict = {"spxStage": 2, "spxEma": "above", "tplCount": 500, "vix": 20}

def get_spy():
    global _spy_df
    if _spy_df is not None and len(_spy_df) > 200:
        return _spy_df
    _spy_df = fetch_ohlcv("SPY", "2y")
    return _spy_df

def analyze_ticker(ticker: str, spy_df: pd.DataFrame, mkt: dict) -> Optional[dict]:
    try:
        df = fetch_ohlcv(ticker, "2y")
        if df is None or len(df) < 60:
            return None
        time.sleep(0.3)

        fund = fetch_fundamentals(ticker)
        time.sleep(0.2)

        dp, wp, mp, qp, hp, yp = (0, 0, 0, 0, 0, 0)
        try: dp, wp, mp, qp, hp, yp = calc_returns(df)
        except Exception: pass

        rs = 50
        try: rs = calc_rs_rating(df, spy_df)
        except Exception: pass

        wein = {"stage": "?", "ma150": None, "slopeWeeks": 0, "slopeRising": False, "pctFromMA": 0}
        try: wein = weinstein_stage(df)
        except Exception: pass

        tpl_criteria, tpl_score = [False]*8, 0
        try: tpl_criteria, tpl_score = minervini_template(df, rs)
        except Exception: pass

        phase, light, ema_d, ema_w, ema_m = "Unknown", "gray", "neutral", "neutral", "neutral"
        ema10v, ema20v, ema50v, ema100v, ema200v = 0.0, 0.0, 0.0, 0.0, 0.0
        try:
            kell_result = kell_phase(df)
            phase, light, ema_d, ema_w, ema_m = kell_result[:5]
            ema10v, ema20v, ema50v, ema100v, ema200v = kell_result[5:]
        except Exception: pass

        vcp = {"count": 0, "depths": "—", "pivot": None, "tightness": 0, "volDryup": False}
        try: vcp = detect_vcp(df)
        except Exception: pass

        technicals = {}
        try: technicals = calc_technicals(df)
        except Exception: pass

        sr_levels = []
        try: sr_levels = calc_sr_levels(df)
        except Exception: pass

        base = max(1, int(len([p for p in [wein["stage"]] if p in ("2A","2B")]) + vcp["count"] / 2))

        conv_s, conv_z = convergence_score(wein, tpl_score, rs, phase, vcp, mkt, fund, df)

        inv_criteria, inv_score = [False]*8, 0
        try: inv_criteria, inv_score = inverse_template(df, rs)
        except Exception: pass
        short_s, short_z = short_convergence_score(wein, inv_score, rs, phase, mkt, fund)

        flags = []
        if rs < 70: flags.append(f"RS {rs} < 70")
        if tpl_score < 8: flags.append(f"{tpl_score}/8 template")
        if wein["stage"] == "2B": flags.append("Stage 2B (mature)")
        if fund.get("eps", 0) <= 0: flags.append("EPS negative")
        if vcp["count"] == 0: flags.append("No VCP")

        price = float(df["Close"].iloc[-1])
        vol_ratio = technicals.get("volumeProfile", {}).get("ratio", 1.0)

        # FINRA short volume
        finra_data = {}
        try:
            finra_data = finra.analyze_ticker(ticker)
            svr = finra_data.get("svr_today")
            # Convergence adjustment: +1 if SVR < 35% (longs) or > 55% (shorts)
            finra_adj = finra.convergence_adjustment(ticker, is_short=wein["stage"] in ("3", "4A", "4B"))
            conv_s += finra_adj
            if finra_adj > 0:
                conv_z = _recalc_zone(conv_s, 23)
        except Exception:
            svr = None

        # Macro context
        macro_data = _macro_cache or {}
        macro_sc = macro_data.get("score", {}).get("score", 5)
        events = macro_data.get("events", [])
        event_imminent = any(e.get("imminent") for e in events)
        sector_aligned = True  # Default; could check sector-specific context

        # Qullamaggie momentum setup analysis
        qull_data = {}
        qull_breakout_score = 0
        try:
            mcap = fund.get("marketCap", 0)
            qull_data = qull.analyze_qullamaggie(ticker, df, fundamentals=fund, market_cap=mcap)
            bo = qull_data.get("breakout")
            if bo and bo.get("passed"):
                qull_breakout_score = bo.get("score", 0)
            # Dual convergence: +5 bonus if MKW conv >= 20 AND Qullamaggie breakout >= 70
            dual = qull.check_dual_convergence(conv_s, 23, qull_breakout_score)
            if dual["is_dual_convergence"]:
                conv_s += dual["bonus_points"]
                conv_z = _recalc_zone(conv_s, 23)
                qull_data["dual_convergence"] = True
            else:
                qull_data["dual_convergence"] = False
        except Exception as e:
            log.warning(f"Qullamaggie scan {ticker}: {e}")

        # Quick grade (without full options data for speed)
        is_short = wein["stage"] in ("3", "4A", "4B")
        quick_grade = grade_trade(
            conv_score=conv_s, conv_max=23, conv_zone=conv_z,
            wein_stage=wein["stage"], tpl_score=tpl_score, rs=rs,
            phase=phase, ema_d=ema_d, ema_w=ema_w, ema_m=ema_m,
            vcp_pivot=vcp.get("pivot"), current_price=price,
            vol_ratio=vol_ratio, is_short=is_short,
            short_vol_ratio=svr / 100 if svr else 0.5,
            macro_score=macro_sc, event_imminent=event_imminent,
            sector_aligned=sector_aligned,
            qullamaggie_breakout_score=qull_breakout_score,
        )

        return {
            "tk": ticker,
            "nm": fund.get("name", ticker),
            "px": round(price, 2),
            "dp": dp, "wp": wp, "mp": mp, "qp": qp, "hp": hp, "yp": yp,
            "wein": {
                "stage": wein["stage"], "ma150": wein["ma150"],
                "slopeWeeks": wein["slopeWeeks"], "slopeRising": wein["slopeRising"],
                "pctFromMA": wein["pctFromMA"],
            },
            "min": {
                "tpl": tpl_criteria, "tplScore": tpl_score, "rs": rs,
                "eps": fund.get("eps", 0), "rev": fund.get("rev", 0),
                "marginsExpanding": fund.get("marginsExpanding", False),
                "pivot": vcp["pivot"],
            },
            "vcp": vcp,
            "kell": {
                "phase": phase, "light": light,
                "emaD": ema_d, "emaW": ema_w, "emaM": ema_m,
                "base": base,
                "ema10v": ema10v, "ema20v": ema20v, "ema50v": ema50v,
                "ema100v": ema100v, "ema200v": ema200v,
            },
            "conv": {"score": conv_s, "max": 23, "zone": conv_z},
            "finra": finra_data,
            "qullamaggie": qull_data,
            "shortConv": {
                "score": short_s, "max": 22, "zone": short_z,
                "invTpl": inv_criteria, "invScore": inv_score,
            },
            "grade": quick_grade,
            "setup": build_setup_text(ticker, wein, tpl_score, rs, phase, vcp, conv_z),
            "risk": f"Stage {wein['stage']} · RS {rs} · {phase}",
            "flags": flags,
            "fundamentals": fund,
            "technicals": technicals,
            "srLevels": sr_levels,
            "sector": fund.get("sector", ""),
        }
    except Exception as e:
        log.error(f"analyze_ticker({ticker}): {e}")
        return None

# ─────────────────────────────────────────────
# MARKET BREADTH
# ─────────────────────────────────────────────
def compute_breadth():
    indices = {"SPY": "S&P 500", "QQQ": "NASDAQ 100", "IWM": "Russell 2000", "^VIX": "VIX"}
    result = {}
    for sym, name in indices.items():
        try:
            df = fetch_ohlcv(sym, "6mo")
            if df is None: continue
            price = float(df["Close"].iloc[-1])
            dp, *_ = calc_returns(df)
            if sym == "^VIX":
                result["vix"] = round(price, 2)
            else:
                key = sym.lower().replace("^","")
                e20 = float(df["Close"].ewm(span=20, adjust=False).mean().iloc[-1])
                w = weinstein_stage(df)
                result[key] = {
                    "name": name, "price": round(price, 2), "chg": dp[0] if isinstance(dp, tuple) else dp,
                    "stage": int(w["stage"][0]) if w["stage"][0].isdigit() else 2,
                    "stageLabel": w["stage"], "ema20": "above" if price > e20 else "below",
                }
            time.sleep(0.3)
        except Exception as e:
            log.warning(f"Breadth {sym}: {e}")

    sectors = []
    for etf in SECTOR_ETFS:
        try:
            df = fetch_ohlcv(etf, "3mo")
            if df is None: continue
            rets = calc_returns(df)
            w = weinstein_stage(df)
            sectors.append({"n": SECTOR_NAMES.get(etf, etf), "etf": etf,
                           "p": rets[0], "wp": rets[1], "mp": rets[2], "stage": w["stage"]})
            time.sleep(0.3)
        except Exception:
            pass

    scan_tickers = WATCHLIST[:30]
    tpl_count = 0
    spy_df_tmp = get_spy()
    for t in scan_tickers:
        try:
            df = fetch_ohlcv(t, "2y")
            if df is None or len(df) < 200: continue
            rs = calc_rs_rating(df, spy_df_tmp) if spy_df_tmp is not None else 50
            _, score = minervini_template(df, rs)
            if score >= 6: tpl_count += 1
            time.sleep(0.25)
        except Exception:
            pass
    tpl_count_est = int(tpl_count / max(1, len(scan_tickers)) * 500)

    spx = result.get("spy", {})
    return {
        "spx": spx, "ndx": result.get("qqq", {}), "rut": result.get("iwm", {}),
        "vix": result.get("vix", 20),
        "spxStage": spx.get("stage", 2), "spxEma": spx.get("ema20", "above"),
        "tplCount": tpl_count_est, "sectors": sectors,
        "lastUpdated": datetime.utcnow().isoformat(),
    }

# ─────────────────────────────────────────────
# THREATS
# ─────────────────────────────────────────────
def compute_threats(spy_df, mkt):
    results = []
    for tk in THREATS_LIST:
        try:
            data = analyze_ticker(tk, spy_df, mkt)
            if data is None: continue
            short_s = data["shortConv"]["score"]
            threat_sc = round(min(10, short_s / 22 * 10), 1)
            wein = data["wein"]
            div_signals = []
            if wein["stage"] in ("3","4A","4B"):
                div_signals.append(f"Weinstein Stage {wein['stage']}")
            if data["min"]["tplScore"] <= 3:
                div_signals.append(f"Template {data['min']['tplScore']}/8 — failing")
            if data["kell"]["phase"] in ("Red Light","Wedge","Extension"):
                div_signals.append(f"Kell {data['kell']['phase']}")
            if data["min"]["rs"] < 30:
                div_signals.append(f"RS {data['min']['rs']} — laggard")

            stage = wein["stage"]
            ttype = "Stage 4 Decline" if stage in ("4A","4B") else "Distribution" if stage == "3" else "Divergence"

            results.append({
                "tk": tk, "sc": threat_sc, "type": ttype,
                "sum": data["setup"], "mc": data["mp"],
                "wein": data["wein"], "divSignals": div_signals,
                "shortConv": data["shortConv"], "grade": data.get("grade", {}),
            })
        except Exception as e:
            log.error(f"Threat {tk}: {e}")
    return results

# ─────────────────────────────────────────────
# NEWS & EARNINGS
# ─────────────────────────────────────────────
def fetch_news_data(watchlist_tickers):
    market_news, watchlist_alerts = [], []
    if not FINNHUB_KEY:
        return {"watchlistAlerts": [], "marketNews": [], "note": "Set FINNHUB_API_KEY for news"}

    gen_news = finnhub_get("/news", {"category": "general", "minId": 0})
    if isinstance(gen_news, list):
        for n in gen_news[:20]:
            headline = n.get("headline", "")
            risk_keywords = ["downgrade", "investigation", "recall", "lawsuit", "fraud", "sec", "warning"]
            is_risk = any(kw in headline.lower() for kw in risk_keywords)
            market_news.append({
                "headline": headline, "source": n.get("source", ""),
                "summary": n.get("summary", ""), "time": n.get("datetime", 0),
                "url": n.get("url", ""), "isRisk": is_risk,
            })

    from_date = (datetime.utcnow() - timedelta(days=3)).strftime("%Y-%m-%d")
    to_date = datetime.utcnow().strftime("%Y-%m-%d")
    for tk in watchlist_tickers[:8]:
        try:
            news = finnhub_get("/company-news", {"symbol": tk, "from": from_date, "to": to_date})
            if isinstance(news, list):
                for n in news[:3]:
                    watchlist_alerts.append({
                        "ticker": tk, "headline": n.get("headline", ""),
                        "source": n.get("source", ""), "summary": n.get("summary", ""),
                        "time": n.get("datetime", 0),
                    })
            time.sleep(0.2)
        except Exception:
            pass

    return {
        "watchlistAlerts": sorted(watchlist_alerts, key=lambda x: x["time"], reverse=True)[:20],
        "marketNews": sorted(market_news, key=lambda x: x["time"], reverse=True)[:30],
    }

def fetch_earnings_calendar(tickers):
    if not FINNHUB_KEY:
        return []
    from_date = datetime.utcnow().strftime("%Y-%m-%d")
    to_date = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
    cal = finnhub_get("/calendar/earnings", {"from": from_date, "to": to_date})
    results = []
    if isinstance(cal, dict) and "earningsCalendar" in cal:
        for e in cal["earningsCalendar"]:
            sym = e.get("symbol","")
            if sym in tickers:
                results.append({
                    "ticker": sym, "date": e.get("date",""),
                    "eps_est": e.get("epsEstimate"), "hour": e.get("hour",""),
                })
    return sorted(results, key=lambda x: x["date"])

# ─────────────────────────────────────────────
# DAILY BRIEF
# ─────────────────────────────────────────────
def generate_programmatic_brief(watchlist_data, breadth, threats):
    vix = breadth.get("vix", "—")
    stage = breadth.get("spxStage", "?")
    ema_pos = breadth.get("spxEma", "?")
    tpl_cnt = breadth.get("tplCount", 0)

    # Use normalized flat field names
    conv = [s for s in watchlist_data if (s.get("zone") or "").upper() == "CONVERGENCE"]
    sec = [s for s in watchlist_data if (s.get("zone") or "").upper() == "SECONDARY"]
    bld = [s for s in watchlist_data if (s.get("zone") or "").upper() == "BUILDING"]
    shorts = [s for s in watchlist_data if "SHORT" in (s.get("zone") or "").upper()]

    mkt_color = "BULL" if ema_pos == "above" and str(stage).startswith("2") else "BEAR" if ema_pos == "below" else "CAUTION"
    vix_flag = "Elevated — reduce size" if isinstance(vix, (int,float)) and vix > 25 else "Normal"

    # Find top setup by grade score
    top_setup = None
    if conv:
        sorted_conv = sorted(conv, key=lambda x: x.get("grade_score", 0), reverse=True)
        top_setup = sorted_conv[0]

    # Position sizing guidance
    if isinstance(vix, (int,float)):
        if vix > 30:
            size_guide = "HIGH VIX — reduce all position sizes by 50%. No new entries unless AAA."
        elif vix > 25:
            size_guide = "Elevated VIX — reduce new entries to 75% normal size."
        elif vix < 15:
            size_guide = "Low VIX — full position sizes. Market calm."
        else:
            size_guide = "Normal VIX range. Standard position sizing."
    else:
        size_guide = "VIX data unavailable."

    lines = [
        f"# MKW MORNING BRIEF — {datetime.utcnow().strftime('%A, %B %d, %Y').upper()}",
        f"\n## MARKET REGIME: {mkt_color}",
        f"**S&P 500:** Stage {stage}, {ema_pos} 20 EMA",
        f"**VIX:** {vix} — {vix_flag}",
        f"**Template Qualifiers:** ~{tpl_cnt} stocks passing Minervini 8-point template",
        f"**Position Sizing:** {size_guide}",
    ]

    if not conv and not sec:
        lines += [
            "",
            "## NO AAA SETUPS TODAY",
            "**Capital preservation IS a position.** No stocks currently meet full convergence criteria.",
            "Review BUILDING names for approaching setups. Stay patient.",
        ]
    else:
        lines += ["", "## CONVERGENCE SETUPS (HIGHEST CONVICTION)"]
        if conv:
            for s in conv:
                lines.append(f"- **{s.get('ticker','?')}** {s.get('grade','?')} ({s.get('grade_score',0)}/100) — Score {s.get('convergence_score',0)}/23 · RS {s.get('rs',0)} · {s.get('phase','?')} · Stage {s.get('stage','?')}")
        else:
            lines.append("- None currently")

        lines += ["", "## SECONDARY SETUPS"]
        if sec:
            for s in sec:
                lines.append(f"- **{s.get('ticker','?')}** — Score {s.get('convergence_score',0)}/23 · RS {s.get('rs',0)} · {s.get('phase','?')}")
        else:
            lines.append("- None currently")

    lines += ["", "## BUILDING (APPROACHING)"]
    if bld:
        for s in bld[:5]:
            lines.append(f"- **{s.get('ticker','?')}** — Score {s.get('convergence_score',0)}/23 · {s.get('setup','')}")
    else:
        lines.append("- None building currently")

    if shorts:
        lines += ["", "## SHORT SETUPS"]
        for s in shorts[:3]:
            sc = s.get("shortConv", {})
            lines.append(f"- **{s.get('ticker','?')}** — Short score {sc.get('score',0)} · {sc.get('zone','?')}")

    if top_setup:
        gd = top_setup.get("grade_detail", {})
        lines += [
            "",
            f"## TOP SETUP: {top_setup.get('ticker','?')} — {top_setup.get('grade','?')} ({top_setup.get('grade_score',0)}/100)",
            f"**{top_setup.get('setup','')}**",
            f"RS {top_setup.get('rs',0)} · Stage {top_setup.get('stage','?')} · {top_setup.get('phase','?')}",
            f"Grade breakdown: {gd.get('summary', 'N/A')}",
        ]

    # Qullamaggie setups section
    qull_triggering = [s for s in watchlist_data if s.get("qull_any_triggering")]
    qull_watching = [s for s in watchlist_data if s.get("qull_any_setup") and not s.get("qull_any_triggering")]
    dual_conv = [s for s in watchlist_data if s.get("qull_dual_convergence")]

    if dual_conv:
        lines += ["", "## DUAL CONVERGENCE (MAXIMUM CONVICTION)"]
        for s in dual_conv:
            bo_score = (s.get("qullamaggie") or {}).get("breakout", {}).get("score", 0)
            lines.append(
                f"- **{s.get('ticker','?')}**: MKW {s.get('convergence_score',0)}/23 + "
                f"Qullamaggie Breakout {bo_score}/100 = DUAL CONVERGENCE"
            )

    if qull_triggering:
        lines += ["", "## QULLAMAGGIE SETUPS — TRIGGERING NOW"]
        for s in qull_triggering[:5]:
            for setup in s.get("qull_setups_summary", []):
                if setup.get("triggering"):
                    lines.append(f"- **{s.get('ticker','?')}** [{setup.get('type','')}] Score {setup.get('score',0)}/100 — {setup.get('detail','')}")

    if qull_watching:
        lines += ["", "## QULLAMAGGIE SETUPS — WATCHING"]
        for s in qull_watching[:5]:
            best = s.get("qull_best_setup", "")
            score = s.get("qull_best_score", 0)
            lines.append(f"- **{s.get('ticker','?')}** [{best}] Score {score}/100")

    if threats:
        lines += ["", "## DIVERGENCE ALERTS"]
        for t in threats[:3]:
            lines.append(f"- **{t.get('tk', t.get('ticker','?'))}**: {t.get('type','—')} (threat {t.get('sc', t.get('threat_score','—'))}/10)")

    lines += [
        "", "## ACTION ITEMS",
        f"1. Review **{len(conv)} convergence** and **{len(sec)} secondary** setups",
    ]
    if dual_conv:
        lines.append(f"2. **{len(dual_conv)} DUAL CONVERGENCE** setups — highest conviction, prioritize these")
    if qull_triggering:
        lines.append(f"3. **{len(qull_triggering)} Qullamaggie setups TRIGGERING** — check entry timing now")
    lines += [
        f"{'4' if dual_conv or qull_triggering else '2'}. Check entry timing — prioritize EMA Crossback and Pop phases",
        f"{'5' if dual_conv or qull_triggering else '3'}. Monitor VIX ({vix}) for position sizing guidance",
    ]

    return "\n".join(lines)

def generate_daily_brief(watchlist_data, breadth, threats):
    tier1 = generate_programmatic_brief(watchlist_data, breadth, threats)

    # Add macro section to tier1
    macro_data = _macro_cache or {}
    if macro_data.get("score"):
        tier1["macro"] = {
            "score": macro_data["score"],
            "rates": macro_data.get("rates", {}),
            "events": macro_data.get("events", [])[:5],
            "sizing_modifier": macro_data.get("sizing_modifier", 0.75),
        }

    # Add FINRA short volume intelligence
    top_short = finra.top_short_volume(list(WATCHLIST), n=5)
    if top_short:
        tier1["shortVolumeIntel"] = [
            {"ticker": s["ticker"], "svr": s["svr_today"], "signal": s["signal"], "color": s["color"]}
            for s in top_short if s.get("svr_today") is not None
        ]

    if not CLAUDE_KEY:
        return {"tier1": tier1, "tier2": None, "note": "Set ANTHROPIC_API_KEY for AI-enhanced brief"}

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=CLAUDE_KEY)

        # Use normalized flat fields
        conv = [s for s in watchlist_data if (s.get("zone") or "").upper() == "CONVERGENCE"]
        sec = [s for s in watchlist_data if (s.get("zone") or "").upper() == "SECONDARY"]
        shorts = [s for s in watchlist_data if "SHORT" in (s.get("zone") or "").upper()]

        macro_ctx = ""
        if macro_data.get("score"):
            ms = macro_data["score"]
            events = macro_data.get("events", [])
            event_str = ", ".join([f"{e['name']} in {e['days_until']}d" for e in events[:3]])
            macro_ctx = f"\nMACRO: Score {ms['score']}/10 ({ms['regime']}), sizing {ms.get('sizing', 'standard')}. Events: {event_str or 'none upcoming'}"

        finra_ctx = ""
        if top_short:
            finra_ctx = f"\nSHORT VOLUME: Top SVR — " + ", ".join([f"{s['ticker']} {s['svr_today']}%" for s in top_short[:5]])

        context = f"""MARKET: SPX Stage {breadth.get('spxStage')}, {breadth.get('spxEma')} 20 EMA, VIX {breadth.get('vix')}, ~{breadth.get('tplCount')} TPL qualifiers{macro_ctx}{finra_ctx}
CONVERGENCE ({len(conv)}): {json.dumps([{"tk":s.get("ticker","?"),"grade":s.get("grade","?"),"score":s.get("convergence_score",0),"rs":s.get("rs",0),"phase":s.get("phase","?")} for s in conv])}
SECONDARY ({len(sec)}): {json.dumps([{"tk":s.get("ticker","?"),"score":s.get("convergence_score",0)} for s in sec])}
SHORTS ({len(shorts)}): {json.dumps([{"tk":s.get("ticker","?"),"shortScore":s.get("shortConv",{}).get("score",0)} for s in shorts])}
THREATS: {json.dumps([{"tk":t.get("tk","?"),"type":t.get("type","?"),"score":t.get("sc",0)} for t in threats])}"""

        msg = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            system=("You are a trading desk analyst at a top hedge fund writing the morning brief for the PM. "
                    "The PM runs a concentrated swing book using the MKW convergence system. "
                    "Write in the voice of a sharp, experienced analyst. Be specific — use tickers, prices, levels. "
                    "Open with the one thing the PM needs to know most. Then regime, top ideas, risks. "
                    "Under 500 words. No disclaimers. Write like money is on the line."),
            messages=[{"role": "user", "content": f"Generate today's MKW morning brief:\n{context}"}]
        )
        tier2 = msg.content[0].text
        return {"tier1": tier1, "tier2": tier2}
    except Exception as e:
        log.error(f"Claude API error: {e}")
        return {"tier1": tier1, "tier2": None, "error": str(e)}

# ─────────────────────────────────────────────
# SCREENER PRESETS
# ─────────────────────────────────────────────
SCREENER_PRESETS = {
    "convergence_longs": {
        "name": "MKW Convergence Longs",
        "description": "Stage 2A + Template 8/8 + RS >= 80 + VCP + Kell Crossback/Pop + IV Rank < 50",
        "filters": {"stage": "2A", "template_min": 8, "rs_min": 80, "vcp": True, "zone": "CONVERGENCE"},
    },
    "convergence_shorts": {
        "name": "MKW Convergence Shorts",
        "description": "Stage 4A + Inverse template 8/8 + RS < 30 + Kell Red Light",
        "filters": {"stage": "4", "rs_max": 30, "short_mode": True, "zone": "SHORT_CONVERGENCE"},
    },
    "vcp_coil": {
        "name": "VCP Coil Scanner",
        "description": "Template 7/8+ + ADR% declining + BB squeeze + Volume < 60% avg",
        "filters": {"template_min": 7, "vcp": True},
    },
    "rs_emerging": {
        "name": "RS Emerging Leaders",
        "description": "RS >= 70 + Price above rising 50d MA + Stage 2",
        "filters": {"rs_min": 70, "stage": "2", "template_min": 5},
    },
    "stage_transition": {
        "name": "Stage Transition Alerts",
        "description": "Stocks with 30-week MA direction change in past 2 weeks",
        "filters": {"template_min": 0},
    },
    "vol_crush": {
        "name": "Volatility Crush Candidates",
        "description": "IV Rank > 70 + Template 7/8+ + Earnings approaching",
        "filters": {"template_min": 7},
    },
    "strong_setup": {
        "name": "Strong Setups (A+ Grade)",
        "description": "All stocks grading A or above on the 100-point system",
        "filters": {"template_min": 6, "rs_min": 60},
    },
    "all_convergence": {
        "name": "All Convergence Zones",
        "description": "Every stock sorted by convergence score",
        "filters": {},
    },
    "short_squeeze": {
        "name": "Short Squeeze Candidates",
        "description": "SVR > 55% + rising + resilient price — potential squeeze setups",
        "filters": {},
        "special": "short_squeeze",
    },
    "distribution": {
        "name": "Distribution Detection",
        "description": "SVR spike + rising trend — potential institutional selling",
        "filters": {},
        "special": "distribution",
    },
    "qull_breakouts": {
        "name": "Qullamaggie Breakouts",
        "description": "Big prior move + orderly pullback + tight consolidation — breakout watch",
        "filters": {},
        "special": "qull_breakouts",
    },
    "qull_parabolic": {
        "name": "Qullamaggie Parabolic",
        "description": "Overextended stocks (short setups) and oversold bounces (long setups)",
        "filters": {},
        "special": "qull_parabolic",
    },
    "qull_ep": {
        "name": "Qullamaggie Episodic Pivots",
        "description": "Big gap + big volume + prior neglect — catalyst-driven moves",
        "filters": {},
        "special": "qull_ep",
    },
    "dual_convergence": {
        "name": "Dual Convergence (MKW + Qullamaggie)",
        "description": "Stocks passing BOTH MKW convergence AND Qullamaggie breakout — maximum conviction",
        "filters": {},
        "special": "dual_convergence",
    },
}

# ─────────────────────────────────────────────
# SCANNER MODULES
# ─────────────────────────────────────────────
SCANNER_MODULES = {
    "mega_cap": {
        "name": "Mega Cap Momentum",
        "description": "Market cap > $100B + Stage 2 + RS > 60 + volume confirmation",
        "icon": "crown",
    },
    "canslim": {
        "name": "CANSLIM Composite",
        "description": "Strong earnings growth + RS leader + Stage 2 uptrend",
        "icon": "chart",
    },
    "new_highs": {
        "name": "New Highs Power",
        "description": "Within 5% of 52-week high with volume and uptrend confirmation",
        "icon": "arrow_up",
    },
    "rs_leaders": {
        "name": "Relative Strength Leaders",
        "description": "RS >= 80 + Template 6/8+ — strongest momentum names",
        "icon": "bolt",
    },
    "todays_watch": {
        "name": "Today's Watch",
        "description": "Convergence/Secondary zone stocks with actionable entry signals",
        "icon": "eye",
    },
    "intraday": {
        "name": "Intra-Day Movers",
        "description": "Day change > 2% or unusual volume — active momentum",
        "icon": "zap",
    },
}


def _run_scanner(module: str, stocks: list) -> list:
    """Apply scanner-specific filters to the cached watchlist stocks."""
    if module == "mega_cap":
        filtered = []
        for s in stocks:
            mcap = s.get("market_cap") or s.get("marketCap") or 0
            stage = str(s.get("stage", "?"))
            rs = s.get("rs") or s.get("relative_strength") or 0
            if mcap > 100e9 and stage in ("2A", "2B") and rs >= 60:
                filtered.append(s)
        filtered.sort(key=lambda x: (x.get("rs", 0), x.get("day_change", 0)), reverse=True)

    elif module == "canslim":
        filtered = []
        for s in stocks:
            fund = s.get("fundamentals", {})
            eps = fund.get("eps") or fund.get("eps_growth") or 0
            rev = fund.get("rev") or fund.get("rev_growth") or fund.get("revenue_growth") or 0
            rs = s.get("rs") or 0
            stage = str(s.get("stage", "?"))
            # CANSLIM: strong earnings, strong RS, confirmed uptrend
            # Relaxed: EPS or Rev > 15%, RS > 70, Stage 2
            if (eps >= 15 or rev >= 15) and rs >= 70 and stage in ("2A", "2B"):
                # Calculate CANSLIM score (0-7)
                score = 0
                if eps >= 25: score += 1  # C: Current earnings
                if eps >= 15: score += 1  # A: Annual earnings (approx)
                pct52 = s.get("pct_from_52h") or s.get("technicals", {}).get("pctFrom52h")
                if pct52 is not None and abs(pct52) <= 10: score += 1  # N: New highs
                if s.get("technicals", {}).get("volumeProfile", {}).get("ratio", 1) > 1.0: score += 1  # S: Supply/demand
                if rs >= 80: score += 1  # L: Leader
                score += 1  # I: Institutional (assume for large caps)
                score += 1  # M: Market direction (assume we're in S2)
                s = {**s, "canslim_score": score}
                filtered.append(s)
        filtered.sort(key=lambda x: (x.get("canslim_score", 0), x.get("rs", 0)), reverse=True)

    elif module == "new_highs":
        filtered = []
        for s in stocks:
            pct52 = s.get("pct_from_52h") or s.get("technicals", {}).get("pctFrom52h")
            stage = str(s.get("stage", "?"))
            if pct52 is not None and abs(pct52) <= 5 and stage in ("2A", "2B", "3"):
                filtered.append(s)
        filtered.sort(key=lambda x: abs(x.get("pct_from_52h") or x.get("technicals", {}).get("pctFrom52h", -99)), reverse=False)

    elif module == "rs_leaders":
        filtered = []
        for s in stocks:
            rs = s.get("rs") or s.get("relative_strength") or 0
            tpl = s.get("template_score") or s.get("minervini_score") or 0
            if rs >= 80 and tpl >= 6:
                filtered.append(s)
        filtered.sort(key=lambda x: x.get("rs", 0), reverse=True)

    elif module == "todays_watch":
        filtered = []
        for s in stocks:
            zone = s.get("zone", "")
            phase = s.get("kell_phase") or s.get("phase") or ""
            score = s.get("convergence_score") or s.get("score") or 0
            # Convergence/Secondary with actionable phases, or high convergence score
            if zone in ("CONVERGENCE", "SECONDARY") or score >= 16:
                # Bonus points for actionable phases
                phase_bonus = 10 if phase in ("EMA Crossback", "Pop", "Base n Break") else 0
                zone_bonus = 20 if zone == "CONVERGENCE" else 10 if zone == "SECONDARY" else 0
                watch_score = score + phase_bonus + zone_bonus
                s = {**s, "watch_score": watch_score}
                filtered.append(s)
        filtered.sort(key=lambda x: x.get("watch_score", 0), reverse=True)

    elif module == "intraday":
        filtered = []
        for s in stocks:
            day_chg = abs(s.get("day_change") or s.get("dp") or 0)
            vol_ratio = s.get("technicals", {}).get("volumeProfile", {}).get("ratio", 0) or 0
            # Day change > 2% or volume > 2x average
            if day_chg >= 2.0 or vol_ratio >= 2.0:
                momentum = day_chg + (vol_ratio * 2 if vol_ratio >= 1.5 else 0)
                s = {**s, "momentum_score": round(momentum, 1)}
                filtered.append(s)
        filtered.sort(key=lambda x: x.get("momentum_score", 0), reverse=True)

    else:
        filtered = []

    return filtered[:20]  # Cap at 20 results


# ─────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────
def _warmup():
    log.info("Warming up watchlist cache...")
    try:
        resp = _build_watchlist()
        if resp:
            cache_set("watchlist", resp)
            log.info(f"Watchlist cache warmed: {len(resp.get('stocks', []))} stocks")
    except Exception as e:
        log.warning(f"Warmup failed: {e}")

def _warmup_data_sources():
    """Initialize FINRA and FRED data in background."""
    global _macro_cache
    try:
        # FINRA: download recent short volume data
        universe = list(WATCHLIST) + THREATS_LIST
        finra.update_history(universe)
        log.info("FINRA short volume data loaded")
    except Exception as e:
        log.warning(f"FINRA warmup failed: {e}")

    try:
        # FRED: fetch macro data
        _macro_cache = macro.get_full_macro()
        if _macro_cache.get("score"):
            log.info(f"Macro score: {_macro_cache['score'].get('score', '?')}/10 ({_macro_cache['score'].get('regime', '?')})")
    except Exception as e:
        log.warning(f"FRED warmup failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _positions
    _positions = load_positions()
    log.info(f"Loaded {len(_positions)} positions")
    log.info(f"Data sources: Polygon={'YES' if POLYGON_KEY else 'NO'} | FRED={'YES' if FRED_KEY else 'NO'} | Finnhub={'YES' if FINNHUB_KEY else 'NO'}")
    get_spy()
    import threading
    threading.Thread(target=_warmup, daemon=True).start()
    threading.Thread(target=_warmup_data_sources, daemon=True).start()
    yield

app = FastAPI(title="MKW Command Center v2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc), "type": type(exc).__name__})

def _conv_details_to_list(details) -> list:
    """Convert convergenceDetails dict to list for frontend checklist."""
    if isinstance(details, list):
        return details
    if isinstance(details, dict):
        return [
            {"name": k, "label": v.get("note", k), "pass": v.get("pass", False),
             "detail": v.get("note", ""), "pts": v.get("pts", 0)}
            for k, v in details.items()
        ]
    return []


def _normalize_stock(s: dict) -> dict:
    """Flatten abbreviated backend fields into frontend-friendly shape."""
    grade_obj = s.get("grade", {})
    conv = s.get("conv", {})
    kell = s.get("kell", {})
    wein = s.get("wein", {})
    mn = s.get("min", {})
    vcp = s.get("vcp", {})
    fund = s.get("fundamentals", {})
    techs = s.get("technicals", {})
    flat = {
        "ticker": s.get("tk", ""),
        "symbol": s.get("tk", ""),
        "name": s.get("nm", ""),
        "company": s.get("nm", ""),
        "price": s.get("px", 0),
        "zone": conv.get("zone", "WATCH"),
        "convergence_score": conv.get("score", 0),
        "score": conv.get("score", 0),
        "grade": grade_obj.get("grade", "F") if isinstance(grade_obj, dict) else str(grade_obj),
        "grade_score": grade_obj.get("totalScore", 0) if isinstance(grade_obj, dict) else 0,
        "grade_detail": grade_obj if isinstance(grade_obj, dict) else {},
        "tradeable": grade_obj.get("tradeable", False) if isinstance(grade_obj, dict) else False,
        "stage": wein.get("stage", "?"),
        "weinstein_stage": wein.get("stage", "?"),
        "phase": kell.get("phase", "Unknown"),
        "kell_light": kell.get("light", "gray"),
        "rs": mn.get("rs", 50),
        "template_score": mn.get("tplScore", 0),
        "vcp_count": vcp.get("count", 0),
        "pivot": mn.get("pivot") or vcp.get("pivot"),
        # Returns data (both abbreviated and frontend-friendly names)
        "dp": s.get("dp", 0), "wp": s.get("wp", 0), "mp": s.get("mp", 0),
        "qp": s.get("qp", 0), "hp": s.get("hp", 0), "yp": s.get("yp", 0),
        "day_change": s.get("dp", 0), "change_1d": s.get("dp", 0),
        "week_change": s.get("wp", 0), "change_1w": s.get("wp", 0),
        "month_change": s.get("mp", 0), "change_1m": s.get("mp", 0),
        "kell_phase": kell.get("phase", "Unknown"),
        "relative_strength": mn.get("rs", 50),
        "minervini_score": mn.get("tplScore", 0),
        "vcp_detected": vcp.get("count", 0) >= 2,
        "vcp_contractions": vcp.get("count", 0),
        "contractions": vcp.get("count", 0),
        "setup": s.get("setup", ""),
        "risk": s.get("risk", ""),
        "flags": s.get("flags", []),
        "sector": s.get("sector", fund.get("sector", "")),
        "stopPrice": grade_obj.get("stopPrice") if isinstance(grade_obj, dict) else None,
        "target1": grade_obj.get("target1") if isinstance(grade_obj, dict) else None,
        "target2": grade_obj.get("target2") if isinstance(grade_obj, dict) else None,
        "rrRatio": grade_obj.get("rrRatio", 0) if isinstance(grade_obj, dict) else 0,
        # Derived fields for Analyze page
        "high_52w": techs.get("high52"),
        "week52_high": techs.get("high52"),
        "low_52w": techs.get("low52"),
        "week52_low": techs.get("low52"),
        "pct_from_52h": techs.get("pct_from_52h"),
        "pctFrom52l": techs.get("pctFrom52l"),
        "market_cap": fund.get("marketCap", 0),
        "marketCap": fund.get("marketCap", 0),
        # Convergence checklist — convert dict to list for frontend
        "checklist": _conv_details_to_list(s.get("convergenceDetails", s.get("checklist"))),
        "convergence_checklist": _conv_details_to_list(s.get("convergenceDetails")),
        "convergenceDetails": s.get("convergenceDetails"),
        # Preserve full nested data for deep analysis
        "wein": wein, "min": mn, "kell": kell, "conv": conv,
        "vcp": vcp, "fundamentals": fund,
        "technicals": techs,
        "srLevels": s.get("srLevels", []),
        "shortConv": s.get("shortConv", {}),
        "finra": s.get("finra", {}),
        # Qullamaggie momentum data
        "qullamaggie": s.get("qullamaggie", {}),
        "qull_best_setup": (s.get("qullamaggie") or {}).get("best_setup"),
        "qull_best_score": (s.get("qullamaggie") or {}).get("best_score", 0),
        "qull_any_setup": (s.get("qullamaggie") or {}).get("any_setup", False),
        "qull_any_triggering": (s.get("qullamaggie") or {}).get("any_triggering", False),
        "qull_dual_convergence": (s.get("qullamaggie") or {}).get("dual_convergence", False),
        "qull_setups_summary": (s.get("qullamaggie") or {}).get("setups_summary", []),
    }
    return flat


def _build_watchlist():
    spy_df = get_spy()
    if spy_df is None:
        return None
    mkt = _mkt_snapshot
    def _fetch(tk):
        try:
            return analyze_ticker(tk, spy_df, mkt)
        except Exception:
            return None
    with ThreadPoolExecutor(max_workers=5) as ex:
        results = list(ex.map(_fetch, WATCHLIST))
    stocks = [_normalize_stock(r) for r in results if r]
    # Sort by grade score then convergence score
    stocks.sort(key=lambda x: (x.get("grade_score", 0), x.get("convergence_score", 0)), reverse=True)
    return to_python({"stocks": stocks, "lastUpdated": datetime.utcnow().isoformat()})

# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok", "version": "2.1",
        "polygon": bool(POLYGON_KEY), "finnhub": bool(FINNHUB_KEY),
        "claude": bool(CLAUDE_KEY), "fred": bool(FRED_KEY),
        "positions": len(_positions),
    }


@app.get("/api/data-status")
def data_status():
    """Data source status for frontend status bar."""
    status = router.get_status()
    # Add FINRA status
    finra_hist = finra.load_history()
    status["finra"]["data_tickers"] = len(finra_hist)
    status["finra"]["ok"] = len(finra_hist) > 0
    return status


@app.get("/api/macro")
def get_macro():
    """Full macro intelligence dashboard."""
    global _macro_cache
    if _macro_cache and _macro_cache.get("series"):
        return to_python(_macro_cache)
    # Fetch fresh
    _macro_cache = macro.get_full_macro()
    return to_python(_macro_cache)


@app.get("/api/macro/events")
def get_macro_events():
    """Upcoming economic events."""
    return to_python({"events": macro.get_upcoming_events(14)})


@app.get("/api/finra/top-short")
def get_top_short():
    """Top 10 highest SVR in universe today."""
    universe = list(WATCHLIST) + THREATS_LIST
    result = finra.top_short_volume(universe, n=10)
    return to_python({"stocks": result})


@app.get("/api/finra/{ticker}")
def get_finra_ticker(ticker: str):
    """Full SVR data + 20-day history for a ticker."""
    result = finra.analyze_ticker(ticker.upper())
    return to_python(result)


@app.get("/api/finra/screens/squeeze")
def get_squeeze_candidates():
    """Short squeeze candidates."""
    universe = list(WATCHLIST)
    result = finra.short_squeeze_candidates(universe)
    return to_python({"stocks": result, "total": len(result)})


@app.get("/api/finra/screens/distribution")
def get_distribution_detection():
    """Distribution detection signals."""
    universe = list(WATCHLIST)
    result = finra.distribution_detection(universe)
    return to_python({"stocks": result, "total": len(result)})


@app.get("/api/watchlist")
def get_watchlist():
    cached = cache_get("watchlist", CACHE_WATCHLIST)
    if cached: return cached
    resp = _build_watchlist()
    if resp is None:
        raise HTTPException(503, "Could not fetch market data")
    cache_set("watchlist", resp)
    return resp

@app.get("/api/analyze/{ticker}")
def get_analyze(ticker: str):
    ticker = ticker.upper().strip()
    key = f"analyze_{ticker}"
    cached = cache_get(key, CACHE_WATCHLIST)
    if cached: return cached

    spy_df = get_spy()
    result = analyze_ticker(ticker, spy_df if spy_df is not None else pd.DataFrame(), _mkt_snapshot)
    if result is None:
        raise HTTPException(404, f"Could not analyze {ticker}")

    # Enhanced with detailed convergence breakdown
    try:
        df = fetch_ohlcv(ticker, "2y")
        if df is not None:
            fund = result.get("fundamentals", {})
            wein = result["wein"]
            rs = result["min"]["rs"]
            phase = result["kell"]["phase"]
            vcp = result["vcp"]
            tpl_score = result["min"]["tplScore"]
            _, _, conv_details = convergence_score(wein, tpl_score, rs, phase, vcp, _mkt_snapshot, fund, df, detailed=True)
            result["convergenceDetails"] = conv_details
    except Exception:
        pass

    result = to_python(_normalize_stock(result))
    cache_set(key, result)
    return result

@app.get("/api/options-analysis/{ticker}")
def get_options_analysis(ticker: str):
    """Full options intelligence for a ticker."""
    ticker = ticker.upper().strip()
    key = f"options_{ticker}"
    cached = cache_get(key, CACHE_OPTIONS)
    if cached: return cached

    try:
        df = fetch_ohlcv(ticker, "2y")
        if df is None:
            raise HTTPException(404, f"No data for {ticker}")

        spot = float(df["Close"].iloc[-1])
        spy_df = get_spy()
        mkt = _mkt_snapshot

        # Get analysis context
        wein = weinstein_stage(df)
        rs = calc_rs_rating(df, spy_df) if spy_df is not None else 50
        _, tpl_score = minervini_template(df, rs)
        kell_result = kell_phase(df)
        phase = kell_result[0]
        vcp = detect_vcp(df)
        fund = fetch_fundamentals(ticker)
        conv_s, conv_z = convergence_score(wein, tpl_score, rs, phase, vcp, mkt, fund, df)

        # Try Polygon options data first, fall back to yfinance
        opts_data = router.fetch_options_data(ticker, spot)

        if opts_data.get("source") == "polygon" and opts_data.get("iv_analysis"):
            # Use Polygon real data
            result = {
                "ticker": ticker,
                "spot": spot,
                "iv": opts_data["iv_analysis"],
                "expectedMove": calc_expected_move(df, opts_data["iv_analysis"].get("currentIV", 0.3), spot),
                "strategy": select_strategy(
                    opts_data["iv_analysis"].get("ivRank", 50),
                    conv_z, phase, wein["stage"],
                ),
                "chainSnapshot": [],
                "source": "polygon",
            }
            # Build chain snapshot from Polygon data
            snapshot = opts_data.get("snapshot", {})
            if snapshot:
                for exp in snapshot.get("expirations", [])[:4]:
                    exp_calls = [c for c in snapshot.get("calls", []) if c["expiration"] == exp]
                    exp_puts = [p for p in snapshot.get("puts", []) if p["expiration"] == exp]
                    from datetime import datetime as dt
                    try:
                        dte = (dt.strptime(exp, "%Y-%m-%d").date() - dt.now().date()).days
                    except Exception:
                        dte = 30
                    # Filter near ATM
                    near_calls = sorted([c for c in exp_calls if abs(c["strike"] / spot - 1) < 0.15], key=lambda c: c["strike"])
                    near_puts = sorted([p for p in exp_puts if abs(p["strike"] / spot - 1) < 0.15], key=lambda p: p["strike"])
                    result["chainSnapshot"].append({
                        "expiration": exp, "dte": dte,
                        "calls": near_calls[:10], "puts": near_puts[:10],
                    })
        else:
            # Fallback: yfinance via options_engine
            import yfinance as yf
            t = yf.Ticker(ticker)
            result = full_options_analysis(t, df, spot, conv_z, phase, wein["stage"], vcp.get("pivot"))

        # Add FINRA short volume context
        finra_data = finra.analyze_ticker(ticker)
        if finra_data.get("svr_today") is not None:
            result["shortVolume"] = finra_data

        # Add expected move breakeven comparison
        if result.get("chainSnapshot"):
            for snap in result["chainSnapshot"]:
                for opt in snap.get("calls", []):
                    delta = opt.get("delta", opt.get("greeks", {}).get("delta", 0))
                    if abs(delta - 0.5) < 0.15:
                        be_pct = opt.get("breakevenPct", 5)
                        comparison = compare_move_to_breakeven(result.get("expectedMove", {}), be_pct, snap.get("dte", 30))
                        result["breakevenComparison"] = comparison
                        break

        # Flatten IV data for frontend consumption
        iv = result.get("iv") or {}
        result["iv_rank"] = iv.get("ivRank") or iv.get("iv_rank")
        result["iv_percentile"] = iv.get("ivPercentile") or iv.get("iv_percentile")
        result["current_iv"] = iv.get("currentIV") or iv.get("current_iv")
        result["hv_30"] = iv.get("hv30") or iv.get("hv_30")
        iv_cur = result["current_iv"]
        hv_cur = result["hv_30"]
        result["iv_hv_ratio"] = round(iv_cur / hv_cur, 2) if iv_cur and hv_cur and hv_cur > 0 else None
        pcr = result.get("putCallRatio")
        result["put_call_ratio"] = pcr.get("volume") if isinstance(pcr, dict) else pcr
        result["term_structure"] = iv.get("termStructureDetail") or iv.get("term_structure")
        result["skew"] = iv.get("skewVerdict") or iv.get("skew")
        strat = result.get("strategy") or result.get("strategySelection")
        result["strategies"] = [strat] if isinstance(strat, dict) else (strat if isinstance(strat, list) else [])

        result = to_python(result)
        cache_set(key, result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Options analysis error for {ticker}: {e}")
        return {"error": str(e), "ticker": ticker}

@app.get("/api/trade-ideas/{ticker}")
def get_trade_ideas(ticker: str):
    """Generate 2-3 graded strategy cards for a ticker."""
    ticker = ticker.upper().strip()
    key = f"ideas_{ticker}"
    cached = cache_get(key, CACHE_OPTIONS)
    if cached: return cached

    try:
        df = fetch_ohlcv(ticker, "2y")
        if df is None:
            raise HTTPException(404, f"No data for {ticker}")

        spot = float(df["Close"].iloc[-1])
        spy_df = get_spy()
        mkt = _mkt_snapshot

        wein = weinstein_stage(df)
        rs = calc_rs_rating(df, spy_df) if spy_df is not None else 50
        _, tpl_score = minervini_template(df, rs)
        kell_result = kell_phase(df)
        phase, _, ema_d, ema_w, ema_m = kell_result[:5]
        vcp = detect_vcp(df)
        fund = fetch_fundamentals(ticker)
        conv_s, conv_z = convergence_score(wein, tpl_score, rs, phase, vcp, mkt, fund, df)
        is_short = wein["stage"] in ("3", "4A", "4B")

        # Get options chain (Polygon → yfinance)
        opts_data = router.fetch_options_data(ticker, spot)
        chain = []
        iv_data = {}

        if opts_data.get("source") == "polygon" and opts_data.get("snapshot"):
            # Use Polygon data
            iv_data = opts_data.get("iv_analysis", {})
            snapshot = opts_data["snapshot"]
            for exp in snapshot.get("expirations", [])[:4]:
                exp_calls = [c for c in snapshot.get("calls", []) if c["expiration"] == exp]
                exp_puts = [p for p in snapshot.get("puts", []) if p["expiration"] == exp]
                near_calls = sorted([c for c in exp_calls if abs(c["strike"] / spot - 1) < 0.15], key=lambda c: c["strike"])[:8]
                near_puts = sorted([p for p in exp_puts if abs(p["strike"] / spot - 1) < 0.15], key=lambda p: p["strike"])[:8]
                from datetime import datetime as dt
                try:
                    dte = (dt.strptime(exp, "%Y-%m-%d").date() - dt.now().date()).days
                except Exception:
                    dte = 30
                chain.append({"expiration": exp, "dte": dte, "calls": near_calls, "puts": near_puts})
        elif opts_data.get("yf_ticker"):
            # Fallback: yfinance
            chain = build_options_snapshot(opts_data["yf_ticker"], spot, "bearish" if is_short else "bullish")
            iv_data = calc_iv_from_options_chain(opts_data["yf_ticker"])
        else:
            import yfinance as yf
            t = yf.Ticker(ticker)
            chain = build_options_snapshot(t, spot, "bearish" if is_short else "bullish")
            iv_data = calc_iv_from_options_chain(t)

        # Volume ratio
        technicals = calc_technicals(df)
        vol_ratio = technicals.get("volumeProfile", {}).get("ratio", 1.0)

        ideas = generate_trade_ideas(
            ticker=ticker, spot=spot, chain_snapshot=chain,
            wein=wein, tpl_score=tpl_score, rs=rs, phase=phase,
            vcp=vcp, conv_zone=conv_z, conv_score=conv_s, conv_max=23,
            ema_d=ema_d, ema_w=ema_w, ema_m=ema_m,
            fundamentals=fund, iv_data=iv_data,
            vol_ratio=vol_ratio, is_short=is_short,
        )

        result = to_python(ideas)
        cache_set(key, result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Trade ideas error for {ticker}: {e}")
        return {"error": str(e), "ticker": ticker}

@app.get("/api/technicals/{ticker}")
def get_technicals(ticker: str):
    ticker = ticker.upper().strip()
    key = f"tech_{ticker}"
    cached = cache_get(key, CACHE_TECHNICALS)
    if cached: return cached
    df = fetch_ohlcv(ticker, "2y")
    if df is None:
        raise HTTPException(404, f"No data for {ticker}")
    result = to_python(calc_technicals(df))
    cache_set(key, result)
    return result

@app.get("/api/support-resistance/{ticker}")
def get_support_resistance(ticker: str):
    ticker = ticker.upper().strip()
    df = fetch_ohlcv(ticker, "2y")
    if df is None:
        raise HTTPException(404, f"No data for {ticker}")
    levels = calc_sr_levels(df)
    support = [l for l in levels if l.get("type") == "support"]
    resistance = [l for l in levels if l.get("type") == "resistance"]
    # Pivot point from last day's HLC
    if len(df) >= 2:
        prev = df.iloc[-2]
        pivot = round((float(prev["High"]) + float(prev["Low"]) + float(prev["Close"])) / 3, 2)
    else:
        pivot = None
    return to_python({"levels": levels, "support": support, "resistance": resistance, "pivot": pivot, "ticker": ticker})

@app.get("/api/screener")
def get_screener(
    preset: str = "",
    rs_min: int = 0, rs_max: int = 99,
    stage: str = "", template_min: int = 0,
    sector: str = "", vcp: bool = False,
    zone: str = "", short_mode: bool = False,
    min_grade: str = "",
):
    # Apply preset filters
    if preset and preset in SCREENER_PRESETS:
        p = SCREENER_PRESETS[preset]["filters"]
        if "rs_min" in p: rs_min = p["rs_min"]
        if "rs_max" in p: rs_max = p["rs_max"]
        if "stage" in p: stage = p["stage"]
        if "template_min" in p: template_min = p["template_min"]
        if "vcp" in p: vcp = p["vcp"]
        if "zone" in p: zone = p["zone"]
        if "short_mode" in p: short_mode = p["short_mode"]

    # Handle Qullamaggie special presets
    special = SCREENER_PRESETS.get(preset, {}).get("special", "") if preset else ""
    if special in ("qull_breakouts", "qull_parabolic", "qull_ep", "dual_convergence"):
        cached_wl = cache_get("watchlist", CACHE_WATCHLIST * 4)
        stocks = (cached_wl or {}).get("stocks", [])
        if not stocks:
            resp = _build_watchlist()
            stocks = (resp or {}).get("stocks", [])
        qull_filtered = []
        for s in stocks:
            qull = s.get("qullamaggie", {})
            if not qull:
                continue
            if special == "qull_breakouts":
                bo = qull.get("breakout")
                if bo and bo.get("passed"):
                    s = {**s, "qull_sort_score": bo.get("score", 0)}
                    qull_filtered.append(s)
            elif special == "qull_parabolic":
                para = qull.get("parabolic")
                if para and (para.get("short_setup") or para.get("long_bounce")):
                    s = {**s, "qull_sort_score": max(para.get("short_score", 0), para.get("long_score", 0))}
                    qull_filtered.append(s)
            elif special == "qull_ep":
                ep = qull.get("episodic_pivot")
                if ep and ep.get("passed"):
                    s = {**s, "qull_sort_score": ep.get("score", 0)}
                    qull_filtered.append(s)
            elif special == "dual_convergence":
                if s.get("qull_dual_convergence"):
                    s = {**s, "qull_sort_score": s.get("grade_score", 0)}
                    qull_filtered.append(s)
        qull_filtered.sort(key=lambda x: x.get("qull_sort_score", 0), reverse=True)
        return to_python({
            "stocks": qull_filtered, "total": len(qull_filtered),
            "preset": preset, "presetName": SCREENER_PRESETS.get(preset, {}).get("name", "Custom"),
        })

    cached = cache_get("watchlist", CACHE_WATCHLIST * 4)
    if cached:
        stocks = cached.get("stocks", [])
    else:
        resp = _build_watchlist()
        if resp is None:
            return {"stocks": [], "total": 0}
        stocks = resp.get("stocks", [])

    filtered = []
    grade_thresholds = {"AAA": 90, "AA": 80, "A": 70, "BBB": 60, "BB": 50}

    for s in stocks:
        try:
            rs_val = s.get("rs", s.get("min", {}).get("rs", 50))
            if not (rs_min <= rs_val <= rs_max): continue

            if stage:
                s_stage = s.get("stage", s.get("wein", {}).get("stage", ""))
                if stage == "2":
                    if s_stage not in ("2A", "2B"): continue
                elif stage == "4":
                    if s_stage not in ("4A", "4B"): continue
                elif not s_stage.startswith(stage): continue

            if s.get("template_score", s.get("min", {}).get("tplScore", 0)) < template_min: continue
            if sector and sector.lower() not in (s.get("sector", "") or "").lower(): continue
            if vcp and s.get("vcp_count", s.get("vcp", {}).get("count", 0)) < 2: continue

            if zone:
                s_zone = s.get("zone", s.get("shortConv" if short_mode else "conv", {}).get("zone", ""))
                if s_zone != zone: continue

            if min_grade and min_grade in grade_thresholds:
                grade_score = s.get("grade_score", s.get("grade", {}).get("totalScore", 0) if isinstance(s.get("grade"), dict) else 0)
                if grade_score < grade_thresholds[min_grade]: continue

            filtered.append(s)
        except Exception:
            continue

    filtered.sort(key=lambda x: (x.get("grade_score", 0), x.get("convergence_score", x.get("score", 0))), reverse=True)

    return to_python({
        "stocks": filtered, "total": len(filtered),
        "preset": preset, "presetName": SCREENER_PRESETS.get(preset, {}).get("name", "Custom"),
    })

@app.get("/api/screener/presets")
def get_screener_presets():
    return SCREENER_PRESETS

# ─────────────────────────────────────────────
# SCANNER ENDPOINTS
# ─────────────────────────────────────────────
@app.get("/api/scanners")
def get_scanner_modules():
    """List all available scanner modules."""
    return SCANNER_MODULES

@app.get("/api/scanner/{module}")
def run_scanner(module: str):
    """Run a specific scanner module against the watchlist universe."""
    if module not in SCANNER_MODULES:
        raise HTTPException(404, f"Unknown scanner: {module}")
    try:
        cached = cache_get("watchlist", CACHE_WATCHLIST * 4)
        if cached:
            stocks = cached.get("stocks", [])
        else:
            resp = _build_watchlist()
            if resp is None:
                return {"stocks": [], "total": 0, "scanner": module, "scannerName": SCANNER_MODULES[module]["name"]}
            stocks = resp.get("stocks", [])

        filtered = _run_scanner(module, stocks)
        return to_python({
            "stocks": filtered,
            "total": len(filtered),
            "scanner": module,
            "scannerName": SCANNER_MODULES[module]["name"],
            "description": SCANNER_MODULES[module]["description"],
            "lastUpdated": datetime.utcnow().isoformat(),
        })
    except Exception as e:
        log.error(f"Scanner {module} error: {e}")
        return {"stocks": [], "total": 0, "scanner": module, "error": str(e)}

@app.get("/api/breadth")
def get_breadth():
    cached = cache_get("breadth", CACHE_BREADTH)
    if cached: return cached
    data = to_python(compute_breadth())
    global _mkt_snapshot
    _mkt_snapshot = {
        "spxStage": data.get("spxStage", 2), "spxEma": data.get("spxEma", "above"),
        "tplCount": data.get("tplCount", 500), "vix": data.get("vix", 20),
    }
    cache_set("breadth", data)
    return data

@app.get("/api/threats")
def get_threats():
    cached = cache_get("threats", CACHE_THREATS)
    if cached: return cached
    spy_df = get_spy()
    data = compute_threats(spy_df if spy_df is not None else pd.DataFrame(), _mkt_snapshot)
    resp = to_python({"threats": data, "lastUpdated": datetime.utcnow().isoformat()})
    cache_set("threats", resp)
    return resp

@app.get("/api/news")
def get_news():
    cached = cache_get("news", CACHE_NEWS)
    if cached: return cached
    data = fetch_news_data(WATCHLIST)
    data["lastUpdated"] = datetime.utcnow().isoformat()
    cache_set("news", data)
    return data

@app.get("/api/earnings-calendar")
def get_earnings_calendar():
    cached = cache_get("earnings", CACHE_EARNINGS)
    if cached: return cached
    data = fetch_earnings_calendar(WATCHLIST + THREATS_LIST)
    resp = {"earnings": data, "lastUpdated": datetime.utcnow().isoformat()}
    cache_set("earnings", resp)
    return resp

@app.get("/api/earnings")
def get_earnings():
    return get_earnings_calendar()

@app.get("/api/daily-brief")
def get_daily_brief():
    cached = cache_get("brief", CACHE_BRIEF)
    if cached: return cached
    try:
        wl_cached = cache_get("watchlist", CACHE_WATCHLIST * 2)
        br_cached = cache_get("breadth", CACHE_BREADTH * 2)
        th_cached = cache_get("threats", CACHE_THREATS * 2)
        watchlist_data = (wl_cached or {}).get("stocks", [])
        breadth_data = br_cached or _mkt_snapshot
        threats_data = (th_cached or {}).get("threats", [])
        content = generate_daily_brief(watchlist_data, breadth_data, threats_data)
        resp = {**content, "generatedAt": datetime.utcnow().isoformat()}
        cache_set("brief", resp)
        return resp
    except Exception as e:
        log.error(f"Brief generation error: {e}")
        return {"tier1": f"# MKW BRIEF\n\nBrief generation encountered an error: {e}\n\nData may still be loading. Retry in a few minutes.",
                "tier2": None, "error": str(e), "generatedAt": datetime.utcnow().isoformat()}

@app.get("/api/brief")
def get_brief():
    return get_daily_brief()

# ─────────────────────────────────────────────
# MARKET WIZARD CHAT
# ─────────────────────────────────────────────

@app.post("/api/wizard/chat")
async def wizard_chat(request: Request):
    """Streaming AI chat with market context injection."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    message = str(body.get("message", "")).strip()
    conversation_history = body.get("conversationHistory", [])
    page_context = body.get("context", {})

    if not message:
        raise HTTPException(400, "message required")

    # 1. Classify the query
    classification = wiz.classify_query(message)
    tickers = classification["tickers"]
    needs_market = classification["needs_market_data"]
    needs_reasoning = classification["needs_reasoning"]
    max_tokens = classification["max_tokens"]

    # 2. Gather contextual data
    market_context_parts = []

    # Inject page context if available
    if page_context.get("currentTicker") and not tickers:
        tickers = [page_context["currentTicker"]]

    if needs_market or page_context.get("breadth"):
        try:
            breadth_data = cache_get("breadth", CACHE_BREADTH * 4)
            if not breadth_data:
                breadth_data = to_python(compute_breadth())
            market_context_parts.append(wiz.format_market_context(breadth_data))
        except Exception as e:
            log.warning(f"Wizard: breadth fetch failed: {e}")

    # Fetch ticker data
    for ticker in tickers[:3]:
        try:
            # Try cache first
            cached = cache_get(f"analyze_{ticker}", CACHE_WATCHLIST * 2)
            if cached:
                market_context_parts.append(wiz.format_ticker_context(ticker, cached))
            else:
                # Quick analysis
                spy_df = get_spy()
                result = analyze_ticker(ticker, spy_df if spy_df is not None else pd.DataFrame(), _mkt_snapshot)
                if result:
                    normalized = _normalize_stock(result)
                    market_context_parts.append(wiz.format_ticker_context(ticker, normalized))
        except Exception as e:
            log.warning(f"Wizard: ticker {ticker} fetch failed: {e}")
            market_context_parts.append(f"\nTICKER {ticker}: Data fetch failed")

    # If asking about best setups, inject watchlist summary
    lower = message.lower()
    if any(kw in lower for kw in ["best setup", "top pick", "watchlist", "best play", "what should"]):
        try:
            wl = cache_get("watchlist", CACHE_WATCHLIST * 4)
            if wl:
                market_context_parts.append(wiz.format_watchlist_summary(wl.get("stocks", [])))
        except Exception:
            pass

    # If asking about macro
    if any(kw in lower for kw in ["macro", "fed", "rates", "inflation", "economy"]):
        try:
            if _macro_cache and _macro_cache.get("score"):
                mc = _macro_cache
                score = mc["score"]
                market_context_parts.append(f"\nMACRO ENVIRONMENT: Score {score.get('score', '?')}/10 ({score.get('regime', '?')})")
                rates = mc.get("rates", {})
                if rates:
                    market_context_parts.append(f"  Fed Funds: {rates.get('fed_funds', '?')}% | 10Y: {rates.get('ten_year', '?')}% | Yield Curve: {rates.get('yield_curve', '?')}%")
        except Exception:
            pass

    full_context = "\n".join(market_context_parts)

    # 3. Build messages
    system_prompt = wiz.build_system_prompt(full_context)
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history (last 10 exchanges)
    for msg in conversation_history[-20:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": message})

    # 4. Stream response via SSE
    def event_stream():
        try:
            for chunk in llm_provider.stream_completion(
                messages=messages,
                use_reasoning=needs_reasoning,
                max_tokens=max_tokens,
            ):
                yield f"data: {json.dumps(chunk)}\n\n"

            # Send follow-up suggestions
            follow_ups = wiz.generate_follow_ups(message, "", tickers)
            yield f"data: {json.dumps({'type': 'suggestions', 'suggestions': follow_ups})}\n\n"

        except Exception as e:
            log.error(f"Wizard stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/wizard/status")
def wizard_status():
    """Return LLM provider status."""
    return llm_provider.get_provider_status()


# ─────────────────────────────────────────────
# JOURNAL ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/journal")
def journal_list(status: str = "", ticker: str = "", limit: int = 100):
    trades = get_trades(status=status, ticker=ticker, limit=limit)
    return {"trades": trades, "total": len(trades)}

@app.post("/api/journal")
async def journal_add(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    return add_trade(body)

@app.put("/api/journal/{trade_id}")
async def journal_update(trade_id: str, request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    result = update_trade(trade_id, body)
    if result is None:
        raise HTTPException(404, f"Trade {trade_id} not found")
    return result

@app.delete("/api/journal/{trade_id}")
def journal_delete(trade_id: str):
    if delete_trade(trade_id):
        return {"deleted": True}
    raise HTTPException(404, f"Trade {trade_id} not found")

@app.get("/api/journal/analytics")
def journal_analytics():
    return compute_analytics()

# ─────────────────────────────────────────────
# POSITIONS ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/positions")
def get_positions():
    return {"positions": list(_positions.values()), "total": len(_positions)}

@app.post("/api/positions")
async def create_position(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    ticker = str(body.get("ticker", "")).upper().strip()
    if not ticker:
        raise HTTPException(400, "ticker required")
    direction = str(body.get("direction", "LONG")).upper()
    entry_price = float(body.get("entryPrice", 0))
    stop_level = float(body.get("stopLevel", 0))
    if not entry_price or not stop_level:
        raise HTTPException(400, "entryPrice and stopLevel required")

    pid = str(uuid.uuid4())
    pos = {
        "id": pid, "ticker": ticker, "direction": direction,
        "entryDate": datetime.utcnow().isoformat(), "entryPrice": entry_price,
        "optionStrike": body.get("optionStrike"), "optionExpiry": body.get("optionExpiry"),
        "premiumPaid": body.get("premiumPaid"), "contracts": int(body.get("contracts", 1)),
        "stopLevel": stop_level, "currentStop": body.get("currentStop", stop_level),
        "target1": body.get("target1"), "target2": body.get("target2"),
        "notes": body.get("notes", ""), "status": "ACTIVE",
        "closePrice": None, "closeDate": None,
    }
    _positions[pid] = pos
    save_positions(_positions)
    return pos

@app.put("/api/positions/{position_id}")
async def update_position(position_id: str, request: Request):
    if position_id not in _positions:
        raise HTTPException(404, f"Position {position_id} not found")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    pos = _positions[position_id]
    for k in ["stopLevel","target1","target2","currentStop","closePrice"]:
        if k in body:
            pos[k] = float(body[k]) if body[k] is not None else None
    for k in ["notes","status","closeDate","optionExpiry"]:
        if k in body:
            pos[k] = body[k]
    if k in body and k == "contracts":
        pos["contracts"] = int(body["contracts"])
    if pos.get("status") == "CLOSED" and not pos.get("closeDate"):
        pos["closeDate"] = datetime.utcnow().isoformat()
    _positions[position_id] = pos
    save_positions(_positions)
    return pos

@app.delete("/api/positions/{position_id}")
def delete_position_endpoint(position_id: str):
    if position_id not in _positions:
        raise HTTPException(404)
    deleted = _positions.pop(position_id)
    save_positions(_positions)
    return {"deleted": True, "ticker": deleted.get("ticker")}

# ─────────────────────────────────────────────
# PORTFOLIO GREEKS
# ─────────────────────────────────────────────

@app.get("/api/portfolio/greeks")
def portfolio_greeks():
    """Calculate aggregate portfolio Greeks from open positions."""
    positions = [p for p in _positions.values() if p.get("status") == "ACTIVE"]
    if not positions:
        return {"totalDelta": 0, "totalGamma": 0, "totalTheta": 0, "totalVega": 0, "positions": [], "thetaRate": 0}

    r = 0.05
    port_delta, port_gamma, port_theta, port_vega = 0, 0, 0, 0
    pos_greeks = []

    for pos in positions:
        ticker = pos.get("ticker", "")
        try:
            df = fetch_ohlcv(ticker, "6mo")
            if df is None: continue
            spot = float(df["Close"].iloc[-1])
            strike = pos.get("optionStrike")
            expiry = pos.get("optionExpiry")
            contracts = pos.get("contracts", 1)
            direction = pos.get("direction", "LONG")

            if strike and expiry:
                try:
                    exp_date = datetime.strptime(str(expiry), "%Y-%m-%d")
                    dte = max(1, (exp_date - datetime.now()).days)
                    T = dte / 365
                    hv = calc_historical_volatility(df)
                    opt_type = "put" if direction == "SHORT" else "call"
                    g = calc_greeks(spot, float(strike), T, r, hv, opt_type)
                    mult = contracts * 100
                    d = g["delta"] * mult
                    gm = g["gamma"] * mult
                    th = g["theta"] * mult
                    v = g["vega"] * mult
                    port_delta += d
                    port_gamma += gm
                    port_theta += th
                    port_vega += v
                    pos_greeks.append({
                        "ticker": ticker, "delta": round(d, 1), "gamma": round(gm, 4),
                        "theta": round(th, 2), "vega": round(v, 2),
                        "dte": dte, "spot": spot, "strike": float(strike),
                    })
                except Exception:
                    pass
        except Exception:
            pass

    return to_python({
        "totalDelta": round(port_delta, 1), "totalGamma": round(port_gamma, 4),
        "totalTheta": round(port_theta, 2), "totalVega": round(port_vega, 2),
        "thetaPerDay": f"${abs(port_theta):.2f}/day",
        "positions": pos_greeks,
    })

@app.get("/api/portfolio/correlation")
def portfolio_correlation():
    """Sector exposure and correlation for open positions."""
    positions = [p for p in _positions.values() if p.get("status") == "ACTIVE"]
    if not positions:
        return {"sectors": {}, "positions": [], "warnings": []}

    sector_exposure = {}
    pos_data = []
    total_positions = len(positions)

    for pos in positions:
        ticker = pos.get("ticker", "")
        try:
            fund = fetch_fundamentals(ticker)
            sector = fund.get("sector", "Unknown")
            sector_exposure[sector] = sector_exposure.get(sector, 0) + 1
            pos_data.append({"ticker": ticker, "sector": sector})
        except Exception:
            pass

    # Convert to percentages
    sector_pcts = {k: round(v / total_positions * 100, 1) for k, v in sector_exposure.items()}
    warnings = []
    for sect, pct in sector_pcts.items():
        if pct > 40:
            warnings.append(f"{sect}: {pct}% of portfolio. OVERCONCENTRATED. Sector rotation risk.")

    return to_python({
        "sectors": sector_pcts, "positions": pos_data, "warnings": warnings,
        "totalPositions": total_positions,
    })

# ─────────────────────────────────────────────
# QULLAMAGGIE ENDPOINTS
# ─────────────────────────────────────────────

CACHE_QULL = 600  # 10 min

@app.get("/api/qullamaggie/scan")
def qullamaggie_scan():
    """Run all three Qullamaggie scanners across the watchlist universe."""
    cached = cache_get("qull_scan", CACHE_QULL)
    if cached:
        return cached

    try:
        # Get daily data for all watchlist tickers
        daily_data = {}
        fund_data = {}
        for ticker in WATCHLIST:
            try:
                df = fetch_ohlcv(ticker, "2y")
                if df is not None and len(df) >= 60:
                    daily_data[ticker] = df
                fund = fetch_fundamentals(ticker)
                fund_data[ticker] = fund
                time.sleep(0.2)
            except Exception:
                continue

        results = qull.run_qullamaggie_scan(
            list(daily_data.keys()), daily_data, fund_data
        )
        results["lastUpdated"] = datetime.utcnow().isoformat()
        resp = to_python(results)
        cache_set("qull_scan", resp)
        return resp
    except Exception as e:
        log.error(f"Qullamaggie scan error: {e}")
        return {"error": str(e), "breakouts": [], "parabolic_shorts": [],
                "parabolic_longs": [], "episodic_pivots": [], "all_setups": []}


@app.get("/api/qullamaggie/{ticker}")
def qullamaggie_ticker(ticker: str):
    """Run all three Qullamaggie scanners on a single ticker with trade plan."""
    ticker = ticker.upper().strip()
    key = f"qull_{ticker}"
    cached = cache_get(key, CACHE_QULL)
    if cached:
        return cached

    try:
        df = fetch_ohlcv(ticker, "2y")
        if df is None or len(df) < 60:
            raise HTTPException(404, f"Insufficient data for {ticker}")

        fund = fetch_fundamentals(ticker)
        mcap = fund.get("marketCap", 0)
        analysis = qull.analyze_qullamaggie(ticker, df, fundamentals=fund, market_cap=mcap)

        # Generate trade plans for detected setups
        trade_plans = []
        # Calculate ATR for trade plan
        tr = pd.concat([
            df['High'] - df['Low'],
            (df['High'] - df['Close'].shift(1)).abs(),
            (df['Low'] - df['Close'].shift(1)).abs()
        ], axis=1).max(axis=1)
        atr = float(tr.rolling(14).mean().iloc[-1])
        current_price = float(df['Close'].iloc[-1])
        day_low = float(df['Low'].iloc[-1])

        bo = analysis.get('breakout')
        if bo and bo.get('passed'):
            plan = generate_trade_plan('BREAKOUT', {
                **bo, 'day_low': day_low
            }, current_price, atr)
            if plan:
                trade_plans.append(plan)

        para = analysis.get('parabolic')
        if para:
            if para.get('short_setup'):
                recent_high = float(df['High'].tail(20).max())
                plan = generate_trade_plan('PARABOLIC_SHORT', {
                    **para, 'recent_high': recent_high
                }, current_price, atr)
                if plan:
                    trade_plans.append(plan)
            if para.get('long_bounce'):
                plan = generate_trade_plan('PARABOLIC_LONG', para, current_price, atr)
                if plan:
                    trade_plans.append(plan)

        ep = analysis.get('episodic_pivot')
        if ep and ep.get('passed'):
            plan = generate_trade_plan('EPISODIC_PIVOT', {
                **ep, 'day_low': day_low
            }, current_price, atr)
            if plan:
                trade_plans.append(plan)

        # Get Qullamaggie indicators snapshot
        indicators = get_qullamaggie_snapshot(df)

        result = {
            **analysis,
            'trade_plans': trade_plans,
            'indicators': indicators,
            'atr': round(atr, 2),
            'current_price': round(current_price, 2),
        }

        resp = to_python(result)
        cache_set(key, resp)
        return resp
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Qullamaggie {ticker} error: {e}")
        return {"error": str(e), "ticker": ticker}


@app.post("/api/qullamaggie/archive")
async def qullamaggie_archive_add(request: Request):
    """Add a setup to the Qullamaggie historical archive."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    return qull.archive_setup(body)


@app.get("/api/qullamaggie/archive")
def qullamaggie_archive_list(setup_type: str = "", ticker: str = "", limit: int = 100):
    """List archived Qullamaggie setups."""
    return {"entries": qull.get_archive(setup_type, ticker, limit)}


@app.get("/api/qullamaggie/archive/analytics")
def qullamaggie_archive_analytics():
    """Performance analytics from the Qullamaggie setup archive."""
    return qull.archive_analytics()


# ─────────────────────────────────────────────
# ENTRY CRITERIA ENGINE (Phase 1-6)
# ─────────────────────────────────────────────

@app.get("/api/entry-grade/{ticker}")
def entry_grade_ticker(ticker: str):
    """Grade a single ticker using the 6-condition entry criteria engine."""
    ticker = ticker.upper().strip()
    try:
        spy_df = get_spy()
        df = fetch_ohlcv(ticker, "2y")
        if df is None or len(df) < 60:
            return {"error": f"Insufficient data for {ticker}"}

        graded = grade_setup(df, spy_df, ticker)

        # Generate playbook if score >= 7
        playbook = None
        if graded["composite"]["score"] >= 7:
            playbook = generate_playbook(graded)

        # Enrichment data
        fund = fetch_fundamentals(ticker)
        enrichment = enrich_ticker(ticker, df, fund, fetch_ohlcv_fn=fetch_ohlcv)

        result = {
            **graded,
            "playbook": playbook,
            "enrichment": enrichment,
        }
        return to_python(result)
    except Exception as e:
        log.error(f"entry_grade {ticker}: {e}")
        return {"error": str(e), "ticker": ticker}


@app.get("/api/entry-grade-watchlist")
def entry_grade_watchlist(tickers: str = ""):
    """Grade multiple tickers. Pass comma-separated tickers or uses default watchlist."""
    try:
        if tickers:
            ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
        else:
            ticker_list = WATCHLIST[:20]

        spy_df = get_spy()
        if spy_df is None:
            return {"error": "Could not fetch SPY data"}

        results = []
        for tk in ticker_list:
            try:
                df = fetch_ohlcv(tk, "2y")
                if df is None or len(df) < 60:
                    continue
                graded = grade_setup(df, spy_df, tk)

                # Lightweight playbook for list view
                playbook = None
                if graded["composite"]["score"] >= 7:
                    playbook = generate_playbook(graded)

                fund = fetch_fundamentals(tk)
                enrichment = enrich_ticker(tk, df, fund, fetch_ohlcv_fn=fetch_ohlcv)

                results.append({
                    **graded,
                    "playbook": playbook,
                    "enrichment": enrichment,
                })
            except Exception as e:
                log.warning(f"entry_grade_watchlist {tk}: {e}")

        results.sort(key=lambda x: x.get("composite", {}).get("score", 0), reverse=True)
        return to_python({
            "stocks": results,
            "count": len(results),
            "lastUpdated": datetime.utcnow().isoformat(),
        })
    except Exception as e:
        log.error(f"entry_grade_watchlist: {e}")
        return {"error": str(e)}


@app.get("/api/pattern-alerts")
def pattern_alerts(tickers: str = ""):
    """Scan for forming patterns across watchlist."""
    try:
        if tickers:
            ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
        else:
            ticker_list = WATCHLIST[:20]

        spy_df = get_spy()
        if spy_df is None:
            return {"error": "Could not fetch SPY data"}

        alerts = scan_all_patterns(ticker_list, fetch_ohlcv, spy_df, grade_setup)
        return to_python({
            "alerts": alerts,
            "count": len(alerts),
            "lastUpdated": datetime.utcnow().isoformat(),
        })
    except Exception as e:
        log.error(f"pattern_alerts: {e}")
        return {"error": str(e)}


@app.get("/api/notifications/status")
def notification_status():
    """Check which notification channels are configured."""
    return get_notification_status()


@app.post("/api/notifications/test")
async def test_notification(request: Request):
    """Send a test notification to configured channels."""
    try:
        body = await request.json()
        channel = body.get("channel", "all")
        message = body.get("message", "MKW Test Notification — System is connected!")

        results = {}
        if channel in ("telegram", "all"):
            results["telegram"] = send_telegram(f"🔔 {message}")
        if channel in ("discord", "all"):
            results["discord"] = send_discord(content=f"🔔 {message}")
        return results
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/notifications/send-alert")
async def send_alert_notification(request: Request):
    """Manually trigger notification for a graded setup."""
    try:
        body = await request.json()
        ticker = body.get("ticker", "").upper().strip()
        if not ticker:
            return {"error": "ticker required"}

        spy_df = get_spy()
        df = fetch_ohlcv(ticker, "2y")
        if df is None:
            return {"error": f"No data for {ticker}"}

        graded = grade_setup(df, spy_df, ticker)
        playbook = generate_playbook(graded) if graded["composite"]["score"] >= 7 else None

        results = notify_setup(graded, playbook)
        return {"sent": results, "ticker": ticker, "score": graded["composite"]["score"]}
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/notifications/morning-summary")
async def send_morning_summary():
    """Trigger morning summary notification."""
    try:
        spy_df = get_spy()
        if spy_df is None:
            return {"error": "Could not fetch SPY"}

        ticker_list = WATCHLIST[:15]
        grades = []
        for tk in ticker_list:
            try:
                df = fetch_ohlcv(tk, "2y")
                if df and len(df) >= 60:
                    grades.append(grade_setup(df, spy_df, tk))
            except Exception:
                pass

        alerts = scan_all_patterns(ticker_list[:10], fetch_ohlcv, spy_df, grade_setup)

        results = notify_morning_summary(grades, alerts)
        return {"sent": results, "graded": len(grades), "alerts": len(alerts)}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# DEBUG ENDPOINT
# ─────────────────────────────────────────────

@app.get("/api/debug/{ticker}")
def debug_ticker(ticker: str):
    ticker = ticker.upper().strip()
    try:
        spy_df = get_spy()
        df = fetch_ohlcv(ticker, "2y")
        if df is None or len(df) < 60:
            return {"error": f"Insufficient data for {ticker}"}

        fund = fetch_fundamentals(ticker)
        rs = calc_rs_rating(df, spy_df) if spy_df is not None else 50
        wein = weinstein_stage(df)
        tpl_criteria, tpl_score = minervini_template(df, rs)
        kell_result = kell_phase(df)
        phase = kell_result[0]
        vcp = detect_vcp(df)
        mkt = _mkt_snapshot

        conv_s, conv_z, conv_details = convergence_score(wein, tpl_score, rs, phase, vcp, mkt, fund, df, detailed=True)

        price = float(df["Close"].iloc[-1])

        return to_python({
            "ticker": ticker, "price": round(price, 2),
            "mkt_snapshot": mkt, "weinstein": wein,
            "minervini": {"tpl_criteria": tpl_criteria, "tpl_score": tpl_score},
            "kell": {"phase": phase, "light": kell_result[1], "ema_d": kell_result[2], "ema_w": kell_result[3], "ema_m": kell_result[4]},
            "vcp": vcp, "fundamentals": fund, "rs": rs,
            "convergence": {"score": conv_s, "zone": conv_z, "max": 22, "criteria": conv_details},
        })
    except Exception as e:
        return {"error": str(e)}

# ─────────────────────────────────────────────
# STATIC FRONTEND
# ─────────────────────────────────────────────
dist_path = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.isdir(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        return FileResponse(os.path.join(dist_path, "index.html"))
