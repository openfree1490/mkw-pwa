// ── S/R DETECTION AND SETUP PATTERN MATCHING ──────────────────────────────
import { calcATR } from './analysis.js'

export function findPivots(bars, lookback = 5) {
  const pivots = { highs: [], lows: [] }
  if (!bars || bars.length < lookback * 2 + 1) return pivots

  for (let i = lookback; i < bars.length - lookback; i++) {
    let isHigh = true, isLow = true
    for (let j = 1; j <= lookback; j++) {
      if (bars[i].h <= bars[i - j].h || bars[i].h <= bars[i + j].h) isHigh = false
      if (bars[i].l >= bars[i - j].l || bars[i].l >= bars[i + j].l) isLow = false
    }
    if (isHigh) pivots.highs.push({ price: bars[i].h, index: i, time: bars[i].t })
    if (isLow) pivots.lows.push({ price: bars[i].l, index: i, time: bars[i].t })
  }
  return pivots
}

export function clusterLevels(pivots, price, threshold = 0.015) {
  if (!pivots || pivots.length === 0) return []

  const sorted = [...pivots].sort((a, b) => a.price - b.price)
  const clusters = []
  let current = { price: sorted[0].price, sum: sorted[0].price, count: 1, touches: [sorted[0]] }

  for (let i = 1; i < sorted.length; i++) {
    const avg = current.sum / current.count
    if (Math.abs(sorted[i].price - avg) / avg <= threshold) {
      current.sum += sorted[i].price
      current.count++
      current.touches.push(sorted[i])
    } else {
      current.price = current.sum / current.count
      clusters.push(current)
      current = { price: sorted[i].price, sum: sorted[i].price, count: 1, touches: [sorted[i]] }
    }
  }
  current.price = current.sum / current.count
  clusters.push(current)

  return clusters
    .filter(c => c.count >= 2)
    .map(c => ({
      price: Math.round(c.price * 100) / 100,
      touches: c.count,
      type: c.price > price ? 'resistance' : 'support',
      distance: Math.round(((c.price - price) / price) * 10000) / 100,
    }))
    .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))
}

export function detectSR(bars, price) {
  const pivots = findPivots(bars)
  const allPivots = [
    ...pivots.highs.map(p => ({ ...p, side: 'high' })),
    ...pivots.lows.map(p => ({ ...p, side: 'low' })),
  ]
  const levels = clusterLevels(allPivots, price)

  const resistance = levels.filter(l => l.type === 'resistance').slice(0, 5)
  const support = levels.filter(l => l.type === 'support').slice(0, 5)

  return {
    resistance,
    support,
    nearestResistance: resistance[0] || null,
    nearestSupport: support[0] || null,
    pivots,
  }
}

export function detectSetups(bars, analysis, sr) {
  const setups = []
  if (!bars || !analysis || !sr) return setups
  const { price, e8, e21, e50, rsi, adx, rs3m, volRatio, hvRank, trendScore } = analysis
  const atr = calcATR(bars, 14)

  // 1. Breakout — price above nearest resistance with 1.3x+ volume in uptrend
  if (sr.nearestResistance && price > sr.nearestResistance.price && volRatio >= 1.3 && trendScore >= 15) {
    const stop = sr.nearestResistance.price - atr * 0.5
    const target = price + (price - stop) * 3
    setups.push({
      type: 'momentum_breakout',
      direction: 'bullish',
      confidence: Math.min(95, 50 + trendScore + Math.round(volRatio * 10)),
      entry: Math.round(price * 100) / 100,
      stop: Math.round(stop * 100) / 100,
      target: Math.round(target * 100) / 100,
      reason: `Breaking above ${sr.nearestResistance.price.toFixed(2)} resistance (${sr.nearestResistance.touches} touches) with ${volRatio.toFixed(1)}x volume. Trend score ${trendScore}/25.`,
      strategy: hvRank > 50 ? 'call_debit_spread' : 'long_call',
      dte: '5-14',
      delta: '0.50-0.60',
    })
  }

  // 2. EMA Pullback — price near rising 8/21 EMA in Stage 2, RSI 30-55
  const nearEMA = Math.abs(price - e21) / price < 0.02
  const risingEMAs = e8 > e21 && e21 > e50
  if (nearEMA && risingEMAs && rsi >= 30 && rsi <= 55 && trendScore >= 12) {
    const stop = Math.min(e21, e50) - atr * 0.5
    const target = price + (price - stop) * 2.5
    setups.push({
      type: 'momentum_breakout',
      direction: 'bullish',
      confidence: Math.min(90, 45 + trendScore + Math.round((55 - rsi) / 2)),
      entry: Math.round(price * 100) / 100,
      stop: Math.round(stop * 100) / 100,
      target: Math.round(target * 100) / 100,
      reason: `Pulling back to rising 21 EMA (${e21.toFixed(2)}) with RSI at ${rsi.toFixed(0)}. EMAs stacked bullish. Quality dip-buy.`,
      strategy: hvRank > 50 ? 'call_debit_spread' : 'long_call',
      dte: '5-14',
      delta: '0.50-0.60',
    })
  }

  // 3. Volatility Contraction — range contracted, coiling near resistance
  if (bars.length >= 20) {
    const recent10 = bars.slice(-10)
    const prior20 = bars.slice(-30, -10)
    const recentRange = recent10.reduce((a, b) => a + (b.h - b.l), 0) / recent10.length
    const priorRange = prior20.length > 0 ? prior20.reduce((a, b) => a + (b.h - b.l), 0) / prior20.length : recentRange
    const rangeRatio = priorRange > 0 ? recentRange / priorRange : 1

    if (rangeRatio < 0.6 && sr.nearestResistance && Math.abs(price - sr.nearestResistance.price) / price < 0.03) {
      const stop = price - atr * 1.5
      const target = price + (price - stop) * 3
      setups.push({
        type: 'vol_crush',
        direction: 'bullish',
        confidence: Math.min(85, 40 + Math.round((1 - rangeRatio) * 50) + (sr.nearestResistance.touches * 5)),
        entry: sr.nearestResistance.price,
        stop: Math.round(stop * 100) / 100,
        target: Math.round(target * 100) / 100,
        reason: `Range contracted to ${Math.round(rangeRatio * 100)}% of average, coiling ${((sr.nearestResistance.price - price) / price * 100).toFixed(1)}% below resistance. Breakout imminent.`,
        strategy: 'call_debit_spread',
        dte: '7-21',
        delta: '0.45-0.55',
      })
    }
  }

  // 4. Failed Rally Short — Stage 4, failing at declining EMA, RS < 40
  if (price < e50 && e8 < e21 && rs3m < 40 && trendScore <= 8) {
    const nearResistance = sr.nearestResistance && Math.abs(price - sr.nearestResistance.price) / price < 0.03
    if (nearResistance || price > e8) {
      const stop = Math.max(e21, sr.nearestResistance?.price || e21) + atr * 0.5
      const target = price - (stop - price) * 2.5
      setups.push({
        type: 'failed_breakdown',
        direction: 'bearish',
        confidence: Math.min(85, 40 + (40 - rs3m) + Math.round((25 - trendScore) * 2)),
        entry: Math.round(price * 100) / 100,
        stop: Math.round(stop * 100) / 100,
        target: Math.round(Math.max(0, target) * 100) / 100,
        reason: `Stage 4 decline — price below 50 EMA, failing at declining ${e8 > price ? '8' : '21'} EMA. RS weak at ${rs3m}. Short setup.`,
        strategy: hvRank > 50 ? 'put_debit_spread' : 'long_put',
        dte: '7-21',
        delta: '0.45-0.55',
      })
    }
  }

  // 5. Mean Reversion — RSI < 28 at support (long) or RSI > 72 at resistance (short)
  if (rsi < 28 && sr.nearestSupport && Math.abs(price - sr.nearestSupport.price) / price < 0.02) {
    const stop = sr.nearestSupport.price - atr * 1.5
    const target = e21 || price * 1.05
    setups.push({
      type: 'mean_reversion',
      direction: 'bullish',
      confidence: Math.min(80, 35 + Math.round((28 - rsi) * 2) + sr.nearestSupport.touches * 5),
      entry: Math.round(price * 100) / 100,
      stop: Math.round(stop * 100) / 100,
      target: Math.round(target * 100) / 100,
      reason: `RSI oversold at ${rsi.toFixed(0)} near ${sr.nearestSupport.touches}-touch support at ${sr.nearestSupport.price.toFixed(2)}. Bounce setup.`,
      strategy: 'long_call',
      dte: '3-7',
      delta: '0.55-0.65',
    })
  }
  if (rsi > 72 && sr.nearestResistance && Math.abs(price - sr.nearestResistance.price) / price < 0.02) {
    const stop = sr.nearestResistance.price + atr * 1.5
    const target = e21 || price * 0.95
    setups.push({
      type: 'sr_rejection',
      direction: 'bearish',
      confidence: Math.min(80, 35 + Math.round((rsi - 72) * 2) + sr.nearestResistance.touches * 5),
      entry: Math.round(price * 100) / 100,
      stop: Math.round(stop * 100) / 100,
      target: Math.round(target * 100) / 100,
      reason: `RSI overbought at ${rsi.toFixed(0)} at ${sr.nearestResistance.touches}-touch resistance at ${sr.nearestResistance.price.toFixed(2)}. Rejection setup.`,
      strategy: 'long_put',
      dte: '3-7',
      delta: '0.55-0.65',
    })
  }

  // 6. IV Crush — HV Rank > 70, ADX < 20, sell iron condors
  if (hvRank > 70 && adx < 20) {
    const wingWidth = atr * 2
    const stop = price + wingWidth
    const target = price
    setups.push({
      type: 'vol_crush',
      direction: 'neutral',
      confidence: Math.min(85, 45 + Math.round((hvRank - 70) * 1.5) + Math.round((20 - adx) * 2)),
      entry: Math.round(price * 100) / 100,
      stop: Math.round(stop * 100) / 100,
      target: Math.round(target * 100) / 100,
      reason: `HV Rank at ${hvRank}% with ADX only ${adx.toFixed(0)} — no trend but elevated volatility. Sell premium as IV mean-reverts.`,
      strategy: 'iron_condor',
      dte: '14-30',
      delta: '0.20-0.30',
    })
  }

  return setups.sort((a, b) => b.confidence - a.confidence)
}
