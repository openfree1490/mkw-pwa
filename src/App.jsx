import { useState, useEffect, useCallback, Component } from 'react'
import ChallengeApp from './challenge/ChallengeApp.jsx'
import { colors, fonts, radius, shadows, transitions, gradeColor as _gradeColor, zoneColor as _zoneColor } from './config/theme.js'

// ── DESIGN TOKENS (mapped from theme) ────────────────────────────────────
const C = {
  bg: colors.bg.root, panel: colors.bg.surface, raised: colors.bg.elevated,
  border: colors.border.subtle, borderHi: colors.border.default,
  green: colors.signal.profit, red: colors.signal.loss, gold: colors.accent.warning,
  blue: colors.accent.info, purple: colors.accent.secondary,
  textBright: colors.text.primary, text: colors.text.secondary, textDim: colors.text.tertiary,
}
const FO = fonts.heading
const FR = fonts.body
const FM = fonts.mono

const gradeColor = _gradeColor
const zoneColor = _zoneColor

// ── GLOBAL CSS ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
html,body,#root{height:100%;width:100%;background:${C.bg};overflow:hidden;scroll-behavior:smooth}
body{overscroll-behavior:none}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
button{cursor:pointer;border:none;background:none;-webkit-tap-highlight-color:transparent}
input,select,textarea{outline:none;-webkit-appearance:none}
*:focus-visible{outline:2px solid ${colors.accent.primary};outline-offset:2px}
`

// ── REUSABLE PRIMITIVES ───────────────────────────────────────────────────

const DataStatusBar = () => {
  const [status, setStatus] = useState(null)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    api('/api/data-status').then(setStatus).catch(() => {})
    const interval = setInterval(() => api('/api/data-status').then(setStatus).catch(() => {}), 60000)
    return () => clearInterval(interval)
  }, [])
  if (!status) return null
  const q = status.quality || 'BASIC'
  const qColor = q === 'STANDARD' ? C.green : C.gold
  return (
    <div>
      <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '3px 8px', background: C.bg, borderBottom: `1px solid ${C.border}22`, cursor: 'pointer' }}>
        <span style={{ fontFamily: FM, fontSize: 9, color: status.polygon?.connected ? C.green : C.textDim }}>[POLY: {status.polygon?.connected ? 'OK' : 'OFF'}]</span>
        <span style={{ fontFamily: FM, fontSize: 9, color: status.finra?.ok ? C.green : C.textDim }}>[FINRA: {status.finra?.ok ? 'FRESH' : 'PENDING'}]</span>
        <span style={{ fontFamily: FM, fontSize: 9, color: status.fred?.connected ? C.green : C.textDim }}>[FRED: {status.fred?.connected ? 'OK' : 'OFF'}]</span>
        <span style={{ fontFamily: FM, fontSize: 9, color: qColor }}>{q}</span>
      </div>
      {expanded && (
        <div style={{ padding: 10, background: C.panel, borderBottom: `1px solid ${C.border}`, animation: 'fadeIn 0.15s ease' }}>
          <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', color: C.textDim, marginBottom: 6, textTransform: 'uppercase' }}>DATA SOURCES</div>
          {[
            { name: 'Polygon.io', key: 'polygon', detail: status.polygon?.connected ? 'Connected — primary data' : 'Not configured' },
            { name: 'FINRA', key: 'finra', detail: status.finra?.ok ? `${status.finra.data_tickers || 0} tickers tracked` : 'Pending download' },
            { name: 'FRED', key: 'fred', detail: status.fred?.connected ? 'Connected — macro data' : 'Not configured' },
            { name: 'yfinance', key: 'yfinance', detail: 'Fallback active' },
          ].map(s => (
            <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}22` }}>
              <span style={{ fontFamily: FM, fontSize: 10, color: C.textBright }}>{s.name}</span>
              <span style={{ fontFamily: FM, fontSize: 10, color: (status[s.key]?.ok || status[s.key]?.connected) ? C.green : C.textDim }}>{s.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const Loading = ({ text = 'SCANNING...' }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, flexDirection: 'column', gap: 12 }}>
    <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 13, letterSpacing: '0.06em', color: C.blue, animation: 'pulse 1.5s infinite' }}>{text}</div>
  </div>
)

const ErrorMsg = ({ msg, onRetry }) => (
  <div style={{ padding: 20, textAlign: 'center' }}>
    <div style={{ fontFamily: FR, fontSize: 13, color: C.red, marginBottom: 12 }}>{msg || 'Error loading data'}</div>
    {onRetry && <button onClick={onRetry} style={{ fontFamily: FO, fontWeight: 600, fontSize: 12, letterSpacing: '0.02em', color: colors.accent.primary, padding: '8px 18px', border: `1px solid ${colors.accent.primary}`, borderRadius: radius.sm, background: 'transparent', textTransform: 'uppercase' }}>RETRY</button>}
  </div>
)

const EmptyState = ({ text }) => (
  <div style={{ padding: 30, textAlign: 'center' }}>
    <div style={{ fontFamily: FR, fontSize: 14, fontWeight: 500, color: C.textDim, lineHeight: 1.6 }}>{text || "No AAA setups today. Capital preservation IS a position."}</div>
  </div>
)

const Panel = ({ children, style, borderColor, glow: _glow }) => (
  <div style={{
    background: C.panel, borderRadius: radius.lg, border: `1px solid ${borderColor || C.border}`,
    overflow: 'hidden', ...style,
  }}>{children}</div>
)

const SectionHeader = ({ title, right, onClick, expanded }) => (
  <div onClick={onClick} style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', cursor: onClick ? 'pointer' : 'default',
    borderBottom: `1px solid ${C.border}`,
  }}>
    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 14, color: C.textBright }}>{title}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {right}
      {onClick != null && <span style={{ fontSize: 11, color: C.textDim }}>{expanded ? '\u25B2' : '\u25BC'}</span>}
    </div>
  </div>
)

const Collapsible = ({ title, right, children, defaultOpen = false, borderColor }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Panel borderColor={borderColor} style={{ marginBottom: 10 }}>
      <SectionHeader title={title} right={right} onClick={() => setOpen(!open)} expanded={open} />
      {open && <div style={{ animation: 'fadeIn 0.2s ease' }}>{children}</div>}
    </Panel>
  )
}

const Pct = ({ v, size = 13 }) => {
  if (v == null || isNaN(v)) return <span style={{ color: C.textDim, fontSize: size, fontFamily: FM }}>—</span>
  const n = Number(v)
  const c = n >= 0 ? C.green : C.red
  return <span style={{ color: c, fontSize: size, fontFamily: FM }}>{n >= 0 ? '+' : ''}{n.toFixed(2)}%</span>
}

const Mono = ({ children, color, size = 12, style: s }) => (
  <span style={{ fontFamily: FM, fontSize: size, color: color || C.textBright, ...s }}>{children}</span>
)

const GradeBadge = ({ grade, size = 22 }) => {
  const c = gradeColor(grade)
  return (
    <span style={{ fontFamily: FM, fontWeight: 700, fontSize: size, color: c, letterSpacing: '0.02em' }}>
      {grade || '—'}
    </span>
  )
}

const ZoneBadge = ({ zone }) => {
  const c = zoneColor(zone)
  return (
    <span style={{
      fontFamily: FO, fontWeight: 600, fontSize: 10, letterSpacing: '0.04em',
      color: c, padding: '3px 10px', textTransform: 'uppercase',
      border: `1px solid ${c}40`, borderRadius: radius.sm, background: `${c}18`,
    }}>{zone || 'WATCH'}</span>
  )
}

const TabBar = ({ tabs, active, onSelect }) => (
  <div style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: `1px solid ${C.border}`, padding: '0 8px' }}>
    {tabs.map(t => (
      <button key={t} onClick={() => onSelect(t)} style={{
        fontFamily: FO, fontWeight: active === t ? 600 : 500, fontSize: 13,
        color: active === t ? C.textBright : C.textDim, padding: '12px 18px', flexShrink: 0,
        borderBottom: active === t ? `2px solid ${colors.accent.primary}` : '2px solid transparent',
        transition: transitions.normal,
      }}>{t}</button>
    ))}
  </div>
)

const TrafficLight = ({ color }) => {
  const c = color === 'green' ? C.green : color === 'red' ? C.red : C.gold
  return (
    <div style={{
      width: 12, height: 12, borderRadius: '50%', background: c, flexShrink: 0,
    }} />
  )
}

const BarChart = ({ data, maxWidth = 200 }) => {
  if (!data || data.length === 0) return null
  const maxVal = Math.max(...data.map(d => Math.abs(d.value || 0)), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: FM, fontSize: 10, color: C.text, width: 50, textAlign: 'right', flexShrink: 0 }}>{d.label}</div>
          <div style={{ flex: 1, height: 8, background: C.raised, borderRadius: 4, overflow: 'hidden', maxWidth }}>
            <div style={{
              width: `${Math.abs(d.value || 0) / maxVal * 100}%`, height: '100%',
              background: (d.value || 0) >= 0 ? C.green : C.red, borderRadius: 4,
              transition: 'width 0.4s',
            }} />
          </div>
          <Mono size={10} color={(d.value || 0) >= 0 ? C.green : C.red}>{d.value != null ? `${d.value >= 0 ? '+' : ''}${Number(d.value).toFixed(1)}%` : '—'}</Mono>
        </div>
      ))}
    </div>
  )
}

// ── FETCH HELPER ──────────────────────────────────────────────────────────
const api = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
const apiPost = async (url, body) => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
const apiPut = async (url, body) => {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
const apiDelete = async (url) => {
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// ── HOOK: useFetch ────────────────────────────────────────────────────────
function useFetch(url, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const load = useCallback(async () => {
    if (!url) { setLoading(false); return }
    setLoading(true); setError(null)
    try { const d = await api(url); setData(d) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [url, ...deps])
  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load, setData }
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: HOME — Command Center
// ═══════════════════════════════════════════════════════════════════════════
function HomePage() {
  const { data: watchlist, loading: wl, error: we, reload: wr } = useFetch('/api/watchlist')
  const { data: breadth, loading: bl, error: be } = useFetch('/api/breadth')
  const { data: threats } = useFetch('/api/threats')
  const { data: macroData } = useFetch('/api/macro')

  if (wl || bl) return <Loading />
  if (we) return <ErrorMsg msg={we} onRetry={wr} />

  const items = Array.isArray(watchlist) ? watchlist : (watchlist?.watchlist || watchlist?.stocks || watchlist?.items || [])
  const sorted = [...items].sort((a, b) => (b.convergence_score || b.score || 0) - (a.convergence_score || a.score || 0))
  const convergence = sorted.filter(s => (s.zone || '').toUpperCase().includes('CONVERGENCE'))
  const secondary = sorted.filter(s => (s.zone || '').toUpperCase().includes('SECONDARY'))
  const building = sorted.filter(s => (s.zone || '').toUpperCase().includes('BUILDING'))
  const topSetup = sorted[0]
  const hasAAA = sorted.some(s => String(s.grade || '').toUpperCase() === 'AAA')

  const bd = breadth || {}
  const spx = bd.spx || bd.spy || bd.SPY || {}
  const ndx = bd.ndx || bd.qqq || bd.QQQ || {}
  const rut = bd.rut || bd.iwm || bd.IWM || {}
  const vix = bd.vix ?? bd.VIX ?? '—'
  const templateCount = bd.template_count ?? bd.qualifier_count ?? items.filter(s => (s.template_score || 0) >= 7).length
  const spxStage = String(spx.stage ?? spx.stageLabel ?? '')
  const kellLight = spxStage.includes('2') ? 'green' : spxStage.includes('3') || spxStage.includes('4') ? 'red' : 'yellow'

  const sectorData = bd.sectors || bd.sector_performance || []
  const sectorBars = (Array.isArray(sectorData) ? sectorData : Object.entries(sectorData).map(([k, v]) => ({ label: k, value: typeof v === 'number' ? v : v?.change || 0 }))).map(s => ({ label: s.n || s.name || s.sector || s.label || s.etf || '?', value: s.p ?? s.change ?? s.performance ?? s.value ?? 0 })).slice(0, 11)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
      {/* Market Regime */}
      <Panel borderColor={C.border}>
        <SectionHeader title="MARKET REGIME" right={<TrafficLight color={kellLight} />} />
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[{ label: 'SPX', d: spx }, { label: 'NDX', d: ndx }, { label: 'RUT', d: rut }].map(({ label, d }) => (
              <div key={label} style={{ background: C.raised, borderRadius: 6, padding: 8, textAlign: 'center' }}>
                <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 14, color: C.textBright }}>{d.stageLabel || d.weinstein_stage || d.stage || '—'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim }}>VIX</div>
              <Mono size={16} color={Number(vix) > 25 ? C.red : Number(vix) > 18 ? C.gold : C.green}>{typeof vix === 'number' ? vix.toFixed(1) : vix}</Mono>
            </div>
            <div>
              <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim }}>TEMPLATES</div>
              <Mono size={16} color={C.blue}>{templateCount}</Mono>
            </div>
            <div>
              <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim }}>KELL LIGHT</div>
              <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 14, color: kellLight === 'green' ? C.green : kellLight === 'red' ? C.red : C.gold }}>{kellLight.toUpperCase()}</div>
            </div>
          </div>
          {/* Environment Verdict */}
          <div style={{ background: C.raised, borderRadius: 6, padding: 10 }}>
            <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 4 }}>ENVIRONMENT VERDICT</div>
            <div style={{ fontFamily: FR, fontWeight: 600, fontSize: 13, color: kellLight === 'green' ? C.green : kellLight === 'red' ? C.red : C.gold, lineHeight: 1.5 }}>
              {kellLight === 'green' ? 'Favorable. Full position sizing permitted. Deploy into A+ setups.' : kellLight === 'red' ? 'Hostile. Reduce exposure 50-75%. Only AAA convergence plays.' : 'Caution. Half position sizes. Tighten stops.'}
            </div>
          </div>
        </div>
      </Panel>

      {/* Macro Backdrop */}
      {macroData?.score && (
        <Panel borderColor={macroData.score.color === 'green' ? C.green : macroData.score.color === 'red' ? C.red : macroData.score.color === 'orange' ? C.gold : C.border}>
          <SectionHeader title="MACRO BACKDROP" right={<Mono size={11} color={macroData.score.color === 'green' ? C.green : macroData.score.color === 'red' ? C.red : C.gold}>{macroData.score.regime}</Mono>} />
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim }}>MACRO SCORE</div>
                <Mono size={20} color={macroData.score.color === 'green' ? C.green : macroData.score.color === 'red' ? C.red : C.gold}>{macroData.score.score}/10</Mono>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim }}>SIZING</div>
                <Mono size={11} color={C.text}>{macroData.score.sizing}</Mono>
              </div>
            </div>
            {macroData.rates && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {macroData.rates.ten_year != null && <div style={{ background: C.raised, borderRadius: 4, padding: 6, textAlign: 'center' }}><div style={{ fontFamily: FO, fontWeight: 600, fontSize: 10, letterSpacing: "0.06em", color: C.textDim }}>10Y</div><Mono size={12}>{Number(macroData.rates.ten_year).toFixed(2)}%</Mono></div>}
                {macroData.rates.two_year != null && <div style={{ background: C.raised, borderRadius: 4, padding: 6, textAlign: 'center' }}><div style={{ fontFamily: FO, fontWeight: 600, fontSize: 10, letterSpacing: "0.06em", color: C.textDim }}>2Y</div><Mono size={12}>{Number(macroData.rates.two_year).toFixed(2)}%</Mono></div>}
                {macroData.rates.yield_curve != null && <div style={{ background: C.raised, borderRadius: 4, padding: 6, textAlign: 'center' }}><div style={{ fontFamily: FO, fontWeight: 600, fontSize: 10, letterSpacing: "0.06em", color: C.textDim }}>CURVE</div><Mono size={12} color={Number(macroData.rates.yield_curve) > 0 ? C.green : C.red}>{Number(macroData.rates.yield_curve).toFixed(2)}</Mono></div>}
              </div>
            )}
            {macroData.events && macroData.events.length > 0 && (
              <div>
                <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 10, letterSpacing: "0.06em", color: C.textDim, marginBottom: 4 }}>UPCOMING EVENTS</div>
                {macroData.events.slice(0, 3).map((e, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <Mono size={10} color={e.imminent ? C.red : C.text}>{e.name}</Mono>
                    <Mono size={10} color={e.imminent ? C.red : C.textDim}>{e.days_until === 0 ? 'TODAY' : e.days_until === 1 ? 'TOMORROW' : `${e.days_until}d`}</Mono>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* No AAA Banner */}
      {!hasAAA && (
        <div style={{ background: `${C.gold}11`, border: `1px solid ${C.gold}44`, borderRadius: 8, padding: 14, textAlign: 'center' }}>
          <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: "0.04em", color: C.gold }}>NO AAA SETUPS</div>
          <div style={{ fontFamily: FR, fontWeight: 500, fontSize: 12, color: C.text, marginTop: 4 }}>Capital preservation IS a position.</div>
        </div>
      )}

      {/* Convergence Radar */}
      <Panel>
        <SectionHeader title="CONVERGENCE RADAR" right={<Mono size={10} color={C.textDim}>{sorted.length} names</Mono>} />
        <div style={{ padding: 8, maxHeight: 300, overflowY: 'auto' }}>
          {sorted.length === 0 && <EmptyState text="No names in radar." />}
          {[{ label: 'CONVERGENCE', items: convergence, color: C.gold }, { label: 'SECONDARY', items: secondary, color: C.blue }, { label: 'BUILDING', items: building, color: C.purple }].map(({ label, items: group, color }) => group.length > 0 && (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", color, padding: '4px 8px' }}>{label}</div>
              {group.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderBottom: `1px solid ${C.border}22` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: FM, fontWeight: 700, fontSize: 14, color: C.textBright }}>{s.ticker || s.symbol}</span>
                    <GradeBadge grade={s.grade} size={11} />
                  </div>
                  <Mono size={11} color={color}>{s.convergence_score ?? s.score ?? '—'}/23</Mono>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Panel>

      {/* Top Setup Card */}
      {topSetup && (
        <Panel borderColor={gradeColor(topSetup.grade)} glow={gradeColor(topSetup.grade)}>
          <SectionHeader title="TOP SETUP" />
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 22, color: C.textBright }}>{topSetup.ticker || topSetup.symbol}</div>
                <div style={{ fontFamily: FR, fontWeight: 500, fontSize: 12, color: C.text }}>{topSetup.name || topSetup.company || ''}</div>
              </div>
              <GradeBadge grade={topSetup.grade} size={32} />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div><div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim }}>PRICE</div><Mono size={14}>${topSetup.price != null ? Number(topSetup.price).toFixed(2) : '—'}</Mono></div>
              <div><div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim }}>SCORE</div><Mono size={14} color={zoneColor(topSetup.zone)}>{topSetup.convergence_score ?? topSetup.score ?? '—'}/23</Mono></div>
              <div><div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim }}>ZONE</div><ZoneBadge zone={topSetup.zone} /></div>
              <div><div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim }}>STAGE</div><Mono size={14}>{topSetup.stage || topSetup.weinstein_stage || '—'}</Mono></div>
            </div>
          </div>
        </Panel>
      )}

      {/* Sector Heat Map */}
      {sectorBars.length > 0 && (
        <Panel>
          <SectionHeader title="SECTOR HEAT MAP" />
          <div style={{ padding: 12 }}>
            <BarChart data={sectorBars} />
          </div>
        </Panel>
      )}

      {/* Qullamaggie Momentum Alerts */}
      {(() => {
        const qullTriggering = sorted.filter(s => s.qull_any_triggering)
        const qullDual = sorted.filter(s => s.qull_dual_convergence)
        const qullSetups = sorted.filter(s => s.qull_any_setup && !s.qull_any_triggering)
        if (qullDual.length === 0 && qullTriggering.length === 0 && qullSetups.length === 0) return null
        return (
          <Panel borderColor={qullDual.length > 0 ? C.gold : qullTriggering.length > 0 ? C.gold : C.blue}>
            <SectionHeader title="MOMENTUM SETUPS" right={<Mono size={10} color={C.gold}>{qullTriggering.length + qullDual.length} active</Mono>} />
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {qullDual.map((s, i) => (
                <div key={`dc-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.border}22` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: FM, fontWeight: 700, fontSize: 14, color: C.gold }}>{s.ticker}</span>
                    <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.02em", color: C.bg, background: C.gold, padding: '1px 5px', borderRadius: 2 }}>DUAL CONV</span>
                  </div>
                  <Mono size={10} color={C.gold}>{s.qull_best_score}/100</Mono>
                </div>
              ))}
              {qullTriggering.filter(s => !s.qull_dual_convergence).map((s, i) => (
                <div key={`tr-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.border}22` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: FM, fontWeight: 700, fontSize: 14, color: C.textBright }}>{s.ticker}</span>
                    <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.02em", color: C.bg, background: C.green, padding: '1px 5px', borderRadius: 2 }}>TRIGGERING</span>
                    <Mono size={9} color={C.textDim}>{s.qull_best_setup?.replace('_', ' ')}</Mono>
                  </div>
                  <Mono size={10} color={C.green}>{s.qull_best_score}/100</Mono>
                </div>
              ))}
              {qullSetups.slice(0, 3).map((s, i) => (
                <div key={`ws-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${C.border}11` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mono size={11}>{s.ticker}</Mono>
                    <Mono size={9} color={C.textDim}>{s.qull_best_setup?.replace('_', ' ')}</Mono>
                  </div>
                  <Mono size={9} color={C.textDim}>{s.qull_best_score}/100</Mono>
                </div>
              ))}
            </div>
          </Panel>
        )
      })()}

      {/* Threats */}
      {threats && Array.isArray(threats) && threats.length > 0 && (
        <Panel borderColor={C.red}>
          <SectionHeader title="DIVERGENCE THREATS" />
          <div style={{ padding: 10 }}>
            {threats.map((t, i) => (
              <div key={i} style={{ fontFamily: FR, fontSize: 12, color: C.red, padding: '3px 0', borderBottom: `1px solid ${C.border}22` }}>{typeof t === 'string' ? t : (t.message || t.description || JSON.stringify(t))}</div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: WATCH — Watchlist
// ═══════════════════════════════════════════════════════════════════════════
// ── Stock Card Component (shared between watchlist and scanners) ──
function StockCard({ s, expanded, onToggle, techCache, srCache, onLoadDetails }) {
  const ticker = s.ticker || s.symbol || '???'
  const isOpen = expanded
  const tech = techCache
  const sr = srCache
  const checklist = s.checklist || s.convergence_checklist || []

  const handleClick = () => {
    onToggle(ticker)
    if (!isOpen && !tech) onLoadDetails(ticker)
  }

  return (
    <Panel key={ticker} borderColor={isOpen ? zoneColor(s.zone) : C.border} glow={isOpen ? zoneColor(s.zone) : undefined}>
      <div onClick={handleClick} style={{ padding: 12, cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 18, color: C.textBright }}>{ticker}</span>
            <GradeBadge grade={s.grade} size={16} />
            <ZoneBadge zone={s.zone} />
          </div>
          <Mono size={15} color={C.textBright}>${s.price != null ? Number(s.price).toFixed(2) : '—'}</Mono>
        </div>
        <div style={{ fontFamily: FR, fontWeight: 500, fontSize: 11, color: C.textDim, marginBottom: 6 }}>{s.name || s.company || ''}</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.03em", color: C.textDim }}>DAY </span><Pct v={s.day_change ?? s.change_1d} size={11} /></div>
          <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.03em", color: C.textDim }}>WK </span><Pct v={s.week_change ?? s.change_1w} size={11} /></div>
          <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.03em", color: C.textDim }}>MO </span><Pct v={s.month_change ?? s.change_1m} size={11} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <Mono size={10} color={C.textDim}>Score: <span style={{ color: zoneColor(s.zone) }}>{s.convergence_score ?? s.score ?? '—'}/23</span></Mono>
          <Mono size={10} color={C.textDim}>Stage: {s.stage || s.weinstein_stage || '—'}</Mono>
          <Mono size={10} color={C.textDim}>TPL: {s.template_score ?? s.minervini_score ?? '—'}/8</Mono>
          <Mono size={10} color={C.textDim}>RS: {s.rs ?? s.relative_strength ?? '—'}</Mono>
          <Mono size={10} color={C.textDim}>Kell: {s.kell_phase ?? s.phase ?? '—'}</Mono>
          {s.finra?.svr_today != null && <Mono size={10} color={s.finra.color === 'green' ? C.green : s.finra.color === 'red' ? C.red : s.finra.color === 'yellow' ? C.gold : C.textDim}>SVR: {s.finra.svr_today}%</Mono>}
        </div>
        {(s.vcp || s.vcp_detected) && <div style={{ marginTop: 4 }}><Mono size={10} color={C.purple}>VCP Detected — {s.vcp_contractions || s.contractions || '?'} contractions</Mono></div>}
        {s.qull_dual_convergence && <div style={{ marginTop: 4 }}><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.02em", color: C.bg, background: C.gold, padding: '1px 6px', borderRadius: 2 }}>DUAL CONVERGENCE</span></div>}
        {s.qull_any_triggering && !s.qull_dual_convergence && <div style={{ marginTop: 4 }}><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.02em", color: C.bg, background: C.green, padding: '1px 6px', borderRadius: 2 }}>Q: {s.qull_best_setup?.replace('_', ' ')} TRIGGERING</span><Mono size={9} color={C.textDim}> {s.qull_best_score}/100</Mono></div>}
        {s.qull_any_setup && !s.qull_any_triggering && <div style={{ marginTop: 4 }}><Mono size={9} color={C.blue}>Q: {s.qull_best_setup?.replace('_', ' ')} ({s.qull_best_score}/100)</Mono></div>}
        {s.flags && s.flags.length > 0 && <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>{s.flags.map((f, i) => <span key={i} style={{ fontFamily: FM, fontSize: 9, color: C.gold, background: `${C.gold}11`, border: `1px solid ${C.gold}33`, borderRadius: 3, padding: '1px 6px' }}>{f}</span>)}</div>}
      </div>
      {isOpen && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 12, animation: 'fadeIn 0.2s ease' }}>
          {checklist.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 6 }}>CONVERGENCE CHECKLIST</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                {checklist.map((item, i) => {
                  const pass = item.pass ?? item.passed ?? item.met ?? item.status === 'pass'
                  const label = item.label || item.name || item.criterion || item
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
                      <span style={{ fontFamily: FM, fontSize: 10, color: pass ? C.green : C.red }}>{pass ? '✓' : '✗'}</span>
                      <span style={{ fontFamily: FR, fontSize: 10, color: pass ? C.text : C.textDim }}>{typeof label === 'string' ? label : JSON.stringify(label)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {tech && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 6 }}>TECHNICALS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {Object.entries(tech).filter(([k]) => !['ticker', 'symbol', 'error'].includes(k)).slice(0, 12).map(([k, v]) => (
                  <div key={k} style={{ background: C.raised, borderRadius: 4, padding: '4px 6px' }}>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.02em", color: C.textDim, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                    <Mono size={10}>{typeof v === 'number' ? v.toFixed(2) : String(v ?? '—')}</Mono>
                  </div>
                ))}
              </div>
            </div>
          )}
          {sr && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 6 }}>SUPPORT / RESISTANCE</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.green, marginBottom: 2 }}>SUPPORT</div>
                  {(sr.support || sr.supports || []).slice(0, 3).map((v, i) => <div key={i}><Mono size={11} color={C.green}>${typeof v === 'number' ? v.toFixed(2) : (v?.price != null ? Number(v.price).toFixed(2) : v)}</Mono></div>)}
                </div>
                <div>
                  <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.red, marginBottom: 2 }}>RESISTANCE</div>
                  {(sr.resistance || sr.resistances || []).slice(0, 3).map((v, i) => <div key={i}><Mono size={11} color={C.red}>${typeof v === 'number' ? v.toFixed(2) : (v?.price != null ? Number(v.price).toFixed(2) : v)}</Mono></div>)}
                </div>
              </div>
            </div>
          )}
          {(s.eps_growth || s.revenue_growth || s.fundamentals) && (
            <div>
              <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 6 }}>FUNDAMENTALS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {[
                  { k: 'EPS Growth', v: s.eps_growth ?? s.fundamentals?.eps_growth },
                  { k: 'Rev Growth', v: s.revenue_growth ?? s.fundamentals?.revenue_growth },
                  { k: 'Margins', v: s.margins ?? s.fundamentals?.margins },
                  { k: 'ROE', v: s.roe ?? s.fundamentals?.roe },
                  { k: 'Market Cap', v: s.market_cap ?? s.fundamentals?.market_cap },
                ].filter(x => x.v != null).map(({ k, v }) => (
                  <div key={k} style={{ background: C.raised, borderRadius: 4, padding: '4px 6px' }}>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.02em", color: C.textDim }}>{k}</div>
                    <Mono size={10}>{typeof v === 'number' ? (Math.abs(v) < 1 ? (v * 100).toFixed(1) + '%' : v.toFixed(2)) : String(v)}</Mono>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}

// ── Scanner Icons ──
const SCANNER_ICONS = { mega_cap: '\u{1F451}', canslim: '\u{1F4CA}', new_highs: '\u{2B06}', rs_leaders: '\u{26A1}', todays_watch: '\u{1F441}', intraday: '\u{23F1}' }

function WatchPage() {
  const { data: watchlist, loading, error, reload } = useFetch('/api/watchlist')
  const [filter, setFilter] = useState('ALL')
  const [expanded, setExpanded] = useState({})
  const [techCache, setTechCache] = useState({})
  const [srCache, setSrCache] = useState({})
  // Scanner state
  const [mode, setMode] = useState('watchlist')
  const [activeScanner, setActiveScanner] = useState('todays_watch')
  const [scannerData, setScannerData] = useState(null)
  const [scannerLoading, setScannerLoading] = useState(false)
  const [scannerError, setScannerError] = useState(null)

  const items = Array.isArray(watchlist) ? watchlist : (watchlist?.watchlist || watchlist?.stocks || watchlist?.items || [])
  const sorted = [...items].sort((a, b) => (b.convergence_score || b.score || 0) - (a.convergence_score || a.score || 0))

  const zones = ['ALL', 'CONVERGENCE', 'SECONDARY', 'BUILDING', 'WATCH', 'SHORT']
  const filtered = filter === 'ALL' ? sorted : sorted.filter(s => {
    const z = (s.zone || '').toUpperCase()
    if (filter === 'SHORT') return z.includes('SHORT')
    return z.includes(filter)
  })

  const toggle = (ticker) => {
    setExpanded(prev => ({ ...prev, [ticker]: !prev[ticker] }))
  }

  const loadDetails = async (ticker) => {
    if (techCache[ticker]) return
    try {
      const [tech, sr] = await Promise.all([
        api(`/api/technicals/${ticker}`).catch(() => null),
        api(`/api/support-resistance/${ticker}`).catch(() => null),
      ])
      setTechCache(prev => ({ ...prev, [ticker]: tech }))
      setSrCache(prev => ({ ...prev, [ticker]: sr }))
    } catch {}
  }

  const runScanner = async (mod) => {
    setActiveScanner(mod)
    setScannerLoading(true)
    setScannerError(null)
    try {
      const data = await api(`/api/scanner/${mod}`)
      setScannerData(data)
    } catch (e) {
      setScannerError(e.message || 'Scanner failed')
    } finally {
      setScannerLoading(false)
    }
  }

  const scannerModules = [
    { key: 'todays_watch', name: "TODAY'S WATCH" },
    { key: 'mega_cap', name: 'MEGA CAP' },
    { key: 'rs_leaders', name: 'RS LEADERS' },
    { key: 'canslim', name: 'CANSLIM' },
    { key: 'new_highs', name: 'NEW HIGHS' },
    { key: 'intraday', name: 'INTRA-DAY' },
  ]

  const scannerStocks = scannerData?.stocks || []

  if (loading && mode === 'watchlist') return <Loading />
  if (error && mode === 'watchlist') return <ErrorMsg msg={error} onRetry={reload} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: 0, margin: '0' }}>
        <button onClick={() => setMode('watchlist')} style={{
          flex: 1, padding: '10px 0', fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: "0.04em",
          color: mode === 'watchlist' ? C.bg : C.textDim,
          background: mode === 'watchlist' ? C.blue : 'transparent',
          borderBottom: mode === 'watchlist' ? `2px solid ${C.blue}` : `1px solid ${C.border}`,
        }}>WATCHLIST</button>
        <button onClick={() => { setMode('scanners'); if (!scannerData) runScanner(activeScanner) }} style={{
          flex: 1, padding: '10px 0', fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: "0.04em",
          color: mode === 'scanners' ? C.bg : C.textDim,
          background: mode === 'scanners' ? C.gold : 'transparent',
          borderBottom: mode === 'scanners' ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
        }}>SCANNERS</button>
      </div>

      {mode === 'watchlist' ? (
        <>
          <TabBar tabs={zones} active={filter} onSelect={setFilter} />
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: FM, fontSize: 10, color: C.textDim, padding: '0 4px' }}>{filtered.length} names</div>
            {filtered.length === 0 && <EmptyState />}
            {filtered.map((s) => {
              const ticker = s.ticker || s.symbol || '???'
              return (
                <StockCard key={ticker} s={s} expanded={expanded[ticker]} onToggle={toggle}
                  techCache={techCache[ticker]} srCache={srCache[ticker]} onLoadDetails={loadDetails} />
              )
            })}
          </div>
        </>
      ) : (
        <>
          {/* Scanner Module Tabs */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: `1px solid ${C.border}`, padding: '0 4px' }}>
            {scannerModules.map(m => (
              <button key={m.key} onClick={() => runScanner(m.key)} style={{
                fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.02em",
                color: activeScanner === m.key ? C.gold : C.textDim,
                padding: '8px 10px', flexShrink: 0, whiteSpace: 'nowrap',
                borderBottom: activeScanner === m.key ? `2px solid ${C.gold}` : '2px solid transparent',
                transition: 'all 0.2s',
              }}>{SCANNER_ICONS[m.key] || ''} {m.name}</button>
            ))}
          </div>

          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Scanner header */}
            {scannerData && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                <div>
                  <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: "0.02em", color: C.gold }}>{scannerData.scannerName || activeScanner}</div>
                  <div style={{ fontFamily: FR, fontSize: 10, color: C.textDim }}>{scannerData.description || ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: FM, fontSize: 10, color: C.textDim }}>{scannerStocks.length} results</div>
                  {scannerData.lastUpdated && <div style={{ fontFamily: FM, fontSize: 8, color: C.textDim }}>Updated: {new Date(scannerData.lastUpdated).toLocaleTimeString()}</div>}
                </div>
              </div>
            )}

            {/* Refresh button */}
            <button onClick={() => runScanner(activeScanner)} style={{
              fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em",
              color: C.bg, background: C.gold, padding: '6px 16px', borderRadius: 4, alignSelf: 'flex-end',
            }}>REFRESH</button>

            {scannerLoading && <Loading text={`SCANNING ${(scannerModules.find(m => m.key === activeScanner)?.name || '').toUpperCase()}...`} />}
            {scannerError && <ErrorMsg msg={scannerError} onRetry={() => runScanner(activeScanner)} />}

            {!scannerLoading && scannerStocks.length === 0 && !scannerError && (
              <EmptyState text="No stocks match this scanner's criteria. Try a different scanner or wait for market data to refresh." />
            )}

            {!scannerLoading && scannerStocks.map((s, idx) => {
              const ticker = s.ticker || s.symbol || '???'
              return (
                <div key={ticker}>
                  {/* Rank badge */}
                  <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 10, letterSpacing: "0.04em", color: C.gold, padding: '2px 4px', marginBottom: 2 }}>
                    #{idx + 1}
                    {s.canslim_score != null && <span style={{ marginLeft: 8, fontFamily: FM, fontSize: 9, color: C.blue }}>CANSLIM: {s.canslim_score}/7</span>}
                    {s.watch_score != null && <span style={{ marginLeft: 8, fontFamily: FM, fontSize: 9, color: C.gold }}>WATCH: {s.watch_score}</span>}
                    {s.momentum_score != null && <span style={{ marginLeft: 8, fontFamily: FM, fontSize: 9, color: C.purple }}>MOM: {s.momentum_score}</span>}
                  </div>
                  <StockCard s={s} expanded={expanded[ticker]} onToggle={toggle}
                    techCache={techCache[ticker]} srCache={srCache[ticker]} onLoadDetails={loadDetails} />
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: PLAYS — Position Management
// ═══════════════════════════════════════════════════════════════════════════
function PlaysPage() {
  const { data: positions, loading: pl, error: pe, reload: pr, setData: setPositions } = useFetch('/api/positions')
  const { data: greeks } = useFetch('/api/portfolio/greeks')
  const { data: corr } = useFetch('/api/portfolio/correlation')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ticker: '', direction: 'LONG', entry: '', stop: '', target1: '', target2: '', option_type: '', strike: '', expiry: '', contracts: '' })

  const posArr = Array.isArray(positions) ? positions : (positions?.positions || [])

  const handleAdd = async () => {
    try {
      const body = { ...form, entry: Number(form.entry) || 0, stop: Number(form.stop) || 0, target1: Number(form.target1) || undefined, target2: Number(form.target2) || undefined, contracts: Number(form.contracts) || undefined }
      await apiPost('/api/positions', body)
      setShowForm(false)
      setForm({ ticker: '', direction: 'LONG', entry: '', stop: '', target1: '', target2: '', option_type: '', strike: '', expiry: '', contracts: '' })
      pr()
    } catch {}
  }

  const handleDelete = async (id) => {
    try { await apiDelete(`/api/positions/${id}`); pr() } catch {}
  }

  if (pl) return <Loading />
  if (pe) return <ErrorMsg msg={pe} onRetry={pr} />

  const gd = greeks || {}
  const corrData = corr || {}
  const sectorExposure = corrData.sectors || corrData.sector_exposure || corrData.exposure || []
  const sectorBars = Array.isArray(sectorExposure) ? sectorExposure.map(s => ({ label: s.sector || s.name || s.label, value: s.weight || s.pct || s.value || 0 })) : Object.entries(sectorExposure).map(([k, v]) => ({ label: k, value: typeof v === 'number' ? v : 0 }))

  const inputStyle = { background: C.raised, border: `1px solid ${C.border}`, borderRadius: 4, padding: '8px 10px', fontFamily: FM, fontSize: 12, color: C.textBright, width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
      {/* Header + Add */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 12, letterSpacing: "0.04em", color: C.textBright }}>OPEN POSITIONS</div>
        <button onClick={() => setShowForm(!showForm)} style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: "0.02em", color: C.green, padding: '5px 12px', border: `1px solid ${C.green}44`, borderRadius: 4, background: `${C.green}11` }}>{showForm ? 'CANCEL' : '+ ADD'}</button>
      </div>

      {/* Add Form */}
      {showForm && (
        <Panel borderColor={C.green}>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input placeholder="TICKER" value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value.toUpperCase() })} style={inputStyle} />
              <select value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })} style={inputStyle}>
                <option value="LONG">LONG</option><option value="SHORT">SHORT</option>
              </select>
              <input placeholder="Entry $" value={form.entry} onChange={e => setForm({ ...form, entry: e.target.value })} style={inputStyle} type="number" step="0.01" />
              <input placeholder="Stop $" value={form.stop} onChange={e => setForm({ ...form, stop: e.target.value })} style={inputStyle} type="number" step="0.01" />
              <input placeholder="Target 1 $" value={form.target1} onChange={e => setForm({ ...form, target1: e.target.value })} style={inputStyle} type="number" step="0.01" />
              <input placeholder="Target 2 $" value={form.target2} onChange={e => setForm({ ...form, target2: e.target.value })} style={inputStyle} type="number" step="0.01" />
            </div>
            <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginTop: 4 }}>OPTION DETAILS (optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <select value={form.option_type} onChange={e => setForm({ ...form, option_type: e.target.value })} style={inputStyle}>
                <option value="">None</option><option value="CALL">CALL</option><option value="PUT">PUT</option><option value="SPREAD">SPREAD</option>
              </select>
              <input placeholder="Strike" value={form.strike} onChange={e => setForm({ ...form, strike: e.target.value })} style={inputStyle} type="number" />
              <input placeholder="Expiry" value={form.expiry} onChange={e => setForm({ ...form, expiry: e.target.value })} style={inputStyle} type="date" />
            </div>
            <input placeholder="Contracts" value={form.contracts} onChange={e => setForm({ ...form, contracts: e.target.value })} style={inputStyle} type="number" />
            <button onClick={handleAdd} style={{ fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: "0.04em", color: C.bg, background: C.green, padding: '10px 0', borderRadius: 4, width: '100%' }}>ADD POSITION</button>
          </div>
        </Panel>
      )}

      {/* Positions */}
      {posArr.length === 0 && <EmptyState text="No open positions. Wait for convergence." />}
      {posArr.map((p, i) => {
        const ticker = p.ticker || p.symbol || '???'
        const isLong = (p.direction || 'LONG').toUpperCase() === 'LONG'
        const entry = Number(p.entry || p.entry_price || 0)
        const current = Number(p.current_price || p.price || entry)
        const pnlPct = entry > 0 ? ((current - entry) / entry * 100 * (isLong ? 1 : -1)) : 0
        const pnlColor = pnlPct >= 0 ? C.green : C.red
        return (
          <Panel key={p.id || i} borderColor={pnlColor + '44'}>
            <div style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 16, color: C.textBright }}>{ticker}</span>
                  <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, color: isLong ? C.green : C.red, padding: '1px 6px', border: `1px solid ${isLong ? C.green : C.red}44`, borderRadius: 3 }}>{p.direction || 'LONG'}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: FM, fontSize: 14, color: pnlColor }}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>ENTRY </span><Mono size={11}>${entry.toFixed(2)}</Mono></div>
                <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>STOP </span><Mono size={11} color={C.red}>${Number(p.stop || 0).toFixed(2)}</Mono></div>
                {(p.target1 || p.targets) && <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>T1 </span><Mono size={11} color={C.green}>${Number(p.target1 || (p.targets && p.targets[0]) || 0).toFixed(2)}</Mono></div>}
                {(p.target2 || (p.targets && p.targets[1])) && <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>T2 </span><Mono size={11} color={C.green}>${Number(p.target2 || p.targets[1] || 0).toFixed(2)}</Mono></div>}
              </div>
              {(p.option_type || p.options) && (
                <div style={{ marginTop: 4 }}>
                  <Mono size={10} color={C.purple}>{p.option_type || p.options?.type} {p.strike || p.options?.strike} {p.expiry || p.options?.expiry} x{p.contracts || p.options?.contracts || 1}</Mono>
                </div>
              )}
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => handleDelete(p.id)} style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.02em", color: C.red, padding: '3px 8px', border: `1px solid ${C.red}33`, borderRadius: 3 }}>CLOSE</button>
              </div>
            </div>
          </Panel>
        )
      })}

      {/* Portfolio Intelligence */}
      <Panel>
        <SectionHeader title="PORTFOLIO INTELLIGENCE" />
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { label: 'DELTA', v: gd.delta ?? gd.total_delta, color: C.green },
              { label: 'GAMMA', v: gd.gamma ?? gd.total_gamma, color: C.blue },
              { label: 'THETA/D', v: gd.theta ?? gd.theta_per_day, color: C.red },
              { label: 'VEGA', v: gd.vega ?? gd.total_vega, color: C.purple },
            ].map(({ label, v, color }) => (
              <div key={label} style={{ background: C.raised, borderRadius: 4, padding: 6, textAlign: 'center' }}>
                <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.textDim }}>{label}</div>
                <Mono size={12} color={color}>{v != null ? (typeof v === 'number' ? v.toFixed(2) : v) : '—'}</Mono>
              </div>
            ))}
          </div>
          {sectorBars.length > 0 && (
            <div>
              <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 6 }}>SECTOR EXPOSURE</div>
              <BarChart data={sectorBars} />
            </div>
          )}
          {corrData.warnings && corrData.warnings.length > 0 && (
            <div>
              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", color: C.red, marginBottom: 4 }}>CORRELATION WARNINGS</div>
              {corrData.warnings.map((w, i) => <div key={i} style={{ fontFamily: FR, fontSize: 11, color: C.red, padding: '2px 0' }}>{typeof w === 'string' ? w : w.message || JSON.stringify(w)}</div>)}
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: BRIEF — Daily Brief
// ═══════════════════════════════════════════════════════════════════════════
function BriefPage() {
  const { data, loading, error, reload } = useFetch('/api/daily-brief')

  if (loading) return <Loading text="COMPILING BRIEF..." />
  if (error) return <ErrorMsg msg={error} onRetry={reload} />
  if (!data) return <EmptyState text="No brief available." />

  const brief = data
  const tier1 = brief.tier1 || brief.data_brief || brief.tier1_brief || brief.market_data || ''
  const tier2 = brief.tier2 || brief.ai_brief || brief.tier2_brief || brief.analysis || ''

  const renderMarkdown = (text) => {
    if (!text) return null
    const lines = String(text).split('\n')
    return lines.map((line, i) => {
      const trimmed = line.trim()
      if (!trimmed) return <div key={i} style={{ height: 8 }} />
      if (trimmed.startsWith('### ')) return <div key={i} style={{ fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: "0.04em", color: C.blue, marginTop: 10, marginBottom: 4 }}>{trimmed.slice(4)}</div>
      if (trimmed.startsWith('## ')) return <div key={i} style={{ fontFamily: FO, fontWeight: 700, fontSize: 12, letterSpacing: "0.04em", color: C.textBright, marginTop: 12, marginBottom: 4 }}>{trimmed.slice(3)}</div>
      if (trimmed.startsWith('# ')) return <div key={i} style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, letterSpacing: "0.04em", color: C.gold, marginTop: 14, marginBottom: 6 }}>{trimmed.slice(2)}</div>
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return <div key={i} style={{ fontFamily: FR, fontSize: 13, fontWeight: 500, color: C.text, paddingLeft: 12, lineHeight: 1.6, position: 'relative' }}><span style={{ position: 'absolute', left: 0, color: C.blue }}>•</span>{trimmed.slice(2)}</div>
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) return <div key={i} style={{ fontFamily: FR, fontSize: 13, fontWeight: 600, color: C.textBright, lineHeight: 1.5 }}>{trimmed.slice(2, -2)}</div>
      return <div key={i} style={{ fontFamily: FR, fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.6 }}>{trimmed}</div>
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, letterSpacing: "0.06em", color: C.gold }}>DAILY BRIEF</div>
        <button onClick={reload} style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.02em", color: C.blue, padding: '5px 12px', border: `1px solid ${C.blue}44`, borderRadius: 4 }}>REFRESH</button>
      </div>

      {tier1 && (
        <Panel borderColor={C.blue}>
          <SectionHeader title="TIER 1 — DATA BRIEF" />
          <div style={{ padding: 12 }}>{renderMarkdown(tier1)}</div>
        </Panel>
      )}

      {tier2 && (
        <Panel borderColor={C.purple}>
          <SectionHeader title="TIER 2 — AI ANALYSIS" />
          <div style={{ padding: 12 }}>{renderMarkdown(tier2)}</div>
        </Panel>
      )}

      {!tier1 && !tier2 && <EmptyState text="Brief not yet generated. Check back after market open." />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: ANALYZE — Deep Analysis
// ═══════════════════════════════════════════════════════════════════════════
function AnalyzePage() {
  const [ticker, setTicker] = useState('')
  const [searchTicker, setSearchTicker] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [options, setOptions] = useState(null)
  const [trades, setTrades] = useState(null)
  const [tech, setTech] = useState(null)
  const [sr, setSr] = useState(null)
  const [qullData, setQullData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const doSearch = async () => {
    const t = ticker.trim().toUpperCase()
    if (!t) return
    setSearchTicker(t)
    setLoading(true); setError(null)
    try {
      const [a, o, tr, te, s, q] = await Promise.all([
        api(`/api/analyze/${t}`).catch(() => null),
        api(`/api/options-analysis/${t}`).catch(() => null),
        api(`/api/trade-ideas/${t}`).catch(() => null),
        api(`/api/technicals/${t}`).catch(() => null),
        api(`/api/support-resistance/${t}`).catch(() => null),
        api(`/api/qullamaggie/${t}`).catch(() => null),
      ])
      setAnalysis(a); setOptions(o); setTrades(tr); setTech(te); setSr(s); setQullData(q)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const a = analysis || {}
  const price = a.price ?? a.current_price
  const checklist = a.checklist || a.convergence_checklist || a.convergence?.checklist || []
  const fund = a.fundamentals || a.fundamental || {}
  const thesis = a.thesis || a.educational_thesis || a.analysis || a.summary || ''
  const tradeIdeas = Array.isArray(trades) ? trades : (trades?.ideas || trades?.strategies || trades?.trade_ideas || [])
  const opt = options || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
      {/* Search */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="TICKER" style={{
            flex: 1, background: C.raised, border: `1px solid ${C.border}`, borderRadius: 6,
            padding: '10px 14px', fontFamily: FO, fontWeight: 900, fontSize: 16, color: C.textBright, letterSpacing: "0.04em",
          }}
        />
        <button onClick={doSearch} style={{
          fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: "0.04em",
          color: C.bg, background: C.blue, padding: '10px 20px', borderRadius: 6,
        }}>ANALYZE</button>
      </div>

      {loading && <Loading text={`ANALYZING ${searchTicker}...`} />}
      {error && <ErrorMsg msg={error} onRetry={doSearch} />}

      {!loading && searchTicker && analysis && (
        <>
          {/* Section 1: Price Identity */}
          <Collapsible title="PRICE IDENTITY" defaultOpen borderColor={C.blue}>
            <div style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 24, color: C.textBright }}>{searchTicker}</div>
                  <div style={{ fontFamily: FR, fontWeight: 500, fontSize: 12, color: C.textDim }}>{a.name || a.company || a.sector || ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Mono size={22} color={C.textBright}>${price != null ? Number(price).toFixed(2) : '—'}</Mono>
                  <div><Pct v={a.day_change ?? a.change_1d ?? a.change_pct} size={13} /></div>
                </div>
              </div>
              <GradeBadge grade={a.grade} size={36} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 10 }}>
                {[
                  { l: '52W HIGH', v: a.high_52w ?? a.week52_high },
                  { l: '52W LOW', v: a.low_52w ?? a.week52_low },
                  { l: 'MKT CAP', v: a.market_cap ?? a.marketCap ?? fund.marketCap ?? fund.market_cap },
                  { l: 'SECTOR', v: a.sector },
                  { l: 'DAY', v: a.day_change ?? a.change_1d, pct: true },
                  { l: 'WEEK', v: a.week_change ?? a.change_1w, pct: true },
                ].map(({ l, v, pct }) => (
                  <div key={l} style={{ background: C.raised, borderRadius: 4, padding: 6 }}>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.textDim }}>{l}</div>
                    {pct ? <Pct v={v} size={11} /> : <Mono size={11}>{v != null ? (typeof v === 'number' ? (v > 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v > 1e6 ? `$${(v / 1e6).toFixed(0)}M` : `$${v.toFixed(2)}`) : String(v)) : '—'}</Mono>}
                  </div>
                ))}
              </div>
            </div>
          </Collapsible>

          {/* Section 2: MKW Convergence */}
          <Collapsible title="MKW CONVERGENCE ANALYSIS" defaultOpen borderColor={C.gold} right={<Mono size={11} color={zoneColor(a.zone)}>{a.convergence_score ?? a.score ?? '—'}/23</Mono>}>
            <div style={{ padding: 12 }}>
              <div style={{ marginBottom: 8 }}><ZoneBadge zone={a.zone} /></div>
              {checklist.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {checklist.map((item, i) => {
                    const pass = item.pass ?? item.passed ?? item.met ?? item.status === 'pass'
                    const label = item.label || item.name || item.criterion || (typeof item === 'string' ? item : JSON.stringify(item))
                    const detail = item.detail || item.value || item.description || ''
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: `1px solid ${C.border}22` }}>
                        <span style={{ fontFamily: FM, fontSize: 12, color: pass ? C.green : C.red, flexShrink: 0 }}>{pass ? '✓' : '✗'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: FR, fontSize: 12, fontWeight: 600, color: pass ? C.text : C.textDim }}>{typeof label === 'string' ? label : ''}</div>
                          {detail && <div style={{ fontFamily: FM, fontSize: 10, color: C.textDim }}>{String(detail)}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : <div style={{ fontFamily: FR, fontSize: 12, color: C.textDim }}>Checklist data not available</div>}
            </div>
          </Collapsible>

          {/* Section 3: Technical Indicators */}
          {tech && (
            <Collapsible title="TECHNICAL INDICATORS" borderColor={C.blue}>
              <div style={{ padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    { l: 'RSI', v: tech.rsi },
                    { l: 'MACD', v: tech.macd ?? tech.macd_line },
                    { l: 'MACD SIG', v: tech.macd_signal },
                    { l: 'BB UPPER', v: tech.bb_upper ?? tech.bollinger_upper },
                    { l: 'BB LOWER', v: tech.bb_lower ?? tech.bollinger_lower },
                    { l: 'ADX', v: tech.adx },
                    { l: 'STOCH K', v: tech.stoch_k ?? tech.stochastic_k },
                    { l: 'STOCH D', v: tech.stoch_d ?? tech.stochastic_d },
                    { l: 'ADR%', v: tech.adr_pct ?? tech.adr },
                    { l: 'OBV', v: tech.obv },
                    { l: 'SMA 50', v: tech.sma_50 ?? tech.ma_50 },
                    { l: 'SMA 200', v: tech.sma_200 ?? tech.ma_200 },
                    { l: 'EMA 20', v: tech.ema_20 ?? tech.ema20 },
                    { l: 'EMA 50', v: tech.ema_50 ?? tech.ema50 },
                    { l: 'DIST 50MA', v: tech.dist_50ma ?? tech.distance_50ma },
                    { l: 'DIST 200MA', v: tech.dist_200ma ?? tech.distance_200ma },
                    { l: 'ATR', v: tech.atr },
                    { l: 'VOLUME', v: tech.volume ?? tech.avg_volume },
                  ].filter(x => x.v != null).map(({ l, v }) => (
                    <div key={l} style={{ background: C.raised, borderRadius: 4, padding: 6 }}>
                      <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.textDim }}>{l}</div>
                      <Mono size={11}>{typeof v === 'number' ? (Math.abs(v) > 1e6 ? `${(v / 1e6).toFixed(1)}M` : v.toFixed(2)) : String(v)}</Mono>
                    </div>
                  ))}
                </div>
              </div>
            </Collapsible>
          )}

          {/* Section 4: Support & Resistance */}
          {sr && (
            <Collapsible title="SUPPORT & RESISTANCE MAP" borderColor={C.purple}>
              <div style={{ padding: 12 }}>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", color: C.green, marginBottom: 6 }}>SUPPORT LEVELS</div>
                    {(sr.support || sr.supports || []).map((v, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${C.border}22` }}>
                        <Mono size={11} color={C.green}>S{i + 1}</Mono>
                        <Mono size={11} color={C.green}>${typeof v === 'number' ? v.toFixed(2) : (v?.price != null ? Number(v.price).toFixed(2) : v?.level != null ? Number(v.level).toFixed(2) : v)}</Mono>
                      </div>
                    ))}
                    {(sr.support || sr.supports || []).length === 0 && <Mono size={10} color={C.textDim}>None identified</Mono>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", color: C.red, marginBottom: 6 }}>RESISTANCE LEVELS</div>
                    {(sr.resistance || sr.resistances || []).map((v, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${C.border}22` }}>
                        <Mono size={11} color={C.red}>R{i + 1}</Mono>
                        <Mono size={11} color={C.red}>${typeof v === 'number' ? v.toFixed(2) : (v?.price != null ? Number(v.price).toFixed(2) : v?.level != null ? Number(v.level).toFixed(2) : v)}</Mono>
                      </div>
                    ))}
                    {(sr.resistance || sr.resistances || []).length === 0 && <Mono size={10} color={C.textDim}>None identified</Mono>}
                  </div>
                </div>
                {(sr.pivot || sr.pivot_point) && <div style={{ marginTop: 8 }}><Mono size={10} color={C.textDim}>Pivot: </Mono><Mono size={12} color={C.gold}>${Number(sr.pivot || sr.pivot_point).toFixed(2)}</Mono></div>}
              </div>
            </Collapsible>
          )}

          {/* Section 5: Fundamentals */}
          {Object.keys(fund).length > 0 && (
            <Collapsible title="FUNDAMENTAL SNAPSHOT" borderColor={C.green}>
              <div style={{ padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    { l: 'EPS GROWTH', v: fund.eps_growth ?? fund.eps },
                    { l: 'REV GROWTH', v: fund.revenue_growth ?? fund.rev_growth },
                    { l: 'MARGINS', v: fund.margins ?? fund.profit_margin ?? fund.net_margin },
                    { l: 'ROE', v: fund.roe },
                    { l: 'FCF', v: fund.fcf ?? fund.free_cash_flow },
                    { l: 'P/E', v: fund.pe ?? fund.pe_ratio },
                    { l: 'NEXT EARN', v: fund.next_earnings ?? fund.earnings_date },
                    { l: 'DEBT/EQ', v: fund.debt_equity ?? fund.de_ratio },
                    { l: 'INDUSTRY', v: fund.industry ?? a.industry },
                  ].filter(x => x.v != null).map(({ l, v }) => (
                    <div key={l} style={{ background: C.raised, borderRadius: 4, padding: 6 }}>
                      <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.textDim }}>{l}</div>
                      <Mono size={11}>{typeof v === 'number' ? (Math.abs(v) < 5 ? (v * 100).toFixed(1) + '%' : v.toFixed(2)) : String(v)}</Mono>
                    </div>
                  ))}
                </div>
              </div>
            </Collapsible>
          )}

          {/* Section 6: Options Intelligence */}
          {opt && Object.keys(opt).length > 0 && (
            <Collapsible title="OPTIONS INTELLIGENCE" borderColor={C.purple}>
              <div style={{ padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                  {[
                    { l: 'IV RANK', v: opt.iv_rank, color: C.gold },
                    { l: 'IV PCTILE', v: opt.iv_percentile, color: C.gold },
                    { l: 'CURRENT IV', v: opt.current_iv ?? opt.iv },
                    { l: 'HV 30', v: opt.hv_30 ?? opt.historical_vol },
                    { l: 'IV/HV', v: opt.iv_hv_ratio },
                    { l: 'PUT/CALL', v: opt.put_call_ratio },
                  ].filter(x => x.v != null).map(({ l, v, color }) => (
                    <div key={l} style={{ background: C.raised, borderRadius: 4, padding: 6 }}>
                      <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.textDim }}>{l}</div>
                      <Mono size={12} color={color}>{typeof v === 'number' ? (v < 5 ? (v * 100).toFixed(1) + '%' : v.toFixed(2)) : String(v)}</Mono>
                    </div>
                  ))}
                </div>
                {/* Term Structure */}
                {opt.term_structure && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 4 }}>TERM STRUCTURE</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(Array.isArray(opt.term_structure) ? opt.term_structure : Object.entries(opt.term_structure).map(([k, v]) => ({ expiry: k, iv: v }))).map((t, i) => (
                        <div key={i} style={{ background: C.raised, borderRadius: 4, padding: '4px 8px' }}>
                          <div style={{ fontFamily: FM, fontSize: 9, color: C.textDim }}>{t.expiry || t.dte || t.label}</div>
                          <Mono size={11} color={C.purple}>{typeof t.iv === 'number' ? (t.iv * 100).toFixed(1) + '%' : t.iv}</Mono>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Skew */}
                {opt.skew && <div style={{ marginBottom: 10 }}><div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 4 }}>SKEW</div><Mono size={11}>{typeof opt.skew === 'number' ? opt.skew.toFixed(3) : JSON.stringify(opt.skew)}</Mono></div>}
                {/* Strategy Recs */}
                {(opt.strategies || opt.recommendations || opt.strategy_recs) && (
                  <div>
                    <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 4 }}>STRATEGY RECOMMENDATIONS</div>
                    {(opt.strategies || opt.recommendations || opt.strategy_recs || []).map((s, i) => (
                      <div key={i} style={{ background: C.raised, borderRadius: 6, padding: 8, marginBottom: 4 }}>
                        <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, color: C.blue }}>{s.name || s.strategy || s.type || 'Strategy'}</div>
                        <div style={{ fontFamily: FR, fontSize: 11, color: C.text, marginTop: 2 }}>{s.rationale || s.description || s.reason || ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Collapsible>
          )}

          {/* Section 7: Trade Execution Plans */}
          {trades && !trades.error && (
            <Collapsible title="TRADE EXECUTION PLANS" borderColor={C.green} defaultOpen
              right={trades.bias ? <Mono size={10} color={trades.bias?.includes('BULL') ? C.green : trades.bias?.includes('BEAR') ? C.red : C.textDim}>{trades.bias} — {trades.conviction}</Mono> : null}>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Overall trade assessment */}
                {trades.grade && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
                    <GradeBadge grade={trades.grade?.grade} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, color: C.textBright }}>{trades.grade?.grade} — {trades.grade?.description || ''}</div>
                      <div style={{ fontFamily: FM, fontSize: 9, color: C.textDim }}>
                        Score: {trades.grade?.totalScore || trades.grade?.score || '—'}/100 | {trades.tradeable ? 'TRADEABLE' : 'WATCH ONLY'} | IV Rank: {trades.ivRank ?? '—'}
                      </div>
                    </div>
                  </div>
                )}
                {!trades.tradeable && trades.noTradeReason && (
                  <div style={{ padding: 10, background: `${C.red}11`, border: `1px solid ${C.red}33`, borderRadius: 6 }}>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", color: C.red, marginBottom: 4 }}>NO TRADE</div>
                    <div style={{ fontFamily: FR, fontSize: 12, color: C.text }}>{trades.noTradeReason}</div>
                  </div>
                )}
                {/* Global levels */}
                {(trades.stopPrice || trades.target1) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {[
                      { l: 'STOP', v: trades.stopPrice, c: C.red },
                      { l: 'TARGET 1', v: trades.target1, c: C.green },
                      { l: 'TARGET 2', v: trades.target2, c: C.green },
                      { l: 'SPOT', v: trades.spot, c: C.textBright },
                    ].filter(x => x.v).map(({ l, v, c }) => (
                      <div key={l} style={{ background: C.raised, borderRadius: 4, padding: 6, textAlign: 'center' }}>
                        <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.textDim }}>{l}</div>
                        <Mono size={12} color={c}>${Number(v).toFixed(2)}</Mono>
                      </div>
                    ))}
                  </div>
                )}
                {/* Strategy Cards */}
                {(trades.strategies || tradeIdeas).map((strat, i) => {
                  const aggColor = strat.aggression === 'aggressive' ? C.red : strat.aggression === 'conservative' ? C.blue : C.gold
                  const aggLabel = (strat.aggression || '').toUpperCase()
                  const sg = strat.grade || strat.rating
                  return (
                    <Collapsible key={i} title={strat.strategyName || strat.strategy || strat.name || `Strategy ${i + 1}`}
                      borderColor={aggColor} defaultOpen={i === 0}
                      right={sg ? <span style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, color: gradeColor(sg) }}>{sg}</span> : null}>
                      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Aggression badge + score */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", color: C.bg, background: aggColor, padding: '2px 10px', borderRadius: 3 }}>{aggLabel}</span>
                          {strat.gradeScore != null && <Mono size={10} color={C.textDim}>Score: {strat.gradeScore}/100</Mono>}
                          {strat.positionPct && <Mono size={10} color={C.textDim}>Size: {strat.positionPct}</Mono>}
                        </div>
                        {/* Description */}
                        <div style={{ fontFamily: FR, fontSize: 12, color: C.text, lineHeight: 1.6 }}>
                          {strat.description || strat.thesis || strat.rationale || ''}
                        </div>
                        {/* Option Contract Details */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          {[
                            { l: 'TYPE', v: strat.optionType?.toUpperCase() },
                            { l: 'STRIKE', v: strat.strike ? `$${strat.strike}` : strat.longStrike ? `$${strat.longStrike}/$${strat.shortStrike}` : null },
                            { l: 'EXPIRY', v: strat.expiry },
                            { l: 'DTE', v: strat.dte },
                            { l: 'MID', v: strat.mid != null ? `$${Number(strat.mid).toFixed(2)}` : strat.netDebit != null ? `$${Number(strat.netDebit).toFixed(2)} debit` : null },
                            { l: 'BID/ASK', v: strat.bid != null ? `$${Number(strat.bid).toFixed(2)}/$${Number(strat.ask).toFixed(2)}` : null },
                            { l: 'IV', v: strat.iv ? `${(strat.iv * 100).toFixed(1)}%` : null },
                            { l: 'BREAKEVEN', v: strat.breakeven ? `$${Number(strat.breakeven).toFixed(2)}` : null },
                            { l: 'B/E %', v: strat.breakevenPct != null ? `${strat.breakevenPct}%` : null },
                          ].filter(x => x.v != null).map(({ l, v }) => (
                            <div key={l} style={{ background: C.bg, borderRadius: 4, padding: '4px 6px' }}>
                              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.02em", color: C.textDim }}>{l}</div>
                              <Mono size={10}>{v}</Mono>
                            </div>
                          ))}
                        </div>
                        {/* Greeks */}
                        {strat.greeks && (
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {[
                              { l: 'Delta', v: strat.greeks.delta, c: C.blue },
                              { l: 'Gamma', v: strat.greeks.gamma },
                              { l: 'Theta', v: strat.greeks.theta, c: C.red },
                              { l: 'Vega', v: strat.greeks.vega, c: C.purple },
                            ].filter(x => x.v != null && x.v !== 0).map(({ l, v, c }) => (
                              <div key={l}>
                                <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.02em", color: C.textDim }}>{l} </span>
                                <Mono size={10} color={c}>{typeof v === 'number' ? v.toFixed(4) : v}</Mono>
                              </div>
                            ))}
                            {strat.thetaPerDay != null && strat.thetaPerDay !== 0 && (
                              <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.02em", color: C.textDim }}>Theta/Day </span><Mono size={10} color={C.red}>${Math.abs(strat.thetaPerDay).toFixed(2)}</Mono></div>
                            )}
                          </div>
                        )}
                        {/* Execution Levels */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                          {strat.entryZone && (
                            <div style={{ background: `${C.blue}11`, border: `1px solid ${C.blue}22`, borderRadius: 4, padding: 6 }}>
                              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.blue }}>ENTRY ZONE</div>
                              <Mono size={11} color={C.blue}>{strat.entryZone}</Mono>
                            </div>
                          )}
                          {strat.stopPrice && (
                            <div style={{ background: `${C.red}11`, border: `1px solid ${C.red}22`, borderRadius: 4, padding: 6 }}>
                              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.red }}>STOP LOSS</div>
                              <Mono size={11} color={C.red}>${Number(strat.stopPrice).toFixed(2)}</Mono>
                            </div>
                          )}
                          {strat.target1 && (
                            <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}22`, borderRadius: 4, padding: 6 }}>
                              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.green }}>TARGET 1</div>
                              <Mono size={11} color={C.green}>${Number(strat.target1).toFixed(2)}</Mono>
                            </div>
                          )}
                          {strat.target2 && (
                            <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}22`, borderRadius: 4, padding: 6 }}>
                              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.green }}>TARGET 2</div>
                              <Mono size={11} color={C.green}>${Number(strat.target2).toFixed(2)}</Mono>
                            </div>
                          )}
                        </div>
                        {/* Risk/Reward */}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {strat.maxRisk != null && strat.maxRisk > 0 && (
                            <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>MAX RISK </span><Mono size={11} color={C.red}>${Number(strat.maxRisk).toFixed(0)}/contract</Mono></div>
                          )}
                          {strat.rrRatio != null && strat.rrRatio > 0 && (
                            <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>R:R </span><Mono size={11} color={C.gold}>1:{strat.rrRatio}</Mono></div>
                          )}
                          {strat.maxProfit != null && (
                            <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>MAX PROFIT </span><Mono size={11} color={C.green}>${Number(strat.maxProfit).toFixed(2)} ({strat.maxProfitPct}%)</Mono></div>
                          )}
                          {strat.positionSize && (
                            <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>POSITION </span><Mono size={10}>{strat.positionSize}</Mono></div>
                          )}
                        </div>
                        {/* P&L Targets projection */}
                        {strat.targets && strat.targets.length > 0 && (
                          <div>
                            <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.03em", color: C.textDim, marginBottom: 4 }}>P&L PROJECTION</div>
                            {strat.targets.map((t, j) => (
                              <div key={j} style={{ display: 'flex', gap: 12, padding: '3px 0', borderBottom: `1px solid ${C.border}22` }}>
                                <Mono size={10} color={C.textDim}>Stock @ ${Number(t.stockPrice).toFixed(2)}</Mono>
                                <Mono size={10}>Option: ${Number(t.optionValue).toFixed(2)}</Mono>
                                <Mono size={10} color={t.pnl >= 0 ? C.green : C.red}>P&L: ${Number(t.pnl).toFixed(0)} ({t.pnlPct > 0 ? '+' : ''}{t.pnlPct}%)</Mono>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Entry Triggers */}
                        {strat.entryTriggers && strat.entryTriggers.length > 0 && (
                          <div>
                            <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.03em", color: C.blue, marginBottom: 4 }}>ENTRY TRIGGERS</div>
                            {strat.entryTriggers.map((t, j) => (
                              <div key={j} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '2px 0' }}>
                                <span style={{ fontFamily: FM, fontSize: 10, color: C.blue, flexShrink: 0 }}>&#9654;</span>
                                <span style={{ fontFamily: FR, fontSize: 11, color: C.text, lineHeight: 1.4 }}>{t}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Things to Watch */}
                        {strat.thingsToWatch && strat.thingsToWatch.length > 0 && (
                          <div>
                            <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.03em", color: C.gold, marginBottom: 4 }}>THINGS TO WATCH</div>
                            {strat.thingsToWatch.map((t, j) => (
                              <div key={j} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '2px 0' }}>
                                <span style={{ fontFamily: FM, fontSize: 10, color: C.gold, flexShrink: 0 }}>&#9888;</span>
                                <span style={{ fontFamily: FR, fontSize: 11, color: C.text, lineHeight: 1.4 }}>{t}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* When to use */}
                        {strat.whenToUse && (
                          <div style={{ fontFamily: FM, fontSize: 10, color: C.textDim, fontStyle: 'italic' }}>Best for: {strat.whenToUse}</div>
                        )}
                      </div>
                    </Collapsible>
                  )
                })}
                {tradeIdeas.length === 0 && (!trades.strategies || trades.strategies.length === 0) && (
                  <div style={{ fontFamily: FR, fontSize: 12, color: C.textDim, textAlign: 'center', padding: 16 }}>No trade strategies generated — data may still be loading.</div>
                )}
              </div>
            </Collapsible>
          )}

          {/* Section 8: Qullamaggie Momentum Setup Analysis */}
          {qullData && !qullData.error && (
            <Collapsible title="QULLAMAGGIE MOMENTUM SETUP" borderColor={qullData.any_triggering ? C.gold : qullData.any_setup ? C.blue : C.border}
              right={qullData.best_setup ? <Mono size={10} color={qullData.any_triggering ? C.gold : C.blue}>{qullData.best_setup} ({qullData.best_score}/100)</Mono> : <Mono size={10} color={C.textDim}>NO SETUP</Mono>}>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {qullData.dual_convergence && (
                  <div style={{ padding: 10, background: `${C.gold}15`, border: `1px solid ${C.gold}44`, borderRadius: 6 }}>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 12, letterSpacing: "0.04em", color: C.gold }}>DUAL CONVERGENCE — MAXIMUM CONVICTION</div>
                    <div style={{ fontFamily: FR, fontSize: 12, color: C.text, marginTop: 4 }}>MKW convergence + Qullamaggie breakout both triggered. Full position size.</div>
                  </div>
                )}
                {/* Setup summaries */}
                {(qullData.setups_summary || []).length > 0 ? (qullData.setups_summary || []).map((s, i) => {
                  const typeColor = s.type === 'BREAKOUT' ? C.green : s.type === 'EPISODIC_PIVOT' ? C.gold : s.type === 'PARABOLIC_SHORT' ? C.red : C.blue
                  return (
                    <div key={i} style={{ background: C.raised, borderRadius: 6, padding: 10, border: `1px solid ${typeColor}33` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: "0.04em", color: typeColor }}>{s.type?.replace('_', ' ')}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Mono size={10} color={typeColor}>{s.score}/100</Mono>
                          {s.triggering && <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.02em", color: C.bg, background: C.gold, padding: '1px 6px', borderRadius: 3 }}>TRIGGERING</span>}
                        </div>
                      </div>
                      <div style={{ fontFamily: FR, fontSize: 12, color: C.text, lineHeight: 1.5 }}>{s.detail}</div>
                    </div>
                  )
                }) : (
                  <div style={{ fontFamily: FR, fontSize: 12, color: C.textDim }}>
                    No Qullamaggie setup detected. Reasons:
                    {qullData.breakout && !qullData.breakout.passed && (
                      <div style={{ fontFamily: FM, fontSize: 10, color: C.textDim, marginTop: 4 }}>
                        Breakout: Prior move {qullData.breakout.prior_move_pct}% (need 30%+), Pullback {qullData.breakout.pullback_depth_pct}%, ADR contraction {qullData.breakout.adr_contraction}%
                      </div>
                    )}
                    {qullData.episodic_pivot && !qullData.episodic_pivot.passed && (
                      <div style={{ fontFamily: FM, fontSize: 10, color: C.textDim, marginTop: 2 }}>
                        EP: Day move {qullData.episodic_pivot.day_move_pct}% (need 10%+), Volume {qullData.episodic_pivot.volume_ratio}x (need 3x+)
                      </div>
                    )}
                  </div>
                )}
                {/* Trade Plans */}
                {(qullData.trade_plans || []).map((plan, i) => (
                  <div key={i} style={{ background: C.bg, borderRadius: 6, padding: 10, border: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", color: C.gold, marginBottom: 6 }}>
                      {plan.setup_type?.replace('_', ' ')} TRADE PLAN
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
                      <div style={{ background: C.raised, borderRadius: 4, padding: 6 }}>
                        <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.textDim }}>ENTRY</div>
                        <Mono size={11} color={C.green}>${plan.entry_price}</Mono>
                      </div>
                      <div style={{ background: C.raised, borderRadius: 4, padding: 6 }}>
                        <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.textDim }}>STOP</div>
                        <Mono size={11} color={C.red}>${plan.initial_stop}</Mono>
                      </div>
                      <div style={{ background: C.raised, borderRadius: 4, padding: 6 }}>
                        <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.textDim }}>RISK/SHARE</div>
                        <Mono size={11}>${plan.risk_per_share}</Mono>
                      </div>
                    </div>
                    {plan.targets && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        {Object.entries(plan.targets).map(([k, v]) => (
                          <div key={k} style={{ background: C.raised, borderRadius: 4, padding: '3px 8px' }}>
                            <Mono size={9} color={C.textDim}>{k}: </Mono>
                            <Mono size={10} color={C.green}>{typeof v === 'number' ? `$${v}` : v}</Mono>
                          </div>
                        ))}
                      </div>
                    )}
                    {(plan.management || []).map((rule, j) => (
                      <div key={j} style={{ fontFamily: FR, fontSize: 11, color: C.text, padding: '2px 0', borderBottom: `1px solid ${C.border}11` }}>{rule}</div>
                    ))}
                    <div style={{ fontFamily: FM, fontSize: 10, color: C.textDim, marginTop: 6 }}>{plan.entry_trigger}</div>
                  </div>
                ))}
                {/* Qullamaggie Indicators Snapshot */}
                {qullData.indicators && Object.keys(qullData.indicators).length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 4 }}>MOMENTUM INDICATORS</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                      {[
                        { l: 'ADR 5D', v: qullData.indicators.adr_5d },
                        { l: 'ADR 20D', v: qullData.indicators.adr_20d },
                        { l: 'VOL RATIO', v: qullData.indicators.vol_ratio },
                        { l: 'UP STREAK', v: qullData.indicators.consecutive_up },
                        { l: 'EXT 10SMA', v: qullData.indicators.ext_from_10sma },
                        { l: 'EXT 20SMA', v: qullData.indicators.ext_from_20sma },
                        { l: 'MOVE 21D', v: qullData.indicators.move_21d_pct },
                        { l: 'MOVE 63D', v: qullData.indicators.move_63d_pct },
                      ].filter(x => x.v != null).map(({ l, v }) => (
                        <div key={l} style={{ background: C.raised, borderRadius: 3, padding: 4, textAlign: 'center' }}>
                          <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 6, letterSpacing: "0.02em", color: C.textDim }}>{l}</div>
                          <Mono size={9}>{typeof v === 'number' ? v.toFixed(1) : v}</Mono>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Collapsible>
          )}

          {/* Section 9: Detailed Thesis */}
          {(trades?.thesis || thesis) && (
            <Collapsible title="DETAILED THESIS" borderColor={C.textDim} defaultOpen>
              <div style={{ padding: 12 }}>
                {String(trades?.thesis || thesis).split('\n').map((line, i) => {
                  if (!line.trim()) return <div key={i} style={{ height: 8 }} />
                  const isHeader = line.startsWith('KEY RISK') || line.startsWith('What would')
                  return <div key={i} style={{
                    fontFamily: isHeader ? FO : FR,
                    fontSize: isHeader ? 11 : 13,
                    fontWeight: isHeader ? 700 : 500,
                    color: isHeader ? C.gold : C.text,
                    lineHeight: 1.7,
                    letterSpacing: isHeader ? 1 : 0,
                    marginTop: isHeader ? 4 : 0,
                  }}>{line}</div>
                })}
              </div>
            </Collapsible>
          )}
        </>
      )}

      {!loading && !searchTicker && <EmptyState text="Enter a ticker above to begin deep analysis." />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: MOMENTUM (Qullamaggie)
// ═══════════════════════════════════════════════════════════════════════════
function MomentumPage() {
  const [scanData, setScanData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('BREAKOUTS')

  const doScan = async () => {
    setLoading(true); setError(null)
    try {
      const data = await api('/api/qullamaggie/scan')
      setScanData(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { doScan() }, [])

  const tabs = ['BREAKOUTS', 'PARABOLIC', 'EP', 'ALL']

  const getTabItems = () => {
    if (!scanData) return []
    switch (activeTab) {
      case 'BREAKOUTS': return scanData.breakouts || []
      case 'PARABOLIC': return [...(scanData.parabolic_shorts || []), ...(scanData.parabolic_longs || [])]
      case 'EP': return scanData.episodic_pivots || []
      case 'ALL': return scanData.all_setups || []
      default: return []
    }
  }

  const items = getTabItems()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, color: C.gold, letterSpacing: 2 }}>MOMENTUM</div>
        <button onClick={doScan} style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", color: C.blue, padding: '6px 12px', border: `1px solid ${C.blue}44`, borderRadius: 4 }}>RESCAN</button>
      </div>
      <div style={{ fontFamily: FR, fontSize: 11, color: C.textDim, marginTop: -6 }}>Qullamaggie Breakouts · Parabolic · Episodic Pivots</div>

      {loading && <Loading text="SCANNING MOMENTUM SETUPS..." />}
      {error && <ErrorMsg msg={error} onRetry={doScan} />}

      {!loading && scanData && (
        <>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { l: 'BREAKOUTS', v: (scanData.breakouts || []).length, c: C.green },
              { l: 'PARA SHORT', v: (scanData.parabolic_shorts || []).length, c: C.red },
              { l: 'PARA LONG', v: (scanData.parabolic_longs || []).length, c: C.blue },
              { l: 'EP', v: (scanData.episodic_pivots || []).length, c: C.gold },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: C.panel, borderRadius: 6, padding: 8, textAlign: 'center', border: `1px solid ${v > 0 ? c + '44' : C.border}` }}>
                <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.textDim }}>{l}</div>
                <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 20, color: v > 0 ? c : C.textDim }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <TabBar tabs={tabs} active={activeTab} onSelect={setActiveTab} />

          {/* Results */}
          {items.length === 0 && <EmptyState text={`No ${activeTab.toLowerCase()} setups detected in the current universe.`} />}

          {items.map((item, i) => {
            const setupType = item.setup || item.type || 'UNKNOWN'
            const score = item.score || item.short_score || item.long_score || 0
            const triggering = item.triggering || item.short_triggering || item.long_triggering || false
            const ticker = item.ticker || '???'
            const typeColor = setupType.includes('BREAKOUT') ? C.green
              : setupType.includes('EPISODIC') || setupType.includes('EP') ? C.gold
              : setupType.includes('SHORT') ? C.red : C.blue

            return (
              <Panel key={`${ticker}-${i}`} borderColor={triggering ? C.gold + '88' : typeColor + '44'} glow={triggering ? C.gold : undefined}>
                <div style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 16, color: C.textBright }}>{ticker}</span>
                      <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.03em", color: typeColor, padding: '1px 6px', border: `1px solid ${typeColor}44`, borderRadius: 3, background: `${typeColor}11` }}>
                        {setupType.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Mono size={12} color={typeColor}>{score}/100</Mono>
                      {triggering && <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.02em", color: C.bg, background: C.gold, padding: '2px 8px', borderRadius: 3 }}>TRIGGERING</span>}
                    </div>
                  </div>
                  <div style={{ fontFamily: FR, fontSize: 12, color: C.text, lineHeight: 1.5 }}>{item.detail || ''}</div>
                  {/* Key metrics row */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    {item.prior_move_pct != null && <Mono size={9} color={C.textDim}>Move: +{item.prior_move_pct}%</Mono>}
                    {item.pullback_depth_pct != null && <Mono size={9} color={C.textDim}>PB: {item.pullback_depth_pct}%</Mono>}
                    {item.volume_ratio != null && <Mono size={9} color={item.volume_ratio >= 1.5 ? C.green : C.textDim}>Vol: {item.volume_ratio}x</Mono>}
                    {item.surge_pct != null && <Mono size={9} color={C.textDim}>Surge: +{item.surge_pct}%</Mono>}
                    {item.consecutive_up > 0 && <Mono size={9} color={C.textDim}>{item.consecutive_up} up days</Mono>}
                    {item.extension_from_10sma != null && <Mono size={9} color={C.textDim}>Ext 10SMA: {item.extension_from_10sma}%</Mono>}
                    {item.day_move_pct != null && <Mono size={9} color={C.textDim}>Today: +{item.day_move_pct}%</Mono>}
                    {item.gap_pct != null && item.gap_pct >= 5 && <Mono size={9} color={C.gold}>Gap: +{item.gap_pct}%</Mono>}
                    {item.adr_contraction != null && <Mono size={9} color={C.textDim}>ADR: {item.adr_contraction}%</Mono>}
                    {item.consolidation_high != null && <Mono size={9} color={C.textDim}>Pivot: ${item.consolidation_high}</Mono>}
                  </div>
                </div>
              </Panel>
            )
          })}

          <div style={{ fontFamily: FM, fontSize: 9, color: C.textDim, textAlign: 'center', marginTop: 4 }}>
            Scanned {scanData.total_scanned || 0} tickers · {scanData.total_with_setup || 0} with setups · Updated {scanData.lastUpdated ? new Date(scanData.lastUpdated).toLocaleTimeString() : '—'}
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: SCREENER
// ═══════════════════════════════════════════════════════════════════════════
function ScreenerPage() {
  const { data: presets, loading: presetsLoading } = useFetch('/api/screener/presets')
  const [activePreset, setActivePreset] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const presetList = Array.isArray(presets) ? presets : (presets?.presets || Object.keys(presets || {}) || [])

  const runPreset = async (preset) => {
    const key = typeof preset === 'string' ? preset : (preset.key || preset.id || preset.name || '')
    setActivePreset(key)
    setLoading(true); setError(null)
    try {
      const data = await api(`/api/screener?preset=${encodeURIComponent(key)}`)
      setResults(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const resultItems = Array.isArray(results) ? results : (results?.results || results?.stocks || results?.items || [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
      <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, letterSpacing: "0.06em", color: C.textBright }}>SCREENER</div>

      {/* Preset buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {presetsLoading && <Loading />}
        {presetList.map((p, i) => {
          const key = typeof p === 'string' ? p : (p.key || p.id || p.name || `preset_${i}`)
          const label = typeof p === 'string' ? p.replace(/_/g, ' ').toUpperCase() : (p.label || p.name || key).toUpperCase()
          const isActive = activePreset === key
          return (
            <button key={key} onClick={() => runPreset(p)} style={{
              fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.03em",
              color: isActive ? C.bg : C.blue, background: isActive ? C.blue : 'transparent',
              padding: '6px 12px', borderRadius: 4, border: `1px solid ${C.blue}44`,
              transition: 'all 0.2s',
            }}>{label}</button>
          )
        })}
      </div>

      {loading && <Loading text="SCREENING..." />}
      {error && <ErrorMsg msg={error} onRetry={() => activePreset && runPreset(activePreset)} />}

      {/* Results */}
      {resultItems.length > 0 && (
        <Panel>
          <SectionHeader title={`RESULTS — ${resultItems.length} FOUND`} />
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 500 }}>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '70px 50px 60px 50px 50px 60px', gap: 4, padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>
                {['TICKER', 'GRADE', 'SCORE', 'RS', 'STAGE', 'PHASE'].map(h => (
                  <div key={h} style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.03em", color: C.textDim }}>{h}</div>
                ))}
              </div>
              {/* Rows */}
              {resultItems.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 50px 60px 50px 50px 60px', gap: 4, padding: '6px 12px', borderBottom: `1px solid ${C.border}22`, background: i % 2 === 0 ? 'transparent' : C.raised + '44' }}>
                  <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 12, color: C.textBright }}>{s.ticker || s.symbol}</span>
                  <GradeBadge grade={s.grade} size={11} />
                  <Mono size={11} color={zoneColor(s.zone)}>{s.convergence_score ?? s.score ?? '—'}</Mono>
                  <Mono size={11}>{s.rs ?? s.relative_strength ?? '—'}</Mono>
                  <Mono size={11}>{s.stage ?? s.weinstein_stage ?? '—'}</Mono>
                  <Mono size={10} color={C.textDim}>{s.phase ?? s.kell_phase ?? '—'}</Mono>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      )}
      {!loading && results && resultItems.length === 0 && <EmptyState text="No results for this screen." />}
      {!loading && !results && <EmptyState text="Select a preset above to run a screen." />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: NEWS
// ═══════════════════════════════════════════════════════════════════════════
function NewsPage() {
  const [tab, setTab] = useState('MARKET')
  const { data: news, loading: nl, error: ne, reload: nr } = useFetch('/api/news')
  const { data: earnings, loading: el } = useFetch('/api/earnings-calendar')

  const marketNews = news?.marketNews || news?.market_news || (Array.isArray(news) ? news : [])
  const watchlistNews = news?.watchlistAlerts || news?.watchlist_alerts || news?.watchlist || []
  const earningsItems = Array.isArray(earnings) ? earnings : (earnings?.calendar || earnings?.earnings || earnings?.items || [])

  const displayNews = tab === 'MARKET' ? marketNews : tab === 'WATCHLIST' ? watchlistNews : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <TabBar tabs={['MARKET', 'WATCHLIST', 'EARNINGS']} active={tab} onSelect={setTab} />
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(nl || el) && <Loading />}
        {ne && <ErrorMsg msg={ne} onRetry={nr} />}

        {tab !== 'EARNINGS' && displayNews.length > 0 && displayNews.map((n, i) => {
          const isRisk = n.isRisk || n.risk || n.is_risk || (n.sentiment || '').toLowerCase().includes('negative') || (n.category || '').toLowerCase().includes('risk')
          return (
            <div key={i} style={{ background: C.panel, borderRadius: 6, padding: 10, borderLeft: `3px solid ${isRisk ? C.red : C.border}` }}>
              {n.ticker && <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 10, color: C.blue, letterSpacing: "0.02em", marginBottom: 2, display: 'inline-block' }}>{n.ticker}</span>}
              <div style={{ fontFamily: FR, fontSize: 13, fontWeight: 600, color: isRisk ? C.red : C.textBright, lineHeight: 1.4 }}>{n.title || n.headline}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <Mono size={10} color={C.textDim}>{n.source || n.provider || ''}</Mono>
                <Mono size={10} color={C.textDim}>{n.time ? (typeof n.time === 'number' ? new Date(n.time * 1000).toLocaleDateString() : n.time) : n.published || n.date || ''}</Mono>
              </div>
              {n.summary && <div style={{ fontFamily: FR, fontSize: 11, color: C.textDim, marginTop: 4, lineHeight: 1.4 }}>{n.summary}</div>}
            </div>
          )
        })}
        {tab !== 'EARNINGS' && !nl && displayNews.length === 0 && <EmptyState text="No news available." />}

        {tab === 'EARNINGS' && earningsItems.length > 0 && earningsItems.map((e, i) => {
          const daysUntil = e.days_until ?? e.countdown ?? ''
          return (
            <div key={i} style={{ background: C.panel, borderRadius: 6, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `3px solid ${C.gold}` }}>
              <div>
                <span style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, color: C.textBright }}>{e.ticker || e.symbol}</span>
                <span style={{ fontFamily: FR, fontSize: 11, color: C.textDim, marginLeft: 8 }}>{e.date || e.earnings_date || ''}</span>
                {e.time_of_day && <span style={{ fontFamily: FM, fontSize: 10, color: C.textDim, marginLeft: 6 }}>{e.time_of_day}</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                {daysUntil !== '' && <Mono size={12} color={Number(daysUntil) <= 3 ? C.gold : C.textDim}>{daysUntil}d</Mono>}
                {e.estimate && <div><Mono size={10} color={C.textDim}>Est: {e.estimate}</Mono></div>}
              </div>
            </div>
          )
        })}
        {tab === 'EARNINGS' && !el && earningsItems.length === 0 && <EmptyState text="No upcoming earnings." />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: BREADTH
// ═══════════════════════════════════════════════════════════════════════════
function BreadthPage() {
  const { data: breadth, loading, error, reload } = useFetch('/api/breadth')

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} onRetry={reload} />
  if (!breadth) return <EmptyState text="Breadth data unavailable." />

  const bd = breadth
  const indices = [
    { label: 'SPY', data: bd.spy || bd.spx || bd.SPY || bd.SPX || {} },
    { label: 'QQQ', data: bd.qqq || bd.ndx || bd.QQQ || bd.NDX || {} },
    { label: 'IWM', data: bd.iwm || bd.rut || bd.IWM || bd.RUT || {} },
  ]
  const vix = bd.vix ?? bd.VIX ?? {}
  const vixVal = typeof vix === 'number' ? vix : (vix.value ?? vix.close ?? vix.last ?? '—')
  const sectorData = bd.sectors || bd.sector_performance || {}
  const sectorBars = Array.isArray(sectorData) ? sectorData.map(s => ({ label: s.n || s.name || s.sector || s.label || s.etf || '?', value: s.p ?? s.change ?? s.performance ?? s.value ?? 0 })) : Object.entries(sectorData).map(([k, v]) => ({ label: k, value: typeof v === 'number' ? v : (v?.p || v?.change || v?.performance || 0) }))
  const templateCount = bd.template_count ?? bd.qualifier_count ?? bd.templates ?? '—'
  const advDecl = bd.advance_decline ?? bd.adv_dec ?? {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
      <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, letterSpacing: "0.06em", color: C.textBright }}>MARKET BREADTH</div>

      {/* Index Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {indices.map(({ label, data: d }) => (
          <Panel key={label}>
            <div style={{ padding: 10, textAlign: 'center' }}>
              <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, color: C.textBright, marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, color: C.blue, marginBottom: 2 }}>Stage {d.stageLabel || d.weinstein_stage || d.stage || '—'}</div>
              <Pct v={d.chg ?? d.change ?? d.day_change ?? d.change_pct} size={12} />
              <div style={{ marginTop: 4 }}><Mono size={10} color={C.textDim}>{d.price ? `$${Number(d.price).toFixed(2)}` : ''}</Mono></div>
            </div>
          </Panel>
        ))}
      </div>

      {/* VIX */}
      <Panel borderColor={Number(vixVal) > 25 ? C.red : C.border}>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 12, letterSpacing: "0.04em", color: C.textDim }}>VIX</div>
          <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 24, color: Number(vixVal) > 25 ? C.red : Number(vixVal) > 18 ? C.gold : C.green }}>
            {typeof vixVal === 'number' ? vixVal.toFixed(2) : vixVal}
          </div>
        </div>
      </Panel>

      {/* Sector Performance */}
      {sectorBars.length > 0 && (
        <Panel>
          <SectionHeader title="SECTOR PERFORMANCE" />
          <div style={{ padding: 12 }}><BarChart data={sectorBars} /></div>
        </Panel>
      )}

      {/* Template Count */}
      <Panel>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: "0.04em", color: C.textDim }}>TEMPLATE QUALIFIERS</div>
          <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 20, color: C.purple }}>{templateCount}</div>
        </div>
      </Panel>

      {/* Advance/Decline */}
      {Object.keys(advDecl).length > 0 && (
        <Panel>
          <SectionHeader title="ADVANCE / DECLINE" />
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {Object.entries(advDecl).map(([k, v]) => (
              <div key={k} style={{ background: C.raised, borderRadius: 4, padding: 6, textAlign: 'center' }}>
                <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.02em", color: C.textDim, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                <Mono size={12}>{v}</Mono>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: JOURNAL — Trade Log + Analytics
// ═══════════════════════════════════════════════════════════════════════════
function JournalPage() {
  const { data: journal, loading: jl, error: je, reload: jr } = useFetch('/api/journal')
  const { data: analytics, loading: al, reload: ar } = useFetch('/api/journal/analytics')
  const [showForm, setShowForm] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [form, setForm] = useState({ ticker: '', direction: 'LONG', entry_price: '', exit_price: '', entry_date: '', exit_date: '', shares: '', grade: '', zone: '', phase: '', setupType: '', rMultiple: '', notes: '' })

  const trades = Array.isArray(journal) ? journal : (journal?.trades || journal?.entries || journal?.journal || [])
  const stats = analytics || {}

  const handleAdd = async () => {
    try {
      const body = { ...form, entry_price: Number(form.entry_price) || 0, exit_price: Number(form.exit_price) || undefined, shares: Number(form.shares) || 1, rMultiple: form.rMultiple ? Number(form.rMultiple) : undefined }
      await apiPost('/api/journal', body)
      setShowForm(false)
      setForm({ ticker: '', direction: 'LONG', entry_price: '', exit_price: '', entry_date: '', exit_date: '', shares: '', grade: '', zone: '', phase: '', setupType: '', rMultiple: '', notes: '' })
      jr(); ar()
    } catch {}
  }

  const handleDelete = async (id) => {
    try { await apiDelete(`/api/journal/${id}`); jr(); ar() } catch {}
  }

  const inputStyle = { background: C.raised, border: `1px solid ${C.border}`, borderRadius: 4, padding: '8px 10px', fontFamily: FM, fontSize: 12, color: C.textBright, width: '100%' }

  if (jl) return <Loading />
  if (je) return <ErrorMsg msg={je} onRetry={jr} />

  const winRateByGrade = stats.win_rate_by_grade || stats.by_grade || {}
  const winRateByZone = stats.win_rate_by_zone || stats.by_zone || {}
  const winRateByPhase = stats.win_rate_by_phase || stats.by_phase || {}
  const monthlyPnl = stats.monthly_pnl || stats.monthly || {}
  const insights = stats.insights || stats.auto_insights || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, letterSpacing: "0.06em", color: C.textBright }}>TRADE JOURNAL</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAnalytics(!showAnalytics)} style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.02em", color: C.purple, padding: '5px 10px', border: `1px solid ${C.purple}44`, borderRadius: 4 }}>STATS</button>
          <button onClick={() => setShowForm(!showForm)} style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.02em", color: C.green, padding: '5px 10px', border: `1px solid ${C.green}44`, borderRadius: 4 }}>{showForm ? 'CANCEL' : '+ ADD'}</button>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <Panel borderColor={C.green}>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input placeholder="TICKER" value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value.toUpperCase() })} style={inputStyle} />
              <select value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })} style={inputStyle}>
                <option value="LONG">LONG</option><option value="SHORT">SHORT</option>
              </select>
              <input placeholder="Entry $" value={form.entry_price} onChange={e => setForm({ ...form, entry_price: e.target.value })} style={inputStyle} type="number" step="0.01" />
              <input placeholder="Exit $" value={form.exit_price} onChange={e => setForm({ ...form, exit_price: e.target.value })} style={inputStyle} type="number" step="0.01" />
              <input placeholder="Entry Date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} style={inputStyle} type="date" />
              <input placeholder="Exit Date" value={form.exit_date} onChange={e => setForm({ ...form, exit_date: e.target.value })} style={inputStyle} type="date" />
              <input placeholder="Shares" value={form.shares} onChange={e => setForm({ ...form, shares: e.target.value })} style={inputStyle} type="number" />
              <input placeholder="Grade (e.g. AA)" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value.toUpperCase() })} style={inputStyle} />
              <input placeholder="Zone" value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value.toUpperCase() })} style={inputStyle} />
              <input placeholder="Phase" value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })} style={inputStyle} />
              <select value={form.setupType} onChange={e => setForm({ ...form, setupType: e.target.value })} style={inputStyle}>
                <option value="">Setup Type</option>
                <option value="MKW_CONVERGENCE">MKW Convergence</option>
                <option value="DUAL_CONVERGENCE">Dual Convergence</option>
                <option value="BREAKOUT">Q: Breakout</option>
                <option value="PARABOLIC_SHORT">Q: Parabolic Short</option>
                <option value="PARABOLIC_LONG">Q: Parabolic Long</option>
                <option value="EPISODIC_PIVOT">Q: Episodic Pivot</option>
              </select>
              <input placeholder="R-Multiple" value={form.rMultiple} onChange={e => setForm({ ...form, rMultiple: e.target.value })} style={inputStyle} type="number" step="0.1" />
            </div>
            <textarea placeholder="Notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, height: 60, resize: 'none', fontFamily: FR }} />
            <button onClick={handleAdd} style={{ fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: "0.04em", color: C.bg, background: C.green, padding: '10px 0', borderRadius: 4, width: '100%' }}>LOG TRADE</button>
          </div>
        </Panel>
      )}

      {/* Analytics Section */}
      {showAnalytics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {al && <Loading text="LOADING ANALYTICS..." />}
          {/* Overall Stats */}
          <Panel borderColor={C.purple}>
            <SectionHeader title="PERFORMANCE ANALYTICS" />
            <div style={{ padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                {[
                  { l: 'WIN RATE', v: stats.win_rate, fmt: v => typeof v === 'number' ? (v > 1 ? v.toFixed(1) : (v * 100).toFixed(1)) + '%' : v, color: C.green },
                  { l: 'AVG WIN', v: stats.avg_win, fmt: v => typeof v === 'number' ? (v > 1 ? '+$' + v.toFixed(0) : '+' + (v * 100).toFixed(1) + '%') : v, color: C.green },
                  { l: 'AVG LOSS', v: stats.avg_loss, fmt: v => typeof v === 'number' ? (Math.abs(v) > 1 ? '-$' + Math.abs(v).toFixed(0) : (v * 100).toFixed(1) + '%') : v, color: C.red },
                  { l: 'PROFIT F', v: stats.profit_factor, fmt: v => typeof v === 'number' ? v.toFixed(2) + 'x' : v, color: C.gold },
                ].map(({ l, v, fmt, color }) => (
                  <div key={l} style={{ background: C.raised, borderRadius: 4, padding: 6, textAlign: 'center' }}>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: "0.03em", color: C.textDim }}>{l}</div>
                    <Mono size={12} color={color}>{v != null ? fmt(v) : '—'}</Mono>
                  </div>
                ))}
              </div>

              {/* Win Rate by Grade */}
              {Object.keys(winRateByGrade).length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 4 }}>WIN RATE BY GRADE</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(winRateByGrade).map(([grade, rate]) => (
                      <div key={grade} style={{ background: C.raised, borderRadius: 4, padding: '4px 8px', textAlign: 'center' }}>
                        <GradeBadge grade={grade} size={10} />
                        <div><Mono size={10} color={C.text}>{typeof rate === 'number' ? (rate > 1 ? rate.toFixed(0) : (rate * 100).toFixed(0)) + '%' : rate}</Mono></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Win Rate by Zone */}
              {Object.keys(winRateByZone).length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 4 }}>WIN RATE BY ZONE</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(winRateByZone).map(([zone, rate]) => (
                      <div key={zone} style={{ background: C.raised, borderRadius: 4, padding: '4px 8px', textAlign: 'center' }}>
                        <ZoneBadge zone={zone} />
                        <div><Mono size={10} color={C.text}>{typeof rate === 'number' ? (rate > 1 ? rate.toFixed(0) : (rate * 100).toFixed(0)) + '%' : rate}</Mono></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Win Rate by Phase */}
              {Object.keys(winRateByPhase).length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 4 }}>WIN RATE BY PHASE</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(winRateByPhase).map(([phase, rate]) => (
                      <div key={phase} style={{ background: C.raised, borderRadius: 4, padding: '4px 8px', textAlign: 'center' }}>
                        <Mono size={10} color={C.blue}>{phase}</Mono>
                        <div><Mono size={10} color={C.text}>{typeof rate === 'number' ? (rate > 1 ? rate.toFixed(0) : (rate * 100).toFixed(0)) + '%' : rate}</Mono></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly P&L */}
              {Object.keys(monthlyPnl).length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: FO, fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", color: C.textDim, marginBottom: 4 }}>MONTHLY P&L</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                    {Object.entries(monthlyPnl).map(([month, pnl]) => {
                      const n = Number(pnl) || 0
                      return (
                        <div key={month} style={{ background: C.raised, borderRadius: 4, padding: '4px 6px', textAlign: 'center' }}>
                          <div style={{ fontFamily: FM, fontSize: 8, color: C.textDim }}>{month}</div>
                          <Mono size={10} color={n >= 0 ? C.green : C.red}>{n >= 0 ? '+' : ''}{typeof pnl === 'number' ? (Math.abs(pnl) > 100 ? `$${pnl.toFixed(0)}` : `${(pnl * 100).toFixed(1)}%`) : pnl}</Mono>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Insights */}
              {(Array.isArray(insights) ? insights : []).length > 0 && (
                <div>
                  <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", color: C.gold, marginBottom: 4 }}>AUTO-GENERATED INSIGHTS</div>
                  {insights.map((ins, i) => (
                    <div key={i} style={{ fontFamily: FR, fontSize: 12, fontWeight: 500, color: C.text, padding: '3px 0', lineHeight: 1.5 }}>
                      <span style={{ color: C.gold, marginRight: 4 }}>*</span>
                      {typeof ins === 'string' ? ins : ins.message || ins.insight || JSON.stringify(ins)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* Trade List */}
      {trades.length === 0 && <EmptyState text="No trades logged. Start journaling to track your edge." />}
      {trades.map((t, i) => {
        const entry = Number(t.entry_price || t.entry || 0)
        const exit = Number(t.exit_price || t.exit || 0)
        const isLong = (t.direction || 'LONG').toUpperCase() === 'LONG'
        const pnlPct = entry > 0 && exit > 0 ? ((exit - entry) / entry * 100 * (isLong ? 1 : -1)) : null
        const pnlColor = pnlPct != null ? (pnlPct >= 0 ? C.green : C.red) : C.textDim
        return (
          <Panel key={t.id || i} borderColor={pnlColor + '33'}>
            <div style={{ padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: FM, fontWeight: 700, fontSize: 15, color: C.textBright }}>{t.ticker || t.symbol}</span>
                  <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, color: isLong ? C.green : C.red }}>{t.direction || 'LONG'}</span>
                  {t.grade && <GradeBadge grade={t.grade} size={10} />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {pnlPct != null && <Mono size={13} color={pnlColor}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</Mono>}
                  <button onClick={() => handleDelete(t.id)} style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, color: C.red, padding: '2px 6px', border: `1px solid ${C.red}33`, borderRadius: 3 }}>X</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Mono size={10} color={C.textDim}>Entry: ${entry.toFixed(2)}</Mono>
                {exit > 0 && <Mono size={10} color={C.textDim}>Exit: ${exit.toFixed(2)}</Mono>}
                {t.entry_date && <Mono size={10} color={C.textDim}>{t.entry_date}</Mono>}
                {t.exit_date && <Mono size={10} color={C.textDim}>{t.exit_date}</Mono>}
                {t.zone && <ZoneBadge zone={t.zone} />}
              </div>
              {t.notes && <div style={{ fontFamily: FR, fontSize: 11, color: C.textDim, marginTop: 4 }}>{t.notes}</div>}
            </div>
          </Panel>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// MARKET WIZARD — Floating AI Chat Agent
// ═══════════════════════════════════════════════════════════════════════════

function MarketWizard({ currentPage, pageData, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [provider, setProvider] = useState('')
  const scrollRef = { current: null }
  const inputRef = { current: null }

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }

  useEffect(() => { scrollToBottom() }, [messages])

  // Stream response from wizard API
  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || streaming) return
    setInput('')

    // Add user message
    const userMsg = { role: 'user', content: msg, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])

    // Prepare conversation history (last 20 messages)
    const history = [...messages, userMsg].slice(-20).map(m => ({ role: m.role, content: m.content }))

    // Build page context
    const context = {}
    if (currentPage === 'analyze' && pageData?.currentTicker) {
      context.currentTicker = pageData.currentTicker
    }

    // Start streaming
    setStreaming(true)
    setProvider('')
    const assistantMsg = { role: 'assistant', content: '', ts: Date.now(), streaming: true, suggestions: [] }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const resp = await fetch('/api/wizard/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, conversationHistory: history, context }),
      })

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let prov = ''
      let suggestions = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'provider') {
              prov = data.provider
              setProvider(prov)
            } else if (data.type === 'content') {
              fullText += data.content
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: fullText }
                }
                return updated
              })
            } else if (data.type === 'suggestions') {
              suggestions = data.suggestions || []
            } else if (data.type === 'error') {
              fullText = data.error || 'An error occurred.'
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: fullText, isError: true }
                }
                return updated
              })
            } else if (data.type === 'done') {
              // done
            }
          } catch {}
        }
      }

      // Finalize
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last && last.role === 'assistant') {
          updated[updated.length - 1] = { ...last, streaming: false, provider: prov, suggestions }
        }
        return updated
      })

    } catch (e) {
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last && last.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: 'Connection failed. Check your internet and try again.', streaming: false, isError: true }
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  const clearChat = () => { setMessages([]); setProvider('') }

  // Render message text with basic formatting
  const renderText = (text) => {
    if (!text) return null
    return text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: 6 }} />
      // Bold **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j} style={{ color: C.textBright }}>{part.slice(2, -2)}</strong>
        }
        // Make tickers clickable
        return part.split(/(\$[A-Z]{1,5}\b|(?<=\s)[A-Z]{2,5}(?=\s|$|\.|,))/).map((seg, k) => {
          const tickerMatch = seg.match(/^\$?([A-Z]{2,5})$/)
          if (tickerMatch && onNavigate) {
            const t = tickerMatch[1]
            return <span key={k} onClick={() => { onNavigate('analyze'); /* could set ticker */ }} style={{ color: C.blue, textDecoration: 'underline', cursor: 'pointer' }}>{seg}</span>
          }
          return seg
        })
      })
      // Emoji-prefixed lines get special treatment
      const isHeader = /^[📊⚡📈🎯📍💡📋🌍•]/.test(line.trim())
      return <div key={i} style={{
        fontFamily: isHeader ? FM : FR, fontSize: isHeader ? 12 : 13,
        fontWeight: isHeader ? 600 : 400, color: isHeader ? C.textBright : C.text,
        lineHeight: 1.6, letterSpacing: isHeader ? 0.5 : 0,
      }}>{parts}</div>
    })
  }

  const defaultQuickActions = [
    "What's the market doing today?",
    "Analyze $NVDA",
    "Best setups right now",
    "Explain Stage 2 entries",
  ]

  // Last message's suggestions or defaults
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null
  const quickActions = (lastMsg?.role === 'assistant' && lastMsg.suggestions?.length > 0)
    ? lastMsg.suggestions
    : (messages.length === 0 ? defaultQuickActions : [])

  // ── FLOATING BUBBLE ──
  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} style={{
        position: 'fixed', bottom: 76, right: 16, zIndex: 1000,
        width: 52, height: 52, borderRadius: '50%',
        background: C.panel,
        border: `2px solid ${C.blue}44`,
        boxShadow: shadows.lg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.3s',
      }}>
        <span style={{ fontSize: 22 }}>✨</span>
      </button>
    )
  }

  // ── CHAT PANEL ──
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, top: 0, zIndex: 1001,
      background: colors.bg.root,
      display: 'flex', flexDirection: 'column',
      animation: 'fadeIn 0.2s ease',
    }}>
      {/* Header */}
      <div style={{
        height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        background: C.panel,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 12, letterSpacing: "0.04em", color: C.gold }}>MARKET WIZARD</span>
          {provider && <span style={{ fontFamily: FM, fontSize: 9, color: C.textDim }}>via {provider}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {messages.length > 0 && (
            <button onClick={clearChat} style={{
              fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: "0.03em",
              color: C.textDim, padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 4,
            }}>NEW</button>
          )}
          <button onClick={() => setIsOpen(false)} style={{
            fontFamily: FO, fontWeight: 700, fontSize: 16, color: C.textDim, padding: '0 4px',
          }}>✕</button>
        </div>
      </div>

      {/* Messages */}
      <div ref={el => scrollRef.current = el} style={{
        flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Welcome message */}
        {messages.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
            <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 14, letterSpacing: "0.04em", color: C.gold, marginBottom: 8 }}>MARKET WIZARD</div>
            <div style={{ fontFamily: FR, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
              I'm your MKW trading strategist. Ask me anything about the markets, analyze a ticker, or learn about the convergence framework.
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '88%',
          }}>
            <div style={{
              background: msg.role === 'user' ? `${C.blue}15` : msg.isError ? `${C.red}15` : C.raised,
              border: `1px solid ${msg.role === 'user' ? `${C.blue}33` : msg.isError ? `${C.red}33` : C.border}`,
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              padding: '10px 14px',
            }}>
              {msg.role === 'user' ? (
                <div style={{ fontFamily: FR, fontSize: 13, color: C.textBright, lineHeight: 1.5 }}>{msg.content}</div>
              ) : (
                <div>{renderText(msg.content)}</div>
              )}
              {msg.streaming && !msg.content && (
                <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{
                      width: 6, height: 6, borderRadius: '50%', background: C.blue,
                      animation: `pulse 1.2s ease ${j * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              )}
            </div>
            {/* Meta line */}
            <div style={{ display: 'flex', gap: 8, marginTop: 2, padding: '0 4px' }}>
              <span style={{ fontFamily: FM, fontSize: 8, color: C.textDim }}>
                {msg.ts ? new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
              {msg.provider && <span style={{ fontFamily: FM, fontSize: 8, color: C.textDim }}>via {msg.provider}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      {quickActions.length > 0 && !streaming && (
        <div style={{
          display: 'flex', gap: 6, padding: '6px 12px', overflowX: 'auto', flexShrink: 0,
          borderTop: `1px solid ${C.border}22`,
        }}>
          {quickActions.map((q, i) => (
            <button key={i} onClick={() => sendMessage(q)} style={{
              fontFamily: FM, fontSize: 10, color: C.blue, whiteSpace: 'nowrap',
              padding: '6px 12px', borderRadius: 16,
              background: `${C.blue}11`, border: `1px solid ${C.blue}33`,
              flexShrink: 0,
            }}>{q}</button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px',
        borderTop: `1px solid ${C.border}`, background: C.panel, flexShrink: 0,
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
      }}>
        <input
          ref={el => inputRef.current = el}
          value={input}
          onChange={e => setInput(e.target.value.slice(0, 500))}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder={streaming ? 'Wizard is thinking...' : 'Ask the Wizard...'}
          disabled={streaming}
          style={{
            flex: 1, background: C.raised, border: `1px solid ${streaming ? C.border : C.blue}33`,
            borderRadius: 20, padding: '10px 16px',
            fontFamily: FR, fontSize: 14, color: C.textBright,
            opacity: streaming ? 0.5 : 1,
          }}
        />
        <button onClick={() => sendMessage()} disabled={streaming || !input.trim()} style={{
          width: 40, height: 40, borderRadius: '50%',
          background: input.trim() && !streaming ? C.blue : C.raised,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: input.trim() && !streaming ? 1 : 0.3,
          transition: 'all 0.2s',
        }}>
          <span style={{ fontFamily: FM, fontSize: 16, color: input.trim() && !streaming ? C.bg : C.textDim }}>→</span>
        </button>
      </div>
    </div>
  )
}

const NAV_ITEMS = [
  { key: 'home', label: 'HOME', icon: '\u2302' },
  { key: 'watch', label: 'WATCH', icon: '\u25C9' },
  { key: 'plays', label: 'PLAYS', icon: '\u25B2' },
  { key: 'brief', label: 'BRIEF', icon: '\u2261' },
  { key: 'more', label: 'MORE', icon: '\u2026' },
]

const MORE_ITEMS = [
  { key: 'challenge', label: '$5K CHALLENGE' },
  { key: 'momentum', label: 'MOMENTUM' },
  { key: 'analyze', label: 'ANALYZE' },
  { key: 'screener', label: 'SCREENER' },
  { key: 'news', label: 'NEWS' },
  { key: 'breadth', label: 'BREADTH' },
  { key: 'journal', label: 'JOURNAL' },
]

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: colors.bg.root, color: colors.signal.loss, padding: 30, textAlign: 'center', fontFamily: fonts.body }}>
        <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 18, marginBottom: 12 }}>SYSTEM ERROR</div>
        <div style={{ fontSize: 13, color: colors.text.secondary, marginBottom: 16, maxWidth: 320 }}>{String(this.state.error?.message || this.state.error)}</div>
        <button onClick={() => { this.setState({ error: null }); window.location.reload() }} style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 13, color: colors.accent.primary, background: colors.accent.primaryMuted, border: `1px solid ${colors.accent.primary}40`, borderRadius: radius.sm, padding: '10px 24px', cursor: 'pointer', textTransform: 'uppercase' }}>RELOAD</button>
      </div>
    )
    return this.props.children
  }
}

function AppInner() {
  const [page, setPage] = useState('home')
  const [showMore, setShowMore] = useState(false)

  const navigate = (key) => {
    if (key === 'more') {
      setShowMore(!showMore)
      return
    }
    setShowMore(false)
    setPage(key)
  }

  const renderPage = () => {
    switch (page) {
      case 'home': return <HomePage />
      case 'watch': return <WatchPage />
      case 'plays': return <PlaysPage />
      case 'brief': return <BriefPage />
      case 'momentum': return <MomentumPage />
      case 'analyze': return <AnalyzePage />
      case 'screener': return <ScreenerPage />
      case 'news': return <NewsPage />
      case 'breadth': return <BreadthPage />
      case 'journal': return <JournalPage />
      case 'challenge': return <ChallengeApp onBack={() => setPage('home')} />
      default: return <HomePage />
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: FR }}>
      <style>{GLOBAL_CSS}</style>

      {/* Top Bar */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        position: 'relative',
      }}>
        <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 18, color: C.textBright }}>MKW</span>
        <span style={{ fontFamily: FO, fontWeight: 500, fontSize: 13, color: C.textDim, marginLeft: 10 }}>{page.toUpperCase()}</span>
      </div>

      {/* Data Status Bar */}
      <DataStatusBar />

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 70, WebkitOverflowScrolling: 'touch' }}>
        {renderPage()}
      </div>

      {/* More Menu Overlay */}
      {showMore && (
        <div style={{
          position: 'fixed', bottom: 60, left: 0, right: 0,
          background: C.panel, borderTop: `1px solid ${C.border}`,
          animation: 'fadeIn 0.15s ease', zIndex: 100,
        }}>
          {MORE_ITEMS.map(item => (
            <button key={item.key} onClick={() => navigate(item.key)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              fontFamily: FO, fontWeight: 600, fontSize: 13,
              color: page === item.key ? colors.accent.primary : C.textBright,
              padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
              background: page === item.key ? colors.accent.primaryMuted : 'transparent',
            }}>{item.label}</button>
          ))}
        </div>
      )}

      {/* Market Wizard */}
      <MarketWizard currentPage={page} onNavigate={navigate} />

      {/* Bottom Nav */}
      <div style={{
        height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        background: C.panel, borderTop: `1px solid ${C.border}`,
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
      }}>
        {NAV_ITEMS.map(item => {
          const isActive = item.key === 'more' ? showMore : (page === item.key || (item.key === 'more' && MORE_ITEMS.some(m => m.key === page)))
          return (
            <button key={item.key} onClick={() => navigate(item.key)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '6px 12px', minWidth: 56,
            }}>
              <span style={{ fontSize: 18, color: isActive ? colors.accent.primary : C.textDim, transition: transitions.normal }}>{item.icon}</span>
              <span style={{
                fontFamily: FO, fontWeight: 600, fontSize: 9,
                color: isActive ? colors.accent.primary : C.textDim, transition: transitions.normal,
              }}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>
}
