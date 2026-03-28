"""
MKW Market Wizard — AI chat agent with market context injection.
Handles query classification, ticker extraction, context formatting,
and system prompt construction.
"""

import re
import logging
from typing import Optional

log = logging.getLogger("mkw.wizard")

# ─────────────────────────────────────────────
# QUERY CLASSIFICATION
# ─────────────────────────────────────────────
MARKET_KEYWORDS = {
    "market", "spy", "qqq", "iwm", "breadth", "sector", "vix",
    "volatility", "trend", "bull", "bear", "correction", "rally", "selloff",
    "today", "premarket", "after hours", "futures", "s&p", "nasdaq", "dow",
    "rotation", "risk", "sentiment", "fed", "fomc", "cpi", "jobs",
    "macro", "rates", "yields", "bonds", "inflation",
}

COMPLEX_KEYWORDS = {
    "analyze", "analysis", "compare", "strategy", "should i",
    "what stage", "convergence", "setup", "entry", "options", "risk reward",
    "weinstein", "minervini", "kell", "backtest", "portfolio", "allocat",
    "explain why", "break down", "deep dive", "trade idea", "swing",
    "best play", "top pick", "recommendation", "thesis",
}

FRAMEWORK_KEYWORDS = {
    "explain", "what is", "how does", "teach", "define", "stage analysis",
    "vcp", "trend template", "ema", "convergence", "kell", "weinstein",
    "minervini", "relative strength", "rs rating", "breakout",
}

# Known tickers for extraction (subset — extend as needed)
KNOWN_TICKERS = {
    "AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "AVGO",
    "JPM", "V", "UNH", "MA", "HD", "PG", "JNJ", "ABBV", "MRK", "LLY",
    "COST", "NFLX", "AMD", "CRM", "ADBE", "ORCL", "CSCO", "ACN", "TXN",
    "INTC", "QCOM", "AMAT", "LRCX", "KLAC", "SNPS", "CDNS", "MRVL",
    "NOW", "UBER", "SQ", "SHOP", "COIN", "PLTR", "RBLX", "SNOW",
    "XOM", "CVX", "COP", "SLB", "OXY", "EOG", "MPC", "VLO", "PSX",
    "BA", "CAT", "GE", "HON", "UPS", "FDX", "RTX", "LMT", "DE",
    "DIS", "CMCSA", "T", "VZ", "TMUS", "CHTR", "PARA", "WBD",
    "GS", "MS", "C", "BAC", "WFC", "BLK", "SCHW", "AXP",
    "PFE", "BMY", "GILD", "AMGN", "REGN", "VRTX", "ISRG", "TMO",
    "SPY", "QQQ", "IWM", "DIA", "XLK", "XLF", "XLE", "XLV", "XLI",
    "SMCI", "ARM", "PANW", "CRWD", "DDOG", "NET", "ZS", "FTNT",
    "CVNA", "HIMS", "BYND", "SNAP", "RIVN", "LCID",
}


def classify_query(message: str) -> dict:
    """Classify a user query to determine routing."""
    lower = message.lower()
    words = set(lower.split())

    needs_market = bool(words & MARKET_KEYWORDS) or any(kw in lower for kw in ["how's the market", "market today", "what's happening"])
    needs_reasoning = bool(words & COMPLEX_KEYWORDS) or any(kw in lower for kw in COMPLEX_KEYWORDS)
    is_framework = bool(words & FRAMEWORK_KEYWORDS) or any(kw in lower for kw in FRAMEWORK_KEYWORDS)
    tickers = extract_tickers(message)
    needs_ticker_data = len(tickers) > 0

    # Determine max tokens
    if is_framework and not needs_ticker_data:
        max_tokens = 1500
    elif needs_reasoning or needs_ticker_data:
        max_tokens = 2000
    elif needs_market:
        max_tokens = 1200
    else:
        max_tokens = 800  # General chat

    return {
        "needs_market_data": needs_market or needs_ticker_data,
        "needs_ticker_data": needs_ticker_data,
        "tickers": tickers[:5],  # Max 5
        "needs_reasoning": needs_reasoning,
        "is_framework_question": is_framework,
        "max_tokens": max_tokens,
    }


def extract_tickers(message: str) -> list:
    """Extract stock tickers from a message."""
    tickers = set()

    # Match $TICK format
    dollar_matches = re.findall(r'\$([A-Z]{1,5})\b', message)
    tickers.update(dollar_matches)

    # Match known tickers (uppercase words)
    upper_words = re.findall(r'\b([A-Z]{2,5})\b', message)
    for w in upper_words:
        if w in KNOWN_TICKERS:
            tickers.add(w)

    # Remove common false positives
    tickers -= {"I", "A", "IT", "AT", "IS", "AN", "OR", "IF", "ON", "IN", "TO", "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HAS", "HER", "WAS", "ONE", "OUR", "OUT", "DAY", "GET", "HAS", "HIM", "HIS", "HOW", "MAN", "NEW", "NOW", "OLD", "SEE", "WAY", "WHO", "DID", "ITS", "LET", "SAY", "SHE", "TOO", "USE"}

    return list(tickers)


# ─────────────────────────────────────────────
# CONTEXT FORMATTING (token-efficient)
# ─────────────────────────────────────────────
def format_market_context(breadth: dict) -> str:
    """Format breadth/market data compactly."""
    if not breadth:
        return ""

    lines = ["MARKET SNAPSHOT:"]

    # SPX/QQQ/IWM
    for key in ["spx", "spy", "qqq", "iwm"]:
        d = breadth.get(key, {})
        if d:
            stage = d.get("stage", d.get("stageLabel", "?"))
            price = d.get("price", d.get("px", "?"))
            chg = d.get("change", d.get("chg", d.get("dp", "?")))
            lines.append(f"  {key.upper()}: ${price} ({chg:+.1f}%) Stage {stage}" if isinstance(chg, (int, float)) else f"  {key.upper()}: ${price} Stage {stage}")

    vix = breadth.get("vix", "?")
    lines.append(f"  VIX: {vix}")

    # Sectors
    sectors = breadth.get("sectors", breadth.get("sectorPerf", []))
    if sectors:
        sec_strs = []
        for s in sectors[:6]:
            name = s.get("n", s.get("name", "?"))
            perf = s.get("p", s.get("change", 0))
            sec_strs.append(f"{name}:{perf:+.1f}%" if isinstance(perf, (int, float)) else f"{name}:{perf}")
        lines.append(f"  Sectors: {', '.join(sec_strs)}")

    # Kell light
    light = breadth.get("kell", breadth.get("kellLight", ""))
    if light:
        lines.append(f"  Kell Light: {light}")

    return "\n".join(lines)


def format_ticker_context(ticker: str, data: dict) -> str:
    """Format a single ticker's analysis compactly."""
    if not data:
        return f"\nTICKER {ticker}: No data available"

    lines = [f"\nTICKER {ticker}:"]

    price = data.get("price", data.get("px", "?"))
    chg = data.get("day_change", data.get("dp", 0))
    lines.append(f"  Price: ${price} ({chg:+.1f}%)" if isinstance(chg, (int, float)) else f"  Price: ${price}")

    stage = data.get("stage", data.get("weinstein_stage", "?"))
    score = data.get("convergence_score", data.get("score", "?"))
    zone = data.get("zone", "?")
    grade = data.get("grade", "?")
    lines.append(f"  Stage: {stage} | Score: {score}/23 | Zone: {zone} | Grade: {grade}")

    rs = data.get("rs", data.get("relative_strength", "?"))
    tpl = data.get("template_score", data.get("minervini_score", "?"))
    phase = data.get("kell_phase", data.get("phase", "?"))
    lines.append(f"  RS: {rs} | Template: {tpl}/8 | Kell Phase: {phase}")

    # Key technicals
    techs = data.get("technicals", {})
    if techs:
        rsi = techs.get("rsi", "?")
        adx = techs.get("adx", "?")
        lines.append(f"  RSI: {rsi} | ADX: {adx}")
        h52 = techs.get("high52", data.get("high_52w", "?"))
        l52 = techs.get("low52", data.get("low_52w", "?"))
        lines.append(f"  52W High: ${h52} | 52W Low: ${l52}")

    # VCP
    vcp = data.get("vcp", {})
    if isinstance(vcp, dict) and vcp.get("count", 0) >= 2:
        lines.append(f"  VCP: {vcp['count']} contractions, pivot ${vcp.get('pivot', '?')}")

    # Fundamentals
    fund = data.get("fundamentals", {})
    if fund:
        eps = fund.get("eps", fund.get("eps_growth"))
        rev = fund.get("rev", fund.get("rev_growth"))
        mcap = fund.get("marketCap", data.get("market_cap", 0))
        sector = fund.get("sector", data.get("sector", "?"))
        cap_str = f"${mcap / 1e9:.1f}B" if mcap and mcap > 1e9 else f"${mcap / 1e6:.0f}M" if mcap and mcap > 1e6 else "?"
        lines.append(f"  EPS Growth: {eps}% | Rev Growth: {rev}% | Cap: {cap_str} | Sector: {sector}")

    # FINRA SVR
    finra = data.get("finra", {})
    if isinstance(finra, dict) and finra.get("svr_today") is not None:
        lines.append(f"  SVR: {finra['svr_today']}% ({finra.get('signal', '?')})")

    # S/R levels
    sr = data.get("srLevels", [])
    if sr:
        supports = [f"${l['price']:.2f}" for l in sr if l.get("type") == "support"][:3]
        resists = [f"${l['price']:.2f}" for l in sr if l.get("type") == "resistance"][:3]
        if supports:
            lines.append(f"  Support: {', '.join(supports)}")
        if resists:
            lines.append(f"  Resistance: {', '.join(resists)}")

    return "\n".join(lines)


def format_watchlist_summary(stocks: list) -> str:
    """Format top watchlist stocks compactly."""
    if not stocks:
        return ""

    lines = ["\nTOP WATCHLIST SETUPS:"]
    sorted_stocks = sorted(stocks, key=lambda s: s.get("convergence_score", s.get("score", 0)), reverse=True)

    for s in sorted_stocks[:8]:
        ticker = s.get("ticker", s.get("tk", "?"))
        zone = s.get("zone", "?")
        score = s.get("convergence_score", s.get("score", "?"))
        grade = s.get("grade", "?")
        price = s.get("price", s.get("px", "?"))
        chg = s.get("day_change", s.get("dp", 0))
        chg_str = f"{chg:+.1f}%" if isinstance(chg, (int, float)) else ""
        lines.append(f"  {ticker}: ${price} {chg_str} | {zone} | Score {score}/23 | Grade {grade}")

    return "\n".join(lines)


# ─────────────────────────────────────────────
# SYSTEM PROMPT
# ─────────────────────────────────────────────
SYSTEM_PROMPT_TEMPLATE = """You are the MKW Market Wizard — an elite trading strategist and market analyst embedded in the MKW Command Center. You combine the methodologies of three legendary traders into one unified framework.

IDENTITY & PERSONALITY:
- Speak with authority but accessibility — like a veteran floor trader mentoring a sharp student
- Be direct, actionable, and concise — no filler, no disclaimers, no hedge-everything corporate tone
- Use trading terminology naturally: "the tape," "constructive action," "shaking out weak hands," etc.
- Give opinions and convictions when asked — "I like this setup" not "one might consider"
- When you don't know something or data is missing, say so directly
- Use clean structure with minimal emojis for visual scanning
- Keep responses focused — answer what was asked, don't over-explain

THE MKW CONVERGENCE FRAMEWORK:
You analyze stocks through the convergence of three proven methodologies. When all three align, conviction is highest.

1. WEINSTEIN STAGE ANALYSIS (Macro Trend):
   - Stage 1: Price sideways around flattening 30-week MA. Accumulation. NOT actionable.
   - Stage 2: Price ABOVE rising 30-week MA. THE ONLY STAGE TO BE LONG. Buy breakouts from 1→2 and first pullbacks.
   - Stage 3: Price churning around flattening 30-week MA. Distribution. Exit.
   - Stage 4: Price BELOW declining 30-week MA. AVOID or SHORT only.

2. MINERVINI SEPA/VCP TEMPLATE (Entry Precision):
   - Trend Template: Price > 150d > 200d MA (rising), within 25% of 52W high, 30%+ above 52W low, RS ≥ 70
   - VCP: Contracting price ranges on declining volume → breakout from tightest contraction
   - Pivot point = breakout level from final contraction

3. KELL EMA PHASE SYSTEM (Momentum Timing):
   - EMA Stack: 10 > 20 > 50 > 120 > 200 > 400 = max momentum
   - 10/20 EMA zone = the "action zone" for pullback entries
   - EMA Crossback = highest-probability entry phase (pullback to rising 20 EMA)

CONVERGENCE SCORING (0-23 points):
- Market (3): Index stage, Kell light, template qualifier count
- Trend (5): Stock stage, 8/8 template, RS>70, above EMAs, MA stacking
- Fundamentals (3): EPS>20%, Rev>15%, expanding margins
- Entry (4): VCP 2+ contractions, volume expansion, EMA crossback/pop, within 5% of pivot
- Risk (3): Stop placement, max risk 7-8%, R:R ≥ 3:1
- FINRA SVR (1): Favorable short volume ratio

Zones: CONVERGENCE (≥21) | SECONDARY (≥16) | BUILDING (≥11) | WATCH (<11)

EMA PERIODS: 10, 20, 50, 120, 200, 400

RESPONSE FORMATTING:
For ticker analysis:
📊 [TICKER] — $[PRICE] ([CHANGE]%)
⚡ Stage: [X] | MKW Score: [X/23] | Grade: [X]
📈 Trend: [EMA stack / phase status]
🎯 Setup: [What the chart is doing]
📍 Levels: Support [X] | Resistance [X]
💡 Action: [BUY/HOLD/AVOID/SELL] — [rationale]
🎯 Entry: $X | Stop: $X | Target: $X | R/R: 1:X
📋 Options: [strategy if relevant]

For market overview:
🌍 MARKET PULSE
• SPY/QQQ/IWM status
• VIX interpretation
• Breadth assessment
• Sector leadership
💡 Bottom Line: [actionable takeaway]

LIMITATIONS (be honest):
- No order flow, dark pool, or Level 2 data
- Cannot execute trades
- Options pricing is approximate — verify with broker
- Analysis is probabilistic, not predictive
- Risk management is ALWAYS priority #1

{market_context}

Remember: You are a TRADING STRATEGIST. Frame everything as analysis and trade ideas. Always emphasize risk management."""


def build_system_prompt(market_context: str = "") -> str:
    """Build the system prompt with injected market context."""
    ctx = f"\nCURRENT MARKET DATA:\n{market_context}" if market_context else "\nNo live market data loaded for this query. If asked about specific prices or conditions, let the user know you need them to mention a ticker so the system can fetch fresh data."
    return SYSTEM_PROMPT_TEMPLATE.replace("{market_context}", ctx)


# ─────────────────────────────────────────────
# FOLLOW-UP SUGGESTIONS
# ─────────────────────────────────────────────
def generate_follow_ups(message: str, response_text: str, tickers: list) -> list:
    """Generate contextual follow-up suggestions."""
    lower = message.lower()
    suggestions = []

    if tickers:
        t = tickers[0]
        suggestions.append(f"Options play for {t}")
        suggestions.append(f"What's the stop for {t}?")
        if len(tickers) > 1:
            suggestions.append(f"Compare {tickers[0]} vs {tickers[1]}")

    elif "market" in lower or "today" in lower or "breadth" in lower:
        suggestions = ["Which sectors are leading?", "Any Stage 2 breakouts?", "Best setups right now"]

    elif any(kw in lower for kw in ["explain", "what is", "how", "teach"]):
        suggestions = ["Show me an example", "How do I find these setups?", "What's the risk?"]

    else:
        suggestions = ["What's the market doing?", "Analyze $NVDA", "Best setups right now"]

    return suggestions[:3]
