"""
MKW Trade Journal — Logging, Analytics, and Learning Insights
File-based persistence with comprehensive performance analytics.
"""

import json
import os
import logging
import uuid
from datetime import datetime
from typing import Optional
from collections import defaultdict

log = logging.getLogger("mkw.journal")

JOURNAL_FILE = "/tmp/mkw_journal.json"


# ─────────────────────────────────────────────────────────
# PERSISTENCE
# ─────────────────────────────────────────────────────────

def _load_journal() -> list:
    try:
        if os.path.exists(JOURNAL_FILE):
            with open(JOURNAL_FILE) as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
    except Exception as e:
        log.warning(f"Journal load error: {e}")
    return []

def _save_journal(trades: list):
    try:
        with open(JOURNAL_FILE, "w") as f:
            json.dump(trades, f, indent=2, default=str)
    except Exception as e:
        log.warning(f"Journal save error: {e}")


# ─────────────────────────────────────────────────────────
# CRUD OPERATIONS
# ─────────────────────────────────────────────────────────

def add_trade(trade: dict) -> dict:
    """
    Add a new trade to the journal.
    Required: ticker, direction, strategyType, entryDate, entryPrice
    Optional: optionStrike, optionExpiry, premiumPaid, contracts, stopLevel,
              convergenceZone, grade, kellPhase, marketRegime, notes
    """
    trades = _load_journal()

    entry = {
        "id": str(uuid.uuid4()),
        "ticker": trade.get("ticker", "").upper(),
        "direction": trade.get("direction", "LONG").upper(),
        "strategyType": trade.get("strategyType", "swing_call"),
        "entryDate": trade.get("entryDate", datetime.utcnow().isoformat()),
        "entryPrice": float(trade.get("entryPrice", 0)),
        "optionStrike": trade.get("optionStrike"),
        "optionExpiry": trade.get("optionExpiry"),
        "premiumPaid": trade.get("premiumPaid"),
        "contracts": int(trade.get("contracts", 1)),
        "stopLevel": trade.get("stopLevel"),
        "target1": trade.get("target1"),
        "target2": trade.get("target2"),
        # Context at entry
        "convergenceZone": trade.get("convergenceZone", ""),
        "convergenceScore": trade.get("convergenceScore"),
        "grade": trade.get("grade", ""),
        "gradeScore": trade.get("gradeScore"),
        "kellPhase": trade.get("kellPhase", ""),
        "weinStage": trade.get("weinStage", ""),
        "rs": trade.get("rs"),
        "ivRankAtEntry": trade.get("ivRankAtEntry"),
        "marketRegime": trade.get("marketRegime", ""),
        "tplScore": trade.get("tplScore"),
        "volumeRatio": trade.get("volumeRatio"),
        # Exit
        "exitDate": trade.get("exitDate"),
        "exitPrice": trade.get("exitPrice"),
        "exitReason": trade.get("exitReason", ""),
        # P&L
        "pnlDollars": trade.get("pnlDollars"),
        "pnlPercent": trade.get("pnlPercent"),
        "holdingDays": trade.get("holdingDays"),
        # Status
        "status": trade.get("status", "OPEN"),
        "notes": trade.get("notes", ""),
        "tags": trade.get("tags", []),
        "createdAt": datetime.utcnow().isoformat(),
    }

    trades.append(entry)
    _save_journal(trades)
    return entry

def update_trade(trade_id: str, updates: dict) -> Optional[dict]:
    """Update fields on an existing trade."""
    trades = _load_journal()
    for i, t in enumerate(trades):
        if t.get("id") == trade_id:
            for k, v in updates.items():
                if k != "id" and k != "createdAt":
                    trades[i][k] = v
            trades[i]["updatedAt"] = datetime.utcnow().isoformat()

            # Auto-calculate P&L if closing
            if updates.get("status") == "CLOSED" and updates.get("exitPrice"):
                entry_price = trades[i].get("premiumPaid") or trades[i].get("entryPrice", 0)
                exit_price = float(updates["exitPrice"])
                if entry_price and entry_price > 0:
                    direction = trades[i].get("direction", "LONG")
                    if direction == "LONG":
                        pnl_pct = (exit_price / entry_price - 1) * 100
                    else:
                        pnl_pct = (1 - exit_price / entry_price) * 100
                    contracts = trades[i].get("contracts", 1)
                    pnl_dollars = (exit_price - entry_price) * 100 * contracts
                    if direction == "SHORT":
                        pnl_dollars = -pnl_dollars
                    trades[i]["pnlPercent"] = round(pnl_pct, 1)
                    trades[i]["pnlDollars"] = round(pnl_dollars, 2)

                # Holding days
                try:
                    entry_dt = datetime.fromisoformat(trades[i].get("entryDate", ""))
                    exit_dt = datetime.fromisoformat(updates.get("exitDate", datetime.utcnow().isoformat()))
                    trades[i]["holdingDays"] = (exit_dt - entry_dt).days
                except Exception:
                    pass

            _save_journal(trades)
            return trades[i]
    return None

def delete_trade(trade_id: str) -> bool:
    """Delete a trade from the journal."""
    trades = _load_journal()
    original_len = len(trades)
    trades = [t for t in trades if t.get("id") != trade_id]
    if len(trades) < original_len:
        _save_journal(trades)
        return True
    return False

def get_trades(status: str = "", ticker: str = "", limit: int = 100) -> list:
    """Get trades with optional filters."""
    trades = _load_journal()

    if status:
        trades = [t for t in trades if t.get("status", "").upper() == status.upper()]
    if ticker:
        trades = [t for t in trades if t.get("ticker", "").upper() == ticker.upper()]

    # Sort by entry date descending
    trades.sort(key=lambda x: x.get("entryDate", ""), reverse=True)
    return trades[:limit]

def get_trade(trade_id: str) -> Optional[dict]:
    """Get a single trade by ID."""
    trades = _load_journal()
    for t in trades:
        if t.get("id") == trade_id:
            return t
    return None


# ─────────────────────────────────────────────────────────
# PERFORMANCE ANALYTICS
# ─────────────────────────────────────────────────────────

def compute_analytics() -> dict:
    """
    Comprehensive performance analytics across all closed trades.
    """
    trades = _load_journal()
    closed = [t for t in trades if t.get("status") == "CLOSED" and t.get("pnlPercent") is not None]
    open_trades = [t for t in trades if t.get("status") == "OPEN"]

    if not closed:
        return {
            "totalTrades": len(trades),
            "openTrades": len(open_trades),
            "closedTrades": 0,
            "noDataMessage": "No closed trades yet. Start logging trades to see analytics.",
        }

    # Core metrics
    wins = [t for t in closed if t["pnlPercent"] > 0]
    losses = [t for t in closed if t["pnlPercent"] <= 0]
    win_pcts = [t["pnlPercent"] for t in wins]
    loss_pcts = [t["pnlPercent"] for t in losses]

    win_rate = round(len(wins) / len(closed) * 100, 1) if closed else 0
    avg_win = round(sum(win_pcts) / len(win_pcts), 1) if win_pcts else 0
    avg_loss = round(sum(loss_pcts) / len(loss_pcts), 1) if loss_pcts else 0
    total_pnl = sum(t.get("pnlDollars", 0) or 0 for t in closed)
    total_pnl_pct = sum(t["pnlPercent"] for t in closed)

    gross_profit = sum(t.get("pnlDollars", 0) or 0 for t in wins)
    gross_loss = abs(sum(t.get("pnlDollars", 0) or 0 for t in losses))
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else float('inf')

    avg_hold = round(sum(t.get("holdingDays", 0) or 0 for t in closed) / len(closed), 1) if closed else 0

    # Largest winners and losers
    sorted_by_pnl = sorted(closed, key=lambda x: x["pnlPercent"], reverse=True)
    largest_winners = sorted_by_pnl[:3]
    largest_losers = sorted_by_pnl[-3:]

    # Win rate by grade
    by_grade = _win_rate_by_field(closed, "grade")

    # Win rate by convergence zone
    by_zone = _win_rate_by_field(closed, "convergenceZone")

    # Win rate by Kell phase at entry
    by_phase = _win_rate_by_field(closed, "kellPhase")

    # Win rate by IV rank bucket at entry
    by_iv = _win_rate_by_iv(closed)

    # Win rate by market regime
    by_regime = _win_rate_by_field(closed, "marketRegime")

    # Win rate by strategy type
    by_strategy = _win_rate_by_field(closed, "strategyType")

    # Monthly P&L
    monthly = _monthly_pnl(closed)

    # Rolling 20-trade win rate
    rolling = _rolling_win_rate(closed, window=20)

    # Streaks
    max_win_streak, max_loss_streak, current_streak = _calc_streaks(closed)

    return {
        "totalTrades": len(trades),
        "openTrades": len(open_trades),
        "closedTrades": len(closed),
        "overview": {
            "winRate": win_rate,
            "avgWin": avg_win,
            "avgLoss": avg_loss,
            "profitFactor": profit_factor,
            "totalPnlDollars": round(total_pnl, 2),
            "totalPnlPct": round(total_pnl_pct, 1),
            "avgHoldingDays": avg_hold,
            "maxWinStreak": max_win_streak,
            "maxLossStreak": max_loss_streak,
            "currentStreak": current_streak,
        },
        "largestWinners": [_trade_summary(t) for t in largest_winners],
        "largestLosers": [_trade_summary(t) for t in largest_losers],
        "byGrade": by_grade,
        "byZone": by_zone,
        "byPhase": by_phase,
        "byIVRank": by_iv,
        "byRegime": by_regime,
        "byStrategy": by_strategy,
        "monthly": monthly,
        "rollingWinRate": rolling,
        "insights": _generate_insights(closed, by_grade, by_zone, by_phase, by_iv, win_rate),
    }


def _trade_summary(t: dict) -> dict:
    return {
        "id": t.get("id"),
        "ticker": t.get("ticker"),
        "direction": t.get("direction"),
        "strategyType": t.get("strategyType"),
        "entryDate": t.get("entryDate"),
        "exitDate": t.get("exitDate"),
        "pnlPercent": t.get("pnlPercent"),
        "pnlDollars": t.get("pnlDollars"),
        "grade": t.get("grade"),
        "convergenceZone": t.get("convergenceZone"),
        "kellPhase": t.get("kellPhase"),
        "holdingDays": t.get("holdingDays"),
    }


def _win_rate_by_field(closed: list, field: str) -> list:
    groups = defaultdict(list)
    for t in closed:
        key = t.get(field, "Unknown") or "Unknown"
        groups[key].append(t)

    results = []
    for key, trades in sorted(groups.items()):
        wins = [t for t in trades if t["pnlPercent"] > 0]
        wr = round(len(wins) / len(trades) * 100, 1) if trades else 0
        avg_pnl = round(sum(t["pnlPercent"] for t in trades) / len(trades), 1)
        results.append({
            "label": key,
            "trades": len(trades),
            "winRate": wr,
            "avgPnl": avg_pnl,
            "totalPnl": round(sum(t.get("pnlDollars", 0) or 0 for t in trades), 2),
        })
    return results


def _win_rate_by_iv(closed: list) -> list:
    buckets = {"0-20": [], "20-40": [], "40-60": [], "60-80": [], "80-100": []}
    for t in closed:
        iv = t.get("ivRankAtEntry")
        if iv is None:
            continue
        iv = float(iv)
        if iv < 20: buckets["0-20"].append(t)
        elif iv < 40: buckets["20-40"].append(t)
        elif iv < 60: buckets["40-60"].append(t)
        elif iv < 80: buckets["60-80"].append(t)
        else: buckets["80-100"].append(t)

    results = []
    for label, trades in buckets.items():
        if not trades:
            results.append({"label": f"IV Rank {label}", "trades": 0, "winRate": 0, "avgPnl": 0})
            continue
        wins = [t for t in trades if t["pnlPercent"] > 0]
        wr = round(len(wins) / len(trades) * 100, 1)
        avg_pnl = round(sum(t["pnlPercent"] for t in trades) / len(trades), 1)
        results.append({
            "label": f"IV Rank {label}",
            "trades": len(trades),
            "winRate": wr,
            "avgPnl": avg_pnl,
        })
    return results


def _monthly_pnl(closed: list) -> list:
    months = defaultdict(lambda: {"pnl": 0, "trades": 0, "wins": 0})
    for t in closed:
        try:
            dt = datetime.fromisoformat(t.get("exitDate", t.get("entryDate", "")))
            key = dt.strftime("%Y-%m")
            months[key]["pnl"] += t.get("pnlDollars", 0) or 0
            months[key]["trades"] += 1
            if t["pnlPercent"] > 0:
                months[key]["wins"] += 1
        except Exception:
            pass

    results = []
    for month in sorted(months.keys()):
        data = months[month]
        wr = round(data["wins"] / data["trades"] * 100, 1) if data["trades"] > 0 else 0
        results.append({
            "month": month,
            "pnl": round(data["pnl"], 2),
            "trades": data["trades"],
            "winRate": wr,
        })
    return results


def _rolling_win_rate(closed: list, window: int = 20) -> list:
    sorted_trades = sorted(closed, key=lambda x: x.get("exitDate", x.get("entryDate", "")))
    results = []
    for i in range(window, len(sorted_trades) + 1):
        batch = sorted_trades[i-window:i]
        wins = sum(1 for t in batch if t["pnlPercent"] > 0)
        wr = round(wins / window * 100, 1)
        results.append({
            "tradeNum": i,
            "winRate": wr,
            "lastTicker": batch[-1].get("ticker", ""),
        })
    return results


def _calc_streaks(closed: list) -> tuple:
    sorted_trades = sorted(closed, key=lambda x: x.get("exitDate", x.get("entryDate", "")))
    max_win = 0
    max_loss = 0
    current = 0
    current_type = None

    for t in sorted_trades:
        if t["pnlPercent"] > 0:
            if current_type == "win":
                current += 1
            else:
                current = 1
                current_type = "win"
            max_win = max(max_win, current)
        else:
            if current_type == "loss":
                current += 1
            else:
                current = 1
                current_type = "loss"
            max_loss = max(max_loss, current)

    streak_label = f"{current} {'win' if current_type == 'win' else 'loss'}{'s' if current > 1 else ''}"
    return max_win, max_loss, streak_label


def _generate_insights(closed: list, by_grade: list, by_zone: list,
                       by_phase: list, by_iv: list, overall_wr: float) -> list:
    """Auto-generate learning insights from trade data."""
    insights = []

    # Grade performance
    for g in by_grade:
        if g["trades"] >= 3:
            if g["label"] in ("AAA", "AA") and g["winRate"] > overall_wr:
                insights.append(
                    f"Your {g['label']} setups have a {g['winRate']:.0f}% win rate with avg {g['avgPnl']:+.1f}% gain "
                    f"across {g['trades']} trades. The grading system IS working — prioritize these setups."
                )
            elif g["label"] in ("BBB", "BB", "B") and g["winRate"] < 50:
                insights.append(
                    f"Your {g['label']} setups have only {g['winRate']:.0f}% win rate with avg {g['avgPnl']:+.1f}% return. "
                    f"The data confirms: avoid trading below A-grade setups."
                )

    # Phase performance
    for p in by_phase:
        if p["trades"] >= 3:
            if p["label"] in ("EMA Crossback", "Pop") and p["winRate"] >= 70:
                insights.append(
                    f"Entries during '{p['label']}' phase: {p['winRate']:.0f}% win rate. "
                    f"This confirms the phase as a high-probability entry window."
                )
            elif p["label"] == "Extension" and p["winRate"] < 50:
                insights.append(
                    f"Entries during 'Extension' phase: only {p['winRate']:.0f}% win rate. "
                    f"You're chasing. Wait for pullbacks to the 10/20 EMA."
                )

    # IV rank performance
    for iv in by_iv:
        if iv["trades"] >= 3:
            if "0-20" in iv["label"] or "20-40" in iv["label"]:
                if iv["winRate"] > overall_wr:
                    insights.append(
                        f"Low IV entries ({iv['label']}): {iv['winRate']:.0f}% win rate. "
                        f"Cheap options + strong setups = edge. Keep prioritizing low IV."
                    )
            elif "60-80" in iv["label"] or "80-100" in iv["label"]:
                if iv["winRate"] < overall_wr:
                    insights.append(
                        f"High IV entries ({iv['label']}): only {iv['winRate']:.0f}% win rate. "
                        f"Premium drag is real. Use spreads or skip when IV Rank > 60."
                    )

    # Zone performance
    for z in by_zone:
        if z["trades"] >= 3:
            if z["label"] == "CONVERGENCE" and z["winRate"] >= 65:
                insights.append(
                    f"Full CONVERGENCE setups: {z['winRate']:.0f}% win rate across {z['trades']} trades. "
                    f"This IS your edge. Trade these with conviction."
                )
            elif z["label"] in ("BUILDING", "WATCH") and z["winRate"] < 50:
                insights.append(
                    f"'{z['label']}' zone entries: {z['winRate']:.0f}% win rate. "
                    f"These are low-probability. Wait for full convergence."
                )

    # Volume rule
    vol_trades = [t for t in closed if t.get("volumeRatio") is not None]
    if len(vol_trades) >= 5:
        low_vol = [t for t in vol_trades if (t.get("volumeRatio", 1) or 1) < 1.2]
        high_vol = [t for t in vol_trades if (t.get("volumeRatio", 1) or 1) >= 1.5]
        if low_vol and high_vol:
            low_wr = sum(1 for t in low_vol if t["pnlPercent"] > 0) / len(low_vol) * 100
            high_wr = sum(1 for t in high_vol if t["pnlPercent"] > 0) / len(high_vol) * 100
            if high_wr > low_wr + 10:
                insights.append(
                    f"Volume matters: entries with volume >1.5x average have {high_wr:.0f}% win rate "
                    f"vs {low_wr:.0f}% for low-volume entries. Enforce the volume rule."
                )

    if not insights:
        insights.append("Keep logging trades. Meaningful insights require at least 10-20 closed trades across different categories.")

    return insights
