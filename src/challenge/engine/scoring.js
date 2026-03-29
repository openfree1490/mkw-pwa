// ── TIMEFRAME-WEIGHTED SCORING ENGINE ─────────────────────────────────────
import { TIMEFRAME_MODES, STRATEGIES } from './constants.js'

export function scoreForTimeframe(analysis, modeKey = 'swing') {
  const mode = TIMEFRAME_MODES[modeKey] || TIMEFRAME_MODES.swing
  const w = mode.weights

  // Re-weight raw subscores
  const weighted = {
    trend: Math.min(25, analysis.trendScore * w.trend),
    momentum: Math.min(25, analysis.momentumScore * w.momentum),
    volume: Math.min(25, analysis.volScore * w.volume),
    iv: Math.min(25, analysis.ivScore * w.iv),
  }

  const totalWeight = w.trend + w.momentum + w.volume + w.iv
  const rawScore = weighted.trend + weighted.momentum + weighted.volume + weighted.iv
  // Normalize to 0-100
  const score = Math.round(Math.min(100, (rawScore / (25 * totalWeight)) * 100))

  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' :
    score >= 60 ? 'B' : score >= 50 ? 'C+' : score >= 40 ? 'C' :
    score >= 30 ? 'D' : 'F'

  // Timeframe-adapted direction
  let direction = analysis.direction
  if (modeKey === 'scalp') {
    // Scalp favors momentum: override direction if momentum is strong
    if (analysis.momentumScore >= 18 && analysis.rsi > 55) direction = 'bullish'
    else if (analysis.momentumScore >= 18 && analysis.rsi < 45) direction = 'bearish'
    else if (analysis.momentumScore < 10) direction = 'neutral'
  } else if (modeKey === 'leaps') {
    // LEAPS needs strong trend confirmation
    if (analysis.trendScore < 15) direction = 'neutral'
  }

  // Strategy suggestion based on direction + IV environment
  let strategy = 'long_call'
  if (direction === 'bullish') {
    if (analysis.hvRank > 60) strategy = 'call_debit_spread'
    else strategy = 'long_call'
  } else if (direction === 'bearish') {
    if (analysis.hvRank > 60) strategy = 'put_debit_spread'
    else strategy = 'long_put'
  } else {
    if (analysis.hvRank > 70 && analysis.adx < 20) strategy = 'iron_condor'
    else if (analysis.hvRank < 30) strategy = 'straddle'
    else strategy = 'iron_condor'
  }

  // Ensure strategy is allowed in this timeframe
  if (!mode.strategies.includes(strategy)) {
    strategy = mode.strategies.find(s => {
      const def = STRATEGIES.find(st => st.key === s)
      return def && def.direction === direction
    }) || mode.strategies[0]
  }

  // Contextual flags
  const flags = []
  if (analysis.volRatio > 2.0) flags.push('Unusual volume detected — verify catalyst')
  if (analysis.rsi > 75) flags.push('RSI overbought — watch for reversal')
  if (analysis.rsi < 25) flags.push('RSI oversold — possible bounce')
  if (analysis.hvRank > 80) flags.push('IV very high — premium is expensive')
  if (analysis.hvRank < 15) flags.push('IV very low — cheap options, possible expansion ahead')
  if (analysis.adx < 15) flags.push('No trend (ADX < 15) — avoid directional plays')
  if (modeKey === 'scalp' && analysis.volRatio < 0.8) flags.push('Low volume — scalp entries unreliable')
  if (modeKey === 'leaps' && analysis.trendScore < 15) flags.push('Trend too weak for LEAPS — wait for confirmation')
  if (modeKey === 'leaps' && analysis.hvRank > 60) flags.push('IV elevated — LEAPS entry cost is high')
  if (modeKey === 'position' && analysis.adx < 20) flags.push('ADX low — position trade needs established trend')

  const [minDte, maxDte] = mode.dteRange
  const dte = Math.round((minDte + maxDte) / 2)
  const [minDelta, maxDelta] = mode.deltaRange
  const delta = Math.round(((minDelta + maxDelta) / 2) * 100) / 100

  return {
    score,
    grade,
    direction,
    strategy,
    flags,
    breakdown: {
      trend: { raw: analysis.trendScore, weight: w.trend, weighted: Math.round(weighted.trend * 10) / 10 },
      momentum: { raw: analysis.momentumScore, weight: w.momentum, weighted: Math.round(weighted.momentum * 10) / 10 },
      volume: { raw: analysis.volScore, weight: w.volume, weighted: Math.round(weighted.volume * 10) / 10 },
      iv: { raw: analysis.ivScore, weight: w.iv, weighted: Math.round(weighted.iv * 10) / 10 },
    },
    dte,
    delta,
  }
}
