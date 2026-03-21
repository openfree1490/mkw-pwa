"""
MKW Command Center — FastAPI Backend
Minervini × Kell × Weinstein convergence engine
"""

import os, time, json, logging, asyncio, uuid
from datetime import datetime, timedelta
from typing import Optional
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd
import yfinance as yf
import requests
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import traceback

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
    "NVDA","AVGO","TSLA","AAPL","MSFT","GOOGL","META","AMZN","AMD","CRM",
    "PLTR","CRWD","PANW","NET","DDOG","APP","AXON","COIN","MELI","SHOP",
    "SNOW","NOW","ADBE","ORCL","TSM","ASML","KLAC","LRCX","AMAT","MRVL",
    "LLY","UNH","ISRG","VRTX","GE","CAT","DE","LMT","XOM","COST",
    "WMT","HD","V","MA","GS","JPM","TSEM","RKLB","DELL","CF",
    "GKOS","CELH","DUOL","HIMS","TOST","DECK","CMG","LULU","ON","MPWR",
]
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

_positions: dict = {}  # populated at startup

# ─────────────────────────────────────────────
# NUMPY SERIALIZATION FIX
# ─────────────────────────────────────────────
def to_python(obj):
    """Recursively convert numpy types to native Python for JSON serialization."""
    if isinstance(obj, dict):
        return {k: to_python(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_python(v) for v in obj]
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
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

        # Additional fundamental fields
        gross_margins = info.get("grossMargins", 0) or 0
        roe = info.get("returnOnEquity", 0) or 0
        fcf = info.get("freeCashflow", 0) or 0
        trailing_pe = info.get("trailingPE", None)
        forward_pe = info.get("forwardPE", None)

        # Institutional ownership — use institutionCountHoldings or 0
        inst_pct = info.get("institutionCountHoldings", 0) or 0

        # Next earnings date from calendar
        next_earnings = ""
        try:
            cal = t.calendar
            if cal is not None:
                if isinstance(cal, dict):
                    earnings_date = cal.get("Earnings Date", None)
                    if earnings_date is not None:
                        if hasattr(earnings_date, '__iter__') and not isinstance(earnings_date, str):
                            earnings_date = list(earnings_date)
                            if earnings_date:
                                next_earnings = str(earnings_date[0])[:10]
                        else:
                            next_earnings = str(earnings_date)[:10]
                elif isinstance(cal, pd.DataFrame):
                    if "Earnings Date" in cal.index:
                        val = cal.loc["Earnings Date"].iloc[0] if not cal.loc["Earnings Date"].empty else ""
                        next_earnings = str(val)[:10] if val else ""
        except Exception:
            pass

        return {
            "eps": eps_growth,
            "rev": rev_growth,
            "marginsExpanding": margins_exp,
            "marketCap": info.get("marketCap", 0),
            "roe": roe,
            "name": info.get("longName", ticker),
            "grossMargins": round(float(gross_margins), 4) if gross_margins else 0,
            "returnOnEquity": round(float(roe), 4) if roe else 0,
            "freeCashflow": int(fcf) if fcf else 0,
            "trailingPE": round(float(trailing_pe), 2) if trailing_pe else None,
            "forwardPE": round(float(forward_pe), 2) if forward_pe else None,
            "institutionalOwnershipPct": int(inst_pct) if inst_pct else 0,
            "nextEarningsDate": next_earnings,
            "sector": info.get("sector", ""),
        }
    except Exception as e:
        log.warning(f"Fundamentals fetch failed for {ticker}: {e}")
        return {
            "eps": 0, "rev": 0, "marginsExpanding": False, "marketCap": 0, "roe": 0,
            "name": ticker, "grossMargins": 0, "returnOnEquity": 0, "freeCashflow": 0,
            "trailingPE": None, "forwardPE": None, "institutionalOwnershipPct": 0,
            "nextEarningsDate": "", "sector": "",
        }

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

def kell_phase(df: pd.DataFrame):
    """Returns (phase, light, ema_daily, ema_weekly, ema_monthly, ema10_val, ema20_val, ema50_val, ema100_val, ema200_val)."""
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

    return (
        phase, light, ema_d, ema_w, ema_m,
        round(ema10, 2), round(ema20, 2), round(ema50, 2), round(ema100, 2), round(ema200, 2),
    )

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
                      vcp: dict, mkt: dict, fund: dict, df: pd.DataFrame,
                      detailed: bool = False):
    """Calculate MKW convergence score (0–22) and zone.
    If detailed=True, returns (score, zone, details_dict).
    Zone thresholds: CONVERGENCE>=17, SECONDARY>=12, BUILDING>=8.
    """
    price = float(df["Close"].iloc[-1]) if not df.empty else 0
    near_pivot = bool(vcp["pivot"] and abs(price / vcp["pivot"] - 1) <= 0.07) if vcp["pivot"] else False

    criteria = {
        # Market (3)
        "mkt_spx_stage2":  (mkt.get("spxStage") == 2,       1, f"SPX Stage {mkt.get('spxStage')}"),
        "mkt_spx_ema":     (mkt.get("spxEma") == "above",   1, f"SPX EMA {mkt.get('spxEma')}"),
        "mkt_tpl_count":   (mkt.get("tplCount", 0) > 200,   1, f"TPL count {mkt.get('tplCount',0)}"),
        # Trend (5)
        "trend_stage2":    (wein["stage"] in ("2A","2B"),    1, f"Stage {wein['stage']}"),
        "trend_tpl8":      (tpl_score == 8,                  1, f"TPL {tpl_score}/8"),
        "trend_rs70":      (rs >= 70,                        1, f"RS {rs}"),
        "trend_kell_ok":   (phase in ("EMA Crossback","Pop","Base n Break","Extension","Reversal"), 1, f"Phase {phase}"),
        "trend_tpl5":      (tpl_score >= 5,                  1, f"TPL>=5 ({tpl_score})"),
        # Fundamentals (3)
        "fund_eps":        (fund.get("eps", 0) > 15,         1, f"EPS growth {fund.get('eps',0)}%"),
        "fund_rev":        (fund.get("rev", 0) > 10,         1, f"Rev growth {fund.get('rev',0)}%"),
        "fund_margins":    (bool(fund.get("marginsExpanding", False)), 1, "Margins expanding"),
        # Entry (4)
        "entry_vcp":       (vcp["count"] >= 2,               1, f"VCP {vcp['count']}ct"),
        "entry_dryup":     (bool(vcp["volDryup"]),            1, "Volume dry-up"),
        "entry_phase":     (phase in ("EMA Crossback","Pop","Extension"), 1, f"Entry phase {phase}"),
        "entry_pivot":     (near_pivot,                      1, f"Near pivot {vcp.get('pivot','—')}"),
        # Risk (3) — user manages position sizing
        "risk_stop":       (True,                            1, "Stop defined (user)"),
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
# NEW: TECHNICAL INDICATORS
# ─────────────────────────────────────────────
def calc_technicals(df: pd.DataFrame) -> dict:
    """
    Returns dict with RSI, MACD, Bollinger Bands, ADX, Stochastic, OBV trend,
    moving averages, 52w high/low, and ADR%.
    All wrapped in try/except for safe defaults.
    """
    safe = {
        "rsi": 50.0,
        "macd": {"line": 0.0, "signal": 0.0, "histogram": 0.0, "bullish": False, "crossing_up": False},
        "bb": {"upper": 0.0, "lower": 0.0, "mid": 0.0, "width_pct": 0.0, "squeeze": False},
        "adx": 20.0,
        "stoch": {"k": 50.0, "d": 50.0},
        "obv_trend": "rising",
        "mas": {"ema10": 0.0, "ema20": 0.0, "sma50": 0.0, "sma150": 0.0, "sma200": 0.0},
        "high52": 0.0,
        "low52": 0.0,
        "pctFrom52h": 0.0,
        "pctFrom52l": 0.0,
        "adr_pct": 0.0,
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
        rsi_val = 50.0
        try:
            delta = c.diff()
            gain = delta.clip(lower=0)
            loss = -delta.clip(upper=0)
            avg_gain = gain.ewm(com=13, adjust=False).mean()
            avg_loss = loss.ewm(com=13, adjust=False).mean()
            rs_rsi = avg_gain / avg_loss.replace(0, np.nan)
            rsi_series = 100 - (100 / (1 + rs_rsi))
            rsi_val = round(float(rsi_series.iloc[-1]), 1)
        except Exception:
            pass

        # MACD(12,26,9)
        macd_line_val, macd_signal_val, macd_hist_val = 0.0, 0.0, 0.0
        macd_bullish, macd_crossing_up = False, False
        try:
            ema12 = c.ewm(span=12, adjust=False).mean()
            ema26 = c.ewm(span=26, adjust=False).mean()
            macd_line = ema12 - ema26
            macd_signal = macd_line.ewm(span=9, adjust=False).mean()
            macd_hist = macd_line - macd_signal
            macd_line_val = round(float(macd_line.iloc[-1]), 4)
            macd_signal_val = round(float(macd_signal.iloc[-1]), 4)
            macd_hist_val = round(float(macd_hist.iloc[-1]), 4)
            macd_bullish = bool(macd_line_val > macd_signal_val)
            # crossing_up: histogram just turned positive (prev was negative)
            if len(macd_hist) >= 2:
                prev_hist = float(macd_hist.iloc[-2])
                macd_crossing_up = bool(macd_hist_val > 0 and prev_hist <= 0)
        except Exception:
            pass

        # Bollinger Bands(20, 2)
        bb_upper, bb_lower, bb_mid, bb_width_pct = 0.0, 0.0, 0.0, 0.0
        bb_squeeze = False
        try:
            sma20 = c.rolling(20).mean()
            std20 = c.rolling(20).std()
            bb_upper_series = sma20 + 2 * std20
            bb_lower_series = sma20 - 2 * std20
            bb_width_series = (bb_upper_series - bb_lower_series) / sma20

            bb_upper = round(float(bb_upper_series.iloc[-1]), 2)
            bb_lower = round(float(bb_lower_series.iloc[-1]), 2)
            bb_mid   = round(float(sma20.iloc[-1]), 2)
            current_width = float(bb_width_series.iloc[-1])
            bb_width_pct = round(current_width * 100, 2)

            # Squeeze: current width < 80% of 20-period average width
            avg_width_20 = float(bb_width_series.rolling(20).mean().iloc[-1]) if len(bb_width_series) >= 20 else current_width
            bb_squeeze = bool(current_width < avg_width_20 * 0.80)
        except Exception:
            pass

        # ADX(14)
        adx_val = 20.0
        try:
            high_s = h
            low_s  = lo
            close_s = c
            tr1 = high_s - low_s
            tr2 = (high_s - close_s.shift(1)).abs()
            tr3 = (low_s  - close_s.shift(1)).abs()
            tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
            atr14 = tr.ewm(com=13, adjust=False).mean()

            dm_plus  = (high_s.diff()).clip(lower=0)
            dm_minus = (-low_s.diff()).clip(lower=0)
            # Where dm_plus < dm_minus, set dm_plus to 0 and vice versa
            dm_plus_adj  = dm_plus.where(dm_plus > dm_minus, 0)
            dm_minus_adj = dm_minus.where(dm_minus > dm_plus, 0)

            di_plus  = 100 * dm_plus_adj.ewm(com=13, adjust=False).mean() / atr14.replace(0, np.nan)
            di_minus = 100 * dm_minus_adj.ewm(com=13, adjust=False).mean() / atr14.replace(0, np.nan)
            dx = 100 * (di_plus - di_minus).abs() / (di_plus + di_minus).replace(0, np.nan)
            adx_series = dx.ewm(com=13, adjust=False).mean()
            adx_val = round(float(adx_series.iloc[-1]), 1)
        except Exception:
            pass

        # Stochastic(14,3)
        stoch_k, stoch_d = 50.0, 50.0
        try:
            low14  = lo.rolling(14).min()
            high14 = h.rolling(14).max()
            k_series = 100 * (c - low14) / (high14 - low14).replace(0, np.nan)
            d_series = k_series.rolling(3).mean()
            stoch_k = round(float(k_series.iloc[-1]), 1)
            stoch_d = round(float(d_series.iloc[-1]), 1)
        except Exception:
            pass

        # OBV trend vs 20-day OBV MA
        obv_trend_val = "rising"
        try:
            obv = (np.sign(c.diff()) * vol).fillna(0).cumsum()
            obv_ma20 = obv.rolling(20).mean()
            obv_trend_val = "rising" if float(obv.iloc[-1]) > float(obv_ma20.iloc[-1]) else "falling"
        except Exception:
            pass

        # Moving averages
        ema10_val = 0.0
        ema20_val = 0.0
        sma50_val = 0.0
        sma150_val = 0.0
        sma200_val = 0.0
        try:
            ema10_val  = round(float(c.ewm(span=10,  adjust=False).mean().iloc[-1]), 2)
            ema20_val  = round(float(c.ewm(span=20,  adjust=False).mean().iloc[-1]), 2)
            sma50_val  = round(float(c.rolling(50).mean().iloc[-1]),  2) if len(c) >= 50  else 0.0
            sma150_val = round(float(c.rolling(150).mean().iloc[-1]), 2) if len(c) >= 150 else 0.0
            sma200_val = round(float(c.rolling(200).mean().iloc[-1]), 2) if len(c) >= 200 else 0.0
        except Exception:
            pass

        # 52-week high/low
        high52_val, low52_val, pct_from_52h, pct_from_52l = 0.0, 0.0, 0.0, 0.0
        try:
            lookback = min(252, len(h))
            high52_val = round(float(h.iloc[-lookback:].max()), 2)
            low52_val  = round(float(lo.iloc[-lookback:].min()), 2)
            pct_from_52h = round((price - high52_val) / high52_val * 100, 1) if high52_val else 0.0
            pct_from_52l = round((price - low52_val)  / low52_val  * 100, 1) if low52_val  else 0.0
        except Exception:
            pass

        # ADR% — Average Daily Range over 20 days
        adr_pct_val = 0.0
        try:
            lookback_adr = min(20, len(h))
            daily_range = ((h.iloc[-lookback_adr:] - lo.iloc[-lookback_adr:]) /
                           c.iloc[-lookback_adr:]) * 100
            adr_pct_val = round(float(daily_range.mean()), 2)
        except Exception:
            pass

        return {
            "rsi": rsi_val,
            "macd": {
                "line":       macd_line_val,
                "signal":     macd_signal_val,
                "histogram":  macd_hist_val,
                "bullish":    macd_bullish,
                "crossing_up": macd_crossing_up,
            },
            "bb": {
                "upper":     bb_upper,
                "lower":     bb_lower,
                "mid":       bb_mid,
                "width_pct": bb_width_pct,
                "squeeze":   bb_squeeze,
            },
            "adx": adx_val,
            "stoch": {"k": stoch_k, "d": stoch_d},
            "obv_trend": obv_trend_val,
            "mas": {
                "ema10":  ema10_val,
                "ema20":  ema20_val,
                "sma50":  sma50_val,
                "sma150": sma150_val,
                "sma200": sma200_val,
            },
            "high52":     high52_val,
            "low52":      low52_val,
            "pctFrom52h": pct_from_52h,
            "pctFrom52l": pct_from_52l,
            "adr_pct":    adr_pct_val,
        }

    except Exception as e:
        log.warning(f"calc_technicals error: {e}")
        return safe

# ─────────────────────────────────────────────
# NEW: SUPPORT / RESISTANCE LEVELS
# ─────────────────────────────────────────────
def calc_sr_levels(df: pd.DataFrame) -> list:
    """
    Returns list of dicts [{price, type, label, strength}] for key S/R levels.
    Sorted by price descending. Max 8 levels. Prices rounded to 2dp.
    """
    if df is None or len(df) < 50:
        return []

    try:
        c = df["Close"]
        h = df["High"]
        lo = df["Low"]
        price = float(c.iloc[-1])
        levels = []

        # 52-week high (resistance)
        try:
            lookback = min(252, len(h))
            high52 = round(float(h.iloc[-lookback:].max()), 2)
            levels.append({
                "price":    high52,
                "type":     "resistance",
                "label":    "52W High",
                "strength": 3,
            })
        except Exception:
            pass

        # 52-week low (support)
        try:
            lookback = min(252, len(lo))
            low52 = round(float(lo.iloc[-lookback:].min()), 2)
            levels.append({
                "price":    low52,
                "type":     "support",
                "label":    "52W Low",
                "strength": 3,
            })
        except Exception:
            pass

        # 200d SMA
        try:
            if len(c) >= 200:
                sma200 = round(float(c.rolling(200).mean().iloc[-1]), 2)
                lvl_type = "support" if price > sma200 else "resistance"
                levels.append({
                    "price":    sma200,
                    "type":     lvl_type,
                    "label":    "200d SMA",
                    "strength": 3,
                })
        except Exception:
            pass

        # 150d SMA
        try:
            if len(c) >= 150:
                sma150 = round(float(c.rolling(150).mean().iloc[-1]), 2)
                lvl_type = "support" if price > sma150 else "resistance"
                levels.append({
                    "price":    sma150,
                    "type":     lvl_type,
                    "label":    "150d SMA",
                    "strength": 2,
                })
        except Exception:
            pass

        # 50d SMA
        try:
            if len(c) >= 50:
                sma50 = round(float(c.rolling(50).mean().iloc[-1]), 2)
                lvl_type = "support" if price > sma50 else "resistance"
                levels.append({
                    "price":    sma50,
                    "type":     lvl_type,
                    "label":    "50d SMA",
                    "strength": 2,
                })
        except Exception:
            pass

        # Prior consolidation high/low (highest high and lowest low in 30-60d window before last 20 days)
        try:
            if len(df) >= 80:
                # Window: from -80 to -20 days (30-60d before last 20 days)
                consol_window_h = h.iloc[-80:-20]
                consol_window_l = lo.iloc[-80:-20]
                consol_high = round(float(consol_window_h.max()), 2)
                consol_low  = round(float(consol_window_l.min()), 2)
                lvl_type_h = "resistance" if price < consol_high else "support"
                lvl_type_l = "support" if price > consol_low else "resistance"
                levels.append({
                    "price":    consol_high,
                    "type":     lvl_type_h,
                    "label":    "Prior Consol High",
                    "strength": 2,
                })
                levels.append({
                    "price":    consol_low,
                    "type":     lvl_type_l,
                    "label":    "Prior Consol Low",
                    "strength": 1,
                })
        except Exception:
            pass

        # Sort by price descending, deduplicate close levels, max 8
        levels = sorted(levels, key=lambda x: x["price"], reverse=True)

        # Deduplicate levels within 1% of each other
        deduped = []
        for lvl in levels:
            if not deduped:
                deduped.append(lvl)
                continue
            last_price = deduped[-1]["price"]
            if last_price > 0 and abs(lvl["price"] - last_price) / last_price < 0.01:
                # Keep the one with higher strength
                if lvl["strength"] > deduped[-1]["strength"]:
                    deduped[-1] = lvl
            else:
                deduped.append(lvl)

        return deduped[:8]

    except Exception as e:
        log.warning(f"calc_sr_levels error: {e}")
        return []

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
        if df is None or len(df) < 60:
            log.warning(f"analyze_ticker({ticker}): insufficient data ({len(df) if df is not None else 0} bars)")
            return None
        time.sleep(0.3)  # rate limit

        fund = fetch_fundamentals(ticker)
        time.sleep(0.2)

        # Core calculations — wrap each step so one failure doesn't kill the whole ticker
        dp, wp, mp, yp = (0, 0, 0, 0)
        try: dp, wp, mp, yp = calc_returns(df)
        except Exception as e: log.warning(f"{ticker} calc_returns: {e}")

        rs = 50
        try: rs = calc_rs_rating(df, spy_df)
        except Exception as e: log.warning(f"{ticker} calc_rs: {e}")

        wein = {"stage": "?", "ma150": None, "slopeWeeks": 0, "slopeRising": False, "pctFromMA": 0}
        try: wein = weinstein_stage(df)
        except Exception as e: log.warning(f"{ticker} weinstein: {e}")

        tpl_criteria, tpl_score = [False]*8, 0
        try: tpl_criteria, tpl_score = minervini_template(df, rs)
        except Exception as e: log.warning(f"{ticker} minervini: {e}")

        phase, light, ema_d, ema_w, ema_m = "Unknown", "gray", "neutral", "neutral", "neutral"
        ema10v, ema20v, ema50v, ema100v, ema200v = 0.0, 0.0, 0.0, 0.0, 0.0
        try:
            kell_result = kell_phase(df)
            phase, light, ema_d, ema_w, ema_m = kell_result[0], kell_result[1], kell_result[2], kell_result[3], kell_result[4]
            ema10v, ema20v, ema50v, ema100v, ema200v = kell_result[5], kell_result[6], kell_result[7], kell_result[8], kell_result[9]
        except Exception as e: log.warning(f"{ticker} kell: {e}")

        vcp = {"count": 0, "depths": "—", "pivot": None, "tightness": 0, "volDryup": False}
        try: vcp = detect_vcp(df)
        except Exception as e: log.warning(f"{ticker} vcp: {e}")

        # Technicals
        technicals = {}
        try: technicals = calc_technicals(df)
        except Exception as e: log.warning(f"{ticker} technicals: {e}")

        # S/R levels
        sr_levels = []
        try: sr_levels = calc_sr_levels(df)
        except Exception as e: log.warning(f"{ticker} sr_levels: {e}")

        # Base count (approximate)
        base = max(1, int(len([p for p in [wein["stage"]] if p in ("2A","2B")]) + vcp["count"] / 2))

        # Convergence
        conv_s, conv_z = convergence_score(wein, tpl_score, rs, phase, vcp, mkt, fund, df)

        # Short-side
        inv_criteria, inv_score = [False]*8, 0
        try: inv_criteria, inv_score = inverse_template(df, rs)
        except Exception as e: log.warning(f"{ticker} inv_template: {e}")
        short_s, short_z = short_convergence_score(wein, inv_score, rs, phase, mkt, fund)

        # Flags
        flags = []
        if rs < 70:               flags.append(f"RS {rs} < 70")
        if tpl_score < 8:         flags.append(f"{tpl_score}/8 template")
        if wein["stage"] == "2B": flags.append("Stage 2B (mature)")
        if fund.get("eps", 0) <= 0: flags.append("EPS negative")
        if vcp["count"] == 0:     flags.append("No VCP")

        price = float(df["Close"].iloc[-1])

        return {
            "tk":  ticker,
            "nm":  fund.get("name", ticker),
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
                "eps":      fund.get("eps", 0),
                "rev":      fund.get("rev", 0),
                "marginsExpanding": fund.get("marginsExpanding", False),
                "pivot":    vcp["pivot"],
            },
            "vcp": vcp,
            "kell": {
                "phase":  phase,
                "light":  light,
                "emaD":   ema_d,
                "emaW":   ema_w,
                "emaM":   ema_m,
                "base":   base,
                "ema10v": ema10v,
                "ema20v": ema20v,
                "ema50v": ema50v,
                "ema100v": ema100v,
                "ema200v": ema200v,
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
            "setup":   build_setup_text(ticker, wein, tpl_score, rs, phase, vcp, conv_z),
            "risk":    f"Stage {wein['stage']} · RS {rs} · {phase}",
            "optPlay": build_opt_play(ticker, price, vcp, phase, conv_z),
            "flags":   flags,
            "fundamentals": fund,
            "technicals":   technicals,
            "srLevels":     sr_levels,
            "sector":       fund.get("sector", ""),
        }
    except Exception as e:
        log.error(f"analyze_ticker({ticker}): {e}")
        return None

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
            df = fetch_ohlcv(t, "2y")
            if df is None or len(df) < 200: continue
            rs = calc_rs_rating(df, spy_df_tmp) if spy_df_tmp is not None else 50
            _, score = minervini_template(df, rs)
            if score >= 6: tpl_count += 1
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
            insiders = finnhub_get("/stock/insider-transactions", {"symbol": tk})
            insider_sells = 0
            if isinstance(insiders, dict) and "data" in insiders:
                insider_sells = len([x for x in insiders["data"] if x.get("transactionType") == "S"])

            # News from Finnhub
            from_date = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
            to_date   = datetime.utcnow().strftime("%Y-%m-%d")
            news = finnhub_get("/company-news", {"symbol": tk, "from": from_date, "to": to_date})
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
def generate_programmatic_brief(watchlist_data: list, breadth: dict, threats: list) -> str:
    """Generate a data-driven brief without AI — pure numbers from the screener."""
    vix     = breadth.get("vix", "—")
    stage   = breadth.get("spxStage", "?")
    ema_pos = breadth.get("spxEma", "?")
    tpl_cnt = breadth.get("tplCount", 0)

    conv    = [s for s in watchlist_data if s.get("conv",{}).get("zone") == "CONVERGENCE"]
    sec     = [s for s in watchlist_data if s.get("conv",{}).get("zone") == "SECONDARY"]
    bld     = [s for s in watchlist_data if s.get("conv",{}).get("zone") == "BUILDING"]
    shorts  = [s for s in watchlist_data if s.get("shortConv",{}).get("zone") in ("SHORT_CONVERGENCE","SHORT_SECONDARY")]

    mkt_color = "BULL" if ema_pos == "above" and stage == 2 else "BEAR" if ema_pos == "below" else "CAUTION"
    vix_flag  = "Elevated" if isinstance(vix, (int,float)) and vix > 25 else "Normal"

    lines = [
        f"# MKW Morning Brief — {datetime.utcnow().strftime('%B %d, %Y')}",
        f"\n## {mkt_color} Market Environment",
        f"- S&P 500: **Stage {stage}**, {ema_pos} 20 EMA",
        f"- VIX: **{vix}** — {vix_flag}",
        f"- Template qualifiers: ~**{tpl_cnt}** stocks passing 8-point template",
        "",
        "## Convergence Setups",
    ]
    if conv:
        for s in conv:
            lines.append(f"- **{s['tk']}** — Score {s['conv']['score']}/22 · RS {s['min']['rs']} · {s['kell']['phase']} · Stage {s['wein']['stage']}")
    else:
        lines.append("- No full convergence setups currently")

    lines += ["", "## Secondary Setups"]
    if sec:
        for s in sec:
            lines.append(f"- **{s['tk']}** — Score {s['conv']['score']}/22 · RS {s['min']['rs']} · {s['kell']['phase']}")
    else:
        lines.append("- No secondary setups currently")

    lines += ["", "## Building (Watch Closely)"]
    if bld:
        for s in bld[:5]:
            lines.append(f"- **{s['tk']}** — Score {s['conv']['score']}/22 · {s['setup']}")
    else:
        lines.append("- None building currently")

    if shorts:
        lines += ["", "## Short Setups"]
        for s in shorts[:3]:
            lines.append(f"- **{s['tk']}** — Short score {s['shortConv']['score']} · {s['shortConv']['zone']}")

    if threats:
        lines += ["", "## Divergence Alerts"]
        for t in threats[:3]:
            lines.append(f"- **{t['tk']}**: {t.get('type','—')} (score {t.get('sc','—')})")

    lines += [
        "",
        "## Action Items",
        f"- Review **{len(conv)} convergence** and **{len(sec)} secondary** setups on Plays tab",
        "- Check entry timing on Kell phase — prioritize EMA Crossback and Pop phases",
        "- Monitor VIX for position sizing guidance",
        "",
        "*Data-driven brief — [Upgrade: set ANTHROPIC_API_KEY for AI-generated analysis]*",
    ]
    return "\n".join(lines)

def generate_daily_brief(watchlist_data: list, breadth: dict, threats: list) -> str:
    if not CLAUDE_KEY:
        return generate_programmatic_brief(watchlist_data, breadth, threats)

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
using the MKW system (Minervini x Kell x Weinstein convergence methodology).
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
def _warmup():
    log.info("Warming up watchlist cache in background...")
    try:
        resp = _build_watchlist()
        if resp:
            cache_set("watchlist", resp)
            log.info(f"Watchlist cache warmed: {len(resp.get('stocks', []))} stocks")
    except Exception as e:
        log.warning(f"Warmup failed: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _positions
    _positions = load_positions()
    log.info(f"Loaded {len(_positions)} positions from file")
    log.info("Warming up SPY data...")
    get_spy()
    import threading
    threading.Thread(target=_warmup, daemon=True).start()
    yield

app = FastAPI(title="MKW Command Center API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__, "trace": traceback.format_exc()}
    )

# ─────────────────────────────────────────────
# WATCHLIST BUILD HELPER
# ─────────────────────────────────────────────
def _build_watchlist():
    """Fetch and analyze all watchlist tickers in parallel (max 5 workers)."""
    spy_df = get_spy()
    if spy_df is None:
        return None
    mkt = _mkt_snapshot
    def _fetch(tk):
        try:
            return analyze_ticker(tk, spy_df, mkt)
        except Exception as e:
            log.warning(f"analyze_ticker failed for {tk}: {e}")
            return None
    with ThreadPoolExecutor(max_workers=5) as ex:
        results = list(ex.map(_fetch, WATCHLIST))
    stocks = [r for r in results if r]
    return to_python({"stocks": stocks, "lastUpdated": datetime.utcnow().isoformat()})

# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

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

    result = to_python(result)
    cache_set(key, result)
    return result

@app.get("/api/screener")
def get_screener(
    rs_min: int = 0,
    rs_max: int = 99,
    stage: str = "",
    template_min: int = 0,
    sector: str = "",
    vcp: bool = False,
    zone: str = "",
    short_mode: bool = False,
):
    """
    Filter watchlist stocks by various criteria.
    - stage: "2" matches 2A and 2B, "4" matches 4A and 4B
    - vcp: if True, only stocks with VCP count >= 2
    - zone: CONVERGENCE, SECONDARY, BUILDING, WATCH
    - short_mode: if True, filter by short convergence zone instead
    """
    # Use watchlist cache (stale is fine for screener)
    cached = cache_get("watchlist", CACHE_WATCHLIST * 4)
    if cached:
        stocks = cached.get("stocks", [])
    else:
        resp = _build_watchlist()
        if resp is None:
            return {"stocks": [], "total": 0, "filters": {}}
        stocks = resp.get("stocks", [])

    filtered = []
    for s in stocks:
        try:
            # RS filter
            rs_val = s.get("min", {}).get("rs", 50)
            if not (rs_min <= rs_val <= rs_max):
                continue

            # Stage filter
            if stage:
                s_stage = s.get("wein", {}).get("stage", "")
                if stage == "2":
                    if s_stage not in ("2A", "2B"):
                        continue
                elif stage == "4":
                    if s_stage not in ("4A", "4B"):
                        continue
                elif not s_stage.startswith(stage):
                    continue

            # Template score filter
            tpl_score = s.get("min", {}).get("tplScore", 0)
            if tpl_score < template_min:
                continue

            # Sector filter
            if sector:
                s_sector = s.get("sector", "") or s.get("fundamentals", {}).get("sector", "")
                if sector.lower() not in s_sector.lower():
                    continue

            # VCP filter
            if vcp:
                vcp_count = s.get("vcp", {}).get("count", 0)
                if vcp_count < 2:
                    continue

            # Zone filter
            if zone:
                if short_mode:
                    s_zone = s.get("shortConv", {}).get("zone", "")
                else:
                    s_zone = s.get("conv", {}).get("zone", "")
                if s_zone != zone:
                    continue

            filtered.append(s)
        except Exception:
            continue

    # Sort by convergence score descending (or short score if short_mode)
    try:
        if short_mode:
            filtered.sort(key=lambda x: x.get("shortConv", {}).get("score", 0), reverse=True)
        else:
            filtered.sort(key=lambda x: x.get("conv", {}).get("score", 0), reverse=True)
    except Exception:
        pass

    return to_python({
        "stocks": filtered,
        "total":  len(filtered),
        "filters": {
            "rs_min": rs_min, "rs_max": rs_max, "stage": stage,
            "template_min": template_min, "sector": sector,
            "vcp": vcp, "zone": zone, "short_mode": short_mode,
        },
    })

@app.get("/api/breadth")
def get_breadth():
    cached = cache_get("breadth", CACHE_BREADTH)
    if cached: return cached

    data = to_python(compute_breadth())
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
    """Alias for /api/earnings-calendar."""
    return get_earnings_calendar()

@app.get("/api/daily-brief")
def get_daily_brief():
    cached = cache_get("brief", CACHE_BRIEF)
    if cached: return cached

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

@app.get("/api/brief")
def get_brief():
    """Alias for /api/daily-brief."""
    return get_daily_brief()

@app.get("/api/health")
def health():
    return {
        "status":    "ok",
        "finnhub":   bool(FINNHUB_KEY),
        "claude":    bool(CLAUDE_KEY),
        "positions": len(_positions),
    }

@app.get("/api/debug/{ticker}")
def debug_ticker(ticker: str):
    """Full scoring breakdown for a single ticker — every criterion pass/fail with raw values."""
    ticker = ticker.upper().strip()
    try:
        spy_df = get_spy()
        df = fetch_ohlcv(ticker, "2y")
        if df is None or len(df) < 60:
            return {"error": f"Insufficient data for {ticker}: {len(df) if df is not None else 0} bars"}

        fund = fetch_fundamentals(ticker)
        rs   = calc_rs_rating(df, spy_df) if spy_df is not None else 50
        wein = weinstein_stage(df)
        tpl_criteria, tpl_score = minervini_template(df, rs)
        kell_result = kell_phase(df)
        phase, light, ema_d, ema_w, ema_m = kell_result[0], kell_result[1], kell_result[2], kell_result[3], kell_result[4]
        ema10v, ema20v, ema50v, ema100v, ema200v = kell_result[5], kell_result[6], kell_result[7], kell_result[8], kell_result[9]
        vcp  = detect_vcp(df)
        mkt  = _mkt_snapshot

        conv_s, conv_z, conv_details = convergence_score(
            wein, tpl_score, rs, phase, vcp, mkt, fund, df, detailed=True)
        inv_criteria, inv_score = inverse_template(df, rs)
        short_s, short_z = short_convergence_score(wein, inv_score, rs, phase, mkt, fund)

        price = float(df["Close"].iloc[-1])
        sma50  = float(df["Close"].rolling(50).mean().iloc[-1]) if len(df) >= 50 else 0
        sma150 = float(df["Close"].rolling(150).mean().iloc[-1]) if len(df) >= 150 else 0
        sma200 = float(df["Close"].rolling(200).mean().iloc[-1]) if len(df) >= 200 else 0

        technicals = {}
        try: technicals = calc_technicals(df)
        except Exception: pass

        sr_levels = []
        try: sr_levels = calc_sr_levels(df)
        except Exception: pass

        return to_python({
            "ticker": ticker,
            "price":  round(price, 2),
            "mkt_snapshot": mkt,
            "weinstein": wein,
            "minervini": {
                "tpl_criteria": tpl_criteria,
                "tpl_score": tpl_score,
                "tpl_labels": [
                    f"Price>{round(sma50,2)} (50d SMA)",
                    f"Price>{round(sma150,2)} (150d SMA)",
                    f"Price>{round(sma200,2)} (200d SMA)",
                    f"SMA50>{round(sma150,2)} (50>150)",
                    f"SMA150>{round(sma200,2)} (150>200)",
                    "SMA200 > 20d ago",
                    "Price >= 75% of 52w high",
                    f"RS {rs} >= 70",
                ],
            },
            "kell": {
                "phase": phase, "light": light,
                "ema_d": ema_d, "ema_w": ema_w, "ema_m": ema_m,
                "ema10v": ema10v, "ema20v": ema20v, "ema50v": ema50v,
                "ema100v": ema100v, "ema200v": ema200v,
            },
            "vcp":  vcp,
            "fundamentals": fund,
            "rs":   rs,
            "convergence": {
                "score": conv_s, "zone": conv_z, "max": 22,
                "criteria": conv_details,
            },
            "short": {"score": short_s, "zone": short_z},
            "technicals": technicals,
            "srLevels": sr_levels,
        })
    except Exception as e:
        return {"error": str(e), "trace": traceback.format_exc()}

# ─────────────────────────────────────────────
# POSITIONS ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/positions")
def get_positions():
    """Return list of all positions."""
    positions_list = list(_positions.values())
    return {"positions": positions_list, "total": len(positions_list)}

@app.post("/api/positions")
async def create_position(request: Request):
    """Create a new position."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON body")

    ticker = str(body.get("ticker", "")).upper().strip()
    if not ticker:
        raise HTTPException(400, "ticker is required")

    direction = str(body.get("direction", "LONG")).upper()
    if direction not in ("LONG", "SHORT"):
        raise HTTPException(400, "direction must be LONG or SHORT")

    entry_price = body.get("entryPrice")
    if entry_price is None:
        raise HTTPException(400, "entryPrice is required")
    try:
        entry_price = float(entry_price)
    except (ValueError, TypeError):
        raise HTTPException(400, "entryPrice must be a number")

    stop_level = body.get("stopLevel")
    if stop_level is None:
        raise HTTPException(400, "stopLevel is required")
    try:
        stop_level = float(stop_level)
    except (ValueError, TypeError):
        raise HTTPException(400, "stopLevel must be a number")

    # Optional fields
    def opt_float(key):
        v = body.get(key)
        if v is None: return None
        try: return float(v)
        except: return None

    def opt_int(key, default=1):
        v = body.get(key, default)
        try: return int(v)
        except: return default

    position_id = str(uuid.uuid4())
    position = {
        "id":            position_id,
        "ticker":        ticker,
        "direction":     direction,
        "entryDate":     datetime.utcnow().isoformat(),
        "entryPrice":    entry_price,
        "optionStrike":  opt_float("optionStrike"),
        "optionExpiry":  body.get("optionExpiry"),
        "premiumPaid":   opt_float("premiumPaid"),
        "contracts":     opt_int("contracts", 1),
        "stopLevel":     stop_level,
        "currentStop":   opt_float("currentStop") or stop_level,
        "target1":       opt_float("target1"),
        "target2":       opt_float("target2"),
        "notes":         str(body.get("notes", "")),
        "status":        "ACTIVE",
        "closePrice":    None,
        "closeDate":     None,
    }

    _positions[position_id] = position
    save_positions(_positions)
    return position

@app.put("/api/positions/{position_id}")
async def update_position(position_id: str, request: Request):
    """Update allowed fields on a position."""
    if position_id not in _positions:
        raise HTTPException(404, f"Position {position_id} not found")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON body")

    pos = _positions[position_id]

    # Updatable fields
    updatable_float = ["stopLevel", "target1", "target2", "currentStop", "closePrice"]
    updatable_str   = ["notes", "status", "closeDate", "optionExpiry"]
    updatable_int   = ["contracts"]

    for field in updatable_float:
        if field in body:
            v = body[field]
            if v is None:
                pos[field] = None
            else:
                try:
                    pos[field] = float(v)
                except (ValueError, TypeError):
                    raise HTTPException(400, f"{field} must be a number or null")

    for field in updatable_str:
        if field in body:
            v = body[field]
            if field == "status" and v not in ("ACTIVE", "CLOSED"):
                raise HTTPException(400, "status must be ACTIVE or CLOSED")
            pos[field] = v

    for field in updatable_int:
        if field in body:
            try:
                pos[field] = int(body[field])
            except (ValueError, TypeError):
                raise HTTPException(400, f"{field} must be an integer")

    # If closing, set closeDate if not provided
    if pos.get("status") == "CLOSED" and not pos.get("closeDate"):
        pos["closeDate"] = datetime.utcnow().isoformat()

    _positions[position_id] = pos
    save_positions(_positions)
    return pos

@app.delete("/api/positions/{position_id}")
def delete_position(position_id: str):
    """Delete/close a position."""
    if position_id not in _positions:
        raise HTTPException(404, f"Position {position_id} not found")

    deleted = _positions.pop(position_id)
    save_positions(_positions)
    return {"deleted": True, "id": position_id, "ticker": deleted.get("ticker", "")}

# ─────────────────────────────────────────────
# SERVE STATIC FRONTEND (production)
# ─────────────────────────────────────────────
dist_path = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.isdir(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        index = os.path.join(dist_path, "index.html")
        return FileResponse(index)
