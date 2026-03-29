// ── TECHNICAL ANALYSIS ENGINE ─────────────────────────────────────────────
// All functions operate on arrays of OHLCV bar objects: { o, h, l, c, v, t }

export function calcEMA(closes, period) {
  if (!closes || closes.length === 0) return []
  const k = 2 / (period + 1)
  const ema = [closes[0]]
  for (let i = 1; i < closes.length; i++) {
    ema.push(closes[i] * k + ema[i - 1] * (1 - k))
  }
  return ema
}

export function calcSMA(closes, period) {
  if (!closes || closes.length < period) return []
  const sma = []
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += closes[j]
    sma.push(sum / period)
  }
  return sma
}

export function calcRSI(bars, period = 14) {
  if (!bars || bars.length < period + 1) return 50
  const closes = bars.map(b => b.c)
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1]
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export function calcADX(bars, period = 14) {
  if (!bars || bars.length < period * 2) return 20
  const pDM = [], nDM = [], tr = []
  for (let i = 1; i < bars.length; i++) {
    const hi = bars[i].h, lo = bars[i].l
    const prevHi = bars[i - 1].h, prevLo = bars[i - 1].l, prevC = bars[i - 1].c
    const upMove = hi - prevHi
    const downMove = prevLo - lo
    pDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    nDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
    tr.push(Math.max(hi - lo, Math.abs(hi - prevC), Math.abs(lo - prevC)))
  }
  const smooth = (arr, p) => {
    const out = [arr.slice(0, p).reduce((a, b) => a + b, 0)]
    for (let i = p; i < arr.length; i++) {
      out.push(out[out.length - 1] - out[out.length - 1] / p + arr[i])
    }
    return out
  }
  const sTR = smooth(tr, period)
  const sPDM = smooth(pDM, period)
  const sNDM = smooth(nDM, period)
  const dx = []
  for (let i = 0; i < sTR.length; i++) {
    if (sTR[i] === 0) { dx.push(0); continue }
    const pDI = (sPDM[i] / sTR[i]) * 100
    const nDI = (sNDM[i] / sTR[i]) * 100
    const sum = pDI + nDI
    dx.push(sum === 0 ? 0 : (Math.abs(pDI - nDI) / sum) * 100)
  }
  if (dx.length < period) return dx.length > 0 ? dx[dx.length - 1] : 20
  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < dx.length; i++) {
    adx = (adx * (period - 1) + dx[i]) / period
  }
  return adx
}

export function calcHV(bars, period = 20) {
  if (!bars || bars.length < period + 1) return 0
  const closes = bars.slice(-period - 1).map(b => b.c)
  const logReturns = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) logReturns.push(Math.log(closes[i] / closes[i - 1]))
  }
  if (logReturns.length < 2) return 0
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length
  const variance = logReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / (logReturns.length - 1)
  return Math.sqrt(variance * 252) * 100
}

export function calcHVRank(bars) {
  if (!bars || bars.length < 272) return 50
  const current = calcHV(bars, 20)
  const lookback = 252
  const hvValues = []
  for (let i = 20; i <= Math.min(bars.length - 1, lookback + 20); i++) {
    hvValues.push(calcHV(bars.slice(0, i + 1), 20))
  }
  if (hvValues.length < 10) return 50
  const below = hvValues.filter(v => v < current).length
  return Math.round((below / hvValues.length) * 100)
}

export function calcATR(bars, period = 14) {
  if (!bars || bars.length < period + 1) return 0
  const trueRanges = []
  for (let i = 1; i < bars.length; i++) {
    const hi = bars[i].h, lo = bars[i].l, prevC = bars[i - 1].c
    trueRanges.push(Math.max(hi - lo, Math.abs(hi - prevC), Math.abs(lo - prevC)))
  }
  if (trueRanges.length < period) return trueRanges.length > 0 ? trueRanges[trueRanges.length - 1] : 0
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period
  }
  return atr
}

export function calcRS(tickerBars, spyBars, period = 63) {
  if (!tickerBars || !spyBars || tickerBars.length < period || spyBars.length < period) return 50
  const tLen = Math.min(tickerBars.length, spyBars.length, period)
  const tStart = tickerBars[tickerBars.length - tLen].c
  const tEnd = tickerBars[tickerBars.length - 1].c
  const sStart = spyBars[spyBars.length - tLen].c
  const sEnd = spyBars[spyBars.length - 1].c
  if (tStart === 0 || sStart === 0) return 50
  const tReturn = (tEnd - tStart) / tStart
  const sReturn = (sEnd - sStart) / sStart
  const relPerf = tReturn - sReturn
  // Normalize to 0-100 scale: -0.5 → 0, 0 → 50, +0.5 → 100
  return Math.max(0, Math.min(100, Math.round(50 + relPerf * 100)))
}

export function analyzeStock(bars, spyBars) {
  if (!bars || bars.length < 50) {
    return {
      price: 0, dayChange: 0, e8: 0, e21: 0, e50: 0, e200: 0,
      rs3m: 50, rs1m: 50, hvRank: 50, hv20: 0, rsi: 50, adx: 20,
      high52: 0, low52: 0, pctFrom52High: 0, avgVol20: 0, todayVol: 0, volRatio: 0,
      trendScore: 0, momentumScore: 0, volScore: 0, ivScore: 0,
      composite: 0, grade: 'F', direction: 'neutral', ivHint: '',
    }
  }

  const closes = bars.map(b => b.c)
  const price = closes[closes.length - 1]
  const prevClose = closes.length > 1 ? closes[closes.length - 2] : price
  const dayChange = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0

  const ema8 = calcEMA(closes, 8)
  const ema21 = calcEMA(closes, 21)
  const ema50 = calcEMA(closes, 50)
  const ema200 = closes.length >= 200 ? calcEMA(closes, 200) : []

  const e8 = ema8[ema8.length - 1] || 0
  const e21 = ema21[ema21.length - 1] || 0
  const e50 = ema50[ema50.length - 1] || 0
  const e200 = ema200.length > 0 ? ema200[ema200.length - 1] : e50

  const rs3m = calcRS(bars, spyBars, 63)
  const rs1m = calcRS(bars, spyBars, 21)
  const hvRank = calcHVRank(bars)
  const hv20 = calcHV(bars, 20)
  const rsi = calcRSI(bars, 14)
  const adx = calcADX(bars, 14)

  const yearBars = bars.slice(-252)
  const high52 = Math.max(...yearBars.map(b => b.h))
  const low52 = Math.min(...yearBars.map(b => b.l))
  const pctFrom52High = high52 > 0 ? ((price - high52) / high52) * 100 : 0

  const vol20 = bars.slice(-20)
  const avgVol20 = vol20.reduce((a, b) => a + b.v, 0) / vol20.length
  const todayVol = bars[bars.length - 1].v
  const volRatio = avgVol20 > 0 ? todayVol / avgVol20 : 0

  // ── TREND SCORE (0-25) ──
  let trendScore = 0
  if (price > e8) trendScore += 4
  if (price > e21) trendScore += 4
  if (price > e50) trendScore += 4
  if (price > e200) trendScore += 3
  if (e8 > e21) trendScore += 3
  if (e21 > e50) trendScore += 3
  if (pctFrom52High > -15) trendScore += 2
  if (pctFrom52High > -5) trendScore += 2
  trendScore = Math.min(25, trendScore)

  // ── MOMENTUM SCORE (0-25) ──
  let momentumScore = 0
  if (rsi > 50 && rsi < 75) momentumScore += 6
  else if (rsi >= 40 && rsi <= 50) momentumScore += 3
  else if (rsi > 75) momentumScore += 2
  if (adx > 20) momentumScore += 4
  if (adx > 30) momentumScore += 3
  if (rs3m > 60) momentumScore += 4
  if (rs3m > 75) momentumScore += 3
  if (rs1m > 55) momentumScore += 3
  if (dayChange > 0) momentumScore += 2
  momentumScore = Math.min(25, momentumScore)

  // ── VOLUME SCORE (0-25) ──
  let volScore = 0
  if (volRatio > 0.8) volScore += 4
  if (volRatio > 1.0) volScore += 4
  if (volRatio > 1.3) volScore += 4
  if (volRatio > 1.8) volScore += 3
  if (avgVol20 > 500000) volScore += 4
  if (avgVol20 > 1000000) volScore += 3
  if (todayVol > avgVol20) volScore += 3
  volScore = Math.min(25, volScore)

  // ── IV SCORE (0-25) — lower HV rank = better for debit ──
  let ivScore = 0
  if (hvRank < 30) ivScore += 8
  else if (hvRank < 50) ivScore += 5
  else if (hvRank < 70) ivScore += 3
  if (hv20 < 40) ivScore += 5
  else if (hv20 < 60) ivScore += 3
  if (hvRank > 70) ivScore += 4 // good for credit strategies
  if (adx < 20 && hvRank > 60) ivScore += 4
  ivScore = Math.min(25, Math.max(0, ivScore))

  const composite = trendScore + momentumScore + volScore + ivScore
  const grade = composite >= 90 ? 'A+' : composite >= 80 ? 'A' : composite >= 70 ? 'B+' :
    composite >= 60 ? 'B' : composite >= 50 ? 'C+' : composite >= 40 ? 'C' :
    composite >= 30 ? 'D' : 'F'

  let direction = 'neutral'
  if (trendScore >= 18 && momentumScore >= 15) direction = 'bullish'
  else if (trendScore >= 12 && momentumScore >= 10) direction = 'bullish'
  else if (trendScore <= 8 && rsi < 40) direction = 'bearish'
  else if (price < e50 && e8 < e21) direction = 'bearish'

  let ivHint = ''
  if (hvRank < 25) ivHint = 'IV Low — favor debit strategies'
  else if (hvRank < 50) ivHint = 'IV Moderate — debit or spreads'
  else if (hvRank < 75) ivHint = 'IV Elevated — prefer spreads, consider credit'
  else ivHint = 'IV High — sell premium, iron condors, credit spreads'

  return {
    price, dayChange, e8, e21, e50, e200,
    rs3m, rs1m, hvRank, hv20, rsi, adx,
    high52, low52, pctFrom52High, avgVol20, todayVol, volRatio,
    trendScore, momentumScore, volScore, ivScore,
    composite, grade, direction, ivHint,
  }
}
