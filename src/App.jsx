import { useState, useEffect, useCallback, Component } from 'react'

// ── GOOGLE FONTS ──────────────────────────────────────────────────────────
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;800;900&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap"

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────
const C = {
  bg: '#020408', panel: '#080d16', raised: '#0e1520',
  border: '#1a2535', borderHi: '#243247',
  green: '#00ff88', red: '#ff2a44', gold: '#ffcc00',
  blue: '#00ccff', purple: '#a855f7',
  textBright: '#e8edf5', text: 'rgba(180,200,230,0.7)', textDim: 'rgba(180,200,230,0.35)',
}
const FO = "'Orbitron', monospace"
const FR = "'Rajdhani', sans-serif"
const FM = "'Share Tech Mono', monospace"

const glow = (color, r = 12) => `0 0 ${r}px ${color}`
const gradeColor = (g) => {
  if (!g) return C.textDim
  const s = String(g).toUpperCase()
  if (s === 'AAA') return C.gold
  if (s === 'AA' || s === 'AA+' || s === 'AA-') return C.green
  if (s === 'A' || s === 'A+' || s === 'A-') return C.blue
  if (s.startsWith('BBB')) return '#8899b4'
  return C.red
}
const gradeGlow = (g) => {
  const c = gradeColor(g)
  if (c === '#8899b4') return 'none'
  if (c === C.gold) return glow(C.gold, 20)
  if (c === C.green) return glow(C.green, 15)
  if (c === C.blue) return glow(C.blue, 12)
  if (c === C.red) return glow(C.red, 12)
  return 'none'
}
const zoneColor = (z) => {
  if (!z) return C.textDim
  const s = String(z).toUpperCase()
  if (s.includes('CONVERGENCE')) return C.gold
  if (s.includes('SECONDARY')) return C.blue
  if (s.includes('BUILDING')) return C.purple
  if (s.includes('SHORT')) return C.red
  return C.textDim
}

// ── GLOBAL CSS ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('${FONT_LINK}');
*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
html,body,#root{height:100%;width:100%;background:${C.bg};overflow:hidden}
body{overscroll-behavior:none}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
button{cursor:pointer;border:none;background:none;-webkit-tap-highlight-color:transparent}
input,select,textarea{outline:none;-webkit-appearance:none}
`

// ── REUSABLE PRIMITIVES ───────────────────────────────────────────────────
const Scanline = () => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    pointerEvents: 'none', zIndex: 9999, opacity: 0.03,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
  }} />
)

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
          <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 6 }}>DATA SOURCES</div>
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
    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 12, letterSpacing: 3, color: C.blue, animation: 'pulse 1.5s infinite', textShadow: glow(C.blue, 8) }}>{text}</div>
  </div>
)

const ErrorMsg = ({ msg, onRetry }) => (
  <div style={{ padding: 20, textAlign: 'center' }}>
    <div style={{ fontFamily: FR, fontSize: 13, color: C.red, marginBottom: 12 }}>{msg || 'Error loading data'}</div>
    {onRetry && <button onClick={onRetry} style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: 2, color: C.blue, padding: '6px 16px', border: `1px solid ${C.blue}`, borderRadius: 4, background: 'transparent' }}>RETRY</button>}
  </div>
)

const EmptyState = ({ text }) => (
  <div style={{ padding: 30, textAlign: 'center' }}>
    <div style={{ fontFamily: FR, fontSize: 14, fontWeight: 500, color: C.textDim, lineHeight: 1.6 }}>{text || "No AAA setups today. Capital preservation IS a position."}</div>
  </div>
)

const Panel = ({ children, style, borderColor, glow: glowColor }) => (
  <div style={{
    background: C.panel, borderRadius: 8, border: `1px solid ${borderColor || C.border}`,
    boxShadow: glowColor ? `0 0 12px ${glowColor}33, inset 0 1px 0 rgba(255,255,255,0.03)` : 'inset 0 1px 0 rgba(255,255,255,0.03)',
    overflow: 'hidden', ...style,
  }}>{children}</div>
)

const SectionHeader = ({ title, right, onClick, expanded }) => (
  <div onClick={onClick} style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', cursor: onClick ? 'pointer' : 'default',
    borderBottom: `1px solid ${C.border}`,
  }}>
    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: 2.5, color: C.textBright, textTransform: 'uppercase' }}>{title}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {right}
      {onClick != null && <span style={{ fontFamily: FM, fontSize: 11, color: C.textDim }}>{expanded ? '▲' : '▼'}</span>}
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
  return <span style={{ color: c, fontSize: size, fontFamily: FM, textShadow: glow(c, 6) }}>{n >= 0 ? '+' : ''}{n.toFixed(2)}%</span>
}

const Mono = ({ children, color, size = 12, style: s }) => (
  <span style={{ fontFamily: FM, fontSize: size, color: color || C.textBright, textShadow: color ? glow(color, 6) : 'none', ...s }}>{children}</span>
)

const GradeBadge = ({ grade, size = 22 }) => {
  const c = gradeColor(grade)
  return (
    <span style={{ fontFamily: FO, fontWeight: 900, fontSize: size, color: c, textShadow: gradeGlow(grade), letterSpacing: 1 }}>
      {grade || '—'}
    </span>
  )
}

const ZoneBadge = ({ zone }) => {
  const c = zoneColor(zone)
  return (
    <span style={{
      fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 1.5,
      color: c, textShadow: glow(c, 6), padding: '2px 8px',
      border: `1px solid ${c}44`, borderRadius: 3, background: `${c}11`,
    }}>{zone || 'WATCH'}</span>
  )
}

const TabBar = ({ tabs, active, onSelect }) => (
  <div style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: `1px solid ${C.border}`, padding: '0 8px' }}>
    {tabs.map(t => (
      <button key={t} onClick={() => onSelect(t)} style={{
        fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2,
        color: active === t ? C.blue : C.textDim, padding: '10px 12px', flexShrink: 0,
        borderBottom: active === t ? `2px solid ${C.blue}` : '2px solid transparent',
        transition: 'all 0.2s',
      }}>{t}</button>
    ))}
  </div>
)

const TrafficLight = ({ color }) => {
  const c = color === 'green' ? C.green : color === 'red' ? C.red : C.gold
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%', background: c,
      boxShadow: `0 0 10px ${c}, 0 0 20px ${c}55`, flexShrink: 0,
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
  const kellLight = (spx.stage || '').includes('2') ? 'green' : (spx.stage || '').includes('3') || (spx.stage || '').includes('4') ? 'red' : 'yellow'

  const sectorData = bd.sectors || bd.sector_performance || []
  const sectorBars = (Array.isArray(sectorData) ? sectorData : Object.entries(sectorData).map(([k, v]) => ({ label: k, value: typeof v === 'number' ? v : v?.change || 0 }))).slice(0, 11)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
      {/* Market Regime */}
      <Panel borderColor={C.border}>
        <SectionHeader title="MARKET REGIME" right={<TrafficLight color={kellLight} />} />
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[{ label: 'SPX', d: spx }, { label: 'NDX', d: ndx }, { label: 'RUT', d: rut }].map(({ label, d }) => (
              <div key={label} style={{ background: C.raised, borderRadius: 6, padding: 8, textAlign: 'center' }}>
                <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 13, color: C.textBright }}>{d.stage || d.weinstein_stage || '—'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim }}>VIX</div>
              <Mono size={16} color={Number(vix) > 25 ? C.red : Number(vix) > 18 ? C.gold : C.green}>{typeof vix === 'number' ? vix.toFixed(1) : vix}</Mono>
            </div>
            <div>
              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim }}>TEMPLATES</div>
              <Mono size={16} color={C.blue}>{templateCount}</Mono>
            </div>
            <div>
              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim }}>KELL LIGHT</div>
              <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 13, color: kellLight === 'green' ? C.green : kellLight === 'red' ? C.red : C.gold, textShadow: glow(kellLight === 'green' ? C.green : kellLight === 'red' ? C.red : C.gold, 10) }}>{kellLight.toUpperCase()}</div>
            </div>
          </div>
          {/* Environment Verdict */}
          <div style={{ background: C.raised, borderRadius: 6, padding: 10 }}>
            <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>ENVIRONMENT VERDICT</div>
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
                <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim }}>MACRO SCORE</div>
                <Mono size={20} color={macroData.score.color === 'green' ? C.green : macroData.score.color === 'red' ? C.red : C.gold}>{macroData.score.score}/10</Mono>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim }}>SIZING</div>
                <Mono size={11} color={C.text}>{macroData.score.sizing}</Mono>
              </div>
            </div>
            {macroData.rates && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {macroData.rates.ten_year != null && <div style={{ background: C.raised, borderRadius: 4, padding: 6, textAlign: 'center' }}><div style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1, color: C.textDim }}>10Y</div><Mono size={12}>{Number(macroData.rates.ten_year).toFixed(2)}%</Mono></div>}
                {macroData.rates.two_year != null && <div style={{ background: C.raised, borderRadius: 4, padding: 6, textAlign: 'center' }}><div style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1, color: C.textDim }}>2Y</div><Mono size={12}>{Number(macroData.rates.two_year).toFixed(2)}%</Mono></div>}
                {macroData.rates.yield_curve != null && <div style={{ background: C.raised, borderRadius: 4, padding: 6, textAlign: 'center' }}><div style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1, color: C.textDim }}>CURVE</div><Mono size={12} color={Number(macroData.rates.yield_curve) > 0 ? C.green : C.red}>{Number(macroData.rates.yield_curve).toFixed(2)}</Mono></div>}
              </div>
            )}
            {macroData.events && macroData.events.length > 0 && (
              <div>
                <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>UPCOMING EVENTS</div>
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
          <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: 2, color: C.gold, textShadow: glow(C.gold, 8) }}>NO AAA SETUPS</div>
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
              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color, textShadow: glow(color, 6), padding: '4px 8px' }}>{label}</div>
              {group.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderBottom: `1px solid ${C.border}22` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 13, color: C.textBright }}>{s.ticker || s.symbol}</span>
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
                <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 22, color: C.textBright }}>{topSetup.ticker || topSetup.symbol}</div>
                <div style={{ fontFamily: FR, fontWeight: 500, fontSize: 12, color: C.text }}>{topSetup.name || topSetup.company || ''}</div>
              </div>
              <GradeBadge grade={topSetup.grade} size={32} />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div><div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim }}>PRICE</div><Mono size={14}>${topSetup.price != null ? Number(topSetup.price).toFixed(2) : '—'}</Mono></div>
              <div><div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim }}>SCORE</div><Mono size={14} color={zoneColor(topSetup.zone)}>{topSetup.convergence_score ?? topSetup.score ?? '—'}/23</Mono></div>
              <div><div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim }}>ZONE</div><ZoneBadge zone={topSetup.zone} /></div>
              <div><div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim }}>STAGE</div><Mono size={14}>{topSetup.stage || topSetup.weinstein_stage || '—'}</Mono></div>
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
function WatchPage() {
  const { data: watchlist, loading, error, reload } = useFetch('/api/watchlist')
  const [filter, setFilter] = useState('ALL')
  const [expanded, setExpanded] = useState({})
  const [techCache, setTechCache] = useState({})
  const [srCache, setSrCache] = useState({})

  const items = Array.isArray(watchlist) ? watchlist : (watchlist?.watchlist || watchlist?.stocks || watchlist?.items || [])
  const sorted = [...items].sort((a, b) => (b.convergence_score || b.score || 0) - (a.convergence_score || a.score || 0))

  const zones = ['ALL', 'CONVERGENCE', 'SECONDARY', 'BUILDING', 'WATCH', 'SHORT']
  const filtered = filter === 'ALL' ? sorted : sorted.filter(s => {
    const z = (s.zone || '').toUpperCase()
    if (filter === 'SHORT') return z.includes('SHORT')
    return z.includes(filter)
  })

  const toggle = async (ticker) => {
    setExpanded(prev => ({ ...prev, [ticker]: !prev[ticker] }))
    if (!expanded[ticker] && !techCache[ticker]) {
      try {
        const [tech, sr] = await Promise.all([
          api(`/api/technicals/${ticker}`).catch(() => null),
          api(`/api/support-resistance/${ticker}`).catch(() => null),
        ])
        setTechCache(prev => ({ ...prev, [ticker]: tech }))
        setSrCache(prev => ({ ...prev, [ticker]: sr }))
      } catch {}
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg msg={error} onRetry={reload} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <TabBar tabs={zones} active={filter} onSelect={setFilter} />
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: FM, fontSize: 10, color: C.textDim, padding: '0 4px' }}>{filtered.length} names</div>
        {filtered.length === 0 && <EmptyState />}
        {filtered.map((s) => {
          const ticker = s.ticker || s.symbol || '???'
          const isOpen = expanded[ticker]
          const tech = techCache[ticker]
          const sr = srCache[ticker]
          const checklist = s.checklist || s.convergence_checklist || []
          return (
            <Panel key={ticker} borderColor={isOpen ? zoneColor(s.zone) : C.border} glow={isOpen ? zoneColor(s.zone) : undefined}>
              <div onClick={() => toggle(ticker)} style={{ padding: 12, cursor: 'pointer' }}>
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
                  <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1.5, color: C.textDim }}>DAY </span><Pct v={s.day_change ?? s.change_1d} size={11} /></div>
                  <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1.5, color: C.textDim }}>WK </span><Pct v={s.week_change ?? s.change_1w} size={11} /></div>
                  <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1.5, color: C.textDim }}>MO </span><Pct v={s.month_change ?? s.change_1m} size={11} /></div>
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
                {s.flags && s.flags.length > 0 && <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>{s.flags.map((f, i) => <span key={i} style={{ fontFamily: FM, fontSize: 9, color: C.gold, background: `${C.gold}11`, border: `1px solid ${C.gold}33`, borderRadius: 3, padding: '1px 6px' }}>{f}</span>)}</div>}
              </div>
              {isOpen && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: 12, animation: 'fadeIn 0.2s ease' }}>
                  {/* Convergence Checklist */}
                  {checklist.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 6 }}>CONVERGENCE CHECKLIST</div>
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
                  {/* Technicals */}
                  {tech && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 6 }}>TECHNICALS</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                        {Object.entries(tech).filter(([k]) => !['ticker', 'symbol', 'error'].includes(k)).slice(0, 12).map(([k, v]) => (
                          <div key={k} style={{ background: C.raised, borderRadius: 4, padding: '4px 6px' }}>
                            <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1, color: C.textDim, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                            <Mono size={10}>{typeof v === 'number' ? v.toFixed(2) : String(v ?? '—')}</Mono>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* S/R */}
                  {sr && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 6 }}>SUPPORT / RESISTANCE</div>
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
                  {/* Fundamental snapshot from watchlist item */}
                  {(s.eps_growth || s.revenue_growth || s.fundamentals) && (
                    <div>
                      <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 6 }}>FUNDAMENTALS</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                        {[
                          { k: 'EPS Growth', v: s.eps_growth ?? s.fundamentals?.eps_growth },
                          { k: 'Rev Growth', v: s.revenue_growth ?? s.fundamentals?.revenue_growth },
                          { k: 'Margins', v: s.margins ?? s.fundamentals?.margins },
                          { k: 'ROE', v: s.roe ?? s.fundamentals?.roe },
                          { k: 'Market Cap', v: s.market_cap ?? s.fundamentals?.market_cap },
                        ].filter(x => x.v != null).map(({ k, v }) => (
                          <div key={k} style={{ background: C.raised, borderRadius: 4, padding: '4px 6px' }}>
                            <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1, color: C.textDim }}>{k}</div>
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
        })}
      </div>
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
        <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 12, letterSpacing: 2, color: C.textBright }}>OPEN POSITIONS</div>
        <button onClick={() => setShowForm(!showForm)} style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: 1, color: C.green, padding: '5px 12px', border: `1px solid ${C.green}44`, borderRadius: 4, background: `${C.green}11` }}>{showForm ? 'CANCEL' : '+ ADD'}</button>
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
            <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginTop: 4 }}>OPTION DETAILS (optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <select value={form.option_type} onChange={e => setForm({ ...form, option_type: e.target.value })} style={inputStyle}>
                <option value="">None</option><option value="CALL">CALL</option><option value="PUT">PUT</option><option value="SPREAD">SPREAD</option>
              </select>
              <input placeholder="Strike" value={form.strike} onChange={e => setForm({ ...form, strike: e.target.value })} style={inputStyle} type="number" />
              <input placeholder="Expiry" value={form.expiry} onChange={e => setForm({ ...form, expiry: e.target.value })} style={inputStyle} type="date" />
            </div>
            <input placeholder="Contracts" value={form.contracts} onChange={e => setForm({ ...form, contracts: e.target.value })} style={inputStyle} type="number" />
            <button onClick={handleAdd} style={{ fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: 2, color: C.bg, background: C.green, padding: '10px 0', borderRadius: 4, width: '100%' }}>ADD POSITION</button>
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
                  <div style={{ fontFamily: FM, fontSize: 14, color: pnlColor, textShadow: glow(pnlColor, 8) }}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</div>
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
                <button onClick={() => handleDelete(p.id)} style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1, color: C.red, padding: '3px 8px', border: `1px solid ${C.red}33`, borderRadius: 3 }}>CLOSE</button>
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
                <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.textDim }}>{label}</div>
                <Mono size={12} color={color}>{v != null ? (typeof v === 'number' ? v.toFixed(2) : v) : '—'}</Mono>
              </div>
            ))}
          </div>
          {sectorBars.length > 0 && (
            <div>
              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 6 }}>SECTOR EXPOSURE</div>
              <BarChart data={sectorBars} />
            </div>
          )}
          {corrData.warnings && corrData.warnings.length > 0 && (
            <div>
              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.red, marginBottom: 4 }}>CORRELATION WARNINGS</div>
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
      if (trimmed.startsWith('### ')) return <div key={i} style={{ fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: 2, color: C.blue, marginTop: 10, marginBottom: 4 }}>{trimmed.slice(4)}</div>
      if (trimmed.startsWith('## ')) return <div key={i} style={{ fontFamily: FO, fontWeight: 700, fontSize: 12, letterSpacing: 2, color: C.textBright, marginTop: 12, marginBottom: 4 }}>{trimmed.slice(3)}</div>
      if (trimmed.startsWith('# ')) return <div key={i} style={{ fontFamily: FO, fontWeight: 900, fontSize: 14, letterSpacing: 2, color: C.gold, textShadow: glow(C.gold, 8), marginTop: 14, marginBottom: 6 }}>{trimmed.slice(2)}</div>
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return <div key={i} style={{ fontFamily: FR, fontSize: 13, fontWeight: 500, color: C.text, paddingLeft: 12, lineHeight: 1.6, position: 'relative' }}><span style={{ position: 'absolute', left: 0, color: C.blue }}>•</span>{trimmed.slice(2)}</div>
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) return <div key={i} style={{ fontFamily: FR, fontSize: 13, fontWeight: 600, color: C.textBright, lineHeight: 1.5 }}>{trimmed.slice(2, -2)}</div>
      return <div key={i} style={{ fontFamily: FR, fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.6 }}>{trimmed}</div>
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 14, letterSpacing: 3, color: C.gold, textShadow: glow(C.gold, 8) }}>DAILY BRIEF</div>
        <button onClick={reload} style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 1, color: C.blue, padding: '5px 12px', border: `1px solid ${C.blue}44`, borderRadius: 4 }}>REFRESH</button>
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const doSearch = async () => {
    const t = ticker.trim().toUpperCase()
    if (!t) return
    setSearchTicker(t)
    setLoading(true); setError(null)
    try {
      const [a, o, tr, te, s] = await Promise.all([
        api(`/api/analyze/${t}`).catch(() => null),
        api(`/api/options-analysis/${t}`).catch(() => null),
        api(`/api/trade-ideas/${t}`).catch(() => null),
        api(`/api/technicals/${t}`).catch(() => null),
        api(`/api/support-resistance/${t}`).catch(() => null),
      ])
      setAnalysis(a); setOptions(o); setTrades(tr); setTech(te); setSr(s)
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
            padding: '10px 14px', fontFamily: FO, fontWeight: 900, fontSize: 16, color: C.textBright, letterSpacing: 2,
          }}
        />
        <button onClick={doSearch} style={{
          fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: 2,
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
                  <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 24, color: C.textBright }}>{searchTicker}</div>
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
                  { l: 'MKT CAP', v: a.market_cap ?? fund.market_cap },
                  { l: 'SECTOR', v: a.sector },
                  { l: 'DAY', v: a.day_change ?? a.change_1d, pct: true },
                  { l: 'WEEK', v: a.week_change ?? a.change_1w, pct: true },
                ].map(({ l, v, pct }) => (
                  <div key={l} style={{ background: C.raised, borderRadius: 4, padding: 6 }}>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.textDim }}>{l}</div>
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
                        <span style={{ fontFamily: FM, fontSize: 12, color: pass ? C.green : C.red, textShadow: glow(pass ? C.green : C.red, 4), flexShrink: 0 }}>{pass ? '✓' : '✗'}</span>
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
                      <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.textDim }}>{l}</div>
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
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.green, marginBottom: 6 }}>SUPPORT LEVELS</div>
                    {(sr.support || sr.supports || []).map((v, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${C.border}22` }}>
                        <Mono size={11} color={C.green}>S{i + 1}</Mono>
                        <Mono size={11} color={C.green}>${typeof v === 'number' ? v.toFixed(2) : (v?.price != null ? Number(v.price).toFixed(2) : v?.level != null ? Number(v.level).toFixed(2) : v)}</Mono>
                      </div>
                    ))}
                    {(sr.support || sr.supports || []).length === 0 && <Mono size={10} color={C.textDim}>None identified</Mono>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.red, marginBottom: 6 }}>RESISTANCE LEVELS</div>
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
                      <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.textDim }}>{l}</div>
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
                      <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.textDim }}>{l}</div>
                      <Mono size={12} color={color}>{typeof v === 'number' ? (v < 5 ? (v * 100).toFixed(1) + '%' : v.toFixed(2)) : String(v)}</Mono>
                    </div>
                  ))}
                </div>
                {/* Term Structure */}
                {opt.term_structure && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>TERM STRUCTURE</div>
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
                {opt.skew && <div style={{ marginBottom: 10 }}><div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>SKEW</div><Mono size={11}>{typeof opt.skew === 'number' ? opt.skew.toFixed(3) : JSON.stringify(opt.skew)}</Mono></div>}
                {/* Strategy Recs */}
                {(opt.strategies || opt.recommendations || opt.strategy_recs) && (
                  <div>
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>STRATEGY RECOMMENDATIONS</div>
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

          {/* Section 7: Trade Ideas */}
          {tradeIdeas.length > 0 && (
            <Collapsible title="TRADE IDEAS" borderColor={C.green} defaultOpen>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tradeIdeas.map((idea, i) => {
                  const ideaGrade = idea.grade || idea.rating
                  return (
                    <div key={i} style={{ background: C.raised, borderRadius: 8, padding: 12, border: `1px solid ${gradeColor(ideaGrade)}33` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: 1, color: C.textBright }}>{idea.strategy || idea.name || idea.type || `Strategy ${i + 1}`}</div>
                        {ideaGrade && <GradeBadge grade={ideaGrade} size={14} />}
                      </div>
                      <div style={{ fontFamily: FR, fontSize: 12, color: C.text, lineHeight: 1.5, marginBottom: 6 }}>{idea.description || idea.thesis || idea.rationale || ''}</div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {idea.entry && <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>ENTRY </span><Mono size={11}>{idea.entry}</Mono></div>}
                        {idea.stop && <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>STOP </span><Mono size={11} color={C.red}>{idea.stop}</Mono></div>}
                        {idea.target && <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>TARGET </span><Mono size={11} color={C.green}>{idea.target}</Mono></div>}
                        {idea.risk_reward && <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>R:R </span><Mono size={11} color={C.gold}>{idea.risk_reward}</Mono></div>}
                        {idea.max_risk && <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, color: C.textDim }}>MAX RISK </span><Mono size={11} color={C.red}>{idea.max_risk}</Mono></div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Collapsible>
          )}

          {/* Section 8: Thesis */}
          {thesis && (
            <Collapsible title="EDUCATIONAL THESIS" borderColor={C.textDim}>
              <div style={{ padding: 12 }}>
                {String(thesis).split('\n').map((line, i) => {
                  if (!line.trim()) return <div key={i} style={{ height: 6 }} />
                  return <div key={i} style={{ fontFamily: FR, fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.7 }}>{line}</div>
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
      <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 14, letterSpacing: 3, color: C.textBright }}>SCREENER</div>

      {/* Preset buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {presetsLoading && <Loading />}
        {presetList.map((p, i) => {
          const key = typeof p === 'string' ? p : (p.key || p.id || p.name || `preset_${i}`)
          const label = typeof p === 'string' ? p.replace(/_/g, ' ').toUpperCase() : (p.label || p.name || key).toUpperCase()
          const isActive = activePreset === key
          return (
            <button key={key} onClick={() => runPreset(p)} style={{
              fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 1.5,
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
                  <div key={h} style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1.5, color: C.textDim }}>{h}</div>
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

  const newsItems = Array.isArray(news) ? news : (news?.articles || news?.headlines || news?.items || news?.news || [])
  const earningsItems = Array.isArray(earnings) ? earnings : (earnings?.calendar || earnings?.earnings || earnings?.items || [])

  const marketNews = newsItems.filter(n => !(n.source || '').toLowerCase().includes('watchlist') || tab === 'MARKET')
  const watchlistNews = newsItems.filter(n => n.watchlist || n.is_watchlist || (n.source || '').toLowerCase().includes('watchlist'))

  const displayNews = tab === 'MARKET' ? marketNews : tab === 'WATCHLIST' ? watchlistNews : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <TabBar tabs={['MARKET', 'WATCHLIST', 'EARNINGS']} active={tab} onSelect={setTab} />
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(nl || el) && <Loading />}
        {ne && <ErrorMsg msg={ne} onRetry={nr} />}

        {tab !== 'EARNINGS' && displayNews.length > 0 && displayNews.map((n, i) => {
          const isRisk = n.risk || n.is_risk || (n.sentiment || '').toLowerCase().includes('negative') || (n.category || '').toLowerCase().includes('risk')
          return (
            <div key={i} style={{ background: C.panel, borderRadius: 6, padding: 10, borderLeft: `3px solid ${isRisk ? C.red : C.border}` }}>
              <div style={{ fontFamily: FR, fontSize: 13, fontWeight: 600, color: isRisk ? C.red : C.textBright, lineHeight: 1.4 }}>{n.title || n.headline}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <Mono size={10} color={C.textDim}>{n.source || n.provider || ''}</Mono>
                <Mono size={10} color={C.textDim}>{n.time || n.published || n.date || ''}</Mono>
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
                <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 14, color: C.textBright }}>{e.ticker || e.symbol}</span>
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
  const sectorBars = Array.isArray(sectorData) ? sectorData.map(s => ({ label: s.name || s.sector || s.label, value: s.change || s.performance || s.value || 0 })) : Object.entries(sectorData).map(([k, v]) => ({ label: k, value: typeof v === 'number' ? v : (v?.change || v?.performance || 0) }))
  const templateCount = bd.template_count ?? bd.qualifier_count ?? bd.templates ?? '—'
  const advDecl = bd.advance_decline ?? bd.adv_dec ?? {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
      <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 14, letterSpacing: 3, color: C.textBright }}>MARKET BREADTH</div>

      {/* Index Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {indices.map(({ label, data: d }) => (
          <Panel key={label}>
            <div style={{ padding: 10, textAlign: 'center' }}>
              <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 14, color: C.textBright, marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, color: C.blue, marginBottom: 2 }}>Stage {d.stage || d.weinstein_stage || '—'}</div>
              <Pct v={d.change || d.day_change || d.change_pct} size={12} />
              <div style={{ marginTop: 4 }}><Mono size={10} color={C.textDim}>{d.price ? `$${Number(d.price).toFixed(2)}` : ''}</Mono></div>
            </div>
          </Panel>
        ))}
      </div>

      {/* VIX */}
      <Panel borderColor={Number(vixVal) > 25 ? C.red : C.border}>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 12, letterSpacing: 2, color: C.textDim }}>VIX</div>
          <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 24, color: Number(vixVal) > 25 ? C.red : Number(vixVal) > 18 ? C.gold : C.green, textShadow: glow(Number(vixVal) > 25 ? C.red : Number(vixVal) > 18 ? C.gold : C.green, 12) }}>
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
          <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: 2, color: C.textDim }}>TEMPLATE QUALIFIERS</div>
          <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 20, color: C.purple, textShadow: glow(C.purple, 10) }}>{templateCount}</div>
        </div>
      </Panel>

      {/* Advance/Decline */}
      {Object.keys(advDecl).length > 0 && (
        <Panel>
          <SectionHeader title="ADVANCE / DECLINE" />
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {Object.entries(advDecl).map(([k, v]) => (
              <div key={k} style={{ background: C.raised, borderRadius: 4, padding: 6, textAlign: 'center' }}>
                <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1, color: C.textDim, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
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
  const [form, setForm] = useState({ ticker: '', direction: 'LONG', entry_price: '', exit_price: '', entry_date: '', exit_date: '', shares: '', grade: '', zone: '', phase: '', notes: '' })

  const trades = Array.isArray(journal) ? journal : (journal?.trades || journal?.entries || journal?.journal || [])
  const stats = analytics || {}

  const handleAdd = async () => {
    try {
      const body = { ...form, entry_price: Number(form.entry_price) || 0, exit_price: Number(form.exit_price) || undefined, shares: Number(form.shares) || 1 }
      await apiPost('/api/journal', body)
      setShowForm(false)
      setForm({ ticker: '', direction: 'LONG', entry_price: '', exit_price: '', entry_date: '', exit_date: '', shares: '', grade: '', zone: '', phase: '', notes: '' })
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
        <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 14, letterSpacing: 3, color: C.textBright }}>TRADE JOURNAL</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAnalytics(!showAnalytics)} style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 1, color: C.purple, padding: '5px 10px', border: `1px solid ${C.purple}44`, borderRadius: 4 }}>STATS</button>
          <button onClick={() => setShowForm(!showForm)} style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 1, color: C.green, padding: '5px 10px', border: `1px solid ${C.green}44`, borderRadius: 4 }}>{showForm ? 'CANCEL' : '+ ADD'}</button>
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
            </div>
            <textarea placeholder="Notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, height: 60, resize: 'none', fontFamily: FR }} />
            <button onClick={handleAdd} style={{ fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: 2, color: C.bg, background: C.green, padding: '10px 0', borderRadius: 4, width: '100%' }}>LOG TRADE</button>
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
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.textDim }}>{l}</div>
                    <Mono size={12} color={color}>{v != null ? fmt(v) : '—'}</Mono>
                  </div>
                ))}
              </div>

              {/* Win Rate by Grade */}
              {Object.keys(winRateByGrade).length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>WIN RATE BY GRADE</div>
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
                  <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>WIN RATE BY ZONE</div>
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
                  <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>WIN RATE BY PHASE</div>
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
                  <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>MONTHLY P&L</div>
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
                  <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.gold, marginBottom: 4 }}>AUTO-GENERATED INSIGHTS</div>
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
                  <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 14, color: C.textBright }}>{t.ticker || t.symbol}</span>
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
const NAV_ITEMS = [
  { key: 'home', label: 'HOME', icon: '\u2302' },
  { key: 'watch', label: 'WATCH', icon: '\u25C9' },
  { key: 'plays', label: 'PLAYS', icon: '\u25B2' },
  { key: 'brief', label: 'BRIEF', icon: '\u2261' },
  { key: 'more', label: 'MORE', icon: '\u2026' },
]

const MORE_ITEMS = [
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
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#020408', color: '#ff2a44', padding: 30, textAlign: 'center', fontFamily: "'Rajdhani', sans-serif" }}>
        <div style={{ fontFamily: "'Orbitron', monospace", fontWeight: 900, fontSize: 18, letterSpacing: 3, marginBottom: 12 }}>SYSTEM ERROR</div>
        <div style={{ fontSize: 13, color: 'rgba(180,200,230,0.7)', marginBottom: 16, maxWidth: 320 }}>{String(this.state.error?.message || this.state.error)}</div>
        <button onClick={() => { this.setState({ error: null }); window.location.reload() }} style={{ fontFamily: "'Orbitron', monospace", fontWeight: 700, fontSize: 11, letterSpacing: 2, color: '#00ccff', background: 'rgba(0,204,255,0.1)', border: '1px solid rgba(0,204,255,0.3)', borderRadius: 6, padding: '10px 24px', cursor: 'pointer' }}>RELOAD</button>
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
      case 'analyze': return <AnalyzePage />
      case 'screener': return <ScreenerPage />
      case 'news': return <NewsPage />
      case 'breadth': return <BreadthPage />
      case 'journal': return <JournalPage />
      default: return <HomePage />
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: FR }}>
      <style>{GLOBAL_CSS}</style>
      <Scanline />

      {/* Top Bar */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        position: 'relative',
      }}>
        <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 13, letterSpacing: 4, color: C.gold, textShadow: glow(C.gold, 8) }}>MKW</span>
        <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: 2, color: C.textDim, marginLeft: 8 }}>{page.toUpperCase()}</span>
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
              fontFamily: FO, fontWeight: 700, fontSize: 11, letterSpacing: 2,
              color: page === item.key ? C.blue : C.textBright,
              padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
              background: page === item.key ? `${C.blue}11` : 'transparent',
            }}>{item.label}</button>
          ))}
        </div>
      )}

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
              <span style={{ fontSize: 18, color: isActive ? C.blue : C.textDim, transition: 'color 0.2s' }}>{item.icon}</span>
              <span style={{
                fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1.5,
                color: isActive ? C.blue : C.textDim, transition: 'color 0.2s',
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
