// ── SVG CANDLESTICK CHART ─────────────────────────────────────────────────
import { CC, FONTS } from '../engine/constants.js'
import { calcEMA } from '../engine/analysis.js'

export default function CandleChart({ bars = [], srLevels = [], entry, stop, target, height = 320 }) {
  if (!bars || bars.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: CC.textMuted, fontFamily: FONTS.mono, fontSize: 12 }}>
        No chart data
      </div>
    )
  }

  const displayBars = bars.slice(-80)
  const closes = bars.map(b => b.c)
  const ema8All = calcEMA(closes, 8)
  const ema21All = calcEMA(closes, 21)
  const ema50All = calcEMA(closes, 50)
  const offset = bars.length - displayBars.length
  const ema8 = ema8All.slice(offset)
  const ema21 = ema21All.slice(offset)
  const ema50 = ema50All.slice(offset)

  const padding = { top: 20, right: 60, bottom: 40, left: 10 }
  const width = 600
  const chartH = height * 0.82
  const volH = height * 0.18

  const allPrices = displayBars.flatMap(b => [b.h, b.l])
  if (entry) allPrices.push(entry)
  if (stop) allPrices.push(stop)
  if (target) allPrices.push(target)
  srLevels.forEach(l => allPrices.push(l.price))
  const priceMin = Math.min(...allPrices) * 0.998
  const priceMax = Math.max(...allPrices) * 1.002
  const maxVol = Math.max(...displayBars.map(b => b.v), 1)

  const chartWidth = width - padding.left - padding.right
  const barWidth = chartWidth / displayBars.length
  const candleWidth = Math.max(2, barWidth * 0.6)

  const scaleY = (price) => padding.top + (1 - (price - priceMin) / (priceMax - priceMin)) * (chartH - padding.top - 10)
  const scaleX = (i) => padding.left + i * barWidth + barWidth / 2
  const scaleVol = (vol) => chartH + volH - (vol / maxVol) * (volH - 8)

  const emaLine = (data, color) => {
    if (!data || data.length < 2) return null
    const points = data.map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(' ')
    return <polyline points={points} fill="none" stroke={color} strokeWidth={1.2} opacity={0.7} />
  }

  const hLine = (price, color, label, dashed = true) => {
    if (price === undefined || price === null) return null
    const y = scaleY(price)
    if (y < padding.top || y > chartH) return null
    return (
      <g key={`${label}-${price}`}>
        <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
          stroke={color} strokeWidth={1} strokeDasharray={dashed ? '4,3' : 'none'} opacity={0.6} />
        <rect x={width - padding.right + 2} y={y - 8} width={56} height={16} rx={3} fill={`${color}30`} stroke={color} strokeWidth={0.5} />
        <text x={width - padding.right + 6} y={y + 4} fill={color} fontSize={9} fontFamily={FONTS.mono}>{label} {price.toFixed(2)}</text>
      </g>
    )
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, background: 'transparent' }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(p => {
          const y = padding.top + p * (chartH - padding.top - 10)
          const price = priceMax - p * (priceMax - priceMin)
          return (
            <g key={p}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={CC.border} strokeWidth={0.5} opacity={0.3} />
              <text x={width - padding.right + 4} y={y + 3} fill={CC.textMuted} fontSize={8} fontFamily={FONTS.mono}>{price.toFixed(2)}</text>
            </g>
          )
        })}

        {/* Volume bars */}
        {displayBars.map((bar, i) => {
          const isGreen = bar.c >= bar.o
          return (
            <rect key={`vol-${i}`}
              x={scaleX(i) - candleWidth / 2}
              y={scaleVol(bar.v)}
              width={candleWidth}
              height={chartH + volH - scaleVol(bar.v)}
              fill={isGreen ? CC.profit : CC.loss}
              opacity={0.2}
              rx={1}
            />
          )
        })}

        {/* S/R levels */}
        {srLevels.map((level, i) => (
          <g key={`sr-${i}`}>
            <line
              x1={padding.left} y1={scaleY(level.price)} x2={width - padding.right} y2={scaleY(level.price)}
              stroke={level.type === 'resistance' ? CC.loss : CC.profit}
              strokeWidth={1} strokeDasharray="6,3" opacity={0.4}
            />
            <text x={padding.left + 4} y={scaleY(level.price) - 3}
              fill={level.type === 'resistance' ? CC.loss : CC.profit}
              fontSize={8} fontFamily={FONTS.mono} opacity={0.7}>
              {level.type === 'resistance' ? 'R' : 'S'} {level.price.toFixed(2)} ({level.touches}x)
            </text>
          </g>
        ))}

        {/* EMA overlays */}
        {emaLine(ema8, CC.accent)}
        {emaLine(ema21, CC.warning)}
        {emaLine(ema50, CC.purple)}

        {/* Candlesticks */}
        {displayBars.map((bar, i) => {
          const x = scaleX(i)
          const isGreen = bar.c >= bar.o
          const bodyTop = scaleY(Math.max(bar.o, bar.c))
          const bodyBot = scaleY(Math.min(bar.o, bar.c))
          const bodyH = Math.max(1, bodyBot - bodyTop)
          return (
            <g key={`candle-${i}`}>
              <line x1={x} y1={scaleY(bar.h)} x2={x} y2={scaleY(bar.l)}
                stroke={isGreen ? CC.profit : CC.loss} strokeWidth={1} />
              <rect
                x={x - candleWidth / 2} y={bodyTop}
                width={candleWidth} height={bodyH}
                fill={isGreen ? CC.profit : CC.loss}
                rx={1}
              />
            </g>
          )
        })}

        {/* Entry / Stop / Target lines */}
        {hLine(entry, CC.blue, 'ENTRY', true)}
        {hLine(stop, CC.loss, 'STOP', true)}
        {hLine(target, CC.profit, 'TARGET', true)}

        {/* Legend */}
        <g transform={`translate(${padding.left + 4}, ${height - 10})`}>
          <line x1={0} y1={0} x2={16} y2={0} stroke={CC.accent} strokeWidth={1.5} />
          <text x={20} y={3} fill={CC.textMuted} fontSize={8} fontFamily={FONTS.mono}>8 EMA</text>
          <line x1={60} y1={0} x2={76} y2={0} stroke={CC.warning} strokeWidth={1.5} />
          <text x={80} y={3} fill={CC.textMuted} fontSize={8} fontFamily={FONTS.mono}>21 EMA</text>
          <line x1={124} y1={0} x2={140} y2={0} stroke={CC.purple} strokeWidth={1.5} />
          <text x={144} y={3} fill={CC.textMuted} fontSize={8} fontFamily={FONTS.mono}>50 EMA</text>
        </g>
      </svg>
    </div>
  )
}
