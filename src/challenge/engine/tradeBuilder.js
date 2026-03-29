// ── TRADE IDEA BUILDER ────────────────────────────────────────────────────
import { TIERS, STRATEGIES, SETUP_TYPES } from './constants.js'
import { scoreForTimeframe } from './scoring.js'

export function buildTradeIdea(ticker, setup, analysis, balance, tier, modeKey = 'swing') {
  const tierDef = TIERS[tier] || TIERS[0]
  const riskBudget = Math.round(balance * tierDef.riskPct * 100) / 100

  const entry = setup.entry
  const stop = setup.stop
  const target = setup.target
  const riskPerShare = Math.abs(entry - stop)
  const rewardPerShare = Math.abs(target - entry)
  const rr = riskPerShare > 0 ? Math.round((rewardPerShare / riskPerShare) * 100) / 100 : 0

  const stratDef = STRATEGIES.find(s => s.key === setup.strategy) || STRATEGIES[0]
  const setupDef = SETUP_TYPES.find(s => s.key === setup.type) || SETUP_TYPES[6]
  const scored = scoreForTimeframe(analysis, modeKey)

  return {
    id: `${ticker}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ticker,
    direction: setup.direction,
    setupType: setup.type,
    setupLabel: setupDef.label,
    setupIcon: setupDef.icon,
    strategy: setup.strategy,
    strategyLabel: stratDef.label,
    strategyType: stratDef.type,
    confidence: setup.confidence,
    entry,
    stop,
    target,
    rr,
    riskBudget,
    maxLoss: riskBudget,
    reason: setup.reason,
    dte: setup.dte,
    delta: setup.delta,
    hvRank: analysis.hvRank,
    ivHint: analysis.ivHint,
    grade: scored.grade,
    score: scored.score,
    scoredDirection: scored.direction,
    scoredStrategy: scored.strategy,
    flags: scored.flags,
    breakdown: scored.breakdown,
    tierName: tierDef.name,
    tierColor: tierDef.color,
    timestamp: Date.now(),
    analysis,
  }
}
