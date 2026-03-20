"""
MKW Command Center — FastAPI Backend
Minervini × Kell × Weinstein convergence engine
"""

import os, time, json, logging, asyncio
from datetime import datetime, timedelta
from typing import Optional
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
import yfinance as yf
import requests
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("mkw")

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
FINNHUB_KEY   = os.getenv("FINNHUB_API_KEY", "")
CLAUDE_KEY    = os.getenv("ANTHROPIC_API_KEY", "")
CACHE_WATCHLIST = 300   # 5 min
CACHE_BREADTH   = 300
CACHE_THREATS   = 300
CACHE_NEWS      = 900   # 15 min
CACHE_EARNINGS  = 3600  # 1 hr
CACHE_BRIEF     = 1800  # 30 min

WATCHLIST = [
    "TSEM","RKLB","DELL","CF","GKOS","NVDA","AVGO","PLTR",
    "APP","AXON","CRWD","COIN","MELI","LLY","GE","COST",
]
THREATS_LIST = ["CVNA","HIMS","SMCI"]
SECTOR_ETFS  = ["XLE","XLK","XLF","XLV","XLI","XLY","XLP","XLB","XLRE","XLU","XLC"]
SECTOR_NAMES = {
    "XLE":"Energy","XLK":"Tech","XLF":"Financials","XLV":"Healthcare",
    "XLI":"Industrials","XLY":"Cons Disc","XLP":"Cons Stpl","XLB":"Materials",
    "XLRE":"Real Estate","XLU":"Utilities","XLC":"Comms",
}

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
# DATA FETCHING
# ─────────────────────────────────────────────
def fetch_ohlcv(ticker: str, period: str = "2y") -> Optional[pd.DataFrame]:
    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period, auto_adjust=True)
        if df.empty or len(df) < 60:
            return None
        df = df[["Open","High","Low","Close","Volume"]].copy()
        df.index = pd.to_datetime(df.index)
        return df
    except Exception as e:
        log.warning(f"OHLCV fetch failed for {ticker}: {e}")
        return None

def fetch_fundamentals(ticker: str) -> dict:
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        fin = t.financials
        eps_growth, rev_growth, margins_exp = 0, 0, False
        try:
            if fin is not None and not fin.empty:
                ni = fin.loc["Net Income"] if "Net Income" in fin.index else None
                rev = fin.loc["Total Revenue"] if "Total Revenue" in fin.index else None
                gp  = fin.loc["Gross Profit"] if "Gross Profit" in fin.index else None
                if ni is not None and len(ni) >= 2 and ni.iloc[1] != 0:
                    eps_growth = int((ni.iloc[0] - ni.iloc[1]) / abs(ni.iloc[1]) * 100)
                if rev is not None and len(rev) >= 2 and rev.iloc[1] != 0:
                    rev_growth = int((rev.iloc[0] - rev.iloc[1]) / abs(rev.iloc[1]) * 100)
                if gp is not None and rev is not None and len(gp) >= 2 and len(rev) >= 2:
                    m0 = gp.iloc[0] / rev.iloc[0] if rev.iloc[0] else 0
                    m1 = gp.iloc[1] / rev.iloc[1] if rev.iloc[1] else 0
                    margins_exp = m0 > m1
        except Exception:
            pass
        return {
            "eps": eps_growth,
            "rev": rev_growth,
            "marginsExpanding": margins_exp,
            "marketCap": info.get("marketCap", 0),
            "roe": info.get("returnOnEquity", 0),
            "name": info.get("longName", ticker),
        }
    except Exception as e:
        log.warning(f"Fundamentals fetch failed for {ticker}: {e}")
        return {"eps": 0, "rev": 0, "marginsExpanding": False, "marketCap": 0, "roe": 0, "name": ticker}

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
    """Day / week / month / year % change."""
    c = df["Close"]
    def pct(n):
        if len(c) > n:
            return round((float(c.iloc[-1]) - float(c.iloc[-n-1])) / float(c.iloc[-n-1]) * 100, 2)
        return 0.0
    return pct(1), pct(5), pct(21), pct(252)

def calc_rs_rating(df: pd.DataFrame, spy_df: pd.DataFrame) -> int:
    """Relative Strength vs SPY, scaled 1–99."""
    try:
        s_ret = (float(df["Close"].iloc[-1]) - float(df["Close"].iloc[-252])) / float(df["Close"].iloc[-252])
        m_ret = (float(spy_df["Close"].iloc[-1]) - float(spy_df["Close"].iloc[-252])) / float(spy_df["Close"].iloc[-252])
        # Rough percentile based on excess return; real RS needs full universe
        excess = (s_ret - m_ret) * 100
        rs = int(min(99, max(1, 50 + excess * 1.5)))
        return rs
    except Exception:
        return 50

def weinstein_stage(df: pd.DataFrame) -> dict:
    """Classify Weinstein stage using 150d SMA as 30-week MA proxy."""
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
        "stage": stage,
        "ma150": round(sma_now, 2),
        "slopeWeeks": weeks_rising,
        "slopeRising": slope_rising,
        "pctFromMA": pct,
    }

def minervini_template(df: pd.DataFrame, rs: int) -> tuple[list, int]:
    """8-point Minervini Trend Template. Returns (criteria_list, score)."""
    if len(df) < 252:
        return [False]*8, 0
    c   = df["Close"]
    h   = df["High"]
    price   = float(c.iloc[-1])
    sma50   = float(c.rolling(50).mean().iloc[-1])
    sma150  = float(c.rolling(150).mean().iloc[-1])
    sma200  = float(c.rolling(200).mean().iloc[-1])
    sma200_20ago = float(c.rolling(200).mean().iloc[-21])
    high52  = float(h.rolling(252).max().iloc[-1])

    criteria = [
        price > sma50,
        price > sma150,
        price > sma200,
        sma50  > sma150,
        sma150 > sma200,
        sma200 > sma200_20ago,
        price >= high52 * 0.75,
        rs >= 70,
    ]
    return criteria, sum(criteria)

def kell_phase(df: pd.DataFrame) -> tuple[str, str, str, str, str]:
    """Returns (phase, light, ema_daily, ema_weekly, ema_monthly)."""
    if len(df) < 30:
        return "Unknown", "gray", "neutral", "neutral", "neutral"
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

    # EMA Crossback: recent low kissed 20 EMA
    recent_lo_5d = float(lo.iloc[-5:].min())
    ema20_vals_5d = e20.iloc[-10:]
    ema20_min = float(ema20_vals_5d.min()) if not ema20_vals_5d.empty else ema20
    touched_ema20 = abs(recent_lo_5d - ema20_min) / ema20_min < 0.025 if ema20_min else False

    # Bollinger squeeze (wedge)
    bb_std  = float(c.rolling(20).std().iloc[-1]) if len(c) > 20 else 1
    bb_mean = float(c.rolling(20).mean().iloc[-1]) if len(c) > 20 else price
    bb_pct  = (bb_std * 2) / bb_mean if bb_mean else 1

    # Volume ratio
    vol_avg = float(vol.rolling(50).mean().iloc[-1]) if len(vol) > 50 else 1
    vol_now = float(vol.iloc[-1]) if not vol.empty else 1
    vol_ratio = vol_now / vol_avg if vol_avg > 0 else 1

    # Phase
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

    return phase, light, ema_d, ema_w, ema_m

def detect_vcp(df: pd.DataFrame) -> dict:
    """Detect Volatility Contraction Pattern."""
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
            depth  = (hi_val - lo_val) / hi_val * 100
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
        len(contractions) * 20 +
        (20 if tightening else 0) +
        (20 if vol_dryup else 0) +
        (20 if len(contractions) >= 3 else 0)
    ))
    depths_str = "→".join([f"{d:.0f}%" for d in contractions[:4]])

    return {
        "count": len(contractions),
        "depths": depths_str,
        "pivot": round(pivot, 2),
        "tightness": tightness,
        "volDryup": vol_dryup,
    }

def short_stage(df: pd.DataFrame) -> dict:
    """Short-side Weinstein classification (Stage 3/4)."""
    w = weinstein_stage(df)
    stage = w["stage"]
    short_stage_val = "3" if stage == "3" else ("4A" if stage == "4A" else ("4B" if stage == "4B" else None))
    return {**w, "shortStage": short_stage_val}

def inverse_template(df: pd.DataFrame, rs: int) -> tuple[list, int]:
    """Inverse Minervini template for shorts (8 bearish criteria)."""
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
        price < sma50,
        price < sma150,
        price < sma200,
        sma50  < sma150,
        sma150 < sma200,
        sma200 < sma200_20ago,   # 200d declining
        price <= high52 * 0.75,  # at least 25% off 52-week high
        rs <= 30,
    ]
    return criteria, sum(criteria)

def convergence_score(wein: dict, tpl_score: int, rs: int, phase: str,
                      vcp: dict, mkt: dict, fund: dict, df: pd.DataFrame) -> tuple[int, str]:
    """Calculate MKW convergence score (0–22) and zone."""
    s = 0
    # Market (3)
    if mkt.get("spxStage") == 2:          s += 1
    if mkt.get("spxEma") == "above":       s += 1
    if mkt.get("tplCount", 0) > 300:       s += 1
    # Trend (5)
    if wein["stage"] == "2A":              s += 1
    if tpl_score == 8:                     s += 1
    if rs >= 70:                           s += 1
    if phase in ("EMA Crossback","Pop","Base n Break","Extension"): s += 1
    if tpl_score >= 5:                     s += 1  # MAs roughly stacked
    # Fundamentals (3)
    if fund.get("eps", 0)  > 20:           s += 1
    if fund.get("rev", 0)  > 15:           s += 1
    if fund.get("marginsExpanding", False): s += 1
    # Entry (4)
    if vcp["count"] >= 2:                  s += 1
    if vcp["volDryup"]:                    s += 1
    if phase in ("EMA Crossback","Pop"):   s += 1
    if vcp["pivot"]:
        price = float(df["Close"].iloc[-1])
        if abs(price / vcp["pivot"] - 1) <= 0.05: s += 1
    # Risk (3) — always award: stop is user's responsibility
    s += 3

    zone = "CONVERGENCE" if s >= 20 else "SECONDARY" if s >= 15 else "BUILDING" if s >= 10 else "WATCH"
    return s, zone

def short_convergence_score(wein: dict, inv_tpl: int, rs: int, phase: str,
                            mkt: dict, fund: dict) -> tuple[int, str]:
    """Short-side convergence score (0–22)."""
    s = 0
    # Market — indices weak (3)
    if mkt.get("spxStage", 2) >= 3:        s += 1
    if mkt.get("spxEma") != "above":       s += 1
    if mkt.get("tplCount", 999) < 300:     s += 1
    # Trend (5)
    stage = wein["stage"]
    if stage == "4A":                      s += 1
    if inv_tpl == 8:                       s += 1
    if rs <= 30:                           s += 1
    if phase in ("Red Light","Wedge"):     s += 1
    if inv_tpl >= 5:                       s += 1
    # Fundamentals (3)
    if fund.get("eps", 0)  < 0:            s += 1
    if fund.get("rev", 0)  < 0:            s += 1
    if not fund.get("marginsExpanding",True): s += 1
    # Entry (4)
    s += 1  # failed rally (approximate)
    s += 1  # volume (approximate)
    if phase in ("Red Light","Wedge"):     s += 1
    if rs <= 20:                           s += 1
    # Risk (3)
    s += 3

    zone = ("SHORT_CONVERGENCE" if s >= 20 else
            "SHORT_SECONDARY"   if s >= 15 else
            "SHORT_WATCH"       if s >= 10 else "NEUTRAL")
    return s, zone

def build_setup_text(ticker: str, wein: dict, tpl_score: int, rs: int,
                     phase: str, vcp: dict, conv_zone: str) -> str:
    """Generate a human-readable setup description."""
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
# CORE ANALYSIS FUNCTION
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
    """Run full MKW analysis on a single ticker. Returns structured result or None on failure."""
    try:
        df = fetch_ohlcv(ticker, "2y")
        if df is None or len(df) < 100:
            return None
        time.sleep(0.3)  # rate limit

        fund = fetch_fundamentals(ticker)
        time.sleep(0.2)

        # Core calculations
        dp, wp, mp, yp = calc_returns(df)
        rs = calc_rs_rating(df, spy_df)
        wein = weinstein_stage(df)
        tpl_criteria, tpl_score = minervini_template(df, rs)
        phase, light, ema_d, ema_w, ema_m = kell_phase(df)
        vcp = detect_vcp(df)

        # Base count (approximate: number of consolidation periods)
        base = max(1, int(len([p for p in [wein["stage"]] if p in ("2A","2B")]) + vcp["count"] / 2))

        # Convergence
        conv_s, conv_z = convergence_score(wein, tpl_score, rs, phase, vcp, mkt, fund, df)

        # Short-side
        inv_criteria, inv_score = inverse_template(df, rs)
        short_s, short_z = short_convergence_score(wein, inv_score, rs, phase, mkt, fund)

        # Flags
        flags = []
        if rs < 70:               flags.append(f"RS {rs} < 70")
        if tpl_score < 8:         flags.append(f"{tpl_score}/8 template")
        if wein["stage"] == "2B": flags.append("Stage 2B (mature)")
        if fund["eps"] <= 0:      flags.append("EPS negative")
        if vcp["count"] == 0:     flags.append("No VCP")

        price = float(df["Close"].iloc[-1])

        return {
            "tk":  ticker,
            "nm":  fund["name"],
            "px":  round(price, 2),
            "dp":  dp, "wp": wp, "mp": mp, "yp": yp,
            "wein": {
                "stage":      wein["stage"],
                "ma150":      wein["ma150"],
                "slopeWeeks": wein["slopeWeeks"],
                "slopeRising":wein["slopeRising"],
                "pctFromMA":  wein["pctFromMA"],
            },
            "min": {
                "tpl":      tpl_criteria,
                "tplScore": tpl_score,
                "rs":       rs,
                "eps":      fund["eps"],
                "rev":      fund["rev"],
                "marginsExpanding": fund["marginsExpanding"],
                "pivot":    vcp["pivot"],
            },
            "vcp": vcp,
            "kell": {
                "phase": phase,
                "light": light,
                "emaD":  ema_d,
                "emaW":  ema_w,
                "emaM":  ema_m,
                "base":  base,
            },
            "conv": {
                "score": conv_s,
                "max":   22,
                "zone":  conv_z,
            },
            "shortConv": {
                "score":     short_s,
                "max":       22,
                "zone":      short_z,
                "invTpl":    inv_criteria,
                "invScore":  inv_score,
            },
            "setup": build_setup_text(ticker, wein, tpl_score, rs, phase, vcp, conv_z),
            "risk":  f"Stage {wein['stage']} · RS {rs} · {phase}",
            "optPlay": build_opt_play(ticker, price, vcp, phase, conv_z),
            "flags": flags,
            "fundamentals": fund,
        }
    except Exception as e:
        log.error(f"analyze_ticker({ticker}): {e}")
        return None

def build_opt_play(ticker: str, price: float, vcp: dict, phase: str, zone: str) -> str:
    if zone not in ("CONVERGENCE","SECONDARY"):
        return "No play"
    if phase not in ("EMA Crossback","Pop","Base n Break"):
        return "Wait for phase confirmation"
    if not vcp["pivot"]:
        return "No defined pivot"
    pivot = vcp["pivot"]
    # Swing call: ~5% OTM strike, 45 DTE
    strike = round(pivot * 1.03 / 5) * 5
    return f"${int(strike)}C +45 DTE · delta ~0.55 · size 2-5% port"

# ─────────────────────────────────────────────
# MARKET BREADTH
# ─────────────────────────────────────────────
def compute_breadth() -> dict:
    """Fetch S&P 500 breadth indicators."""
    indices = {"SPY":"S&P 500","QQQ":"NASDAQ 100","IWM":"Russell 2000","^VIX":"VIX"}
    result = {}
    for sym, name in indices.items():
        try:
            df = fetch_ohlcv(sym if sym != "^VIX" else sym, "6mo")
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
                    "price": round(price, 2),
                    "chg": dp,
                    "stage": int(w["stage"][0]) if w["stage"][0].isdigit() else 2,
                    "ema20": "above" if price > e20 else "below",
                }
            time.sleep(0.3)
        except Exception as e:
            log.warning(f"Breadth {sym}: {e}")

    # Sector ETF performance
    sectors = []
    for etf in SECTOR_ETFS:
        try:
            df = fetch_ohlcv(etf, "3mo")
            if df is None: continue
            dp, wp, mp, _ = calc_returns(df)
            w = weinstein_stage(df)
            sectors.append({"n": SECTOR_NAMES.get(etf, etf), "etf": etf,
                             "p": dp, "wp": wp, "mp": mp, "stage": w["stage"]})
            time.sleep(0.3)
        except Exception:
            pass

    # Approximate tplCount from a quick scan (50 large-caps)
    scan_tickers = [
        "AAPL","MSFT","NVDA","AMZN","META","GOOGL","TSLA","AVGO","BRK-B","JPM",
        "COST","LLY","UNH","V","MA","HD","ORCL","ABBV","MRK","PEP",
        "KO","WMT","BAC","CRM","NFLX","AMD","INTC","TMO","CSCO","NKE",
        "ADBE","PYPL","DIS","SBUX","GS","MS","UPS","CAT","HON","DE",
        "GE","AXON","PLTR","CRWD","COIN","MELI","LMT","RTX","NOC","MMM",
    ]
    tpl_count = 0
    spy_df_tmp = get_spy()
    for t in scan_tickers[:30]:  # cap at 30 for speed
        try:
            df = fetch_ohlcv(t, "1y")
            if df is None or len(df) < 250: continue
            rs = calc_rs_rating(df, spy_df_tmp) if spy_df_tmp is not None else 50
            _, score = minervini_template(df, rs)
            if score == 8: tpl_count += 1
            time.sleep(0.25)
        except Exception:
            pass
    # Scale from 30-stock sample to ~500 universe estimate
    tpl_count_est = int(tpl_count / 30 * 500)

    spx = result.get("spy", {})
    return {
        "spx":     spx,
        "ndx":     result.get("qqq", {}),
        "rut":     result.get("iwm", {}),
        "vix":     result.get("vix", 20),
        "spxStage":   spx.get("stage", 2),
        "spxEma":     spx.get("ema20", "above"),
        "tplCount":   tpl_count_est,
        "sectors":    sectors,
        "lastUpdated": datetime.utcnow().isoformat(),
    }

# ─────────────────────────────────────────────
# THREATS / DIVERGENCE
# ─────────────────────────────────────────────
def compute_threats(spy_df: pd.DataFrame, mkt: dict) -> list:
    results = []
    for tk in THREATS_LIST:
        try:
            data = analyze_ticker(tk, spy_df, mkt)
            if data is None: continue
            # Threat score based on short convergence
            short_s = data["shortConv"]["score"]
            threat_sc = round(min(10, short_s / 22 * 10), 1)
            # Insider data from Finnhub
            insiders = finnhub_get(f"/stock/insider-transactions", {"symbol": tk})
            insider_sells = 0
            if isinstance(insiders, dict) and "data" in insiders:
                insider_sells = len([x for x in insiders["data"] if x.get("transactionType") == "S"])

            # News from Finnhub
            from_date = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
            to_date   = datetime.utcnow().strftime("%Y-%m-%d")
            news = finnhub_get(f"/company-news", {"symbol": tk, "from": from_date, "to": to_date})
            top_news = []
            if isinstance(news, list):
                top_news = [{"h": n.get("headline",""), "s": n.get("source",""), "t": n.get("datetime",0)} for n in news[:3]]

            wein = data["wein"]
            div_signals = []
            if wein["stage"] in ("3","4A","4B"):
                div_signals.append(f"Weinstein Stage {wein['stage']} — {'distribution' if wein['stage']=='3' else 'declining'}")
            if data["min"]["tplScore"] <= 3:
                div_signals.append(f"Minervini Template {data['min']['tplScore']}/8 — failing")
            if data["kell"]["phase"] in ("Red Light","Wedge","Extension"):
                div_signals.append(f"Kell {data['kell']['phase']} — bearish phase")
            if data["min"]["rs"] < 30:
                div_signals.append(f"RS {data['min']['rs']} — extreme laggard")

            sf_data = finnhub_get(f"/stock/quote", {"symbol": tk})
            short_float = 0

            results.append({
                "tk":          tk,
                "sc":          threat_sc,
                "type":        classify_threat_type(data),
                "sum":         data["setup"],
                "sf":          short_float,
                "mc":          data["mp"],
                "wein":        data["wein"],
                "divSignals":  div_signals,
                "insiderSells":insider_sells,
                "news":        top_news,
                "shortConv":   data["shortConv"],
            })
        except Exception as e:
            log.error(f"Threat {tk}: {e}")
    return results

def classify_threat_type(data: dict) -> str:
    stage = data["wein"]["stage"]
    rs    = data["min"]["rs"]
    if stage in ("4A","4B"): return "Stage 4 Decline"
    if stage == "3":         return "Distribution / Stage 3"
    if rs < 20:              return "RS Laggard"
    if data["min"]["tplScore"] <= 2: return "Template Failure"
    return "Divergence Alert"

# ─────────────────────────────────────────────
# NEWS
# ─────────────────────────────────────────────
def fetch_news_data(watchlist_tickers: list) -> dict:
    market_news, watchlist_alerts = [], []
    if not FINNHUB_KEY:
        return {"watchlistAlerts": [], "marketNews": [], "note": "Finnhub key not configured"}

    # General market news
    gen_news = finnhub_get("/news", {"category": "general", "minId": 0})
    if isinstance(gen_news, list):
        for n in gen_news[:20]:
            market_news.append({
                "headline":  n.get("headline", ""),
                "source":    n.get("source", ""),
                "summary":   n.get("summary", ""),
                "time":      n.get("datetime", 0),
                "url":       n.get("url", ""),
                "sentiment": "neutral",
            })

    # Company news for watchlist
    from_date = (datetime.utcnow() - timedelta(days=3)).strftime("%Y-%m-%d")
    to_date   = datetime.utcnow().strftime("%Y-%m-%d")
    for tk in watchlist_tickers[:8]:  # limit for rate
        try:
            news = finnhub_get("/company-news", {"symbol": tk, "from": from_date, "to": to_date})
            if isinstance(news, list):
                for n in news[:3]:
                    watchlist_alerts.append({
                        "ticker":    tk,
                        "headline":  n.get("headline", ""),
                        "source":    n.get("source", ""),
                        "summary":   n.get("summary", ""),
                        "time":      n.get("datetime", 0),
                        "sentiment": "neutral",
                    })
            time.sleep(0.2)
        except Exception:
            pass

    return {
        "watchlistAlerts": sorted(watchlist_alerts, key=lambda x: x["time"], reverse=True)[:20],
        "marketNews":      sorted(market_news,      key=lambda x: x["time"], reverse=True)[:30],
    }

def fetch_earnings_calendar(tickers: list) -> list:
    if not FINNHUB_KEY:
        return []
    from_date = datetime.utcnow().strftime("%Y-%m-%d")
    to_date   = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
    cal = finnhub_get("/calendar/earnings", {"from": from_date, "to": to_date})
    results = []
    if isinstance(cal, dict) and "earningsCalendar" in cal:
        for e in cal["earningsCalendar"]:
            sym = e.get("symbol","")
            if sym in tickers:
                results.append({
                    "ticker": sym,
                    "date":   e.get("date",""),
                    "eps_est":e.get("epsEstimate"),
                    "hour":   e.get("hour",""),
                })
    return sorted(results, key=lambda x: x["date"])

# ─────────────────────────────────────────────
# DAILY BRIEF (Claude API)
# ─────────────────────────────────────────────
def generate_daily_brief(watchlist_data: list, breadth: dict, threats: list) -> str:
    if not CLAUDE_KEY:
        return "## Daily Brief\n\nConfigure `ANTHROPIC_API_KEY` to enable AI-generated briefs.\n\nIn the meantime: review your convergence setups manually using the Watchlist and Plays tabs."

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=CLAUDE_KEY)

        conv_stocks  = [s for s in watchlist_data if s["conv"]["zone"] == "CONVERGENCE"]
        sec_stocks   = [s for s in watchlist_data if s["conv"]["zone"] == "SECONDARY"]
        short_stocks = [s for s in watchlist_data if s["shortConv"]["zone"] in ("SHORT_CONVERGENCE","SHORT_SECONDARY")]

        context = f"""
MARKET BREADTH:
- S&P 500: Stage {breadth.get('spxStage')}, {breadth.get('spxEma')} 20 EMA
- VIX: {breadth.get('vix')}
- Template qualifiers: ~{breadth.get('tplCount')} stocks

CONVERGENCE SETUPS (Long):
{json.dumps([{"tk":s["tk"],"stage":s["wein"]["stage"],"rs":s["min"]["rs"],"phase":s["kell"]["phase"],"score":s["conv"]["score"],"setup":s["setup"]} for s in conv_stocks], indent=2)}

SECONDARY SETUPS:
{json.dumps([{"tk":s["tk"],"score":s["conv"]["score"],"setup":s["setup"]} for s in sec_stocks], indent=2)}

SHORT SETUPS:
{json.dumps([{"tk":s["tk"],"shortScore":s["shortConv"]["score"],"zone":s["shortConv"]["zone"]} for s in short_stocks], indent=2)}

DIVERGENCE / THREATS:
{json.dumps([{"tk":t["tk"],"type":t["type"],"score":t["sc"]} for t in threats], indent=2)}
"""

        msg = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1500,
            system="""You are a senior trading desk analyst writing a morning brief for a swing trader
using the MKW system (Minervini × Kell × Weinstein convergence methodology).
Be specific, use actual numbers, reference tickers by name, and provide actionable guidance.
Write in a direct, professional tone with markdown headers. No disclaimers.""",
            messages=[{"role": "user", "content": f"Generate today's MKW morning brief:\n{context}"}]
        )
        return msg.content[0].text
    except Exception as e:
        log.error(f"Claude API error: {e}")
        return f"## Brief Generation Error\n\nError: {e}\n\nCheck that your ANTHROPIC_API_KEY is set correctly."

# ─────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up SPY data on startup
    log.info("Warming up SPY data...")
    get_spy()
    yield

app = FastAPI(title="MKW Command Center API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Endpoints ──

@app.get("/api/watchlist")
def get_watchlist():
    cached = cache_get("watchlist", CACHE_WATCHLIST)
    if cached: return cached

    spy_df = get_spy()
    if spy_df is None:
        raise HTTPException(503, "Could not fetch market data")

    mkt = _mkt_snapshot
    stocks = []
    for tk in WATCHLIST:
        result = analyze_ticker(tk, spy_df, mkt)
        if result:
            stocks.append(result)

    resp = {"stocks": stocks, "lastUpdated": datetime.utcnow().isoformat()}
    cache_set("watchlist", resp)
    return resp

@app.get("/api/analyze/{ticker}")
def get_analyze(ticker: str):
    ticker = ticker.upper().strip()
    key = f"analyze_{ticker}"
    cached = cache_get(key, CACHE_WATCHLIST)
    if cached: return cached

    spy_df = get_spy()
    result = analyze_ticker(ticker, spy_df or pd.DataFrame(), _mkt_snapshot)
    if result is None:
        raise HTTPException(404, f"Could not analyze {ticker}")

    cache_set(key, result)
    return result

@app.get("/api/breadth")
def get_breadth():
    cached = cache_get("breadth", CACHE_BREADTH)
    if cached: return cached

    data = compute_breadth()
    # Update global mkt snapshot so other endpoints stay in sync
    global _mkt_snapshot
    _mkt_snapshot = {
        "spxStage": data.get("spxStage", 2),
        "spxEma":   data.get("spxEma", "above"),
        "tplCount": data.get("tplCount", 500),
        "vix":      data.get("vix", 20),
    }
    cache_set("breadth", data)
    return data

@app.get("/api/threats")
def get_threats():
    cached = cache_get("threats", CACHE_THREATS)
    if cached: return cached

    spy_df = get_spy()
    data = compute_threats(spy_df or pd.DataFrame(), _mkt_snapshot)
    resp = {"threats": data, "lastUpdated": datetime.utcnow().isoformat()}
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
def get_earnings():
    cached = cache_get("earnings", CACHE_EARNINGS)
    if cached: return cached

    data = fetch_earnings_calendar(WATCHLIST + THREATS_LIST)
    resp = {"earnings": data, "lastUpdated": datetime.utcnow().isoformat()}
    cache_set("earnings", resp)
    return resp

@app.get("/api/daily-brief")
def get_daily_brief():
    cached = cache_get("brief", CACHE_BRIEF)
    if cached: return cached

    # Need watchlist + breadth + threats data
    wl_cached  = cache_get("watchlist", CACHE_WATCHLIST * 2)
    br_cached  = cache_get("breadth",   CACHE_BREADTH * 2)
    th_cached  = cache_get("threats",   CACHE_THREATS * 2)

    watchlist_data = (wl_cached or {}).get("stocks", [])
    breadth_data   = br_cached  or _mkt_snapshot
    threats_data   = (th_cached or {}).get("threats", [])

    content = generate_daily_brief(watchlist_data, breadth_data, threats_data)
    resp = {"content": content, "generatedAt": datetime.utcnow().isoformat()}
    cache_set("brief", resp)
    return resp

@app.get("/api/health")
def health():
    return {"status": "ok", "finnhub": bool(FINNHUB_KEY), "claude": bool(CLAUDE_KEY)}

# ── Serve static frontend (production) ──
dist_path = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.isdir(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        index = os.path.join(dist_path, "index.html")
        return FileResponse(index)
