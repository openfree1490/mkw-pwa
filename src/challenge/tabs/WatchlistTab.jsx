// ── WATCHLIST TAB — Live Scoring with Timeframe Modes ─────────────────────
import { useState, useCallback } from 'react'
import { TIMEFRAME_MODES, CC, FONTS } from '../engine/constants.js'
import { analyzeStock } from '../engine/analysis.js'
import { scoreForTimeframe } from '../engine/scoring.js'
import { Panel, SectionHeader, Badge, Button, Row, Grid } from '../components/shared.jsx'
import ProgressBar from '../components/ProgressBar.jsx'

const QUICK_TICKERS = ['AAPL', 'NVDA', 'TSLA', 'META', 'MSFT', 'AMZN', 'GOOGL', 'AMD']
const SORT_OPTIONS = [
  { key: 'score', label: 'Score' },
  { key: 'rs', label: 'RS' },
  { key: 'iv', label: 'IV' },
  { key: 'change', label: 'Change' },
]

export default function WatchlistTab({ watchlist, setWatchlist, apiKey, timeframeMode, setTimeframeMode }) {
  const [tickerInput, setTickerInput] = useState('')
  const [sortBy, setSortBy] = useState('score')
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stockData, setStockData] = useState({})

  const mode = TIMEFRAME_MODES[timeframeMode] || TIMEFRAME_MODES.swing

  const addTicker = useCallback((ticker) => {
    const t = (ticker || tickerInput).trim().toUpperCase()
    if (t && !watchlist.includes(t)) {
      setWatchlist(prev => [...prev, t])
      setTickerInput('')
    }
  }, [tickerInput, watchlist, setWatchlist])

  const removeTicker = (ticker) => {
    setWatchlist(prev => prev.filter(t => t !== ticker))
    setStockData(prev => { const n = { ...prev }; delete n[ticker]; return n })
  }

  const fetchData = useCallback(async () => {
    if (!apiKey || watchlist.length === 0) return
    setLoading(true)
    try {
      // Fetch SPY for relative strength
      const spyRes = await fetch(`https://api.polygon.io/v2/aggs/ticker/SPY/range/1/day/2025-01-01/${new Date().toISOString().split('T')[0]}?adjusted=true&sort=asc&limit=300&apiKey=${apiKey}`)
      const spyData = await spyRes.json()
      const spyBars = (spyData.results || []).map(r => ({ o: r.o, h: r.h, l: r.l, c: r.c, v: r.v, t: r.t }))

      const results = {}
      for (const ticker of watchlist) {
        try {
          const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/2024-01-01/${new Date().toISOString().split('T')[0]}?adjusted=true&sort=asc&limit=500&apiKey=${apiKey}`)
          const data = await res.json()
          const bars = (data.results || []).map(r => ({ o: r.o, h: r.h, l: r.l, c: r.c, v: r.v, t: r.t }))
          if (bars.length > 0) {
            const analysis = analyzeStock(bars, spyBars)
            const scored = scoreForTimeframe(analysis, timeframeMode)
            results[ticker] = { bars, analysis, scored }
          }
        } catch { /* skip failed ticker */ }
      }
      setStockData(results)
    } catch (err) {
      console.error('Watchlist fetch error:', err)
    }
    setLoading(false)
  }, [apiKey, watchlist, timeframeMode])

  // Sort watchlist
  const sorted = [...watchlist].sort((a, b) => {
    const da = stockData[a], db = stockData[b]
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    switch (sortBy) {
      case 'score': return (db.scored?.score || 0) - (da.scored?.score || 0)
      case 'rs': return (db.analysis?.rs3m || 0) - (da.analysis?.rs3m || 0)
      case 'iv': return (db.analysis?.hvRank || 0) - (da.analysis?.hvRank || 0)
      case 'change': return (db.analysis?.dayChange || 0) - (da.analysis?.dayChange || 0)
      default: return 0
    }
  })

  return (
    <div style={{ padding: 12 }}>
      {/* Timeframe Mode Selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {Object.values(TIMEFRAME_MODES).map(m => (
          <button key={m.key} onClick={() => setTimeframeMode(m.key)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 6, cursor: 'pointer',
            background: timeframeMode === m.key ? `${m.color}20` : CC.surface,
            border: `1px solid ${timeframeMode === m.key ? m.color : CC.border}`,
            transition: 'all 0.2s',
          }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 11, fontWeight: 700, color: timeframeMode === m.key ? m.color : CC.textMuted }}>{m.label}</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>{m.tag}</div>
          </button>
        ))}
      </div>

      {/* Mode Description */}
      <Panel style={{ padding: 10, marginBottom: 10 }}>
        <div style={{ fontFamily: FONTS.body, fontSize: 12, color: CC.text }}>{mode.description}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {mode.rules.map((r, i) => (
            <span key={i} style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted, background: CC.bg, padding: '2px 6px', borderRadius: 3 }}>{r}</span>
          ))}
        </div>
        {mode.warning && (
          <div style={{ marginTop: 8, padding: '6px 10px', background: `${CC.warning}10`, border: `1px solid ${CC.warning}30`, borderRadius: 6, fontFamily: FONTS.body, fontSize: 11, color: CC.warning }}>
            {mode.warning}
          </div>
        )}
      </Panel>

      {/* Ticker Input */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          value={tickerInput}
          onChange={e => setTickerInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addTicker()}
          placeholder="Add ticker..."
          style={{
            flex: 1, padding: '8px 12px', fontFamily: FONTS.mono, fontSize: 13,
            color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
            borderRadius: 6,
          }}
        />
        <Button onClick={() => addTicker()} variant="primary" style={{ padding: '8px 14px' }}>ADD</Button>
        <Button onClick={fetchData} disabled={loading || !apiKey} style={{ padding: '8px 14px' }}>
          {loading ? '...' : 'SCAN'}
        </Button>
      </div>

      {/* Quick Add */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {QUICK_TICKERS.filter(t => !watchlist.includes(t)).map(t => (
          <button key={t} onClick={() => addTicker(t)} style={{
            fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, background: CC.surface,
            border: `1px solid ${CC.border}`, borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
          }}>{t}</button>
        ))}
      </div>

      {!apiKey && (
        <Panel style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontFamily: FONTS.body, fontSize: 13, color: CC.warning }}>Set your Polygon.io API key in Settings to enable live data</div>
        </Panel>
      )}

      {/* Sort Controls */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {SORT_OPTIONS.map(s => (
          <button key={s.key} onClick={() => setSortBy(s.key)} style={{
            fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1,
            padding: '4px 10px', borderRadius: 4, cursor: 'pointer', textTransform: 'uppercase',
            background: sortBy === s.key ? `${CC.accent}20` : 'transparent',
            color: sortBy === s.key ? CC.accent : CC.textMuted,
            border: `1px solid ${sortBy === s.key ? CC.accent + '40' : CC.border}`,
          }}>{s.label}</button>
        ))}
      </div>

      {/* Watchlist Table */}
      {sorted.map(ticker => {
        const data = stockData[ticker]
        const a = data?.analysis
        const s = data?.scored
        const isExpanded = expanded === ticker
        const gradeColor = s ? (s.grade.startsWith('A') ? CC.profit : s.grade.startsWith('B') ? CC.accent : s.grade.startsWith('C') ? CC.warning : CC.loss) : CC.textMuted

        return (
          <Panel key={ticker} style={{ marginBottom: 6, padding: 0, overflow: 'hidden' }}>
            <div
              onClick={() => setExpanded(isExpanded ? null : ticker)}
              style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', gap: 8 }}
            >
              <div style={{ flex: '0 0 60px' }}>
                <div style={{ fontFamily: FONTS.heading, fontSize: 14, fontWeight: 700, color: CC.textBright }}>{ticker}</div>
                {s && <Badge color={gradeColor} style={{ marginTop: 2 }}>{s.grade}</Badge>}
              </div>
              {a ? (
                <>
                  <div style={{ flex: 1, fontFamily: FONTS.mono, fontSize: 12 }}>
                    <span style={{ color: CC.textBright }}>${a.price.toFixed(2)}</span>
                    <span style={{ color: a.dayChange >= 0 ? CC.profit : CC.loss, marginLeft: 6, fontSize: 10 }}>{a.dayChange >= 0 ? '+' : ''}{a.dayChange.toFixed(1)}%</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 16, fontWeight: 700, color: mode.color }}>{s?.score || 0}</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>SCORE</div>
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, fontFamily: FONTS.mono, fontSize: 11, color: CC.textMuted }}>Scan to load data</div>
              )}
              <button onClick={(e) => { e.stopPropagation(); removeTicker(ticker) }} style={{
                fontFamily: FONTS.mono, fontSize: 14, color: CC.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
              }}>×</button>
            </div>

            {/* Quick Stats Row */}
            {a && !isExpanded && (
              <div style={{ display: 'flex', gap: 1, padding: '0 12px 8px', flexWrap: 'wrap' }}>
                {[
                  { label: 'RS', value: a.rs3m, color: a.rs3m > 60 ? CC.profit : a.rs3m < 40 ? CC.loss : CC.textMuted },
                  { label: 'HV%', value: a.hvRank, color: a.hvRank > 70 ? CC.warning : CC.textMuted },
                  { label: 'RSI', value: Math.round(a.rsi), color: a.rsi > 70 ? CC.loss : a.rsi < 30 ? CC.profit : CC.textMuted },
                  { label: 'ADX', value: Math.round(a.adx), color: a.adx > 25 ? CC.profit : CC.textMuted },
                  { label: 'Vol', value: `${a.volRatio.toFixed(1)}x`, color: a.volRatio > 1.3 ? CC.accent : CC.textMuted },
                ].map(m => (
                  <span key={m.label} style={{ fontFamily: FONTS.mono, fontSize: 9, color: m.color, background: CC.bg, padding: '2px 5px', borderRadius: 3 }}>
                    {m.label}:{m.value}
                  </span>
                ))}
                {s && <Badge color={s.direction === 'bullish' ? CC.profit : s.direction === 'bearish' ? CC.loss : CC.blue} style={{ fontSize: 8 }}>{s.direction}</Badge>}
              </div>
            )}

            {/* Expanded Detail */}
            {isExpanded && a && s && (
              <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${CC.border}` }}>
                {/* Timeframe Score Breakdown */}
                <SectionHeader style={{ marginTop: 8 }}>Score Breakdown ({mode.label})</SectionHeader>
                {['trend', 'momentum', 'volume', 'iv'].map(k => {
                  const bd = s.breakdown[k]
                  return (
                    <div key={k} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.mono, fontSize: 10 }}>
                        <span style={{ color: CC.textMuted, textTransform: 'uppercase' }}>{k}</span>
                        <span style={{ color: CC.textBright }}>{bd.raw}/25 × {bd.weight}x = <span style={{ color: mode.color }}>{bd.weighted}</span></span>
                      </div>
                      <div style={{ width: '100%', height: 4, background: CC.bg, borderRadius: 2, marginTop: 2 }}>
                        <div style={{ width: `${(bd.weighted / 25) * 100}%`, height: '100%', background: mode.color, borderRadius: 2, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )
                })}

                {/* Strategy Suggestion */}
                <Panel style={{ marginTop: 8, background: CC.bg }}>
                  <div style={{ fontFamily: FONTS.heading, fontSize: 10, color: CC.textMuted, letterSpacing: 1.5, marginBottom: 4 }}>STRATEGY SUGGESTION</div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.accent }}>{s.strategy.replace(/_/g, ' ').toUpperCase()}</div>
                  <div style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.text, marginTop: 4 }}>{a.ivHint}</div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginTop: 4 }}>DTE: {s.dte} • Delta: {s.delta}</div>
                </Panel>

                {/* Flags */}
                {s.flags.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {s.flags.map((f, i) => (
                      <div key={i} style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.warning, padding: '4px 8px', background: `${CC.warning}08`, borderRadius: 4, marginBottom: 3 }}>
                        ⚠ {f}
                      </div>
                    ))}
                  </div>
                )}

                {/* Raw Analysis */}
                <SectionHeader style={{ marginTop: 8 }}>Raw Analysis</SectionHeader>
                <Grid cols={2}>
                  <Panel style={{ background: CC.bg, padding: 8 }}>
                    <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted, letterSpacing: 1, marginBottom: 4 }}>TREND</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: CC.textBright }}>{a.trendScore}/25</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
                      EMA: {a.e8.toFixed(1)}/{a.e21.toFixed(1)}/{a.e50.toFixed(1)}<br />
                      52w: {a.pctFrom52High.toFixed(1)}%
                    </div>
                  </Panel>
                  <Panel style={{ background: CC.bg, padding: 8 }}>
                    <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted, letterSpacing: 1, marginBottom: 4 }}>MOMENTUM</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: CC.textBright }}>{a.momentumScore}/25</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
                      RSI: {a.rsi.toFixed(0)} ADX: {a.adx.toFixed(0)}<br />
                      RS: {a.rs3m} (3M) {a.rs1m} (1M)
                    </div>
                  </Panel>
                  <Panel style={{ background: CC.bg, padding: 8 }}>
                    <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted, letterSpacing: 1, marginBottom: 4 }}>VOLUME</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: CC.textBright }}>{a.volScore}/25</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
                      Ratio: {a.volRatio.toFixed(2)}x<br />
                      Avg: {(a.avgVol20 / 1e6).toFixed(1)}M
                    </div>
                  </Panel>
                  <Panel style={{ background: CC.bg, padding: 8 }}>
                    <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted, letterSpacing: 1, marginBottom: 4 }}>VOLATILITY</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: CC.textBright }}>{a.ivScore}/25</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
                      HV20: {a.hv20.toFixed(0)}% Rank: {a.hvRank}%<br />
                      {a.ivHint}
                    </div>
                  </Panel>
                </Grid>

                {/* Composite Bar */}
                <div style={{ marginTop: 8 }}>
                  <ProgressBar value={s.score} max={100} label={`Composite: ${s.score}/100`} color={gradeColor} height={10} />
                </div>
              </div>
            )}
          </Panel>
        )
      })}

      {watchlist.length === 0 && (
        <Panel style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontFamily: FONTS.body, fontSize: 14, color: CC.textMuted }}>Add tickers to start building your watchlist</div>
        </Panel>
      )}
    </div>
  )
}
