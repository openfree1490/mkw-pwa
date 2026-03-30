// ── GRADING DASHBOARD TAB — Phase 3 ────────────────────────────────────────
import { useState, useCallback } from 'react'
import { CC, FONTS } from '../engine/constants.js'
import { Panel, SectionHeader, Badge, Button, Row, Grid } from '../components/shared.jsx'

const GRADE_COLORS = { A: '#00c176', B: '#e5a318', C: '#8b97b8', F: '#e5334d' }
const SORT_OPTIONS = [
  { key: 'score', label: 'Score' },
  { key: 'type', label: 'Type' },
  { key: 'ticker', label: 'Ticker' },
]

const BACKEND_URL = ''  // Same origin

function ConditionBadge({ label, points, max }) {
  const pct = max > 0 ? points / max : 0
  const color = pct >= 1 ? CC.profit : pct >= 0.5 ? CC.warning : CC.loss
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
      background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 4,
      fontFamily: FONTS.mono, fontSize: 10, color,
    }}>
      <span style={{ fontWeight: 600 }}>{points}/{max}</span>
      <span style={{ fontSize: 9, opacity: 0.8 }}>{label}</span>
    </div>
  )
}

function SetupCard({ stock, onExpand, expanded }) {
  const composite = stock.composite || {}
  const setup = stock.setup || {}
  const levels = stock.levels || {}
  const flags = stock.flags || []
  const conditions = stock.conditions || {}
  const playbook = stock.playbook || {}
  const enrichment = stock.enrichment || {}

  const grade = composite.grade || 'F'
  const score = composite.score || 0
  const gradeColor = GRADE_COLORS[grade] || CC.loss

  return (
    <div style={{
      background: CC.surface, border: `1px solid ${gradeColor}30`, borderRadius: 8,
      marginBottom: 8, overflow: 'hidden',
    }}>
      {/* Summary row */}
      <div
        onClick={() => onExpand(stock.ticker)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Grade badge */}
          <div style={{
            width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: `${gradeColor}20`, border: `2px solid ${gradeColor}`,
          }}>
            <span style={{ fontFamily: FONTS.heading, fontWeight: 800, fontSize: 16, color: gradeColor }}>
              {grade}
            </span>
          </div>
          <div>
            <div style={{ fontFamily: FONTS.heading, fontWeight: 700, fontSize: 14, color: CC.textBright }}>
              {stock.ticker}
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
              {setup.type || '—'} · {setup.ema_level || ''} · {score}/10
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: CC.textBright }}>
            ${levels.price?.toFixed(2) || '—'}
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
            {composite.eligibleTiers?.length > 0 ? `T${composite.eligibleTiers.join(',')}` : '—'}
          </div>
        </div>
      </div>

      {/* Condition scores row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 12px 8px' }}>
        <ConditionBadge label="RS" points={conditions.c1_rs_ranking?.points || 0} max={2} />
        <ConditionBadge label="RSL" points={conditions.c2_rs_line_behavior?.points || 0} max={2} />
        <ConditionBadge label="DRY" points={conditions.c3_volume_dryup?.points || 0} max={2} />
        <ConditionBadge label="VOL" points={conditions.c4_volume_expansion?.points || 0} max={1} />
        <ConditionBadge label="ADR" points={conditions.c5_adr_range?.points || 0} max={1} />
        <ConditionBadge label="HTF" points={conditions.c6_htf_alignment?.points || 0} max={2} />
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {flags.map((f, i) => (
            <span key={i} style={{
              fontFamily: FONTS.mono, fontSize: 9, padding: '2px 6px', borderRadius: 3,
              background: `${CC.warning}15`, color: CC.warning, border: `1px solid ${CC.warning}30`,
            }}>⚠ {f}</span>
          ))}
        </div>
      )}

      {/* Expanded Detail */}
      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${CC.border}` }}>
          {/* Setup detail */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>
              SETUP DETAIL
            </div>
            <div style={{ fontFamily: FONTS.body, fontSize: 12, color: CC.text, lineHeight: 1.5 }}>
              {setup.detail || 'No detail available'}
            </div>
          </div>

          {/* Key Levels */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>
              KEY LEVELS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { label: 'EMA 10', val: levels.ema10 },
                { label: 'EMA 20', val: levels.ema20 },
                { label: 'Stop', val: levels.stop, color: CC.loss },
                { label: 'Target', val: levels.target1, color: CC.profit },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: CC.bg, borderRadius: 4, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>{label}</div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600, color: color || CC.textBright }}>
                    ${val?.toFixed(2) || '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Enrichment */}
          {enrichment.earnings_proximity?.within14Days && (
            <div style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 4,
              background: `${CC.warning}10`, border: `1px solid ${CC.warning}30`,
              fontFamily: FONTS.mono, fontSize: 10, color: CC.warning,
            }}>
              ⚠ Earnings in {enrichment.earnings_proximity.daysAway} days ({enrichment.earnings_proximity.date})
            </div>
          )}

          {enrichment.sector_performance?.sector && (
            <div style={{ marginTop: 6, fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
              Sector: {enrichment.sector_performance.sector} ({enrichment.sector_performance.etf}) — {enrichment.sector_performance.verdict}
              {enrichment.sector_performance.return_1w != null && ` | 1W: ${enrichment.sector_performance.return_1w}%`}
            </div>
          )}

          {enrichment.week52_proximity?.pctFromHigh != null && (
            <div style={{ marginTop: 4, fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
              52W: {enrichment.week52_proximity.pctFromHigh}% from high · {enrichment.week52_proximity.pctFromLow}% from low · {enrichment.week52_proximity.verdict}
            </div>
          )}

          {enrichment.float_cap?.marketCapFormatted && (
            <div style={{ marginTop: 4, fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
              {enrichment.float_cap.capClass} · {enrichment.float_cap.marketCapFormatted} · {enrichment.float_cap.industry || ''}
            </div>
          )}

          {/* Playbook */}
          {playbook && playbook.trades && playbook.trades.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>
                OPTIONS PLAYBOOK
              </div>
              {playbook.trades.map((trade, i) => (
                <div key={i} style={{
                  background: CC.bg, borderRadius: 6, padding: '8px 10px', marginBottom: 6,
                  border: `1px solid ${CC.border}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{
                      fontFamily: FONTS.heading, fontSize: 10, fontWeight: 700, letterSpacing: 1,
                      padding: '2px 6px', borderRadius: 3,
                      background: `${CC.accent}15`, color: CC.accent,
                    }}>
                      TIER {trade.tier} — {trade.tierName}
                    </span>
                    <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
                      Risk: {trade.riskPct}
                    </span>
                  </div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textBright, marginBottom: 4 }}>
                    {trade.direction} {trade.optionType.toUpperCase()} · ${trade.strike} · {trade.dte}
                  </div>
                  <div style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.text, lineHeight: 1.4 }}>
                    {trade.thesis}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Short trades */}
          {playbook && playbook.shortTrades && playbook.shortTrades.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{
                fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                color: CC.loss, textTransform: 'uppercase', marginBottom: 6,
              }}>
                SHORT THESIS
              </div>
              {playbook.shortTrades.map((trade, i) => (
                <div key={i} style={{
                  background: `${CC.loss}08`, borderRadius: 6, padding: '8px 10px', marginBottom: 6,
                  border: `1px solid ${CC.loss}20`,
                }}>
                  <div style={{ fontFamily: FONTS.heading, fontSize: 10, fontWeight: 700, color: CC.loss, marginBottom: 4 }}>
                    TIER {trade.tier} — {trade.tierName}
                  </div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textBright, marginBottom: 4 }}>
                    {trade.direction} {trade.optionType.toUpperCase()} · ${trade.strike} · {trade.dte}
                  </div>
                  <div style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.text, lineHeight: 1.4 }}>
                    {trade.thesis}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Condition Details */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>
              CONDITION BREAKDOWN
            </div>
            {Object.entries(conditions).map(([key, cond]) => {
              const labels = {
                c1_rs_ranking: 'C1: Relative Strength Ranking',
                c2_rs_line_behavior: 'C2: RS Line During Pullback',
                c3_volume_dryup: 'C3: Volume Dry-Up Ratio',
                c4_volume_expansion: 'C4: Bounce/Breakout Volume',
                c5_adr_range: 'C5: ADR% Range',
                c6_htf_alignment: 'C6: HTF Alignment',
              }
              const pts = cond?.points || 0
              const mx = cond?.max || 1
              const pct = mx > 0 ? pts / mx : 0
              const color = pct >= 1 ? CC.profit : pct >= 0.5 ? CC.warning : CC.loss

              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 0', borderBottom: `1px solid ${CC.border}40`,
                }}>
                  <span style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.text }}>
                    {labels[key] || key}
                  </span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600, color }}>
                    {pts}/{mx}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function GradingTab({ watchlist, apiKey }) {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [sortBy, setSortBy] = useState('score')
  const [filterType, setFilterType] = useState('all')
  const [filterGrade, setFilterGrade] = useState('all')
  const [tickerInput, setTickerInput] = useState('')
  const [error, setError] = useState(null)

  const fetchGrades = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tickers = watchlist.length > 0 ? watchlist.join(',') : ''
      const url = tickers
        ? `${BACKEND_URL}/api/entry-grade-watchlist?tickers=${tickers}`
        : `${BACKEND_URL}/api/entry-grade-watchlist`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setStocks(data.stocks || [])
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [watchlist])

  const addAndGrade = async () => {
    const tk = tickerInput.trim().toUpperCase()
    if (!tk) return
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/entry-grade/${tk}`)
      const data = await res.json()
      if (!data.error) {
        setStocks(prev => {
          const filtered = prev.filter(s => s.ticker !== tk)
          return [data, ...filtered].sort((a, b) => (b.composite?.score || 0) - (a.composite?.score || 0))
        })
      }
    } catch (e) {
      setError(e.message)
    }
    setTickerInput('')
    setLoading(false)
  }

  const toggleExpand = (ticker) => {
    setExpanded(prev => prev === ticker ? null : ticker)
  }

  // Filtering & sorting
  let filtered = [...stocks]
  if (filterType !== 'all') filtered = filtered.filter(s => (s.setup?.type || '') === filterType)
  if (filterGrade !== 'all') filtered = filtered.filter(s => (s.composite?.grade || '') === filterGrade)
  if (sortBy === 'score') filtered.sort((a, b) => (b.composite?.score || 0) - (a.composite?.score || 0))
  else if (sortBy === 'ticker') filtered.sort((a, b) => (a.ticker || '').localeCompare(b.ticker || ''))
  else if (sortBy === 'type') filtered.sort((a, b) => (a.setup?.type || '').localeCompare(b.setup?.type || ''))

  const stats = {
    total: stocks.length,
    a: stocks.filter(s => s.composite?.grade === 'A').length,
    b: stocks.filter(s => s.composite?.grade === 'B').length,
    c: stocks.filter(s => s.composite?.grade === 'C').length,
    f: stocks.filter(s => s.composite?.grade === 'F').length,
  }

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: FONTS.heading, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: CC.accent, textTransform: 'uppercase', marginBottom: 8 }}>
          ENTRY CRITERIA GRADING
        </div>

        {/* Add ticker + scan button */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            value={tickerInput}
            onChange={e => setTickerInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addAndGrade()}
            placeholder="Add ticker..."
            style={{
              flex: 1, padding: '8px 10px', fontFamily: FONTS.mono, fontSize: 12,
              color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
              borderRadius: 6,
            }}
          />
          <button onClick={addAndGrade} disabled={loading} style={{
            fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
            padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
            background: CC.accent, color: CC.bg, border: 'none', textTransform: 'uppercase',
            opacity: loading ? 0.5 : 1,
          }}>GRADE</button>
          <button onClick={fetchGrades} disabled={loading} style={{
            fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
            padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
            background: `${CC.accent}15`, color: CC.accent, border: `1px solid ${CC.accent}40`,
            textTransform: 'uppercase', opacity: loading ? 0.5 : 1,
          }}>SCAN ALL</button>
        </div>

        {/* Stats bar */}
        {stocks.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {[
              { label: 'A', count: stats.a, color: GRADE_COLORS.A },
              { label: 'B', count: stats.b, color: GRADE_COLORS.B },
              { label: 'C', count: stats.c, color: GRADE_COLORS.C },
              { label: 'F', count: stats.f, color: GRADE_COLORS.F },
            ].map(({ label, count, color }) => (
              <div key={label} style={{
                flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 4,
                background: `${color}15`, border: `1px solid ${color}30`,
              }}>
                <div style={{ fontFamily: FONTS.heading, fontSize: 14, fontWeight: 800, color }}>{count}</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 8, color }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Sort & Filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
            padding: '4px 8px', fontFamily: FONTS.mono, fontSize: 10,
            background: CC.bg, color: CC.text, border: `1px solid ${CC.border}`,
            borderRadius: 4,
          }}>
            {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>

          {/* Filter by type */}
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{
            padding: '4px 8px', fontFamily: FONTS.mono, fontSize: 10,
            background: CC.bg, color: CC.text, border: `1px solid ${CC.border}`,
            borderRadius: 4,
          }}>
            <option value="all">All Types</option>
            <option value="pullback">Pullback</option>
            <option value="breakout">Breakout</option>
            <option value="breakdown">Breakdown</option>
          </select>

          {/* Filter by grade */}
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{
            padding: '4px 8px', fontFamily: FONTS.mono, fontSize: 10,
            background: CC.bg, color: CC.text, border: `1px solid ${CC.border}`,
            borderRadius: 4,
          }}>
            <option value="all">All Grades</option>
            <option value="A">A Only</option>
            <option value="B">B Only</option>
            <option value="C">C Only</option>
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 30, fontFamily: FONTS.mono, fontSize: 12, color: CC.textMuted }}>
          Scanning and grading... This may take a moment.
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: 12, background: `${CC.loss}10`, border: `1px solid ${CC.loss}30`, borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11, color: CC.loss, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Stock cards */}
      {!loading && filtered.map(stock => (
        <SetupCard
          key={stock.ticker}
          stock={stock}
          expanded={expanded === stock.ticker}
          onExpand={toggleExpand}
        />
      ))}

      {!loading && stocks.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: 40, fontFamily: FONTS.body, fontSize: 12, color: CC.textMuted }}>
          Add tickers above or click SCAN ALL to grade your watchlist using the 6-condition entry criteria engine.
        </div>
      )}
    </div>
  )
}
