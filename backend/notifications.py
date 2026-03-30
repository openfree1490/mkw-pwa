"""
MKW Notification Pipeline — Phase 5
Supports Telegram, Discord webhooks, and email digest.
"""

import os
import json
import logging
from datetime import datetime
from typing import Optional

import requests

log = logging.getLogger("mkw.notifications")

# ─────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_TO = os.getenv("SMTP_TO", "")


def get_notification_status() -> dict:
    """Return which notification channels are configured."""
    return {
        "telegram": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID),
        "discord": bool(DISCORD_WEBHOOK_URL),
        "email": bool(SMTP_HOST and SMTP_USER and SMTP_PASS and SMTP_TO),
        "push": True,  # PWA push always available as fallback
    }


# ─────────────────────────────────────────────────────────
# TELEGRAM
# ─────────────────────────────────────────────────────────
def send_telegram(message: str, parse_mode: str = "HTML") -> bool:
    """Send message via Telegram Bot API."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        log.debug("Telegram not configured")
        return False

    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        resp = requests.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True,
        }, timeout=10)
        if resp.ok:
            log.info("Telegram notification sent")
            return True
        else:
            log.warning(f"Telegram error: {resp.status_code} {resp.text}")
            return False
    except Exception as e:
        log.warning(f"Telegram send failed: {e}")
        return False


# ─────────────────────────────────────────────────────────
# DISCORD
# ─────────────────────────────────────────────────────────
def send_discord(content: str = "", embeds: list = None) -> bool:
    """Send message via Discord webhook."""
    if not DISCORD_WEBHOOK_URL:
        log.debug("Discord not configured")
        return False

    try:
        payload = {}
        if content:
            payload["content"] = content
        if embeds:
            payload["embeds"] = embeds

        resp = requests.post(DISCORD_WEBHOOK_URL, json=payload, timeout=10)
        if resp.status_code in (200, 204):
            log.info("Discord notification sent")
            return True
        else:
            log.warning(f"Discord error: {resp.status_code} {resp.text}")
            return False
    except Exception as e:
        log.warning(f"Discord send failed: {e}")
        return False


# ─────────────────────────────────────────────────────────
# EMAIL
# ─────────────────────────────────────────────────────────
def send_email(subject: str, body_html: str) -> bool:
    """Send email via SMTP."""
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_TO]):
        log.debug("Email not configured")
        return False

    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_USER
        msg["To"] = SMTP_TO
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        log.info("Email notification sent")
        return True
    except Exception as e:
        log.warning(f"Email send failed: {e}")
        return False


# ─────────────────────────────────────────────────────────
# MESSAGE FORMATTERS
# ─────────────────────────────────────────────────────────

def format_setup_alert_telegram(graded: dict, playbook: dict = None) -> str:
    """Format a graded setup as a Telegram HTML message."""
    ticker = graded.get("ticker", "???")
    composite = graded.get("composite", {})
    score = composite.get("score", 0)
    grade = composite.get("grade", "?")
    setup = graded.get("setup", {})
    levels = graded.get("levels", {})
    flags = graded.get("flags", [])

    grade_emoji = {"A": "🟢", "B": "🟡", "C": "⚪", "F": "🔴"}.get(grade, "⚪")

    msg = f"{grade_emoji} <b>{ticker}</b> — {grade} Setup ({score}/10)\n"
    msg += f"Type: {setup.get('type', 'N/A')} | {setup.get('detail', '')}\n"
    msg += f"Price: ${levels.get('price', 0):.2f} | Stop: ${levels.get('stop', 0):.2f}\n"
    msg += f"Target: ${levels.get('target1', 0):.2f} → ${levels.get('target2', 0):.2f}\n"

    if flags:
        msg += f"\n⚠️ {' | '.join(flags[:3])}\n"

    if playbook and playbook.get("trades"):
        msg += "\n<b>Options Playbook:</b>\n"
        for trade in playbook["trades"][:2]:
            msg += f"• T{trade['tier']} {trade['tierName']}: {trade['structure']} @ ${trade['strike']:.0f}\n"

    return msg


def format_setup_alert_discord(graded: dict, playbook: dict = None) -> list:
    """Format a graded setup as Discord embed."""
    ticker = graded.get("ticker", "???")
    composite = graded.get("composite", {})
    score = composite.get("score", 0)
    grade = composite.get("grade", "?")
    setup = graded.get("setup", {})
    levels = graded.get("levels", {})

    color_map = {"A": 0x00C176, "B": 0xE5A318, "C": 0x8B97B8, "F": 0xE5334D}

    fields = [
        {"name": "Score", "value": f"{score}/10 ({grade})", "inline": True},
        {"name": "Type", "value": setup.get("type", "N/A"), "inline": True},
        {"name": "Price", "value": f"${levels.get('price', 0):.2f}", "inline": True},
        {"name": "Stop", "value": f"${levels.get('stop', 0):.2f}", "inline": True},
        {"name": "Target", "value": f"${levels.get('target1', 0):.2f}", "inline": True},
    ]

    if playbook and playbook.get("trades"):
        plays = []
        for t in playbook["trades"][:3]:
            plays.append(f"T{t['tier']} {t['tierName']}: {t['structure']}")
        fields.append({"name": "Playbook", "value": "\n".join(plays), "inline": False})

    return [{
        "title": f"{ticker} — {grade} Setup",
        "color": color_map.get(grade, 0x8B97B8),
        "fields": fields,
        "timestamp": datetime.utcnow().isoformat(),
    }]


def format_pattern_alert_telegram(alert: dict) -> str:
    """Format a pattern alert as Telegram message."""
    urgency_emoji = {"high": "🔴", "medium": "🟡", "low": "⚪"}.get(alert.get("urgency", "low"), "⚪")
    return (
        f"{urgency_emoji} <b>{alert.get('ticker', '???')}</b> — {alert.get('title', '')}\n"
        f"{alert.get('detail', '')}\n"
        f"Conditions met: {alert.get('conditionsMet', 0)}/6 | "
        f"Still needed: {', '.join(alert.get('conditionsNeeded', []))}"
    )


def format_morning_summary_telegram(watchlist_grades: list, alerts: list) -> str:
    """Format morning pre-market summary."""
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    msg = f"☀️ <b>MKW Morning Watchlist</b> — {now}\n\n"

    # Top graded setups
    tradeable = [g for g in watchlist_grades if g.get("composite", {}).get("tradeable")]
    if tradeable:
        msg += "<b>🎯 Actionable Setups:</b>\n"
        for g in tradeable[:5]:
            ticker = g.get("ticker", "")
            score = g.get("composite", {}).get("score", 0)
            grade = g.get("composite", {}).get("grade", "?")
            setup_type = g.get("setup", {}).get("type", "")
            msg += f"• <b>{ticker}</b> {grade} ({score}/10) — {setup_type}\n"
    else:
        msg += "No actionable setups today.\n"

    # Pattern alerts
    hot_alerts = [a for a in alerts if a.get("conditionsMet", 0) >= 4]
    if hot_alerts:
        msg += f"\n<b>🔔 Forming Setups ({len(hot_alerts)}):</b>\n"
        for a in hot_alerts[:5]:
            msg += f"• <b>{a.get('ticker', '')}</b> — {a.get('title', '')} ({a.get('conditionsMet', 0)}/6)\n"

    return msg


# ─────────────────────────────────────────────────────────
# DISPATCHER
# ─────────────────────────────────────────────────────────

def notify_setup(graded: dict, playbook: dict = None) -> dict:
    """Send setup alert to all configured channels."""
    results = {}

    # Telegram
    if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        msg = format_setup_alert_telegram(graded, playbook)
        results["telegram"] = send_telegram(msg)

    # Discord
    if DISCORD_WEBHOOK_URL:
        embeds = format_setup_alert_discord(graded, playbook)
        results["discord"] = send_discord(embeds=embeds)

    return results


def notify_pattern_alert(alert: dict) -> dict:
    """Send pattern alert to all configured channels."""
    results = {}

    if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        msg = format_pattern_alert_telegram(alert)
        results["telegram"] = send_telegram(msg)

    if DISCORD_WEBHOOK_URL:
        results["discord"] = send_discord(content=(
            f"**{alert.get('ticker', '')}** — {alert.get('title', '')}\n"
            f"{alert.get('detail', '')}\n"
            f"Conditions: {alert.get('conditionsMet', 0)}/6"
        ))

    return results


def notify_morning_summary(watchlist_grades: list, alerts: list) -> dict:
    """Send morning pre-market summary."""
    results = {}

    if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        msg = format_morning_summary_telegram(watchlist_grades, alerts)
        results["telegram"] = send_telegram(msg)

    if DISCORD_WEBHOOK_URL:
        tradeable = [g for g in watchlist_grades if g.get("composite", {}).get("tradeable")]
        content = f"**☀️ MKW Morning Watchlist** — {datetime.utcnow().strftime('%Y-%m-%d')}\n"
        if tradeable:
            for g in tradeable[:5]:
                ticker = g.get("ticker", "")
                score = g.get("composite", {}).get("score", 0)
                grade = g.get("composite", {}).get("grade", "?")
                content += f"• **{ticker}** {grade} ({score}/10)\n"
        else:
            content += "No actionable setups today."
        results["discord"] = send_discord(content=content)

    if all([SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_TO]):
        # Build HTML email
        tradeable = [g for g in watchlist_grades if g.get("composite", {}).get("tradeable")]
        html = "<h2>MKW Morning Watchlist</h2>"
        if tradeable:
            html += "<table border='1' cellpadding='8' cellspacing='0'>"
            html += "<tr><th>Ticker</th><th>Grade</th><th>Score</th><th>Type</th></tr>"
            for g in tradeable[:10]:
                html += (
                    f"<tr><td><b>{g.get('ticker', '')}</b></td>"
                    f"<td>{g.get('composite', {}).get('grade', '?')}</td>"
                    f"<td>{g.get('composite', {}).get('score', 0)}/10</td>"
                    f"<td>{g.get('setup', {}).get('type', '')}</td></tr>"
                )
            html += "</table>"
        else:
            html += "<p>No actionable setups today.</p>"

        results["email"] = send_email(
            f"MKW Watchlist — {datetime.utcnow().strftime('%Y-%m-%d')}",
            html
        )

    return results
