// ── IDEAS TAB — Trade Idea Generator ──────────────────────────────────────
import { useState, useCallback } from 'react'
import { TIMEFRAME_MODES, TIERS, CC, FONTS, STRATEGIES, SETUP_TYPES } from '../engine/constants.js'
import { analyzeStock } from '../engine/analysis.js'
import { detectSR, detectSetups } from '../engine/detection.js'
import { buildTradeIdea } from '../engine/tradeBuilder.js'
import CandleChart from '../components/CandleChart.jsx'
import { Panel, SectionHeader, Badge, Button, Grid } from '../components/shared.jsx'

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

export default function IdeasTab({ watchlist, apiKey, balance, timeframeMode, onOpenTrade }) {
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [barsCache, setBarsCache] = useState({})

  const mode = TIMEFRAME_MODES[timeframeMode] || TIMEFRAME_MODES.swing
  const tier = getTier(balance)

  const scan = useCallback(async () => {
    if (!apiKey || watchlist.length === 0) return
    setLoading(true)
    setIdeas([])

    try {
      const spyRes = await fetch(`https://api.polygon.io/v2/aggs/ticker/SPY/range/1/day/2025-01-01/${new Date().toISOString().split('T')[0]}?adjusted=true&sort=asc&limit=300&apiKey=${apiKey}`)
      const spyData = await spyRes.json()
      const spyBars = (spyData.results || []).map(r => ({ o: r.o, h: r.h, l: r.l, c: r.c, v: r.v, t: r.t }))

      const allIdeas = []
      const newBarsCache = {}

      for (const ticker of watchlist) {
        try {
          const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/2024-01-01/${new Date().toISOString().split('T')[0]}?adjusted=true&sort=asc&limit=500&apiKey=${apiKey}`)
          const data = await res.json()
          const bars = (data.results || []).map(r => ({ o: r.o, h: r.h, l: r.l, c: r.c, v: r.v, t: r.t }))

          if (bars.length > 50) {
            newBarsCache[ticker] = bars
            const analysis = analyzeStock(bars, spyBars)
            const sr = detectSR(bars, analysis.price)
            const setups = detectSetups(bars, analysis, sr)

            setups.forEach(setup => {
              const idea = buildTradeIdea(ticker, setup, analysis, balance, tier, timeframeMode)
              idea.sr = sr
              idea.bars = bars
              allIdeas.push(idea)
            })
          }
        } catch { /* skip */ }
      }

      setBarsCache(newBarsCache)
      setIdeas(allIdeas.sort((a, b) => b.confidence - a.confidence))
    } catch (err) {
      console.error('Scan error:', err)
    }
    setLoading(false)
  }, [apiKey, watchlist, balance, tier, timeframeMode])

  return (
    <div style={{ padding: 12 }}>
      {/* Timeframe Context Banner */}
      <Panel style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginBottom: 10, borderColor: `${mode.color}30` }}>
        <div>
          <Badge color={mode.color}>{mode.label} MODE</Badge>
          <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginTop: 4 }}>DTE: {mode.tag} • Delta: {mode.deltaRange.join('-')}</div>
        </div>
        <Button onClick={scan} disabled={loading || !apiKey} variant="primary">
          {loading ? 'SCANNING...' : 'SCAN ALL'}
        </Button>
      </Panel>

      {!apiKey && (
        <Panel style={{ textAlign: 'center', padding: 16, marginBottom: 10 }}>
          <div style={{ fontFamily: FONTS.body, fontSize: 13, color: CC.warning }}>Set Polygon.io API key in Settings to scan</div>
        </Panel>
      )}

      {/* Ideas List */}
      {ideas.length === 0 && !loading && (
        <Panel style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontFamily: FONTS.body, fontSize: 14, color: CC.textMuted }}>
            {watchlist.length === 0 ? 'Add tickers to Watchlist first, then scan for ideas' : 'Hit SCAN ALL to analyze watchlist for trade setups'}
          </div>
        </Panel>
      )}

      {ideas.map((idea, idx) => {
        const isExpanded = expanded === idea.id
        const dirColor = idea.direction === 'bullish' ? CC.profit : idea.direction === 'bearish' ? CC.loss : CC.blue
        const confColor = idea.confidence >= 75 ? CC.profit : idea.confidence >= 55 ? CC.accent : CC.warning
        const setupDef = SETUP_TYPES.find(s => s.key === idea.setupType)
        const stratDef = STRATEGIES.find(s => s.key === idea.strategy)

        return (
          <Panel key={idea.id} style={{ marginBottom: 8, padding: 0, overflow: 'hidden' }}>
            {/* Header Row */}
            <div
              onClick={() => setExpanded(isExpanded ? null : idea.id)}
              style={{ padding: '10px 12px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: FONTS.heading, fontSize: 16, fontWeight: 700, color: CC.textBright }}>{idea.ticker}</span>
                  <Badge color={dirColor}>{idea.direction}</Badge>
                  <Badge color={CC.accent}>{setupDef?.label || idea.setupType}</Badge>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700, color: confColor }}>{idea.confidence}%</div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>CONFIDENCE</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
                  {stratDef?.label || idea.strategy} • R:R {idea.rr}:1 • Risk ${idea.riskBudget.toFixed(0)} • HV {idea.hvRank}%
                </span>
                <Badge color={idea.grade.startsWith('A') ? CC.profit : idea.grade.startsWith('B') ? CC.accent : CC.warning} style={{ fontSize: 8 }}>{idea.grade}</Badge>
              </div>
            </div>

            {/* Expanded Detail */}
            {isExpanded && (
              <div style={{ borderTop: `1px solid ${CC.border}`, padding: 12 }}>
                {/* Thesis */}
                <Panel style={{ background: CC.bg, padding: 10, marginBottom: 10 }}>
                  <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted, letterSpacing: 1.5, marginBottom: 4 }}>THESIS</div>
                  <div style={{ fontFamily: FONTS.body, fontSize: 12, color: CC.text, lineHeight: 1.5 }}>{idea.reason}</div>
                </Panel>

                {/* Chart */}
                {idea.bars && (
                  <CandleChart
                    bars={idea.bars}
                    srLevels={[...(idea.sr?.resistance || []).slice(0, 3), ...(idea.sr?.support || []).slice(0, 3)]}
                    entry={idea.entry}
                    stop={idea.stop}
                    target={idea.target}
                    height={280}
                  />
                )}

                {/* Trade Spec Grid */}
                <SectionHeader style={{ marginTop: 10 }}>Trade Spec</SectionHeader>
                <Grid cols={4}>
                  {[
                    { label: 'Entry', value: `$${idea.entry.toFixed(2)}`, color: CC.blue },
                    { label: 'Stop', value: `$${idea.stop.toFixed(2)}`, color: CC.loss },
                    { label: 'Target', value: `$${idea.target.toFixed(2)}`, color: CC.profit },
                    { label: 'R:R', value: `${idea.rr}:1`, color: idea.rr >= 3 ? CC.profit : idea.rr >= 2 ? CC.accent : CC.warning },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>{s.label}</div>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </Grid>

                {/* Options Setup */}
                <SectionHeader style={{ marginTop: 10 }}>Options Setup</SectionHeader>
                <Panel style={{ background: CC.bg, padding: 10 }}>
                  <Grid cols={2}>
                    <div>
                      <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted }}>STRATEGY</div>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.accent }}>{stratDef?.label || idea.strategy}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted }}>MAX RISK</div>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.loss }}>${idea.riskBudget.toFixed(0)}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted }}>DTE</div>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.textBright }}>{idea.dte}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted }}>DELTA</div>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.textBright }}>{idea.delta}</div>
                    </div>
                  </Grid>
                  <div style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.text, marginTop: 8, padding: '6px 8px', background: `${CC.accent}08`, borderRadius: 4 }}>
                    {idea.ivHint}
                  </div>
                </Panel>

                {/* S/R Levels */}
                {idea.sr && (
                  <>
                    <SectionHeader style={{ marginTop: 10 }}>Support / Resistance</SectionHeader>
                    <Grid cols={2}>
                      <Panel style={{ background: CC.bg, padding: 8 }}>
                        <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.loss, letterSpacing: 1, marginBottom: 4 }}>RESISTANCE</div>
                        {(idea.sr.resistance || []).slice(0, 3).map((r, i) => (
                          <div key={i} style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginBottom: 2 }}>
                            ${r.price.toFixed(2)} <span style={{ color: CC.textMuted }}>({r.touches}x)</span>
                          </div>
                        ))}
                        {(!idea.sr.resistance || idea.sr.resistance.length === 0) && <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>None detected</div>}
                      </Panel>
                      <Panel style={{ background: CC.bg, padding: 8 }}>
                        <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.profit, letterSpacing: 1, marginBottom: 4 }}>SUPPORT</div>
                        {(idea.sr.support || []).slice(0, 3).map((s, i) => (
                          <div key={i} style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginBottom: 2 }}>
                            ${s.price.toFixed(2)} <span style={{ color: CC.textMuted }}>({s.touches}x)</span>
                          </div>
                        ))}
                        {(!idea.sr.support || idea.sr.support.length === 0) && <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>None detected</div>}
                      </Panel>
                    </Grid>
                  </>
                )}

                {/* Flags */}
                {idea.flags && idea.flags.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {idea.flags.map((f, i) => (
                      <div key={i} style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.warning, padding: '4px 8px', background: `${CC.warning}08`, borderRadius: 4, marginBottom: 3 }}>
                        ⚠ {f}
                      </div>
                    ))}
                  </div>
                )}

                {/* Open as Trade */}
                <Button onClick={() => onOpenTrade(idea)} variant="primary" style={{ width: '100%', marginTop: 12, padding: '12px' }}>
                  OPEN AS TRADE
                </Button>
              </div>
            )}
          </Panel>
        )
      })}
    </div>
  )
}
