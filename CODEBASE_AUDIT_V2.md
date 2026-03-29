# MKW Command Center — Complete Codebase Audit V2

Generated: 2026-03-29
Project: mkw-pwa (MKW Command Center)
Deployed on: Railway

---

# SECTION 1: ARCHITECTURE

## 1a. package.json — Full Contents

```json
{
  "name": "mkw-command-center",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "vite preview --host 0.0.0.0 --port ${PORT:-3000}"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^3.8.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.2",
    "vite-plugin-pwa": "^0.20.1"
  }
}
```

## 1b. Full Directory Tree

```
backend/data_router.py
backend/finra_short_volume.py
backend/grading.py
backend/indicators.py
backend/journal.py
backend/llm_provider.py
backend/macro_engine.py
backend/main.py
backend/options_engine.py
backend/polygon_client.py
backend/qullamaggie.py
backend/trade_ideas.py
backend/trade_rules.py
backend/wizard.py
nixpacks.toml
package-lock.json
package.json
railway.json
src/App.jsx
src/challenge/ChallengeApp.jsx
src/challenge/components/CandleChart.jsx
src/challenge/components/MetricCard.jsx
src/challenge/components/ProgressBar.jsx
src/challenge/components/shared.jsx
src/challenge/engine/analysis.js
src/challenge/engine/constants.js
src/challenge/engine/detection.js
src/challenge/engine/scoring.js
src/challenge/engine/tradeBuilder.js
src/challenge/hooks/useStorage.js
src/challenge/tabs/CommandTab.jsx
src/challenge/tabs/DebriefTab.jsx
src/challenge/tabs/IdeasTab.jsx
src/challenge/tabs/PlaybookTab.jsx
src/challenge/tabs/RiskTab.jsx
src/challenge/tabs/SizerTab.jsx
src/challenge/tabs/TradesTab.jsx
src/challenge/tabs/WatchlistTab.jsx
src/main.jsx
vite.config.js
```

## 1c. Environment Files

No .env, .env.example, or .env.local files found in repository.
(API keys are configured via Railway environment variables at deploy time.)

## 1d. Main App Entry Point (src/main.jsx)

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### App Layout & Navigation (src/App.jsx) — Full Contents

```jsx
import { useState, useEffect, useCallback, Component } from 'react'
import ChallengeApp from './challenge/ChallengeApp.jsx'

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
                <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 13, color: C.textBright }}>{d.stageLabel || d.weinstein_stage || d.stage || '—'}</div>
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
                    <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 13, color: C.gold, textShadow: glow(C.gold, 8) }}>{s.ticker}</span>
                    <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1, color: C.bg, background: C.gold, padding: '1px 5px', borderRadius: 2 }}>DUAL CONV</span>
                  </div>
                  <Mono size={10} color={C.gold}>{s.qull_best_score}/100</Mono>
                </div>
              ))}
              {qullTriggering.filter(s => !s.qull_dual_convergence).map((s, i) => (
                <div key={`tr-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.border}22` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 13, color: C.textBright }}>{s.ticker}</span>
                    <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1, color: C.bg, background: C.green, padding: '1px 5px', borderRadius: 2 }}>TRIGGERING</span>
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
        {s.qull_dual_convergence && <div style={{ marginTop: 4 }}><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1, color: C.bg, background: C.gold, padding: '1px 6px', borderRadius: 2 }}>DUAL CONVERGENCE</span></div>}
        {s.qull_any_triggering && !s.qull_dual_convergence && <div style={{ marginTop: 4 }}><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1, color: C.bg, background: C.green, padding: '1px 6px', borderRadius: 2 }}>Q: {s.qull_best_setup?.replace('_', ' ')} TRIGGERING</span><Mono size={9} color={C.textDim}> {s.qull_best_score}/100</Mono></div>}
        {s.qull_any_setup && !s.qull_any_triggering && <div style={{ marginTop: 4 }}><Mono size={9} color={C.blue}>Q: {s.qull_best_setup?.replace('_', ' ')} ({s.qull_best_score}/100)</Mono></div>}
        {s.flags && s.flags.length > 0 && <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>{s.flags.map((f, i) => <span key={i} style={{ fontFamily: FM, fontSize: 9, color: C.gold, background: `${C.gold}11`, border: `1px solid ${C.gold}33`, borderRadius: 3, padding: '1px 6px' }}>{f}</span>)}</div>}
      </div>
      {isOpen && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 12, animation: 'fadeIn 0.2s ease' }}>
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
          flex: 1, padding: '10px 0', fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: 2,
          color: mode === 'watchlist' ? C.bg : C.textDim,
          background: mode === 'watchlist' ? C.blue : 'transparent',
          borderBottom: mode === 'watchlist' ? `2px solid ${C.blue}` : `1px solid ${C.border}`,
        }}>WATCHLIST</button>
        <button onClick={() => { setMode('scanners'); if (!scannerData) runScanner(activeScanner) }} style={{
          flex: 1, padding: '10px 0', fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: 2,
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
                fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1,
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
                  <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: 1, color: C.gold }}>{scannerData.scannerName || activeScanner}</div>
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
              fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2,
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
                  <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 10, letterSpacing: 2, color: C.gold, padding: '2px 4px', marginBottom: 2 }}>
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
                  { l: 'MKT CAP', v: a.market_cap ?? a.marketCap ?? fund.marketCap ?? fund.market_cap },
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
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.red, marginBottom: 4 }}>NO TRADE</div>
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
                        <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.textDim }}>{l}</div>
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
                      right={sg ? <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 14, color: gradeColor(sg), textShadow: gradeGlow(sg) }}>{sg}</span> : null}>
                      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Aggression badge + score */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.bg, background: aggColor, padding: '2px 10px', borderRadius: 3 }}>{aggLabel}</span>
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
                              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1, color: C.textDim }}>{l}</div>
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
                                <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1, color: C.textDim }}>{l} </span>
                                <Mono size={10} color={c}>{typeof v === 'number' ? v.toFixed(4) : v}</Mono>
                              </div>
                            ))}
                            {strat.thetaPerDay != null && strat.thetaPerDay !== 0 && (
                              <div><span style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1, color: C.textDim }}>Theta/Day </span><Mono size={10} color={C.red}>${Math.abs(strat.thetaPerDay).toFixed(2)}</Mono></div>
                            )}
                          </div>
                        )}
                        {/* Execution Levels */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                          {strat.entryZone && (
                            <div style={{ background: `${C.blue}11`, border: `1px solid ${C.blue}22`, borderRadius: 4, padding: 6 }}>
                              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.blue }}>ENTRY ZONE</div>
                              <Mono size={11} color={C.blue}>{strat.entryZone}</Mono>
                            </div>
                          )}
                          {strat.stopPrice && (
                            <div style={{ background: `${C.red}11`, border: `1px solid ${C.red}22`, borderRadius: 4, padding: 6 }}>
                              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.red }}>STOP LOSS</div>
                              <Mono size={11} color={C.red}>${Number(strat.stopPrice).toFixed(2)}</Mono>
                            </div>
                          )}
                          {strat.target1 && (
                            <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}22`, borderRadius: 4, padding: 6 }}>
                              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.green }}>TARGET 1</div>
                              <Mono size={11} color={C.green}>${Number(strat.target1).toFixed(2)}</Mono>
                            </div>
                          )}
                          {strat.target2 && (
                            <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}22`, borderRadius: 4, padding: 6 }}>
                              <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.green }}>TARGET 2</div>
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
                            <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1.5, color: C.textDim, marginBottom: 4 }}>P&L PROJECTION</div>
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
                            <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1.5, color: C.blue, marginBottom: 4 }}>ENTRY TRIGGERS</div>
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
                            <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1.5, color: C.gold, marginBottom: 4 }}>THINGS TO WATCH</div>
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
                    <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 11, letterSpacing: 2, color: C.gold, textShadow: glow(C.gold, 12) }}>DUAL CONVERGENCE — MAXIMUM CONVICTION</div>
                    <div style={{ fontFamily: FR, fontSize: 12, color: C.text, marginTop: 4 }}>MKW convergence + Qullamaggie breakout both triggered. Full position size.</div>
                  </div>
                )}
                {/* Setup summaries */}
                {(qullData.setups_summary || []).length > 0 ? (qullData.setups_summary || []).map((s, i) => {
                  const typeColor = s.type === 'BREAKOUT' ? C.green : s.type === 'EPISODIC_PIVOT' ? C.gold : s.type === 'PARABOLIC_SHORT' ? C.red : C.blue
                  return (
                    <div key={i} style={{ background: C.raised, borderRadius: 6, padding: 10, border: `1px solid ${typeColor}33` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 10, letterSpacing: 2, color: typeColor }}>{s.type?.replace('_', ' ')}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Mono size={10} color={typeColor}>{s.score}/100</Mono>
                          {s.triggering && <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1, color: C.bg, background: C.gold, padding: '1px 6px', borderRadius: 3 }}>TRIGGERING</span>}
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
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.gold, marginBottom: 6 }}>
                      {plan.setup_type?.replace('_', ' ')} TRADE PLAN
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
                      <div style={{ background: C.raised, borderRadius: 4, padding: 6 }}>
                        <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.textDim }}>ENTRY</div>
                        <Mono size={11} color={C.green}>${plan.entry_price}</Mono>
                      </div>
                      <div style={{ background: C.raised, borderRadius: 4, padding: 6 }}>
                        <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.textDim }}>STOP</div>
                        <Mono size={11} color={C.red}>${plan.initial_stop}</Mono>
                      </div>
                      <div style={{ background: C.raised, borderRadius: 4, padding: 6 }}>
                        <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.textDim }}>RISK/SHARE</div>
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
                    <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>MOMENTUM INDICATORS</div>
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
                          <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 6, letterSpacing: 1, color: C.textDim }}>{l}</div>
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
        <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 14, color: C.gold, letterSpacing: 2, textShadow: glow(C.gold, 8) }}>MOMENTUM</div>
        <button onClick={doScan} style={{ fontFamily: FO, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: C.blue, padding: '6px 12px', border: `1px solid ${C.blue}44`, borderRadius: 4 }}>RESCAN</button>
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
                <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 7, letterSpacing: 1.5, color: C.textDim }}>{l}</div>
                <div style={{ fontFamily: FO, fontWeight: 900, fontSize: 20, color: v > 0 ? c : C.textDim, textShadow: v > 0 ? glow(c, 8) : 'none' }}>{v}</div>
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
                      <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1.5, color: typeColor, padding: '1px 6px', border: `1px solid ${typeColor}44`, borderRadius: 3, background: `${typeColor}11` }}>
                        {setupType.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Mono size={12} color={typeColor}>{score}/100</Mono>
                      {triggering && <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1, color: C.bg, background: C.gold, padding: '2px 8px', borderRadius: 3, textShadow: 'none' }}>TRIGGERING</span>}
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
              {n.ticker && <span style={{ fontFamily: FO, fontWeight: 900, fontSize: 10, color: C.blue, letterSpacing: 1, marginBottom: 2, display: 'inline-block' }}>{n.ticker}</span>}
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
  const sectorBars = Array.isArray(sectorData) ? sectorData.map(s => ({ label: s.n || s.name || s.sector || s.label || s.etf || '?', value: s.p ?? s.change ?? s.performance ?? s.value ?? 0 })) : Object.entries(sectorData).map(([k, v]) => ({ label: k, value: typeof v === 'number' ? v : (v?.p || v?.change || v?.performance || 0) }))
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
        background: `linear-gradient(135deg, ${C.panel}, ${C.raised})`,
        border: `2px solid ${C.blue}44`,
        boxShadow: `0 0 20px ${C.blue}33, 0 4px 12px rgba(0,0,0,0.4)`,
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
      background: 'rgba(2,4,8,0.97)', backdropFilter: 'blur(12px)',
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
          <span style={{ fontFamily: FO, fontWeight: 700, fontSize: 12, letterSpacing: 2, color: C.gold }}>MARKET WIZARD</span>
          {provider && <span style={{ fontFamily: FM, fontSize: 9, color: C.textDim }}>via {provider}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {messages.length > 0 && (
            <button onClick={clearChat} style={{
              fontFamily: FO, fontWeight: 700, fontSize: 8, letterSpacing: 1.5,
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
            <div style={{ fontFamily: FO, fontWeight: 700, fontSize: 14, letterSpacing: 2, color: C.gold, marginBottom: 8 }}>MARKET WIZARD</div>
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
```

## 1e. Database Schema

No Prisma schema, SQL files, or formal database models. Data is stored in-memory and in JSON files via the journal module (backend/journal.py).

## 1f. Deployment Configuration

### railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### nixpacks.toml

```toml
[phases.setup]
nixPkgs = ["python311", "nodejs_20"]

[phases.install]
cmds = [
  "npm install",
  "pip install -r backend/requirements.txt"
]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "cd backend && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"
```

## 1g. vite.config.js — Full Contents

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MKW Command Center',
        short_name: 'MKW',
        description: 'Minervini × Kell × Weinstein Trading System',
        theme_color: '#06090f',
        background_color: '#06090f',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            // Cache API responses for 5 minutes (live stock data)
            urlPattern: /^https:\/\/query[12]\.finance\.yahoo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'stock-data-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
  define: {
    '__POLYGON_API_KEY__': JSON.stringify(process.env.POLYGON_API_KEY || ''),
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          challenge: [
            './src/challenge/ChallengeApp.jsx',
          ],
          recharts: ['recharts'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT) || 3000,
    allowedHosts: true,
  },
})
```

---

# SECTION 2: API INTEGRATION LAYER

## 2a. Polygon.io Client (backend/polygon_client.py) — Full Contents

```python
"""
Polygon.io Client — Primary market data provider for MKW Command Center
Replaces yfinance with professional-grade data: OHLCV, options snapshots,
fundamentals, technical indicators, and grouped daily bars.
"""

import os, time, json, logging
from datetime import datetime, timedelta, date
from typing import Optional

import requests
import pandas as pd
import numpy as np

log = logging.getLogger("mkw.polygon")

POLYGON_KEY = os.getenv("POLYGON_API_KEY", "")
BASE = "https://api.polygon.io"

# ─────────────────────────────────────────────
# INTERNAL HELPERS
# ─────────────────────────────────────────────
_session = requests.Session()


def _get(path: str, params: dict = None, timeout: int = 10) -> Optional[dict]:
    """Make authenticated GET request to Polygon API."""
    if not POLYGON_KEY:
        return None
    p = params or {}
    p["apiKey"] = POLYGON_KEY
    try:
        r = _session.get(f"{BASE}{path}", params=p, timeout=timeout)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 429:
            log.warning("Polygon rate limited, waiting 1s...")
            time.sleep(1)
            r = _session.get(f"{BASE}{path}", params=p, timeout=timeout)
            return r.json() if r.ok else None
        log.warning(f"Polygon {path}: HTTP {r.status_code}")
        return None
    except Exception as e:
        log.warning(f"Polygon {path}: {e}")
        return None


def is_available() -> bool:
    """Check if Polygon API key is configured."""
    return bool(POLYGON_KEY)


# ─────────────────────────────────────────────
# 1. HISTORICAL AGGREGATES (replaces yfinance OHLCV)
# ─────────────────────────────────────────────
def fetch_ohlcv(ticker: str, period: str = "2y") -> Optional[pd.DataFrame]:
    """
    Fetch historical OHLCV data from Polygon.
    Returns DataFrame with columns: Open, High, Low, Close, Volume
    DatetimeIndex, sorted ascending.
    """
    period_map = {
        "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825,
    }
    days = period_map.get(period, 730)
    end = date.today()
    start = end - timedelta(days=days)

    data = _get(
        f"/v2/aggs/ticker/{ticker.upper()}/range/1/day/{start}/{end}",
        {"adjusted": "true", "sort": "asc", "limit": 50000},
    )
    if not data or data.get("resultsCount", 0) == 0:
        return None

    results = data.get("results", [])
    if len(results) < 60:
        return None

    df = pd.DataFrame(results)
    df["Date"] = pd.to_datetime(df["t"], unit="ms")
    df = df.set_index("Date").sort_index()
    df = df.rename(columns={"o": "Open", "h": "High", "l": "Low", "c": "Close", "v": "Volume"})
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
    df["Volume"] = df["Volume"].astype(float)
    return df


def fetch_weekly_ohlcv(ticker: str, years: int = 2) -> Optional[pd.DataFrame]:
    """Fetch weekly bars."""
    end = date.today()
    start = end - timedelta(days=years * 365)
    data = _get(
        f"/v2/aggs/ticker/{ticker.upper()}/range/1/week/{start}/{end}",
        {"adjusted": "true", "sort": "asc", "limit": 50000},
    )
    if not data or not data.get("results"):
        return None
    df = pd.DataFrame(data["results"])
    df["Date"] = pd.to_datetime(df["t"], unit="ms")
    df = df.set_index("Date").sort_index()
    df = df.rename(columns={"o": "Open", "h": "High", "l": "Low", "c": "Close", "v": "Volume"})
    return df[["Open", "High", "Low", "Close", "Volume"]].copy()


# ─────────────────────────────────────────────
# 2. OPTIONS CHAIN SNAPSHOT
# ─────────────────────────────────────────────
def fetch_options_snapshot(ticker: str) -> Optional[dict]:
    """
    Fetch entire options chain in ONE call.
    Returns dict with structured chain data including Greeks.
    """
    data = _get(
        f"/v3/snapshot/options/{ticker.upper()}",
        {"limit": 250},
        timeout=15,
    )
    if not data or not data.get("results"):
        return None

    # Paginate if needed
    all_results = data["results"]
    next_url = data.get("next_url")
    pages = 0
    while next_url and pages < 10:
        try:
            r = _session.get(f"{next_url}&apiKey={POLYGON_KEY}", timeout=10)
            if r.ok:
                page = r.json()
                all_results.extend(page.get("results", []))
                next_url = page.get("next_url")
                pages += 1
            else:
                break
        except Exception:
            break

    # Organize by expiration and type
    calls, puts = [], []
    expirations = set()

    for contract in all_results:
        details = contract.get("details", {})
        greeks = contract.get("greeks", {})
        day = contract.get("day", {})
        last_quote = contract.get("last_quote", {})

        exp = details.get("expiration_date", "")
        strike = details.get("strike_price", 0)
        ctype = details.get("contract_type", "").lower()

        entry = {
            "contractSymbol": details.get("ticker", ""),
            "strike": strike,
            "expiration": exp,
            "lastPrice": day.get("close", 0) or 0,
            "bid": last_quote.get("bid", 0) or 0,
            "ask": last_quote.get("ask", 0) or 0,
            "volume": day.get("volume", 0) or 0,
            "openInterest": contract.get("open_interest", 0) or 0,
            "impliedVolatility": contract.get("implied_volatility", 0) or 0,
            "delta": greeks.get("delta", 0) or 0,
            "gamma": greeks.get("gamma", 0) or 0,
            "theta": greeks.get("theta", 0) or 0,
            "vega": greeks.get("vega", 0) or 0,
        }

        expirations.add(exp)
        if ctype == "call":
            calls.append(entry)
        elif ctype == "put":
            puts.append(entry)

    sorted_exps = sorted(expirations)

    return {
        "ticker": ticker.upper(),
        "expirations": sorted_exps,
        "calls": calls,
        "puts": puts,
        "total_contracts": len(all_results),
        "timestamp": datetime.utcnow().isoformat(),
    }


def build_chain_dataframes(snapshot: dict) -> dict:
    """
    Convert snapshot to per-expiration DataFrames matching yfinance format.
    Returns {expiration: {"calls": DataFrame, "puts": DataFrame}}
    """
    if not snapshot:
        return {}
    result = {}
    for exp in snapshot["expirations"]:
        exp_calls = [c for c in snapshot["calls"] if c["expiration"] == exp]
        exp_puts = [p for p in snapshot["puts"] if p["expiration"] == exp]
        result[exp] = {
            "calls": pd.DataFrame(exp_calls) if exp_calls else pd.DataFrame(),
            "puts": pd.DataFrame(exp_puts) if exp_puts else pd.DataFrame(),
        }
    return result


# ─────────────────────────────────────────────
# 3. DELAYED QUOTES / SNAPSHOT
# ─────────────────────────────────────────────
def fetch_quote(ticker: str) -> Optional[dict]:
    """
    Fetch delayed quote snapshot.
    Returns: price, change, volume, VWAP, prev_close.
    """
    data = _get(f"/v2/snapshot/locale/us/markets/stocks/tickers/{ticker.upper()}")
    if not data or not data.get("ticker"):
        return None
    t = data["ticker"]
    day = t.get("day", {})
    prev = t.get("prevDay", {})
    return {
        "price": day.get("c", 0) or t.get("lastTrade", {}).get("p", 0),
        "change": round(day.get("c", 0) - prev.get("c", 0), 2) if day.get("c") and prev.get("c") else 0,
        "changePct": round(t.get("todaysChangePerc", 0), 2),
        "volume": day.get("v", 0),
        "vwap": day.get("vw", 0),
        "prevClose": prev.get("c", 0),
        "open": day.get("o", 0),
        "high": day.get("h", 0),
        "low": day.get("l", 0),
    }


# ─────────────────────────────────────────────
# 4. GROUPED DAILY (screener accelerator)
# ─────────────────────────────────────────────
def fetch_grouped_daily(target_date: str = "") -> Optional[dict]:
    """
    Fetch OHLCV for ALL US stocks in ONE call.
    Returns dict of {ticker: {open, high, low, close, volume, vwap}}.
    """
    if not target_date:
        d = date.today()
        if d.weekday() >= 5:  # weekend
            d -= timedelta(days=d.weekday() - 4)
        target_date = d.strftime("%Y-%m-%d")

    data = _get(
        f"/v2/aggs/grouped/locale/us/market/stocks/{target_date}",
        {"adjusted": "true"},
        timeout=20,
    )
    if not data or not data.get("results"):
        return None

    result = {}
    for bar in data["results"]:
        tk = bar.get("T", "")
        result[tk] = {
            "open": bar.get("o", 0),
            "high": bar.get("h", 0),
            "low": bar.get("l", 0),
            "close": bar.get("c", 0),
            "volume": bar.get("v", 0),
            "vwap": bar.get("vw", 0),
        }
    return result


# ─────────────────────────────────────────────
# 5. TECHNICAL INDICATORS (pre-calculated)
# ─────────────────────────────────────────────
def fetch_sma(ticker: str, window: int = 50, timespan: str = "day", limit: int = 100) -> Optional[list]:
    """Fetch pre-calculated SMA."""
    data = _get(
        f"/v1/indicators/sma/{ticker.upper()}",
        {"timespan": timespan, "window": window, "series_type": "close",
         "order": "desc", "limit": limit, "adjusted": "true"},
    )
    if not data or not data.get("results", {}).get("values"):
        return None
    return data["results"]["values"]


def fetch_ema(ticker: str, window: int = 20, timespan: str = "day", limit: int = 100) -> Optional[list]:
    """Fetch pre-calculated EMA."""
    data = _get(
        f"/v1/indicators/ema/{ticker.upper()}",
        {"timespan": timespan, "window": window, "series_type": "close",
         "order": "desc", "limit": limit, "adjusted": "true"},
    )
    if not data or not data.get("results", {}).get("values"):
        return None
    return data["results"]["values"]


def fetch_rsi(ticker: str, window: int = 14, timespan: str = "day", limit: int = 100) -> Optional[list]:
    """Fetch pre-calculated RSI."""
    data = _get(
        f"/v1/indicators/rsi/{ticker.upper()}",
        {"timespan": timespan, "window": window, "series_type": "close",
         "order": "desc", "limit": limit, "adjusted": "true"},
    )
    if not data or not data.get("results", {}).get("values"):
        return None
    return data["results"]["values"]


def fetch_macd(ticker: str, timespan: str = "day", limit: int = 100) -> Optional[list]:
    """Fetch pre-calculated MACD."""
    data = _get(
        f"/v1/indicators/macd/{ticker.upper()}",
        {"timespan": timespan, "short_window": 12, "long_window": 26,
         "signal_window": 9, "series_type": "close",
         "order": "desc", "limit": limit, "adjusted": "true"},
    )
    if not data or not data.get("results", {}).get("values"):
        return None
    return data["results"]["values"]


# ─────────────────────────────────────────────
# 6. TICKER DETAILS / FUNDAMENTALS
# ─────────────────────────────────────────────
def fetch_ticker_details(ticker: str) -> Optional[dict]:
    """
    Fetch company details: name, sector, market cap, shares, etc.
    """
    data = _get(f"/v3/reference/tickers/{ticker.upper()}")
    if not data or not data.get("results"):
        return None
    r = data["results"]
    return {
        "name": r.get("name", ticker),
        "sector": r.get("sic_description", ""),
        "industry": r.get("sic_description", ""),
        "marketCap": r.get("market_cap", 0) or 0,
        "sharesOutstanding": r.get("share_class_shares_outstanding", 0) or 0,
        "description": r.get("description", ""),
        "exchange": r.get("primary_exchange", ""),
        "type": r.get("type", ""),
        "locale": r.get("locale", ""),
        "listDate": r.get("list_date", ""),
    }


def fetch_financials(ticker: str) -> Optional[dict]:
    """
    Fetch company financials from Polygon.
    """
    data = _get(
        f"/vX/reference/financials",
        {"ticker": ticker.upper(), "limit": 4, "sort": "filing_date",
         "order": "desc", "timeframe": "annual"},
        timeout=10,
    )
    if not data or not data.get("results"):
        return None

    results = data["results"]
    if not results:
        return None

    # Calculate growth rates from most recent vs prior
    eps_growth, rev_growth, margins_exp = 0, 0, False

    if len(results) >= 2:
        latest = results[0].get("financials", {})
        prior = results[1].get("financials", {})

        l_income = latest.get("income_statement", {})
        p_income = prior.get("income_statement", {})

        l_ni = l_income.get("net_income_loss", {}).get("value", 0) or 0
        p_ni = p_income.get("net_income_loss", {}).get("value", 0) or 0
        if p_ni and p_ni != 0:
            eps_growth = int((l_ni - p_ni) / abs(p_ni) * 100)

        l_rev = l_income.get("revenues", {}).get("value", 0) or 0
        p_rev = p_income.get("revenues", {}).get("value", 0) or 0
        if p_rev and p_rev != 0:
            rev_growth = int((l_rev - p_rev) / abs(p_rev) * 100)

        l_gp = l_income.get("gross_profit", {}).get("value", 0) or 0
        p_gp = p_income.get("gross_profit", {}).get("value", 0) or 0
        if l_rev and p_rev and l_gp and p_gp:
            margins_exp = (l_gp / l_rev) > (p_gp / p_rev)

    # Get latest metrics
    latest_fin = results[0].get("financials", {}) if results else {}
    income = latest_fin.get("income_statement", {})
    balance = latest_fin.get("balance_sheet", {})
    cf = latest_fin.get("cash_flow_statement", {})

    total_equity = balance.get("equity", {}).get("value", 0) or 0
    total_debt = balance.get("long_term_debt", {}).get("value", 0) or 0
    net_income = income.get("net_income_loss", {}).get("value", 0) or 0
    revenue = income.get("revenues", {}).get("value", 0) or 0
    gross_profit = income.get("gross_profit", {}).get("value", 0) or 0
    operating_income = income.get("operating_income_loss", {}).get("value", 0) or 0
    fcf = cf.get("net_cash_flow_from_operating_activities", {}).get("value", 0) or 0

    return {
        "eps": eps_growth,
        "rev": rev_growth,
        "marginsExpanding": margins_exp,
        "grossMargins": round(gross_profit / revenue, 4) if revenue else 0,
        "operatingMargins": round(operating_income / revenue, 4) if revenue else 0,
        "returnOnEquity": round(net_income / total_equity, 4) if total_equity else 0,
        "freeCashflow": int(fcf),
        "debtToEquity": round(total_debt / total_equity, 2) if total_equity else 0,
    }


# ─────────────────────────────────────────────
# 7. DYNAMIC UNIVERSE
# ─────────────────────────────────────────────
def fetch_active_tickers(
    market: str = "stocks",
    min_market_cap: float = 2e9,
    exchange: str = "",
    limit: int = 1000,
) -> list:
    """
    Fetch all active US tickers. Filter by market cap.
    Returns list of ticker symbols.
    """
    params = {
        "market": market, "active": "true", "limit": limit,
        "order": "asc", "sort": "ticker",
    }
    if exchange:
        params["exchange"] = exchange

    all_tickers = []
    next_url = None
    pages = 0

    # First request
    data = _get("/v3/reference/tickers", params)
    if not data or not data.get("results"):
        return []

    for t in data["results"]:
        mc = t.get("market_cap", 0) or 0
        if mc >= min_market_cap:
            all_tickers.append(t["ticker"])
        elif mc == 0:
            # market_cap might not be in listing data, include anyway
            all_tickers.append(t["ticker"])

    next_url = data.get("next_url")

    # Paginate (up to 5 pages for ~5000 tickers)
    while next_url and pages < 5:
        try:
            r = _session.get(f"{next_url}&apiKey={POLYGON_KEY}", timeout=10)
            if r.ok:
                page = r.json()
                for t in page.get("results", []):
                    mc = t.get("market_cap", 0) or 0
                    if mc >= min_market_cap or mc == 0:
                        all_tickers.append(t["ticker"])
                next_url = page.get("next_url")
                pages += 1
            else:
                break
        except Exception:
            break

    return all_tickers


# ─────────────────────────────────────────────
# IV HISTORY STORAGE (build over time from daily snapshots)
# ─────────────────────────────────────────────
_IV_HISTORY_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "iv_history.json")


def _ensure_data_dir():
    d = os.path.dirname(_IV_HISTORY_PATH)
    os.makedirs(d, exist_ok=True)


def load_iv_history() -> dict:
    """Load stored IV history {ticker: [{date, atm_iv}, ...]}"""
    try:
        with open(_IV_HISTORY_PATH) as f:
            return json.load(f)
    except Exception:
        return {}


def save_iv_history(history: dict):
    """Persist IV history to disk."""
    _ensure_data_dir()
    try:
        with open(_IV_HISTORY_PATH, "w") as f:
            json.dump(history, f)
    except Exception as e:
        log.warning(f"Failed to save IV history: {e}")


def record_daily_iv(ticker: str, atm_iv: float):
    """Record today's ATM IV for building rank/percentile history."""
    history = load_iv_history()
    today = date.today().isoformat()
    entries = history.get(ticker, [])

    # Don't duplicate today
    if entries and entries[-1].get("date") == today:
        entries[-1]["iv"] = atm_iv
    else:
        entries.append({"date": today, "iv": atm_iv})

    # Keep 252 trading days (1 year)
    entries = entries[-252:]
    history[ticker] = entries
    save_iv_history(history)


def calc_iv_rank_from_history(ticker: str, current_iv: float) -> dict:
    """
    Calculate IV Rank and Percentile from stored history.
    Returns {iv_rank, iv_percentile, iv_high, iv_low, days_of_data}.
    """
    history = load_iv_history()
    entries = history.get(ticker, [])
    ivs = [e["iv"] for e in entries if e.get("iv", 0) > 0]

    if len(ivs) < 5:
        return {"iv_rank": 50, "iv_percentile": 50, "iv_high": current_iv, "iv_low": current_iv, "days_of_data": len(ivs)}

    iv_high = max(ivs)
    iv_low = min(ivs)
    iv_range = iv_high - iv_low

    iv_rank = round((current_iv - iv_low) / iv_range * 100) if iv_range > 0 else 50
    iv_rank = max(0, min(100, iv_rank))

    days_below = sum(1 for iv in ivs if iv < current_iv)
    iv_percentile = round(days_below / len(ivs) * 100)

    return {
        "iv_rank": iv_rank,
        "iv_percentile": iv_percentile,
        "iv_high": round(iv_high, 4),
        "iv_low": round(iv_low, 4),
        "days_of_data": len(ivs),
    }


def extract_iv_analysis_from_snapshot(snapshot: dict, spot: float) -> dict:
    """
    Calculate comprehensive IV analysis from Polygon options snapshot.
    Returns: currentIV, ivRank, ivPercentile, termStructure, skew, volOfVol, verdict.
    """
    if not snapshot or not snapshot.get("calls"):
        return _empty_iv_analysis()

    ticker = snapshot["ticker"]
    expirations = snapshot["expirations"]

    # Find ATM calls for each expiration
    atm_ivs = {}
    for exp in expirations:
        exp_calls = [c for c in snapshot["calls"] if c["expiration"] == exp and c["impliedVolatility"] > 0]
        if not exp_calls:
            continue
        # Find closest to ATM
        atm = min(exp_calls, key=lambda c: abs(c["strike"] - spot))
        atm_ivs[exp] = atm["impliedVolatility"]

    if not atm_ivs:
        return _empty_iv_analysis()

    # Current IV = nearest expiry ATM IV
    nearest_exp = min(atm_ivs.keys())
    current_iv = atm_ivs[nearest_exp]

    # Record for history
    record_daily_iv(ticker, current_iv)
    hist = calc_iv_rank_from_history(ticker, current_iv)

    # Term structure
    term_structure = []
    for exp in sorted(atm_ivs.keys())[:6]:
        term_structure.append({"expiration": exp, "iv": round(atm_ivs[exp], 4)})

    term_shape = "FLAT"
    if len(term_structure) >= 2:
        front = term_structure[0]["iv"]
        back = term_structure[-1]["iv"]
        if back > front * 1.05:
            term_shape = "CONTANGO"
        elif front > back * 1.05:
            term_shape = "BACKWARDATION"

    # Skew analysis (nearest expiry)
    nearest_calls = [c for c in snapshot["calls"] if c["expiration"] == nearest_exp and c["impliedVolatility"] > 0]
    skew_data = []
    for c in sorted(nearest_calls, key=lambda x: x["strike"]):
        moneyness = round((c["strike"] / spot - 1) * 100, 1)
        if -20 <= moneyness <= 20:
            skew_data.append({"strike": c["strike"], "moneyness": moneyness, "iv": round(c["impliedVolatility"], 4)})

    otm_put_iv = 0
    atm_iv_val = current_iv
    otm_call_iv = 0
    for c in skew_data:
        if -10 <= c["moneyness"] <= -5:
            otm_put_iv = max(otm_put_iv, c["iv"])
        if 5 <= c["moneyness"] <= 10:
            otm_call_iv = max(otm_call_iv, c["iv"])

    skew_verdict = "neutral"
    if otm_put_iv > atm_iv_val * 1.15:
        skew_verdict = "put-heavy (demand for downside protection)"
    elif otm_call_iv > atm_iv_val * 1.10:
        skew_verdict = "call-heavy (unusual upside demand)"

    # Vol of Vol (from term structure variation)
    if len(list(atm_ivs.values())) >= 3:
        vov = round(float(np.std(list(atm_ivs.values())) / np.mean(list(atm_ivs.values())) * 100), 1)
    else:
        vov = 0

    vov_verdict = "stable"
    if vov > 20:
        vov_verdict = "unstable — significant IV dispersion across expirations"
    elif vov > 10:
        vov_verdict = "moderate — some IV uncertainty"

    # Overall verdict
    iv_rank = hist["iv_rank"]
    if iv_rank < 25 and term_shape != "BACKWARDATION":
        verdict = "FAVORABLE"
        reason = f"IV Rank {iv_rank} (low) — options cheap, debit strategies preferred"
    elif iv_rank > 75:
        verdict = "UNFAVORABLE"
        reason = f"IV Rank {iv_rank} (high) — options expensive, credit strategies or wait"
    else:
        verdict = "NEUTRAL"
        reason = f"IV Rank {iv_rank} — normal pricing, spreads recommended"

    return {
        "currentIV": round(current_iv, 4),
        "ivRank": iv_rank,
        "ivPercentile": hist["iv_percentile"],
        "ivHigh52w": hist["iv_high"],
        "ivLow52w": hist["iv_low"],
        "daysOfData": hist["days_of_data"],
        "termStructure": term_shape,
        "termStructureDetail": term_structure,
        "skew": skew_data,
        "skewVerdict": skew_verdict,
        "volOfVol": vov,
        "volOfVolVerdict": vov_verdict,
        "verdict": verdict,
        "verdictReason": reason,
        "source": "polygon",
    }


def _empty_iv_analysis() -> dict:
    return {
        "currentIV": 0, "ivRank": 50, "ivPercentile": 50,
        "ivHigh52w": 0, "ivLow52w": 0, "daysOfData": 0,
        "termStructure": "UNKNOWN", "termStructureDetail": [],
        "skew": [], "skewVerdict": "unknown",
        "volOfVol": 0, "volOfVolVerdict": "unknown",
        "verdict": "NEUTRAL", "verdictReason": "Insufficient data",
        "source": "none",
    }
```

## 2b-2c. FRED / Macro Engine (backend/macro_engine.py) — Full Contents

```python
"""
Macro Intelligence Engine — FRED API integration for MKW Command Center
Tracks rates, inflation, labor, growth, financial conditions.
Provides macro score (0-10) and economic event calendar.
"""

import os, json, logging, time
from datetime import datetime, timedelta, date
from typing import Optional

import requests

log = logging.getLogger("mkw.macro")

FRED_KEY = os.getenv("FRED_API_KEY", "")
FRED_BASE = "https://api.stlouisfed.org/fred"

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_MACRO_CACHE_PATH = os.path.join(_DATA_DIR, "macro_cache.json")

# ─────────────────────────────────────────────
# FRED API HELPERS
# ─────────────────────────────────────────────
_session = requests.Session()


def _fred_get(series_id: str, limit: int = 10, sort_order: str = "desc") -> Optional[list]:
    """Fetch FRED series observations."""
    if not FRED_KEY:
        return None
    try:
        r = _session.get(
            f"{FRED_BASE}/series/observations",
            params={
                "series_id": series_id, "api_key": FRED_KEY,
                "file_type": "json", "limit": limit,
                "sort_order": sort_order,
            },
            timeout=10,
        )
        if r.ok:
            obs = r.json().get("observations", [])
            return [{"date": o["date"], "value": float(o["value"])} for o in obs if o.get("value", ".") != "."]
        return None
    except Exception as e:
        log.warning(f"FRED {series_id}: {e}")
        return None


def is_available() -> bool:
    return bool(FRED_KEY)


# ─────────────────────────────────────────────
# SERIES DEFINITIONS
# ─────────────────────────────────────────────
SERIES = {
    # Rates
    "DFF": {"name": "Fed Funds Rate", "category": "rates", "frequency": "daily"},
    "DGS10": {"name": "10-Year Treasury", "category": "rates", "frequency": "daily"},
    "DGS2": {"name": "2-Year Treasury", "category": "rates", "frequency": "daily"},
    "T10Y2Y": {"name": "Yield Curve (10Y-2Y)", "category": "rates", "frequency": "daily"},

    # Inflation
    "CPIAUCSL": {"name": "CPI (All Urban)", "category": "inflation", "frequency": "monthly"},
    "PCEPILFE": {"name": "Core PCE", "category": "inflation", "frequency": "monthly"},
    "T10YIE": {"name": "Breakeven Inflation", "category": "inflation", "frequency": "daily"},

    # Labor
    "UNRATE": {"name": "Unemployment Rate", "category": "labor", "frequency": "monthly"},
    "ICSA": {"name": "Weekly Jobless Claims", "category": "labor", "frequency": "weekly"},

    # Growth
    "GDPC1": {"name": "Real GDP", "category": "growth", "frequency": "quarterly"},
    "RSXFS": {"name": "Retail Sales", "category": "growth", "frequency": "monthly"},

    # Financial Conditions
    "NFCI": {"name": "Chicago Fed Fin. Conditions", "category": "conditions", "frequency": "weekly"},
    "BAMLH0A0HYM2": {"name": "HY OAS Spread", "category": "conditions", "frequency": "daily"},

    # Market
    "VIXCLS": {"name": "VIX (Historical)", "category": "market", "frequency": "daily"},
}


# ─────────────────────────────────────────────
# DATA FETCHING
# ─────────────────────────────────────────────
def fetch_all_series() -> dict:
    """
    Fetch latest values for all tracked FRED series.
    Returns: {series_id: {name, category, latest_value, latest_date, prior_value, change}}
    """
    if not FRED_KEY:
        return {}

    result = {}
    for sid, meta in SERIES.items():
        obs = _fred_get(sid, limit=5)
        if obs and len(obs) >= 1:
            latest = obs[0]
            prior = obs[1] if len(obs) >= 2 else latest
            change = round(latest["value"] - prior["value"], 4)
            result[sid] = {
                "name": meta["name"],
                "category": meta["category"],
                "value": latest["value"],
                "date": latest["date"],
                "prior": prior["value"],
                "change": change,
                "direction": "up" if change > 0 else "down" if change < 0 else "flat",
            }
        time.sleep(0.15)  # Respect rate limits

    return result


# ─────────────────────────────────────────────
# MACRO SCORE (0-10)
# ─────────────────────────────────────────────
def calc_macro_score(data: dict) -> dict:
    """
    Calculate macro environment score (0-10).
    8-10: TAILWIND, 5-7: NEUTRAL, 3-4: HEADWIND, 0-2: CRISIS
    """
    score = 0
    breakdown = []

    # Yield curve positive (T10Y2Y > 0): +2
    t10y2y = data.get("T10Y2Y", {}).get("value")
    if t10y2y is not None:
        if t10y2y > 0:
            score += 2
            breakdown.append({"factor": "Yield Curve", "points": 2, "detail": f"Positive ({t10y2y:.2f}%)"})
        else:
            breakdown.append({"factor": "Yield Curve", "points": 0, "detail": f"Inverted ({t10y2y:.2f}%)"})

    # Financial conditions loose (NFCI < 0): +2
    nfci = data.get("NFCI", {}).get("value")
    if nfci is not None:
        if nfci < 0:
            score += 2
            breakdown.append({"factor": "Fin. Conditions", "points": 2, "detail": f"Loose (NFCI {nfci:.2f})"})
        else:
            breakdown.append({"factor": "Fin. Conditions", "points": 0, "detail": f"Tight (NFCI {nfci:.2f})"})

    # Inflation trending down: +1
    cpi = data.get("CPIAUCSL", {})
    if cpi.get("change") is not None:
        if cpi["change"] <= 0 or cpi.get("direction") == "down":
            score += 1
            breakdown.append({"factor": "CPI Trend", "points": 1, "detail": "Declining"})
        else:
            breakdown.append({"factor": "CPI Trend", "points": 0, "detail": "Rising"})

    # Core PCE below 3%: +1
    pce = data.get("PCEPILFE", {}).get("value")
    if pce is not None:
        # PCE is index, need YoY. Approximate: if latest < 3 (as rate proxy)
        # FRED provides the index, not the rate. We compare change.
        # For simplicity, use the breakeven inflation as proxy
        bei = data.get("T10YIE", {}).get("value")
        if bei is not None and bei < 3.0:
            score += 1
            breakdown.append({"factor": "Inflation Expect.", "points": 1, "detail": f"Breakeven {bei:.2f}%"})
        elif bei is not None:
            breakdown.append({"factor": "Inflation Expect.", "points": 0, "detail": f"Breakeven {bei:.2f}%"})

    # Unemployment below 5%: +1
    unrate = data.get("UNRATE", {}).get("value")
    if unrate is not None:
        if unrate < 5.0:
            score += 1
            breakdown.append({"factor": "Unemployment", "points": 1, "detail": f"{unrate:.1f}%"})
        else:
            breakdown.append({"factor": "Unemployment", "points": 0, "detail": f"{unrate:.1f}%"})

    # HY spread below 400bps: +1
    hy = data.get("BAMLH0A0HYM2", {}).get("value")
    if hy is not None:
        if hy < 4.0:
            score += 1
            breakdown.append({"factor": "HY Spread", "points": 1, "detail": f"{round(hy * 100)}bps"})
        else:
            breakdown.append({"factor": "HY Spread", "points": 0, "detail": f"{round(hy * 100)}bps"})

    # 10Y below 5%: +1
    dgs10 = data.get("DGS10", {}).get("value")
    if dgs10 is not None:
        if dgs10 < 5.0:
            score += 1
            breakdown.append({"factor": "10Y Yield", "points": 1, "detail": f"{dgs10:.2f}%"})
        else:
            breakdown.append({"factor": "10Y Yield", "points": 0, "detail": f"{dgs10:.2f}%"})

    # GDP growth positive: +1
    gdp = data.get("GDPC1", {})
    if gdp.get("change") is not None:
        if gdp["change"] > 0:
            score += 1
            breakdown.append({"factor": "GDP Growth", "points": 1, "detail": "Positive"})
        else:
            breakdown.append({"factor": "GDP Growth", "points": 0, "detail": "Contracting"})

    # Determine regime
    if score >= 8:
        regime = "TAILWIND"
        color = "green"
        sizing = "Full position sizing permitted"
    elif score >= 5:
        regime = "NEUTRAL"
        color = "yellow"
        sizing = "Standard position sizing"
    elif score >= 3:
        regime = "HEADWIND"
        color = "orange"
        sizing = "Half position sizes"
    else:
        regime = "CRISIS"
        color = "red"
        sizing = "No new trades. Capital preservation only."

    return {
        "score": score,
        "max": 10,
        "regime": regime,
        "color": color,
        "sizing": sizing,
        "breakdown": breakdown,
    }


# ─────────────────────────────────────────────
# KEY RATES SUMMARY
# ─────────────────────────────────────────────
def get_key_rates(data: dict) -> dict:
    """Extract key rates for dashboard display."""
    return {
        "fed_funds": data.get("DFF", {}).get("value"),
        "ten_year": data.get("DGS10", {}).get("value"),
        "two_year": data.get("DGS2", {}).get("value"),
        "yield_curve": data.get("T10Y2Y", {}).get("value"),
        "vix": data.get("VIXCLS", {}).get("value"),
        "hy_spread": data.get("BAMLH0A0HYM2", {}).get("value"),
        "nfci": data.get("NFCI", {}).get("value"),
        "unemployment": data.get("UNRATE", {}).get("value"),
        "claims": data.get("ICSA", {}).get("value"),
    }


# ─────────────────────────────────────────────
# ECONOMIC EVENTS CALENDAR
# ─────────────────────────────────────────────
# Major economic events with approximate dates (updated manually or via data source)
# In production, this would be fetched from an API. For now, maintain a rolling list.
_ECONOMIC_EVENTS = [
    # Format: (month, day_approx, event, impact)
    # These repeat monthly/quarterly — logic below generates upcoming dates
]

# Known recurring events
RECURRING_EVENTS = [
    {"name": "FOMC Meeting", "frequency": "6-weekly", "impact": "HIGH",
     "dates_2026": ["01-28", "03-18", "05-06", "06-17", "07-29", "09-16", "11-04", "12-16"]},
    {"name": "CPI Release", "frequency": "monthly", "impact": "HIGH", "day_of_month": 12},
    {"name": "Jobs Report (NFP)", "frequency": "monthly", "impact": "HIGH", "day_of_month": 5},
    {"name": "Core PCE", "frequency": "monthly", "impact": "HIGH", "day_of_month": 28},
    {"name": "GDP (Advance)", "frequency": "quarterly", "impact": "MEDIUM",
     "dates_2026": ["01-30", "04-29", "07-30", "10-29"]},
    {"name": "Retail Sales", "frequency": "monthly", "impact": "MEDIUM", "day_of_month": 15},
]


def get_upcoming_events(days_ahead: int = 14) -> list:
    """
    Get economic events within the next N days.
    Returns sorted list: [{name, date, impact, days_until}]
    """
    today = date.today()
    end = today + timedelta(days=days_ahead)
    events = []

    for event in RECURRING_EVENTS:
        # Check specific dates first
        if "dates_2026" in event:
            for d_str in event["dates_2026"]:
                try:
                    event_date = date(today.year, int(d_str[:2]), int(d_str[3:5]))
                    if today <= event_date <= end:
                        days_until = (event_date - today).days
                        events.append({
                            "name": event["name"],
                            "date": event_date.isoformat(),
                            "impact": event["impact"],
                            "days_until": days_until,
                            "imminent": days_until <= 2,
                        })
                except ValueError:
                    continue

        # Check recurring monthly events
        if "day_of_month" in event:
            for month_offset in [0, 1]:
                m = today.month + month_offset
                y = today.year
                if m > 12:
                    m -= 12
                    y += 1
                try:
                    event_date = date(y, m, min(event["day_of_month"], 28))
                    if today <= event_date <= end:
                        days_until = (event_date - today).days
                        events.append({
                            "name": event["name"],
                            "date": event_date.isoformat(),
                            "impact": event["impact"],
                            "days_until": days_until,
                            "imminent": days_until <= 2,
                        })
                except ValueError:
                    continue

    events.sort(key=lambda e: e["days_until"])
    # Deduplicate by name+date
    seen = set()
    unique = []
    for e in events:
        key = f"{e['name']}_{e['date']}"
        if key not in seen:
            seen.add(key)
            unique.append(e)

    return unique


# ─────────────────────────────────────────────
# POSITION SIZING MODIFIER
# ─────────────────────────────────────────────
def sizing_modifier(macro_score: int) -> float:
    """
    Returns position sizing multiplier based on macro score.
    8+: 1.0 (full), 5-7: 0.75 (standard), 3-4: 0.5 (half), 0-2: 0.0 (no new trades)
    """
    if macro_score >= 8:
        return 1.0
    if macro_score >= 5:
        return 0.75
    if macro_score >= 3:
        return 0.5
    return 0.0


# ─────────────────────────────────────────────
# SECTOR-SPECIFIC MACRO CONTEXT
# ─────────────────────────────────────────────
def sector_macro_context(sector: str, data: dict) -> str:
    """
    Generate sector-specific macro commentary for Analyze page.
    """
    dgs10 = data.get("DGS10", {}).get("value", 0) or 0
    nfci = data.get("NFCI", {}).get("value", 0) or 0
    hy = data.get("BAMLH0A0HYM2", {}).get("value", 0) or 0

    sector_lower = (sector or "").lower()

    if "tech" in sector_lower or "software" in sector_lower:
        rate_impact = "favorable" if dgs10 < 4.5 else "headwind" if dgs10 > 5 else "neutral"
        return f"Tech: Rates {rate_impact} (10Y: {dgs10:.2f}%). Growth stocks sensitive to discount rate. NFCI: {'loose' if nfci < 0 else 'tight'}."

    if "financ" in sector_lower or "bank" in sector_lower:
        curve = data.get("T10Y2Y", {}).get("value", 0) or 0
        return f"Financials: Yield curve {'positive' if curve > 0 else 'inverted'} ({curve:.2f}%). NIM {'expanding' if curve > 0.5 else 'compressing'}."

    if "energy" in sector_lower:
        return f"Energy: Macro {'supportive' if nfci < 0 else 'cautious'}. Watch for demand signals in GDP/retail data."

    if "health" in sector_lower:
        return f"Healthcare: Defensive sector. Less rate-sensitive. HY spread: {round((hy or 0) * 100)}bps."

    if "consumer" in sector_lower or "retail" in sector_lower:
        unrate = data.get("UNRATE", {}).get("value", 0) or 0
        return f"Consumer: Unemployment {unrate:.1f}%. Labor market {'strong' if unrate < 4.5 else 'softening'}."

    if "industrial" in sector_lower or "material" in sector_lower:
        gdp_dir = data.get("GDPC1", {}).get("direction", "flat")
        return f"Industrials: GDP {gdp_dir}. Cyclical — tracks economic expansion."

    if "real estate" in sector_lower:
        return f"Real Estate: Rate-sensitive. 10Y at {dgs10:.2f}%. {'Favorable' if dgs10 < 4 else 'Challenging'} environment."

    if "utilit" in sector_lower:
        return f"Utilities: Yield play. 10Y at {dgs10:.2f}%. {'Less attractive vs bonds' if dgs10 > 4.5 else 'Competitive yield'}."

    return f"Macro backdrop: NFCI {'loose' if nfci < 0 else 'tight'}, 10Y: {dgs10:.2f}%."


# ─────────────────────────────────────────────
# FULL MACRO DASHBOARD
# ─────────────────────────────────────────────
def get_full_macro() -> dict:
    """
    Get complete macro intelligence package.
    Returns: {series, score, rates, events, sizing, timestamp}
    """
    # Try loading from cache first
    cached = _load_cache()
    if cached and _is_fresh(cached):
        return cached

    data = fetch_all_series()
    if not data:
        return _empty_macro()

    score = calc_macro_score(data)
    rates = get_key_rates(data)
    events = get_upcoming_events(14)

    result = {
        "series": data,
        "score": score,
        "rates": rates,
        "events": events,
        "sizing_modifier": sizing_modifier(score["score"]),
        "timestamp": datetime.utcnow().isoformat(),
    }

    _save_cache(result)
    return result


def _empty_macro() -> dict:
    return {
        "series": {},
        "score": {"score": 5, "max": 10, "regime": "NEUTRAL", "color": "yellow",
                  "sizing": "Standard (FRED unavailable)", "breakdown": []},
        "rates": {},
        "events": get_upcoming_events(14),
        "sizing_modifier": 0.75,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────
# FILE CACHE (refresh daily at 7 AM ET)
# ─────────────────────────────────────────────
def _ensure_data_dir():
    os.makedirs(_DATA_DIR, exist_ok=True)


def _load_cache() -> Optional[dict]:
    try:
        with open(_MACRO_CACHE_PATH) as f:
            return json.load(f)
    except Exception:
        return None


def _save_cache(data: dict):
    _ensure_data_dir()
    try:
        with open(_MACRO_CACHE_PATH, "w") as f:
            json.dump(data, f)
    except Exception as e:
        log.warning(f"Failed to save macro cache: {e}")


def _is_fresh(cached: dict) -> bool:
    """Check if cached data is still fresh (< 24 hours for daily, < 1 week for monthly)."""
    ts = cached.get("timestamp", "")
    if not ts:
        return False
    try:
        cache_time = datetime.fromisoformat(ts)
        age_hours = (datetime.utcnow() - cache_time).total_seconds() / 3600
        return age_hours < 20  # Refresh every ~20 hours
    except Exception:
        return False
```

## 2d. FINRA Short Volume (backend/finra_short_volume.py) — Full Contents

```python
"""
FINRA Daily Short Volume — Institutional short volume intelligence
Free public data, no API key required.
Downloads daily CNMS short volume report, calculates SVR and signals.
"""

import os, json, logging, io
from datetime import datetime, timedelta, date
from typing import Optional

import requests
import numpy as np

log = logging.getLogger("mkw.finra")

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_HISTORY_PATH = os.path.join(_DATA_DIR, "finra_svr_history.json")

FINRA_BASE = "https://cdn.finra.org/equity/regsho/daily"

# Multiple FINRA files cover different exchanges — aggregate for completeness
FINRA_PREFIXES = ["CNMSshvol", "FNYXshvol", "FNQCshvol"]


def _ensure_data_dir():
    os.makedirs(_DATA_DIR, exist_ok=True)


# ─────────────────────────────────────────────
# DATA FETCHING
# ─────────────────────────────────────────────
def _trading_dates(n: int = 20) -> list:
    """Generate last N trading dates (weekdays only)."""
    dates = []
    d = date.today()
    while len(dates) < n:
        if d.weekday() < 5:
            dates.append(d)
        d -= timedelta(days=1)
    return dates


def fetch_daily_file(target_date: date) -> Optional[list]:
    """
    Download and parse FINRA short volume files for a given date.
    Aggregates across CNMS, FNYC, FNQC for complete exchange coverage.
    File is pipe-delimited: Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market
    Returns list of dicts: [{symbol, short_vol, total_vol, svr}, ...]
    """
    date_str = target_date.strftime("%Y%m%d")

    # Aggregate across multiple FINRA files
    aggregated = {}  # symbol -> {short_vol, total_vol}

    for prefix in FINRA_PREFIXES:
        url = f"{FINRA_BASE}/{prefix}{date_str}.txt"
        try:
            r = requests.get(url, timeout=10)
            if r.status_code != 200:
                continue

            lines = r.text.strip().split("\n")
            for line in lines[1:]:  # Skip header
                parts = line.strip().split("|")
                if len(parts) < 5:
                    continue
                try:
                    symbol = parts[1].strip()
                    short_vol = int(float(parts[2]))
                    total_vol = int(float(parts[4]))
                    if total_vol > 0:
                        if symbol not in aggregated:
                            aggregated[symbol] = {"short_vol": 0, "total_vol": 0}
                        aggregated[symbol]["short_vol"] += short_vol
                        aggregated[symbol]["total_vol"] += total_vol
                except (ValueError, IndexError):
                    continue
        except Exception as e:
            log.warning(f"FINRA fetch {prefix}{date_str}: {e}")

    if not aggregated:
        return None

    records = []
    for symbol, data in aggregated.items():
        if data["total_vol"] > 0:
            svr = round(data["short_vol"] / data["total_vol"] * 100, 1)
            records.append({
                "symbol": symbol,
                "short_vol": data["short_vol"],
                "total_vol": data["total_vol"],
                "svr": svr,
                "date": target_date.isoformat(),
            })

    return records


# ─────────────────────────────────────────────
# HISTORY MANAGEMENT
# ─────────────────────────────────────────────
def load_history() -> dict:
    """Load stored SVR history: {ticker: [{date, svr, short_vol, total_vol}, ...]}"""
    try:
        with open(_HISTORY_PATH) as f:
            return json.load(f)
    except Exception:
        return {}


def save_history(history: dict):
    """Persist SVR history."""
    _ensure_data_dir()
    try:
        with open(_HISTORY_PATH, "w") as f:
            json.dump(history, f)
    except Exception as e:
        log.warning(f"Failed to save FINRA history: {e}")


def update_history(universe: list = None):
    """
    Download latest trading day's data and update history.
    Called once daily after 5 PM ET.
    """
    history = load_history()
    dates_to_fetch = _trading_dates(5)  # Last 5 days to fill gaps

    for target_date in dates_to_fetch:
        date_str = target_date.isoformat()
        # Check if we already have this date
        sample_ticker = next(iter(history), None)
        if sample_ticker:
            existing_dates = {e["date"] for e in history.get(sample_ticker, [])}
            if date_str in existing_dates:
                continue

        records = fetch_daily_file(target_date)
        if not records:
            continue

        log.info(f"FINRA: Processing {len(records)} records for {date_str}")

        # Filter to universe if provided
        record_map = {r["symbol"]: r for r in records}

        tickers_to_update = universe or list(record_map.keys())
        for ticker in tickers_to_update:
            if ticker not in record_map:
                continue
            r = record_map[ticker]
            entries = history.get(ticker, [])
            # Don't duplicate
            if entries and entries[-1].get("date") == date_str:
                continue
            entries.append({
                "date": date_str,
                "svr": r["svr"],
                "short_vol": r["short_vol"],
                "total_vol": r["total_vol"],
            })
            # Keep 20 trading days
            history[ticker] = entries[-20:]

    save_history(history)
    log.info(f"FINRA history updated: {len(history)} tickers")
    return history


# ─────────────────────────────────────────────
# ANALYSIS
# ─────────────────────────────────────────────
def _svr_label(svr: float) -> str:
    if svr >= 65:
        return "EXTREME"
    if svr >= 55:
        return "HIGH"
    if svr >= 50:
        return "ELEVATED"
    if svr >= 35:
        return "NORMAL"
    return "LOW"


def analyze_ticker(ticker: str) -> dict:
    """
    Full SVR analysis for a single ticker.
    Returns: {svr_today, svr_5d_avg, svr_20d_avg, svr_trend, svr_spike, signal, label, history}
    """
    history = load_history()
    entries = history.get(ticker.upper(), [])

    if not entries:
        return {
            "ticker": ticker.upper(),
            "svr_today": None, "svr_5d_avg": None, "svr_20d_avg": None,
            "svr_trend": "unknown", "svr_spike": False,
            "signal": "NO DATA", "label": "UNKNOWN", "color": "gray",
            "history": [],
        }

    svrs = [e["svr"] for e in entries]
    svr_today = svrs[-1] if svrs else 0
    svr_5d = round(np.mean(svrs[-5:]), 1) if len(svrs) >= 5 else round(np.mean(svrs), 1)
    svr_20d = round(np.mean(svrs), 1)

    # Trend: compare last 5 vs previous 5
    if len(svrs) >= 10:
        recent = np.mean(svrs[-5:])
        prior = np.mean(svrs[-10:-5])
        if recent > prior * 1.1:
            trend = "RISING"
        elif recent < prior * 0.9:
            trend = "FALLING"
        else:
            trend = "STABLE"
    elif len(svrs) >= 3:
        if svrs[-1] > svrs[0] * 1.1:
            trend = "RISING"
        elif svrs[-1] < svrs[0] * 0.9:
            trend = "FALLING"
        else:
            trend = "STABLE"
    else:
        trend = "UNKNOWN"

    # Spike detection: today > 20d avg + 2 std dev
    spike = False
    if len(svrs) >= 5:
        std = float(np.std(svrs))
        spike = svr_today > (svr_20d + 2 * std)

    # Signal interpretation
    # Key nuance: High SVR alone is NOT bearish. Signal = TREND + DEVIATION + CONTEXT
    label = _svr_label(svr_today)
    if label == "LOW":
        signal = "BULLISH — minimal short pressure"
        color = "green"
    elif label == "NORMAL":
        signal = "NEUTRAL — normal market making activity"
        color = "gray"
    elif label == "ELEVATED" and trend == "RISING":
        signal = "CAUTION — rising short pressure"
        color = "yellow"
    elif label == "ELEVATED":
        signal = "NEUTRAL-ELEVATED — within normal range"
        color = "yellow"
    elif label == "HIGH" and spike:
        signal = "WARNING — spike detected, potential distribution"
        color = "red"
    elif label == "HIGH" and trend == "RISING":
        signal = "BEARISH — sustained high short volume"
        color = "red"
    elif label == "HIGH":
        signal = "ELEVATED — consistently high but stable"
        color = "orange"
    elif label == "EXTREME" and spike:
        signal = "EXTREME — possible forced covering or heavy distribution"
        color = "red"
    else:
        signal = f"{label} — {trend.lower()} trend"
        color = "red" if svr_today >= 55 else "yellow"

    return {
        "ticker": ticker.upper(),
        "svr_today": svr_today,
        "svr_5d_avg": svr_5d,
        "svr_20d_avg": svr_20d,
        "svr_trend": trend,
        "svr_spike": spike,
        "signal": signal,
        "label": label,
        "color": color,
        "history": entries[-20:],
    }


def convergence_adjustment(ticker: str, is_short: bool = False) -> int:
    """
    Calculate convergence score adjustment from SVR.
    +1 if SVR < 35% (for longs) or > 55% (for shorts).
    """
    data = analyze_ticker(ticker)
    svr = data.get("svr_today")
    if svr is None:
        return 0
    if not is_short and svr < 35:
        return 1  # Low short pressure = bullish for longs
    if is_short and svr > 55:
        return 1  # High short pressure = supports short thesis
    return 0


def top_short_volume(universe: list, n: int = 10) -> list:
    """
    Get top N tickers by SVR from universe.
    Returns sorted list of analysis dicts.
    """
    results = []
    for ticker in universe:
        data = analyze_ticker(ticker)
        if data.get("svr_today") is not None:
            results.append(data)

    results.sort(key=lambda x: x.get("svr_today", 0), reverse=True)
    return results[:n]


def short_squeeze_candidates(universe: list) -> list:
    """
    Find short squeeze candidates:
    - SVR > 55% AND trend RISING AND price trend UP
    These stocks have heavy shorting but price is resilient.
    """
    results = []
    for ticker in universe:
        data = analyze_ticker(ticker)
        svr = data.get("svr_today")
        if svr and svr > 55 and data.get("svr_trend") == "RISING":
            results.append(data)

    results.sort(key=lambda x: x.get("svr_today", 0), reverse=True)
    return results


def distribution_detection(universe: list) -> list:
    """
    Find distribution signals:
    - SVR spike detected AND trend RISING
    """
    results = []
    for ticker in universe:
        data = analyze_ticker(ticker)
        if data.get("svr_spike") and data.get("svr_trend") in ("RISING", "STABLE"):
            results.append(data)

    results.sort(key=lambda x: x.get("svr_today", 0), reverse=True)
    return results
```

## 2e. Unusual Whales / Options Flow

No direct Unusual Whales API integration found. Options flow analysis is done via Polygon.io options chain data in options_engine.py.

## 2f. Data Router — API Client / Fetch Wrapper / Fallback Layer (backend/data_router.py) — Full Contents

```python
"""
Data Router — Central data abstraction for MKW Command Center
Priority chain: Polygon → yfinance fallback
Every response includes: {data, source, timestamp, quality}
"""

import os, time, logging
from datetime import datetime
from typing import Optional

import pandas as pd
import yfinance as yf

import polygon_client as poly

log = logging.getLogger("mkw.router")

# ─────────────────────────────────────────────
# STATUS TRACKING
# ─────────────────────────────────────────────
_source_status = {
    "polygon": {"ok": False, "last_check": 0, "errors": 0},
    "yfinance": {"ok": True, "last_check": 0, "errors": 0},
    "finra": {"ok": False, "last_check": 0, "errors": 0},
    "fred": {"ok": False, "last_check": 0, "errors": 0},
}


def _mark_ok(source: str):
    _source_status[source]["ok"] = True
    _source_status[source]["last_check"] = time.time()
    _source_status[source]["errors"] = 0


def _mark_fail(source: str):
    _source_status[source]["errors"] += 1
    _source_status[source]["last_check"] = time.time()
    if _source_status[source]["errors"] > 5:
        _source_status[source]["ok"] = False


def get_status() -> dict:
    """Return current data source status for frontend status bar."""
    poly_key = bool(os.getenv("POLYGON_API_KEY", ""))
    fred_key = bool(os.getenv("FRED_API_KEY", ""))

    quality = "STANDARD" if poly_key else "BASIC"

    return {
        "polygon": {"connected": poly_key, **_source_status["polygon"]},
        "yfinance": _source_status["yfinance"],
        "finra": _source_status["finra"],
        "fred": {"connected": fred_key, **_source_status["fred"]},
        "quality": quality,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────
# OHLCV — Polygon → yfinance
# ─────────────────────────────────────────────
def fetch_ohlcv(ticker: str, period: str = "2y") -> Optional[pd.DataFrame]:
    """
    Fetch OHLCV data. Tries Polygon first, falls back to yfinance.
    Returns standard DataFrame: DatetimeIndex, columns=[Open, High, Low, Close, Volume]
    """
    source = "yfinance"

    # Try Polygon first
    if poly.is_available():
        try:
            df = poly.fetch_ohlcv(ticker, period)
            if df is not None and len(df) >= 60:
                _mark_ok("polygon")
                return df
        except Exception as e:
            log.warning(f"Polygon OHLCV {ticker}: {e}")
            _mark_fail("polygon")

    # Fallback: yfinance
    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period, auto_adjust=True)
        if df.empty or len(df) < 60:
            return None
        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.index = pd.to_datetime(df.index)
        _mark_ok("yfinance")
        return df
    except Exception as e:
        log.warning(f"yfinance OHLCV {ticker}: {e}")
        _mark_fail("yfinance")
        return None


# ─────────────────────────────────────────────
# FUNDAMENTALS — Polygon → yfinance
# ─────────────────────────────────────────────
_FUND_EMPTY = {
    "eps": 0, "rev": 0, "marginsExpanding": False, "marketCap": 0, "name": "",
    "grossMargins": 0, "operatingMargins": 0, "returnOnEquity": 0, "returnOnCapital": 0,
    "freeCashflow": 0, "debtToEquity": 0, "trailingPE": None, "forwardPE": None,
    "institutionalOwnershipPct": 0, "nextEarningsDate": "", "sector": "", "industry": "",
}


def fetch_fundamentals(ticker: str) -> dict:
    """
    Fetch company fundamentals. Polygon details + financials → yfinance fallback.
    Returns standardized dict with 16+ keys.
    """

    # Try Polygon
    if poly.is_available():
        try:
            details = poly.fetch_ticker_details(ticker)
            financials = poly.fetch_financials(ticker)

            if details:
                _mark_ok("polygon")
                result = dict(_FUND_EMPTY)
                result["name"] = details.get("name", ticker)
                result["sector"] = details.get("sector", "")
                result["industry"] = details.get("industry", "")
                result["marketCap"] = details.get("marketCap", 0)

                if financials:
                    result["eps"] = financials.get("eps", 0)
                    result["rev"] = financials.get("rev", 0)
                    result["marginsExpanding"] = financials.get("marginsExpanding", False)
                    result["grossMargins"] = financials.get("grossMargins", 0)
                    result["operatingMargins"] = financials.get("operatingMargins", 0)
                    result["returnOnEquity"] = financials.get("returnOnEquity", 0)
                    result["returnOnCapital"] = financials.get("returnOnEquity", 0)
                    result["freeCashflow"] = financials.get("freeCashflow", 0)
                    result["debtToEquity"] = financials.get("debtToEquity", 0)

                return result
        except Exception as e:
            log.warning(f"Polygon fundamentals {ticker}: {e}")
            _mark_fail("polygon")

    # Fallback: yfinance
    return _yf_fundamentals(ticker)


def _yf_fundamentals(ticker: str) -> dict:
    """yfinance fundamentals fetch (original logic)."""
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        fin = t.financials
        eps_growth, rev_growth, margins_exp = 0, 0, False
        try:
            if fin is not None and not fin.empty:
                ni = fin.loc["Net Income"] if "Net Income" in fin.index else None
                rev = fin.loc["Total Revenue"] if "Total Revenue" in fin.index else None
                gp = fin.loc["Gross Profit"] if "Gross Profit" in fin.index else None
                if ni is not None and len(ni) >= 2 and ni.iloc[1] != 0:
                    eps_growth = int((ni.iloc[0] - ni.iloc[1]) / abs(ni.iloc[1]) * 100)
                if rev is not None and len(rev) >= 2 and rev.iloc[1] != 0:
                    rev_growth = int((rev.iloc[0] - rev.iloc[1]) / abs(rev.iloc[1]) * 100)
                if gp is not None and rev is not None and len(gp) >= 2 and len(rev) >= 2:
                    m0 = gp.iloc[0] / rev.iloc[0] if rev.iloc[0] else 0
                    m1 = gp.iloc[1] / rev.iloc[1] if rev.iloc[1] else 0
                    margins_exp = m0 > m1
        except Exception:
            pass

        gross_margins = info.get("grossMargins", 0) or 0
        roe = info.get("returnOnEquity", 0) or 0
        roic = info.get("returnOnCapital", 0) or info.get("returnOnEquity", 0) or 0
        fcf = info.get("freeCashflow", 0) or 0
        operating_margins = info.get("operatingMargins", 0) or 0
        debt_equity = info.get("debtToEquity", 0) or 0
        inst_pct = info.get("heldPercentInstitutions", 0) or 0

        next_earnings = ""
        try:
            cal = t.calendar
            if cal is not None:
                if isinstance(cal, dict):
                    ed = cal.get("Earnings Date", None)
                    if ed is not None:
                        if hasattr(ed, '__iter__') and not isinstance(ed, str):
                            ed = list(ed)
                            if ed:
                                next_earnings = str(ed[0])[:10]
                        else:
                            next_earnings = str(ed)[:10]
                elif isinstance(cal, pd.DataFrame):
                    if "Earnings Date" in cal.index:
                        val = cal.loc["Earnings Date"].iloc[0] if not cal.loc["Earnings Date"].empty else ""
                        next_earnings = str(val)[:10] if val else ""
        except Exception:
            pass

        _mark_ok("yfinance")
        return {
            "eps": eps_growth, "rev": rev_growth, "marginsExpanding": margins_exp,
            "marketCap": info.get("marketCap", 0),
            "name": info.get("longName", ticker),
            "grossMargins": round(float(gross_margins), 4) if gross_margins else 0,
            "operatingMargins": round(float(operating_margins), 4) if operating_margins else 0,
            "returnOnEquity": round(float(roe), 4) if roe else 0,
            "returnOnCapital": round(float(roic), 4) if roic else 0,
            "freeCashflow": int(fcf) if fcf else 0,
            "debtToEquity": round(float(debt_equity), 2) if debt_equity else 0,
            "trailingPE": round(float(info.get("trailingPE", 0) or 0), 2) or None,
            "forwardPE": round(float(info.get("forwardPE", 0) or 0), 2) or None,
            "institutionalOwnershipPct": round(float(inst_pct) * 100, 1) if inst_pct else 0,
            "nextEarningsDate": next_earnings,
            "sector": info.get("sector", ""),
            "industry": info.get("industry", ""),
        }
    except Exception as e:
        log.warning(f"yfinance fundamentals {ticker}: {e}")
        _mark_fail("yfinance")
        return dict(_FUND_EMPTY, name=ticker)


# ─────────────────────────────────────────────
# OPTIONS CHAIN — Polygon → yfinance
# ─────────────────────────────────────────────
def fetch_options_data(ticker: str, spot: float = 0) -> dict:
    """
    Fetch options chain with Greeks.
    Returns: {snapshot, iv_analysis, source}
    Polygon gives real Greeks in one call. yfinance needs multiple calls + estimated Greeks.
    """
    # Try Polygon
    if poly.is_available():
        try:
            snapshot = poly.fetch_options_snapshot(ticker)
            if snapshot and snapshot.get("calls"):
                _mark_ok("polygon")
                iv_analysis = poly.extract_iv_analysis_from_snapshot(snapshot, spot)
                return {
                    "snapshot": snapshot,
                    "iv_analysis": iv_analysis,
                    "chain": poly.build_chain_dataframes(snapshot),
                    "source": "polygon",
                }
        except Exception as e:
            log.warning(f"Polygon options {ticker}: {e}")
            _mark_fail("polygon")

    # Fallback: yfinance (returns ticker object for options_engine to use)
    try:
        ticker_obj = yf.Ticker(ticker)
        expirations = ticker_obj.options
        if expirations:
            _mark_ok("yfinance")
            return {
                "snapshot": None,
                "iv_analysis": None,  # Will be calculated by options_engine
                "yf_ticker": ticker_obj,
                "source": "yfinance",
            }
    except Exception as e:
        log.warning(f"yfinance options {ticker}: {e}")
        _mark_fail("yfinance")

    return {"snapshot": None, "iv_analysis": None, "source": "none"}


# ─────────────────────────────────────────────
# GROUPED DAILY — Polygon only (no yfinance equivalent)
# ─────────────────────────────────────────────
def fetch_grouped_daily(target_date: str = "") -> Optional[dict]:
    """
    Fetch ALL US stock OHLCV in one call (Polygon only).
    Returns {ticker: {open, high, low, close, volume, vwap}} or None.
    """
    if not poly.is_available():
        return None
    try:
        result = poly.fetch_grouped_daily(target_date)
        if result:
            _mark_ok("polygon")
        return result
    except Exception as e:
        log.warning(f"Polygon grouped daily: {e}")
        _mark_fail("polygon")
        return None


# ─────────────────────────────────────────────
# QUOTE — Polygon → yfinance
# ─────────────────────────────────────────────
def fetch_quote(ticker: str) -> Optional[dict]:
    """Fetch current quote."""
    if poly.is_available():
        try:
            q = poly.fetch_quote(ticker)
            if q:
                _mark_ok("polygon")
                return q
        except Exception:
            _mark_fail("polygon")

    # yfinance fallback
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        _mark_ok("yfinance")
        return {
            "price": info.get("currentPrice", 0) or info.get("regularMarketPrice", 0),
            "change": info.get("regularMarketChange", 0),
            "changePct": round(info.get("regularMarketChangePercent", 0), 2),
            "volume": info.get("regularMarketVolume", 0),
            "vwap": 0,
            "prevClose": info.get("previousClose", 0),
            "open": info.get("regularMarketOpen", 0),
            "high": info.get("regularMarketDayHigh", 0),
            "low": info.get("regularMarketDayLow", 0),
        }
    except Exception:
        _mark_fail("yfinance")
        return None


# ─────────────────────────────────────────────
# DYNAMIC UNIVERSE
# ─────────────────────────────────────────────
# Static fallback universe (used when Polygon unavailable)
STATIC_UNIVERSE = [
    "NVDA", "AVGO", "TSLA", "AAPL", "MSFT", "GOOGL", "META", "AMZN", "AMD", "CRM",
    "PLTR", "CRWD", "PANW", "NET", "DDOG", "APP", "AXON", "COIN", "MELI", "SHOP",
    "SNOW", "NOW", "ADBE", "ORCL", "TSM", "ASML", "KLAC", "LRCX", "AMAT", "MRVL",
    "LLY", "UNH", "ISRG", "VRTX", "GE", "CAT", "DE", "LMT", "XOM", "COST",
    "WMT", "HD", "V", "MA", "GS", "JPM", "TSEM", "RKLB", "DELL", "CF",
    "GKOS", "CELH", "DUOL", "HIMS", "TOST", "DECK", "CMG", "LULU", "ON", "MPWR",
]


def get_universe() -> list:
    """
    Get trading universe. Uses Polygon dynamic list if available,
    falls back to static list.
    """
    if poly.is_available():
        try:
            tickers = poly.fetch_active_tickers(min_market_cap=2e9, limit=500)
            if tickers and len(tickers) > 50:
                _mark_ok("polygon")
                log.info(f"Dynamic universe: {len(tickers)} tickers")
                return tickers[:500]  # Cap at 500 for performance
        except Exception as e:
            log.warning(f"Dynamic universe failed: {e}")
            _mark_fail("polygon")

    return list(STATIC_UNIVERSE)
```

## 2f (cont). LLM Provider — Multi-Provider AI Layer (backend/llm_provider.py) — Full Contents

```python
"""
MKW LLM Provider Layer — Multi-provider with cascading fallback.
Groq (primary) → Gemini (fallback) → Cerebras (second fallback).
All use OpenAI-compatible chat completions API via raw requests.
Zero dependencies beyond `requests` (already in requirements).
"""

import os
import json
import time
import logging
import threading
from typing import Generator, Optional

import requests

log = logging.getLogger("mkw.llm")

# ─────────────────────────────────────────────
# PROVIDER CONFIGURATION
# ─────────────────────────────────────────────
PROVIDERS = {
    "groq": {
        "name": "Groq",
        "base_url": "https://api.groq.com/openai/v1/chat/completions",
        "key_env": "GROQ_API_KEY",
        "model": "llama-3.3-70b-versatile",
        "reasoning_model": "deepseek-r1-distill-llama-70b",
        "max_rpm": 30,
        "context_window": 128000,
    },
    "gemini": {
        "name": "Gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "key_env": "GEMINI_API_KEY",
        "model": "gemini-2.5-flash",
        "reasoning_model": "gemini-2.5-flash",
        "max_rpm": 10,
        "context_window": 1000000,
    },
    "cerebras": {
        "name": "Cerebras",
        "base_url": "https://api.cerebras.ai/v1/chat/completions",
        "key_env": "CEREBRAS_API_KEY",
        "model": "llama-3.3-70b",
        "reasoning_model": "llama-3.3-70b",
        "max_rpm": 30,
        "context_window": 64000,
    },
}

# Priority order for fallback
PROVIDER_ORDER = ["groq", "gemini", "cerebras"]


# ─────────────────────────────────────────────
# RATE LIMITER (per-provider, thread-safe)
# ─────────────────────────────────────────────
class RateLimiter:
    def __init__(self, max_rpm: int):
        self.max_rpm = max_rpm
        self.timestamps: list = []
        self.lock = threading.Lock()

    def acquire(self) -> bool:
        """Return True if request is allowed, False if rate-limited."""
        now = time.time()
        with self.lock:
            # Remove timestamps older than 60s
            self.timestamps = [t for t in self.timestamps if now - t < 60]
            if len(self.timestamps) >= self.max_rpm:
                return False
            self.timestamps.append(now)
            return True

    def wait_time(self) -> float:
        """Return seconds to wait before next request is allowed."""
        now = time.time()
        with self.lock:
            self.timestamps = [t for t in self.timestamps if now - t < 60]
            if len(self.timestamps) < self.max_rpm:
                return 0.0
            return 60.0 - (now - self.timestamps[0]) + 0.1


_rate_limiters = {k: RateLimiter(v["max_rpm"]) for k, v in PROVIDERS.items()}


# ─────────────────────────────────────────────
# CIRCUIT BREAKER (per-provider)
# ─────────────────────────────────────────────
_circuit_breakers = {
    k: {"failures": 0, "last_failure": 0, "is_open": False}
    for k in PROVIDERS
}
CIRCUIT_THRESHOLD = 5
CIRCUIT_TIMEOUT = 30 * 60  # 30 min cooldown


def _is_circuit_open(provider: str) -> bool:
    cb = _circuit_breakers[provider]
    if not cb["is_open"]:
        return False
    if time.time() - cb["last_failure"] > CIRCUIT_TIMEOUT:
        cb["is_open"] = False
        cb["failures"] = 0
        return False  # Half-open: allow retry
    return True


def _record_success(provider: str):
    cb = _circuit_breakers[provider]
    cb["failures"] = 0
    cb["is_open"] = False


def _record_failure(provider: str):
    cb = _circuit_breakers[provider]
    cb["failures"] += 1
    cb["last_failure"] = time.time()
    if cb["failures"] >= CIRCUIT_THRESHOLD:
        cb["is_open"] = True
        log.warning(f"Circuit breaker OPEN for {PROVIDERS[provider]['name']}")


# ─────────────────────────────────────────────
# RESPONSE CACHE (simple in-memory, TTL 10 min)
# ─────────────────────────────────────────────
_cache: dict = {}
_cache_lock = threading.Lock()
CACHE_TTL = 600  # 10 minutes


def _cache_key(messages: list) -> str:
    """Hash the last user message for caching."""
    import hashlib
    last_user = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            last_user = m["content"]
            break
    return hashlib.md5(last_user.encode()).hexdigest()


def _cache_get(key: str) -> Optional[str]:
    with _cache_lock:
        entry = _cache.get(key)
        if entry and time.time() - entry["ts"] < CACHE_TTL:
            return entry["text"]
        return None


def _cache_set(key: str, text: str):
    with _cache_lock:
        _cache[key] = {"text": text, "ts": time.time()}
        # Evict old entries
        if len(_cache) > 200:
            oldest = sorted(_cache.items(), key=lambda x: x[1]["ts"])[:50]
            for k, _ in oldest:
                _cache.pop(k, None)


# ─────────────────────────────────────────────
# CORE: STREAMING COMPLETION
# ─────────────────────────────────────────────
def stream_completion(
    messages: list,
    use_reasoning: bool = False,
    max_tokens: int = 2000,
    temperature: float = 0.7,
) -> Generator[dict, None, None]:
    """
    Stream chat completion with cascading fallback across providers.
    Yields dicts: {"type": "provider", "provider": "Groq"}
                  {"type": "content", "content": "..."}
                  {"type": "done"}
                  {"type": "error", "error": "..."}
    """
    for provider_key in PROVIDER_ORDER:
        config = PROVIDERS[provider_key]
        api_key = os.environ.get(config["key_env"], "")
        if not api_key:
            continue
        if _is_circuit_open(provider_key):
            continue
        if not _rate_limiters[provider_key].acquire():
            log.info(f"{config['name']} rate limited, trying next")
            continue

        model = config["reasoning_model"] if use_reasoning else config["model"]

        try:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            body = {
                "model": model,
                "messages": messages,
                "stream": True,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }

            resp = requests.post(
                config["base_url"],
                headers=headers,
                json=body,
                stream=True,
                timeout=60,
            )

            if resp.status_code == 429:
                log.info(f"{config['name']} 429 rate limited")
                _record_failure(provider_key)
                continue

            if resp.status_code != 200:
                log.warning(f"{config['name']} HTTP {resp.status_code}: {resp.text[:200]}")
                _record_failure(provider_key)
                continue

            # Success — yield provider info
            _record_success(provider_key)
            yield {"type": "provider", "provider": config["name"]}

            # Stream SSE chunks
            for line in resp.iter_lines(decode_unicode=True):
                if not line:
                    continue
                if not line.startswith("data: "):
                    continue
                data_str = line[6:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield {"type": "content", "content": content}
                except (json.JSONDecodeError, IndexError, KeyError):
                    continue

            yield {"type": "done"}
            return  # Success — don't try other providers

        except requests.exceptions.Timeout:
            log.warning(f"{config['name']} timeout")
            _record_failure(provider_key)
            continue
        except Exception as e:
            log.warning(f"{config['name']} error: {e}")
            _record_failure(provider_key)
            continue

    # All providers exhausted
    yield {"type": "error", "error": "All AI providers are temporarily unavailable. Please try again in a few minutes."}


def get_completion(
    messages: list,
    use_reasoning: bool = False,
    max_tokens: int = 2000,
) -> tuple:
    """
    Non-streaming completion. Returns (text, provider_name).
    """
    # Check cache
    key = _cache_key(messages)
    cached = _cache_get(key)
    if cached:
        return cached, "cache"

    full_text = ""
    provider_name = "unknown"

    for chunk in stream_completion(messages, use_reasoning, max_tokens):
        if chunk["type"] == "provider":
            provider_name = chunk["provider"]
        elif chunk["type"] == "content":
            full_text += chunk["content"]
        elif chunk["type"] == "error":
            return chunk["error"], "error"

    if full_text:
        _cache_set(key, full_text)

    return full_text, provider_name


# ─────────────────────────────────────────────
# STATUS
# ─────────────────────────────────────────────
def get_provider_status() -> dict:
    """Return status of all providers for the UI."""
    status = {}
    for key in PROVIDER_ORDER:
        config = PROVIDERS[key]
        has_key = bool(os.environ.get(config["key_env"], ""))
        cb = _circuit_breakers[key]
        rl = _rate_limiters[key]
        status[key] = {
            "name": config["name"],
            "configured": has_key,
            "circuit_open": cb["is_open"],
            "failures": cb["failures"],
            "requests_remaining": max(0, rl.max_rpm - len([t for t in rl.timestamps if time.time() - t < 60])),
        }
    return status
```

## 2g. Server-Side Routes / API Proxy — Main Backend (backend/main.py) — Full Contents

```python
"""
MKW Command Center — FastAPI Backend v2.0
Institutional-Grade Options Intelligence Platform
Minervini x Kell x Weinstein convergence engine + options pricing + trade grading
"""

import os, time, json, logging, asyncio, uuid, sys, math
from datetime import datetime, timedelta
from typing import Optional
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
import traceback

# Local modules
sys.path.insert(0, os.path.dirname(__file__))
import data_router as router
import finra_short_volume as finra
import macro_engine as macro
import polygon_client as poly
from options_engine import (
    full_options_analysis, calc_greeks, black_scholes_price,
    calc_historical_volatility, calc_iv_from_options_chain,
    calc_expected_move, compare_move_to_breakeven, select_strategy,
    build_options_snapshot, greeks_projection,
)
from grading import grade_trade, score_to_grade
from trade_ideas import generate_trade_ideas
import llm_provider
import wizard as wiz
from journal import (
    add_trade, update_trade, delete_trade, get_trades, get_trade,
    compute_analytics,
)
import qullamaggie as qull
from trade_rules import generate_trade_plan, calculate_r_multiple
from indicators import get_qullamaggie_snapshot

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("mkw")

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
FINNHUB_KEY  = os.getenv("FINNHUB_API_KEY", "")
CLAUDE_KEY   = os.getenv("ANTHROPIC_API_KEY", "")
POLYGON_KEY  = os.getenv("POLYGON_API_KEY", "")
FRED_KEY     = os.getenv("FRED_API_KEY", "")
CACHE_PRICES     = 300    # 5 min
CACHE_TECHNICALS = 1800   # 30 min
CACHE_FUNDAMENT  = 7200   # 2 hrs
CACHE_WATCHLIST  = 300
CACHE_BREADTH    = 300
CACHE_THREATS    = 300
CACHE_NEWS       = 900
CACHE_EARNINGS   = 3600
CACHE_BRIEF      = 1800
CACHE_OPTIONS    = 600    # 10 min

# Static fallback universe (used when Polygon dynamic universe unavailable)
WATCHLIST = router.STATIC_UNIVERSE
THREATS_LIST = ["CVNA","HIMS","SMCI","BYND","SNAP"]

SECTOR_ETFS  = ["XLE","XLK","XLF","XLV","XLI","XLY","XLP","XLB","XLRE","XLU","XLC"]
SECTOR_NAMES = {
    "XLE":"Energy","XLK":"Tech","XLF":"Financials","XLV":"Healthcare",
    "XLI":"Industrials","XLY":"Cons Disc","XLP":"Cons Stpl","XLB":"Materials",
    "XLRE":"Real Estate","XLU":"Utilities","XLC":"Comms",
}

# ─────────────────────────────────────────────
# POSITIONS FILE
# ─────────────────────────────────────────────
POSITIONS_FILE = "/tmp/mkw_positions.json"

def load_positions() -> dict:
    try:
        if os.path.exists(POSITIONS_FILE):
            with open(POSITIONS_FILE) as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def save_positions(pos: dict):
    try:
        with open(POSITIONS_FILE, "w") as f:
            json.dump(pos, f)
    except Exception as e:
        log.warning(f"save_positions: {e}")

_positions: dict = {}

_macro_cache: dict = {}  # Cached macro data from FRED


def _recalc_zone(score: int, max_score: int = 23) -> str:
    """Recalculate convergence zone with updated thresholds (max 23 with FINRA)."""
    if score >= 21:
        return "CONVERGENCE"
    if score >= 16:
        return "SECONDARY"
    if score >= 11:
        return "BUILDING"
    return "WATCH"


# ─────────────────────────────────────────────
# NUMPY SERIALIZATION
# ─────────────────────────────────────────────
def to_python(obj):
    if isinstance(obj, dict):
        return {k: to_python(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_python(v) for v in obj]
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        v = float(obj)
        if math.isnan(v) or math.isinf(v):
            return 0.0
        return v
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return 0.0
    return obj

# ─────────────────────────────────────────────
# CACHE
# ─────────────────────────────────────────────
_cache: dict = {}
_cache_ts: dict = {}

def cache_get(key: str, ttl: int):
    if key in _cache and (time.time() - _cache_ts.get(key, 0)) < ttl:
        return _cache[key]
    return None

def cache_set(key: str, val):
    _cache[key] = val
    _cache_ts[key] = time.time()

# ─────────────────────────────────────────────
# DATA FETCHING (via data_router: Polygon → yfinance)
# ─────────────────────────────────────────────
def fetch_ohlcv(ticker: str, period: str = "2y") -> Optional[pd.DataFrame]:
    return router.fetch_ohlcv(ticker, period)

def fetch_fundamentals(ticker: str) -> dict:
    return router.fetch_fundamentals(ticker)

def finnhub_get(path: str, params: dict = {}) -> dict:
    if not FINNHUB_KEY:
        return {}
    try:
        url = f"https://finnhub.io/api/v1{path}"
        params["token"] = FINNHUB_KEY
        r = requests.get(url, params=params, timeout=5)
        return r.json() if r.ok else {}
    except Exception:
        return {}

# ─────────────────────────────────────────────
# ALGORITHMS
# ─────────────────────────────────────────────
def calc_returns(df: pd.DataFrame):
    c = df["Close"]
    def pct(n):
        if len(c) > n:
            return round((float(c.iloc[-1]) - float(c.iloc[-n-1])) / float(c.iloc[-n-1]) * 100, 2)
        return 0.0
    return pct(1), pct(5), pct(21), pct(63), pct(126), pct(252)

def calc_rs_rating(df: pd.DataFrame, spy_df: pd.DataFrame) -> int:
    try:
        s_ret = (float(df["Close"].iloc[-1]) - float(df["Close"].iloc[-252])) / float(df["Close"].iloc[-252])
        m_ret = (float(spy_df["Close"].iloc[-1]) - float(spy_df["Close"].iloc[-252])) / float(spy_df["Close"].iloc[-252])
        excess = (s_ret - m_ret) * 100
        rs = int(min(99, max(1, 50 + excess * 1.5)))
        return rs
    except Exception:
        return 50

def weinstein_stage(df: pd.DataFrame) -> dict:
    if len(df) < 200:
        return {"stage": "?", "ma150": None, "slopeWeeks": 0, "slopeRising": False, "pctFromMA": 0}
    c = df["Close"]
    sma = c.rolling(150).mean()
    price = float(c.iloc[-1])
    sma_now  = float(sma.iloc[-1])
    sma_20d  = float(sma.iloc[-21]) if len(sma) > 21 else sma_now

    slope_rising = sma_now > sma_20d
    weeks_rising = 0
    for i in range(1, min(len(sma)-1, 60)):
        v_now  = sma.iloc[-i]
        v_prev = sma.iloc[-i-1]
        if pd.isna(v_now) or pd.isna(v_prev):
            break
        if float(v_now) > float(v_prev):
            weeks_rising += 1
        else:
            break

    pct = round((price - sma_now) / sma_now * 100, 1) if sma_now else 0

    if price > sma_now and slope_rising:
        stage = "2A" if weeks_rising < 20 else "2B"
    elif price > sma_now and not slope_rising:
        stage = "3"
    elif price < sma_now and not slope_rising:
        stage = "4A" if weeks_rising <= 15 else "4B"
    elif abs(pct) < 3:
        stage = "1B" if slope_rising else "1A"
    else:
        stage = "1A"

    return {
        "stage": stage, "ma150": round(sma_now, 2),
        "slopeWeeks": weeks_rising, "slopeRising": slope_rising, "pctFromMA": pct,
    }

def minervini_template(df: pd.DataFrame, rs: int) -> tuple[list, int]:
    if len(df) < 252:
        return [False]*8, 0
    c = df["Close"]
    h = df["High"]
    price   = float(c.iloc[-1])
    sma50   = float(c.rolling(50).mean().iloc[-1])
    sma150  = float(c.rolling(150).mean().iloc[-1])
    sma200  = float(c.rolling(200).mean().iloc[-1])
    sma200_20ago = float(c.rolling(200).mean().iloc[-21])
    high52  = float(h.rolling(252).max().iloc[-1])

    criteria = [
        price > sma50, price > sma150, price > sma200,
        sma50 > sma150, sma150 > sma200, sma200 > sma200_20ago,
        price >= high52 * 0.75, rs >= 70,
    ]
    return criteria, sum(criteria)

def kell_phase(df: pd.DataFrame):
    if len(df) < 30:
        return "Unknown", "gray", "neutral", "neutral", "neutral", 0.0, 0.0, 0.0, 0.0, 0.0
    c = df["Close"]
    lo = df["Low"]
    vol = df.get("Volume", pd.Series([1]*len(df)))

    e10  = c.ewm(span=10,  adjust=False).mean()
    e20  = c.ewm(span=20,  adjust=False).mean()
    e50  = c.ewm(span=50,  adjust=False).mean()
    e100 = c.ewm(span=100, adjust=False).mean()
    e200 = c.ewm(span=200, adjust=False).mean() if len(c) > 210 else e100

    price   = float(c.iloc[-1])
    ema10   = float(e10.iloc[-1])
    ema20   = float(e20.iloc[-1])
    ema50   = float(e50.iloc[-1])
    ema100  = float(e100.iloc[-1])
    ema200  = float(e200.iloc[-1])

    ema10_5d  = float(e10.iloc[-6]) if len(e10) > 6 else ema10
    ema20_5d  = float(e20.iloc[-6]) if len(e20) > 6 else ema20
    ema10_ris = ema10 > ema10_5d
    ema20_ris = ema20 > ema20_5d

    above10 = price > ema10
    above20 = price > ema20
    e10_gt_20 = ema10 > ema20

    pct_above_e10 = (price - ema10) / ema10 * 100 if ema10 else 0

    recent_lo_5d = float(lo.iloc[-5:].min())
    ema20_vals_5d = e20.iloc[-10:]
    ema20_min = float(ema20_vals_5d.min()) if not ema20_vals_5d.empty else ema20
    touched_ema20 = abs(recent_lo_5d - ema20_min) / ema20_min < 0.025 if ema20_min else False

    bb_std  = float(c.rolling(20).std().iloc[-1]) if len(c) > 20 else 1
    bb_mean = float(c.rolling(20).mean().iloc[-1]) if len(c) > 20 else price
    bb_pct  = (bb_std * 2) / bb_mean if bb_mean else 1

    vol_avg = float(vol.rolling(50).mean().iloc[-1]) if len(vol) > 50 else 1
    vol_now = float(vol.iloc[-1]) if not vol.empty else 1
    vol_ratio = vol_now / vol_avg if vol_avg > 0 else 1

    if pct_above_e10 > 4 and above20:
        phase, light = "Extension", "yellow"
    elif touched_ema20 and above10 and e10_gt_20 and ema10_ris:
        phase, light = "EMA Crossback", "green"
    elif bb_pct < 0.06 and above20:
        phase, light = "Wedge", "yellow"
    elif above10 and above20 and e10_gt_20 and vol_ratio > 1.5:
        phase, light = "Pop", "green"
    elif above10 and above20 and e10_gt_20 and not ema10_ris:
        phase, light = "Base n Break", "green"
    elif above10 and e10_gt_20 and ema10_ris:
        phase, light = "Reversal", "yellow"
    else:
        phase, light = "Red Light", "red"

    ema_d = "bull" if above10 and above20 and e10_gt_20 else ("bear" if not above20 else "neutral")
    ema_w = "bull" if price > ema50 and ema50 > ema100 else ("bear" if price < ema100 else "neutral")
    ema_m = "bull" if price > ema200 else ("bear" if price < ema200 * 0.95 else "neutral")

    return (phase, light, ema_d, ema_w, ema_m,
            round(ema10, 2), round(ema20, 2), round(ema50, 2), round(ema100, 2), round(ema200, 2))

def detect_vcp(df: pd.DataFrame) -> dict:
    if len(df) < 30:
        return {"count": 0, "depths": "—", "pivot": None, "tightness": 0, "volDryup": False}

    recent = df.iloc[-60:].copy().reset_index(drop=True)
    hi = recent["High"]
    lo = recent["Low"]
    vol = recent.get("Volume", pd.Series([1]*len(recent)))

    w = 4
    pivots_h, pivots_l = [], []
    for i in range(w, len(recent) - w):
        if all(float(hi.iloc[i]) >= float(hi.iloc[i-j]) for j in range(1,w+1)) and \
           all(float(hi.iloc[i]) >= float(hi.iloc[i+j]) for j in range(1,w+1)):
            pivots_h.append((i, float(hi.iloc[i])))
        if all(float(lo.iloc[i]) <= float(lo.iloc[i-j]) for j in range(1,w+1)) and \
           all(float(lo.iloc[i]) <= float(lo.iloc[i+j]) for j in range(1,w+1)):
            pivots_l.append((i, float(lo.iloc[i])))

    if len(pivots_h) < 2:
        return {"count": 0, "depths": "—", "pivot": None, "tightness": 0, "volDryup": False}

    contractions = []
    for i in range(min(len(pivots_h)-1, 4)):
        hi_val = pivots_h[i][1]
        hi_idx = pivots_h[i][0]
        lows_after = [(idx, v) for idx, v in pivots_l if idx > hi_idx]
        if lows_after:
            lo_val = min(lows_after, key=lambda x: x[1])[1]
            depth = (hi_val - lo_val) / hi_val * 100
            contractions.append(round(depth, 1))

    if not contractions:
        return {"count": 0, "depths": "—", "pivot": None, "tightness": 0, "volDryup": False}

    tightening = all(contractions[i] > contractions[i+1] for i in range(len(contractions)-1)) \
                 if len(contractions) > 1 else True

    vol_avg50 = float(df["Volume"].rolling(50).mean().iloc[-1]) if len(df) > 50 else 1
    vol_recent_5d = float(vol.iloc[-5:].mean()) if len(vol) >= 5 else vol_avg50
    vol_dryup = vol_recent_5d < vol_avg50 * 0.65

    pivot = pivots_h[-1][1]
    tightness = min(100, int(
        len(contractions) * 20 + (20 if tightening else 0) +
        (20 if vol_dryup else 0) + (20 if len(contractions) >= 3 else 0)
    ))
    depths_str = "→".join([f"{d:.0f}%" for d in contractions[:4]])

    return {
        "count": len(contractions), "depths": depths_str,
        "pivot": round(pivot, 2), "tightness": tightness, "volDryup": vol_dryup,
    }

def inverse_template(df: pd.DataFrame, rs: int) -> tuple[list, int]:
    if len(df) < 252:
        return [False]*8, 0
    c = df["Close"]
    h = df["High"]
    price   = float(c.iloc[-1])
    sma50   = float(c.rolling(50).mean().iloc[-1])
    sma150  = float(c.rolling(150).mean().iloc[-1])
    sma200  = float(c.rolling(200).mean().iloc[-1])
    sma200_20ago = float(c.rolling(200).mean().iloc[-21])
    high52  = float(h.rolling(252).max().iloc[-1])
    criteria = [
        price < sma50, price < sma150, price < sma200,
        sma50 < sma150, sma150 < sma200, sma200 < sma200_20ago,
        price <= high52 * 0.75, rs <= 30,
    ]
    return criteria, sum(criteria)

def convergence_score(wein, tpl_score, rs, phase, vcp, mkt, fund, df, detailed=False):
    price = float(df["Close"].iloc[-1]) if not df.empty else 0
    near_pivot = bool(vcp["pivot"] and abs(price / vcp["pivot"] - 1) <= 0.07) if vcp["pivot"] else False
    criteria = {
        "mkt_spx_stage2":  (mkt.get("spxStage") == 2,       1, f"SPX Stage {mkt.get('spxStage')}"),
        "mkt_spx_ema":     (mkt.get("spxEma") == "above",   1, f"SPX EMA {mkt.get('spxEma')}"),
        "mkt_tpl_count":   (mkt.get("tplCount", 0) > 200,   1, f"TPL count {mkt.get('tplCount',0)}"),
        "trend_stage2":    (wein["stage"] in ("2A","2B"),    1, f"Stage {wein['stage']}"),
        "trend_tpl8":      (tpl_score == 8,                  1, f"TPL {tpl_score}/8"),
        "trend_rs70":      (rs >= 70,                        1, f"RS {rs}"),
        "trend_kell_ok":   (phase in ("EMA Crossback","Pop","Base n Break","Extension","Reversal"), 1, f"Phase {phase}"),
        "trend_tpl5":      (tpl_score >= 5,                  1, f"TPL>=5 ({tpl_score})"),
        "fund_eps":        (fund.get("eps", 0) > 15,         1, f"EPS growth {fund.get('eps',0)}%"),
        "fund_rev":        (fund.get("rev", 0) > 10,         1, f"Rev growth {fund.get('rev',0)}%"),
        "fund_margins":    (bool(fund.get("marginsExpanding", False)), 1, "Margins expanding"),
        "entry_vcp":       (vcp["count"] >= 2,               1, f"VCP {vcp['count']}ct"),
        "entry_dryup":     (bool(vcp["volDryup"]),            1, "Volume dry-up"),
        "entry_phase":     (phase in ("EMA Crossback","Pop","Extension"), 1, f"Entry phase {phase}"),
        "entry_pivot":     (near_pivot,                      1, f"Near pivot {vcp.get('pivot','—')}"),
        "risk_stop":       (True,                            1, "Stop defined"),
        "risk_size":       (True,                            1, "Position sized"),
        "risk_rr":         (True,                            1, "R:R acceptable"),
    }
    s = sum(pts for (passed, pts, _) in criteria.values() if passed)
    zone = ("CONVERGENCE" if s >= 17 else "SECONDARY" if s >= 12 else
            "BUILDING"    if s >= 8  else "WATCH")
    if detailed:
        details = {k: {"pass": passed, "pts": pts, "note": note}
                   for k, (passed, pts, note) in criteria.items()}
        return s, zone, details
    return s, zone

def short_convergence_score(wein, inv_tpl, rs, phase, mkt, fund):
    s = 0
    if mkt.get("spxStage", 2) >= 3:        s += 1
    if mkt.get("spxEma") != "above":       s += 1
    if mkt.get("tplCount", 999) < 300:     s += 1
    stage = wein["stage"]
    if stage == "4A":                      s += 1
    if inv_tpl == 8:                       s += 1
    if rs <= 30:                           s += 1
    if phase in ("Red Light","Wedge"):     s += 1
    if inv_tpl >= 5:                       s += 1
    if fund.get("eps", 0)  < 0:            s += 1
    if fund.get("rev", 0)  < 0:            s += 1
    if not fund.get("marginsExpanding",True): s += 1
    s += 1; s += 1
    if phase in ("Red Light","Wedge"):     s += 1
    if rs <= 20:                           s += 1
    s += 3
    zone = ("SHORT_CONVERGENCE" if s >= 20 else
            "SHORT_SECONDARY"   if s >= 15 else
            "SHORT_WATCH"       if s >= 10 else "NEUTRAL")
    return s, zone

def build_setup_text(ticker, wein, tpl_score, rs, phase, vcp, conv_zone):
    if conv_zone == "CONVERGENCE":
        return (f"Full convergence — Stage {wein['stage']}, {tpl_score}/8 template, "
                f"RS {rs}, {phase}" +
                (f", VCP {vcp['count']}ct ({vcp['depths']})" if vcp["count"] > 0 else "") +
                ". All 3 frameworks agree.")
    elif conv_zone == "SECONDARY":
        return f"Secondary setup — {phase}, Stage {wein['stage']}, RS {rs}. Continuation watch."
    elif conv_zone == "BUILDING":
        issues = []
        if rs < 70:  issues.append(f"RS {rs} < 70")
        if tpl_score < 8: issues.append(f"{tpl_score}/8 template")
        if vcp["count"] < 2: issues.append("no VCP yet")
        return f"Building toward convergence. Issues: {', '.join(issues)}."
    else:
        return f"Early stage / watch only. Stage {wein['stage']}, RS {rs}, {tpl_score}/8 template."

# ─────────────────────────────────────────────
# TECHNICAL INDICATORS
# ─────────────────────────────────────────────
def calc_technicals(df):
    safe = {
        "rsi": 50.0,
        "macd": {"line": 0.0, "signal": 0.0, "histogram": 0.0, "bullish": False, "crossing_up": False},
        "bb": {"upper": 0.0, "lower": 0.0, "mid": 0.0, "width_pct": 0.0, "squeeze": False},
        "adx": 20.0, "adxClassification": "weak",
        "stoch": {"k": 50.0, "d": 50.0, "crossover": "none"},
        "obv_trend": "rising",
        "mas": {"ema10": 0.0, "ema20": 0.0, "sma50": 0.0, "sma150": 0.0, "sma200": 0.0},
        "maDistances": {},
        "high52": 0.0, "low52": 0.0, "pctFrom52h": 0.0, "pctFrom52l": 0.0,
        "adr_pct": 0.0, "adr5d": 0.0, "adrExpanding": False,
        "volumeProfile": {"avg50": 0, "avg20": 0, "today": 0, "ratio": 0},
    }
    if df is None or len(df) < 20:
        return safe

    try:
        c = df["Close"]
        h = df["High"]
        lo = df["Low"]
        vol = df["Volume"] if "Volume" in df.columns else pd.Series(np.ones(len(df)), index=df.index)
        price = float(c.iloc[-1])

        # RSI(14)
        delta = c.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(com=13, adjust=False).mean()
        avg_loss = loss.ewm(com=13, adjust=False).mean()
        rs_rsi = avg_gain / avg_loss.replace(0, np.nan)
        rsi_series = 100 - (100 / (1 + rs_rsi))
        safe["rsi"] = round(float(rsi_series.iloc[-1]), 1)

        # MACD(12,26,9)
        ema12 = c.ewm(span=12, adjust=False).mean()
        ema26 = c.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        macd_signal = macd_line.ewm(span=9, adjust=False).mean()
        macd_hist = macd_line - macd_signal
        ml = round(float(macd_line.iloc[-1]), 4)
        ms = round(float(macd_signal.iloc[-1]), 4)
        mh = round(float(macd_hist.iloc[-1]), 4)
        crossing_up = bool(mh > 0 and len(macd_hist) >= 2 and float(macd_hist.iloc[-2]) <= 0)
        safe["macd"] = {"line": ml, "signal": ms, "histogram": mh, "bullish": ml > ms, "crossing_up": crossing_up}

        # Bollinger Bands
        sma20 = c.rolling(20).mean()
        std20 = c.rolling(20).std()
        bb_u = float((sma20 + 2 * std20).iloc[-1])
        bb_l = float((sma20 - 2 * std20).iloc[-1])
        bb_m = float(sma20.iloc[-1])
        bw = ((bb_u - bb_l) / bb_m) if bb_m else 0
        bw_series = ((sma20 + 2*std20) - (sma20 - 2*std20)) / sma20
        avg_bw = float(bw_series.rolling(20).mean().iloc[-1]) if len(bw_series) >= 20 else bw
        safe["bb"] = {"upper": round(bb_u,2), "lower": round(bb_l,2), "mid": round(bb_m,2),
                       "width_pct": round(bw*100,2), "squeeze": bool(bw < avg_bw * 0.80)}

        # ADX
        tr1 = h - lo
        tr2 = (h - c.shift(1)).abs()
        tr3 = (lo - c.shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr14 = tr.ewm(com=13, adjust=False).mean()
        dm_plus = (h.diff()).clip(lower=0)
        dm_minus = (-lo.diff()).clip(lower=0)
        dm_plus_adj = dm_plus.where(dm_plus > dm_minus, 0)
        dm_minus_adj = dm_minus.where(dm_minus > dm_plus, 0)
        di_plus = 100 * dm_plus_adj.ewm(com=13, adjust=False).mean() / atr14.replace(0, np.nan)
        di_minus = 100 * dm_minus_adj.ewm(com=13, adjust=False).mean() / atr14.replace(0, np.nan)
        dx = 100 * (di_plus - di_minus).abs() / (di_plus + di_minus).replace(0, np.nan)
        adx_val = round(float(dx.ewm(com=13, adjust=False).mean().iloc[-1]), 1)
        safe["adx"] = adx_val
        safe["adxClassification"] = "very strong" if adx_val > 40 else ("strong" if adx_val > 20 else "weak")

        # Stochastic
        low14 = lo.rolling(14).min()
        high14 = h.rolling(14).max()
        k_series = 100 * (c - low14) / (high14 - low14).replace(0, np.nan)
        d_series = k_series.rolling(3).mean()
        sk = round(float(k_series.iloc[-1]), 1)
        sd = round(float(d_series.iloc[-1]), 1)
        cross = "bullish" if sk > sd and len(k_series) >= 2 and float(k_series.iloc[-2]) <= float(d_series.iloc[-2]) else \
                "bearish" if sk < sd and len(k_series) >= 2 and float(k_series.iloc[-2]) >= float(d_series.iloc[-2]) else "none"
        safe["stoch"] = {"k": sk, "d": sd, "crossover": cross}

        # OBV
        obv = (np.sign(c.diff()) * vol).fillna(0).cumsum()
        obv_ma20 = obv.rolling(20).mean()
        safe["obv_trend"] = "rising" if float(obv.iloc[-1]) > float(obv_ma20.iloc[-1]) else "falling"

        # Moving averages + distances
        ema10v = round(float(c.ewm(span=10, adjust=False).mean().iloc[-1]), 2)
        ema20v = round(float(c.ewm(span=20, adjust=False).mean().iloc[-1]), 2)
        sma50v = round(float(c.rolling(50).mean().iloc[-1]), 2) if len(c) >= 50 else 0.0
        sma150v = round(float(c.rolling(150).mean().iloc[-1]), 2) if len(c) >= 150 else 0.0
        sma200v = round(float(c.rolling(200).mean().iloc[-1]), 2) if len(c) >= 200 else 0.0
        safe["mas"] = {"ema10": ema10v, "ema20": ema20v, "sma50": sma50v, "sma150": sma150v, "sma200": sma200v}
        safe["maDistances"] = {
            "ema10": round((price/ema10v - 1)*100, 2) if ema10v else 0,
            "ema20": round((price/ema20v - 1)*100, 2) if ema20v else 0,
            "sma50": round((price/sma50v - 1)*100, 2) if sma50v else 0,
            "sma150": round((price/sma150v - 1)*100, 2) if sma150v else 0,
            "sma200": round((price/sma200v - 1)*100, 2) if sma200v else 0,
        }

        # 52-week
        lookback = min(252, len(h))
        h52 = round(float(h.iloc[-lookback:].max()), 2)
        l52 = round(float(lo.iloc[-lookback:].min()), 2)
        safe["high52"] = h52
        safe["low52"] = l52
        safe["pctFrom52h"] = round((price - h52) / h52 * 100, 1) if h52 else 0
        safe["pctFrom52l"] = round((price - l52) / l52 * 100, 1) if l52 else 0

        # ADR%
        adr20 = float(((h.iloc[-20:] - lo.iloc[-20:]) / c.iloc[-20:] * 100).mean()) if len(h) >= 20 else 0
        adr5 = float(((h.iloc[-5:] - lo.iloc[-5:]) / c.iloc[-5:] * 100).mean()) if len(h) >= 5 else 0
        safe["adr_pct"] = round(adr20, 2)
        safe["adr5d"] = round(adr5, 2)
        safe["adrExpanding"] = adr5 > adr20

        # Volume profile
        vol50 = int(float(vol.rolling(50).mean().iloc[-1])) if len(vol) >= 50 else 0
        vol20 = int(float(vol.rolling(20).mean().iloc[-1])) if len(vol) >= 20 else 0
        vol_today = int(float(vol.iloc[-1])) if not vol.empty else 0
        safe["volumeProfile"] = {
            "avg50": vol50, "avg20": vol20, "today": vol_today,
            "ratio": round(vol_today / vol50, 2) if vol50 > 0 else 0,
        }

    except Exception as e:
        log.warning(f"calc_technicals error: {e}")

    return safe

# ─────────────────────────────────────────────
# SUPPORT / RESISTANCE
# ─────────────────────────────────────────────
def calc_sr_levels(df):
    if df is None or len(df) < 50:
        return []
    try:
        c = df["Close"]
        h = df["High"]
        lo = df["Low"]
        price = float(c.iloc[-1])
        levels = []

        lookback = min(252, len(h))
        h52 = round(float(h.iloc[-lookback:].max()), 2)
        l52 = round(float(lo.iloc[-lookback:].min()), 2)
        levels.append({"price": h52, "type": "resistance", "label": "52W High", "strength": 3, "distance": round((h52/price-1)*100, 1)})
        levels.append({"price": l52, "type": "support", "label": "52W Low", "strength": 3, "distance": round((l52/price-1)*100, 1)})

        for sma_len, label in [(200, "200d SMA"), (150, "150d SMA"), (50, "50d SMA")]:
            if len(c) >= sma_len:
                val = round(float(c.rolling(sma_len).mean().iloc[-1]), 2)
                t = "support" if price > val else "resistance"
                levels.append({"price": val, "type": t, "label": label, "strength": 2, "distance": round((val/price-1)*100, 1)})

        if len(df) >= 80:
            ch = round(float(h.iloc[-80:-20].max()), 2)
            cl = round(float(lo.iloc[-80:-20].min()), 2)
            levels.append({"price": ch, "type": "resistance" if price < ch else "support", "label": "Prior Consol High", "strength": 2, "distance": round((ch/price-1)*100, 1)})
            levels.append({"price": cl, "type": "support" if price > cl else "resistance", "label": "Prior Consol Low", "strength": 1, "distance": round((cl/price-1)*100, 1)})

        # Round number levels
        for rnd in [int(price * 0.9 / 10) * 10, int(price / 10) * 10, int(price * 1.1 / 10) * 10]:
            if rnd > 0 and abs(rnd - price) / price > 0.02:
                t = "resistance" if rnd > price else "support"
                levels.append({"price": float(rnd), "type": t, "label": f"Round ${rnd}", "strength": 1, "distance": round((rnd/price-1)*100, 1)})

        levels.sort(key=lambda x: x["price"], reverse=True)
        deduped = []
        for lvl in levels:
            if not deduped or (deduped[-1]["price"] > 0 and abs(lvl["price"] - deduped[-1]["price"]) / deduped[-1]["price"] >= 0.01):
                deduped.append(lvl)
        return deduped[:10]
    except Exception as e:
        log.warning(f"calc_sr_levels error: {e}")
        return []

# ─────────────────────────────────────────────
# CORE ANALYSIS
# ─────────────────────────────────────────────
_spy_df: Optional[pd.DataFrame] = None
_mkt_snapshot: dict = {"spxStage": 2, "spxEma": "above", "tplCount": 500, "vix": 20}

def get_spy():
    global _spy_df
    if _spy_df is not None and len(_spy_df) > 200:
        return _spy_df
    _spy_df = fetch_ohlcv("SPY", "2y")
    return _spy_df

def analyze_ticker(ticker: str, spy_df: pd.DataFrame, mkt: dict) -> Optional[dict]:
    try:
        df = fetch_ohlcv(ticker, "2y")
        if df is None or len(df) < 60:
            return None
        time.sleep(0.3)

        fund = fetch_fundamentals(ticker)
        time.sleep(0.2)

        dp, wp, mp, qp, hp, yp = (0, 0, 0, 0, 0, 0)
        try: dp, wp, mp, qp, hp, yp = calc_returns(df)
        except Exception: pass

        rs = 50
        try: rs = calc_rs_rating(df, spy_df)
        except Exception: pass

        wein = {"stage": "?", "ma150": None, "slopeWeeks": 0, "slopeRising": False, "pctFromMA": 0}
        try: wein = weinstein_stage(df)
        except Exception: pass

        tpl_criteria, tpl_score = [False]*8, 0
        try: tpl_criteria, tpl_score = minervini_template(df, rs)
        except Exception: pass

        phase, light, ema_d, ema_w, ema_m = "Unknown", "gray", "neutral", "neutral", "neutral"
        ema10v, ema20v, ema50v, ema100v, ema200v = 0.0, 0.0, 0.0, 0.0, 0.0
        try:
            kell_result = kell_phase(df)
            phase, light, ema_d, ema_w, ema_m = kell_result[:5]
            ema10v, ema20v, ema50v, ema100v, ema200v = kell_result[5:]
        except Exception: pass

        vcp = {"count": 0, "depths": "—", "pivot": None, "tightness": 0, "volDryup": False}
        try: vcp = detect_vcp(df)
        except Exception: pass

        technicals = {}
        try: technicals = calc_technicals(df)
        except Exception: pass

        sr_levels = []
        try: sr_levels = calc_sr_levels(df)
        except Exception: pass

        base = max(1, int(len([p for p in [wein["stage"]] if p in ("2A","2B")]) + vcp["count"] / 2))

        conv_s, conv_z = convergence_score(wein, tpl_score, rs, phase, vcp, mkt, fund, df)

        inv_criteria, inv_score = [False]*8, 0
        try: inv_criteria, inv_score = inverse_template(df, rs)
        except Exception: pass
        short_s, short_z = short_convergence_score(wein, inv_score, rs, phase, mkt, fund)

        flags = []
        if rs < 70: flags.append(f"RS {rs} < 70")
        if tpl_score < 8: flags.append(f"{tpl_score}/8 template")
        if wein["stage"] == "2B": flags.append("Stage 2B (mature)")
        if fund.get("eps", 0) <= 0: flags.append("EPS negative")
        if vcp["count"] == 0: flags.append("No VCP")

        price = float(df["Close"].iloc[-1])
        vol_ratio = technicals.get("volumeProfile", {}).get("ratio", 1.0)

        # FINRA short volume
        finra_data = {}
        try:
            finra_data = finra.analyze_ticker(ticker)
            svr = finra_data.get("svr_today")
            # Convergence adjustment: +1 if SVR < 35% (longs) or > 55% (shorts)
            finra_adj = finra.convergence_adjustment(ticker, is_short=wein["stage"] in ("3", "4A", "4B"))
            conv_s += finra_adj
            if finra_adj > 0:
                conv_z = _recalc_zone(conv_s, 23)
        except Exception:
            svr = None

        # Macro context
        macro_data = _macro_cache or {}
        macro_sc = macro_data.get("score", {}).get("score", 5)
        events = macro_data.get("events", [])
        event_imminent = any(e.get("imminent") for e in events)
        sector_aligned = True  # Default; could check sector-specific context

        # Qullamaggie momentum setup analysis
        qull_data = {}
        qull_breakout_score = 0
        try:
            mcap = fund.get("marketCap", 0)
            qull_data = qull.analyze_qullamaggie(ticker, df, fundamentals=fund, market_cap=mcap)
            bo = qull_data.get("breakout")
            if bo and bo.get("passed"):
                qull_breakout_score = bo.get("score", 0)
            # Dual convergence: +5 bonus if MKW conv >= 20 AND Qullamaggie breakout >= 70
            dual = qull.check_dual_convergence(conv_s, 23, qull_breakout_score)
            if dual["is_dual_convergence"]:
                conv_s += dual["bonus_points"]
                conv_z = _recalc_zone(conv_s, 23)
                qull_data["dual_convergence"] = True
            else:
                qull_data["dual_convergence"] = False
        except Exception as e:
            log.warning(f"Qullamaggie scan {ticker}: {e}")

        # Quick grade (without full options data for speed)
        is_short = wein["stage"] in ("3", "4A", "4B")
        quick_grade = grade_trade(
            conv_score=conv_s, conv_max=23, conv_zone=conv_z,
            wein_stage=wein["stage"], tpl_score=tpl_score, rs=rs,
            phase=phase, ema_d=ema_d, ema_w=ema_w, ema_m=ema_m,
            vcp_pivot=vcp.get("pivot"), current_price=price,
            vol_ratio=vol_ratio, is_short=is_short,
            short_vol_ratio=svr / 100 if svr else 0.5,
            macro_score=macro_sc, event_imminent=event_imminent,
            sector_aligned=sector_aligned,
            qullamaggie_breakout_score=qull_breakout_score,
        )

        return {
            "tk": ticker,
            "nm": fund.get("name", ticker),
            "px": round(price, 2),
            "dp": dp, "wp": wp, "mp": mp, "qp": qp, "hp": hp, "yp": yp,
            "wein": {
                "stage": wein["stage"], "ma150": wein["ma150"],
                "slopeWeeks": wein["slopeWeeks"], "slopeRising": wein["slopeRising"],
                "pctFromMA": wein["pctFromMA"],
            },
            "min": {
                "tpl": tpl_criteria, "tplScore": tpl_score, "rs": rs,
                "eps": fund.get("eps", 0), "rev": fund.get("rev", 0),
                "marginsExpanding": fund.get("marginsExpanding", False),
                "pivot": vcp["pivot"],
            },
            "vcp": vcp,
            "kell": {
                "phase": phase, "light": light,
                "emaD": ema_d, "emaW": ema_w, "emaM": ema_m,
                "base": base,
                "ema10v": ema10v, "ema20v": ema20v, "ema50v": ema50v,
                "ema100v": ema100v, "ema200v": ema200v,
            },
            "conv": {"score": conv_s, "max": 23, "zone": conv_z},
            "finra": finra_data,
            "qullamaggie": qull_data,
            "shortConv": {
                "score": short_s, "max": 22, "zone": short_z,
                "invTpl": inv_criteria, "invScore": inv_score,
            },
            "grade": quick_grade,
            "setup": build_setup_text(ticker, wein, tpl_score, rs, phase, vcp, conv_z),
            "risk": f"Stage {wein['stage']} · RS {rs} · {phase}",
            "flags": flags,
            "fundamentals": fund,
            "technicals": technicals,
            "srLevels": sr_levels,
            "sector": fund.get("sector", ""),
        }
    except Exception as e:
        log.error(f"analyze_ticker({ticker}): {e}")
        return None

# ─────────────────────────────────────────────
# MARKET BREADTH
# ─────────────────────────────────────────────
def compute_breadth():
    indices = {"SPY": "S&P 500", "QQQ": "NASDAQ 100", "IWM": "Russell 2000", "^VIX": "VIX"}
    result = {}
    for sym, name in indices.items():
        try:
            df = fetch_ohlcv(sym, "6mo")
            if df is None: continue
            price = float(df["Close"].iloc[-1])
            dp, *_ = calc_returns(df)
            if sym == "^VIX":
                result["vix"] = round(price, 2)
            else:
                key = sym.lower().replace("^","")
                e20 = float(df["Close"].ewm(span=20, adjust=False).mean().iloc[-1])
                w = weinstein_stage(df)
                result[key] = {
                    "name": name, "price": round(price, 2), "chg": dp[0] if isinstance(dp, tuple) else dp,
                    "stage": int(w["stage"][0]) if w["stage"][0].isdigit() else 2,
                    "stageLabel": w["stage"], "ema20": "above" if price > e20 else "below",
                }
            time.sleep(0.3)
        except Exception as e:
            log.warning(f"Breadth {sym}: {e}")

    sectors = []
    for etf in SECTOR_ETFS:
        try:
            df = fetch_ohlcv(etf, "3mo")
            if df is None: continue
            rets = calc_returns(df)
            w = weinstein_stage(df)
            sectors.append({"n": SECTOR_NAMES.get(etf, etf), "etf": etf,
                           "p": rets[0], "wp": rets[1], "mp": rets[2], "stage": w["stage"]})
            time.sleep(0.3)
        except Exception:
            pass

    scan_tickers = WATCHLIST[:30]
    tpl_count = 0
    spy_df_tmp = get_spy()
    for t in scan_tickers:
        try:
            df = fetch_ohlcv(t, "2y")
            if df is None or len(df) < 200: continue
            rs = calc_rs_rating(df, spy_df_tmp) if spy_df_tmp is not None else 50
            _, score = minervini_template(df, rs)
            if score >= 6: tpl_count += 1
            time.sleep(0.25)
        except Exception:
            pass
    tpl_count_est = int(tpl_count / max(1, len(scan_tickers)) * 500)

    spx = result.get("spy", {})
    return {
        "spx": spx, "ndx": result.get("qqq", {}), "rut": result.get("iwm", {}),
        "vix": result.get("vix", 20),
        "spxStage": spx.get("stage", 2), "spxEma": spx.get("ema20", "above"),
        "tplCount": tpl_count_est, "sectors": sectors,
        "lastUpdated": datetime.utcnow().isoformat(),
    }

# ─────────────────────────────────────────────
# THREATS
# ─────────────────────────────────────────────
def compute_threats(spy_df, mkt):
    results = []
    for tk in THREATS_LIST:
        try:
            data = analyze_ticker(tk, spy_df, mkt)
            if data is None: continue
            short_s = data["shortConv"]["score"]
            threat_sc = round(min(10, short_s / 22 * 10), 1)
            wein = data["wein"]
            div_signals = []
            if wein["stage"] in ("3","4A","4B"):
                div_signals.append(f"Weinstein Stage {wein['stage']}")
            if data["min"]["tplScore"] <= 3:
                div_signals.append(f"Template {data['min']['tplScore']}/8 — failing")
            if data["kell"]["phase"] in ("Red Light","Wedge","Extension"):
                div_signals.append(f"Kell {data['kell']['phase']}")
            if data["min"]["rs"] < 30:
                div_signals.append(f"RS {data['min']['rs']} — laggard")

            stage = wein["stage"]
            ttype = "Stage 4 Decline" if stage in ("4A","4B") else "Distribution" if stage == "3" else "Divergence"

            results.append({
                "tk": tk, "sc": threat_sc, "type": ttype,
                "sum": data["setup"], "mc": data["mp"],
                "wein": data["wein"], "divSignals": div_signals,
                "shortConv": data["shortConv"], "grade": data.get("grade", {}),
            })
        except Exception as e:
            log.error(f"Threat {tk}: {e}")
    return results

# ─────────────────────────────────────────────
# NEWS & EARNINGS
# ─────────────────────────────────────────────
def fetch_news_data(watchlist_tickers):
    market_news, watchlist_alerts = [], []
    if not FINNHUB_KEY:
        return {"watchlistAlerts": [], "marketNews": [], "note": "Set FINNHUB_API_KEY for news"}

    gen_news = finnhub_get("/news", {"category": "general", "minId": 0})
    if isinstance(gen_news, list):
        for n in gen_news[:20]:
            headline = n.get("headline", "")
            risk_keywords = ["downgrade", "investigation", "recall", "lawsuit", "fraud", "sec", "warning"]
            is_risk = any(kw in headline.lower() for kw in risk_keywords)
            market_news.append({
                "headline": headline, "source": n.get("source", ""),
                "summary": n.get("summary", ""), "time": n.get("datetime", 0),
                "url": n.get("url", ""), "isRisk": is_risk,
            })

    from_date = (datetime.utcnow() - timedelta(days=3)).strftime("%Y-%m-%d")
    to_date = datetime.utcnow().strftime("%Y-%m-%d")
    for tk in watchlist_tickers[:8]:
        try:
            news = finnhub_get("/company-news", {"symbol": tk, "from": from_date, "to": to_date})
            if isinstance(news, list):
                for n in news[:3]:
                    watchlist_alerts.append({
                        "ticker": tk, "headline": n.get("headline", ""),
                        "source": n.get("source", ""), "summary": n.get("summary", ""),
                        "time": n.get("datetime", 0),
                    })
            time.sleep(0.2)
        except Exception:
            pass

    return {
        "watchlistAlerts": sorted(watchlist_alerts, key=lambda x: x["time"], reverse=True)[:20],
        "marketNews": sorted(market_news, key=lambda x: x["time"], reverse=True)[:30],
    }

def fetch_earnings_calendar(tickers):
    if not FINNHUB_KEY:
        return []
    from_date = datetime.utcnow().strftime("%Y-%m-%d")
    to_date = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
    cal = finnhub_get("/calendar/earnings", {"from": from_date, "to": to_date})
    results = []
    if isinstance(cal, dict) and "earningsCalendar" in cal:
        for e in cal["earningsCalendar"]:
            sym = e.get("symbol","")
            if sym in tickers:
                results.append({
                    "ticker": sym, "date": e.get("date",""),
                    "eps_est": e.get("epsEstimate"), "hour": e.get("hour",""),
                })
    return sorted(results, key=lambda x: x["date"])

# ─────────────────────────────────────────────
# DAILY BRIEF
# ─────────────────────────────────────────────
def generate_programmatic_brief(watchlist_data, breadth, threats):
    vix = breadth.get("vix", "—")
    stage = breadth.get("spxStage", "?")
    ema_pos = breadth.get("spxEma", "?")
    tpl_cnt = breadth.get("tplCount", 0)

    # Use normalized flat field names
    conv = [s for s in watchlist_data if (s.get("zone") or "").upper() == "CONVERGENCE"]
    sec = [s for s in watchlist_data if (s.get("zone") or "").upper() == "SECONDARY"]
    bld = [s for s in watchlist_data if (s.get("zone") or "").upper() == "BUILDING"]
    shorts = [s for s in watchlist_data if "SHORT" in (s.get("zone") or "").upper()]

    mkt_color = "BULL" if ema_pos == "above" and str(stage).startswith("2") else "BEAR" if ema_pos == "below" else "CAUTION"
    vix_flag = "Elevated — reduce size" if isinstance(vix, (int,float)) and vix > 25 else "Normal"

    # Find top setup by grade score
    top_setup = None
    if conv:
        sorted_conv = sorted(conv, key=lambda x: x.get("grade_score", 0), reverse=True)
        top_setup = sorted_conv[0]

    # Position sizing guidance
    if isinstance(vix, (int,float)):
        if vix > 30:
            size_guide = "HIGH VIX — reduce all position sizes by 50%. No new entries unless AAA."
        elif vix > 25:
            size_guide = "Elevated VIX — reduce new entries to 75% normal size."
        elif vix < 15:
            size_guide = "Low VIX — full position sizes. Market calm."
        else:
            size_guide = "Normal VIX range. Standard position sizing."
    else:
        size_guide = "VIX data unavailable."

    lines = [
        f"# MKW MORNING BRIEF — {datetime.utcnow().strftime('%A, %B %d, %Y').upper()}",
        f"\n## MARKET REGIME: {mkt_color}",
        f"**S&P 500:** Stage {stage}, {ema_pos} 20 EMA",
        f"**VIX:** {vix} — {vix_flag}",
        f"**Template Qualifiers:** ~{tpl_cnt} stocks passing Minervini 8-point template",
        f"**Position Sizing:** {size_guide}",
    ]

    if not conv and not sec:
        lines += [
            "",
            "## NO AAA SETUPS TODAY",
            "**Capital preservation IS a position.** No stocks currently meet full convergence criteria.",
            "Review BUILDING names for approaching setups. Stay patient.",
        ]
    else:
        lines += ["", "## CONVERGENCE SETUPS (HIGHEST CONVICTION)"]
        if conv:
            for s in conv:
                lines.append(f"- **{s.get('ticker','?')}** {s.get('grade','?')} ({s.get('grade_score',0)}/100) — Score {s.get('convergence_score',0)}/23 · RS {s.get('rs',0)} · {s.get('phase','?')} · Stage {s.get('stage','?')}")
        else:
            lines.append("- None currently")

        lines += ["", "## SECONDARY SETUPS"]
        if sec:
            for s in sec:
                lines.append(f"- **{s.get('ticker','?')}** — Score {s.get('convergence_score',0)}/23 · RS {s.get('rs',0)} · {s.get('phase','?')}")
        else:
            lines.append("- None currently")

    lines += ["", "## BUILDING (APPROACHING)"]
    if bld:
        for s in bld[:5]:
            lines.append(f"- **{s.get('ticker','?')}** — Score {s.get('convergence_score',0)}/23 · {s.get('setup','')}")
    else:
        lines.append("- None building currently")

    if shorts:
        lines += ["", "## SHORT SETUPS"]
        for s in shorts[:3]:
            sc = s.get("shortConv", {})
            lines.append(f"- **{s.get('ticker','?')}** — Short score {sc.get('score',0)} · {sc.get('zone','?')}")

    if top_setup:
        gd = top_setup.get("grade_detail", {})
        lines += [
            "",
            f"## TOP SETUP: {top_setup.get('ticker','?')} — {top_setup.get('grade','?')} ({top_setup.get('grade_score',0)}/100)",
            f"**{top_setup.get('setup','')}**",
            f"RS {top_setup.get('rs',0)} · Stage {top_setup.get('stage','?')} · {top_setup.get('phase','?')}",
            f"Grade breakdown: {gd.get('summary', 'N/A')}",
        ]

    # Qullamaggie setups section
    qull_triggering = [s for s in watchlist_data if s.get("qull_any_triggering")]
    qull_watching = [s for s in watchlist_data if s.get("qull_any_setup") and not s.get("qull_any_triggering")]
    dual_conv = [s for s in watchlist_data if s.get("qull_dual_convergence")]

    if dual_conv:
        lines += ["", "## DUAL CONVERGENCE (MAXIMUM CONVICTION)"]
        for s in dual_conv:
            bo_score = (s.get("qullamaggie") or {}).get("breakout", {}).get("score", 0)
            lines.append(
                f"- **{s.get('ticker','?')}**: MKW {s.get('convergence_score',0)}/23 + "
                f"Qullamaggie Breakout {bo_score}/100 = DUAL CONVERGENCE"
            )

    if qull_triggering:
        lines += ["", "## QULLAMAGGIE SETUPS — TRIGGERING NOW"]
        for s in qull_triggering[:5]:
            for setup in s.get("qull_setups_summary", []):
                if setup.get("triggering"):
                    lines.append(f"- **{s.get('ticker','?')}** [{setup.get('type','')}] Score {setup.get('score',0)}/100 — {setup.get('detail','')}")

    if qull_watching:
        lines += ["", "## QULLAMAGGIE SETUPS — WATCHING"]
        for s in qull_watching[:5]:
            best = s.get("qull_best_setup", "")
            score = s.get("qull_best_score", 0)
            lines.append(f"- **{s.get('ticker','?')}** [{best}] Score {score}/100")

    if threats:
        lines += ["", "## DIVERGENCE ALERTS"]
        for t in threats[:3]:
            lines.append(f"- **{t.get('tk', t.get('ticker','?'))}**: {t.get('type','—')} (threat {t.get('sc', t.get('threat_score','—'))}/10)")

    lines += [
        "", "## ACTION ITEMS",
        f"1. Review **{len(conv)} convergence** and **{len(sec)} secondary** setups",
    ]
    if dual_conv:
        lines.append(f"2. **{len(dual_conv)} DUAL CONVERGENCE** setups — highest conviction, prioritize these")
    if qull_triggering:
        lines.append(f"3. **{len(qull_triggering)} Qullamaggie setups TRIGGERING** — check entry timing now")
    lines += [
        f"{'4' if dual_conv or qull_triggering else '2'}. Check entry timing — prioritize EMA Crossback and Pop phases",
        f"{'5' if dual_conv or qull_triggering else '3'}. Monitor VIX ({vix}) for position sizing guidance",
    ]

    return "\n".join(lines)

def generate_daily_brief(watchlist_data, breadth, threats):
    tier1 = generate_programmatic_brief(watchlist_data, breadth, threats)

    # Add macro section to tier1
    macro_data = _macro_cache or {}
    if macro_data.get("score"):
        tier1["macro"] = {
            "score": macro_data["score"],
            "rates": macro_data.get("rates", {}),
            "events": macro_data.get("events", [])[:5],
            "sizing_modifier": macro_data.get("sizing_modifier", 0.75),
        }

    # Add FINRA short volume intelligence
    top_short = finra.top_short_volume(list(WATCHLIST), n=5)
    if top_short:
        tier1["shortVolumeIntel"] = [
            {"ticker": s["ticker"], "svr": s["svr_today"], "signal": s["signal"], "color": s["color"]}
            for s in top_short if s.get("svr_today") is not None
        ]

    if not CLAUDE_KEY:
        return {"tier1": tier1, "tier2": None, "note": "Set ANTHROPIC_API_KEY for AI-enhanced brief"}

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=CLAUDE_KEY)

        # Use normalized flat fields
        conv = [s for s in watchlist_data if (s.get("zone") or "").upper() == "CONVERGENCE"]
        sec = [s for s in watchlist_data if (s.get("zone") or "").upper() == "SECONDARY"]
        shorts = [s for s in watchlist_data if "SHORT" in (s.get("zone") or "").upper()]

        macro_ctx = ""
        if macro_data.get("score"):
            ms = macro_data["score"]
            events = macro_data.get("events", [])
            event_str = ", ".join([f"{e['name']} in {e['days_until']}d" for e in events[:3]])
            macro_ctx = f"\nMACRO: Score {ms['score']}/10 ({ms['regime']}), sizing {ms.get('sizing', 'standard')}. Events: {event_str or 'none upcoming'}"

        finra_ctx = ""
        if top_short:
            finra_ctx = f"\nSHORT VOLUME: Top SVR — " + ", ".join([f"{s['ticker']} {s['svr_today']}%" for s in top_short[:5]])

        context = f"""MARKET: SPX Stage {breadth.get('spxStage')}, {breadth.get('spxEma')} 20 EMA, VIX {breadth.get('vix')}, ~{breadth.get('tplCount')} TPL qualifiers{macro_ctx}{finra_ctx}
CONVERGENCE ({len(conv)}): {json.dumps([{"tk":s.get("ticker","?"),"grade":s.get("grade","?"),"score":s.get("convergence_score",0),"rs":s.get("rs",0),"phase":s.get("phase","?")} for s in conv])}
SECONDARY ({len(sec)}): {json.dumps([{"tk":s.get("ticker","?"),"score":s.get("convergence_score",0)} for s in sec])}
SHORTS ({len(shorts)}): {json.dumps([{"tk":s.get("ticker","?"),"shortScore":s.get("shortConv",{}).get("score",0)} for s in shorts])}
THREATS: {json.dumps([{"tk":t.get("tk","?"),"type":t.get("type","?"),"score":t.get("sc",0)} for t in threats])}"""

        msg = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            system=("You are a trading desk analyst at a top hedge fund writing the morning brief for the PM. "
                    "The PM runs a concentrated swing book using the MKW convergence system. "
                    "Write in the voice of a sharp, experienced analyst. Be specific — use tickers, prices, levels. "
                    "Open with the one thing the PM needs to know most. Then regime, top ideas, risks. "
                    "Under 500 words. No disclaimers. Write like money is on the line."),
            messages=[{"role": "user", "content": f"Generate today's MKW morning brief:\n{context}"}]
        )
        tier2 = msg.content[0].text
        return {"tier1": tier1, "tier2": tier2}
    except Exception as e:
        log.error(f"Claude API error: {e}")
        return {"tier1": tier1, "tier2": None, "error": str(e)}

# ─────────────────────────────────────────────
# SCREENER PRESETS
# ─────────────────────────────────────────────
SCREENER_PRESETS = {
    "convergence_longs": {
        "name": "MKW Convergence Longs",
        "description": "Stage 2A + Template 8/8 + RS >= 80 + VCP + Kell Crossback/Pop + IV Rank < 50",
        "filters": {"stage": "2A", "template_min": 8, "rs_min": 80, "vcp": True, "zone": "CONVERGENCE"},
    },
    "convergence_shorts": {
        "name": "MKW Convergence Shorts",
        "description": "Stage 4A + Inverse template 8/8 + RS < 30 + Kell Red Light",
        "filters": {"stage": "4", "rs_max": 30, "short_mode": True, "zone": "SHORT_CONVERGENCE"},
    },
    "vcp_coil": {
        "name": "VCP Coil Scanner",
        "description": "Template 7/8+ + ADR% declining + BB squeeze + Volume < 60% avg",
        "filters": {"template_min": 7, "vcp": True},
    },
    "rs_emerging": {
        "name": "RS Emerging Leaders",
        "description": "RS >= 70 + Price above rising 50d MA + Stage 2",
        "filters": {"rs_min": 70, "stage": "2", "template_min": 5},
    },
    "stage_transition": {
        "name": "Stage Transition Alerts",
        "description": "Stocks with 30-week MA direction change in past 2 weeks",
        "filters": {"template_min": 0},
    },
    "vol_crush": {
        "name": "Volatility Crush Candidates",
        "description": "IV Rank > 70 + Template 7/8+ + Earnings approaching",
        "filters": {"template_min": 7},
    },
    "strong_setup": {
        "name": "Strong Setups (A+ Grade)",
        "description": "All stocks grading A or above on the 100-point system",
        "filters": {"template_min": 6, "rs_min": 60},
    },
    "all_convergence": {
        "name": "All Convergence Zones",
        "description": "Every stock sorted by convergence score",
        "filters": {},
    },
    "short_squeeze": {
        "name": "Short Squeeze Candidates",
        "description": "SVR > 55% + rising + resilient price — potential squeeze setups",
        "filters": {},
        "special": "short_squeeze",
    },
    "distribution": {
        "name": "Distribution Detection",
        "description": "SVR spike + rising trend — potential institutional selling",
        "filters": {},
        "special": "distribution",
    },
    "qull_breakouts": {
        "name": "Qullamaggie Breakouts",
        "description": "Big prior move + orderly pullback + tight consolidation — breakout watch",
        "filters": {},
        "special": "qull_breakouts",
    },
    "qull_parabolic": {
        "name": "Qullamaggie Parabolic",
        "description": "Overextended stocks (short setups) and oversold bounces (long setups)",
        "filters": {},
        "special": "qull_parabolic",
    },
    "qull_ep": {
        "name": "Qullamaggie Episodic Pivots",
        "description": "Big gap + big volume + prior neglect — catalyst-driven moves",
        "filters": {},
        "special": "qull_ep",
    },
    "dual_convergence": {
        "name": "Dual Convergence (MKW + Qullamaggie)",
        "description": "Stocks passing BOTH MKW convergence AND Qullamaggie breakout — maximum conviction",
        "filters": {},
        "special": "dual_convergence",
    },
}

# ─────────────────────────────────────────────
# SCANNER MODULES
# ─────────────────────────────────────────────
SCANNER_MODULES = {
    "mega_cap": {
        "name": "Mega Cap Momentum",
        "description": "Market cap > $100B + Stage 2 + RS > 60 + volume confirmation",
        "icon": "crown",
    },
    "canslim": {
        "name": "CANSLIM Composite",
        "description": "Strong earnings growth + RS leader + Stage 2 uptrend",
        "icon": "chart",
    },
    "new_highs": {
        "name": "New Highs Power",
        "description": "Within 5% of 52-week high with volume and uptrend confirmation",
        "icon": "arrow_up",
    },
    "rs_leaders": {
        "name": "Relative Strength Leaders",
        "description": "RS >= 80 + Template 6/8+ — strongest momentum names",
        "icon": "bolt",
    },
    "todays_watch": {
        "name": "Today's Watch",
        "description": "Convergence/Secondary zone stocks with actionable entry signals",
        "icon": "eye",
    },
    "intraday": {
        "name": "Intra-Day Movers",
        "description": "Day change > 2% or unusual volume — active momentum",
        "icon": "zap",
    },
}


def _run_scanner(module: str, stocks: list) -> list:
    """Apply scanner-specific filters to the cached watchlist stocks."""
    if module == "mega_cap":
        filtered = []
        for s in stocks:
            mcap = s.get("market_cap") or s.get("marketCap") or 0
            stage = str(s.get("stage", "?"))
            rs = s.get("rs") or s.get("relative_strength") or 0
            if mcap > 100e9 and stage in ("2A", "2B") and rs >= 60:
                filtered.append(s)
        filtered.sort(key=lambda x: (x.get("rs", 0), x.get("day_change", 0)), reverse=True)

    elif module == "canslim":
        filtered = []
        for s in stocks:
            fund = s.get("fundamentals", {})
            eps = fund.get("eps") or fund.get("eps_growth") or 0
            rev = fund.get("rev") or fund.get("rev_growth") or fund.get("revenue_growth") or 0
            rs = s.get("rs") or 0
            stage = str(s.get("stage", "?"))
            # CANSLIM: strong earnings, strong RS, confirmed uptrend
            # Relaxed: EPS or Rev > 15%, RS > 70, Stage 2
            if (eps >= 15 or rev >= 15) and rs >= 70 and stage in ("2A", "2B"):
                # Calculate CANSLIM score (0-7)
                score = 0
                if eps >= 25: score += 1  # C: Current earnings
                if eps >= 15: score += 1  # A: Annual earnings (approx)
                pct52 = s.get("pct_from_52h") or s.get("technicals", {}).get("pctFrom52h")
                if pct52 is not None and abs(pct52) <= 10: score += 1  # N: New highs
                if s.get("technicals", {}).get("volumeProfile", {}).get("ratio", 1) > 1.0: score += 1  # S: Supply/demand
                if rs >= 80: score += 1  # L: Leader
                score += 1  # I: Institutional (assume for large caps)
                score += 1  # M: Market direction (assume we're in S2)
                s = {**s, "canslim_score": score}
                filtered.append(s)
        filtered.sort(key=lambda x: (x.get("canslim_score", 0), x.get("rs", 0)), reverse=True)

    elif module == "new_highs":
        filtered = []
        for s in stocks:
            pct52 = s.get("pct_from_52h") or s.get("technicals", {}).get("pctFrom52h")
            stage = str(s.get("stage", "?"))
            if pct52 is not None and abs(pct52) <= 5 and stage in ("2A", "2B", "3"):
                filtered.append(s)
        filtered.sort(key=lambda x: abs(x.get("pct_from_52h") or x.get("technicals", {}).get("pctFrom52h", -99)), reverse=False)

    elif module == "rs_leaders":
        filtered = []
        for s in stocks:
            rs = s.get("rs") or s.get("relative_strength") or 0
            tpl = s.get("template_score") or s.get("minervini_score") or 0
            if rs >= 80 and tpl >= 6:
                filtered.append(s)
        filtered.sort(key=lambda x: x.get("rs", 0), reverse=True)

    elif module == "todays_watch":
        filtered = []
        for s in stocks:
            zone = s.get("zone", "")
            phase = s.get("kell_phase") or s.get("phase") or ""
            score = s.get("convergence_score") or s.get("score") or 0
            # Convergence/Secondary with actionable phases, or high convergence score
            if zone in ("CONVERGENCE", "SECONDARY") or score >= 16:
                # Bonus points for actionable phases
                phase_bonus = 10 if phase in ("EMA Crossback", "Pop", "Base n Break") else 0
                zone_bonus = 20 if zone == "CONVERGENCE" else 10 if zone == "SECONDARY" else 0
                watch_score = score + phase_bonus + zone_bonus
                s = {**s, "watch_score": watch_score}
                filtered.append(s)
        filtered.sort(key=lambda x: x.get("watch_score", 0), reverse=True)

    elif module == "intraday":
        filtered = []
        for s in stocks:
            day_chg = abs(s.get("day_change") or s.get("dp") or 0)
            vol_ratio = s.get("technicals", {}).get("volumeProfile", {}).get("ratio", 0) or 0
            # Day change > 2% or volume > 2x average
            if day_chg >= 2.0 or vol_ratio >= 2.0:
                momentum = day_chg + (vol_ratio * 2 if vol_ratio >= 1.5 else 0)
                s = {**s, "momentum_score": round(momentum, 1)}
                filtered.append(s)
        filtered.sort(key=lambda x: x.get("momentum_score", 0), reverse=True)

    else:
        filtered = []

    return filtered[:20]  # Cap at 20 results


# ─────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────
def _warmup():
    log.info("Warming up watchlist cache...")
    try:
        resp = _build_watchlist()
        if resp:
            cache_set("watchlist", resp)
            log.info(f"Watchlist cache warmed: {len(resp.get('stocks', []))} stocks")
    except Exception as e:
        log.warning(f"Warmup failed: {e}")

def _warmup_data_sources():
    """Initialize FINRA and FRED data in background."""
    global _macro_cache
    try:
        # FINRA: download recent short volume data
        universe = list(WATCHLIST) + THREATS_LIST
        finra.update_history(universe)
        log.info("FINRA short volume data loaded")
    except Exception as e:
        log.warning(f"FINRA warmup failed: {e}")

    try:
        # FRED: fetch macro data
        _macro_cache = macro.get_full_macro()
        if _macro_cache.get("score"):
            log.info(f"Macro score: {_macro_cache['score'].get('score', '?')}/10 ({_macro_cache['score'].get('regime', '?')})")
    except Exception as e:
        log.warning(f"FRED warmup failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _positions
    _positions = load_positions()
    log.info(f"Loaded {len(_positions)} positions")
    log.info(f"Data sources: Polygon={'YES' if POLYGON_KEY else 'NO'} | FRED={'YES' if FRED_KEY else 'NO'} | Finnhub={'YES' if FINNHUB_KEY else 'NO'}")
    get_spy()
    import threading
    threading.Thread(target=_warmup, daemon=True).start()
    threading.Thread(target=_warmup_data_sources, daemon=True).start()
    yield

app = FastAPI(title="MKW Command Center v2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc), "type": type(exc).__name__})

def _conv_details_to_list(details) -> list:
    """Convert convergenceDetails dict to list for frontend checklist."""
    if isinstance(details, list):
        return details
    if isinstance(details, dict):
        return [
            {"name": k, "label": v.get("note", k), "pass": v.get("pass", False),
             "detail": v.get("note", ""), "pts": v.get("pts", 0)}
            for k, v in details.items()
        ]
    return []


def _normalize_stock(s: dict) -> dict:
    """Flatten abbreviated backend fields into frontend-friendly shape."""
    grade_obj = s.get("grade", {})
    conv = s.get("conv", {})
    kell = s.get("kell", {})
    wein = s.get("wein", {})
    mn = s.get("min", {})
    vcp = s.get("vcp", {})
    fund = s.get("fundamentals", {})
    techs = s.get("technicals", {})
    flat = {
        "ticker": s.get("tk", ""),
        "symbol": s.get("tk", ""),
        "name": s.get("nm", ""),
        "company": s.get("nm", ""),
        "price": s.get("px", 0),
        "zone": conv.get("zone", "WATCH"),
        "convergence_score": conv.get("score", 0),
        "score": conv.get("score", 0),
        "grade": grade_obj.get("grade", "F") if isinstance(grade_obj, dict) else str(grade_obj),
        "grade_score": grade_obj.get("totalScore", 0) if isinstance(grade_obj, dict) else 0,
        "grade_detail": grade_obj if isinstance(grade_obj, dict) else {},
        "tradeable": grade_obj.get("tradeable", False) if isinstance(grade_obj, dict) else False,
        "stage": wein.get("stage", "?"),
        "weinstein_stage": wein.get("stage", "?"),
        "phase": kell.get("phase", "Unknown"),
        "kell_light": kell.get("light", "gray"),
        "rs": mn.get("rs", 50),
        "template_score": mn.get("tplScore", 0),
        "vcp_count": vcp.get("count", 0),
        "pivot": mn.get("pivot") or vcp.get("pivot"),
        # Returns data (both abbreviated and frontend-friendly names)
        "dp": s.get("dp", 0), "wp": s.get("wp", 0), "mp": s.get("mp", 0),
        "qp": s.get("qp", 0), "hp": s.get("hp", 0), "yp": s.get("yp", 0),
        "day_change": s.get("dp", 0), "change_1d": s.get("dp", 0),
        "week_change": s.get("wp", 0), "change_1w": s.get("wp", 0),
        "month_change": s.get("mp", 0), "change_1m": s.get("mp", 0),
        "kell_phase": kell.get("phase", "Unknown"),
        "relative_strength": mn.get("rs", 50),
        "minervini_score": mn.get("tplScore", 0),
        "vcp_detected": vcp.get("count", 0) >= 2,
        "vcp_contractions": vcp.get("count", 0),
        "contractions": vcp.get("count", 0),
        "setup": s.get("setup", ""),
        "risk": s.get("risk", ""),
        "flags": s.get("flags", []),
        "sector": s.get("sector", fund.get("sector", "")),
        "stopPrice": grade_obj.get("stopPrice") if isinstance(grade_obj, dict) else None,
        "target1": grade_obj.get("target1") if isinstance(grade_obj, dict) else None,
        "target2": grade_obj.get("target2") if isinstance(grade_obj, dict) else None,
        "rrRatio": grade_obj.get("rrRatio", 0) if isinstance(grade_obj, dict) else 0,
        # Derived fields for Analyze page
        "high_52w": techs.get("high52"),
        "week52_high": techs.get("high52"),
        "low_52w": techs.get("low52"),
        "week52_low": techs.get("low52"),
        "pct_from_52h": techs.get("pct_from_52h"),
        "pctFrom52l": techs.get("pctFrom52l"),
        "market_cap": fund.get("marketCap", 0),
        "marketCap": fund.get("marketCap", 0),
        # Convergence checklist — convert dict to list for frontend
        "checklist": _conv_details_to_list(s.get("convergenceDetails", s.get("checklist"))),
        "convergence_checklist": _conv_details_to_list(s.get("convergenceDetails")),
        "convergenceDetails": s.get("convergenceDetails"),
        # Preserve full nested data for deep analysis
        "wein": wein, "min": mn, "kell": kell, "conv": conv,
        "vcp": vcp, "fundamentals": fund,
        "technicals": techs,
        "srLevels": s.get("srLevels", []),
        "shortConv": s.get("shortConv", {}),
        "finra": s.get("finra", {}),
        # Qullamaggie momentum data
        "qullamaggie": s.get("qullamaggie", {}),
        "qull_best_setup": (s.get("qullamaggie") or {}).get("best_setup"),
        "qull_best_score": (s.get("qullamaggie") or {}).get("best_score", 0),
        "qull_any_setup": (s.get("qullamaggie") or {}).get("any_setup", False),
        "qull_any_triggering": (s.get("qullamaggie") or {}).get("any_triggering", False),
        "qull_dual_convergence": (s.get("qullamaggie") or {}).get("dual_convergence", False),
        "qull_setups_summary": (s.get("qullamaggie") or {}).get("setups_summary", []),
    }
    return flat


def _build_watchlist():
    spy_df = get_spy()
    if spy_df is None:
        return None
    mkt = _mkt_snapshot
    def _fetch(tk):
        try:
            return analyze_ticker(tk, spy_df, mkt)
        except Exception:
            return None
    with ThreadPoolExecutor(max_workers=5) as ex:
        results = list(ex.map(_fetch, WATCHLIST))
    stocks = [_normalize_stock(r) for r in results if r]
    # Sort by grade score then convergence score
    stocks.sort(key=lambda x: (x.get("grade_score", 0), x.get("convergence_score", 0)), reverse=True)
    return to_python({"stocks": stocks, "lastUpdated": datetime.utcnow().isoformat()})

# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok", "version": "2.1",
        "polygon": bool(POLYGON_KEY), "finnhub": bool(FINNHUB_KEY),
        "claude": bool(CLAUDE_KEY), "fred": bool(FRED_KEY),
        "positions": len(_positions),
    }


@app.get("/api/data-status")
def data_status():
    """Data source status for frontend status bar."""
    status = router.get_status()
    # Add FINRA status
    finra_hist = finra.load_history()
    status["finra"]["data_tickers"] = len(finra_hist)
    status["finra"]["ok"] = len(finra_hist) > 0
    return status


@app.get("/api/macro")
def get_macro():
    """Full macro intelligence dashboard."""
    global _macro_cache
    if _macro_cache and _macro_cache.get("series"):
        return to_python(_macro_cache)
    # Fetch fresh
    _macro_cache = macro.get_full_macro()
    return to_python(_macro_cache)


@app.get("/api/macro/events")
def get_macro_events():
    """Upcoming economic events."""
    return to_python({"events": macro.get_upcoming_events(14)})


@app.get("/api/finra/top-short")
def get_top_short():
    """Top 10 highest SVR in universe today."""
    universe = list(WATCHLIST) + THREATS_LIST
    result = finra.top_short_volume(universe, n=10)
    return to_python({"stocks": result})


@app.get("/api/finra/{ticker}")
def get_finra_ticker(ticker: str):
    """Full SVR data + 20-day history for a ticker."""
    result = finra.analyze_ticker(ticker.upper())
    return to_python(result)


@app.get("/api/finra/screens/squeeze")
def get_squeeze_candidates():
    """Short squeeze candidates."""
    universe = list(WATCHLIST)
    result = finra.short_squeeze_candidates(universe)
    return to_python({"stocks": result, "total": len(result)})


@app.get("/api/finra/screens/distribution")
def get_distribution_detection():
    """Distribution detection signals."""
    universe = list(WATCHLIST)
    result = finra.distribution_detection(universe)
    return to_python({"stocks": result, "total": len(result)})


@app.get("/api/watchlist")
def get_watchlist():
    cached = cache_get("watchlist", CACHE_WATCHLIST)
    if cached: return cached
    resp = _build_watchlist()
    if resp is None:
        raise HTTPException(503, "Could not fetch market data")
    cache_set("watchlist", resp)
    return resp

@app.get("/api/analyze/{ticker}")
def get_analyze(ticker: str):
    ticker = ticker.upper().strip()
    key = f"analyze_{ticker}"
    cached = cache_get(key, CACHE_WATCHLIST)
    if cached: return cached

    spy_df = get_spy()
    result = analyze_ticker(ticker, spy_df if spy_df is not None else pd.DataFrame(), _mkt_snapshot)
    if result is None:
        raise HTTPException(404, f"Could not analyze {ticker}")

    # Enhanced with detailed convergence breakdown
    try:
        df = fetch_ohlcv(ticker, "2y")
        if df is not None:
            fund = result.get("fundamentals", {})
            wein = result["wein"]
            rs = result["min"]["rs"]
            phase = result["kell"]["phase"]
            vcp = result["vcp"]
            tpl_score = result["min"]["tplScore"]
            _, _, conv_details = convergence_score(wein, tpl_score, rs, phase, vcp, _mkt_snapshot, fund, df, detailed=True)
            result["convergenceDetails"] = conv_details
    except Exception:
        pass

    result = to_python(_normalize_stock(result))
    cache_set(key, result)
    return result

@app.get("/api/options-analysis/{ticker}")
def get_options_analysis(ticker: str):
    """Full options intelligence for a ticker."""
    ticker = ticker.upper().strip()
    key = f"options_{ticker}"
    cached = cache_get(key, CACHE_OPTIONS)
    if cached: return cached

    try:
        df = fetch_ohlcv(ticker, "2y")
        if df is None:
            raise HTTPException(404, f"No data for {ticker}")

        spot = float(df["Close"].iloc[-1])
        spy_df = get_spy()
        mkt = _mkt_snapshot

        # Get analysis context
        wein = weinstein_stage(df)
        rs = calc_rs_rating(df, spy_df) if spy_df is not None else 50
        _, tpl_score = minervini_template(df, rs)
        kell_result = kell_phase(df)
        phase = kell_result[0]
        vcp = detect_vcp(df)
        fund = fetch_fundamentals(ticker)
        conv_s, conv_z = convergence_score(wein, tpl_score, rs, phase, vcp, mkt, fund, df)

        # Try Polygon options data first, fall back to yfinance
        opts_data = router.fetch_options_data(ticker, spot)

        if opts_data.get("source") == "polygon" and opts_data.get("iv_analysis"):
            # Use Polygon real data
            result = {
                "ticker": ticker,
                "spot": spot,
                "iv": opts_data["iv_analysis"],
                "expectedMove": calc_expected_move(df, opts_data["iv_analysis"].get("currentIV", 0.3), spot),
                "strategy": select_strategy(
                    opts_data["iv_analysis"].get("ivRank", 50),
                    conv_z, phase, wein["stage"],
                ),
                "chainSnapshot": [],
                "source": "polygon",
            }
            # Build chain snapshot from Polygon data
            snapshot = opts_data.get("snapshot", {})
            if snapshot:
                for exp in snapshot.get("expirations", [])[:4]:
                    exp_calls = [c for c in snapshot.get("calls", []) if c["expiration"] == exp]
                    exp_puts = [p for p in snapshot.get("puts", []) if p["expiration"] == exp]
                    from datetime import datetime as dt
                    try:
                        dte = (dt.strptime(exp, "%Y-%m-%d").date() - dt.now().date()).days
                    except Exception:
                        dte = 30
                    # Filter near ATM
                    near_calls = sorted([c for c in exp_calls if abs(c["strike"] / spot - 1) < 0.15], key=lambda c: c["strike"])
                    near_puts = sorted([p for p in exp_puts if abs(p["strike"] / spot - 1) < 0.15], key=lambda p: p["strike"])
                    result["chainSnapshot"].append({
                        "expiration": exp, "dte": dte,
                        "calls": near_calls[:10], "puts": near_puts[:10],
                    })
        else:
            # Fallback: yfinance via options_engine
            import yfinance as yf
            t = yf.Ticker(ticker)
            result = full_options_analysis(t, df, spot, conv_z, phase, wein["stage"], vcp.get("pivot"))

        # Add FINRA short volume context
        finra_data = finra.analyze_ticker(ticker)
        if finra_data.get("svr_today") is not None:
            result["shortVolume"] = finra_data

        # Add expected move breakeven comparison
        if result.get("chainSnapshot"):
            for snap in result["chainSnapshot"]:
                for opt in snap.get("calls", []):
                    delta = opt.get("delta", opt.get("greeks", {}).get("delta", 0))
                    if abs(delta - 0.5) < 0.15:
                        be_pct = opt.get("breakevenPct", 5)
                        comparison = compare_move_to_breakeven(result.get("expectedMove", {}), be_pct, snap.get("dte", 30))
                        result["breakevenComparison"] = comparison
                        break

        # Flatten IV data for frontend consumption
        iv = result.get("iv") or {}
        result["iv_rank"] = iv.get("ivRank") or iv.get("iv_rank")
        result["iv_percentile"] = iv.get("ivPercentile") or iv.get("iv_percentile")
        result["current_iv"] = iv.get("currentIV") or iv.get("current_iv")
        result["hv_30"] = iv.get("hv30") or iv.get("hv_30")
        iv_cur = result["current_iv"]
        hv_cur = result["hv_30"]
        result["iv_hv_ratio"] = round(iv_cur / hv_cur, 2) if iv_cur and hv_cur and hv_cur > 0 else None
        pcr = result.get("putCallRatio")
        result["put_call_ratio"] = pcr.get("volume") if isinstance(pcr, dict) else pcr
        result["term_structure"] = iv.get("termStructureDetail") or iv.get("term_structure")
        result["skew"] = iv.get("skewVerdict") or iv.get("skew")
        strat = result.get("strategy") or result.get("strategySelection")
        result["strategies"] = [strat] if isinstance(strat, dict) else (strat if isinstance(strat, list) else [])

        result = to_python(result)
        cache_set(key, result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Options analysis error for {ticker}: {e}")
        return {"error": str(e), "ticker": ticker}

@app.get("/api/trade-ideas/{ticker}")
def get_trade_ideas(ticker: str):
    """Generate 2-3 graded strategy cards for a ticker."""
    ticker = ticker.upper().strip()
    key = f"ideas_{ticker}"
    cached = cache_get(key, CACHE_OPTIONS)
    if cached: return cached

    try:
        df = fetch_ohlcv(ticker, "2y")
        if df is None:
            raise HTTPException(404, f"No data for {ticker}")

        spot = float(df["Close"].iloc[-1])
        spy_df = get_spy()
        mkt = _mkt_snapshot

        wein = weinstein_stage(df)
        rs = calc_rs_rating(df, spy_df) if spy_df is not None else 50
        _, tpl_score = minervini_template(df, rs)
        kell_result = kell_phase(df)
        phase, _, ema_d, ema_w, ema_m = kell_result[:5]
        vcp = detect_vcp(df)
        fund = fetch_fundamentals(ticker)
        conv_s, conv_z = convergence_score(wein, tpl_score, rs, phase, vcp, mkt, fund, df)
        is_short = wein["stage"] in ("3", "4A", "4B")

        # Get options chain (Polygon → yfinance)
        opts_data = router.fetch_options_data(ticker, spot)
        chain = []
        iv_data = {}

        if opts_data.get("source") == "polygon" and opts_data.get("snapshot"):
            # Use Polygon data
            iv_data = opts_data.get("iv_analysis", {})
            snapshot = opts_data["snapshot"]
            for exp in snapshot.get("expirations", [])[:4]:
                exp_calls = [c for c in snapshot.get("calls", []) if c["expiration"] == exp]
                exp_puts = [p for p in snapshot.get("puts", []) if p["expiration"] == exp]
                near_calls = sorted([c for c in exp_calls if abs(c["strike"] / spot - 1) < 0.15], key=lambda c: c["strike"])[:8]
                near_puts = sorted([p for p in exp_puts if abs(p["strike"] / spot - 1) < 0.15], key=lambda p: p["strike"])[:8]
                from datetime import datetime as dt
                try:
                    dte = (dt.strptime(exp, "%Y-%m-%d").date() - dt.now().date()).days
                except Exception:
                    dte = 30
                chain.append({"expiration": exp, "dte": dte, "calls": near_calls, "puts": near_puts})
        elif opts_data.get("yf_ticker"):
            # Fallback: yfinance
            chain = build_options_snapshot(opts_data["yf_ticker"], spot, "bearish" if is_short else "bullish")
            iv_data = calc_iv_from_options_chain(opts_data["yf_ticker"])
        else:
            import yfinance as yf
            t = yf.Ticker(ticker)
            chain = build_options_snapshot(t, spot, "bearish" if is_short else "bullish")
            iv_data = calc_iv_from_options_chain(t)

        # Volume ratio
        technicals = calc_technicals(df)
        vol_ratio = technicals.get("volumeProfile", {}).get("ratio", 1.0)

        ideas = generate_trade_ideas(
            ticker=ticker, spot=spot, chain_snapshot=chain,
            wein=wein, tpl_score=tpl_score, rs=rs, phase=phase,
            vcp=vcp, conv_zone=conv_z, conv_score=conv_s, conv_max=23,
            ema_d=ema_d, ema_w=ema_w, ema_m=ema_m,
            fundamentals=fund, iv_data=iv_data,
            vol_ratio=vol_ratio, is_short=is_short,
        )

        result = to_python(ideas)
        cache_set(key, result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Trade ideas error for {ticker}: {e}")
        return {"error": str(e), "ticker": ticker}

@app.get("/api/technicals/{ticker}")
def get_technicals(ticker: str):
    ticker = ticker.upper().strip()
    key = f"tech_{ticker}"
    cached = cache_get(key, CACHE_TECHNICALS)
    if cached: return cached
    df = fetch_ohlcv(ticker, "2y")
    if df is None:
        raise HTTPException(404, f"No data for {ticker}")
    result = to_python(calc_technicals(df))
    cache_set(key, result)
    return result

@app.get("/api/support-resistance/{ticker}")
def get_support_resistance(ticker: str):
    ticker = ticker.upper().strip()
    df = fetch_ohlcv(ticker, "2y")
    if df is None:
        raise HTTPException(404, f"No data for {ticker}")
    levels = calc_sr_levels(df)
    support = [l for l in levels if l.get("type") == "support"]
    resistance = [l for l in levels if l.get("type") == "resistance"]
    # Pivot point from last day's HLC
    if len(df) >= 2:
        prev = df.iloc[-2]
        pivot = round((float(prev["High"]) + float(prev["Low"]) + float(prev["Close"])) / 3, 2)
    else:
        pivot = None
    return to_python({"levels": levels, "support": support, "resistance": resistance, "pivot": pivot, "ticker": ticker})

@app.get("/api/screener")
def get_screener(
    preset: str = "",
    rs_min: int = 0, rs_max: int = 99,
    stage: str = "", template_min: int = 0,
    sector: str = "", vcp: bool = False,
    zone: str = "", short_mode: bool = False,
    min_grade: str = "",
):
    # Apply preset filters
    if preset and preset in SCREENER_PRESETS:
        p = SCREENER_PRESETS[preset]["filters"]
        if "rs_min" in p: rs_min = p["rs_min"]
        if "rs_max" in p: rs_max = p["rs_max"]
        if "stage" in p: stage = p["stage"]
        if "template_min" in p: template_min = p["template_min"]
        if "vcp" in p: vcp = p["vcp"]
        if "zone" in p: zone = p["zone"]
        if "short_mode" in p: short_mode = p["short_mode"]

    # Handle Qullamaggie special presets
    special = SCREENER_PRESETS.get(preset, {}).get("special", "") if preset else ""
    if special in ("qull_breakouts", "qull_parabolic", "qull_ep", "dual_convergence"):
        cached_wl = cache_get("watchlist", CACHE_WATCHLIST * 4)
        stocks = (cached_wl or {}).get("stocks", [])
        if not stocks:
            resp = _build_watchlist()
            stocks = (resp or {}).get("stocks", [])
        qull_filtered = []
        for s in stocks:
            qull = s.get("qullamaggie", {})
            if not qull:
                continue
            if special == "qull_breakouts":
                bo = qull.get("breakout")
                if bo and bo.get("passed"):
                    s = {**s, "qull_sort_score": bo.get("score", 0)}
                    qull_filtered.append(s)
            elif special == "qull_parabolic":
                para = qull.get("parabolic")
                if para and (para.get("short_setup") or para.get("long_bounce")):
                    s = {**s, "qull_sort_score": max(para.get("short_score", 0), para.get("long_score", 0))}
                    qull_filtered.append(s)
            elif special == "qull_ep":
                ep = qull.get("episodic_pivot")
                if ep and ep.get("passed"):
                    s = {**s, "qull_sort_score": ep.get("score", 0)}
                    qull_filtered.append(s)
            elif special == "dual_convergence":
                if s.get("qull_dual_convergence"):
                    s = {**s, "qull_sort_score": s.get("grade_score", 0)}
                    qull_filtered.append(s)
        qull_filtered.sort(key=lambda x: x.get("qull_sort_score", 0), reverse=True)
        return to_python({
            "stocks": qull_filtered, "total": len(qull_filtered),
            "preset": preset, "presetName": SCREENER_PRESETS.get(preset, {}).get("name", "Custom"),
        })

    cached = cache_get("watchlist", CACHE_WATCHLIST * 4)
    if cached:
        stocks = cached.get("stocks", [])
    else:
        resp = _build_watchlist()
        if resp is None:
            return {"stocks": [], "total": 0}
        stocks = resp.get("stocks", [])

    filtered = []
    grade_thresholds = {"AAA": 90, "AA": 80, "A": 70, "BBB": 60, "BB": 50}

    for s in stocks:
        try:
            rs_val = s.get("rs", s.get("min", {}).get("rs", 50))
            if not (rs_min <= rs_val <= rs_max): continue

            if stage:
                s_stage = s.get("stage", s.get("wein", {}).get("stage", ""))
                if stage == "2":
                    if s_stage not in ("2A", "2B"): continue
                elif stage == "4":
                    if s_stage not in ("4A", "4B"): continue
                elif not s_stage.startswith(stage): continue

            if s.get("template_score", s.get("min", {}).get("tplScore", 0)) < template_min: continue
            if sector and sector.lower() not in (s.get("sector", "") or "").lower(): continue
            if vcp and s.get("vcp_count", s.get("vcp", {}).get("count", 0)) < 2: continue

            if zone:
                s_zone = s.get("zone", s.get("shortConv" if short_mode else "conv", {}).get("zone", ""))
                if s_zone != zone: continue

            if min_grade and min_grade in grade_thresholds:
                grade_score = s.get("grade_score", s.get("grade", {}).get("totalScore", 0) if isinstance(s.get("grade"), dict) else 0)
                if grade_score < grade_thresholds[min_grade]: continue

            filtered.append(s)
        except Exception:
            continue

    filtered.sort(key=lambda x: (x.get("grade_score", 0), x.get("convergence_score", x.get("score", 0))), reverse=True)

    return to_python({
        "stocks": filtered, "total": len(filtered),
        "preset": preset, "presetName": SCREENER_PRESETS.get(preset, {}).get("name", "Custom"),
    })

@app.get("/api/screener/presets")
def get_screener_presets():
    return SCREENER_PRESETS

# ─────────────────────────────────────────────
# SCANNER ENDPOINTS
# ─────────────────────────────────────────────
@app.get("/api/scanners")
def get_scanner_modules():
    """List all available scanner modules."""
    return SCANNER_MODULES

@app.get("/api/scanner/{module}")
def run_scanner(module: str):
    """Run a specific scanner module against the watchlist universe."""
    if module not in SCANNER_MODULES:
        raise HTTPException(404, f"Unknown scanner: {module}")
    try:
        cached = cache_get("watchlist", CACHE_WATCHLIST * 4)
        if cached:
            stocks = cached.get("stocks", [])
        else:
            resp = _build_watchlist()
            if resp is None:
                return {"stocks": [], "total": 0, "scanner": module, "scannerName": SCANNER_MODULES[module]["name"]}
            stocks = resp.get("stocks", [])

        filtered = _run_scanner(module, stocks)
        return to_python({
            "stocks": filtered,
            "total": len(filtered),
            "scanner": module,
            "scannerName": SCANNER_MODULES[module]["name"],
            "description": SCANNER_MODULES[module]["description"],
            "lastUpdated": datetime.utcnow().isoformat(),
        })
    except Exception as e:
        log.error(f"Scanner {module} error: {e}")
        return {"stocks": [], "total": 0, "scanner": module, "error": str(e)}

@app.get("/api/breadth")
def get_breadth():
    cached = cache_get("breadth", CACHE_BREADTH)
    if cached: return cached
    data = to_python(compute_breadth())
    global _mkt_snapshot
    _mkt_snapshot = {
        "spxStage": data.get("spxStage", 2), "spxEma": data.get("spxEma", "above"),
        "tplCount": data.get("tplCount", 500), "vix": data.get("vix", 20),
    }
    cache_set("breadth", data)
    return data

@app.get("/api/threats")
def get_threats():
    cached = cache_get("threats", CACHE_THREATS)
    if cached: return cached
    spy_df = get_spy()
    data = compute_threats(spy_df if spy_df is not None else pd.DataFrame(), _mkt_snapshot)
    resp = to_python({"threats": data, "lastUpdated": datetime.utcnow().isoformat()})
    cache_set("threats", resp)
    return resp

@app.get("/api/news")
def get_news():
    cached = cache_get("news", CACHE_NEWS)
    if cached: return cached
    data = fetch_news_data(WATCHLIST)
    data["lastUpdated"] = datetime.utcnow().isoformat()
    cache_set("news", data)
    return data

@app.get("/api/earnings-calendar")
def get_earnings_calendar():
    cached = cache_get("earnings", CACHE_EARNINGS)
    if cached: return cached
    data = fetch_earnings_calendar(WATCHLIST + THREATS_LIST)
    resp = {"earnings": data, "lastUpdated": datetime.utcnow().isoformat()}
    cache_set("earnings", resp)
    return resp

@app.get("/api/earnings")
def get_earnings():
    return get_earnings_calendar()

@app.get("/api/daily-brief")
def get_daily_brief():
    cached = cache_get("brief", CACHE_BRIEF)
    if cached: return cached
    try:
        wl_cached = cache_get("watchlist", CACHE_WATCHLIST * 2)
        br_cached = cache_get("breadth", CACHE_BREADTH * 2)
        th_cached = cache_get("threats", CACHE_THREATS * 2)
        watchlist_data = (wl_cached or {}).get("stocks", [])
        breadth_data = br_cached or _mkt_snapshot
        threats_data = (th_cached or {}).get("threats", [])
        content = generate_daily_brief(watchlist_data, breadth_data, threats_data)
        resp = {**content, "generatedAt": datetime.utcnow().isoformat()}
        cache_set("brief", resp)
        return resp
    except Exception as e:
        log.error(f"Brief generation error: {e}")
        return {"tier1": f"# MKW BRIEF\n\nBrief generation encountered an error: {e}\n\nData may still be loading. Retry in a few minutes.",
                "tier2": None, "error": str(e), "generatedAt": datetime.utcnow().isoformat()}

@app.get("/api/brief")
def get_brief():
    return get_daily_brief()

# ─────────────────────────────────────────────
# MARKET WIZARD CHAT
# ─────────────────────────────────────────────

@app.post("/api/wizard/chat")
async def wizard_chat(request: Request):
    """Streaming AI chat with market context injection."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    message = str(body.get("message", "")).strip()
    conversation_history = body.get("conversationHistory", [])
    page_context = body.get("context", {})

    if not message:
        raise HTTPException(400, "message required")

    # 1. Classify the query
    classification = wiz.classify_query(message)
    tickers = classification["tickers"]
    needs_market = classification["needs_market_data"]
    needs_reasoning = classification["needs_reasoning"]
    max_tokens = classification["max_tokens"]

    # 2. Gather contextual data
    market_context_parts = []

    # Inject page context if available
    if page_context.get("currentTicker") and not tickers:
        tickers = [page_context["currentTicker"]]

    if needs_market or page_context.get("breadth"):
        try:
            breadth_data = cache_get("breadth", CACHE_BREADTH * 4)
            if not breadth_data:
                breadth_data = to_python(compute_breadth())
            market_context_parts.append(wiz.format_market_context(breadth_data))
        except Exception as e:
            log.warning(f"Wizard: breadth fetch failed: {e}")

    # Fetch ticker data
    for ticker in tickers[:3]:
        try:
            # Try cache first
            cached = cache_get(f"analyze_{ticker}", CACHE_WATCHLIST * 2)
            if cached:
                market_context_parts.append(wiz.format_ticker_context(ticker, cached))
            else:
                # Quick analysis
                spy_df = get_spy()
                result = analyze_ticker(ticker, spy_df if spy_df is not None else pd.DataFrame(), _mkt_snapshot)
                if result:
                    normalized = _normalize_stock(result)
                    market_context_parts.append(wiz.format_ticker_context(ticker, normalized))
        except Exception as e:
            log.warning(f"Wizard: ticker {ticker} fetch failed: {e}")
            market_context_parts.append(f"\nTICKER {ticker}: Data fetch failed")

    # If asking about best setups, inject watchlist summary
    lower = message.lower()
    if any(kw in lower for kw in ["best setup", "top pick", "watchlist", "best play", "what should"]):
        try:
            wl = cache_get("watchlist", CACHE_WATCHLIST * 4)
            if wl:
                market_context_parts.append(wiz.format_watchlist_summary(wl.get("stocks", [])))
        except Exception:
            pass

    # If asking about macro
    if any(kw in lower for kw in ["macro", "fed", "rates", "inflation", "economy"]):
        try:
            if _macro_cache and _macro_cache.get("score"):
                mc = _macro_cache
                score = mc["score"]
                market_context_parts.append(f"\nMACRO ENVIRONMENT: Score {score.get('score', '?')}/10 ({score.get('regime', '?')})")
                rates = mc.get("rates", {})
                if rates:
                    market_context_parts.append(f"  Fed Funds: {rates.get('fed_funds', '?')}% | 10Y: {rates.get('ten_year', '?')}% | Yield Curve: {rates.get('yield_curve', '?')}%")
        except Exception:
            pass

    full_context = "\n".join(market_context_parts)

    # 3. Build messages
    system_prompt = wiz.build_system_prompt(full_context)
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history (last 10 exchanges)
    for msg in conversation_history[-20:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": message})

    # 4. Stream response via SSE
    def event_stream():
        try:
            for chunk in llm_provider.stream_completion(
                messages=messages,
                use_reasoning=needs_reasoning,
                max_tokens=max_tokens,
            ):
                yield f"data: {json.dumps(chunk)}\n\n"

            # Send follow-up suggestions
            follow_ups = wiz.generate_follow_ups(message, "", tickers)
            yield f"data: {json.dumps({'type': 'suggestions', 'suggestions': follow_ups})}\n\n"

        except Exception as e:
            log.error(f"Wizard stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/wizard/status")
def wizard_status():
    """Return LLM provider status."""
    return llm_provider.get_provider_status()


# ─────────────────────────────────────────────
# JOURNAL ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/journal")
def journal_list(status: str = "", ticker: str = "", limit: int = 100):
    trades = get_trades(status=status, ticker=ticker, limit=limit)
    return {"trades": trades, "total": len(trades)}

@app.post("/api/journal")
async def journal_add(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    return add_trade(body)

@app.put("/api/journal/{trade_id}")
async def journal_update(trade_id: str, request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    result = update_trade(trade_id, body)
    if result is None:
        raise HTTPException(404, f"Trade {trade_id} not found")
    return result

@app.delete("/api/journal/{trade_id}")
def journal_delete(trade_id: str):
    if delete_trade(trade_id):
        return {"deleted": True}
    raise HTTPException(404, f"Trade {trade_id} not found")

@app.get("/api/journal/analytics")
def journal_analytics():
    return compute_analytics()

# ─────────────────────────────────────────────
# POSITIONS ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/positions")
def get_positions():
    return {"positions": list(_positions.values()), "total": len(_positions)}

@app.post("/api/positions")
async def create_position(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    ticker = str(body.get("ticker", "")).upper().strip()
    if not ticker:
        raise HTTPException(400, "ticker required")
    direction = str(body.get("direction", "LONG")).upper()
    entry_price = float(body.get("entryPrice", 0))
    stop_level = float(body.get("stopLevel", 0))
    if not entry_price or not stop_level:
        raise HTTPException(400, "entryPrice and stopLevel required")

    pid = str(uuid.uuid4())
    pos = {
        "id": pid, "ticker": ticker, "direction": direction,
        "entryDate": datetime.utcnow().isoformat(), "entryPrice": entry_price,
        "optionStrike": body.get("optionStrike"), "optionExpiry": body.get("optionExpiry"),
        "premiumPaid": body.get("premiumPaid"), "contracts": int(body.get("contracts", 1)),
        "stopLevel": stop_level, "currentStop": body.get("currentStop", stop_level),
        "target1": body.get("target1"), "target2": body.get("target2"),
        "notes": body.get("notes", ""), "status": "ACTIVE",
        "closePrice": None, "closeDate": None,
    }
    _positions[pid] = pos
    save_positions(_positions)
    return pos

@app.put("/api/positions/{position_id}")
async def update_position(position_id: str, request: Request):
    if position_id not in _positions:
        raise HTTPException(404, f"Position {position_id} not found")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    pos = _positions[position_id]
    for k in ["stopLevel","target1","target2","currentStop","closePrice"]:
        if k in body:
            pos[k] = float(body[k]) if body[k] is not None else None
    for k in ["notes","status","closeDate","optionExpiry"]:
        if k in body:
            pos[k] = body[k]
    if k in body and k == "contracts":
        pos["contracts"] = int(body["contracts"])
    if pos.get("status") == "CLOSED" and not pos.get("closeDate"):
        pos["closeDate"] = datetime.utcnow().isoformat()
    _positions[position_id] = pos
    save_positions(_positions)
    return pos

@app.delete("/api/positions/{position_id}")
def delete_position_endpoint(position_id: str):
    if position_id not in _positions:
        raise HTTPException(404)
    deleted = _positions.pop(position_id)
    save_positions(_positions)
    return {"deleted": True, "ticker": deleted.get("ticker")}

# ─────────────────────────────────────────────
# PORTFOLIO GREEKS
# ─────────────────────────────────────────────

@app.get("/api/portfolio/greeks")
def portfolio_greeks():
    """Calculate aggregate portfolio Greeks from open positions."""
    positions = [p for p in _positions.values() if p.get("status") == "ACTIVE"]
    if not positions:
        return {"totalDelta": 0, "totalGamma": 0, "totalTheta": 0, "totalVega": 0, "positions": [], "thetaRate": 0}

    r = 0.05
    port_delta, port_gamma, port_theta, port_vega = 0, 0, 0, 0
    pos_greeks = []

    for pos in positions:
        ticker = pos.get("ticker", "")
        try:
            df = fetch_ohlcv(ticker, "6mo")
            if df is None: continue
            spot = float(df["Close"].iloc[-1])
            strike = pos.get("optionStrike")
            expiry = pos.get("optionExpiry")
            contracts = pos.get("contracts", 1)
            direction = pos.get("direction", "LONG")

            if strike and expiry:
                try:
                    exp_date = datetime.strptime(str(expiry), "%Y-%m-%d")
                    dte = max(1, (exp_date - datetime.now()).days)
                    T = dte / 365
                    hv = calc_historical_volatility(df)
                    opt_type = "put" if direction == "SHORT" else "call"
                    g = calc_greeks(spot, float(strike), T, r, hv, opt_type)
                    mult = contracts * 100
                    d = g["delta"] * mult
                    gm = g["gamma"] * mult
                    th = g["theta"] * mult
                    v = g["vega"] * mult
                    port_delta += d
                    port_gamma += gm
                    port_theta += th
                    port_vega += v
                    pos_greeks.append({
                        "ticker": ticker, "delta": round(d, 1), "gamma": round(gm, 4),
                        "theta": round(th, 2), "vega": round(v, 2),
                        "dte": dte, "spot": spot, "strike": float(strike),
                    })
                except Exception:
                    pass
        except Exception:
            pass

    return to_python({
        "totalDelta": round(port_delta, 1), "totalGamma": round(port_gamma, 4),
        "totalTheta": round(port_theta, 2), "totalVega": round(port_vega, 2),
        "thetaPerDay": f"${abs(port_theta):.2f}/day",
        "positions": pos_greeks,
    })

@app.get("/api/portfolio/correlation")
def portfolio_correlation():
    """Sector exposure and correlation for open positions."""
    positions = [p for p in _positions.values() if p.get("status") == "ACTIVE"]
    if not positions:
        return {"sectors": {}, "positions": [], "warnings": []}

    sector_exposure = {}
    pos_data = []
    total_positions = len(positions)

    for pos in positions:
        ticker = pos.get("ticker", "")
        try:
            fund = fetch_fundamentals(ticker)
            sector = fund.get("sector", "Unknown")
            sector_exposure[sector] = sector_exposure.get(sector, 0) + 1
            pos_data.append({"ticker": ticker, "sector": sector})
        except Exception:
            pass

    # Convert to percentages
    sector_pcts = {k: round(v / total_positions * 100, 1) for k, v in sector_exposure.items()}
    warnings = []
    for sect, pct in sector_pcts.items():
        if pct > 40:
            warnings.append(f"{sect}: {pct}% of portfolio. OVERCONCENTRATED. Sector rotation risk.")

    return to_python({
        "sectors": sector_pcts, "positions": pos_data, "warnings": warnings,
        "totalPositions": total_positions,
    })

# ─────────────────────────────────────────────
# QULLAMAGGIE ENDPOINTS
# ─────────────────────────────────────────────

CACHE_QULL = 600  # 10 min

@app.get("/api/qullamaggie/scan")
def qullamaggie_scan():
    """Run all three Qullamaggie scanners across the watchlist universe."""
    cached = cache_get("qull_scan", CACHE_QULL)
    if cached:
        return cached

    try:
        # Get daily data for all watchlist tickers
        daily_data = {}
        fund_data = {}
        for ticker in WATCHLIST:
            try:
                df = fetch_ohlcv(ticker, "2y")
                if df is not None and len(df) >= 60:
                    daily_data[ticker] = df
                fund = fetch_fundamentals(ticker)
                fund_data[ticker] = fund
                time.sleep(0.2)
            except Exception:
                continue

        results = qull.run_qullamaggie_scan(
            list(daily_data.keys()), daily_data, fund_data
        )
        results["lastUpdated"] = datetime.utcnow().isoformat()
        resp = to_python(results)
        cache_set("qull_scan", resp)
        return resp
    except Exception as e:
        log.error(f"Qullamaggie scan error: {e}")
        return {"error": str(e), "breakouts": [], "parabolic_shorts": [],
                "parabolic_longs": [], "episodic_pivots": [], "all_setups": []}


@app.get("/api/qullamaggie/{ticker}")
def qullamaggie_ticker(ticker: str):
    """Run all three Qullamaggie scanners on a single ticker with trade plan."""
    ticker = ticker.upper().strip()
    key = f"qull_{ticker}"
    cached = cache_get(key, CACHE_QULL)
    if cached:
        return cached

    try:
        df = fetch_ohlcv(ticker, "2y")
        if df is None or len(df) < 60:
            raise HTTPException(404, f"Insufficient data for {ticker}")

        fund = fetch_fundamentals(ticker)
        mcap = fund.get("marketCap", 0)
        analysis = qull.analyze_qullamaggie(ticker, df, fundamentals=fund, market_cap=mcap)

        # Generate trade plans for detected setups
        trade_plans = []
        # Calculate ATR for trade plan
        tr = pd.concat([
            df['High'] - df['Low'],
            (df['High'] - df['Close'].shift(1)).abs(),
            (df['Low'] - df['Close'].shift(1)).abs()
        ], axis=1).max(axis=1)
        atr = float(tr.rolling(14).mean().iloc[-1])
        current_price = float(df['Close'].iloc[-1])
        day_low = float(df['Low'].iloc[-1])

        bo = analysis.get('breakout')
        if bo and bo.get('passed'):
            plan = generate_trade_plan('BREAKOUT', {
                **bo, 'day_low': day_low
            }, current_price, atr)
            if plan:
                trade_plans.append(plan)

        para = analysis.get('parabolic')
        if para:
            if para.get('short_setup'):
                recent_high = float(df['High'].tail(20).max())
                plan = generate_trade_plan('PARABOLIC_SHORT', {
                    **para, 'recent_high': recent_high
                }, current_price, atr)
                if plan:
                    trade_plans.append(plan)
            if para.get('long_bounce'):
                plan = generate_trade_plan('PARABOLIC_LONG', para, current_price, atr)
                if plan:
                    trade_plans.append(plan)

        ep = analysis.get('episodic_pivot')
        if ep and ep.get('passed'):
            plan = generate_trade_plan('EPISODIC_PIVOT', {
                **ep, 'day_low': day_low
            }, current_price, atr)
            if plan:
                trade_plans.append(plan)

        # Get Qullamaggie indicators snapshot
        indicators = get_qullamaggie_snapshot(df)

        result = {
            **analysis,
            'trade_plans': trade_plans,
            'indicators': indicators,
            'atr': round(atr, 2),
            'current_price': round(current_price, 2),
        }

        resp = to_python(result)
        cache_set(key, resp)
        return resp
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Qullamaggie {ticker} error: {e}")
        return {"error": str(e), "ticker": ticker}


@app.post("/api/qullamaggie/archive")
async def qullamaggie_archive_add(request: Request):
    """Add a setup to the Qullamaggie historical archive."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    return qull.archive_setup(body)


@app.get("/api/qullamaggie/archive")
def qullamaggie_archive_list(setup_type: str = "", ticker: str = "", limit: int = 100):
    """List archived Qullamaggie setups."""
    return {"entries": qull.get_archive(setup_type, ticker, limit)}


@app.get("/api/qullamaggie/archive/analytics")
def qullamaggie_archive_analytics():
    """Performance analytics from the Qullamaggie setup archive."""
    return qull.archive_analytics()


# ─────────────────────────────────────────────
# DEBUG ENDPOINT
# ─────────────────────────────────────────────

@app.get("/api/debug/{ticker}")
def debug_ticker(ticker: str):
    ticker = ticker.upper().strip()
    try:
        spy_df = get_spy()
        df = fetch_ohlcv(ticker, "2y")
        if df is None or len(df) < 60:
            return {"error": f"Insufficient data for {ticker}"}

        fund = fetch_fundamentals(ticker)
        rs = calc_rs_rating(df, spy_df) if spy_df is not None else 50
        wein = weinstein_stage(df)
        tpl_criteria, tpl_score = minervini_template(df, rs)
        kell_result = kell_phase(df)
        phase = kell_result[0]
        vcp = detect_vcp(df)
        mkt = _mkt_snapshot

        conv_s, conv_z, conv_details = convergence_score(wein, tpl_score, rs, phase, vcp, mkt, fund, df, detailed=True)

        price = float(df["Close"].iloc[-1])

        return to_python({
            "ticker": ticker, "price": round(price, 2),
            "mkt_snapshot": mkt, "weinstein": wein,
            "minervini": {"tpl_criteria": tpl_criteria, "tpl_score": tpl_score},
            "kell": {"phase": phase, "light": kell_result[1], "ema_d": kell_result[2], "ema_w": kell_result[3], "ema_m": kell_result[4]},
            "vcp": vcp, "fundamentals": fund, "rs": rs,
            "convergence": {"score": conv_s, "zone": conv_z, "max": 22, "criteria": conv_details},
        })
    except Exception as e:
        return {"error": str(e)}

# ─────────────────────────────────────────────
# STATIC FRONTEND
# ─────────────────────────────────────────────
dist_path = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.isdir(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        return FileResponse(os.path.join(dist_path, "index.html"))
```

---

# SECTION 3: SCORING & ANALYSIS ENGINE

## 3a. Grading / Scoring System (backend/grading.py) — Full Contents

```python
"""
MKW Trade Grading System
100-point composite scoring: AAA to F grade for every potential trade.
"""

import logging
from typing import Optional

log = logging.getLogger("mkw.grading")


# ─────────────────────────────────────────────────────────
# GRADE SCALE
# ─────────────────────────────────────────────────────────
GRADE_SCALE = [
    (90, "AAA", "gold",   "Take full position. Everything aligned."),
    (80, "AA",  "green",  "Strong setup. Standard position size."),
    (70, "A",   "cyan",   "Good setup. Reduced position size."),
    (60, "BBB", "gray",   "Acceptable but flawed. Half position or paper trade."),
    (50, "BB",  "red",    "Do not trade. Watch only."),
    (40, "B",   "red",    "Do not trade. Significant flaws."),
    (0,  "F",   "red",    "Failed. No trade characteristics."),
]

def score_to_grade(score: int) -> dict:
    """Convert numeric score (0-100) to letter grade with metadata."""
    for threshold, grade, color, desc in GRADE_SCALE:
        if score >= threshold:
            return {
                "grade": grade,
                "score": score,
                "color": color,
                "description": desc,
                "tradeable": score >= 60,
                "fullPosition": score >= 90,
            }
    return {"grade": "F", "score": score, "color": "red", "description": "Failed.", "tradeable": False, "fullPosition": False}


# ─────────────────────────────────────────────────────────
# COMPONENT SCORERS
# ─────────────────────────────────────────────────────────

def score_directional_edge(conv_score: int, conv_max: int, conv_zone: str,
                           wein_stage: str, tpl_score: int, rs: int,
                           phase: str, ema_d: str, ema_w: str, ema_m: str,
                           is_short: bool = False) -> dict:
    """
    Directional Edge: 30 points max.
    Based on convergence score and framework alignment.
    """
    points = 0
    breakdown = []

    # Convergence score mapping (22 points max -> 22 points of directional)
    if conv_score >= 22:
        conv_pts = 22
    elif conv_score >= 18:
        conv_pts = 18
    elif conv_score >= 15:
        conv_pts = 12
    elif conv_score >= 12:
        conv_pts = 8
    else:
        conv_pts = max(0, conv_score // 2)

    # Scale to out of 22 (convergence quality)
    points += conv_pts
    breakdown.append(f"Convergence {conv_score}/{conv_max} = {conv_pts}pts")

    # Framework alignment bonus (up to 8 additional points)
    frameworks_aligned = 0

    # Weinstein aligned?
    if not is_short:
        wein_aligned = wein_stage in ("2A", "2B")
    else:
        wein_aligned = wein_stage in ("4A", "4B")

    # Minervini aligned?
    if not is_short:
        min_aligned = tpl_score >= 7 and rs >= 70
    else:
        min_aligned = tpl_score <= 2 and rs <= 30

    # Kell aligned?
    if not is_short:
        kell_aligned = phase in ("EMA Crossback", "Pop", "Base n Break")
    else:
        kell_aligned = phase in ("Red Light", "Wedge")

    if wein_aligned: frameworks_aligned += 1
    if min_aligned: frameworks_aligned += 1
    if kell_aligned: frameworks_aligned += 1

    if frameworks_aligned == 3:
        align_pts = 8
        breakdown.append("All 3 frameworks aligned = +8pts")
    elif frameworks_aligned == 2:
        align_pts = 5
        breakdown.append(f"2/3 frameworks aligned = +5pts")
    elif frameworks_aligned == 1:
        align_pts = 2
        breakdown.append(f"1/3 frameworks aligned = +2pts")
    else:
        align_pts = 0
        breakdown.append("No framework alignment = 0pts (DISQUALIFYING)")

    points += align_pts

    # Cap at 30
    points = min(30, points)

    return {
        "points": points,
        "max": 30,
        "breakdown": breakdown,
        "frameworksAligned": frameworks_aligned,
        "disqualified": frameworks_aligned <= 1,
    }


def score_options_edge(iv_rank: int, iv_verdict: str, expected_move_ratio: float,
                       theta_pct_of_premium: float, skew_verdict: str) -> dict:
    """
    Options Edge: 25 points max.
    IV environment, expected move vs breakeven, theta efficiency.
    """
    points = 0
    breakdown = []

    # IV environment (10 points)
    if iv_rank < 30 and skew_verdict != "overpaying_otm":
        iv_pts = 10
        breakdown.append(f"IV Rank {iv_rank}, no skew penalty = 10pts")
    elif iv_rank < 40:
        iv_pts = 8
        breakdown.append(f"IV Rank {iv_rank} = 8pts")
    elif iv_rank < 50:
        iv_pts = 5
        breakdown.append(f"IV Rank {iv_rank} moderate = 5pts")
    elif iv_rank < 70:
        iv_pts = 2
        breakdown.append(f"IV Rank {iv_rank} elevated = 2pts")
    else:
        iv_pts = 0
        breakdown.append(f"IV Rank {iv_rank} HIGH = 0pts (unfavorable)")
    points += iv_pts

    # Expected move vs breakeven (10 points)
    if expected_move_ratio >= 1.5:
        move_pts = 10
        breakdown.append(f"Expected move {expected_move_ratio:.1f}x breakeven = 10pts")
    elif expected_move_ratio >= 1.2:
        move_pts = 7
        breakdown.append(f"Expected move {expected_move_ratio:.1f}x breakeven = 7pts")
    elif expected_move_ratio >= 1.0:
        move_pts = 4
        breakdown.append(f"Expected move {expected_move_ratio:.1f}x breakeven = 4pts (marginal)")
    else:
        move_pts = 0
        breakdown.append(f"Expected move {expected_move_ratio:.1f}x breakeven = 0pts (UNFAVORABLE)")
    points += move_pts

    # Theta efficiency (5 points)
    if theta_pct_of_premium < 10:
        theta_pts = 5
        breakdown.append(f"Theta {theta_pct_of_premium:.0f}% of premium over hold = 5pts")
    elif theta_pct_of_premium < 15:
        theta_pts = 3
        breakdown.append(f"Theta {theta_pct_of_premium:.0f}% of premium = 3pts")
    elif theta_pct_of_premium < 25:
        theta_pts = 1
        breakdown.append(f"Theta {theta_pct_of_premium:.0f}% of premium = 1pt (high decay)")
    else:
        theta_pts = 0
        breakdown.append(f"Theta {theta_pct_of_premium:.0f}% of premium = 0pts (excessive decay)")
    points += theta_pts

    # Disqualifying: if IV unfavorable AND expected move < breakeven
    disqualified = (iv_rank >= 70 and expected_move_ratio < 1.0)

    return {
        "points": min(25, points),
        "max": 25,
        "breakdown": breakdown,
        "disqualified": disqualified,
    }


def score_timing_edge(phase: str, vcp_pivot: Optional[float], current_price: float,
                      vol_ratio: float, vol_avg50: float, volume_today: float) -> dict:
    """
    Timing Edge: 20 points max.
    Kell phase, VCP pivot proximity, volume confirmation.
    """
    points = 0
    breakdown = []

    # Kell phase (10 points)
    phase_scores = {
        "EMA Crossback": 10,
        "Pop": 10,
        "Base n Break": 7,
        "Reversal": 5,
        "Wedge": 3,
        "Extension": 0,
        "Red Light": 0,
    }
    phase_pts = phase_scores.get(phase, 0)
    points += phase_pts
    breakdown.append(f"Phase '{phase}' = {phase_pts}pts")

    # VCP pivot proximity (5 points)
    if vcp_pivot and current_price > 0:
        pct_from_pivot = abs(current_price / vcp_pivot - 1) * 100
        if pct_from_pivot <= 3:
            pivot_pts = 5
            breakdown.append(f"Within {pct_from_pivot:.1f}% of pivot ${vcp_pivot:.2f} = 5pts")
        elif pct_from_pivot <= 5:
            pivot_pts = 3
            breakdown.append(f"Within {pct_from_pivot:.1f}% of pivot = 3pts")
        elif pct_from_pivot <= 7:
            pivot_pts = 1
            breakdown.append(f"Within {pct_from_pivot:.1f}% of pivot = 1pt")
        else:
            pivot_pts = 0
            breakdown.append(f"{pct_from_pivot:.1f}% from pivot — no points")
    else:
        pivot_pts = 0
        breakdown.append("No VCP pivot defined = 0pts")
    points += pivot_pts

    # Volume confirmation (5 points)
    if vol_ratio >= 1.5:
        vol_pts = 5
        breakdown.append(f"Volume {vol_ratio:.1f}x average = 5pts (confirmed)")
    elif vol_ratio >= 1.2:
        vol_pts = 3
        breakdown.append(f"Volume {vol_ratio:.1f}x average = 3pts")
    elif vol_ratio >= 0.8:
        vol_pts = 1
        breakdown.append(f"Volume {vol_ratio:.1f}x average = 1pt (average)")
    else:
        vol_pts = 0
        breakdown.append(f"Volume {vol_ratio:.1f}x average = 0pts (dry)")
    points += vol_pts

    disqualified = (phase in ("Extension", "Red Light") and pivot_pts == 0)

    return {
        "points": min(20, points),
        "max": 20,
        "breakdown": breakdown,
        "disqualified": disqualified,
    }


def score_risk_quality(entry_price: float, stop_price: float, target1: float,
                       target2: float = 0, is_short: bool = False) -> dict:
    """
    Risk Quality: 15 points max.
    R:R ratio and stop tightness.
    """
    points = 0
    breakdown = []

    if entry_price <= 0:
        return {"points": 0, "max": 15, "breakdown": ["No entry price"], "disqualified": True}

    # Calculate risk
    if is_short:
        risk_pct = (stop_price / entry_price - 1) * 100 if stop_price > 0 else 10
        reward1 = (1 - target1 / entry_price) * 100 if target1 > 0 else 0
        reward2 = (1 - target2 / entry_price) * 100 if target2 > 0 else 0
    else:
        risk_pct = (1 - stop_price / entry_price) * 100 if stop_price > 0 else 10
        reward1 = (target1 / entry_price - 1) * 100 if target1 > 0 else 0
        reward2 = (target2 / entry_price - 1) * 100 if target2 > 0 else 0

    risk_pct = abs(risk_pct)
    best_reward = max(reward1, reward2) if reward2 > 0 else reward1
    rr_ratio = best_reward / risk_pct if risk_pct > 0 else 0

    # R:R scoring (10 points)
    if rr_ratio >= 4:
        rr_pts = 10
        breakdown.append(f"R:R {rr_ratio:.1f}:1 = 10pts (excellent)")
    elif rr_ratio >= 3:
        rr_pts = 7
        breakdown.append(f"R:R {rr_ratio:.1f}:1 = 7pts (good)")
    elif rr_ratio >= 2:
        rr_pts = 3
        breakdown.append(f"R:R {rr_ratio:.1f}:1 = 3pts (acceptable)")
    else:
        rr_pts = 0
        breakdown.append(f"R:R {rr_ratio:.1f}:1 = 0pts (poor)")
    points += rr_pts

    # Stop tightness (5 points)
    if risk_pct <= 5:
        stop_pts = 5
        breakdown.append(f"Stop {risk_pct:.1f}% from entry = 5pts (tight)")
    elif risk_pct <= 7:
        stop_pts = 3
        breakdown.append(f"Stop {risk_pct:.1f}% from entry = 3pts")
    elif risk_pct <= 10:
        stop_pts = 1
        breakdown.append(f"Stop {risk_pct:.1f}% from entry = 1pt (wide)")
    else:
        stop_pts = 0
        breakdown.append(f"Stop {risk_pct:.1f}% from entry = 0pts (too wide)")
    points += stop_pts

    return {
        "points": min(15, points),
        "max": 15,
        "breakdown": breakdown,
        "rrRatio": round(rr_ratio, 1),
        "riskPct": round(risk_pct, 1),
        "disqualified": rr_ratio < 1.5,
    }


def score_flow_confirmation(short_vol_ratio: float = 0.5, insider_buying: bool = False,
                            insider_selling: bool = False, unusual_call_vol: bool = False,
                            unusual_put_vol: bool = False, is_short: bool = False) -> dict:
    """
    Flow Confirmation: 10 points max.
    Dark pool, insider activity, unusual options flow.
    """
    points = 0
    breakdown = []

    if is_short:
        # For shorts: want high short volume, insider selling, put activity
        if short_vol_ratio >= 0.5:
            sp_pts = 4
            breakdown.append(f"Short vol {short_vol_ratio:.0%} HIGH = 4pts (bearish)")
        elif short_vol_ratio >= 0.4:
            sp_pts = 2
            breakdown.append(f"Short vol {short_vol_ratio:.0%} = 2pts")
        else:
            sp_pts = 0
            breakdown.append(f"Short vol {short_vol_ratio:.0%} low = 0pts (no short pressure)")
        points += sp_pts

        if insider_selling:
            points += 3
            breakdown.append("Insider selling = +3pts")
        elif not insider_buying:
            points += 1
            breakdown.append("No insider buying = +1pt")
        else:
            breakdown.append("Insider buying present = 0pts (conflicting)")

        if unusual_put_vol:
            points += 3
            breakdown.append("Unusual put activity = +3pts")
        else:
            breakdown.append("No unusual put activity = 0pts")
    else:
        # For longs: want low short volume, insider buying, call activity
        if short_vol_ratio < 0.4:
            sp_pts = 4
            breakdown.append(f"Short vol {short_vol_ratio:.0%} LOW = 4pts (bullish)")
        elif short_vol_ratio < 0.5:
            sp_pts = 2
            breakdown.append(f"Short vol {short_vol_ratio:.0%} = 2pts")
        else:
            sp_pts = 0
            breakdown.append(f"Short vol {short_vol_ratio:.0%} elevated = 0pts")
        points += sp_pts

        if insider_buying:
            points += 3
            breakdown.append("Insider buying = +3pts")
        elif not insider_selling:
            points += 1
            breakdown.append("No insider selling = +1pt")
        else:
            breakdown.append("Insider selling present = 0pts (red flag)")

        if unusual_call_vol:
            points += 3
            breakdown.append("Unusual call activity = +3pts")
        else:
            breakdown.append("No unusual options activity = 0pts")

    return {
        "points": min(8, points),
        "max": 8,
        "breakdown": breakdown,
        "disqualified": False,
    }


def score_macro_environment(macro_score: int = 5, event_imminent: bool = False,
                            sector_aligned: bool = True) -> dict:
    """
    Macro Environment: 5 points max (new component).
    FRED score (3pts) + no imminent event (1pt) + sector alignment (1pt).
    """
    points = 0
    breakdown = []

    # FRED macro score: 3pts
    if macro_score >= 8:
        points += 3
        breakdown.append(f"Macro TAILWIND ({macro_score}/10) = 3pts")
    elif macro_score >= 5:
        points += 2
        breakdown.append(f"Macro NEUTRAL ({macro_score}/10) = 2pts")
    elif macro_score >= 3:
        points += 1
        breakdown.append(f"Macro HEADWIND ({macro_score}/10) = 1pt")
    else:
        breakdown.append(f"Macro CRISIS ({macro_score}/10) = 0pts")

    # No imminent event: 1pt
    if not event_imminent:
        points += 1
        breakdown.append("No major event within 48h = 1pt")
    else:
        breakdown.append("Major event imminent = 0pts (hold off)")

    # Sector alignment: 1pt
    if sector_aligned:
        points += 1
        breakdown.append("Sector macro-aligned = 1pt")
    else:
        breakdown.append("Sector headwind = 0pts")

    return {
        "points": min(5, points),
        "max": 5,
        "breakdown": breakdown,
        "disqualified": False,
    }


# ─────────────────────────────────────────────────────────
# FULL GRADE CALCULATION
# ─────────────────────────────────────────────────────────

def grade_trade(
    # Directional
    conv_score: int, conv_max: int, conv_zone: str,
    wein_stage: str, tpl_score: int, rs: int,
    phase: str, ema_d: str, ema_w: str, ema_m: str,
    # Options
    iv_rank: int = 50, iv_verdict: str = "NEUTRAL",
    expected_move_ratio: float = 1.0,
    theta_pct_of_premium: float = 15.0,
    skew_verdict: str = "neutral",
    # Timing
    vcp_pivot: Optional[float] = None, current_price: float = 0,
    vol_ratio: float = 1.0, vol_avg50: float = 0, volume_today: float = 0,
    # Risk
    stop_price: float = 0, target1: float = 0, target2: float = 0,
    # Flow
    short_vol_ratio: float = 0.5, insider_buying: bool = False,
    insider_selling: bool = False, unusual_call_vol: bool = False,
    unusual_put_vol: bool = False,
    # Macro (new)
    macro_score: int = 5, event_imminent: bool = False,
    sector_aligned: bool = True,
    # Qullamaggie dual convergence
    qullamaggie_breakout_score: int = 0,
    # Meta
    is_short: bool = False,
) -> dict:
    """
    Full 100-point trade grading.
    Returns grade, score, component breakdown, and tradability assessment.
    """

    # Score each component
    directional = score_directional_edge(
        conv_score, conv_max, conv_zone, wein_stage, tpl_score, rs,
        phase, ema_d, ema_w, ema_m, is_short)

    options = score_options_edge(
        iv_rank, iv_verdict, expected_move_ratio,
        theta_pct_of_premium, skew_verdict)

    timing = score_timing_edge(
        phase, vcp_pivot, current_price, vol_ratio, vol_avg50, volume_today)

    # Auto-calculate stop and targets if not provided
    if stop_price == 0 and current_price > 0:
        if is_short:
            stop_price = current_price * 1.07
            target1 = current_price * 0.85 if target1 == 0 else target1
            target2 = current_price * 0.75 if target2 == 0 else target2
        else:
            stop_price = current_price * 0.93
            if vcp_pivot:
                stop_price = vcp_pivot * 0.97
            target1 = current_price * 1.15 if target1 == 0 else target1
            target2 = current_price * 1.25 if target2 == 0 else target2

    risk = score_risk_quality(current_price, stop_price, target1, target2, is_short)

    flow = score_flow_confirmation(
        short_vol_ratio, insider_buying, insider_selling,
        unusual_call_vol, unusual_put_vol, is_short)

    macro = score_macro_environment(macro_score, event_imminent, sector_aligned)

    # Raw total: Directional=30, Options=25, Timing=20, Risk=15, Flow=8, Macro=5 = 103
    raw_total = directional["points"] + options["points"] + timing["points"] + risk["points"] + flow["points"] + macro["points"]
    raw_max = directional["max"] + options["max"] + timing["max"] + risk["max"] + flow["max"] + macro["max"]

    # Qullamaggie Dual Convergence bonus (+5 points to raw total)
    dual_convergence = False
    dual_bonus = 0
    if qullamaggie_breakout_score >= 70 and conv_score >= 20:
        dual_convergence = True
        dual_bonus = 5
        raw_total += dual_bonus

    # Normalize to 100
    total = round(raw_total / max(raw_max, 1) * 100)

    # Check for disqualifying conditions
    disqualified = False
    disqualify_reasons = []
    if directional.get("disqualified"):
        disqualified = True
        disqualify_reasons.append("Insufficient framework alignment")
    if options.get("disqualified"):
        disqualified = True
        disqualify_reasons.append("IV environment + expected move unfavorable")
    if timing.get("disqualified"):
        disqualified = True
        disqualify_reasons.append("No entry timing — chasing or no defined entry")

    if disqualified:
        total = min(total, 59)  # Cap at BB

    grade_info = score_to_grade(total)

    dual_label = " + DUAL CONVERGENCE (+5)" if dual_convergence else ""
    return {
        "totalScore": total,
        "maxScore": 100,
        "rawTotal": raw_total,
        "rawMax": raw_max,
        **grade_info,
        "components": {
            "directional": directional,
            "options": options,
            "timing": timing,
            "risk": risk,
            "flow": flow,
            "macro": macro,
        },
        "dualConvergence": dual_convergence,
        "dualConvergenceBonus": dual_bonus,
        "disqualified": disqualified,
        "disqualifyReasons": disqualify_reasons,
        "summary": f"Dir: {directional['points']}/{directional['max']} | Opt: {options['points']}/{options['max']} | Tim: {timing['points']}/{timing['max']} | Risk: {risk['points']}/{risk['max']} | Flow: {flow['points']}/{flow['max']} | Macro: {macro['points']}/{macro['max']}{dual_label} = {total}/100 = {grade_info['grade']}",
        "stopPrice": round(stop_price, 2),
        "target1": round(target1, 2),
        "target2": round(target2, 2),
        "rrRatio": risk.get("rrRatio", 0),
    }
```

## 3b-3d. Weinstein Stage, Minervini Template, Kell Phase Detection

These are all implemented within backend/main.py (already fully included in Section 2g above). Key functions:
- `detect_weinstein_stage()` — Weinstein 30-week MA stage detection
- `check_minervini_template()` — Minervini trend template 8-point check
- `detect_kell_phase()` — Kell EMA phase detection
- `detect_vcp()` — VCP (Volatility Contraction Pattern) detection
- `compute_convergence_score()` — 23-point convergence scoring

## 3e. Qullamaggie Setup Detection (backend/qullamaggie.py) — Full Contents

```python
"""
Qullamaggie Momentum Setup Scanner
Three timeless setups: Breakouts, Parabolic Shorts/Longs, Episodic Pivots.
Runs alongside the MKW convergence system as a high-resolution entry timing layer.
"""

import logging
import pandas as pd
import numpy as np

log = logging.getLogger("mkw.qullamaggie")


# ─────────────────────────────────────────────
# SETUP 1: BREAKOUT SCANNER
# ─────────────────────────────────────────────

def scan_breakouts(ticker, daily_df):
    """
    Qullamaggie Breakout Scanner

    Conditions (ALL must be true):
    1. Big prior move: Price gained 30%+ in the past 60 trading days
    2. Orderly pullback: After the move, price pulled back 10-35% from high
    3. Higher lows: At least 2 higher lows in the pullback (constructive)
    4. Tight consolidation: ADR% in last 5 days < 20-day average ADR%
    5. Range expansion trigger: Today's high exceeds consolidation high on volume
    6. Volume confirmation: Today's volume > 1.5x the 50-day average
    7. Price above key MAs: Price > 10 SMA > 20 SMA (both rising)
    """
    try:
        close = daily_df['Close']
        high = daily_df['High']
        low = daily_df['Low']
        volume = daily_df['Volume']

        if len(close) < 65:
            return None

        current_price = float(close.iloc[-1])

        # 1. Big prior move (30%+ in 60 days)
        price_60d_ago = float(close.iloc[-60])
        move_pct = ((current_price - price_60d_ago) / price_60d_ago) * 100 if price_60d_ago > 0 else 0
        has_big_move = move_pct >= 30

        # 2. Orderly pullback
        recent_high = float(high.tail(60).max())
        recent_high_idx = high.tail(60).idxmax()
        pullback_slice = low.loc[recent_high_idx:]
        pullback_low = float(pullback_slice.min()) if len(pullback_slice) > 0 else current_price
        pullback_depth = ((recent_high - pullback_low) / recent_high) * 100 if recent_high > 0 else 0
        orderly_pullback = 10 <= pullback_depth <= 35

        # 3. Higher lows detection (last 20 bars, windowed)
        recent_lows = []
        window = 5
        for i in range(-20, -window, window):
            end = min(i + window, -1)
            if abs(i) <= len(low) and abs(end) <= len(low):
                segment_low = float(low.iloc[i:i + window].min())
                recent_lows.append(segment_low)
        higher_lows = (all(recent_lows[i] <= recent_lows[i + 1]
                           for i in range(len(recent_lows) - 1))
                       if len(recent_lows) >= 2 else False)

        # 4. Tight consolidation (ADR contracting)
        adr_pct = ((high - low) / close * 100)
        adr_5d = float(adr_pct.tail(5).mean())
        adr_20d = float(adr_pct.tail(20).mean())
        tight_action = adr_5d < adr_20d if adr_20d > 0 else False

        # 5. Range expansion
        consolidation_high = float(high.tail(10).max())
        breaking_out = current_price >= consolidation_high * 0.995

        # 6. Volume surge
        avg_vol_50 = float(volume.tail(50).mean()) if len(volume) >= 50 else float(volume.mean())
        today_vol = float(volume.iloc[-1])
        volume_surge = today_vol > avg_vol_50 * 1.5 if avg_vol_50 > 0 else False
        vol_ratio = round(today_vol / avg_vol_50, 1) if avg_vol_50 > 0 else 0

        # 7. Above key MAs (rising)
        sma_10 = float(close.rolling(10).mean().iloc[-1])
        sma_20 = float(close.rolling(20).mean().iloc[-1])
        above_mas = current_price > sma_10 > sma_20
        sma_10_prev = float(close.rolling(10).mean().iloc[-5]) if len(close) >= 15 else sma_10
        sma_20_prev = float(close.rolling(20).mean().iloc[-5]) if len(close) >= 25 else sma_20
        mas_rising = sma_10 > sma_10_prev and sma_20 > sma_20_prev

        # Quality Score (0-100)
        score = 0
        if has_big_move:
            score += 20
        if move_pct >= 50:
            score += 5
        if orderly_pullback:
            score += 15
        if pullback_depth <= 20:
            score += 5
        if higher_lows:
            score += 15
        if tight_action:
            score += 15
        if adr_20d > 0 and adr_5d < adr_20d * 0.7:
            score += 5
        if breaking_out:
            score += 10
        if volume_surge:
            score += 10
        if avg_vol_50 > 0 and today_vol > avg_vol_50 * 2:
            score += 5
        if above_mas and mas_rising:
            score += 5

        passed = (has_big_move and orderly_pullback and higher_lows
                  and tight_action and above_mas)

        adr_contraction = round((adr_5d / adr_20d) * 100, 1) if adr_20d > 0 else 100

        return {
            'setup': 'BREAKOUT',
            'passed': passed,
            'triggering': breaking_out and volume_surge,
            'score': min(score, 100),
            'prior_move_pct': round(move_pct, 1),
            'pullback_depth_pct': round(pullback_depth, 1),
            'higher_lows': higher_lows,
            'adr_contraction': adr_contraction,
            'volume_ratio': vol_ratio,
            'consolidation_high': round(consolidation_high, 2),
            'sma_10': round(sma_10, 2),
            'sma_20': round(sma_20, 2),
            'detail': (
                f"Prior move +{move_pct:.0f}% in 60d. Pullback {pullback_depth:.0f}%. "
                f"ADR contracting to {adr_contraction:.0f}% of normal. "
                + (f"TRIGGERING — breakout on {vol_ratio}x volume"
                   if breaking_out and volume_surge
                   else "Consolidating — watch for range expansion")
            ),
        }
    except Exception as e:
        log.warning(f"scan_breakouts({ticker}): {e}")
        return None


# ─────────────────────────────────────────────
# SETUP 2: PARABOLIC SHORT/LONG (RUBBER BAND)
# ─────────────────────────────────────────────

def scan_parabolic(ticker, daily_df, market_cap=None):
    """
    Qullamaggie Parabolic Scanner (Short and Long side)

    SHORT: Massive surge (50-100%+ large cap, 300%+ small cap), 3-5+ consecutive
    up days, extended 30%+ from 10 SMA, volume climax, first crack.

    LONG BOUNCE: Inverse — oversold stocks snapping back after capitulation.
    """
    try:
        close = daily_df['Close']
        high = daily_df['High']
        low = daily_df['Low']
        volume = daily_df['Volume']

        if len(close) < 25:
            return None

        current_price = float(close.iloc[-1])

        is_large_cap = market_cap and market_cap > 10_000_000_000
        surge_threshold = 50 if is_large_cap else 200

        # 1. Massive recent surge across multiple windows
        moves = {}
        for window in [5, 10, 20]:
            if len(close) >= window + 1:
                price_then = float(close.iloc[-(window + 1)])
                pct_move = ((current_price - price_then) / price_then) * 100 if price_then > 0 else 0
                moves[f'{window}d'] = pct_move

        best_window = max(moves, key=moves.get) if moves else None
        best_move = moves.get(best_window, 0) if best_window else 0
        has_surge = best_move >= surge_threshold

        # 2. Consecutive up days
        consecutive_up = 0
        for i in range(-1, -min(len(close), 15), -1):
            if float(close.iloc[i]) > float(close.iloc[i - 1]):
                consecutive_up += 1
            else:
                break
        many_up_days = consecutive_up >= 3

        # 3. Extended from 10-day SMA
        sma_10 = float(close.rolling(10).mean().iloc[-1])
        sma_20 = float(close.rolling(20).mean().iloc[-1])
        extension_from_10 = ((current_price - sma_10) / sma_10) * 100 if sma_10 > 0 else 0
        extension_from_20 = ((current_price - sma_20) / sma_20) * 100 if sma_20 > 0 else 0
        is_extended = extension_from_10 >= 30

        # 4. Volume climax
        avg_vol = float(volume.tail(50).mean()) if len(volume) >= 50 else float(volume.mean())
        recent_vol = float(volume.tail(3).mean())
        vol_climax = recent_vol > avg_vol * 3 if avg_vol > 0 else False

        # 5. First crack (bearish reversal signal)
        today_red = float(close.iloc[-1]) < float(close.iloc[-2]) if len(close) >= 2 else False
        today_high_rejection = ((float(high.iloc[-1]) - float(close.iloc[-1])) >
                                (float(close.iloc[-1]) - float(low.iloc[-1]))) if len(high) >= 1 else False
        first_crack = today_red or today_high_rejection

        # SHORT quality score
        short_score = 0
        if has_surge:
            short_score += 25
        if best_move >= surge_threshold * 1.5:
            short_score += 10
        if many_up_days:
            short_score += 15
        if consecutive_up >= 5:
            short_score += 10
        if is_extended:
            short_score += 15
        if vol_climax:
            short_score += 10
        if first_crack:
            short_score += 15

        # LONG side (oversold bounce)
        recent_peak = float(high.tail(30).max())
        decline_pct = ((current_price - recent_peak) / recent_peak) * 100 if recent_peak > 0 else 0
        oversold = decline_pct <= -30

        consecutive_down = 0
        for i in range(-1, -min(len(close), 15), -1):
            if float(close.iloc[i]) < float(close.iloc[i - 1]):
                consecutive_down += 1
            else:
                break

        long_bounce = oversold and consecutive_down >= 3
        today_green = float(close.iloc[-1]) > float(close.iloc[-2]) if len(close) >= 2 else False

        long_score = 0
        if oversold:
            long_score += 20
        if decline_pct <= -50:
            long_score += 10
        if consecutive_down >= 3:
            long_score += 15
        if consecutive_down >= 5:
            long_score += 10
        if today_green:
            long_score += 15
        if avg_vol > 0 and float(volume.iloc[-1]) > avg_vol * 2:
            long_score += 15

        vol_ratio = round(recent_vol / avg_vol, 1) if avg_vol > 0 else 0

        # Build detail text
        if has_surge and many_up_days and is_extended:
            detail = (
                f"SHORT: Up {best_move:.0f}% in {best_window}. {consecutive_up} consecutive up days. "
                f"Extended {extension_from_10:.0f}% from 10 SMA. "
                + ("FIRST CRACK detected — entry zone" if first_crack
                   else "Still running — wait for crack")
            )
        elif long_bounce:
            detail = (
                f"LONG BOUNCE: Down {abs(decline_pct):.0f}% from peak. {consecutive_down} down days. "
                + ("First green day — potential bounce entry" if today_green
                   else "Still declining")
            )
        else:
            detail = "No parabolic setup detected"

        return {
            'setup': 'PARABOLIC',
            'short_setup': has_surge and many_up_days and is_extended,
            'short_triggering': has_surge and many_up_days and is_extended and first_crack,
            'short_score': min(short_score, 100),
            'long_bounce': long_bounce,
            'long_triggering': long_bounce and today_green,
            'long_score': min(long_score, 100),
            'surge_pct': round(best_move, 1),
            'surge_window': best_window,
            'consecutive_up': consecutive_up,
            'consecutive_down': consecutive_down,
            'extension_from_10sma': round(extension_from_10, 1),
            'extension_from_20sma': round(extension_from_20, 1),
            'volume_ratio': vol_ratio,
            'first_crack': first_crack,
            'sma_10': round(sma_10, 2),
            'sma_20': round(sma_20, 2),
            'decline_pct': round(decline_pct, 1) if oversold else None,
            'detail': detail,
        }
    except Exception as e:
        log.warning(f"scan_parabolic({ticker}): {e}")
        return None


# ─────────────────────────────────────────────
# SETUP 3: EPISODIC PIVOT (EP) SCANNER
# ─────────────────────────────────────────────

def scan_episodic_pivot(ticker, daily_df, fundamentals=None):
    """
    Qullamaggie Episodic Pivot Scanner

    Conditions:
    1. Big price move: Gap up or surge of 10%+ in a single day
    2. Big volume: Today's volume > 3x 50-day average
    3. Prior neglect: Stock was flat or down for 3-6 months before
    4. Catalyst: Detected structurally via gap + volume + neglect
    5. Growth: If available, significant EPS beat
    """
    try:
        close = daily_df['Close']
        high = daily_df['High']
        low = daily_df['Low']
        volume = daily_df['Volume']

        if len(close) < 130:
            return None

        current_price = float(close.iloc[-1])
        prev_close = float(close.iloc[-2])

        # 1. Big single-day move
        day_move_pct = ((current_price - prev_close) / prev_close) * 100 if prev_close > 0 else 0
        gap_pct = ((float(daily_df['Open'].iloc[-1]) - prev_close) / prev_close) * 100 if prev_close > 0 else 0
        big_move = day_move_pct >= 10 or gap_pct >= 8

        # 2. Big volume
        avg_vol_50 = float(volume.tail(50).mean()) if len(volume) >= 50 else float(volume.mean())
        today_vol = float(volume.iloc[-1])
        vol_ratio = today_vol / avg_vol_50 if avg_vol_50 > 0 else 0
        big_volume = vol_ratio >= 3

        # 3. Prior neglect (flat or down for 3 months)
        price_90d_ago = float(close.iloc[-90]) if len(close) >= 90 else float(close.iloc[0])
        prior_3mo_move = ((prev_close - price_90d_ago) / price_90d_ago) * 100 if price_90d_ago > 0 else 0
        was_neglected = prior_3mo_move <= 10

        price_130d_ago = float(close.iloc[-130]) if len(close) >= 130 else float(close.iloc[0])
        prior_6mo_move = ((prev_close - price_130d_ago) / price_130d_ago) * 100 if price_130d_ago > 0 else 0
        was_in_downtrend = prior_6mo_move <= 0
        was_sideways = abs(prior_3mo_move) <= 15

        # 4. Catalyst detection (structural proxy)
        likely_catalyst = big_move and vol_ratio >= 5 and was_neglected

        # 5. Growth check
        has_growth = True
        eps_beat = None
        if fundamentals:
            eps_growth = fundamentals.get('eps_growth_yoy') or fundamentals.get('eps', 0)
            if eps_growth is not None:
                has_growth = eps_growth > 20
                eps_beat = eps_growth

        # Quality Score
        score = 0
        if big_move:
            score += 15
        if day_move_pct >= 15:
            score += 5
        if day_move_pct >= 20:
            score += 5
        if gap_pct >= 10:
            score += 5
        if big_volume:
            score += 15
        if vol_ratio >= 5:
            score += 5
        if vol_ratio >= 10:
            score += 5
        if was_neglected:
            score += 15
        if was_in_downtrend:
            score += 5
        if was_sideways:
            score += 5
        if likely_catalyst:
            score += 10
        if has_growth:
            score += 10

        passed = big_move and big_volume and was_neglected

        sma_10 = float(close.rolling(10).mean().iloc[-1])
        sma_20 = float(close.rolling(20).mean().iloc[-1])

        if passed:
            detail = (
                f"EP DETECTED: +{day_move_pct:.0f}% today on {vol_ratio:.0f}x volume. "
                f"Prior 3mo: {prior_3mo_move:+.0f}% ({'neglected' if was_neglected else 'active'}). "
                + (f"Gap +{gap_pct:.1f}%" if gap_pct >= 5 else "Rally") + ". "
                + ("Likely earnings catalyst" if likely_catalyst
                   else "Monitor for catalyst confirmation")
            )
        else:
            detail = "No Episodic Pivot detected"

        return {
            'setup': 'EPISODIC_PIVOT',
            'passed': passed,
            'triggering': passed,  # EPs trigger on the day they happen
            'score': min(score, 100),
            'day_move_pct': round(day_move_pct, 1),
            'gap_pct': round(gap_pct, 1),
            'volume_ratio': round(vol_ratio, 1),
            'prior_3mo_pct': round(prior_3mo_move, 1),
            'prior_6mo_pct': round(prior_6mo_move, 1),
            'was_neglected': was_neglected,
            'was_downtrend': was_in_downtrend,
            'was_sideways': was_sideways,
            'likely_catalyst': likely_catalyst,
            'eps_beat': eps_beat,
            'sma_10': round(sma_10, 2),
            'sma_20': round(sma_20, 2),
            'detail': detail,
        }
    except Exception as e:
        log.warning(f"scan_episodic_pivot({ticker}): {e}")
        return None


# ─────────────────────────────────────────────
# SINGLE-TICKER ANALYSIS
# ─────────────────────────────────────────────

def analyze_qullamaggie(ticker, daily_df, fundamentals=None, market_cap=None):
    """
    Run all three Qullamaggie scanners on a single ticker.
    Returns a dict with results for each setup type + best setup.
    """
    result = {
        'ticker': ticker,
        'breakout': None,
        'parabolic': None,
        'episodic_pivot': None,
        'best_setup': None,
        'best_score': 0,
        'any_setup': False,
        'any_triggering': False,
        'setups_summary': [],
    }

    # Breakout scan
    bo = scan_breakouts(ticker, daily_df)
    if bo:
        result['breakout'] = bo
        if bo['passed']:
            result['setups_summary'].append({
                'type': 'BREAKOUT',
                'score': bo['score'],
                'triggering': bo['triggering'],
                'detail': bo['detail'],
            })
            if bo['score'] > result['best_score']:
                result['best_score'] = bo['score']
                result['best_setup'] = 'BREAKOUT'

    # Parabolic scan
    para = scan_parabolic(ticker, daily_df, market_cap=market_cap)
    if para:
        result['parabolic'] = para
        if para['short_setup']:
            result['setups_summary'].append({
                'type': 'PARABOLIC_SHORT',
                'score': para['short_score'],
                'triggering': para['short_triggering'],
                'detail': para['detail'],
            })
            if para['short_score'] > result['best_score']:
                result['best_score'] = para['short_score']
                result['best_setup'] = 'PARABOLIC_SHORT'
        if para['long_bounce']:
            result['setups_summary'].append({
                'type': 'PARABOLIC_LONG',
                'score': para['long_score'],
                'triggering': para['long_triggering'],
                'detail': para['detail'],
            })
            if para['long_score'] > result['best_score']:
                result['best_score'] = para['long_score']
                result['best_setup'] = 'PARABOLIC_LONG'

    # Episodic Pivot scan
    ep = scan_episodic_pivot(ticker, daily_df, fundamentals=fundamentals)
    if ep:
        result['episodic_pivot'] = ep
        if ep['passed']:
            result['setups_summary'].append({
                'type': 'EPISODIC_PIVOT',
                'score': ep['score'],
                'triggering': ep['triggering'],
                'detail': ep['detail'],
            })
            if ep['score'] > result['best_score']:
                result['best_score'] = ep['score']
                result['best_setup'] = 'EPISODIC_PIVOT'

    result['any_setup'] = len(result['setups_summary']) > 0
    result['any_triggering'] = any(s['triggering'] for s in result['setups_summary'])

    return result


# ─────────────────────────────────────────────
# MASTER SCANNER (FULL UNIVERSE)
# ─────────────────────────────────────────────

def run_qullamaggie_scan(universe, daily_data_dict, fundamentals_dict=None):
    """
    Run all three Qullamaggie scanners across the universe.
    Returns categorized results sorted by quality score.
    """
    results = {
        'breakouts': [],
        'parabolic_shorts': [],
        'parabolic_longs': [],
        'episodic_pivots': [],
        'all_setups': [],
        'total_scanned': 0,
        'total_with_setup': 0,
    }

    for ticker in universe:
        df = daily_data_dict.get(ticker)
        if df is None or df.empty:
            continue

        results['total_scanned'] += 1
        fund = fundamentals_dict.get(ticker, {}) if fundamentals_dict else {}
        mcap = fund.get('market_cap') or fund.get('marketCap', 0)

        analysis = analyze_qullamaggie(ticker, df, fundamentals=fund, market_cap=mcap)

        if not analysis['any_setup']:
            continue

        results['total_with_setup'] += 1

        # Categorize
        bo = analysis['breakout']
        if bo and bo['passed']:
            bo['ticker'] = ticker
            results['breakouts'].append(bo)

        para = analysis['parabolic']
        if para:
            if para['short_setup']:
                results['parabolic_shorts'].append({**para, 'ticker': ticker})
            if para['long_bounce']:
                results['parabolic_longs'].append({**para, 'ticker': ticker})

        ep = analysis['episodic_pivot']
        if ep and ep['passed']:
            ep['ticker'] = ticker
            results['episodic_pivots'].append(ep)

        # All setups flat list for the master view
        for setup in analysis['setups_summary']:
            results['all_setups'].append({
                'ticker': ticker,
                **setup,
            })

    # Sort each by score descending
    results['breakouts'].sort(key=lambda x: x.get('score', 0), reverse=True)
    results['parabolic_shorts'].sort(key=lambda x: x.get('short_score', 0), reverse=True)
    results['parabolic_longs'].sort(key=lambda x: x.get('long_score', 0), reverse=True)
    results['episodic_pivots'].sort(key=lambda x: x.get('score', 0), reverse=True)
    results['all_setups'].sort(key=lambda x: x.get('score', 0), reverse=True)

    return results


# ─────────────────────────────────────────────
# DUAL CONVERGENCE DETECTION
# ─────────────────────────────────────────────

def check_dual_convergence(mkw_conv_score, mkw_conv_max, qull_breakout_score):
    """
    Check if a stock qualifies for DUAL CONVERGENCE:
    MKW convergence score >= 20 AND Qullamaggie breakout score >= 70.
    Returns bonus points and classification.
    """
    mkw_pct = (mkw_conv_score / mkw_conv_max * 100) if mkw_conv_max > 0 else 0
    is_dual = mkw_pct >= 87 and qull_breakout_score >= 70  # ~20/23

    return {
        'is_dual_convergence': is_dual,
        'bonus_points': 5 if is_dual else 0,
        'label': 'DUAL CONVERGENCE' if is_dual else None,
        'mkw_score': mkw_conv_score,
        'qull_score': qull_breakout_score,
    }


# ─────────────────────────────────────────────
# SETUP ARCHIVE (Evernote equivalent)
# ─────────────────────────────────────────────

import json
import os

ARCHIVE_FILE = "/tmp/mkw_qull_archive.json"


def _load_archive() -> list:
    try:
        if os.path.exists(ARCHIVE_FILE):
            with open(ARCHIVE_FILE) as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
    except Exception:
        pass
    return []


def _save_archive(entries: list):
    try:
        with open(ARCHIVE_FILE, "w") as f:
            json.dump(entries, f, indent=2, default=str)
    except Exception as e:
        log.warning(f"Archive save error: {e}")


def archive_setup(entry: dict) -> dict:
    """Add a setup to the historical archive."""
    import uuid
    from datetime import datetime

    entries = _load_archive()
    record = {
        "id": str(uuid.uuid4()),
        "ticker": entry.get("ticker", "").upper(),
        "setup_type": entry.get("setup_type", ""),
        "date": entry.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
        "quality_score": entry.get("quality_score", 0),
        "entry": entry.get("entry"),
        "stop": entry.get("stop"),
        "result": entry.get("result"),  # WIN / LOSS / OPEN
        "r_multiple": entry.get("r_multiple"),
        "hold_days": entry.get("hold_days"),
        "screenshot_note": entry.get("screenshot_note", ""),
        "lessons": entry.get("lessons", ""),
        "created_at": datetime.utcnow().isoformat(),
    }
    entries.append(record)
    _save_archive(entries)
    return record


def get_archive(setup_type: str = "", ticker: str = "", limit: int = 100) -> list:
    """Retrieve archived setups with optional filters."""
    entries = _load_archive()
    if setup_type:
        entries = [e for e in entries if e.get("setup_type", "").upper() == setup_type.upper()]
    if ticker:
        entries = [e for e in entries if e.get("ticker", "").upper() == ticker.upper()]
    entries.sort(key=lambda x: x.get("date", ""), reverse=True)
    return entries[:limit]


def archive_analytics() -> dict:
    """Performance analytics by setup type from the archive."""
    entries = _load_archive()
    closed = [e for e in entries if e.get("result") in ("WIN", "LOSS")]

    if not closed:
        return {"message": "No completed setups in archive yet.", "total": len(entries)}

    by_type = {}
    for e in closed:
        stype = e.get("setup_type", "UNKNOWN")
        if stype not in by_type:
            by_type[stype] = {"wins": 0, "losses": 0, "r_wins": [], "r_losses": []}
        if e["result"] == "WIN":
            by_type[stype]["wins"] += 1
            if e.get("r_multiple"):
                by_type[stype]["r_wins"].append(float(e["r_multiple"]))
        else:
            by_type[stype]["losses"] += 1
            if e.get("r_multiple"):
                by_type[stype]["r_losses"].append(float(e["r_multiple"]))

    analytics = {}
    for stype, data in by_type.items():
        total = data["wins"] + data["losses"]
        win_rate = round(data["wins"] / total * 100, 1) if total > 0 else 0
        avg_winner = round(sum(data["r_wins"]) / len(data["r_wins"]), 1) if data["r_wins"] else 0
        avg_loser = round(sum(data["r_losses"]) / len(data["r_losses"]), 1) if data["r_losses"] else 0
        expectancy = round(
            (win_rate / 100 * avg_winner) + ((1 - win_rate / 100) * avg_loser), 2
        ) if total > 0 else 0

        analytics[stype] = {
            "trades": total,
            "win_rate": win_rate,
            "avg_winner_r": avg_winner,
            "avg_loser_r": avg_loser,
            "expectancy_r": expectancy,
        }

    return {"by_setup_type": analytics, "total_archived": len(entries), "total_closed": len(closed)}
```

## 3f. Technical Indicator Calculations (backend/indicators.py) — Full Contents

```python
"""
Qullamaggie Indicators — Technical indicators needed for momentum setups.
ADR, volume surge, consecutive days, extension from MAs, consolidation detection.
"""

import logging
import pandas as pd
import numpy as np

log = logging.getLogger("mkw.indicators")


def calculate_qullamaggie_indicators(daily_df):
    """
    Calculate all indicators needed for Qullamaggie momentum setups.
    Returns a copy of the DataFrame with additional indicator columns.
    """
    if daily_df is None or len(daily_df) < 20:
        return daily_df

    try:
        df = daily_df.copy()
        close = df['Close']
        high = df['High']
        low = df['Low']
        volume = df['Volume']

        # ── Moving Averages ──
        df['SMA_10'] = close.rolling(10).mean()
        df['SMA_20'] = close.rolling(20).mean()
        df['EMA_10'] = close.ewm(span=10).mean()
        df['EMA_20'] = close.ewm(span=20).mean()

        # ── ATR (Average True Range, 14-period) ──
        tr = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs()
        ], axis=1).max(axis=1)
        df['ATR_14'] = tr.rolling(14).mean()

        # ── ADR% (Average Daily Range as % of price) ──
        df['ADR_pct'] = (high - low) / close * 100
        df['ADR_5d'] = df['ADR_pct'].rolling(5).mean()
        df['ADR_20d'] = df['ADR_pct'].rolling(20).mean()
        df['ADR_contracting'] = df['ADR_5d'] < df['ADR_20d']

        # ── Gap % (today's open vs yesterday's close) ──
        df['Gap_pct'] = (df['Open'] - close.shift(1)) / close.shift(1) * 100

        # ── Volume Surge Detection ──
        df['Vol_50d_avg'] = volume.rolling(50).mean()
        df['Vol_ratio'] = volume / df['Vol_50d_avg'].replace(0, np.nan)
        df['Vol_surge'] = df['Vol_ratio'] > 1.5
        df['Vol_climax'] = df['Vol_ratio'] > 3

        # ── Consecutive Up/Down Days Counter ──
        changes = close.diff()
        up_streak = []
        down_streak = []
        u, d = 0, 0
        for chg in changes:
            if pd.isna(chg):
                up_streak.append(0)
                down_streak.append(0)
                continue
            if chg > 0:
                u += 1
                d = 0
            elif chg < 0:
                d += 1
                u = 0
            else:
                u = 0
                d = 0
            up_streak.append(u)
            down_streak.append(d)
        df['Consecutive_up'] = up_streak
        df['Consecutive_down'] = down_streak

        # ── Prior Move % (multi-period lookback) ──
        df['Move_21d_pct'] = close.pct_change(21) * 100
        df['Move_42d_pct'] = close.pct_change(42) * 100
        df['Move_63d_pct'] = close.pct_change(63) * 100

        # ── Extension from MAs ──
        df['Ext_from_10SMA'] = (close - df['SMA_10']) / df['SMA_10'] * 100
        df['Ext_from_20SMA'] = (close - df['SMA_20']) / df['SMA_20'] * 100

        # ── Consolidation Range (10-bar high/low) ──
        df['Consol_high_10'] = high.rolling(10).max()
        df['Consol_low_10'] = low.rolling(10).min()
        df['Consol_range_pct'] = (df['Consol_high_10'] - df['Consol_low_10']) / close * 100

        return df
    except Exception as e:
        log.warning(f"calculate_qullamaggie_indicators error: {e}")
        return daily_df


def get_qullamaggie_snapshot(daily_df):
    """
    Return a dict snapshot of the latest Qullamaggie indicator values.
    Useful for API responses without returning the full DataFrame.
    """
    df = calculate_qullamaggie_indicators(daily_df)
    if df is None or len(df) < 20:
        return {}

    try:
        last = df.iloc[-1]
        return {
            'sma_10': _safe_round(last.get('SMA_10')),
            'sma_20': _safe_round(last.get('SMA_20')),
            'ema_10': _safe_round(last.get('EMA_10')),
            'ema_20': _safe_round(last.get('EMA_20')),
            'atr_14': _safe_round(last.get('ATR_14')),
            'adr_pct': _safe_round(last.get('ADR_pct'), 2),
            'adr_5d': _safe_round(last.get('ADR_5d'), 2),
            'adr_20d': _safe_round(last.get('ADR_20d'), 2),
            'adr_contracting': bool(last.get('ADR_contracting', False)),
            'gap_pct': _safe_round(last.get('Gap_pct'), 2),
            'vol_ratio': _safe_round(last.get('Vol_ratio'), 1),
            'vol_surge': bool(last.get('Vol_surge', False)),
            'vol_climax': bool(last.get('Vol_climax', False)),
            'consecutive_up': int(last.get('Consecutive_up', 0)),
            'consecutive_down': int(last.get('Consecutive_down', 0)),
            'move_21d_pct': _safe_round(last.get('Move_21d_pct'), 1),
            'move_42d_pct': _safe_round(last.get('Move_42d_pct'), 1),
            'move_63d_pct': _safe_round(last.get('Move_63d_pct'), 1),
            'ext_from_10sma': _safe_round(last.get('Ext_from_10SMA'), 1),
            'ext_from_20sma': _safe_round(last.get('Ext_from_20SMA'), 1),
            'consol_high_10': _safe_round(last.get('Consol_high_10')),
            'consol_low_10': _safe_round(last.get('Consol_low_10')),
            'consol_range_pct': _safe_round(last.get('Consol_range_pct'), 1),
        }
    except Exception as e:
        log.warning(f"get_qullamaggie_snapshot error: {e}")
        return {}


def _safe_round(val, decimals=2):
    """Safely round a value, handling NaN/None."""
    if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
        return 0.0
    try:
        return round(float(val), decimals)
    except (TypeError, ValueError):
        return 0.0
```

## 3f (cont). Frontend Scoring Engine (src/challenge/engine/scoring.js) — Full Contents

```js
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
```

## 3f (cont). Frontend Analysis Engine (src/challenge/engine/analysis.js) — Full Contents

```js
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
```

## 3f (cont). Frontend Detection Engine (src/challenge/engine/detection.js) — Full Contents

```js
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
```

---

# SECTION 4: OPTIONS ENGINE

## 4a-4d. Options Pricing, IV, Greeks, Strategy Selection (backend/options_engine.py) — Full Contents

```python
"""
MKW Options Intelligence Engine
Black-Scholes pricing, IV analysis, Greeks, expected move, strategy selection.
"""

import math
import logging
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd

log = logging.getLogger("mkw.options")

# ─────────────────────────────────────────────────────────
# BLACK-SCHOLES CORE
# ─────────────────────────────────────────────────────────

def _norm_cdf(x: float) -> float:
    """Standard normal CDF (no scipy dependency)."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

def _norm_pdf(x: float) -> float:
    """Standard normal PDF."""
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)

def black_scholes_price(S: float, K: float, T: float, r: float, sigma: float, option_type: str = "call") -> float:
    """
    Black-Scholes option price.
    S: spot price, K: strike, T: time to expiry (years), r: risk-free rate, sigma: IV (annualized)
    """
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return max(0, (S - K) if option_type == "call" else (K - S))

    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    if option_type == "call":
        return S * _norm_cdf(d1) - K * math.exp(-r * T) * _norm_cdf(d2)
    else:
        return K * math.exp(-r * T) * _norm_cdf(-d2) - S * _norm_cdf(-d1)

def implied_volatility(price: float, S: float, K: float, T: float, r: float, option_type: str = "call", tol: float = 1e-6, max_iter: int = 100) -> float:
    """Newton-Raphson IV solver."""
    if T <= 0 or price <= 0:
        return 0.0

    sigma = 0.3  # initial guess
    for _ in range(max_iter):
        bs_price = black_scholes_price(S, K, T, r, sigma, option_type)
        vega = _bs_vega(S, K, T, r, sigma)
        if vega < 1e-10:
            break
        diff = bs_price - price
        if abs(diff) < tol:
            break
        sigma -= diff / vega
        sigma = max(0.01, min(5.0, sigma))  # clamp
    return round(sigma, 4)

# ─────────────────────────────────────────────────────────
# GREEKS
# ─────────────────────────────────────────────────────────

def _bs_d1(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0:
        return 0.0
    return (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))

def _bs_vega(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0:
        return 0.0
    d1 = _bs_d1(S, K, T, r, sigma)
    return S * _norm_pdf(d1) * math.sqrt(T)

def calc_greeks(S: float, K: float, T: float, r: float, sigma: float, option_type: str = "call") -> dict:
    """
    Full Greeks for a single option.
    Returns: delta, gamma, theta (per day), vega (per 1% IV move), rho
    """
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        intrinsic = max(0, (S - K) if option_type == "call" else (K - S))
        return {"delta": 1.0 if intrinsic > 0 else 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}

    d1 = _bs_d1(S, K, T, r, sigma)
    d2 = d1 - sigma * math.sqrt(T)
    sqrt_T = math.sqrt(T)

    if option_type == "call":
        delta = _norm_cdf(d1)
        rho = K * T * math.exp(-r * T) * _norm_cdf(d2) / 100
    else:
        delta = _norm_cdf(d1) - 1
        rho = -K * T * math.exp(-r * T) * _norm_cdf(-d2) / 100

    gamma = _norm_pdf(d1) / (S * sigma * sqrt_T)

    # Theta per calendar day
    theta_term1 = -(S * _norm_pdf(d1) * sigma) / (2 * sqrt_T)
    if option_type == "call":
        theta_term2 = -r * K * math.exp(-r * T) * _norm_cdf(d2)
    else:
        theta_term2 = r * K * math.exp(-r * T) * _norm_cdf(-d2)
    theta = (theta_term1 + theta_term2) / 365

    # Vega per 1 percentage point move in IV
    vega = S * _norm_pdf(d1) * sqrt_T / 100

    return {
        "delta": round(delta, 4),
        "gamma": round(gamma, 6),
        "theta": round(theta, 4),
        "vega":  round(vega, 4),
        "rho":   round(rho, 4),
    }

def greeks_projection(S: float, K: float, T: float, r: float, sigma: float,
                      option_type: str, target_prices: list, hold_days: int = 15) -> dict:
    """
    Project how Greeks and option value change at different stock prices and over time.
    """
    current_price = black_scholes_price(S, K, T, r, sigma, option_type)
    current_greeks = calc_greeks(S, K, T, r, sigma, option_type)

    # Theta burn projection
    T_after = max(0, T - hold_days / 365)
    price_after_theta = black_scholes_price(S, K, T_after, r, sigma, option_type)
    theta_cost_total = current_price - price_after_theta
    theta_per_day = theta_cost_total / hold_days if hold_days > 0 else 0

    # Price needed to offset theta
    price_to_offset = S
    for test_pct in range(1, 200):
        test_price = S * (1 + test_pct * 0.001) if option_type == "call" else S * (1 - test_pct * 0.001)
        opt_val = black_scholes_price(test_price, K, T_after, r, sigma, option_type)
        if opt_val >= current_price:
            price_to_offset = test_price
            break

    # Project at target prices
    projections = []
    for target in target_prices:
        opt_at_target = black_scholes_price(target, K, T_after, r, sigma, option_type)
        greeks_at_target = calc_greeks(target, K, T_after, r, sigma, option_type)
        pnl = opt_at_target - current_price
        pnl_pct = (pnl / current_price * 100) if current_price > 0 else 0
        projections.append({
            "stockPrice": round(target, 2),
            "optionValue": round(opt_at_target, 2),
            "pnl": round(pnl, 2),
            "pnlPct": round(pnl_pct, 1),
            "delta": greeks_at_target["delta"],
            "gamma": greeks_at_target["gamma"],
        })

    return {
        "currentPrice": round(current_price, 2),
        "currentGreeks": current_greeks,
        "thetaBurn": {
            "perDay": round(theta_per_day, 2),
            "totalOverHold": round(theta_cost_total, 2),
            "holdDays": hold_days,
            "pctOfPremium": round(theta_cost_total / current_price * 100, 1) if current_price > 0 else 0,
            "priceToOffset": round(price_to_offset, 2),
        },
        "projections": projections,
    }


# ─────────────────────────────────────────────────────────
# IV ANALYSIS
# ─────────────────────────────────────────────────────────

def calc_historical_volatility(df: pd.DataFrame, window: int = 20) -> float:
    """Annualized historical volatility from daily returns."""
    if df is None or len(df) < window + 1:
        return 0.3
    returns = np.log(df["Close"] / df["Close"].shift(1)).dropna()
    if len(returns) < window:
        return 0.3
    hv = float(returns.iloc[-window:].std()) * math.sqrt(252)
    return round(hv, 4)

def calc_iv_from_options_chain(ticker_obj) -> dict:
    """
    Extract IV metrics from yfinance options chain.
    Returns IV rank, IV percentile, term structure, skew, vol-of-vol.
    """
    result = {
        "currentIV": 0.30,
        "ivRank": 50,
        "ivPercentile": 50,
        "ivHigh52w": 0.60,
        "ivLow52w": 0.15,
        "termStructure": "contango",
        "termStructureDetail": [],
        "skew": 0.0,
        "skewVerdict": "neutral",
        "volOfVol": 0.0,
        "volOfVolVerdict": "stable",
        "verdict": "NEUTRAL",
        "verdictReason": "",
    }

    try:
        expirations = ticker_obj.options
        if not expirations or len(expirations) < 1:
            return result

        # Collect ATM IV for each expiration
        spot = None
        try:
            hist = ticker_obj.history(period="5d")
            if hist is not None and not hist.empty:
                spot = float(hist["Close"].iloc[-1])
        except Exception:
            pass

        if spot is None or spot <= 0:
            return result

        iv_by_expiry = []
        atm_ivs_near = []
        otm_call_iv = None
        atm_iv_ref = None

        for i, exp in enumerate(expirations[:6]):  # max 6 expirations
            try:
                chain = ticker_obj.option_chain(exp)
                calls = chain.calls
                puts = chain.puts

                if calls.empty and puts.empty:
                    continue

                # Find ATM strike
                if not calls.empty:
                    calls_valid = calls[calls["impliedVolatility"] > 0.01].copy()
                    if not calls_valid.empty:
                        calls_valid["dist"] = abs(calls_valid["strike"] - spot)
                        atm_row = calls_valid.loc[calls_valid["dist"].idxmin()]
                        atm_iv = float(atm_row["impliedVolatility"])

                        exp_date = datetime.strptime(exp, "%Y-%m-%d")
                        dte = (exp_date - datetime.now()).days

                        iv_by_expiry.append({
                            "expiry": exp,
                            "dte": max(1, dte),
                            "atmIV": round(atm_iv, 4),
                        })

                        if i == 0:
                            atm_iv_ref = atm_iv

                        # For skew: find OTM call (~5% OTM)
                        if i == 0:
                            otm_strike = spot * 1.05
                            otm_calls = calls_valid[calls_valid["strike"] >= otm_strike]
                            if not otm_calls.empty:
                                otm_row = otm_calls.iloc[0]
                                otm_call_iv = float(otm_row["impliedVolatility"])

            except Exception as e:
                log.debug(f"Chain fetch error for {exp}: {e}")
                continue

        if not iv_by_expiry:
            return result

        current_iv = iv_by_expiry[0]["atmIV"]
        result["currentIV"] = current_iv
        result["termStructureDetail"] = iv_by_expiry

        # Term structure: compare near vs far
        if len(iv_by_expiry) >= 2:
            near_iv = iv_by_expiry[0]["atmIV"]
            far_iv = iv_by_expiry[-1]["atmIV"]
            if near_iv > far_iv * 1.05:
                result["termStructure"] = "backwardation"
            elif far_iv > near_iv * 1.05:
                result["termStructure"] = "contango"
            else:
                result["termStructure"] = "flat"

        # Skew: ATM vs OTM call IV
        if atm_iv_ref and otm_call_iv:
            skew = (otm_call_iv - atm_iv_ref) / atm_iv_ref * 100
            result["skew"] = round(skew, 1)
            if skew > 15:
                result["skewVerdict"] = "overpaying_otm"
            elif skew < -10:
                result["skewVerdict"] = "favorable_otm"
            else:
                result["skewVerdict"] = "neutral"

        # Estimate IV Rank and Percentile using HV as proxy for historical IV range
        # (True IV history requires paid data — we approximate with realized vol)
        try:
            hist_long = ticker_obj.history(period="1y")
            if hist_long is not None and len(hist_long) > 60:
                returns = np.log(hist_long["Close"] / hist_long["Close"].shift(1)).dropna()
                # Rolling 20-day HV as proxy for IV
                rolling_hv = returns.rolling(20).std() * math.sqrt(252)
                rolling_hv = rolling_hv.dropna()

                if len(rolling_hv) > 20:
                    hv_values = rolling_hv.values
                    iv_high = float(np.percentile(hv_values, 95))
                    iv_low = float(np.percentile(hv_values, 5))

                    result["ivHigh52w"] = round(iv_high, 4)
                    result["ivLow52w"] = round(iv_low, 4)

                    # IV Rank: (current - low) / (high - low) * 100
                    iv_range = iv_high - iv_low
                    if iv_range > 0.01:
                        iv_rank = int(min(100, max(0, (current_iv - iv_low) / iv_range * 100)))
                        result["ivRank"] = iv_rank

                    # IV Percentile: % of days IV was below current
                    below_count = int(np.sum(hv_values < current_iv))
                    iv_pct = int(below_count / len(hv_values) * 100)
                    result["ivPercentile"] = iv_pct

                    # Vol of Vol: std of rolling HV over last 20 readings
                    if len(rolling_hv) >= 40:
                        recent_hv = rolling_hv.iloc[-20:]
                        vov = float(recent_hv.std())
                        result["volOfVol"] = round(vov, 4)
                        if vov > 0.10:
                            result["volOfVolVerdict"] = "unstable"
                        elif vov > 0.05:
                            result["volOfVolVerdict"] = "moderate"
                        else:
                            result["volOfVolVerdict"] = "stable"
        except Exception as e:
            log.debug(f"IV history calc error: {e}")

        # Overall verdict
        iv_rank = result["ivRank"]
        skew_v = result["skewVerdict"]
        vov_v = result["volOfVolVerdict"]

        favorable_count = 0
        unfavorable_count = 0
        reasons = []

        if iv_rank < 30:
            favorable_count += 2
            reasons.append(f"IV Rank {iv_rank} is LOW — cheap options")
        elif iv_rank < 50:
            favorable_count += 1
            reasons.append(f"IV Rank {iv_rank} is moderate")
        elif iv_rank < 70:
            unfavorable_count += 1
            reasons.append(f"IV Rank {iv_rank} is elevated — consider spreads")
        else:
            unfavorable_count += 2
            reasons.append(f"IV Rank {iv_rank} is HIGH — premium expensive, spreads only")

        if skew_v == "overpaying_otm":
            unfavorable_count += 1
            reasons.append(f"OTM skew +{result['skew']:.0f}% — you're overpaying for OTM strikes")
        elif skew_v == "favorable_otm":
            favorable_count += 1
            reasons.append("OTM strikes relatively cheap vs ATM")

        if vov_v == "unstable":
            unfavorable_count += 1
            reasons.append("Vol-of-vol HIGH — IV could crush even on correct direction")
        elif vov_v == "stable":
            favorable_count += 1
            reasons.append("Vol-of-vol stable — IV environment predictable")

        if favorable_count >= 3 and unfavorable_count == 0:
            result["verdict"] = "FAVORABLE"
        elif unfavorable_count >= 2:
            result["verdict"] = "UNFAVORABLE"
        else:
            result["verdict"] = "NEUTRAL"

        result["verdictReason"] = " | ".join(reasons)

    except Exception as e:
        log.warning(f"IV analysis error: {e}")

    return result


# ─────────────────────────────────────────────────────────
# EXPECTED MOVE ANALYSIS
# ─────────────────────────────────────────────────────────

def calc_expected_move(df: pd.DataFrame, current_iv: float, spot: float) -> dict:
    """
    Calculate expected move based on IV and historical breakout analysis.
    Uses IV-implied move and historical realized moves for comparison.
    """
    result = {
        "ivImplied": {},
        "historical": {},
        "breakeven": {},
    }

    if df is None or len(df) < 60 or spot <= 0:
        return result

    try:
        # IV-implied expected move for various timeframes
        for days, label in [(5, "1w"), (10, "2w"), (20, "1m"), (30, "6w"), (60, "3m")]:
            move_pct = current_iv * math.sqrt(days / 252) * 100
            move_dollar = spot * move_pct / 100
            result["ivImplied"][label] = {
                "days": days,
                "movePct": round(move_pct, 1),
                "moveDollar": round(move_dollar, 2),
                "upperTarget": round(spot + move_dollar, 2),
                "lowerTarget": round(spot - move_dollar, 2),
            }

        # Historical realized moves
        c = df["Close"]
        for days in [5, 10, 20, 30, 60]:
            if len(c) > days + 20:
                # Calculate rolling N-day returns
                fwd_returns = (c.shift(-days) / c - 1).dropna() * 100
                fwd_returns = fwd_returns[fwd_returns.notna()]
                if len(fwd_returns) > 10:
                    label = {5: "1w", 10: "2w", 20: "1m", 30: "6w", 60: "3m"}[days]
                    result["historical"][label] = {
                        "days": days,
                        "medianMove": round(float(fwd_returns.abs().median()), 1),
                        "avgMove": round(float(fwd_returns.abs().mean()), 1),
                        "percentile75": round(float(np.percentile(fwd_returns.abs(), 75)), 1),
                        "percentile25": round(float(np.percentile(fwd_returns.abs(), 25)), 1),
                        "upPct": round(float((fwd_returns > 0).mean() * 100), 0),
                    }

    except Exception as e:
        log.warning(f"Expected move calc error: {e}")

    return result

def compare_move_to_breakeven(expected_move: dict, breakeven_pct: float, hold_days: int = 20) -> dict:
    """
    Compare expected stock move to option breakeven distance.
    Returns assessment: FAVORABLE, MARGINAL, or UNFAVORABLE.
    """
    label_map = {5: "1w", 10: "2w", 20: "1m", 30: "6w", 60: "3m"}

    # Find closest timeframe
    closest_label = "1m"
    min_diff = 999
    for days, label in label_map.items():
        if abs(days - hold_days) < min_diff:
            min_diff = abs(days - hold_days)
            closest_label = label

    hist = expected_move.get("historical", {}).get(closest_label, {})
    iv_impl = expected_move.get("ivImplied", {}).get(closest_label, {})

    median_move = hist.get("medianMove", 0)
    iv_move = iv_impl.get("movePct", 0)

    if median_move <= 0 and iv_move <= 0:
        return {"assessment": "UNKNOWN", "reason": "Insufficient data", "ratio": 0}

    reference_move = median_move if median_move > 0 else iv_move
    ratio = reference_move / breakeven_pct if breakeven_pct > 0 else 0

    if ratio >= 1.5:
        assessment = "FAVORABLE"
        reason = f"Historical median move {reference_move:.1f}% is {ratio:.1f}x the breakeven distance of {breakeven_pct:.1f}%"
    elif ratio >= 1.0:
        assessment = "MARGINAL"
        reason = f"Historical median move {reference_move:.1f}% barely covers breakeven of {breakeven_pct:.1f}% — consider a spread"
    else:
        assessment = "UNFAVORABLE"
        reason = f"Historical median move {reference_move:.1f}% is LESS than breakeven of {breakeven_pct:.1f}% — premium too expensive"

    return {"assessment": assessment, "reason": reason, "ratio": round(ratio, 2)}


# ─────────────────────────────────────────────────────────
# STRATEGY SELECTION ENGINE
# ─────────────────────────────────────────────────────────

STRATEGY_RULES = [
    # (condition_fn, strategy_name, description)
]

def select_strategy(iv_rank: int, iv_verdict: str, conv_zone: str, phase: str,
                    wein_stage: str, is_leap: bool = False) -> dict:
    """
    Based on IV environment, setup type, and market context, recommend optimal option structure.
    Returns strategy type and reasoning.
    """
    strategies = []

    # Determine if bullish or bearish setup
    is_short = wein_stage in ("3", "4A", "4B")
    direction = "bearish" if is_short else "bullish"

    # Stage 1/3 chop — no directional
    if wein_stage in ("1A", "1B", "3"):
        return {
            "primary": "CASH",
            "alt": "iron_condor",
            "reason": f"Stage {wein_stage} — no clear direction. Stay cash or sell premium with iron condor.",
            "direction": "neutral",
            "strategies": [{
                "type": "CASH",
                "name": "Stay Cash",
                "reason": "No directional edge in current stage. Capital preservation IS a position.",
                "aggression": "conservative",
            }],
        }

    # LEAP entries
    if is_leap:
        if iv_rank < 40:
            strat = {
                "type": "deep_itm_leap",
                "name": "Deep ITM LEAP" + (" Put" if is_short else " Call"),
                "reason": f"IV Rank {iv_rank} is low — deep ITM LEAP (delta 0.75+) acts as synthetic stock at fraction of cost",
                "aggression": "conservative",
                "targetDelta": 0.75,
                "dteRange": [180, 365],
            }
        else:
            strat = {
                "type": "pmcc" if not is_short else "pmcp",
                "name": "Poor Man's Covered " + ("Put" if is_short else "Call"),
                "reason": f"IV Rank {iv_rank} elevated — buy LEAP, sell near-term OTM monthly for income to offset premium",
                "aggression": "moderate",
                "targetDelta": 0.70,
                "dteRange": [180, 365],
            }
        return {
            "primary": strat["type"],
            "alt": "deep_itm_leap" if strat["type"] != "deep_itm_leap" else "pmcc",
            "reason": strat["reason"],
            "direction": direction,
            "strategies": [strat],
        }

    # Swing entries by IV rank
    result_strategies = []

    if iv_rank < 30 and conv_zone in ("CONVERGENCE", "SECONDARY"):
        # Low IV — straight directional is optimal
        result_strategies.append({
            "type": "long_call" if not is_short else "long_put",
            "name": f"Long {'Put' if is_short else 'Call'} (ATM)",
            "reason": f"IV Rank {iv_rank} LOW + strong convergence = straight directional. Maximum leverage.",
            "aggression": "aggressive",
            "targetDelta": 0.55,
            "dteRange": [30, 45],
        })
        result_strategies.append({
            "type": "debit_spread",
            "name": f"{'Bear Put' if is_short else 'Bull Call'} Spread",
            "reason": "Alternative: spread reduces cost basis while maintaining directional exposure",
            "aggression": "moderate",
            "targetDelta": 0.55,
            "dteRange": [30, 60],
        })

    elif iv_rank < 50:
        # Moderate IV — either works
        result_strategies.append({
            "type": "long_call" if not is_short else "long_put",
            "name": f"Long {'Put' if is_short else 'Call'}",
            "reason": f"IV Rank {iv_rank} moderate — directional viable but spread reduces risk",
            "aggression": "aggressive",
            "targetDelta": 0.55,
            "dteRange": [30, 60],
        })
        result_strategies.append({
            "type": "debit_spread",
            "name": f"{'Bear Put' if is_short else 'Bull Call'} Spread",
            "reason": f"IV Rank {iv_rank} — spread recommended to cap vega risk",
            "aggression": "moderate",
            "targetDelta": 0.55,
            "dteRange": [30, 60],
        })

    elif iv_rank < 70:
        # Elevated IV — spreads preferred
        result_strategies.append({
            "type": "debit_spread",
            "name": f"{'Bear Put' if is_short else 'Bull Call'} Spread",
            "reason": f"IV Rank {iv_rank} ELEVATED — sell higher strike to offset IV cost. Straight options too expensive.",
            "aggression": "moderate",
            "targetDelta": 0.55,
            "dteRange": [30, 60],
        })

    else:
        # IV > 70 — spreads only or skip
        result_strategies.append({
            "type": "debit_spread",
            "name": f"{'Bear Put' if is_short else 'Bull Call'} Spread ONLY",
            "reason": f"IV Rank {iv_rank} EXTREME — premium too expensive for naked options. Spread or skip.",
            "aggression": "moderate",
            "targetDelta": 0.55,
            "dteRange": [30, 60],
        })
        result_strategies.append({
            "type": "CASH",
            "name": "Consider Skipping",
            "reason": f"IV Rank {iv_rank} — even spreads are expensive. Wait for IV to normalize.",
            "aggression": "conservative",
        })

    # VCP coil special case
    if phase == "Wedge" and iv_rank < 30:
        result_strategies.append({
            "type": "long_straddle",
            "name": "Long Straddle (VCP Coil Play)",
            "reason": "VCP coiling + low IV = straddle captures breakout in either direction",
            "aggression": "aggressive",
            "targetDelta": 0.50,
            "dteRange": [30, 60],
        })

    primary = result_strategies[0] if result_strategies else {"type": "CASH", "name": "No Strategy", "reason": "Conditions unclear"}
    alt = result_strategies[1]["type"] if len(result_strategies) > 1 else "CASH"

    return {
        "primary": primary["type"],
        "alt": alt,
        "reason": primary["reason"],
        "direction": direction,
        "strategies": result_strategies,
    }


# ─────────────────────────────────────────────────────────
# BUILD OPTION CHAIN SNAPSHOT
# ─────────────────────────────────────────────────────────

def build_options_snapshot(ticker_obj, spot: float, direction: str = "bullish") -> list:
    """
    Build a snapshot of relevant options for the nearest 3 expirations.
    Returns list of {expiry, dte, calls: [...], puts: [...]} with Greeks.
    """
    snapshots = []
    r = 0.05  # risk-free rate approximation

    try:
        expirations = ticker_obj.options
        if not expirations:
            return []

        for exp in expirations[:4]:
            try:
                chain = ticker_obj.option_chain(exp)
                exp_date = datetime.strptime(exp, "%Y-%m-%d")
                dte = max(1, (exp_date - datetime.now()).days)
                T = dte / 365

                snap = {"expiry": exp, "dte": dte, "calls": [], "puts": []}

                # Process calls
                if not chain.calls.empty:
                    # Get strikes near ATM (within ~15%)
                    calls = chain.calls[
                        (chain.calls["strike"] >= spot * 0.85) &
                        (chain.calls["strike"] <= spot * 1.20) &
                        (chain.calls["impliedVolatility"] > 0.01)
                    ].head(8)

                    for _, row in calls.iterrows():
                        strike = float(row["strike"])
                        iv = float(row["impliedVolatility"])
                        bid = float(row.get("bid", 0) or 0)
                        ask = float(row.get("ask", 0) or 0)
                        mid = round((bid + ask) / 2, 2) if bid > 0 and ask > 0 else float(row.get("lastPrice", 0) or 0)
                        vol = int(row.get("volume", 0) or 0)
                        oi = int(row.get("openInterest", 0) or 0)

                        greeks = calc_greeks(spot, strike, T, r, iv, "call")
                        breakeven = strike + mid
                        breakeven_pct = round((breakeven / spot - 1) * 100, 2) if spot > 0 else 0

                        snap["calls"].append({
                            "strike": strike,
                            "bid": bid,
                            "ask": ask,
                            "mid": mid,
                            "iv": round(iv, 4),
                            "volume": vol,
                            "openInterest": oi,
                            "greeks": greeks,
                            "breakeven": round(breakeven, 2),
                            "breakevenPct": breakeven_pct,
                            "moneyness": "ITM" if strike < spot else ("ATM" if abs(strike - spot) / spot < 0.02 else "OTM"),
                        })

                # Process puts
                if not chain.puts.empty:
                    puts = chain.puts[
                        (chain.puts["strike"] >= spot * 0.80) &
                        (chain.puts["strike"] <= spot * 1.15) &
                        (chain.puts["impliedVolatility"] > 0.01)
                    ].head(8)

                    for _, row in puts.iterrows():
                        strike = float(row["strike"])
                        iv = float(row["impliedVolatility"])
                        bid = float(row.get("bid", 0) or 0)
                        ask = float(row.get("ask", 0) or 0)
                        mid = round((bid + ask) / 2, 2) if bid > 0 and ask > 0 else float(row.get("lastPrice", 0) or 0)
                        vol = int(row.get("volume", 0) or 0)
                        oi = int(row.get("openInterest", 0) or 0)

                        greeks = calc_greeks(spot, strike, T, r, iv, "put")
                        breakeven = strike - mid
                        breakeven_pct = round((1 - breakeven / spot) * 100, 2) if spot > 0 else 0

                        snap["puts"].append({
                            "strike": strike,
                            "bid": bid,
                            "ask": ask,
                            "mid": mid,
                            "iv": round(iv, 4),
                            "volume": vol,
                            "openInterest": oi,
                            "greeks": greeks,
                            "breakeven": round(breakeven, 2),
                            "breakevenPct": breakeven_pct,
                            "moneyness": "ITM" if strike > spot else ("ATM" if abs(strike - spot) / spot < 0.02 else "OTM"),
                        })

                snapshots.append(snap)
            except Exception as e:
                log.debug(f"Chain error for {exp}: {e}")
                continue
    except Exception as e:
        log.warning(f"Options snapshot error: {e}")

    return snapshots


# ─────────────────────────────────────────────────────────
# FULL OPTIONS ANALYSIS (ENTRY POINT)
# ─────────────────────────────────────────────────────────

def full_options_analysis(ticker_obj, df: pd.DataFrame, spot: float,
                          conv_zone: str, phase: str, wein_stage: str,
                          vcp_pivot: Optional[float] = None) -> dict:
    """
    Complete options intelligence for a ticker.
    Combines IV analysis, expected move, strategy selection, and chain snapshot.
    """
    result = {
        "iv": {},
        "expectedMove": {},
        "strategySelection": {},
        "chainSnapshot": [],
        "unusualActivity": [],
        "putCallRatio": None,
        "errors": [],
    }

    try:
        # 1. IV Analysis
        iv_data = calc_iv_from_options_chain(ticker_obj)
        result["iv"] = iv_data

        current_iv = iv_data.get("currentIV", 0.30)
        iv_rank = iv_data.get("ivRank", 50)
        iv_verdict = iv_data.get("verdict", "NEUTRAL")

        # 2. Expected Move
        expected = calc_expected_move(df, current_iv, spot)
        result["expectedMove"] = expected

        # 3. Strategy Selection
        strategy = select_strategy(iv_rank, iv_verdict, conv_zone, phase, wein_stage)
        result["strategySelection"] = strategy

        # 4. Chain Snapshot
        direction = "bearish" if wein_stage in ("3", "4A", "4B") else "bullish"
        chain = build_options_snapshot(ticker_obj, spot, direction)
        result["chainSnapshot"] = chain

        # 5. Put/Call ratio from chain data
        total_call_vol = 0
        total_put_vol = 0
        total_call_oi = 0
        total_put_oi = 0

        for snap in chain:
            for c in snap.get("calls", []):
                total_call_vol += c.get("volume", 0)
                total_call_oi += c.get("openInterest", 0)
            for p in snap.get("puts", []):
                total_put_vol += p.get("volume", 0)
                total_put_oi += p.get("openInterest", 0)

        if total_call_vol > 0:
            result["putCallRatio"] = {
                "volume": round(total_put_vol / total_call_vol, 2),
                "openInterest": round(total_put_oi / total_call_oi, 2) if total_call_oi > 0 else 0,
            }

        # 6. Unusual Activity Detection
        unusual = []
        for snap in chain:
            for opt_list, opt_type in [(snap.get("calls", []), "call"), (snap.get("puts", []), "put")]:
                for opt in opt_list:
                    vol = opt.get("volume", 0)
                    oi = opt.get("openInterest", 0)
                    if oi > 0 and vol > oi * 2:
                        unusual.append({
                            "type": opt_type,
                            "strike": opt["strike"],
                            "expiry": snap["expiry"],
                            "volume": vol,
                            "openInterest": oi,
                            "ratio": round(vol / oi, 1),
                            "iv": opt.get("iv", 0),
                        })

        result["unusualActivity"] = sorted(unusual, key=lambda x: x.get("ratio", 0), reverse=True)[:5]

    except Exception as e:
        log.error(f"Full options analysis error: {e}")
        result["errors"].append(str(e))

    return result


def build_strategy_card(spot: float, strike: float, expiry: str, dte: int,
                        option_type: str, iv: float, bid: float, ask: float,
                        strategy_name: str, aggression: str,
                        target1: float = 0, target2: float = 0,
                        stop_price: float = 0, contracts: int = 1) -> dict:
    """
    Build a complete strategy execution card with all details.
    """
    r = 0.05
    T = dte / 365
    mid = round((bid + ask) / 2, 2)

    greeks = calc_greeks(spot, strike, T, r, iv, option_type)
    current_value = black_scholes_price(spot, strike, T, r, iv, option_type)

    # Breakeven
    if option_type == "call":
        breakeven = strike + mid
        breakeven_pct = round((breakeven / spot - 1) * 100, 2)
    else:
        breakeven = strike - mid
        breakeven_pct = round((1 - breakeven / spot) * 100, 2)

    # Max risk
    max_risk = mid * 100 * contracts

    # Project at targets
    targets = []
    T_mid = max(0, T - 15 / 365)  # project ~15 days out

    for t_price in [target1, target2]:
        if t_price > 0:
            opt_val = black_scholes_price(t_price, strike, T_mid, r, iv, option_type)
            pnl = (opt_val - mid) * 100 * contracts
            pnl_pct = round((opt_val / mid - 1) * 100, 1) if mid > 0 else 0
            targets.append({
                "stockPrice": round(t_price, 2),
                "optionValue": round(opt_val, 2),
                "pnl": round(pnl, 2),
                "pnlPct": pnl_pct,
            })

    # R:R ratio
    if targets and max_risk > 0:
        best_gain = max(t.get("pnl", 0) for t in targets)
        rr_ratio = round(best_gain / max_risk, 1) if max_risk > 0 else 0
    else:
        rr_ratio = 0

    # Theta projection
    T_after = max(0, T - 15 / 365)
    val_after = black_scholes_price(spot, strike, T_after, r, iv, option_type)
    theta_cost_15d = round((current_value - val_after) * 100 * contracts, 2)

    return {
        "strategyName": strategy_name,
        "aggression": aggression,
        "optionType": option_type,
        "strike": strike,
        "expiry": expiry,
        "dte": dte,
        "bid": bid,
        "ask": ask,
        "mid": mid,
        "iv": round(iv, 4),
        "greeks": greeks,
        "breakeven": breakeven,
        "breakevenPct": breakeven_pct,
        "maxRisk": round(max_risk, 2),
        "contracts": contracts,
        "targets": targets,
        "rrRatio": rr_ratio,
        "thetaCost15d": theta_cost_15d,
        "thetaPerDay": round(greeks["theta"] * 100 * contracts, 2),
    }
```

## 4a-4d (cont). Trade Ideas / Strategy Builder (backend/trade_ideas.py) — Full Contents

```python
"""
MKW Multi-Strategy Trade Idea Generator
Generates 2-3 execution strategies per qualifying setup at different aggression levels.
"""

import math
import logging
from datetime import datetime
from typing import Optional

from options_engine import (
    black_scholes_price, calc_greeks, greeks_projection,
    calc_expected_move, compare_move_to_breakeven,
    build_strategy_card,
)
from grading import grade_trade

log = logging.getLogger("mkw.ideas")


# ─────────────────────────────────────────────────────────
# STRIKE SELECTION HELPERS
# ─────────────────────────────────────────────────────────

def _round_strike(price: float, increment: float = 5.0) -> float:
    """Round to nearest standard strike increment."""
    if price < 20:
        increment = 1.0
    elif price < 50:
        increment = 2.5
    elif price < 200:
        increment = 5.0
    else:
        increment = 10.0
    return round(price / increment) * increment

def _find_best_option(chain_snapshot: list, option_type: str, target_delta: float,
                      dte_range: tuple = (25, 60)) -> Optional[dict]:
    """
    Find the best option from chain snapshot matching target delta and DTE range.
    Returns the option dict or None.
    """
    best = None
    best_score = 999

    for snap in chain_snapshot:
        dte = snap.get("dte", 0)
        if dte < dte_range[0] or dte > dte_range[1]:
            continue

        options = snap.get("calls" if option_type == "call" else "puts", [])
        for opt in options:
            delta = abs(opt.get("greeks", {}).get("delta", 0))
            if delta < 0.1:
                continue

            # Score by delta proximity and liquidity
            delta_diff = abs(delta - target_delta)
            mid = opt.get("mid", 0)
            if mid <= 0:
                continue

            score = delta_diff
            if opt.get("volume", 0) < 10 and opt.get("openInterest", 0) < 50:
                score += 0.5  # penalize illiquid

            if score < best_score:
                best_score = score
                best = {**opt, "expiry": snap["expiry"], "dte": dte}

    return best

def _find_spread_option(chain_snapshot: list, option_type: str,
                        base_strike: float, spread_width_pct: float = 0.10,
                        dte_target: int = 45) -> Optional[dict]:
    """Find the short leg for a spread (OTM from base strike)."""
    target_strike = base_strike * (1 + spread_width_pct) if option_type == "call" else base_strike * (1 - spread_width_pct)

    best = None
    best_diff = 999

    for snap in chain_snapshot:
        dte = snap.get("dte", 0)
        if abs(dte - dte_target) > 15:
            continue

        options = snap.get("calls" if option_type == "call" else "puts", [])
        for opt in options:
            diff = abs(opt["strike"] - target_strike)
            if diff < best_diff and opt.get("mid", 0) > 0:
                best_diff = diff
                best = {**opt, "expiry": snap["expiry"], "dte": dte}

    return best

def _find_leap_option(chain_snapshot: list, option_type: str,
                      target_delta: float = 0.75) -> Optional[dict]:
    """Find deep ITM LEAP option (longest dated, high delta)."""
    best = None
    best_dte = 0

    for snap in chain_snapshot:
        dte = snap.get("dte", 0)
        if dte < 90:
            continue

        options = snap.get("calls" if option_type == "call" else "puts", [])
        for opt in options:
            delta = abs(opt.get("greeks", {}).get("delta", 0))
            if delta >= target_delta - 0.1 and dte > best_dte:
                best_dte = dte
                best = {**opt, "expiry": snap["expiry"], "dte": dte}

    return best


# ─────────────────────────────────────────────────────────
# STRATEGY BUILDERS
# ─────────────────────────────────────────────────────────

def _build_aggressive_strategy(spot: float, chain: list, is_short: bool,
                               target1: float, target2: float, stop: float,
                               iv_rank: int) -> Optional[dict]:
    """
    AGGRESSIVE: Straight long call/put, ATM, 30-45 DTE.
    """
    option_type = "put" if is_short else "call"
    opt = _find_best_option(chain, option_type, target_delta=0.55, dte_range=(25, 50))
    if not opt:
        opt = _find_best_option(chain, option_type, target_delta=0.50, dte_range=(20, 65))
    if not opt:
        return None

    strike = opt["strike"]
    mid = opt["mid"]
    iv = opt.get("iv", 0.30)
    dte = opt["dte"]
    bid = opt.get("bid", mid * 0.95)
    ask = opt.get("ask", mid * 1.05)

    card = build_strategy_card(
        spot=spot, strike=strike, expiry=opt["expiry"], dte=dte,
        option_type=option_type, iv=iv, bid=bid, ask=ask,
        strategy_name=f"AGGRESSIVE — Long {'Put' if is_short else 'Call'}",
        aggression="aggressive",
        target1=target1, target2=target2, stop_price=stop, contracts=1,
    )

    card["description"] = (
        f"Straight long {option_type}. ATM strike ${strike:.0f}, {dte} DTE. "
        f"Maximum directional leverage. Full recommended position."
    )
    card["whenToUse"] = "AAA setup, IV Rank < 30, full convergence, strong market"

    return card


def _build_moderate_strategy(spot: float, chain: list, is_short: bool,
                             target1: float, target2: float, stop: float,
                             iv_rank: int) -> Optional[dict]:
    """
    MODERATE: Debit spread (bull call / bear put spread).
    """
    option_type = "put" if is_short else "call"
    long_opt = _find_best_option(chain, option_type, target_delta=0.55, dte_range=(25, 65))
    if not long_opt:
        return None

    # Find short leg
    spread_dir = -0.10 if is_short else 0.10
    short_opt = _find_spread_option(chain, option_type, long_opt["strike"], spread_dir, long_opt["dte"])
    if not short_opt:
        # Try wider spread
        short_opt = _find_spread_option(chain, option_type, long_opt["strike"], spread_dir * 1.5, long_opt["dte"])

    if not short_opt:
        return None

    long_mid = long_opt["mid"]
    short_mid = short_opt["mid"]
    net_debit = round(long_mid - short_mid, 2)

    if net_debit <= 0:
        return None

    # Calculate max profit
    strike_diff = abs(long_opt["strike"] - short_opt["strike"])
    max_profit = round(strike_diff - net_debit, 2)
    max_profit_pct = round(max_profit / net_debit * 100, 1) if net_debit > 0 else 0

    long_greeks = long_opt.get("greeks", {})
    short_greeks = short_opt.get("greeks", {})

    # Net Greeks
    net_delta = round(long_greeks.get("delta", 0) - short_greeks.get("delta", 0), 4)
    net_theta = round(long_greeks.get("theta", 0) - short_greeks.get("theta", 0), 4)
    net_vega = round(long_greeks.get("vega", 0) - short_greeks.get("vega", 0), 4)

    # Breakeven
    if option_type == "call":
        breakeven = long_opt["strike"] + net_debit
        spread_name = "Bull Call Spread"
    else:
        breakeven = long_opt["strike"] - net_debit
        spread_name = "Bear Put Spread"

    breakeven_pct = round(abs(breakeven / spot - 1) * 100, 2)
    rr_ratio = round(max_profit / net_debit, 1) if net_debit > 0 else 0

    return {
        "strategyName": f"MODERATE — {spread_name}",
        "aggression": "moderate",
        "optionType": option_type,
        "longStrike": long_opt["strike"],
        "shortStrike": short_opt["strike"],
        "expiry": long_opt["expiry"],
        "dte": long_opt["dte"],
        "longPremium": long_mid,
        "shortPremium": short_mid,
        "netDebit": net_debit,
        "maxProfit": max_profit,
        "maxProfitPct": max_profit_pct,
        "maxRisk": round(net_debit * 100, 2),
        "breakeven": round(breakeven, 2),
        "breakevenPct": breakeven_pct,
        "rrRatio": rr_ratio,
        "greeks": {
            "delta": net_delta,
            "theta": net_theta,
            "vega": net_vega,
        },
        "thetaPerDay": round(net_theta * 100, 2),
        "contracts": 1,
        "description": (
            f"{'Bear put' if is_short else 'Bull call'} spread: BUY ${long_opt['strike']:.0f} / "
            f"SELL ${short_opt['strike']:.0f} {option_type}s for ${net_debit:.2f} net debit. "
            f"Max profit ${max_profit:.2f} ({max_profit_pct:.0f}%). Capped upside but much less capital at risk."
        ),
        "whenToUse": "AA setup, IV Rank 30-50, or deploying less capital",
        "targets": [],
    }


def _build_conservative_strategy(spot: float, chain: list, is_short: bool,
                                 target1: float, target2: float, stop: float,
                                 iv_rank: int) -> Optional[dict]:
    """
    CONSERVATIVE: Deep ITM LEAP (delta 0.75+), or calendar/diagonal spread.
    """
    option_type = "put" if is_short else "call"
    leap = _find_leap_option(chain, option_type, target_delta=0.75)

    if not leap:
        # Try finding any long-dated option
        leap = _find_best_option(chain, option_type, target_delta=0.70, dte_range=(90, 500))

    if not leap:
        return None

    strike = leap["strike"]
    mid = leap["mid"]
    iv = leap.get("iv", 0.30)
    dte = leap["dte"]
    bid = leap.get("bid", mid * 0.95)
    ask = leap.get("ask", mid * 1.05)
    greeks = leap.get("greeks", {})

    # Breakeven
    if option_type == "call":
        breakeven = strike + mid
    else:
        breakeven = strike - mid
    breakeven_pct = round(abs(breakeven / spot - 1) * 100, 2)

    # Theta per day
    theta_day = round(greeks.get("theta", 0) * 100, 2)

    # Project at targets
    r = 0.05
    T = dte / 365
    T_mid = max(0, T - 30 / 365)

    targets = []
    for t_price in [target1, target2]:
        if t_price > 0:
            opt_val = black_scholes_price(t_price, strike, T_mid, r, iv, option_type)
            pnl = round((opt_val - mid) * 100, 2)
            pnl_pct = round((opt_val / mid - 1) * 100, 1) if mid > 0 else 0
            targets.append({
                "stockPrice": round(t_price, 2),
                "optionValue": round(opt_val, 2),
                "pnl": pnl,
                "pnlPct": pnl_pct,
            })

    rr = 0
    if targets and mid > 0:
        best_gain = max(t.get("pnl", 0) for t in targets)
        rr = round(best_gain / (mid * 100), 1)

    return {
        "strategyName": f"CONSERVATIVE — Deep ITM LEAP {'Put' if is_short else 'Call'}",
        "aggression": "conservative",
        "optionType": option_type,
        "strike": strike,
        "expiry": leap["expiry"],
        "dte": dte,
        "bid": bid,
        "ask": ask,
        "mid": mid,
        "iv": round(iv, 4),
        "greeks": greeks,
        "breakeven": round(breakeven, 2),
        "breakevenPct": breakeven_pct,
        "maxRisk": round(mid * 100, 2),
        "contracts": 1,
        "targets": targets,
        "rrRatio": rr,
        "thetaPerDay": theta_day,
        "description": (
            f"Deep ITM LEAP {option_type}: ${strike:.0f} strike, {dte} DTE. "
            f"Delta {greeks.get('delta', 0):.2f} — acts as synthetic stock at fraction of cost. "
            f"Theta: ${abs(theta_day):.2f}/day. Rides the full stage advance."
        ),
        "whenToUse": "High conviction long-term thesis, hold through full stage advance",
    }


# ─────────────────────────────────────────────────────────
# EDUCATIONAL THESIS GENERATOR
# ─────────────────────────────────────────────────────────

def generate_thesis(ticker: str, wein: dict, tpl_score: int, rs: int,
                    phase: str, vcp: dict, conv_zone: str, conv_score: int,
                    ema_d: str, ema_w: str, ema_m: str,
                    fundamentals: dict, iv_data: dict, grade_info: dict,
                    price: float, is_short: bool = False) -> str:
    """
    Generate a detailed educational thesis explaining the setup.
    Pure template logic — no AI required.
    """
    lines = []

    # Stage context
    stage = wein.get("stage", "?")
    slope_weeks = wein.get("slopeWeeks", 0)
    pct_from_ma = wein.get("pctFromMA", 0)

    stage_desc = {
        "1A": "Stage 1A (basing/accumulation) — the 30-week MA is flat or declining. No trend established.",
        "1B": "Stage 1B (late basing) — the 30-week MA is beginning to flatten. Early signs of potential transition.",
        "2A": f"Weinstein Stage 2A with the 30-week MA rising for {slope_weeks} weeks, indicating a confirmed uptrend.",
        "2B": f"Weinstein Stage 2B (mature advance) — the 30-week MA has been rising for {slope_weeks} weeks. Later-stage moves carry higher risk.",
        "3": "Stage 3 (distribution/topping) — the 30-week MA is flattening. Price oscillating around the MA.",
        "4A": f"Weinstein Stage 4A with the 30-week MA declining, indicating a confirmed downtrend.",
        "4B": "Stage 4B (mature decline) — extended downtrend. Potential capitulation or basing.",
    }
    lines.append(f"{ticker} is in {stage_desc.get(stage, f'Stage {stage}')}.")

    # Minervini template
    if tpl_score == 8:
        lines.append(f"The Minervini Trend Template passes all 8/8 criteria with RS {rs}, placing it in the top {100-rs}% of all stocks by relative performance.")
    elif tpl_score >= 6:
        lines.append(f"The Minervini Trend Template passes {tpl_score}/8 criteria with RS {rs}. Partial qualification — some structural weakness remains.")
    else:
        lines.append(f"The Minervini Trend Template passes only {tpl_score}/8 criteria with RS {rs}. This does NOT meet minimum criteria for a high-probability setup.")

    # Kell phase
    phase_desc = {
        "EMA Crossback": "an EMA Crossback — the highest-probability entry phase. Price has pulled back to the rising 20 EMA and bounced, confirming institutional support.",
        "Pop": "a Pop — price breaking out with volume confirmation above all EMAs. Strong momentum.",
        "Base n Break": "a Base n Break — continuation from a higher base. Good for swing entries on confirmed trends.",
        "Wedge": "a Wedge — volatility contracting as Bollinger Bands narrow. A breakout is being set up, but direction is uncertain.",
        "Extension": "an Extension — price is extended well above the 10 EMA. Chasing here carries high risk of mean reversion.",
        "Reversal": "a Reversal attempt — the 10 EMA is turning up but the setup isn't confirmed yet.",
        "Red Light": "Red Light — price is below key EMAs. This is NOT a buy zone under Kell's framework.",
    }
    lines.append(f"Kell's framework identifies the current phase as {phase_desc.get(phase, f'{phase}')}.")

    # EMA alignment
    alignments = sum(1 for x in [ema_d, ema_w, ema_m] if x == ("bull" if not is_short else "bear"))
    if alignments == 3:
        lines.append("All three EMA timeframes (daily, weekly, monthly) are aligned bullish — maximum trend confirmation." if not is_short else "All three EMA timeframes are aligned bearish — maximum downtrend confirmation.")
    elif alignments == 2:
        lines.append(f"Two of three EMA timeframes are aligned. Good but not perfect alignment.")

    # VCP
    if vcp.get("count", 0) >= 2:
        lines.append(f"A {vcp['count']}-contraction VCP has formed with depths tightening from {vcp['depths']}, confirming seller exhaustion." +
                     (f" The pivot at ${vcp['pivot']:.2f} {'was cleared' if price > vcp['pivot'] else 'is the key breakout level to watch'}." if vcp.get("pivot") else ""))
        if vcp.get("volDryup"):
            lines.append("Volume has dried up during the contraction — a classic sign of supply exhaustion before a breakout.")
    elif vcp.get("count", 0) == 1:
        lines.append("Only one contraction detected — a VCP typically needs 2-3 contractions to confirm seller exhaustion.")
    else:
        lines.append("No VCP pattern detected. Without a volatility contraction pattern, the entry is less defined.")

    # Convergence assessment
    lines.append("")
    if conv_zone == "CONVERGENCE":
        lines.append(f"This setup scores {conv_score}/22 on the convergence checklist, classifying it as FULL CONVERGENCE — the highest conviction category. All three frameworks (Weinstein, Minervini, Kell) agree on this name.")
    elif conv_zone == "SECONDARY":
        lines.append(f"This setup scores {conv_score}/22, classifying it as SECONDARY — a continuation play in a confirmed trend. Good but not the highest conviction entry.")
    elif conv_zone == "BUILDING":
        lines.append(f"This setup scores {conv_score}/22, classifying it as BUILDING — approaching convergence but missing key criteria. Watch for improvement.")
    else:
        lines.append(f"This setup scores {conv_score}/22 — WATCH ONLY. Significant gaps prevent this from being a tradeable setup.")

    # Grade context
    grade = grade_info.get("grade", "?")
    score = grade_info.get("totalScore", 0)
    lines.append(f"Overall trade grade: {grade} ({score}/100).")

    # IV context
    iv_rank = iv_data.get("ivRank", 50)
    iv_verdict = iv_data.get("verdict", "NEUTRAL")
    if iv_rank > 0:
        lines.append("")
        if iv_verdict == "FAVORABLE":
            lines.append(f"The IV environment is FAVORABLE (IV Rank {iv_rank}). Options are relatively cheap — straight directional plays are viable.")
        elif iv_verdict == "UNFAVORABLE":
            lines.append(f"The IV environment is UNFAVORABLE (IV Rank {iv_rank}). Options premium is expensive. Consider debit spreads to reduce cost, or wait for IV to normalize.")
        else:
            lines.append(f"The IV environment is NEUTRAL (IV Rank {iv_rank}). Both straight options and spreads are reasonable.")

    # Fundamentals
    eps = fundamentals.get("eps", 0)
    rev = fundamentals.get("rev", 0)
    if eps > 20 and rev > 15:
        lines.append(f"Fundamentals support the thesis: EPS growth {eps}%, revenue growth {rev}%.")
    elif eps > 0:
        lines.append(f"Fundamentals are mixed: EPS growth {eps}%, revenue growth {rev}%.")
    elif eps < 0:
        lines.append(f"Note: EPS growth is negative ({eps}%). This is a technical/momentum play, not a fundamental one.")

    # What would need to change
    lines.append("")
    if conv_zone == "CONVERGENCE":
        lines.append("KEY RISK: The primary risk is a market-wide pullback or sector rotation. Protect with the stop below the VCP pivot or 20 EMA.")
    elif conv_zone == "SECONDARY" or conv_zone == "BUILDING":
        issues = []
        if rs < 70: issues.append(f"RS improving from {rs} to 70+")
        if tpl_score < 8: issues.append(f"template improving from {tpl_score}/8 to 8/8")
        if vcp.get("count", 0) < 2: issues.append("a VCP pattern forming")
        if phase in ("Extension", "Red Light", "Wedge"): issues.append(f"phase shifting from {phase} to EMA Crossback or Pop")
        if issues:
            lines.append(f"What would need to change for higher conviction: {', '.join(issues)}.")
    else:
        lines.append("This is NOT a tradeable setup. Too many criteria fail. Watch only.")

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────
# MAIN: GENERATE TRADE IDEAS
# ─────────────────────────────────────────────────────────

def generate_trade_ideas(
    ticker: str, spot: float, chain_snapshot: list,
    wein: dict, tpl_score: int, rs: int, phase: str,
    vcp: dict, conv_zone: str, conv_score: int, conv_max: int,
    ema_d: str, ema_w: str, ema_m: str,
    fundamentals: dict, iv_data: dict,
    vol_ratio: float = 1.0,
    is_short: bool = False,
) -> dict:
    """
    Generate 2-3 strategy cards for a qualifying stock.
    Returns dict with grade, strategies, thesis, and no-trade message if applicable.
    """

    # Calculate targets and stop
    if is_short:
        stop = spot * 1.07
        target1 = spot * 0.85
        target2 = spot * 0.75
    else:
        if vcp.get("pivot") and vcp["pivot"] > 0:
            stop = vcp["pivot"] * 0.97
        else:
            stop = spot * 0.93
        target1 = spot * 1.12
        target2 = spot * 1.22

    # Grade the trade
    iv_rank = iv_data.get("ivRank", 50)
    iv_verdict = iv_data.get("verdict", "NEUTRAL")
    skew_verdict = iv_data.get("skewVerdict", "neutral")

    # Expected move ratio (compare to breakeven of aggressive option)
    expected_move_ratio = 1.0
    expected = iv_data.get("expectedMove", {}) if "expectedMove" in iv_data else {}
    # Will be filled in after we find the option

    theta_pct = 15.0

    grade_result = grade_trade(
        conv_score=conv_score, conv_max=conv_max, conv_zone=conv_zone,
        wein_stage=wein.get("stage", "?"), tpl_score=tpl_score, rs=rs,
        phase=phase, ema_d=ema_d, ema_w=ema_w, ema_m=ema_m,
        iv_rank=iv_rank, iv_verdict=iv_verdict,
        expected_move_ratio=expected_move_ratio,
        theta_pct_of_premium=theta_pct,
        skew_verdict=skew_verdict,
        vcp_pivot=vcp.get("pivot"), current_price=spot,
        vol_ratio=vol_ratio,
        stop_price=stop, target1=target1, target2=target2,
        is_short=is_short,
    )

    # Generate thesis
    thesis = generate_thesis(
        ticker, wein, tpl_score, rs, phase, vcp, conv_zone, conv_score,
        ema_d, ema_w, ema_m, fundamentals, iv_data, grade_result, spot, is_short,
    )

    # Check if tradeable
    grade = grade_result.get("grade", "F")
    if grade in ("BB", "B", "F"):
        failing = []
        if rs < 70 and not is_short: failing.append(f"RS {rs} below 70")
        if tpl_score < 6 and not is_short: failing.append(f"Template {tpl_score}/8 too weak")
        if phase in ("Extension", "Red Light"): failing.append(f"Phase '{phase}' — no entry")
        if conv_zone == "WATCH": failing.append("Convergence zone WATCH — criteria not met")
        if iv_rank > 70: failing.append(f"IV Rank {iv_rank} — premium too expensive")

        return {
            "ticker": ticker,
            "spot": round(spot, 2),
            "grade": grade_result,
            "tradeable": False,
            "bias": "NEUTRAL",
            "conviction": "NONE",
            "noTradeReason": f"Does not meet minimum criteria. Failing: {'; '.join(failing) if failing else 'Score too low'}.",
            "strategies": [],
            "thesis": thesis,
            "stopPrice": round(stop, 2),
            "target1": round(target1, 2),
            "target2": round(target2, 2),
            "isShort": is_short,
            "stage": wein.get("stage", "?"),
            "ivRank": iv_rank,
            "phase": phase,
            "convZone": conv_zone,
            "convScore": conv_score,
        }

    # Generate strategies
    strategies = []

    # Aggressive
    agg = _build_aggressive_strategy(spot, chain_snapshot, is_short, target1, target2, stop, iv_rank)
    if agg:
        strategies.append(agg)

    # Moderate
    mod = _build_moderate_strategy(spot, chain_snapshot, is_short, target1, target2, stop, iv_rank)
    if mod:
        strategies.append(mod)

    # Conservative
    cons = _build_conservative_strategy(spot, chain_snapshot, is_short, target1, target2, stop, iv_rank)
    if cons:
        strategies.append(cons)

    # If no strategies could be built (no options data), create synthetic cards
    if not strategies:
        option_type = "put" if is_short else "call"
        atm_strike = _round_strike(spot)
        otm_strike = _round_strike(spot * 1.10) if not is_short else _round_strike(spot * 0.90)
        itm_strike = _round_strike(spot * 0.90) if not is_short else _round_strike(spot * 1.10)

        strategies = [
            {
                "strategyName": f"AGGRESSIVE — Long {'Put' if is_short else 'Call'}",
                "aggression": "aggressive",
                "optionType": option_type,
                "strike": atm_strike,
                "expiry": "~30-45 DTE",
                "dte": 35,
                "mid": 0,
                "greeks": {"delta": 0.55, "gamma": 0, "theta": 0, "vega": 0},
                "breakeven": atm_strike * 1.05 if not is_short else atm_strike * 0.95,
                "breakevenPct": 5.0,
                "maxRisk": 0,
                "contracts": 1,
                "description": f"ATM ${atm_strike:.0f} {'put' if is_short else 'call'}, 30-45 DTE, delta ~0.55. Full position. (No live options data — check broker for pricing.)",
                "whenToUse": "AAA setup, IV Rank < 30, full convergence",
                "targets": [],
                "rrRatio": 0,
                "thetaPerDay": 0,
                "synthetic": True,
            },
            {
                "strategyName": f"MODERATE — {'Bear Put' if is_short else 'Bull Call'} Spread",
                "aggression": "moderate",
                "optionType": option_type,
                "longStrike": atm_strike,
                "shortStrike": otm_strike,
                "expiry": "~30-60 DTE",
                "dte": 45,
                "netDebit": 0,
                "maxProfit": abs(otm_strike - atm_strike),
                "maxRisk": 0,
                "description": f"{'Bear put' if is_short else 'Bull call'} spread: ${atm_strike:.0f}/${otm_strike:.0f}. Reduced cost. (No live options data.)",
                "whenToUse": "AA setup, IV Rank 30-50",
                "targets": [],
                "rrRatio": 0,
                "thetaPerDay": 0,
                "synthetic": True,
            },
            {
                "strategyName": f"CONSERVATIVE — Deep ITM LEAP {'Put' if is_short else 'Call'}",
                "aggression": "conservative",
                "optionType": option_type,
                "strike": itm_strike,
                "expiry": "~180-365 DTE",
                "dte": 210,
                "mid": 0,
                "greeks": {"delta": 0.78, "gamma": 0, "theta": 0, "vega": 0},
                "description": f"Deep ITM ${itm_strike:.0f} {'put' if is_short else 'call'}, 180+ DTE, delta ~0.78. Synthetic stock. (No live options data.)",
                "whenToUse": "High conviction long-term thesis",
                "targets": [],
                "rrRatio": 0,
                "thetaPerDay": 0,
                "synthetic": True,
            },
        ]

    # ── Enrich each strategy with entry triggers, things to watch, position sizing ──
    stage = wein.get("stage", "?")
    iv_rank = iv_data.get("ivRank", 50)

    for strat in strategies:
        agg = strat.get("aggression", "moderate")

        # Entry triggers — what must happen before entering
        triggers = []
        if vcp.get("pivot") and vcp["pivot"] > 0:
            triggers.append(f"Price clears VCP pivot ${vcp['pivot']:.2f} on volume > 1.5x avg")
        if phase in ("EMA Crossback", "Pop"):
            triggers.append("Price holds above 10/20 EMA on daily close")
        elif phase == "Base n Break":
            triggers.append("Breakout above consolidation range on volume expansion")
        elif phase == "Wedge":
            triggers.append("Wait for breakout direction — do NOT enter inside the wedge")
        if not is_short and stage in ("2A",):
            triggers.append("Confirmed close above prior swing high")
        elif is_short and stage in ("4A", "4B"):
            triggers.append("Confirmed close below prior swing low")
        if not triggers:
            triggers.append(f"Enter on pullback to 20 EMA (${spot * 0.97:.2f} area) with volume confirmation")
        strat["entryTriggers"] = triggers

        # Entry zone
        if vcp.get("pivot") and vcp["pivot"] > 0:
            strat["entryZone"] = f"${vcp['pivot']:.2f} — ${vcp['pivot'] * 1.02:.2f}"
        elif not is_short:
            strat["entryZone"] = f"${spot * 0.97:.2f} — ${spot * 1.01:.2f}"
        else:
            strat["entryZone"] = f"${spot * 0.99:.2f} — ${spot * 1.03:.2f}"

        # Things to watch / risk factors
        watch = []
        if iv_rank > 50:
            watch.append(f"IV Rank {iv_rank} — elevated premium, consider spread instead of naked long")
        if fundamentals.get("nextEarningsDate"):
            watch.append(f"Earnings date: {fundamentals['nextEarningsDate']} — consider closing or hedging before")
        if vol_ratio < 0.8:
            watch.append("Below-average volume — wait for participation before committing full size")
        elif vol_ratio > 2.0:
            watch.append("Unusual volume surge — verify catalyst before chasing")
        if phase == "Extension":
            watch.append("Price extended above 10 EMA — high risk of mean reversion pullback")
        if stage == "2B":
            watch.append("Late Stage 2 — uptrend mature, tighten stops faster than normal")
        if not is_short and rs < 70:
            watch.append(f"RS {rs} below 70 — relative strength not yet confirmed")
        if tpl_score < 8:
            watch.append(f"Trend Template {tpl_score}/8 — not all criteria met")
        watch.append("Monitor sector rotation — if sector leadership shifts, reassess position")
        strat["thingsToWatch"] = watch

        # Position sizing recommendation
        grade_score = grade_result.get("totalScore", 0)
        if agg == "aggressive":
            if grade_score >= 90:
                strat["positionSize"] = "Full position (5-8% of portfolio)"
                strat["positionPct"] = "5-8%"
            elif grade_score >= 80:
                strat["positionSize"] = "Standard position (3-5% of portfolio)"
                strat["positionPct"] = "3-5%"
            else:
                strat["positionSize"] = "Reduced position (2-3% of portfolio)"
                strat["positionPct"] = "2-3%"
        elif agg == "moderate":
            strat["positionSize"] = "Standard position (3-5% of portfolio)"
            strat["positionPct"] = "3-5%"
        else:  # conservative
            strat["positionSize"] = "Core position (5-10% of portfolio)"
            strat["positionPct"] = "5-10%"

        # Assign individual strategy grade based on aggression + overall grade
        overall_score = grade_result.get("totalScore", 0)
        if agg == "aggressive":
            adj = -5 if iv_rank > 40 else 3  # penalize aggressive when IV high
        elif agg == "conservative":
            adj = 5  # conservative always gets a slight bump
        else:
            adj = 0
        strat_score = max(0, min(100, overall_score + adj))
        if strat_score >= 95: strat["grade"] = "A+"
        elif strat_score >= 90: strat["grade"] = "A"
        elif strat_score >= 85: strat["grade"] = "A-"
        elif strat_score >= 80: strat["grade"] = "B+"
        elif strat_score >= 75: strat["grade"] = "B"
        elif strat_score >= 70: strat["grade"] = "B-"
        elif strat_score >= 65: strat["grade"] = "C+"
        elif strat_score >= 60: strat["grade"] = "C"
        elif strat_score >= 55: strat["grade"] = "C-"
        elif strat_score >= 50: strat["grade"] = "D+"
        elif strat_score >= 45: strat["grade"] = "D"
        elif strat_score >= 40: strat["grade"] = "D-"
        else: strat["grade"] = "F"
        strat["gradeScore"] = strat_score

        # Stop and targets on each strategy
        strat["stopPrice"] = round(stop, 2)
        strat["target1"] = round(target1, 2)
        strat["target2"] = round(target2, 2)

    # ── Directional bias summary ──
    if not is_short and conv_zone == "CONVERGENCE":
        bias = "STRONGLY BULLISH"
        conviction = "HIGH" if grade_result.get("totalScore", 0) >= 80 else "MODERATE"
    elif not is_short and conv_zone == "SECONDARY":
        bias = "BULLISH"
        conviction = "MODERATE"
    elif not is_short and conv_zone == "BUILDING":
        bias = "MODERATELY BULLISH"
        conviction = "LOW"
    elif is_short and stage in ("4A", "4B"):
        bias = "STRONGLY BEARISH"
        conviction = "HIGH" if grade_result.get("totalScore", 0) >= 80 else "MODERATE"
    elif is_short:
        bias = "BEARISH"
        conviction = "MODERATE"
    else:
        bias = "NEUTRAL"
        conviction = "LOW"

    return {
        "ticker": ticker,
        "spot": round(spot, 2),
        "grade": grade_result,
        "tradeable": True,
        "bias": bias,
        "conviction": conviction,
        "strategies": strategies,
        "thesis": thesis,
        "stopPrice": round(stop, 2),
        "target1": round(target1, 2),
        "target2": round(target2, 2),
        "isShort": is_short,
        "stage": wein.get("stage", "?"),
        "ivRank": iv_rank,
        "phase": phase,
        "convZone": conv_zone,
        "convScore": conv_score,
    }
```

---

# SECTION 5: WATCHLIST, JOURNAL, RISK & TOOLS

## 5a-5b. Trade Journal (backend/journal.py) — Full Contents

```python
"""
MKW Trade Journal — Logging, Analytics, and Learning Insights
File-based persistence with comprehensive performance analytics.
"""

import json
import os
import logging
import uuid
from datetime import datetime
from typing import Optional
from collections import defaultdict

log = logging.getLogger("mkw.journal")

JOURNAL_FILE = "/tmp/mkw_journal.json"


# ─────────────────────────────────────────────────────────
# PERSISTENCE
# ─────────────────────────────────────────────────────────

def _load_journal() -> list:
    try:
        if os.path.exists(JOURNAL_FILE):
            with open(JOURNAL_FILE) as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
    except Exception as e:
        log.warning(f"Journal load error: {e}")
    return []

def _save_journal(trades: list):
    try:
        with open(JOURNAL_FILE, "w") as f:
            json.dump(trades, f, indent=2, default=str)
    except Exception as e:
        log.warning(f"Journal save error: {e}")


# ─────────────────────────────────────────────────────────
# CRUD OPERATIONS
# ─────────────────────────────────────────────────────────

def add_trade(trade: dict) -> dict:
    """
    Add a new trade to the journal.
    Required: ticker, direction, strategyType, entryDate, entryPrice
    Optional: optionStrike, optionExpiry, premiumPaid, contracts, stopLevel,
              convergenceZone, grade, kellPhase, marketRegime, notes
    """
    trades = _load_journal()

    entry = {
        "id": str(uuid.uuid4()),
        "ticker": trade.get("ticker", "").upper(),
        "direction": trade.get("direction", "LONG").upper(),
        "strategyType": trade.get("strategyType", "swing_call"),
        "entryDate": trade.get("entryDate", datetime.utcnow().isoformat()),
        "entryPrice": float(trade.get("entryPrice", 0)),
        "optionStrike": trade.get("optionStrike"),
        "optionExpiry": trade.get("optionExpiry"),
        "premiumPaid": trade.get("premiumPaid"),
        "contracts": int(trade.get("contracts", 1)),
        "stopLevel": trade.get("stopLevel"),
        "target1": trade.get("target1"),
        "target2": trade.get("target2"),
        # Context at entry
        "convergenceZone": trade.get("convergenceZone", ""),
        "convergenceScore": trade.get("convergenceScore"),
        "grade": trade.get("grade", ""),
        "gradeScore": trade.get("gradeScore"),
        "kellPhase": trade.get("kellPhase", ""),
        "weinStage": trade.get("weinStage", ""),
        "rs": trade.get("rs"),
        "ivRankAtEntry": trade.get("ivRankAtEntry"),
        "marketRegime": trade.get("marketRegime", ""),
        "tplScore": trade.get("tplScore"),
        "volumeRatio": trade.get("volumeRatio"),
        # Exit
        "exitDate": trade.get("exitDate"),
        "exitPrice": trade.get("exitPrice"),
        "exitReason": trade.get("exitReason", ""),
        # P&L
        "pnlDollars": trade.get("pnlDollars"),
        "pnlPercent": trade.get("pnlPercent"),
        "holdingDays": trade.get("holdingDays"),
        # Status
        "status": trade.get("status", "OPEN"),
        "notes": trade.get("notes", ""),
        "tags": trade.get("tags", []),
        # Qullamaggie setup tagging
        "setupType": trade.get("setupType", ""),  # BREAKOUT / PARABOLIC_SHORT / PARABOLIC_LONG / EPISODIC_PIVOT / MKW_CONVERGENCE / DUAL_CONVERGENCE
        "rMultiple": trade.get("rMultiple"),  # R-multiple achieved (profit / initial risk)
        "qullamaggieScore": trade.get("qullamaggieScore"),  # Quality score at entry
        "createdAt": datetime.utcnow().isoformat(),
    }

    trades.append(entry)
    _save_journal(trades)
    return entry

def update_trade(trade_id: str, updates: dict) -> Optional[dict]:
    """Update fields on an existing trade."""
    trades = _load_journal()
    for i, t in enumerate(trades):
        if t.get("id") == trade_id:
            for k, v in updates.items():
                if k != "id" and k != "createdAt":
                    trades[i][k] = v
            trades[i]["updatedAt"] = datetime.utcnow().isoformat()

            # Auto-calculate P&L if closing
            if updates.get("status") == "CLOSED" and updates.get("exitPrice"):
                entry_price = trades[i].get("premiumPaid") or trades[i].get("entryPrice", 0)
                exit_price = float(updates["exitPrice"])
                if entry_price and entry_price > 0:
                    direction = trades[i].get("direction", "LONG")
                    if direction == "LONG":
                        pnl_pct = (exit_price / entry_price - 1) * 100
                    else:
                        pnl_pct = (1 - exit_price / entry_price) * 100
                    contracts = trades[i].get("contracts", 1)
                    pnl_dollars = (exit_price - entry_price) * 100 * contracts
                    if direction == "SHORT":
                        pnl_dollars = -pnl_dollars
                    trades[i]["pnlPercent"] = round(pnl_pct, 1)
                    trades[i]["pnlDollars"] = round(pnl_dollars, 2)

                # Holding days
                try:
                    entry_dt = datetime.fromisoformat(trades[i].get("entryDate", ""))
                    exit_dt = datetime.fromisoformat(updates.get("exitDate", datetime.utcnow().isoformat()))
                    trades[i]["holdingDays"] = (exit_dt - entry_dt).days
                except Exception:
                    pass

            _save_journal(trades)
            return trades[i]
    return None

def delete_trade(trade_id: str) -> bool:
    """Delete a trade from the journal."""
    trades = _load_journal()
    original_len = len(trades)
    trades = [t for t in trades if t.get("id") != trade_id]
    if len(trades) < original_len:
        _save_journal(trades)
        return True
    return False

def get_trades(status: str = "", ticker: str = "", limit: int = 100) -> list:
    """Get trades with optional filters."""
    trades = _load_journal()

    if status:
        trades = [t for t in trades if t.get("status", "").upper() == status.upper()]
    if ticker:
        trades = [t for t in trades if t.get("ticker", "").upper() == ticker.upper()]

    # Sort by entry date descending
    trades.sort(key=lambda x: x.get("entryDate", ""), reverse=True)
    return trades[:limit]

def get_trade(trade_id: str) -> Optional[dict]:
    """Get a single trade by ID."""
    trades = _load_journal()
    for t in trades:
        if t.get("id") == trade_id:
            return t
    return None


# ─────────────────────────────────────────────────────────
# PERFORMANCE ANALYTICS
# ─────────────────────────────────────────────────────────

def compute_analytics() -> dict:
    """
    Comprehensive performance analytics across all closed trades.
    """
    trades = _load_journal()
    closed = [t for t in trades if t.get("status") == "CLOSED" and t.get("pnlPercent") is not None]
    open_trades = [t for t in trades if t.get("status") == "OPEN"]

    if not closed:
        return {
            "totalTrades": len(trades),
            "openTrades": len(open_trades),
            "closedTrades": 0,
            "noDataMessage": "No closed trades yet. Start logging trades to see analytics.",
        }

    # Core metrics
    wins = [t for t in closed if t["pnlPercent"] > 0]
    losses = [t for t in closed if t["pnlPercent"] <= 0]
    win_pcts = [t["pnlPercent"] for t in wins]
    loss_pcts = [t["pnlPercent"] for t in losses]

    win_rate = round(len(wins) / len(closed) * 100, 1) if closed else 0
    avg_win = round(sum(win_pcts) / len(win_pcts), 1) if win_pcts else 0
    avg_loss = round(sum(loss_pcts) / len(loss_pcts), 1) if loss_pcts else 0
    total_pnl = sum(t.get("pnlDollars", 0) or 0 for t in closed)
    total_pnl_pct = sum(t["pnlPercent"] for t in closed)

    gross_profit = sum(t.get("pnlDollars", 0) or 0 for t in wins)
    gross_loss = abs(sum(t.get("pnlDollars", 0) or 0 for t in losses))
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else float('inf')

    avg_hold = round(sum(t.get("holdingDays", 0) or 0 for t in closed) / len(closed), 1) if closed else 0

    # Largest winners and losers
    sorted_by_pnl = sorted(closed, key=lambda x: x["pnlPercent"], reverse=True)
    largest_winners = sorted_by_pnl[:3]
    largest_losers = sorted_by_pnl[-3:]

    # Win rate by grade
    by_grade = _win_rate_by_field(closed, "grade")

    # Win rate by convergence zone
    by_zone = _win_rate_by_field(closed, "convergenceZone")

    # Win rate by Kell phase at entry
    by_phase = _win_rate_by_field(closed, "kellPhase")

    # Win rate by IV rank bucket at entry
    by_iv = _win_rate_by_iv(closed)

    # Win rate by market regime
    by_regime = _win_rate_by_field(closed, "marketRegime")

    # Win rate by strategy type
    by_strategy = _win_rate_by_field(closed, "strategyType")

    # Win rate by Qullamaggie setup type
    by_setup_type = _win_rate_by_field(closed, "setupType")

    # R-multiple analytics by setup type
    r_multiple_stats = _r_multiple_by_setup(closed)

    # Monthly P&L
    monthly = _monthly_pnl(closed)

    # Rolling 20-trade win rate
    rolling = _rolling_win_rate(closed, window=20)

    # Streaks
    max_win_streak, max_loss_streak, current_streak = _calc_streaks(closed)

    return {
        "totalTrades": len(trades),
        "openTrades": len(open_trades),
        "closedTrades": len(closed),
        "overview": {
            "winRate": win_rate,
            "avgWin": avg_win,
            "avgLoss": avg_loss,
            "profitFactor": profit_factor,
            "totalPnlDollars": round(total_pnl, 2),
            "totalPnlPct": round(total_pnl_pct, 1),
            "avgHoldingDays": avg_hold,
            "maxWinStreak": max_win_streak,
            "maxLossStreak": max_loss_streak,
            "currentStreak": current_streak,
        },
        "largestWinners": [_trade_summary(t) for t in largest_winners],
        "largestLosers": [_trade_summary(t) for t in largest_losers],
        "byGrade": by_grade,
        "byZone": by_zone,
        "byPhase": by_phase,
        "byIVRank": by_iv,
        "byRegime": by_regime,
        "byStrategy": by_strategy,
        "bySetupType": by_setup_type,
        "rMultipleStats": r_multiple_stats,
        "monthly": monthly,
        "rollingWinRate": rolling,
        "insights": _generate_insights(closed, by_grade, by_zone, by_phase, by_iv, win_rate),
    }


def _trade_summary(t: dict) -> dict:
    return {
        "id": t.get("id"),
        "ticker": t.get("ticker"),
        "direction": t.get("direction"),
        "strategyType": t.get("strategyType"),
        "entryDate": t.get("entryDate"),
        "exitDate": t.get("exitDate"),
        "pnlPercent": t.get("pnlPercent"),
        "pnlDollars": t.get("pnlDollars"),
        "grade": t.get("grade"),
        "convergenceZone": t.get("convergenceZone"),
        "kellPhase": t.get("kellPhase"),
        "holdingDays": t.get("holdingDays"),
    }


def _win_rate_by_field(closed: list, field: str) -> list:
    groups = defaultdict(list)
    for t in closed:
        key = t.get(field, "Unknown") or "Unknown"
        groups[key].append(t)

    results = []
    for key, trades in sorted(groups.items()):
        wins = [t for t in trades if t["pnlPercent"] > 0]
        wr = round(len(wins) / len(trades) * 100, 1) if trades else 0
        avg_pnl = round(sum(t["pnlPercent"] for t in trades) / len(trades), 1)
        results.append({
            "label": key,
            "trades": len(trades),
            "winRate": wr,
            "avgPnl": avg_pnl,
            "totalPnl": round(sum(t.get("pnlDollars", 0) or 0 for t in trades), 2),
        })
    return results


def _win_rate_by_iv(closed: list) -> list:
    buckets = {"0-20": [], "20-40": [], "40-60": [], "60-80": [], "80-100": []}
    for t in closed:
        iv = t.get("ivRankAtEntry")
        if iv is None:
            continue
        iv = float(iv)
        if iv < 20: buckets["0-20"].append(t)
        elif iv < 40: buckets["20-40"].append(t)
        elif iv < 60: buckets["40-60"].append(t)
        elif iv < 80: buckets["60-80"].append(t)
        else: buckets["80-100"].append(t)

    results = []
    for label, trades in buckets.items():
        if not trades:
            results.append({"label": f"IV Rank {label}", "trades": 0, "winRate": 0, "avgPnl": 0})
            continue
        wins = [t for t in trades if t["pnlPercent"] > 0]
        wr = round(len(wins) / len(trades) * 100, 1)
        avg_pnl = round(sum(t["pnlPercent"] for t in trades) / len(trades), 1)
        results.append({
            "label": f"IV Rank {label}",
            "trades": len(trades),
            "winRate": wr,
            "avgPnl": avg_pnl,
        })
    return results


def _monthly_pnl(closed: list) -> list:
    months = defaultdict(lambda: {"pnl": 0, "trades": 0, "wins": 0})
    for t in closed:
        try:
            dt = datetime.fromisoformat(t.get("exitDate", t.get("entryDate", "")))
            key = dt.strftime("%Y-%m")
            months[key]["pnl"] += t.get("pnlDollars", 0) or 0
            months[key]["trades"] += 1
            if t["pnlPercent"] > 0:
                months[key]["wins"] += 1
        except Exception:
            pass

    results = []
    for month in sorted(months.keys()):
        data = months[month]
        wr = round(data["wins"] / data["trades"] * 100, 1) if data["trades"] > 0 else 0
        results.append({
            "month": month,
            "pnl": round(data["pnl"], 2),
            "trades": data["trades"],
            "winRate": wr,
        })
    return results


def _rolling_win_rate(closed: list, window: int = 20) -> list:
    sorted_trades = sorted(closed, key=lambda x: x.get("exitDate", x.get("entryDate", "")))
    results = []
    for i in range(window, len(sorted_trades) + 1):
        batch = sorted_trades[i-window:i]
        wins = sum(1 for t in batch if t["pnlPercent"] > 0)
        wr = round(wins / window * 100, 1)
        results.append({
            "tradeNum": i,
            "winRate": wr,
            "lastTicker": batch[-1].get("ticker", ""),
        })
    return results


def _calc_streaks(closed: list) -> tuple:
    sorted_trades = sorted(closed, key=lambda x: x.get("exitDate", x.get("entryDate", "")))
    max_win = 0
    max_loss = 0
    current = 0
    current_type = None

    for t in sorted_trades:
        if t["pnlPercent"] > 0:
            if current_type == "win":
                current += 1
            else:
                current = 1
                current_type = "win"
            max_win = max(max_win, current)
        else:
            if current_type == "loss":
                current += 1
            else:
                current = 1
                current_type = "loss"
            max_loss = max(max_loss, current)

    streak_label = f"{current} {'win' if current_type == 'win' else 'loss'}{'s' if current > 1 else ''}"
    return max_win, max_loss, streak_label


def _r_multiple_by_setup(closed: list) -> list:
    """Calculate average R-multiple by Qullamaggie setup type."""
    groups = defaultdict(list)
    for t in closed:
        setup_type = t.get("setupType")
        r_mult = t.get("rMultiple")
        if setup_type and r_mult is not None:
            groups[setup_type].append(float(r_mult))

    results = []
    for stype, r_values in sorted(groups.items()):
        if not r_values:
            continue
        wins = [r for r in r_values if r > 0]
        losses = [r for r in r_values if r <= 0]
        avg_winner = round(sum(wins) / len(wins), 1) if wins else 0
        avg_loser = round(sum(losses) / len(losses), 1) if losses else 0
        win_rate = round(len(wins) / len(r_values) * 100, 1)
        expectancy = round(sum(r_values) / len(r_values), 2)
        results.append({
            "setupType": stype,
            "trades": len(r_values),
            "winRate": win_rate,
            "avgWinnerR": avg_winner,
            "avgLoserR": avg_loser,
            "expectancyR": expectancy,
        })
    return results


def _generate_insights(closed: list, by_grade: list, by_zone: list,
                       by_phase: list, by_iv: list, overall_wr: float) -> list:
    """Auto-generate learning insights from trade data."""
    insights = []

    # Grade performance
    for g in by_grade:
        if g["trades"] >= 3:
            if g["label"] in ("AAA", "AA") and g["winRate"] > overall_wr:
                insights.append(
                    f"Your {g['label']} setups have a {g['winRate']:.0f}% win rate with avg {g['avgPnl']:+.1f}% gain "
                    f"across {g['trades']} trades. The grading system IS working — prioritize these setups."
                )
            elif g["label"] in ("BBB", "BB", "B") and g["winRate"] < 50:
                insights.append(
                    f"Your {g['label']} setups have only {g['winRate']:.0f}% win rate with avg {g['avgPnl']:+.1f}% return. "
                    f"The data confirms: avoid trading below A-grade setups."
                )

    # Phase performance
    for p in by_phase:
        if p["trades"] >= 3:
            if p["label"] in ("EMA Crossback", "Pop") and p["winRate"] >= 70:
                insights.append(
                    f"Entries during '{p['label']}' phase: {p['winRate']:.0f}% win rate. "
                    f"This confirms the phase as a high-probability entry window."
                )
            elif p["label"] == "Extension" and p["winRate"] < 50:
                insights.append(
                    f"Entries during 'Extension' phase: only {p['winRate']:.0f}% win rate. "
                    f"You're chasing. Wait for pullbacks to the 10/20 EMA."
                )

    # IV rank performance
    for iv in by_iv:
        if iv["trades"] >= 3:
            if "0-20" in iv["label"] or "20-40" in iv["label"]:
                if iv["winRate"] > overall_wr:
                    insights.append(
                        f"Low IV entries ({iv['label']}): {iv['winRate']:.0f}% win rate. "
                        f"Cheap options + strong setups = edge. Keep prioritizing low IV."
                    )
            elif "60-80" in iv["label"] or "80-100" in iv["label"]:
                if iv["winRate"] < overall_wr:
                    insights.append(
                        f"High IV entries ({iv['label']}): only {iv['winRate']:.0f}% win rate. "
                        f"Premium drag is real. Use spreads or skip when IV Rank > 60."
                    )

    # Zone performance
    for z in by_zone:
        if z["trades"] >= 3:
            if z["label"] == "CONVERGENCE" and z["winRate"] >= 65:
                insights.append(
                    f"Full CONVERGENCE setups: {z['winRate']:.0f}% win rate across {z['trades']} trades. "
                    f"This IS your edge. Trade these with conviction."
                )
            elif z["label"] in ("BUILDING", "WATCH") and z["winRate"] < 50:
                insights.append(
                    f"'{z['label']}' zone entries: {z['winRate']:.0f}% win rate. "
                    f"These are low-probability. Wait for full convergence."
                )

    # Volume rule
    vol_trades = [t for t in closed if t.get("volumeRatio") is not None]
    if len(vol_trades) >= 5:
        low_vol = [t for t in vol_trades if (t.get("volumeRatio", 1) or 1) < 1.2]
        high_vol = [t for t in vol_trades if (t.get("volumeRatio", 1) or 1) >= 1.5]
        if low_vol and high_vol:
            low_wr = sum(1 for t in low_vol if t["pnlPercent"] > 0) / len(low_vol) * 100
            high_wr = sum(1 for t in high_vol if t["pnlPercent"] > 0) / len(high_vol) * 100
            if high_wr > low_wr + 10:
                insights.append(
                    f"Volume matters: entries with volume >1.5x average have {high_wr:.0f}% win rate "
                    f"vs {low_wr:.0f}% for low-volume entries. Enforce the volume rule."
                )

    if not insights:
        insights.append("Keep logging trades. Meaningful insights require at least 10-20 closed trades across different categories.")

    return insights
```

## 5c. Trade Rules / Risk (backend/trade_rules.py) — Full Contents

```python
"""
Qullamaggie Trade Rules Engine
Entry/stop/exit plan generation for Breakouts, Parabolic Shorts, and Episodic Pivots.
"""

import logging

log = logging.getLogger("mkw.trade_rules")


def generate_trade_plan(setup_type, setup_data, current_price, atr):
    """
    Generate complete entry/stop/exit plan for each Qullamaggie setup.
    Returns a trade plan dict with all management rules.
    """
    if current_price <= 0 or atr <= 0:
        return None

    if setup_type == 'BREAKOUT':
        return _breakout_plan(setup_data, current_price, atr)
    elif setup_type == 'PARABOLIC_SHORT':
        return _parabolic_short_plan(setup_data, current_price, atr)
    elif setup_type == 'PARABOLIC_LONG':
        return _parabolic_long_plan(setup_data, current_price, atr)
    elif setup_type == 'EPISODIC_PIVOT':
        return _ep_plan(setup_data, current_price, atr)
    else:
        return None


def _breakout_plan(setup_data, current_price, atr):
    """Breakout trade plan: buy on range expansion, stop at day lows / 1x ATR."""
    entry = setup_data.get('consolidation_high', current_price)

    # Stop: day low or 1x ATR, whichever is tighter
    day_low = setup_data.get('day_low', current_price - atr)
    initial_stop = max(current_price - atr, day_low)
    stop_distance = current_price - initial_stop

    # Ensure stop not wider than 1.5x ATR
    if stop_distance > atr * 1.5:
        initial_stop = current_price - atr
        stop_distance = atr

    stop_pct = (stop_distance / current_price) * 100

    # R-multiple targets
    risk = stop_distance
    target_3r = current_price + (risk * 3)
    target_5r = current_price + (risk * 5)
    target_10r = current_price + (risk * 10)
    target_20r = current_price + (risk * 20)

    sma_10 = setup_data.get('sma_10', current_price)
    sma_20 = setup_data.get('sma_20', current_price)

    return {
        'setup_type': 'BREAKOUT',
        'entry_price': round(entry, 2),
        'entry_trigger': f"Buy on break above ${entry:.2f} with volume > 1.5x average",
        'initial_stop': round(initial_stop, 2),
        'stop_distance': round(stop_distance, 2),
        'stop_pct': round(stop_pct, 1),
        'stop_rule': f"Stop at ${initial_stop:.2f} (low of day or 1x ATR, whichever is tighter)",
        'management': [
            f"Days 1-2: Hold full position. Stop at ${initial_stop:.2f}",
            f"Days 3-5: Sell 1/3 to 1/2 of position. Move stop to breakeven (${entry:.2f})",
            f"Remaining: Trail with 10-day SMA (${sma_10:.2f}). If closes below, exit.",
            "Extended move: Switch trail to 20-day SMA for wider hold",
        ],
        'targets': {
            '3R': round(target_3r, 2),
            '5R': round(target_5r, 2),
            '10R': round(target_10r, 2),
            '20R': round(target_20r, 2),
        },
        'risk_reward': {
            '3R_ratio': '3:1',
            '5R_ratio': '5:1',
            '10R_ratio': '10:1',
            '20R_ratio': '20:1 (trail for this)',
        },
        'risk_per_share': round(risk, 2),
        'position_size_note': "Size so that if stopped out, loss = 0.5-1% of portfolio",
    }


def _parabolic_short_plan(setup_data, current_price, atr):
    """Parabolic short: short on first crack, stop above high."""
    entry = current_price

    # Stop above the parabolic high
    recent_high = setup_data.get('recent_high', current_price * 1.05)
    initial_stop = recent_high * 1.01
    stop_distance = initial_stop - current_price

    # Targets: 10 and 20 day SMAs
    target_10sma = setup_data.get('sma_10', current_price * 0.9)
    target_20sma = setup_data.get('sma_20', current_price * 0.85)

    reward_1 = current_price - target_10sma
    risk = stop_distance
    rr_1 = reward_1 / risk if risk > 0 else 0

    return {
        'setup_type': 'PARABOLIC_SHORT',
        'entry_price': round(entry, 2),
        'entry_trigger': "Short on opening range lows or first fail at VWAP. Wait for first crack.",
        'initial_stop': round(initial_stop, 2),
        'stop_distance': round(stop_distance, 2),
        'stop_rule': f"Stop above parabolic high at ${initial_stop:.2f}",
        'management': [
            f"Target 1: 10-day SMA at ${target_10sma:.2f} — cover 1/2",
            f"Target 2: 20-day SMA at ${target_20sma:.2f} — cover remaining",
            "If stock reclaims VWAP after entry, exit immediately",
        ],
        'targets': {
            '10SMA': round(target_10sma, 2),
            '20SMA': round(target_20sma, 2),
        },
        'risk_reward': f"{rr_1:.1f}:1 to 10 SMA (typically 5-10x R/R)",
        'risk_per_share': round(risk, 2),
        'win_rate_note': "Higher win rate than breakouts (50-60%) but capped upside. Quick trades.",
    }


def _parabolic_long_plan(setup_data, current_price, atr):
    """Parabolic long bounce: buy oversold snap-back."""
    entry = current_price

    # Stop below the capitulation low
    initial_stop = current_price - atr * 1.5
    stop_distance = current_price - initial_stop

    target_10sma = setup_data.get('sma_10', current_price * 1.1)
    target_20sma = setup_data.get('sma_20', current_price * 1.15)

    reward_1 = target_10sma - current_price
    risk = stop_distance
    rr_1 = reward_1 / risk if risk > 0 else 0

    return {
        'setup_type': 'PARABOLIC_LONG',
        'entry_price': round(entry, 2),
        'entry_trigger': "Buy on first green day after 3+ consecutive down days with capitulation volume.",
        'initial_stop': round(initial_stop, 2),
        'stop_distance': round(stop_distance, 2),
        'stop_rule': f"Stop at ${initial_stop:.2f} (1.5x ATR below entry)",
        'management': [
            f"Target 1: 10-day SMA at ${target_10sma:.2f} — sell 1/2",
            f"Target 2: 20-day SMA at ${target_20sma:.2f} — sell remaining",
            "Quick trade — mean reversion, not trend following",
        ],
        'targets': {
            '10SMA': round(target_10sma, 2),
            '20SMA': round(target_20sma, 2),
        },
        'risk_reward': f"{rr_1:.1f}:1 to 10 SMA",
        'risk_per_share': round(risk, 2),
    }


def _ep_plan(setup_data, current_price, atr):
    """Episodic Pivot: buy on opening range highs, stop at EP day lows, trail wide."""
    entry = current_price

    # Stop at EP day lows
    ep_day_low = setup_data.get('day_low', current_price * 0.95)
    initial_stop = ep_day_low
    stop_distance = current_price - initial_stop
    stop_pct = (stop_distance / current_price) * 100

    risk = stop_distance
    target_3r = current_price + (risk * 3)
    target_5r = current_price + (risk * 5)

    return {
        'setup_type': 'EPISODIC_PIVOT',
        'entry_price': round(entry, 2),
        'entry_trigger': "Buy on opening range highs. Must have 10%+ gap AND 3x+ volume.",
        'initial_stop': round(initial_stop, 2),
        'stop_distance': round(stop_distance, 2),
        'stop_pct': round(stop_pct, 1),
        'stop_rule': f"Stop at EP day lows ${initial_stop:.2f}",
        'management': [
            f"Days 1-3: Hold full position. Stop at EP day low ${initial_stop:.2f}",
            "Days 3-5: Sell 1/3 on strength. Move stop to breakeven.",
            "Trail remaining with 10-day SMA. EPs can run for months.",
            "If stock bases constructively above 20-day SMA, add on breakout of that base.",
        ],
        'targets': {
            '3R': round(target_3r, 2),
            '5R': round(target_5r, 2),
            'trail': "10-day SMA trailing — let it run",
        },
        'risk_per_share': round(risk, 2),
        'ep_note': "EPs can trigger multi-month or multi-year moves. Trail wide. Be patient.",
    }


def calculate_r_multiple(entry_price, exit_price, stop_price, direction="LONG"):
    """Calculate the R-multiple achieved on a closed trade."""
    if entry_price <= 0 or stop_price <= 0:
        return 0

    risk = abs(entry_price - stop_price)
    if risk == 0:
        return 0

    if direction == "LONG":
        profit = exit_price - entry_price
    else:
        profit = entry_price - exit_price

    return round(profit / risk, 2)
```

## 5d. AI Wizard / Market Brief (backend/wizard.py) — Full Contents

```python
"""
MKW Market Wizard — AI chat agent with market context injection.
Handles query classification, ticker extraction, context formatting,
and system prompt construction.
"""

import re
import logging
from typing import Optional

log = logging.getLogger("mkw.wizard")

# ─────────────────────────────────────────────
# QUERY CLASSIFICATION
# ─────────────────────────────────────────────
MARKET_KEYWORDS = {
    "market", "spy", "qqq", "iwm", "breadth", "sector", "vix",
    "volatility", "trend", "bull", "bear", "correction", "rally", "selloff",
    "today", "premarket", "after hours", "futures", "s&p", "nasdaq", "dow",
    "rotation", "risk", "sentiment", "fed", "fomc", "cpi", "jobs",
    "macro", "rates", "yields", "bonds", "inflation",
}

COMPLEX_KEYWORDS = {
    "analyze", "analysis", "compare", "strategy", "should i",
    "what stage", "convergence", "setup", "entry", "options", "risk reward",
    "weinstein", "minervini", "kell", "backtest", "portfolio", "allocat",
    "explain why", "break down", "deep dive", "trade idea", "swing",
    "best play", "top pick", "recommendation", "thesis",
}

FRAMEWORK_KEYWORDS = {
    "explain", "what is", "how does", "teach", "define", "stage analysis",
    "vcp", "trend template", "ema", "convergence", "kell", "weinstein",
    "minervini", "relative strength", "rs rating", "breakout",
}

# Known tickers for extraction (subset — extend as needed)
KNOWN_TICKERS = {
    "AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "AVGO",
    "JPM", "V", "UNH", "MA", "HD", "PG", "JNJ", "ABBV", "MRK", "LLY",
    "COST", "NFLX", "AMD", "CRM", "ADBE", "ORCL", "CSCO", "ACN", "TXN",
    "INTC", "QCOM", "AMAT", "LRCX", "KLAC", "SNPS", "CDNS", "MRVL",
    "NOW", "UBER", "SQ", "SHOP", "COIN", "PLTR", "RBLX", "SNOW",
    "XOM", "CVX", "COP", "SLB", "OXY", "EOG", "MPC", "VLO", "PSX",
    "BA", "CAT", "GE", "HON", "UPS", "FDX", "RTX", "LMT", "DE",
    "DIS", "CMCSA", "T", "VZ", "TMUS", "CHTR", "PARA", "WBD",
    "GS", "MS", "C", "BAC", "WFC", "BLK", "SCHW", "AXP",
    "PFE", "BMY", "GILD", "AMGN", "REGN", "VRTX", "ISRG", "TMO",
    "SPY", "QQQ", "IWM", "DIA", "XLK", "XLF", "XLE", "XLV", "XLI",
    "SMCI", "ARM", "PANW", "CRWD", "DDOG", "NET", "ZS", "FTNT",
    "CVNA", "HIMS", "BYND", "SNAP", "RIVN", "LCID",
}


def classify_query(message: str) -> dict:
    """Classify a user query to determine routing."""
    lower = message.lower()
    words = set(lower.split())

    needs_market = bool(words & MARKET_KEYWORDS) or any(kw in lower for kw in ["how's the market", "market today", "what's happening"])
    needs_reasoning = bool(words & COMPLEX_KEYWORDS) or any(kw in lower for kw in COMPLEX_KEYWORDS)
    is_framework = bool(words & FRAMEWORK_KEYWORDS) or any(kw in lower for kw in FRAMEWORK_KEYWORDS)
    tickers = extract_tickers(message)
    needs_ticker_data = len(tickers) > 0

    # Determine max tokens
    if is_framework and not needs_ticker_data:
        max_tokens = 1500
    elif needs_reasoning or needs_ticker_data:
        max_tokens = 2000
    elif needs_market:
        max_tokens = 1200
    else:
        max_tokens = 800  # General chat

    return {
        "needs_market_data": needs_market or needs_ticker_data,
        "needs_ticker_data": needs_ticker_data,
        "tickers": tickers[:5],  # Max 5
        "needs_reasoning": needs_reasoning,
        "is_framework_question": is_framework,
        "max_tokens": max_tokens,
    }


def extract_tickers(message: str) -> list:
    """Extract stock tickers from a message."""
    tickers = set()

    # Match $TICK format
    dollar_matches = re.findall(r'\$([A-Z]{1,5})\b', message)
    tickers.update(dollar_matches)

    # Match known tickers (uppercase words)
    upper_words = re.findall(r'\b([A-Z]{2,5})\b', message)
    for w in upper_words:
        if w in KNOWN_TICKERS:
            tickers.add(w)

    # Remove common false positives
    tickers -= {"I", "A", "IT", "AT", "IS", "AN", "OR", "IF", "ON", "IN", "TO", "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HAS", "HER", "WAS", "ONE", "OUR", "OUT", "DAY", "GET", "HAS", "HIM", "HIS", "HOW", "MAN", "NEW", "NOW", "OLD", "SEE", "WAY", "WHO", "DID", "ITS", "LET", "SAY", "SHE", "TOO", "USE"}

    return list(tickers)


# ─────────────────────────────────────────────
# CONTEXT FORMATTING (token-efficient)
# ─────────────────────────────────────────────
def format_market_context(breadth: dict) -> str:
    """Format breadth/market data compactly."""
    if not breadth:
        return ""

    lines = ["MARKET SNAPSHOT:"]

    # SPX/QQQ/IWM
    for key in ["spx", "spy", "qqq", "iwm"]:
        d = breadth.get(key, {})
        if d:
            stage = d.get("stage", d.get("stageLabel", "?"))
            price = d.get("price", d.get("px", "?"))
            chg = d.get("change", d.get("chg", d.get("dp", "?")))
            lines.append(f"  {key.upper()}: ${price} ({chg:+.1f}%) Stage {stage}" if isinstance(chg, (int, float)) else f"  {key.upper()}: ${price} Stage {stage}")

    vix = breadth.get("vix", "?")
    lines.append(f"  VIX: {vix}")

    # Sectors
    sectors = breadth.get("sectors", breadth.get("sectorPerf", []))
    if sectors:
        sec_strs = []
        for s in sectors[:6]:
            name = s.get("n", s.get("name", "?"))
            perf = s.get("p", s.get("change", 0))
            sec_strs.append(f"{name}:{perf:+.1f}%" if isinstance(perf, (int, float)) else f"{name}:{perf}")
        lines.append(f"  Sectors: {', '.join(sec_strs)}")

    # Kell light
    light = breadth.get("kell", breadth.get("kellLight", ""))
    if light:
        lines.append(f"  Kell Light: {light}")

    return "\n".join(lines)


def format_ticker_context(ticker: str, data: dict) -> str:
    """Format a single ticker's analysis compactly."""
    if not data:
        return f"\nTICKER {ticker}: No data available"

    lines = [f"\nTICKER {ticker}:"]

    price = data.get("price", data.get("px", "?"))
    chg = data.get("day_change", data.get("dp", 0))
    lines.append(f"  Price: ${price} ({chg:+.1f}%)" if isinstance(chg, (int, float)) else f"  Price: ${price}")

    stage = data.get("stage", data.get("weinstein_stage", "?"))
    score = data.get("convergence_score", data.get("score", "?"))
    zone = data.get("zone", "?")
    grade = data.get("grade", "?")
    lines.append(f"  Stage: {stage} | Score: {score}/23 | Zone: {zone} | Grade: {grade}")

    rs = data.get("rs", data.get("relative_strength", "?"))
    tpl = data.get("template_score", data.get("minervini_score", "?"))
    phase = data.get("kell_phase", data.get("phase", "?"))
    lines.append(f"  RS: {rs} | Template: {tpl}/8 | Kell Phase: {phase}")

    # Key technicals
    techs = data.get("technicals", {})
    if techs:
        rsi = techs.get("rsi", "?")
        adx = techs.get("adx", "?")
        lines.append(f"  RSI: {rsi} | ADX: {adx}")
        h52 = techs.get("high52", data.get("high_52w", "?"))
        l52 = techs.get("low52", data.get("low_52w", "?"))
        lines.append(f"  52W High: ${h52} | 52W Low: ${l52}")

    # VCP
    vcp = data.get("vcp", {})
    if isinstance(vcp, dict) and vcp.get("count", 0) >= 2:
        lines.append(f"  VCP: {vcp['count']} contractions, pivot ${vcp.get('pivot', '?')}")

    # Fundamentals
    fund = data.get("fundamentals", {})
    if fund:
        eps = fund.get("eps", fund.get("eps_growth"))
        rev = fund.get("rev", fund.get("rev_growth"))
        mcap = fund.get("marketCap", data.get("market_cap", 0))
        sector = fund.get("sector", data.get("sector", "?"))
        cap_str = f"${mcap / 1e9:.1f}B" if mcap and mcap > 1e9 else f"${mcap / 1e6:.0f}M" if mcap and mcap > 1e6 else "?"
        lines.append(f"  EPS Growth: {eps}% | Rev Growth: {rev}% | Cap: {cap_str} | Sector: {sector}")

    # FINRA SVR
    finra = data.get("finra", {})
    if isinstance(finra, dict) and finra.get("svr_today") is not None:
        lines.append(f"  SVR: {finra['svr_today']}% ({finra.get('signal', '?')})")

    # S/R levels
    sr = data.get("srLevels", [])
    if sr:
        supports = [f"${l['price']:.2f}" for l in sr if l.get("type") == "support"][:3]
        resists = [f"${l['price']:.2f}" for l in sr if l.get("type") == "resistance"][:3]
        if supports:
            lines.append(f"  Support: {', '.join(supports)}")
        if resists:
            lines.append(f"  Resistance: {', '.join(resists)}")

    return "\n".join(lines)


def format_watchlist_summary(stocks: list) -> str:
    """Format top watchlist stocks compactly."""
    if not stocks:
        return ""

    lines = ["\nTOP WATCHLIST SETUPS:"]
    sorted_stocks = sorted(stocks, key=lambda s: s.get("convergence_score", s.get("score", 0)), reverse=True)

    for s in sorted_stocks[:8]:
        ticker = s.get("ticker", s.get("tk", "?"))
        zone = s.get("zone", "?")
        score = s.get("convergence_score", s.get("score", "?"))
        grade = s.get("grade", "?")
        price = s.get("price", s.get("px", "?"))
        chg = s.get("day_change", s.get("dp", 0))
        chg_str = f"{chg:+.1f}%" if isinstance(chg, (int, float)) else ""
        lines.append(f"  {ticker}: ${price} {chg_str} | {zone} | Score {score}/23 | Grade {grade}")

    return "\n".join(lines)


# ─────────────────────────────────────────────
# SYSTEM PROMPT
# ─────────────────────────────────────────────
SYSTEM_PROMPT_TEMPLATE = """You are the MKW Market Wizard — an elite trading strategist and market analyst embedded in the MKW Command Center. You combine the methodologies of three legendary traders into one unified framework.

IDENTITY & PERSONALITY:
- Speak with authority but accessibility — like a veteran floor trader mentoring a sharp student
- Be direct, actionable, and concise — no filler, no disclaimers, no hedge-everything corporate tone
- Use trading terminology naturally: "the tape," "constructive action," "shaking out weak hands," etc.
- Give opinions and convictions when asked — "I like this setup" not "one might consider"
- When you don't know something or data is missing, say so directly
- Use clean structure with minimal emojis for visual scanning
- Keep responses focused — answer what was asked, don't over-explain

THE MKW CONVERGENCE FRAMEWORK:
You analyze stocks through the convergence of three proven methodologies. When all three align, conviction is highest.

1. WEINSTEIN STAGE ANALYSIS (Macro Trend):
   - Stage 1: Price sideways around flattening 30-week MA. Accumulation. NOT actionable.
   - Stage 2: Price ABOVE rising 30-week MA. THE ONLY STAGE TO BE LONG. Buy breakouts from 1→2 and first pullbacks.
   - Stage 3: Price churning around flattening 30-week MA. Distribution. Exit.
   - Stage 4: Price BELOW declining 30-week MA. AVOID or SHORT only.

2. MINERVINI SEPA/VCP TEMPLATE (Entry Precision):
   - Trend Template: Price > 150d > 200d MA (rising), within 25% of 52W high, 30%+ above 52W low, RS ≥ 70
   - VCP: Contracting price ranges on declining volume → breakout from tightest contraction
   - Pivot point = breakout level from final contraction

3. KELL EMA PHASE SYSTEM (Momentum Timing):
   - EMA Stack: 10 > 20 > 50 > 120 > 200 > 400 = max momentum
   - 10/20 EMA zone = the "action zone" for pullback entries
   - EMA Crossback = highest-probability entry phase (pullback to rising 20 EMA)

CONVERGENCE SCORING (0-23 points):
- Market (3): Index stage, Kell light, template qualifier count
- Trend (5): Stock stage, 8/8 template, RS>70, above EMAs, MA stacking
- Fundamentals (3): EPS>20%, Rev>15%, expanding margins
- Entry (4): VCP 2+ contractions, volume expansion, EMA crossback/pop, within 5% of pivot
- Risk (3): Stop placement, max risk 7-8%, R:R ≥ 3:1
- FINRA SVR (1): Favorable short volume ratio

Zones: CONVERGENCE (≥21) | SECONDARY (≥16) | BUILDING (≥11) | WATCH (<11)

EMA PERIODS: 10, 20, 50, 120, 200, 400

RESPONSE FORMATTING:
For ticker analysis:
📊 [TICKER] — $[PRICE] ([CHANGE]%)
⚡ Stage: [X] | MKW Score: [X/23] | Grade: [X]
📈 Trend: [EMA stack / phase status]
🎯 Setup: [What the chart is doing]
📍 Levels: Support [X] | Resistance [X]
💡 Action: [BUY/HOLD/AVOID/SELL] — [rationale]
🎯 Entry: $X | Stop: $X | Target: $X | R/R: 1:X
📋 Options: [strategy if relevant]

For market overview:
🌍 MARKET PULSE
• SPY/QQQ/IWM status
• VIX interpretation
• Breadth assessment
• Sector leadership
💡 Bottom Line: [actionable takeaway]

LIMITATIONS (be honest):
- No order flow, dark pool, or Level 2 data
- Cannot execute trades
- Options pricing is approximate — verify with broker
- Analysis is probabilistic, not predictive
- Risk management is ALWAYS priority #1

{market_context}

Remember: You are a TRADING STRATEGIST. Frame everything as analysis and trade ideas. Always emphasize risk management."""


def build_system_prompt(market_context: str = "") -> str:
    """Build the system prompt with injected market context."""
    ctx = f"\nCURRENT MARKET DATA:\n{market_context}" if market_context else "\nNo live market data loaded for this query. If asked about specific prices or conditions, let the user know you need them to mention a ticker so the system can fetch fresh data."
    return SYSTEM_PROMPT_TEMPLATE.replace("{market_context}", ctx)


# ─────────────────────────────────────────────
# FOLLOW-UP SUGGESTIONS
# ─────────────────────────────────────────────
def generate_follow_ups(message: str, response_text: str, tickers: list) -> list:
    """Generate contextual follow-up suggestions."""
    lower = message.lower()
    suggestions = []

    if tickers:
        t = tickers[0]
        suggestions.append(f"Options play for {t}")
        suggestions.append(f"What's the stop for {t}?")
        if len(tickers) > 1:
            suggestions.append(f"Compare {tickers[0]} vs {tickers[1]}")

    elif "market" in lower or "today" in lower or "breadth" in lower:
        suggestions = ["Which sectors are leading?", "Any Stage 2 breakouts?", "Best setups right now"]

    elif any(kw in lower for kw in ["explain", "what is", "how", "teach"]):
        suggestions = ["Show me an example", "How do I find these setups?", "What's the risk?"]

    else:
        suggestions = ["What's the market doing?", "Analyze $NVDA", "Best setups right now"]

    return suggestions[:3]
```

## 5e. Frontend Watchlist Tab (src/challenge/tabs/WatchlistTab.jsx) — Full Contents

```jsx
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
```

## 5f. Frontend Risk Tab (src/challenge/tabs/RiskTab.jsx) — Full Contents

```jsx
// ── RISK TAB — Monte Carlo, Runway, Drawdown Analysis ─────────────────────
import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CHALLENGE, TIERS, CC, FONTS } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import { Panel, SectionHeader, Grid, Badge } from '../components/shared.jsx'

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

function runMonteCarlo(balance, winRate, avgRR, tierRiskPct, numTrades = 200, numRuns = 200) {
  const results = []
  for (let run = 0; run < numRuns; run++) {
    let bal = balance
    let maxBal = balance
    let maxDD = 0
    for (let i = 0; i < numTrades; i++) {
      const risk = bal * tierRiskPct
      if (Math.random() < winRate) {
        bal += risk * avgRR
      } else {
        bal -= risk
      }
      bal = Math.max(0, bal)
      if (bal > maxBal) maxBal = bal
      const dd = maxBal > 0 ? (maxBal - bal) / maxBal : 0
      if (dd > maxDD) maxDD = dd
      if (bal <= 0) break
    }
    results.push({ final: bal, maxDD, hit15k: bal >= CHALLENGE.targetCapital, bust: bal <= 0 })
  }
  const finals = results.map(r => r.final).sort((a, b) => a - b)
  return {
    hit15kPct: Math.round(results.filter(r => r.hit15k).length / numRuns * 100),
    medianBalance: Math.round(finals[Math.floor(finals.length / 2)]),
    bustPct: Math.round(results.filter(r => r.bust).length / numRuns * 100),
    avgMaxDD: Math.round(results.reduce((a, r) => a + r.maxDD, 0) / numRuns * 100),
    p10: Math.round(finals[Math.floor(finals.length * 0.1)]),
    p90: Math.round(finals[Math.floor(finals.length * 0.9)]),
  }
}

const SCENARIOS = [
  { name: 'Conservative', winRate: 0.45, rr: 2.5, color: CC.blue },
  { name: 'Target', winRate: 0.50, rr: 3.0, color: CC.accent },
  { name: 'Aggressive', winRate: 0.55, rr: 2.0, color: CC.warning },
  { name: 'Elite', winRate: 0.55, rr: 3.0, color: CC.profit },
]

export default function RiskTab({ balance, trades }) {
  const tier = getTier(balance)
  const tierDef = TIERS[tier]
  const riskPerTrade = balance * tierDef.riskPct

  const closedTrades = trades.filter(t => t.status === 'closed')
  const wins = closedTrades.filter(t => (t.pnl || 0) > 0)
  const losses = closedTrades.filter(t => (t.pnl || 0) <= 0)
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / losses.length) : riskPerTrade

  // Runway
  const runway = riskPerTrade > 0 ? Math.floor(balance / riskPerTrade) : Infinity
  const killZone = 2500
  const tradesToKillZone = riskPerTrade > 0 ? Math.floor((balance - killZone) / riskPerTrade) : Infinity

  // Max drawdown from history
  let maxDD = 0
  let maxLoseStreak = 0
  let currentLoseStreak = 0
  closedTrades.forEach(t => {
    if ((t.pnl || 0) <= 0) {
      currentLoseStreak++
      maxLoseStreak = Math.max(maxLoseStreak, currentLoseStreak)
    } else {
      currentLoseStreak = 0
    }
  })

  // Breakeven win rate table
  const breakevenTable = useMemo(() => {
    return [1.5, 2.0, 2.5, 3.0, 3.5, 4.0].map(rr => ({
      rr,
      breakevenWR: Math.round((1 / (1 + rr)) * 100),
      edge10: Math.round((1 / (1 + rr)) * 100) + 10,
    }))
  }, [])

  // Monte Carlo results
  const monteCarloResults = useMemo(() => {
    return SCENARIOS.map(s => ({
      ...s,
      results: runMonteCarlo(balance, s.winRate, s.rr, tierDef.riskPct),
    }))
  }, [balance, tierDef.riskPct])

  // Consecutive loss scenarios
  const lossScenarios = useMemo(() => {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
      let bal = balance
      for (let i = 0; i < n; i++) {
        bal -= bal * tierDef.riskPct
      }
      return {
        losses: n,
        balance: Math.round(bal),
        drawdown: Math.round((balance - bal) / balance * 100),
        label: `${n}L`,
      }
    })
  }, [balance, tierDef.riskPct])

  return (
    <div style={{ padding: 12 }}>
      {/* Core Risk Metrics */}
      <Grid cols={2}>
        <MetricCard label="Runway" value={`${runway} trades`} color={runway > 20 ? CC.accent : CC.loss} icon="→" sub="Until broke" />
        <MetricCard label="Kill Zone" value={`${tradesToKillZone} trades`} color={tradesToKillZone > 10 ? CC.accent : CC.warning} icon="⚠" sub={`To $${killZone}`} />
        <MetricCard label="Max Drawdown" value={`${maxDD}%`} color={CC.textBright} icon="▽" sub="Observed" />
        <MetricCard label="Max Losing Streak" value={maxLoseStreak} color={maxLoseStreak > 4 ? CC.loss : CC.textBright} icon="✕" sub="Consecutive" />
      </Grid>

      {/* Breakeven Win Rate Table */}
      <SectionHeader style={{ marginTop: 12 }}>Breakeven Win Rate by R:R</SectionHeader>
      <Panel style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${CC.border}` }}>
              {['R:R', 'Breakeven', '+10% Edge'].map(h => (
                <th key={h} style={{
                  fontFamily: FONTS.heading, fontSize: 9, fontWeight: 600, letterSpacing: 1,
                  color: CC.textMuted, textTransform: 'uppercase', padding: '8px 12px', textAlign: 'center',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breakevenTable.map(r => (
              <tr key={r.rr} style={{ borderBottom: `1px solid ${CC.border}22` }}>
                <td style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.textBright, padding: '6px 12px', textAlign: 'center' }}>{r.rr}:1</td>
                <td style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.warning, padding: '6px 12px', textAlign: 'center' }}>{r.breakevenWR}%</td>
                <td style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.profit, padding: '6px 12px', textAlign: 'center' }}>{r.edge10}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Monte Carlo */}
      <SectionHeader style={{ marginTop: 12 }}>Monte Carlo Simulation (200 runs × 200 trades)</SectionHeader>
      {monteCarloResults.map(s => (
        <Panel key={s.name} style={{ marginBottom: 8, padding: '10px 12px', borderColor: `${s.color}20` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div>
              <span style={{ fontFamily: FONTS.heading, fontSize: 13, fontWeight: 700, color: s.color }}>{s.name}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginLeft: 8 }}>{(s.winRate * 100).toFixed(0)}% WR / {s.rr}:1 R:R</span>
            </div>
          </div>
          <Grid cols={3}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700, color: s.results.hit15kPct >= 50 ? CC.profit : s.results.hit15kPct >= 25 ? CC.warning : CC.loss }}>
                {s.results.hit15kPct}%
              </div>
              <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>HIT $15K</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700, color: CC.textBright }}>
                ${(s.results.medianBalance / 1000).toFixed(1)}k
              </div>
              <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>MEDIAN</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700, color: s.results.bustPct > 10 ? CC.loss : CC.textMuted }}>
                {s.results.bustPct}%
              </div>
              <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>BUST</div>
            </div>
          </Grid>
          <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted, marginTop: 4, textAlign: 'center' }}>
            P10: ${s.results.p10.toLocaleString()} • P90: ${s.results.p90.toLocaleString()} • Avg DD: {s.results.avgMaxDD}%
          </div>
        </Panel>
      ))}

      {/* Consecutive Loss Chart */}
      <SectionHeader style={{ marginTop: 12 }}>Consecutive Loss Scenarios</SectionHeader>
      <Panel style={{ height: 200, padding: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={lossScenarios} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: CC.textMuted, fontFamily: FONTS.mono }} />
            <YAxis tick={{ fontSize: 9, fill: CC.textMuted, fontFamily: FONTS.mono }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11 }}
              formatter={(v) => [`$${v.toLocaleString()}`, 'Balance']}
            />
            <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
              {lossScenarios.map((entry, idx) => (
                <Cell key={idx} fill={entry.balance >= killZone ? CC.accent : entry.balance > 0 ? CC.warning : CC.loss} opacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted, textAlign: 'center', marginTop: 4 }}>
        Balance after N consecutive losses at {(tierDef.riskPct * 100).toFixed(1)}% risk per trade
      </div>
    </div>
  )
}
```

## 5f (cont). Frontend Trades Tab (src/challenge/tabs/TradesTab.jsx) — Full Contents

```jsx
// ── TRADES TAB — Trade Log with Entry, Close, Review ──────────────────────
import { useState, useEffect } from 'react'
import { STRATEGIES, SETUP_TYPES, TIERS, REVIEW_CRITERIA, CC, FONTS } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import { Panel, SectionHeader, Badge, Button, Input, Select, Grid } from '../components/shared.jsx'

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

const defaultForm = {
  ticker: '', strategy: 'long_call', setupType: 'momentum_breakout',
  contracts: '1', entryPrice: '', stopLoss: '', target: '',
  date: new Date().toISOString().split('T')[0],
  expiration: '', thesis: '',
}

export default function TradesTab({ trades, setTrades, balance, setBalance, balanceHistory, setBalanceHistory, pendingTrade, clearPendingTrade }) {
  const [form, setForm] = useState({ ...defaultForm })
  const [closeId, setCloseId] = useState(null)
  const [closePrice, setClosePrice] = useState('')
  const [reviewId, setReviewId] = useState(null)
  const [reviewData, setReviewData] = useState({})
  const [reviewNotes, setReviewNotes] = useState('')

  const tier = getTier(balance)
  const tierDef = TIERS[tier]

  // Accept pending trade from Ideas tab
  useEffect(() => {
    if (pendingTrade) {
      setForm({
        ticker: pendingTrade.ticker || '',
        strategy: pendingTrade.strategy || 'long_call',
        setupType: pendingTrade.setupType || 'momentum_breakout',
        contracts: '1',
        entryPrice: String(pendingTrade.entry || ''),
        stopLoss: String(pendingTrade.stop || ''),
        target: String(pendingTrade.target || ''),
        date: new Date().toISOString().split('T')[0],
        expiration: '',
        thesis: pendingTrade.reason || '',
      })
      clearPendingTrade()
    }
  }, [pendingTrade, clearPendingTrade])

  const updateField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // Risk calculations
  const entry = parseFloat(form.entryPrice) || 0
  const stop = parseFloat(form.stopLoss) || 0
  const target = parseFloat(form.target) || 0
  const contracts = parseInt(form.contracts) || 1
  const riskPerContract = Math.abs(entry - stop) * 100
  const totalRisk = riskPerContract * contracts
  const tierMaxRisk = balance * tierDef.riskPct
  const rr = stop > 0 && entry > 0 ? Math.abs(target - entry) / Math.abs(entry - stop) : 0
  const riskWarnings = []
  if (totalRisk > tierMaxRisk) riskWarnings.push(`Risk $${totalRisk.toFixed(0)} exceeds tier max $${tierMaxRisk.toFixed(0)}`)
  if (rr > 0 && rr < 2) riskWarnings.push(`R:R ${rr.toFixed(1)}:1 below minimum 2:1`)
  if (!form.thesis.trim()) riskWarnings.push('Thesis is required — no thesis, no trade')

  const openTrade = () => {
    if (!form.ticker || !form.entryPrice || !form.thesis.trim()) return
    const stratDef = STRATEGIES.find(s => s.key === form.strategy)
    const newTrade = {
      id: Date.now().toString(),
      ...form,
      entryPrice: entry,
      stopLoss: stop,
      target,
      contracts,
      maxRisk: totalRisk,
      rr: Math.round(rr * 100) / 100,
      direction: stratDef?.direction || 'bullish',
      strategyLabel: stratDef?.label || form.strategy,
      status: 'open',
      pnl: 0,
      closePrice: null,
      closeDate: null,
      review: null,
    }
    setTrades(prev => [...prev, newTrade])
    setForm({ ...defaultForm })
  }

  const closeTrade = () => {
    const cp = parseFloat(closePrice)
    if (!closeId || isNaN(cp)) return
    const trade = trades.find(t => t.id === closeId)
    if (!trade) return
    const stratDef = STRATEGIES.find(s => s.key === trade.strategy)
    const isDebit = stratDef?.type === 'debit'
    const pnl = isDebit
      ? (cp - trade.entryPrice) * trade.contracts * 100
      : (trade.entryPrice - cp) * trade.contracts * 100

    setTrades(prev => prev.map(t => t.id === closeId ? {
      ...t, status: 'closed', closePrice: cp, closeDate: new Date().toISOString().split('T')[0], pnl: Math.round(pnl * 100) / 100,
    } : t))
    const newBalance = balance + pnl
    setBalance(newBalance)
    setBalanceHistory(prev => {
      const today = new Date().toISOString().split('T')[0]
      const existing = prev.findIndex(h => h.date === today)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { date: today, balance: newBalance }
        return updated
      }
      return [...prev, { date: today, balance: newBalance }]
    })
    setReviewId(closeId)
    setCloseId(null)
    setClosePrice('')
  }

  const submitReview = () => {
    if (!reviewId) return
    const totalWeight = REVIEW_CRITERIA.reduce((a, c) => a + c.weight, 0)
    const earned = REVIEW_CRITERIA.reduce((a, c) => a + (reviewData[c.key] ? c.weight : 0), 0)
    const execGrade = Math.round((earned / totalWeight) * 100)
    const gradeLabel = execGrade >= 90 ? 'A+' : execGrade >= 80 ? 'A' : execGrade >= 70 ? 'B' : execGrade >= 60 ? 'C' : 'D'

    setTrades(prev => prev.map(t => t.id === reviewId ? {
      ...t, review: { criteria: { ...reviewData }, execGrade, gradeLabel, notes: reviewNotes, timestamp: Date.now() },
    } : t))
    setReviewId(null)
    setReviewData({})
    setReviewNotes('')
  }

  const deleteTrade = (id) => {
    const trade = trades.find(t => t.id === id)
    if (trade && trade.status === 'closed' && trade.pnl) {
      const newBalance = balance - trade.pnl
      setBalance(newBalance)
    }
    setTrades(prev => prev.filter(t => t.id !== id))
  }

  const openPositions = trades.filter(t => t.status === 'open')
  const closedTrades = trades.filter(t => t.status === 'closed')

  return (
    <div style={{ padding: 12 }}>
      {/* New Trade Form */}
      <SectionHeader>New Trade</SectionHeader>
      <Panel>
        <Grid cols={2}>
          <Input label="Ticker" value={form.ticker} onChange={v => updateField('ticker', v.toUpperCase())} placeholder="AAPL" />
          <Select label="Strategy" value={form.strategy} onChange={v => updateField('strategy', v)}
            options={STRATEGIES.filter(s => tierDef.strategies.includes(s.key)).map(s => ({ value: s.key, label: s.label }))} />
          <Select label="Setup Type" value={form.setupType} onChange={v => updateField('setupType', v)}
            options={SETUP_TYPES.map(s => ({ value: s.key, label: s.label }))} />
          <Input label="Contracts" value={form.contracts} onChange={v => updateField('contracts', v)} type="number" />
          <Input label="Entry Price" value={form.entryPrice} onChange={v => updateField('entryPrice', v)} type="number" placeholder="0.00" />
          <Input label="Stop Loss" value={form.stopLoss} onChange={v => updateField('stopLoss', v)} type="number" placeholder="0.00" />
          <Input label="Target" value={form.target} onChange={v => updateField('target', v)} type="number" placeholder="0.00" />
          <Input label="Date" value={form.date} onChange={v => updateField('date', v)} type="date" />
        </Grid>
        <Input label="Expiration" value={form.expiration} onChange={v => updateField('expiration', v)} type="date" />
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Thesis (Required)</label>
          <textarea
            value={form.thesis}
            onChange={e => updateField('thesis', e.target.value)}
            placeholder="Why this trade? What's the edge?"
            rows={3}
            style={{
              width: '100%', padding: '8px 12px', fontFamily: FONTS.body, fontSize: 12,
              color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
              borderRadius: 6, resize: 'vertical',
            }}
          />
        </div>

        {/* Risk Validation */}
        <Panel style={{ background: CC.bg, padding: 10, marginBottom: 10 }}>
          <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted, letterSpacing: 1.5, marginBottom: 6 }}>RISK VALIDATION</div>
          <Grid cols={3}>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>RISK $</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: totalRisk > tierMaxRisk ? CC.loss : CC.textBright }}>${totalRisk.toFixed(0)}</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>Max: ${tierMaxRisk.toFixed(0)}</div>
            </div>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>R:R</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: rr >= 2 ? CC.profit : CC.loss }}>{rr.toFixed(1)}:1</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>Min: 2:1</div>
            </div>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>TIER</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: tierDef.color }}>{tierDef.name}</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>{(tierDef.riskPct * 100).toFixed(1)}% risk</div>
            </div>
          </Grid>
          {riskWarnings.map((w, i) => (
            <div key={i} style={{ marginTop: 6, fontFamily: FONTS.body, fontSize: 11, color: CC.loss, padding: '4px 8px', background: `${CC.loss}08`, borderRadius: 4 }}>
              ⚠ {w}
            </div>
          ))}
        </Panel>

        <Button onClick={openTrade} variant="primary" disabled={!form.ticker || !form.entryPrice || !form.thesis.trim()} style={{ width: '100%', padding: 12 }}>
          OPEN TRADE
        </Button>
      </Panel>

      {/* Close Trade Modal */}
      {closeId && (
        <Panel style={{ borderColor: CC.warning + '40', marginBottom: 12 }}>
          <SectionHeader>Close Trade — {trades.find(t => t.id === closeId)?.ticker}</SectionHeader>
          <Input label="Close Price" value={closePrice} onChange={setClosePrice} type="number" placeholder="0.00" />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={closeTrade} variant="primary" style={{ flex: 1 }}>CLOSE TRADE</Button>
            <Button onClick={() => { setCloseId(null); setClosePrice('') }} variant="ghost" style={{ flex: 1 }}>CANCEL</Button>
          </div>
        </Panel>
      )}

      {/* Review Modal */}
      {reviewId && (
        <Panel style={{ borderColor: CC.accent + '40', marginBottom: 12 }}>
          <SectionHeader>Post-Trade Review — {trades.find(t => t.id === reviewId)?.ticker}</SectionHeader>
          <div style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.textMuted, marginBottom: 10 }}>Rate your execution on each criterion:</div>
          {REVIEW_CRITERIA.map(c => (
            <label key={c.key} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
              borderBottom: `1px solid ${CC.border}22`, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={!!reviewData[c.key]}
                onChange={e => setReviewData(prev => ({ ...prev, [c.key]: e.target.checked }))}
                style={{ accentColor: CC.accent }}
              />
              <span style={{ fontFamily: FONTS.body, fontSize: 12, color: CC.textBright, flex: 1 }}>{c.label}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>{c.weight}x</span>
            </label>
          ))}
          <div style={{ marginTop: 10 }}>
            <label style={{ display: 'block', fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Lessons / Notes</label>
            <textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder="What did you learn?"
              rows={2}
              style={{
                width: '100%', padding: '8px 12px', fontFamily: FONTS.body, fontSize: 12,
                color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
                borderRadius: 6, resize: 'vertical',
              }}
            />
          </div>
          <Button onClick={submitReview} variant="primary" style={{ width: '100%', marginTop: 10, padding: 12 }}>
            SUBMIT REVIEW
          </Button>
        </Panel>
      )}

      {/* Open Positions */}
      {openPositions.length > 0 && (
        <>
          <SectionHeader>Open Positions ({openPositions.length})</SectionHeader>
          {openPositions.map(t => (
            <Panel key={t.id} style={{ marginBottom: 6, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: FONTS.heading, fontSize: 14, fontWeight: 700, color: CC.textBright }}>{t.ticker}</span>
                  <Badge color={t.direction === 'bullish' ? CC.profit : t.direction === 'bearish' ? CC.loss : CC.blue}>{t.direction}</Badge>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button onClick={() => setCloseId(t.id)} variant="default" style={{ padding: '4px 10px', fontSize: 9 }}>CLOSE</Button>
                  <Button onClick={() => deleteTrade(t.id)} variant="danger" style={{ padding: '4px 10px', fontSize: 9 }}>DEL</Button>
                </div>
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
                {t.strategyLabel} • {t.contracts} ct @ ${t.entryPrice} • Stop ${t.stopLoss} • Target ${t.target} • R:R {t.rr}:1
              </div>
              <div style={{ fontFamily: FONTS.body, fontSize: 10, color: CC.textMuted, marginTop: 4, fontStyle: 'italic' }}>{t.thesis}</div>
            </Panel>
          ))}
        </>
      )}

      {/* Closed Trades */}
      {closedTrades.length > 0 && (
        <>
          <SectionHeader>Closed Trades ({closedTrades.length})</SectionHeader>
          {closedTrades.slice().reverse().map(t => (
            <Panel key={t.id} style={{ marginBottom: 6, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: FONTS.heading, fontSize: 13, fontWeight: 700, color: CC.textBright }}>{t.ticker}</span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.pnl >= 0 ? CC.profit : CC.loss }}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(0)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t.review && <Badge color={t.review.execGrade >= 80 ? CC.profit : t.review.execGrade >= 60 ? CC.warning : CC.loss}>{t.review.gradeLabel}</Badge>}
                  {!t.review && (
                    <Button onClick={() => setReviewId(t.id)} variant="ghost" style={{ padding: '3px 8px', fontSize: 8 }}>REVIEW</Button>
                  )}
                </div>
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginTop: 2 }}>
                {t.strategyLabel} • {t.contracts} ct • ${t.entryPrice} → ${t.closePrice} • {t.closeDate}
              </div>
              {t.review?.notes && (
                <div style={{ fontFamily: FONTS.body, fontSize: 10, color: CC.textMuted, marginTop: 4, fontStyle: 'italic' }}>📝 {t.review.notes}</div>
              )}
            </Panel>
          ))}
        </>
      )}
    </div>
  )
}
```

---

# SECTION 6: UI COMPONENTS & STATE

## 6a. Component Definitions

```
src/challenge/components/shared.jsx:4:export const Input = ({ label, value, onChange, type = 'text', placeholder, style, ...props }) => (
src/challenge/components/shared.jsx:24:export const Select = ({ label, value, onChange, options, style }) => (
src/challenge/components/shared.jsx:45:export const Button = ({ children, onClick, variant = 'default', disabled, style, ...props }) => {
src/challenge/components/shared.jsx:72:export const Badge = ({ children, color = CC.accent, style }) => (
src/challenge/components/shared.jsx:83:export const SectionHeader = ({ children, style }) => (
src/challenge/components/shared.jsx:93:export const Panel = ({ children, style }) => (
src/challenge/components/shared.jsx:102:export const Row = ({ children, style }) => (
src/challenge/components/shared.jsx:108:export const Grid = ({ children, cols = 2, style }) => (
src/challenge/components/ProgressBar.jsx:4:export default function ProgressBar({ value, max, label, color = CC.accent, height = 8, showPct = true, style }) {
src/challenge/components/CandleChart.jsx:5:export default function CandleChart({ bars = [], srLevels = [], entry, stop, target, height = 320 }) {
src/challenge/components/CandleChart.jsx:15:  const closes = bars.map(b => b.c)
src/challenge/components/CandleChart.jsx:29:  const allPrices = displayBars.flatMap(b => [b.h, b.l])
src/challenge/components/CandleChart.jsx:36:  const maxVol = Math.max(...displayBars.map(b => b.v), 1)
src/challenge/components/CandleChart.jsx:42:  const scaleY = (price) => padding.top + (1 - (price - priceMin) / (priceMax - priceMin)) * (chartH - padding.top - 10)
src/challenge/components/CandleChart.jsx:43:  const scaleX = (i) => padding.left + i * barWidth + barWidth / 2
src/challenge/components/CandleChart.jsx:44:  const scaleVol = (vol) => chartH + volH - (vol / maxVol) * (volH - 8)
src/challenge/components/CandleChart.jsx:46:  const emaLine = (data, color) => {
src/challenge/components/CandleChart.jsx:48:    const points = data.map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(' ')
src/challenge/components/CandleChart.jsx:52:  const hLine = (price, color, label, dashed = true) => {
src/challenge/components/MetricCard.jsx:4:export default function MetricCard({ label, value, sub, color = CC.textBright, icon, small, style }) {
src/challenge/tabs/PlaybookTab.jsx:6:function getTier(balance) {
src/challenge/tabs/PlaybookTab.jsx:13:export default function PlaybookTab({ balance }) {
src/challenge/tabs/SizerTab.jsx:7:function getTier(balance) {
src/challenge/tabs/SizerTab.jsx:14:export default function SizerTab({ balance }) {
src/challenge/tabs/SizerTab.jsx:26:  const calc = useMemo(() => {
src/challenge/tabs/SizerTab.jsx:53:  const streakProjections = useMemo(() => {
src/challenge/tabs/SizerTab.jsx:65:  const quickRef = useMemo(() => {
src/challenge/tabs/WatchlistTab.jsx:17:export default function WatchlistTab({ watchlist, setWatchlist, apiKey, timeframeMode, setTimeframeMode }) {
src/challenge/tabs/WatchlistTab.jsx:26:  const addTicker = useCallback((ticker) => {
src/challenge/tabs/WatchlistTab.jsx:34:  const removeTicker = (ticker) => {
src/challenge/tabs/WatchlistTab.jsx:39:  const fetchData = useCallback(async () => {
src/challenge/tabs/WatchlistTab.jsx:46:      const spyBars = (spyData.results || []).map(r => ({ o: r.o, h: r.h, l: r.l, c: r.c, v: r.v, t: r.t }))
src/challenge/tabs/WatchlistTab.jsx:53:          const bars = (data.results || []).map(r => ({ o: r.o, h: r.h, l: r.l, c: r.c, v: r.v, t: r.t }))
src/challenge/tabs/WatchlistTab.jsx:69:  const sorted = [...watchlist].sort((a, b) => {
src/challenge/tabs/TradesTab.jsx:7:function getTier(balance) {
src/challenge/tabs/TradesTab.jsx:21:export default function TradesTab({ trades, setTrades, balance, setBalance, balanceHistory, setBalanceHistory, pendingTrade, clearPendingTrade }) {
src/challenge/tabs/TradesTab.jsx:51:  const updateField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
src/challenge/tabs/TradesTab.jsx:67:  const openTrade = () => {
src/challenge/tabs/TradesTab.jsx:69:    const stratDef = STRATEGIES.find(s => s.key === form.strategy)
src/challenge/tabs/TradesTab.jsx:91:  const closeTrade = () => {
src/challenge/tabs/TradesTab.jsx:94:    const trade = trades.find(t => t.id === closeId)
src/challenge/tabs/TradesTab.jsx:96:    const stratDef = STRATEGIES.find(s => s.key === trade.strategy)
src/challenge/tabs/TradesTab.jsx:109:      const existing = prev.findIndex(h => h.date === today)
src/challenge/tabs/TradesTab.jsx:122:  const submitReview = () => {
src/challenge/tabs/TradesTab.jsx:124:    const totalWeight = REVIEW_CRITERIA.reduce((a, c) => a + c.weight, 0)
src/challenge/tabs/TradesTab.jsx:125:    const earned = REVIEW_CRITERIA.reduce((a, c) => a + (reviewData[c.key] ? c.weight : 0), 0)
src/challenge/tabs/TradesTab.jsx:137:  const deleteTrade = (id) => {
src/challenge/tabs/TradesTab.jsx:138:    const trade = trades.find(t => t.id === id)
src/challenge/tabs/TradesTab.jsx:146:  const openPositions = trades.filter(t => t.status === 'open')
src/challenge/tabs/TradesTab.jsx:147:  const closedTrades = trades.filter(t => t.status === 'closed')
src/challenge/tabs/DebriefTab.jsx:7:function formatDate(d) {
src/challenge/tabs/DebriefTab.jsx:11:function addDays(dateStr, n) {
src/challenge/tabs/DebriefTab.jsx:17:function getWeekDates(dateStr) {
src/challenge/tabs/DebriefTab.jsx:31:export default function DebriefTab({ trades, debriefs, setDebriefs, balanceHistory }) {
src/challenge/tabs/DebriefTab.jsx:36:  const setDebrief = (updates) => {
src/challenge/tabs/DebriefTab.jsx:44:  const dayTrades = trades.filter(t => t.closeDate === selectedDate || t.date === selectedDate)
src/challenge/tabs/DebriefTab.jsx:45:  const closedToday = dayTrades.filter(t => t.status === 'closed' && t.closeDate === selectedDate)
src/challenge/tabs/DebriefTab.jsx:46:  const dayPL = closedToday.reduce((a, t) => a + (t.pnl || 0), 0)
src/challenge/tabs/DebriefTab.jsx:47:  const dayWins = closedToday.filter(t => (t.pnl || 0) > 0)
src/challenge/tabs/DebriefTab.jsx:49:  const dayReviews = closedToday.filter(t => t.review)
src/challenge/tabs/DebriefTab.jsx:50:  const avgExecGrade = dayReviews.length > 0 ? Math.round(dayReviews.reduce((a, t) => a + t.review.execGrade, 0) / dayReviews.length) : 0
src/challenge/tabs/DebriefTab.jsx:55:  const streak = useMemo(() => {
src/challenge/tabs/DebriefTab.jsx:56:    const allDates = [...new Set(trades.filter(t => t.status === 'closed').map(t => t.closeDate))].sort().reverse()
src/challenge/tabs/DebriefTab.jsx:59:      const dTrades = trades.filter(t => t.closeDate === d && t.status === 'closed')
src/challenge/tabs/DebriefTab.jsx:60:      const dPL = dTrades.reduce((a, t) => a + (t.pnl || 0), 0)
src/challenge/tabs/DebriefTab.jsx:68:  const daysPassed = Math.max(1, (() => {
src/challenge/tabs/DebriefTab.jsx:75:  const totalDays = (() => {
src/challenge/tabs/DebriefTab.jsx:84:  const currentBalance = balanceHistory.find(h => h.date === selectedDate)?.balance || balanceHistory[balanceHistory.length - 1]?.balance || CHALLENGE.startingCapital
src/challenge/tabs/DebriefTab.jsx:88:  const weekTrades = trades.filter(t => t.status === 'closed' && weekDates.includes(t.closeDate))
src/challenge/tabs/DebriefTab.jsx:89:  const weekPL = weekTrades.reduce((a, t) => a + (t.pnl || 0), 0)
src/challenge/tabs/DebriefTab.jsx:90:  const weekWins = weekTrades.filter(t => (t.pnl || 0) > 0)
src/challenge/tabs/DebriefTab.jsx:95:  const checkedCount = allCheckItems.filter(item => debrief.checklist[item]).length
src/challenge/tabs/DebriefTab.jsx:98:  const calendarDays = useMemo(() => {
src/challenge/tabs/DebriefTab.jsx:106:        const dayT = trades.filter(t => t.status === 'closed' && t.closeDate === dateStr)
src/challenge/tabs/DebriefTab.jsx:107:        const pl = dayT.reduce((a, t) => a + (t.pnl || 0), 0)
src/challenge/tabs/DebriefTab.jsx:117:  const debriefDates = Object.keys(debriefs).filter(d => debriefs[d].saved).sort().reverse().slice(0, 10)
src/challenge/tabs/DebriefTab.jsx:269:            const mood = MOOD_STATES.find(m => m.key === db.mood)
src/challenge/tabs/RiskTab.jsx:8:function getTier(balance) {
src/challenge/tabs/RiskTab.jsx:15:function runMonteCarlo(balance, winRate, avgRR, tierRiskPct, numTrades = 200, numRuns = 200) {
src/challenge/tabs/RiskTab.jsx:36:  const finals = results.map(r => r.final).sort((a, b) => a - b)
src/challenge/tabs/RiskTab.jsx:54:export default function RiskTab({ balance, trades }) {
src/challenge/tabs/RiskTab.jsx:59:  const closedTrades = trades.filter(t => t.status === 'closed')
src/challenge/tabs/RiskTab.jsx:60:  const wins = closedTrades.filter(t => (t.pnl || 0) > 0)
src/challenge/tabs/RiskTab.jsx:61:  const losses = closedTrades.filter(t => (t.pnl || 0) <= 0)
src/challenge/tabs/RiskTab.jsx:62:  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0
src/challenge/tabs/RiskTab.jsx:63:  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / losses.length) : riskPerTrade
src/challenge/tabs/RiskTab.jsx:84:  const breakevenTable = useMemo(() => {
src/challenge/tabs/RiskTab.jsx:93:  const monteCarloResults = useMemo(() => {
src/challenge/tabs/RiskTab.jsx:101:  const lossScenarios = useMemo(() => {
src/challenge/tabs/CommandTab.jsx:9:function getTier(balance) {
src/challenge/tabs/CommandTab.jsx:16:function tradingDaysBetween(start, end) {
src/challenge/tabs/CommandTab.jsx:28:export default function CommandTab({ balance, trades, balanceHistory, openPositions }) {
src/challenge/tabs/CommandTab.jsx:44:  const todayTrades = trades.filter(t => t.closeDate === today && t.status === 'closed')
src/challenge/tabs/CommandTab.jsx:45:  const todayPL = todayTrades.reduce((a, t) => a + (t.pnl || 0), 0)
src/challenge/tabs/CommandTab.jsx:49:  const closedTrades = trades.filter(t => t.status === 'closed')
src/challenge/tabs/CommandTab.jsx:50:  const wins = closedTrades.filter(t => (t.pnl || 0) > 0)
src/challenge/tabs/CommandTab.jsx:51:  const losses = closedTrades.filter(t => (t.pnl || 0) <= 0)
src/challenge/tabs/CommandTab.jsx:53:  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0
src/challenge/tabs/CommandTab.jsx:54:  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / losses.length) : 0
src/challenge/tabs/CommandTab.jsx:61:  const openHeat = openPositions.reduce((a, t) => a + (t.maxRisk || 0), 0)
src/challenge/tabs/CommandTab.jsx:65:  const chartData = useMemo(() => {
src/challenge/tabs/CommandTab.jsx:75:        const histEntry = balanceHistory.find(h => h.date === dateStr)
src/challenge/tabs/CommandTab.jsx:90:  const setupPerf = useMemo(() => {
src/challenge/tabs/IdeasTab.jsx:10:function getTier(balance) {
src/challenge/tabs/IdeasTab.jsx:17:export default function IdeasTab({ watchlist, apiKey, balance, timeframeMode, onOpenTrade }) {
src/challenge/tabs/IdeasTab.jsx:26:  const scan = useCallback(async () => {
src/challenge/tabs/IdeasTab.jsx:34:      const spyBars = (spyData.results || []).map(r => ({ o: r.o, h: r.h, l: r.l, c: r.c, v: r.v, t: r.t }))
src/challenge/tabs/IdeasTab.jsx:43:          const bars = (data.results || []).map(r => ({ o: r.o, h: r.h, l: r.l, c: r.c, v: r.v, t: r.t }))
src/challenge/tabs/IdeasTab.jsx:101:        const setupDef = SETUP_TYPES.find(s => s.key === idea.setupType)
src/challenge/tabs/IdeasTab.jsx:102:        const stratDef = STRATEGIES.find(s => s.key === idea.strategy)
src/challenge/ChallengeApp.jsx:35:function SettingsPanel({ apiKey, setApiKey, balance, setBalance, setBalanceHistory }) {
src/challenge/ChallengeApp.jsx:180:  const renderTab = () => {
src/App.jsx:128:const Panel = ({ children, style, borderColor, glow: glowColor }) => (
src/App.jsx:191:const TabBar = ({ tabs, active, onSelect }) => (
src/App.jsx:214:const BarChart = ({ data, maxWidth = 200 }) => {
src/App.jsx:277:function HomePage() {
src/App.jsx:304:  const sectorBars = (Array.isArray(sectorData) ? sectorData : Object.entries(sectorData).map(([k, v]) => ({ label: k, value: typeof v === 'number' ? v : v?.change || 0 }))).map(s => ({ label: s.n || s.name || s.sector || s.label || s.etf || '?', value: s.p ?? s.change ?? s.performance ?? s.value ?? 0 })).slice(0, 11)
src/App.jsx:505:function StockCard({ s, expanded, onToggle, techCache, srCache, onLoadDetails }) {
src/App.jsx:623:function WatchPage() {
src/App.jsx:792:function PlaysPage() {
src/App.jsx:939:function BriefPage() {
src/App.jsx:994:function AnalyzePage() {
src/App.jsx:1582:function MomentumPage() {
src/App.jsx:1601:  const getTabItems = () => {
src/App.jsx:1703:function ScreenerPage() {
src/App.jsx:1786:function NewsPage() {
src/App.jsx:1845:function BreadthPage() {
src/App.jsx:1861:  const sectorBars = Array.isArray(sectorData) ? sectorData.map(s => ({ label: s.n || s.name || s.sector || s.label || s.etf || '?', value: s.p ?? s.change ?? s.performance ?? s.value ?? 0 })) : Object.entries(sectorData).map(([k, v]) => ({ label: k, value: typeof v === 'number' ? v : (v?.p || v?.change || v?.performance || 0) }))
src/App.jsx:1930:function JournalPage() {
src/App.jsx:2157:function MarketWizard({ currentPage, pageData, onNavigate }) {
src/App.jsx:2526:  const renderPage = () => {
src/App.jsx:2595:          const isActive = item.key === 'more' ? showMore : (page === item.key || (item.key === 'more' && MORE_ITEMS.some(m => m.key === page)))
```

## 6b. Files with Stateful Hooks

```
src/App.jsx
src/challenge/ChallengeApp.jsx
src/challenge/components/CandleChart.jsx
src/challenge/hooks/useStorage.js
src/challenge/tabs/CommandTab.jsx
src/challenge/tabs/DebriefTab.jsx
src/challenge/tabs/IdeasTab.jsx
src/challenge/tabs/PlaybookTab.jsx
src/challenge/tabs/RiskTab.jsx
src/challenge/tabs/SizerTab.jsx
src/challenge/tabs/TradesTab.jsx
src/challenge/tabs/WatchlistTab.jsx
```

## 6c. Files by Size (Largest First)

```
  6212 total
  2616 src/App.jsx
   323 src/challenge/tabs/TradesTab.jsx
   311 src/challenge/tabs/WatchlistTab.jsx
   286 src/challenge/tabs/DebriefTab.jsx
   281 src/challenge/ChallengeApp.jsx
   273 src/challenge/engine/constants.js
   256 src/challenge/engine/analysis.js
   242 src/challenge/tabs/IdeasTab.jsx
   234 src/challenge/tabs/CommandTab.jsx
   218 src/challenge/engine/detection.js
   212 src/challenge/tabs/RiskTab.jsx
   186 src/challenge/tabs/SizerTab.jsx
   156 src/challenge/components/CandleChart.jsx
   150 src/challenge/tabs/PlaybookTab.jsx
   114 src/challenge/components/shared.jsx
    92 src/challenge/engine/scoring.js
    88 vite.config.js
    53 src/challenge/engine/tradeBuilder.js
    40 src/challenge/hooks/useStorage.js
    36 src/challenge/components/ProgressBar.jsx
    36 src/challenge/components/MetricCard.jsx
     9 src/main.jsx
```

## 6d. Challenge App (src/challenge/ChallengeApp.jsx) — Full Contents

```jsx
// ── $5K OPTIONS CHALLENGE — Main Container ────────────────────────────────
import { useState, useCallback } from 'react'
import { CHALLENGE, CC, FONTS, TIERS } from './engine/constants.js'
import { useStorage, resetAllChallengeData } from './hooks/useStorage.js'
import CommandTab from './tabs/CommandTab.jsx'
import WatchlistTab from './tabs/WatchlistTab.jsx'
import IdeasTab from './tabs/IdeasTab.jsx'
import TradesTab from './tabs/TradesTab.jsx'
import SizerTab from './tabs/SizerTab.jsx'
import RiskTab from './tabs/RiskTab.jsx'
import DebriefTab from './tabs/DebriefTab.jsx'
import PlaybookTab from './tabs/PlaybookTab.jsx'

const FONT_URL = "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=DM+Sans:wght@400;500;600&display=swap"

const TABS = [
  { key: 'command', label: 'CMD', icon: '◈' },
  { key: 'watchlist', label: 'WATCH', icon: '◉' },
  { key: 'ideas', label: 'IDEAS', icon: '★' },
  { key: 'trades', label: 'TRADES', icon: '▲' },
  { key: 'sizer', label: 'SIZER', icon: '◊' },
  { key: 'risk', label: 'RISK', icon: '⊘' },
  { key: 'debrief', label: 'DEBRIEF', icon: '✎' },
  { key: 'playbook', label: 'BOOK', icon: '▣' },
]

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

// Settings tab inline
function SettingsPanel({ apiKey, setApiKey, balance, setBalance, setBalanceHistory }) {
  const [keyInput, setKeyInput] = useState(apiKey)
  const [balInput, setBalInput] = useState(String(balance))
  const [confirmReset, setConfirmReset] = useState(false)

  const saveKey = () => {
    setApiKey(keyInput.trim())
  }

  const syncBalance = () => {
    const val = parseFloat(balInput)
    if (!isNaN(val) && val >= 0) {
      setBalance(val)
      setBalanceHistory(prev => {
        const today = new Date().toISOString().split('T')[0]
        const existing = prev.findIndex(h => h.date === today)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = { date: today, balance: val }
          return updated
        }
        return [...prev, { date: today, balance: val }]
      })
    }
  }

  const doReset = () => {
    resetAllChallengeData()
    window.location.reload()
  }

  return (
    <div style={{ padding: 12 }}>
      {/* API Key */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Polygon.io API Key</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="Enter API key..."
            style={{
              flex: 1, padding: '8px 12px', fontFamily: FONTS.mono, fontSize: 13,
              color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
              borderRadius: 6,
            }}
          />
          <button onClick={saveKey} style={{
            fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
            padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
            background: CC.accent, color: CC.bg, border: 'none', textTransform: 'uppercase',
          }}>SAVE</button>
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: apiKey ? CC.profit : CC.textMuted, marginTop: 4 }}>
          {apiKey ? '● Connected' : '○ Not configured'}
        </div>
      </div>

      {/* Balance Sync */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Balance Sync</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            value={balInput}
            onChange={e => setBalInput(e.target.value)}
            style={{
              flex: 1, padding: '8px 12px', fontFamily: FONTS.mono, fontSize: 13,
              color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
              borderRadius: 6,
            }}
          />
          <button onClick={syncBalance} style={{
            fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
            padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
            background: `${CC.accent}15`, color: CC.accent, border: `1px solid ${CC.accent}40`, textTransform: 'uppercase',
          }}>SYNC</button>
        </div>
      </div>

      {/* Danger Zone */}
      <div style={{
        marginTop: 30, padding: 16, background: `${CC.loss}08`,
        border: `1px solid ${CC.loss}30`, borderRadius: 8,
      }}>
        <div style={{ fontFamily: FONTS.heading, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: CC.loss, marginBottom: 8 }}>DANGER ZONE</div>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} style={{
            fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
            padding: '10px 20px', borderRadius: 6, cursor: 'pointer', width: '100%',
            background: 'transparent', color: CC.loss, border: `1px solid ${CC.loss}40`, textTransform: 'uppercase',
          }}>RESET ALL DATA</button>
        ) : (
          <div>
            <div style={{ fontFamily: FONTS.body, fontSize: 12, color: CC.loss, marginBottom: 8 }}>
              This will permanently delete all challenge data. Are you sure?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={doReset} style={{
                flex: 1, fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
                padding: '10px 20px', borderRadius: 6, cursor: 'pointer',
                background: CC.loss, color: '#fff', border: 'none', textTransform: 'uppercase',
              }}>CONFIRM RESET</button>
              <button onClick={() => setConfirmReset(false)} style={{
                flex: 1, fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
                padding: '10px 20px', borderRadius: 6, cursor: 'pointer',
                background: 'transparent', color: CC.textMuted, border: `1px solid ${CC.border}`, textTransform: 'uppercase',
              }}>CANCEL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChallengeApp({ onBack }) {
  const [activeTab, setActiveTab] = useState('command')
  const [showSettings, setShowSettings] = useState(false)
  const [pendingTrade, setPendingTrade] = useState(null)

  // Persistent state
  const [balance, setBalance] = useStorage('balance', CHALLENGE.startingCapital)
  const [trades, setTrades] = useStorage('trades', [])
  const [balanceHistory, setBalanceHistory] = useStorage('balance_history', [
    { date: CHALLENGE.startDate, balance: CHALLENGE.startingCapital },
  ])
  const [watchlist, setWatchlist] = useStorage('watchlist', [])
  const [debriefs, setDebriefs] = useStorage('debriefs', {})
  const envKey = typeof __POLYGON_API_KEY__ !== 'undefined' ? __POLYGON_API_KEY__ : ''
  const [apiKey, setApiKey] = useStorage('polygon_api_key', envKey)
  const [timeframeMode, setTimeframeMode] = useStorage('timeframe_mode', 'swing')

  const tier = getTier(balance)
  const tierDef = TIERS[tier]
  const openPositions = trades.filter(t => t.status === 'open')

  const handleOpenTrade = useCallback((idea) => {
    setPendingTrade(idea)
    setActiveTab('trades')
  }, [])

  const clearPendingTrade = useCallback(() => setPendingTrade(null), [])

  const renderTab = () => {
    if (showSettings) {
      return <SettingsPanel apiKey={apiKey} setApiKey={setApiKey} balance={balance} setBalance={setBalance} setBalanceHistory={setBalanceHistory} />
    }
    switch (activeTab) {
      case 'command': return <CommandTab balance={balance} trades={trades} balanceHistory={balanceHistory} openPositions={openPositions} />
      case 'watchlist': return <WatchlistTab watchlist={watchlist} setWatchlist={setWatchlist} apiKey={apiKey} timeframeMode={timeframeMode} setTimeframeMode={setTimeframeMode} />
      case 'ideas': return <IdeasTab watchlist={watchlist} apiKey={apiKey} balance={balance} timeframeMode={timeframeMode} onOpenTrade={handleOpenTrade} />
      case 'trades': return <TradesTab trades={trades} setTrades={setTrades} balance={balance} setBalance={setBalance} balanceHistory={balanceHistory} setBalanceHistory={setBalanceHistory} pendingTrade={pendingTrade} clearPendingTrade={clearPendingTrade} />
      case 'sizer': return <SizerTab balance={balance} />
      case 'risk': return <RiskTab balance={balance} trades={trades} />
      case 'debrief': return <DebriefTab trades={trades} debriefs={debriefs} setDebriefs={setDebriefs} balanceHistory={balanceHistory} />
      case 'playbook': return <PlaybookTab balance={balance} />
      default: return <CommandTab balance={balance} trades={trades} balanceHistory={balanceHistory} openPositions={openPositions} />
    }
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: CC.bg, color: CC.text, fontFamily: FONTS.body,
    }}>
      {/* Font loader */}
      <link rel="stylesheet" href={FONT_URL} />

      {/* Top Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: CC.surface, borderBottom: `1px solid ${CC.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack && (
            <button onClick={onBack} style={{
              fontFamily: FONTS.mono, fontSize: 16, color: CC.textMuted, background: 'none',
              border: 'none', cursor: 'pointer', padding: '0 4px',
            }}>←</button>
          )}
          <div>
            <span style={{ fontFamily: FONTS.heading, fontWeight: 700, fontSize: 14, letterSpacing: 2, color: CC.gold }}>$5K</span>
            <span style={{ fontFamily: FONTS.heading, fontWeight: 600, fontSize: 11, letterSpacing: 1, color: CC.textMuted, marginLeft: 6 }}>CHALLENGE</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, color: CC.accent }}>
            ${balance.toLocaleString()}
          </span>
          <span style={{
            fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600, padding: '2px 6px',
            borderRadius: 3, color: tierDef.color, background: `${tierDef.color}15`,
            border: `1px solid ${tierDef.color}30`,
          }}>
            {tierDef.tag}
          </span>
          <button onClick={() => setShowSettings(!showSettings)} style={{
            fontFamily: FONTS.mono, fontSize: 14, color: showSettings ? CC.accent : CC.textMuted,
            background: 'none', border: 'none', cursor: 'pointer',
          }}>⚙</button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        paddingBottom: 56, WebkitOverflowScrolling: 'touch',
      }}>
        {renderTab()}
      </div>

      {/* Bottom Tab Bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: CC.surface, borderTop: `1px solid ${CC.border}`,
        flexShrink: 0, overflowX: 'auto',
      }}>
        {TABS.map(tab => {
          const isActive = !showSettings && activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setShowSettings(false) }}
              style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 1, padding: '8px 2px',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{
                fontSize: 14, color: isActive ? CC.accent : CC.textMuted,
                transition: 'color 0.2s',
              }}>{tab.icon}</span>
              <span style={{
                fontFamily: FONTS.heading, fontWeight: 700, fontSize: 7, letterSpacing: 1,
                color: isActive ? CC.accent : CC.textMuted, transition: 'color 0.2s',
              }}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

## 6e. Challenge Components — Full Contents

### src/challenge/components/CandleChart.jsx

```jsx
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
        {emaLine(ema8, '#3b82f6')}
        {emaLine(ema21, '#f97316')}
        {emaLine(ema50, '#a855f7')}

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
        {hLine(entry, '#00ccff', 'ENTRY', true)}
        {hLine(stop, CC.loss, 'STOP', true)}
        {hLine(target, CC.profit, 'TARGET', true)}

        {/* Legend */}
        <g transform={`translate(${padding.left + 4}, ${height - 10})`}>
          <line x1={0} y1={0} x2={16} y2={0} stroke="#3b82f6" strokeWidth={1.5} />
          <text x={20} y={3} fill={CC.textMuted} fontSize={8} fontFamily={FONTS.mono}>8 EMA</text>
          <line x1={60} y1={0} x2={76} y2={0} stroke="#f97316" strokeWidth={1.5} />
          <text x={80} y={3} fill={CC.textMuted} fontSize={8} fontFamily={FONTS.mono}>21 EMA</text>
          <line x1={124} y1={0} x2={140} y2={0} stroke="#a855f7" strokeWidth={1.5} />
          <text x={144} y={3} fill={CC.textMuted} fontSize={8} fontFamily={FONTS.mono}>50 EMA</text>
        </g>
      </svg>
    </div>
  )
}
```

### src/challenge/components/MetricCard.jsx

```jsx
// ── METRIC CARD COMPONENT ─────────────────────────────────────────────────
import { CC, FONTS } from '../engine/constants.js'

export default function MetricCard({ label, value, sub, color = CC.textBright, icon, small, style }) {
  return (
    <div style={{
      background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 8,
      padding: small ? '8px 10px' : '12px 14px', position: 'relative', overflow: 'hidden',
      ...style,
    }}>
      {icon && (
        <span style={{ position: 'absolute', top: 8, right: 10, fontSize: small ? 14 : 18, opacity: 0.15 }}>{icon}</span>
      )}
      <div style={{
        fontFamily: FONTS.heading, fontSize: 9, fontWeight: 600, letterSpacing: 1.5,
        color: CC.textMuted, textTransform: 'uppercase', marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: FONTS.mono, fontSize: small ? 16 : 22, fontWeight: 700,
        color, lineHeight: 1.1,
        textShadow: color !== CC.textBright ? `0 0 12px ${color}40` : 'none',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginTop: 2,
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}
```

### src/challenge/components/ProgressBar.jsx

```jsx
// ── ANIMATED PROGRESS BAR ─────────────────────────────────────────────────
import { CC, FONTS } from '../engine/constants.js'

export default function ProgressBar({ value, max, label, color = CC.accent, height = 8, showPct = true, style }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  return (
    <div style={{ marginBottom: 8, ...style }}>
      {(label || showPct) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          {label && (
            <span style={{ fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.2, color: CC.textMuted, textTransform: 'uppercase' }}>
              {label}
            </span>
          )}
          {showPct && (
            <span style={{ fontFamily: FONTS.mono, fontSize: 10, color }}>
              {pct.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div style={{
        width: '100%', height, background: CC.bg, borderRadius: height / 2,
        border: `1px solid ${CC.border}`, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: height / 2,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          boxShadow: `0 0 8px ${color}40`,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}
```

### src/challenge/components/shared.jsx

```jsx
// ── SHARED UI COMPONENTS ──────────────────────────────────────────────────
import { CC, FONTS } from '../engine/constants.js'

export const Input = ({ label, value, onChange, type = 'text', placeholder, style, ...props }) => (
  <div style={{ marginBottom: 10, ...style }}>
    {label && <label style={{ display: 'block', fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>{label}</label>}
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '8px 12px', fontFamily: FONTS.mono, fontSize: 13,
        color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
        borderRadius: 6, transition: 'border-color 0.2s',
      }}
      onFocus={e => e.target.style.borderColor = CC.accent}
      onBlur={e => e.target.style.borderColor = CC.border}
      {...props}
    />
  </div>
)

export const Select = ({ label, value, onChange, options, style }) => (
  <div style={{ marginBottom: 10, ...style }}>
    {label && <label style={{ display: 'block', fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>{label}</label>}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '8px 12px', fontFamily: FONTS.mono, fontSize: 13,
        color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
        borderRadius: 6, appearance: 'none', cursor: 'pointer',
      }}
    >
      {options.map(o => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
  </div>
)

export const Button = ({ children, onClick, variant = 'default', disabled, style, ...props }) => {
  const variants = {
    default: { bg: `${CC.accent}15`, color: CC.accent, border: `1px solid ${CC.accent}40` },
    primary: { bg: CC.accent, color: CC.bg, border: 'none' },
    danger: { bg: `${CC.loss}15`, color: CC.loss, border: `1px solid ${CC.loss}40` },
    ghost: { bg: 'transparent', color: CC.textMuted, border: `1px solid ${CC.border}` },
    profit: { bg: `${CC.profit}15`, color: CC.profit, border: `1px solid ${CC.profit}40` },
  }
  const v = variants[variant] || variants.default
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
        padding: '8px 16px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
        background: v.bg, color: v.color, border: v.border,
        opacity: disabled ? 0.4 : 1, transition: 'opacity 0.2s',
        textTransform: 'uppercase', ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export const Badge = ({ children, color = CC.accent, style }) => (
  <span style={{
    fontFamily: FONTS.heading, fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
    padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase',
    background: `${color}20`, color, border: `1px solid ${color}40`,
    ...style,
  }}>
    {children}
  </span>
)

export const SectionHeader = ({ children, style }) => (
  <div style={{
    fontFamily: FONTS.heading, fontSize: 11, fontWeight: 700, letterSpacing: 2,
    color: CC.textMuted, textTransform: 'uppercase', padding: '12px 0 6px',
    borderBottom: `1px solid ${CC.border}`, marginBottom: 10, ...style,
  }}>
    {children}
  </div>
)

export const Panel = ({ children, style }) => (
  <div style={{
    background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 8,
    padding: 14, marginBottom: 10, ...style,
  }}>
    {children}
  </div>
)

export const Row = ({ children, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}>
    {children}
  </div>
)

export const Grid = ({ children, cols = 2, style }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, ...style,
  }}>
    {children}
  </div>
)
```

## 6f. Challenge Tabs — Full Contents

### src/challenge/tabs/CommandTab.jsx

```jsx
// ── COMMAND TAB — Dashboard Overview ──────────────────────────────────────
import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { CHALLENGE, TIERS, CC, FONTS, SETUP_TYPES } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { Panel, Grid, SectionHeader, Badge } from '../components/shared.jsx'

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

function tradingDaysBetween(start, end) {
  let count = 0
  const d = new Date(start)
  const e = new Date(end)
  while (d <= e) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export default function CommandTab({ balance, trades, balanceHistory, openPositions }) {
  const tier = getTier(balance)
  const tierDef = TIERS[tier]

  const today = new Date().toISOString().split('T')[0]
  const totalDays = tradingDaysBetween(CHALLENGE.startDate, CHALLENGE.endDate)
  const daysPassed = Math.max(0, tradingDaysBetween(CHALLENGE.startDate, today))
  const daysLeft = Math.max(0, totalDays - daysPassed)

  // Compound target curve
  const dailyRate = Math.pow(CHALLENGE.targetCapital / CHALLENGE.startingCapital, 1 / totalDays)
  const targetToday = CHALLENGE.startingCapital * Math.pow(dailyRate, daysPassed)
  const pace = balance >= targetToday ? 'AHEAD' : balance >= targetToday * 0.9 ? 'ON PACE' : 'BEHIND'
  const paceColor = pace === 'AHEAD' ? CC.profit : pace === 'ON PACE' ? CC.warning : CC.loss

  // Today's P&L
  const todayTrades = trades.filter(t => t.closeDate === today && t.status === 'closed')
  const todayPL = todayTrades.reduce((a, t) => a + (t.pnl || 0), 0)
  const requiredDaily = daysLeft > 0 ? (CHALLENGE.targetCapital - balance) / daysLeft : 0

  // Performance stats
  const closedTrades = trades.filter(t => t.status === 'closed')
  const wins = closedTrades.filter(t => (t.pnl || 0) > 0)
  const losses = closedTrades.filter(t => (t.pnl || 0) <= 0)
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length * 100) : 0
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / losses.length) : 0
  const profitFactor = avgLoss > 0 && losses.length > 0
    ? (wins.reduce((a, t) => a + t.pnl, 0)) / Math.abs(losses.reduce((a, t) => a + t.pnl, 0)) : 0
  const expectancy = closedTrades.length > 0
    ? (winRate / 100 * avgWin) - ((100 - winRate) / 100 * avgLoss) : 0

  // Portfolio heat
  const openHeat = openPositions.reduce((a, t) => a + (t.maxRisk || 0), 0)
  const maxHeat = balance * tierDef.riskPct * tierDef.maxPositions

  // Equity curve data
  const chartData = useMemo(() => {
    const data = []
    let day = 0
    const d = new Date(CHALLENGE.startDate)
    const endD = new Date(CHALLENGE.endDate)
    while (d <= endD) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) {
        const dateStr = d.toISOString().split('T')[0]
        const targetVal = CHALLENGE.startingCapital * Math.pow(dailyRate, day)
        const histEntry = balanceHistory.find(h => h.date === dateStr)
        data.push({
          date: dateStr,
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          target: Math.round(targetVal),
          actual: histEntry ? histEntry.balance : null,
        })
        day++
      }
      d.setDate(d.getDate() + 1)
    }
    return data
  }, [balanceHistory, dailyRate])

  // Setup performance
  const setupPerf = useMemo(() => {
    const map = {}
    closedTrades.forEach(t => {
      const key = t.setupType || 'other'
      if (!map[key]) map[key] = { wins: 0, losses: 0, pnl: 0, count: 0 }
      map[key].count++
      map[key].pnl += t.pnl || 0
      if ((t.pnl || 0) > 0) map[key].wins++
      else map[key].losses++
    })
    return Object.entries(map).map(([key, v]) => ({
      key,
      label: SETUP_TYPES.find(s => s.key === key)?.label || key,
      ...v,
      winRate: v.count > 0 ? (v.wins / v.count * 100) : 0,
    })).sort((a, b) => b.pnl - a.pnl)
  }, [closedTrades])

  return (
    <div style={{ padding: 12 }}>
      {/* Pace Banner */}
      <div style={{
        textAlign: 'center', padding: '8px 14px', marginBottom: 12,
        background: `${paceColor}10`, border: `1px solid ${paceColor}30`,
        borderRadius: 8, fontFamily: FONTS.heading,
      }}>
        <span style={{ fontSize: 10, color: CC.textMuted, letterSpacing: 2 }}>PACE STATUS </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: paceColor, letterSpacing: 3 }}>{pace}</span>
        <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginTop: 2 }}>
          Day {daysPassed}/{totalDays} • Target today: ${Math.round(targetToday).toLocaleString()} • {daysLeft} days left
        </div>
      </div>

      {/* Key Metrics */}
      <Grid cols={2}>
        <MetricCard label="Balance" value={`$${balance.toLocaleString()}`} color={CC.accent} icon="◈" sub={`${((balance - CHALLENGE.startingCapital) / CHALLENGE.startingCapital * 100).toFixed(1)}% return`} />
        <MetricCard label="Target" value={`$${CHALLENGE.targetCapital.toLocaleString()}`} color={CC.gold} icon="★" sub={`$${(CHALLENGE.targetCapital - balance).toLocaleString()} to go`} />
        <MetricCard label="Today P&L" value={`${todayPL >= 0 ? '+' : ''}$${todayPL.toFixed(0)}`} color={todayPL >= 0 ? CC.profit : CC.loss} icon="△" sub={`${todayTrades.length} trades`} />
        <MetricCard label="Required Daily" value={`$${Math.round(requiredDaily).toLocaleString()}`} color={CC.blue} icon="→" sub={`${(requiredDaily / balance * 100).toFixed(1)}% per day`} />
      </Grid>

      {/* Challenge Progress */}
      <Panel style={{ marginTop: 10 }}>
        <ProgressBar
          value={balance - CHALLENGE.startingCapital}
          max={CHALLENGE.targetCapital - CHALLENGE.startingCapital}
          label="Challenge Progress"
          color={tierDef.color}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
          <span>$5,000</span>
          {TIERS.map(t => (
            <span key={t.name} style={{ color: t.color }}>{t.name}</span>
          ))}
          <span>$15,000</span>
        </div>
      </Panel>

      {/* Equity Curve */}
      <SectionHeader>Equity Curve</SectionHeader>
      <Panel style={{ height: 200, padding: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CC.accent} stopOpacity={0.3} />
                <stop offset="100%" stopColor={CC.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: CC.textMuted, fontFamily: FONTS.mono }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: CC.textMuted, fontFamily: FONTS.mono }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11 }}
              labelStyle={{ color: CC.textMuted }}
              formatter={(v, name) => [`$${v?.toLocaleString() || '—'}`, name === 'target' ? 'Target' : 'Actual']}
            />
            <Area type="monotone" dataKey="target" stroke={CC.textMuted} strokeDasharray="4 3" fill="none" strokeWidth={1} />
            <Area type="monotone" dataKey="actual" stroke={CC.accent} fill="url(#actualGrad)" strokeWidth={2} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      {/* Performance Stats */}
      <SectionHeader>Performance</SectionHeader>
      <Grid cols={3}>
        <MetricCard small label="Win Rate" value={`${winRate.toFixed(0)}%`} color={winRate >= 50 ? CC.profit : CC.loss} />
        <MetricCard small label="Profit Factor" value={profitFactor.toFixed(2)} color={profitFactor >= 1.5 ? CC.profit : profitFactor >= 1 ? CC.warning : CC.loss} />
        <MetricCard small label="Expectancy" value={`$${expectancy.toFixed(0)}`} color={expectancy > 0 ? CC.profit : CC.loss} />
        <MetricCard small label="Avg Win" value={`+$${avgWin.toFixed(0)}`} color={CC.profit} />
        <MetricCard small label="Avg Loss" value={`-$${avgLoss.toFixed(0)}`} color={CC.loss} />
        <MetricCard small label="Total Trades" value={closedTrades.length} color={CC.textBright} />
      </Grid>

      {/* Risk Monitor */}
      <SectionHeader>Risk Monitor</SectionHeader>
      <Grid cols={2}>
        <MetricCard small label="Current Tier" value={tierDef.name} color={tierDef.color} sub={tierDef.tag} />
        <MetricCard small label="Risk Per Trade" value={`$${Math.round(balance * tierDef.riskPct)}`} color={CC.accent} sub={`${(tierDef.riskPct * 100).toFixed(1)}%`} />
        <MetricCard small label="Max Positions" value={tierDef.maxPositions} color={CC.blue} sub={`${openPositions.length} open`} />
        <MetricCard small label="Open Heat" value={`$${openHeat.toFixed(0)}`} color={openHeat > maxHeat * 0.8 ? CC.loss : CC.accent} sub={`of $${Math.round(maxHeat)} max`} />
      </Grid>
      <ProgressBar value={openHeat} max={maxHeat} label="Portfolio Heat" color={openHeat > maxHeat * 0.8 ? CC.loss : CC.accent} />

      {/* Setup Performance */}
      {setupPerf.length > 0 && (
        <>
          <SectionHeader>Setup Performance</SectionHeader>
          {setupPerf.map(s => (
            <Panel key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', marginBottom: 6 }}>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 12, fontWeight: 600, color: CC.textBright }}>{s.label}</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>{s.count} trades • {s.winRate.toFixed(0)}% WR</div>
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700, color: s.pnl >= 0 ? CC.profit : CC.loss }}>
                {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(0)}
              </div>
            </Panel>
          ))}
        </>
      )}

      {/* Open Positions */}
      {openPositions.length > 0 && (
        <>
          <SectionHeader>Open Positions</SectionHeader>
          {openPositions.map(t => (
            <Panel key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', marginBottom: 6 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: FONTS.heading, fontSize: 13, fontWeight: 700, color: CC.textBright }}>{t.ticker}</span>
                  <Badge color={t.direction === 'bullish' ? CC.profit : t.direction === 'bearish' ? CC.loss : CC.blue}>{t.direction}</Badge>
                </div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>{t.strategyLabel || t.strategy} • {t.contracts} ct</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: CC.textMuted }}>Entry: ${t.entryPrice}</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.loss }}>Risk: ${(t.maxRisk || 0).toFixed(0)}</div>
              </div>
            </Panel>
          ))}
        </>
      )}
    </div>
  )
}
```

### src/challenge/tabs/DebriefTab.jsx

```jsx
// ── DEBRIEF TAB — Daily Debrief, Calendar, Checklist, Mood ────────────────
import { useState, useMemo } from 'react'
import { CHALLENGE, DEBRIEF_CHECKLIST, MOOD_STATES, CC, FONTS } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import { Panel, SectionHeader, Badge, Button, Grid } from '../components/shared.jsx'

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function getWeekDates(dateStr) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  const dates = []
  for (let i = 0; i < 5; i++) {
    const wd = new Date(monday)
    wd.setDate(monday.getDate() + i)
    dates.push(wd.toISOString().split('T')[0])
  }
  return dates
}

export default function DebriefTab({ trades, debriefs, setDebriefs, balanceHistory }) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const debrief = debriefs[selectedDate] || { checklist: {}, mood: null, notes: '', saved: false }

  const setDebrief = (updates) => {
    setDebriefs(prev => ({
      ...prev,
      [selectedDate]: { ...debrief, ...updates, saved: true },
    }))
  }

  // Day's trades
  const dayTrades = trades.filter(t => t.closeDate === selectedDate || t.date === selectedDate)
  const closedToday = dayTrades.filter(t => t.status === 'closed' && t.closeDate === selectedDate)
  const dayPL = closedToday.reduce((a, t) => a + (t.pnl || 0), 0)
  const dayWins = closedToday.filter(t => (t.pnl || 0) > 0)
  const dayWR = closedToday.length > 0 ? (dayWins.length / closedToday.length * 100) : 0
  const dayReviews = closedToday.filter(t => t.review)
  const avgExecGrade = dayReviews.length > 0 ? Math.round(dayReviews.reduce((a, t) => a + t.review.execGrade, 0) / dayReviews.length) : 0
  const dayGrade = dayPL > 0 ? (dayWR >= 60 ? 'A' : 'B') : dayPL === 0 ? 'C' : (dayWR >= 40 ? 'C' : 'D')
  const processGrade = avgExecGrade >= 80 ? 'A' : avgExecGrade >= 60 ? 'B' : avgExecGrade >= 40 ? 'C' : avgExecGrade > 0 ? 'D' : '—'

  // Streak
  const streak = useMemo(() => {
    const allDates = [...new Set(trades.filter(t => t.status === 'closed').map(t => t.closeDate))].sort().reverse()
    let s = 0
    for (const d of allDates) {
      const dTrades = trades.filter(t => t.closeDate === d && t.status === 'closed')
      const dPL = dTrades.reduce((a, t) => a + (t.pnl || 0), 0)
      if (dPL > 0) s++
      else break
    }
    return s
  }, [trades])

  // Pace
  const daysPassed = Math.max(1, (() => {
    let count = 0
    const d = new Date(CHALLENGE.startDate)
    const end = new Date(selectedDate)
    while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) count++; d.setDate(d.getDate() + 1) }
    return count
  })())
  const totalDays = (() => {
    let count = 0
    const d = new Date(CHALLENGE.startDate)
    const end = new Date(CHALLENGE.endDate)
    while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) count++; d.setDate(d.getDate() + 1) }
    return count
  })()
  const dailyRate = Math.pow(CHALLENGE.targetCapital / CHALLENGE.startingCapital, 1 / totalDays)
  const targetToday = CHALLENGE.startingCapital * Math.pow(dailyRate, daysPassed)
  const currentBalance = balanceHistory.find(h => h.date === selectedDate)?.balance || balanceHistory[balanceHistory.length - 1]?.balance || CHALLENGE.startingCapital

  // Week context
  const weekDates = getWeekDates(selectedDate)
  const weekTrades = trades.filter(t => t.status === 'closed' && weekDates.includes(t.closeDate))
  const weekPL = weekTrades.reduce((a, t) => a + (t.pnl || 0), 0)
  const weekWins = weekTrades.filter(t => (t.pnl || 0) > 0)
  const weekWR = weekTrades.length > 0 ? (weekWins.length / weekTrades.length * 100) : 0

  // Checklist
  const allCheckItems = [...DEBRIEF_CHECKLIST.premarkt, ...DEBRIEF_CHECKLIST.execution, ...DEBRIEF_CHECKLIST.postmarket]
  const checkedCount = allCheckItems.filter(item => debrief.checklist[item]).length

  // Calendar heatmap (last 20 trading days)
  const calendarDays = useMemo(() => {
    const days = []
    const d = new Date(selectedDate)
    let count = 0
    while (count < 20) {
      d.setDate(d.getDate() - 1)
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        const dateStr = d.toISOString().split('T')[0]
        const dayT = trades.filter(t => t.status === 'closed' && t.closeDate === dateStr)
        const pl = dayT.reduce((a, t) => a + (t.pnl || 0), 0)
        const hasDebrief = !!debriefs[dateStr]?.saved
        days.unshift({ date: dateStr, pnl: pl, trades: dayT.length, hasDebrief })
        count++
      }
    }
    return days
  }, [selectedDate, trades, debriefs])

  // Debrief history
  const debriefDates = Object.keys(debriefs).filter(d => debriefs[d].saved).sort().reverse().slice(0, 10)

  return (
    <div style={{ padding: 12 }}>
      {/* Date Navigator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Button onClick={() => setSelectedDate(addDays(selectedDate, -1))} variant="ghost" style={{ padding: '6px 12px' }}>◀</Button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: FONTS.heading, fontSize: 16, fontWeight: 700, color: CC.textBright }}>{formatDate(selectedDate)}</div>
          {selectedDate !== today && (
            <button onClick={() => setSelectedDate(today)} style={{
              fontFamily: FONTS.mono, fontSize: 9, color: CC.accent, background: 'none', border: 'none', cursor: 'pointer', marginTop: 2,
            }}>TODAY</button>
          )}
        </div>
        <Button onClick={() => setSelectedDate(addDays(selectedDate, 1))} variant="ghost" style={{ padding: '6px 12px' }}>▶</Button>
      </div>

      {/* Day Summary */}
      <Grid cols={2}>
        <MetricCard small label="P&L" value={`${dayPL >= 0 ? '+' : ''}$${dayPL.toFixed(0)}`} color={dayPL >= 0 ? CC.profit : CC.loss} />
        <MetricCard small label="Win Rate" value={`${dayWR.toFixed(0)}%`} color={dayWR >= 50 ? CC.profit : CC.loss} />
        <MetricCard small label="Day Grade" value={dayGrade} color={dayGrade <= 'B' ? CC.profit : CC.warning} />
        <MetricCard small label="Process" value={processGrade} color={processGrade <= 'B' ? CC.accent : CC.warning} />
      </Grid>

      <Grid cols={2} style={{ marginTop: 8 }}>
        <MetricCard small label="Win Streak" value={streak} color={streak > 0 ? CC.profit : CC.textMuted} />
        <MetricCard small label="Trades Today" value={closedToday.length} color={CC.textBright} />
      </Grid>

      {/* Pace Banner */}
      <Panel style={{ marginTop: 10, padding: '8px 12px', textAlign: 'center' }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: currentBalance >= targetToday ? CC.profit : CC.loss }}>
          Balance: ${currentBalance.toLocaleString()} {currentBalance >= targetToday ? '▲ AHEAD' : '▼ BEHIND'} target ${Math.round(targetToday).toLocaleString()}
        </span>
      </Panel>

      {/* Day's Trades */}
      {closedToday.length > 0 && (
        <>
          <SectionHeader style={{ marginTop: 10 }}>Day's Trades</SectionHeader>
          {closedToday.map(t => (
            <Panel key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', marginBottom: 4 }}>
              <div>
                <span style={{ fontFamily: FONTS.heading, fontSize: 13, fontWeight: 700, color: CC.textBright }}>{t.ticker}</span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginLeft: 8 }}>{t.strategyLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.pnl >= 0 ? CC.profit : CC.loss }}>
                  {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(0)}
                </span>
                {t.review && <Badge color={t.review.execGrade >= 70 ? CC.profit : CC.warning}>{t.review.gradeLabel}</Badge>}
              </div>
            </Panel>
          ))}
        </>
      )}

      {/* Week Context */}
      <SectionHeader style={{ marginTop: 10 }}>Week Context</SectionHeader>
      <Grid cols={3}>
        <MetricCard small label="Week P&L" value={`${weekPL >= 0 ? '+' : ''}$${weekPL.toFixed(0)}`} color={weekPL >= 0 ? CC.profit : CC.loss} />
        <MetricCard small label="Week WR" value={`${weekWR.toFixed(0)}%`} color={weekWR >= 50 ? CC.profit : CC.loss} />
        <MetricCard small label="Week Trades" value={weekTrades.length} color={CC.textBright} />
      </Grid>

      {/* Daily Checklist */}
      <SectionHeader style={{ marginTop: 10 }}>Daily Checklist ({checkedCount}/{allCheckItems.length})</SectionHeader>
      {Object.entries(DEBRIEF_CHECKLIST).map(([phase, items]) => (
        <Panel key={phase} style={{ marginBottom: 6 }}>
          <div style={{ fontFamily: FONTS.heading, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: CC.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>
            {phase === 'premarkt' ? 'Pre-Market' : phase === 'execution' ? 'Execution' : 'Post-Market'}
          </div>
          {items.map(item => (
            <label key={item} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
              borderBottom: `1px solid ${CC.border}11`, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={!!debrief.checklist[item]}
                onChange={e => setDebrief({ checklist: { ...debrief.checklist, [item]: e.target.checked } })}
                style={{ accentColor: CC.accent }}
              />
              <span style={{ fontFamily: FONTS.body, fontSize: 12, color: debrief.checklist[item] ? CC.textBright : CC.textMuted }}>{item}</span>
            </label>
          ))}
        </Panel>
      ))}

      {/* Mood Tracker */}
      <SectionHeader>Mood</SectionHeader>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {MOOD_STATES.map(m => (
          <button key={m.key} onClick={() => setDebrief({ mood: m.key })} style={{
            flex: 1, padding: '10px 4px', borderRadius: 6, cursor: 'pointer', textAlign: 'center',
            background: debrief.mood === m.key ? `${m.color}20` : CC.surface,
            border: `1px solid ${debrief.mood === m.key ? m.color : CC.border}`,
          }}>
            <div style={{ fontSize: 18 }}>{m.emoji}</div>
            <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: debrief.mood === m.key ? m.color : CC.textMuted, marginTop: 2 }}>{m.label}</div>
          </button>
        ))}
      </div>

      {/* Journal Notes */}
      <SectionHeader>Journal</SectionHeader>
      <textarea
        value={debrief.notes || ''}
        onChange={e => setDebrief({ notes: e.target.value })}
        placeholder="What did you learn today? What would you do differently?"
        rows={4}
        style={{
          width: '100%', padding: '10px 12px', fontFamily: FONTS.body, fontSize: 12,
          color: CC.textBright, background: CC.surface, border: `1px solid ${CC.border}`,
          borderRadius: 6, resize: 'vertical', marginBottom: 12,
        }}
      />

      {/* Performance Calendar */}
      <SectionHeader>Last 20 Trading Days</SectionHeader>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 12 }}>
        {calendarDays.map(d => {
          const color = d.trades === 0 ? CC.textMuted : d.pnl > 0 ? CC.profit : d.pnl < 0 ? CC.loss : CC.warning
          const bg = d.trades === 0 ? CC.surface : d.pnl > 0 ? `${CC.profit}15` : d.pnl < 0 ? `${CC.loss}15` : `${CC.warning}10`
          return (
            <button
              key={d.date}
              onClick={() => setSelectedDate(d.date)}
              style={{
                padding: '6px 2px', borderRadius: 6, cursor: 'pointer', textAlign: 'center',
                background: d.date === selectedDate ? `${CC.accent}25` : bg,
                border: `1px solid ${d.date === selectedDate ? CC.accent : d.hasDebrief ? `${CC.accent}40` : CC.border}`,
              }}
            >
              <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>{d.date.slice(5)}</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color }}>
                {d.trades === 0 ? '—' : `${d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(0)}`}
              </div>
              {d.hasDebrief && <div style={{ width: 4, height: 4, borderRadius: 2, background: CC.accent, margin: '2px auto 0' }} />}
            </button>
          )
        })}
      </div>

      {/* Debrief History */}
      {debriefDates.length > 0 && (
        <>
          <SectionHeader>Recent Debriefs</SectionHeader>
          {debriefDates.map(d => {
            const db = debriefs[d]
            const mood = MOOD_STATES.find(m => m.key === db.mood)
            return (
              <Panel key={d} onClick={() => setSelectedDate(d)} style={{ cursor: 'pointer', padding: '8px 12px', marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.textBright }}>{formatDate(d)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {mood && <span style={{ fontSize: 14 }}>{mood.emoji}</span>}
                    {db.notes && <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>📝</span>}
                  </div>
                </div>
              </Panel>
            )
          })}
        </>
      )}
    </div>
  )
}
```

### src/challenge/tabs/IdeasTab.jsx

```jsx
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
```

### src/challenge/tabs/PlaybookTab.jsx

```jsx
// ── PLAYBOOK TAB — Tiers, Setups, Process ─────────────────────────────────
import { TIERS, PLAYBOOK_SETUPS, DEBRIEF_CHECKLIST, CC, FONTS } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import { Panel, SectionHeader, Badge, Grid } from '../components/shared.jsx'

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

export default function PlaybookTab({ balance }) {
  const currentTier = getTier(balance)

  return (
    <div style={{ padding: 12 }}>
      {/* Tier Cards */}
      <SectionHeader>Challenge Tiers</SectionHeader>
      {TIERS.map((tier, idx) => {
        const isCurrent = idx === currentTier
        return (
          <Panel key={tier.name} style={{
            marginBottom: 8, padding: '12px 14px',
            borderColor: isCurrent ? tier.color : CC.border,
            background: isCurrent ? `${tier.color}08` : CC.surface,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: FONTS.heading, fontSize: 16, fontWeight: 700, color: tier.color }}>{tier.name}</span>
                {isCurrent && <Badge color={tier.color}>CURRENT</Badge>}
              </div>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.textMuted }}>
                ${tier.range[0].toLocaleString()} — {tier.range[1] === Infinity ? '∞' : `$${tier.range[1].toLocaleString()}`}
              </span>
            </div>

            <Grid cols={3} style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>RISK</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.textBright }}>{(tier.riskPct * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>MAX POS</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.textBright }}>{tier.maxPositions}</div>
              </div>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>STRATEGIES</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.textBright }}>{tier.strategies.length}</div>
              </div>
            </Grid>

            <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted, letterSpacing: 1, marginBottom: 4 }}>RULES</div>
            {tier.rules.map((rule, i) => (
              <div key={i} style={{
                fontFamily: FONTS.body, fontSize: 11, color: CC.text,
                padding: '3px 0', borderBottom: i < tier.rules.length - 1 ? `1px solid ${CC.border}11` : 'none',
              }}>
                • {rule}
              </div>
            ))}

            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {tier.strategies.map(s => (
                <span key={s} style={{
                  fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted,
                  background: CC.bg, padding: '2px 5px', borderRadius: 3,
                }}>
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </Panel>
        )
      })}

      {/* High-Probability Setups */}
      <SectionHeader style={{ marginTop: 12 }}>High-Probability Setups</SectionHeader>
      {PLAYBOOK_SETUPS.map((setup, idx) => {
        const typeColor = setup.type === 'long' ? CC.profit : setup.type === 'short' ? CC.loss : CC.blue
        return (
          <Panel key={idx} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: FONTS.heading, fontSize: 14, fontWeight: 700, color: CC.textBright }}>{setup.name}</span>
                <Badge color={typeColor}>{setup.type}</Badge>
              </div>
            </div>

            <Grid cols={2} style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>WIN RATE</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.accent }}>{setup.winRate}</div>
              </div>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>R:R TARGET</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.accent }}>{setup.rrTarget}</div>
              </div>
            </Grid>

            {[
              { label: 'ENTRY', value: setup.entry },
              { label: 'TIMEFRAME', value: setup.timeframe },
              { label: 'SIZING', value: setup.sizing },
              { label: 'IV RULE', value: setup.ivRule },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 4 }}>
                <span style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>{item.label}: </span>
                <span style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.text }}>{item.value}</span>
              </div>
            ))}

            <div style={{
              marginTop: 6, padding: '6px 10px', background: `${CC.accent}08`, borderRadius: 4,
              fontFamily: FONTS.body, fontSize: 11, color: CC.accent, fontStyle: 'italic',
            }}>
              Edge: {setup.edge}
            </div>
          </Panel>
        )
      })}

      {/* Daily Process Checklist */}
      <SectionHeader style={{ marginTop: 12 }}>Daily Process</SectionHeader>
      {[
        { phase: 'Pre-Market', items: DEBRIEF_CHECKLIST.premarkt, color: CC.blue },
        { phase: 'Market Hours', items: DEBRIEF_CHECKLIST.execution, color: CC.accent },
        { phase: 'Post-Market', items: DEBRIEF_CHECKLIST.postmarket, color: CC.purple },
      ].map(section => (
        <Panel key={section.phase} style={{ marginBottom: 8 }}>
          <div style={{
            fontFamily: FONTS.heading, fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
            color: section.color, marginBottom: 6,
          }}>
            {section.phase.toUpperCase()}
          </div>
          {section.items.map((item, i) => (
            <div key={i} style={{
              fontFamily: FONTS.body, fontSize: 12, color: CC.text,
              padding: '4px 0', paddingLeft: 12,
              borderBottom: i < section.items.length - 1 ? `1px solid ${CC.border}11` : 'none',
            }}>
              {i + 1}. {item}
            </div>
          ))}
        </Panel>
      ))}
    </div>
  )
}
```

### src/challenge/tabs/RiskTab.jsx

```jsx
// ── RISK TAB — Monte Carlo, Runway, Drawdown Analysis ─────────────────────
import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CHALLENGE, TIERS, CC, FONTS } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import { Panel, SectionHeader, Grid, Badge } from '../components/shared.jsx'

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

function runMonteCarlo(balance, winRate, avgRR, tierRiskPct, numTrades = 200, numRuns = 200) {
  const results = []
  for (let run = 0; run < numRuns; run++) {
    let bal = balance
    let maxBal = balance
    let maxDD = 0
    for (let i = 0; i < numTrades; i++) {
      const risk = bal * tierRiskPct
      if (Math.random() < winRate) {
        bal += risk * avgRR
      } else {
        bal -= risk
      }
      bal = Math.max(0, bal)
      if (bal > maxBal) maxBal = bal
      const dd = maxBal > 0 ? (maxBal - bal) / maxBal : 0
      if (dd > maxDD) maxDD = dd
      if (bal <= 0) break
    }
    results.push({ final: bal, maxDD, hit15k: bal >= CHALLENGE.targetCapital, bust: bal <= 0 })
  }
  const finals = results.map(r => r.final).sort((a, b) => a - b)
  return {
    hit15kPct: Math.round(results.filter(r => r.hit15k).length / numRuns * 100),
    medianBalance: Math.round(finals[Math.floor(finals.length / 2)]),
    bustPct: Math.round(results.filter(r => r.bust).length / numRuns * 100),
    avgMaxDD: Math.round(results.reduce((a, r) => a + r.maxDD, 0) / numRuns * 100),
    p10: Math.round(finals[Math.floor(finals.length * 0.1)]),
    p90: Math.round(finals[Math.floor(finals.length * 0.9)]),
  }
}

const SCENARIOS = [
  { name: 'Conservative', winRate: 0.45, rr: 2.5, color: CC.blue },
  { name: 'Target', winRate: 0.50, rr: 3.0, color: CC.accent },
  { name: 'Aggressive', winRate: 0.55, rr: 2.0, color: CC.warning },
  { name: 'Elite', winRate: 0.55, rr: 3.0, color: CC.profit },
]

export default function RiskTab({ balance, trades }) {
  const tier = getTier(balance)
  const tierDef = TIERS[tier]
  const riskPerTrade = balance * tierDef.riskPct

  const closedTrades = trades.filter(t => t.status === 'closed')
  const wins = closedTrades.filter(t => (t.pnl || 0) > 0)
  const losses = closedTrades.filter(t => (t.pnl || 0) <= 0)
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / losses.length) : riskPerTrade

  // Runway
  const runway = riskPerTrade > 0 ? Math.floor(balance / riskPerTrade) : Infinity
  const killZone = 2500
  const tradesToKillZone = riskPerTrade > 0 ? Math.floor((balance - killZone) / riskPerTrade) : Infinity

  // Max drawdown from history
  let maxDD = 0
  let maxLoseStreak = 0
  let currentLoseStreak = 0
  closedTrades.forEach(t => {
    if ((t.pnl || 0) <= 0) {
      currentLoseStreak++
      maxLoseStreak = Math.max(maxLoseStreak, currentLoseStreak)
    } else {
      currentLoseStreak = 0
    }
  })

  // Breakeven win rate table
  const breakevenTable = useMemo(() => {
    return [1.5, 2.0, 2.5, 3.0, 3.5, 4.0].map(rr => ({
      rr,
      breakevenWR: Math.round((1 / (1 + rr)) * 100),
      edge10: Math.round((1 / (1 + rr)) * 100) + 10,
    }))
  }, [])

  // Monte Carlo results
  const monteCarloResults = useMemo(() => {
    return SCENARIOS.map(s => ({
      ...s,
      results: runMonteCarlo(balance, s.winRate, s.rr, tierDef.riskPct),
    }))
  }, [balance, tierDef.riskPct])

  // Consecutive loss scenarios
  const lossScenarios = useMemo(() => {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
      let bal = balance
      for (let i = 0; i < n; i++) {
        bal -= bal * tierDef.riskPct
      }
      return {
        losses: n,
        balance: Math.round(bal),
        drawdown: Math.round((balance - bal) / balance * 100),
        label: `${n}L`,
      }
    })
  }, [balance, tierDef.riskPct])

  return (
    <div style={{ padding: 12 }}>
      {/* Core Risk Metrics */}
      <Grid cols={2}>
        <MetricCard label="Runway" value={`${runway} trades`} color={runway > 20 ? CC.accent : CC.loss} icon="→" sub="Until broke" />
        <MetricCard label="Kill Zone" value={`${tradesToKillZone} trades`} color={tradesToKillZone > 10 ? CC.accent : CC.warning} icon="⚠" sub={`To $${killZone}`} />
        <MetricCard label="Max Drawdown" value={`${maxDD}%`} color={CC.textBright} icon="▽" sub="Observed" />
        <MetricCard label="Max Losing Streak" value={maxLoseStreak} color={maxLoseStreak > 4 ? CC.loss : CC.textBright} icon="✕" sub="Consecutive" />
      </Grid>

      {/* Breakeven Win Rate Table */}
      <SectionHeader style={{ marginTop: 12 }}>Breakeven Win Rate by R:R</SectionHeader>
      <Panel style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${CC.border}` }}>
              {['R:R', 'Breakeven', '+10% Edge'].map(h => (
                <th key={h} style={{
                  fontFamily: FONTS.heading, fontSize: 9, fontWeight: 600, letterSpacing: 1,
                  color: CC.textMuted, textTransform: 'uppercase', padding: '8px 12px', textAlign: 'center',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breakevenTable.map(r => (
              <tr key={r.rr} style={{ borderBottom: `1px solid ${CC.border}22` }}>
                <td style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.textBright, padding: '6px 12px', textAlign: 'center' }}>{r.rr}:1</td>
                <td style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.warning, padding: '6px 12px', textAlign: 'center' }}>{r.breakevenWR}%</td>
                <td style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.profit, padding: '6px 12px', textAlign: 'center' }}>{r.edge10}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Monte Carlo */}
      <SectionHeader style={{ marginTop: 12 }}>Monte Carlo Simulation (200 runs × 200 trades)</SectionHeader>
      {monteCarloResults.map(s => (
        <Panel key={s.name} style={{ marginBottom: 8, padding: '10px 12px', borderColor: `${s.color}20` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div>
              <span style={{ fontFamily: FONTS.heading, fontSize: 13, fontWeight: 700, color: s.color }}>{s.name}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginLeft: 8 }}>{(s.winRate * 100).toFixed(0)}% WR / {s.rr}:1 R:R</span>
            </div>
          </div>
          <Grid cols={3}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700, color: s.results.hit15kPct >= 50 ? CC.profit : s.results.hit15kPct >= 25 ? CC.warning : CC.loss }}>
                {s.results.hit15kPct}%
              </div>
              <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>HIT $15K</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700, color: CC.textBright }}>
                ${(s.results.medianBalance / 1000).toFixed(1)}k
              </div>
              <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>MEDIAN</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700, color: s.results.bustPct > 10 ? CC.loss : CC.textMuted }}>
                {s.results.bustPct}%
              </div>
              <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>BUST</div>
            </div>
          </Grid>
          <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted, marginTop: 4, textAlign: 'center' }}>
            P10: ${s.results.p10.toLocaleString()} • P90: ${s.results.p90.toLocaleString()} • Avg DD: {s.results.avgMaxDD}%
          </div>
        </Panel>
      ))}

      {/* Consecutive Loss Chart */}
      <SectionHeader style={{ marginTop: 12 }}>Consecutive Loss Scenarios</SectionHeader>
      <Panel style={{ height: 200, padding: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={lossScenarios} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: CC.textMuted, fontFamily: FONTS.mono }} />
            <YAxis tick={{ fontSize: 9, fill: CC.textMuted, fontFamily: FONTS.mono }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11 }}
              formatter={(v) => [`$${v.toLocaleString()}`, 'Balance']}
            />
            <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
              {lossScenarios.map((entry, idx) => (
                <Cell key={idx} fill={entry.balance >= killZone ? CC.accent : entry.balance > 0 ? CC.warning : CC.loss} opacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted, textAlign: 'center', marginTop: 4 }}>
        Balance after N consecutive losses at {(tierDef.riskPct * 100).toFixed(1)}% risk per trade
      </div>
    </div>
  )
}
```

### src/challenge/tabs/SizerTab.jsx

```jsx
// ── SIZER TAB — Position Sizer ────────────────────────────────────────────
import { useState, useMemo } from 'react'
import { TIERS, CC, FONTS } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import { Panel, SectionHeader, Button, Input, Grid } from '../components/shared.jsx'

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

export default function SizerTab({ balance }) {
  const [mode, setMode] = useState('single') // 'single' or 'spread'
  const [entry, setEntry] = useState('')
  const [stop, setStop] = useState('')
  const [target, setTarget] = useState('')
  const [width, setWidth] = useState('')
  const [cost, setCost] = useState('')

  const tier = getTier(balance)
  const tierDef = TIERS[tier]
  const riskBudget = balance * tierDef.riskPct

  const calc = useMemo(() => {
    if (mode === 'single') {
      const e = parseFloat(entry) || 0
      const s = parseFloat(stop) || 0
      const t = parseFloat(target) || 0
      if (e <= 0) return null
      const riskPerContract = Math.abs(e - s) * 100
      const maxContracts = riskPerContract > 0 ? Math.floor(riskBudget / riskPerContract) : 0
      const rr = s > 0 ? Math.abs(t - e) / Math.abs(e - s) : 0
      const maxLoss = maxContracts * riskPerContract
      const maxGain = maxContracts * Math.abs(t - e) * 100
      return { maxContracts, rr, maxLoss, maxGain, riskPerContract }
    } else {
      const w = parseFloat(width) || 0
      const c = parseFloat(cost) || 0
      if (c <= 0) return null
      const riskPerContract = c * 100
      const maxContracts = Math.floor(riskBudget / riskPerContract)
      const maxGainPerContract = (w - c) * 100
      const rr = c > 0 ? (w - c) / c : 0
      const maxLoss = maxContracts * riskPerContract
      const maxGain = maxContracts * maxGainPerContract
      return { maxContracts, rr, maxLoss, maxGain, riskPerContract }
    }
  }, [mode, entry, stop, target, width, cost, riskBudget])

  // Win streak projections
  const streakProjections = useMemo(() => {
    if (!calc || !calc.rr || calc.maxContracts <= 0) return []
    const avgWin = calc.riskPerContract * calc.rr * calc.maxContracts
    return [1, 2, 3, 5].map(n => ({
      streak: n,
      gain: Math.round(avgWin * n),
      balance: Math.round(balance + avgWin * n),
      pctGain: ((avgWin * n) / balance * 100).toFixed(1),
    }))
  }, [calc, balance])

  // Quick reference table
  const quickRef = useMemo(() => {
    const optionPrices = [0.25, 0.50, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0]
    return optionPrices.map(price => {
      const fullRisk = price * 100
      const full = Math.floor(riskBudget / fullRisk)
      const half = Math.floor(riskBudget / (fullRisk * 2)) // 50% stop
      const third = Math.floor(riskBudget / (fullRisk * 3)) // 33% stop
      return { price, full, half, third, risk: fullRisk }
    })
  }, [riskBudget])

  return (
    <div style={{ padding: 12 }}>
      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Button onClick={() => setMode('single')} variant={mode === 'single' ? 'primary' : 'ghost'} style={{ flex: 1 }}>SINGLE LEG</Button>
        <Button onClick={() => setMode('spread')} variant={mode === 'spread' ? 'primary' : 'ghost'} style={{ flex: 1 }}>SPREAD</Button>
      </div>

      {/* Tier Info */}
      <Panel style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', marginBottom: 10 }}>
        <div>
          <span style={{ fontFamily: FONTS.heading, fontSize: 11, fontWeight: 700, color: tierDef.color }}>{tierDef.name}</span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginLeft: 8 }}>{(tierDef.riskPct * 100).toFixed(1)}% risk</span>
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700, color: CC.accent }}>
          ${riskBudget.toFixed(0)} <span style={{ fontSize: 9, color: CC.textMuted }}>budget</span>
        </div>
      </Panel>

      {/* Input Fields */}
      <Panel>
        {mode === 'single' ? (
          <Grid cols={3}>
            <Input label="Entry" value={entry} onChange={setEntry} type="number" placeholder="0.00" />
            <Input label="Stop" value={stop} onChange={setStop} type="number" placeholder="0.00" />
            <Input label="Target" value={target} onChange={setTarget} type="number" placeholder="0.00" />
          </Grid>
        ) : (
          <Grid cols={2}>
            <Input label="Spread Width" value={width} onChange={setWidth} type="number" placeholder="e.g. 5.00" />
            <Input label="Net Cost" value={cost} onChange={setCost} type="number" placeholder="e.g. 1.50" />
          </Grid>
        )}
      </Panel>

      {/* Results */}
      {calc && (
        <>
          <Grid cols={2} style={{ marginTop: 10 }}>
            <MetricCard label="Max Contracts" value={calc.maxContracts} color={CC.accent} icon="◈" />
            <MetricCard label="R:R Ratio" value={`${calc.rr.toFixed(1)}:1`} color={calc.rr >= 3 ? CC.profit : calc.rr >= 2 ? CC.accent : CC.warning} icon="↔" />
            <MetricCard label="Max Loss" value={`$${calc.maxLoss.toFixed(0)}`} color={CC.loss} icon="▽" sub={`${(calc.maxLoss / balance * 100).toFixed(1)}% of balance`} />
            <MetricCard label="Max Gain" value={`$${calc.maxGain.toFixed(0)}`} color={CC.profit} icon="△" sub={`${(calc.maxGain / balance * 100).toFixed(1)}% of balance`} />
          </Grid>

          {/* Win Streak Projections */}
          {streakProjections.length > 0 && (
            <>
              <SectionHeader style={{ marginTop: 12 }}>Win Streak Projections</SectionHeader>
              <Panel>
                {streakProjections.map(p => (
                  <div key={p.streak} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 0', borderBottom: `1px solid ${CC.border}22`,
                  }}>
                    <span style={{ fontFamily: FONTS.heading, fontSize: 12, color: CC.textBright }}>
                      {p.streak} Win{p.streak > 1 ? 's' : ''}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: CC.profit }}>+${p.gain.toLocaleString()}</span>
                      <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginLeft: 8 }}>
                        → ${p.balance.toLocaleString()} (+{p.pctGain}%)
                      </span>
                    </div>
                  </div>
                ))}
              </Panel>
            </>
          )}
        </>
      )}

      {/* Quick Reference Table */}
      <SectionHeader style={{ marginTop: 12 }}>Quick Reference — Contracts by Option Price</SectionHeader>
      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${CC.border}` }}>
                {['Price', 'Full Risk', '50% Stop', '33% Stop'].map(h => (
                  <th key={h} style={{
                    fontFamily: FONTS.heading, fontSize: 9, fontWeight: 600, letterSpacing: 1,
                    color: CC.textMuted, textTransform: 'uppercase', padding: '8px 10px', textAlign: 'right',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quickRef.map(r => (
                <tr key={r.price} style={{ borderBottom: `1px solid ${CC.border}22` }}>
                  <td style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.textBright, padding: '6px 10px', textAlign: 'right' }}>
                    ${r.price.toFixed(2)}
                  </td>
                  <td style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.accent, padding: '6px 10px', textAlign: 'right' }}>
                    {r.full}
                  </td>
                  <td style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.accent, padding: '6px 10px', textAlign: 'right' }}>
                    {r.half}
                  </td>
                  <td style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.accent, padding: '6px 10px', textAlign: 'right' }}>
                    {r.third}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
```

### src/challenge/tabs/TradesTab.jsx

```jsx
// ── TRADES TAB — Trade Log with Entry, Close, Review ──────────────────────
import { useState, useEffect } from 'react'
import { STRATEGIES, SETUP_TYPES, TIERS, REVIEW_CRITERIA, CC, FONTS } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import { Panel, SectionHeader, Badge, Button, Input, Select, Grid } from '../components/shared.jsx'

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

const defaultForm = {
  ticker: '', strategy: 'long_call', setupType: 'momentum_breakout',
  contracts: '1', entryPrice: '', stopLoss: '', target: '',
  date: new Date().toISOString().split('T')[0],
  expiration: '', thesis: '',
}

export default function TradesTab({ trades, setTrades, balance, setBalance, balanceHistory, setBalanceHistory, pendingTrade, clearPendingTrade }) {
  const [form, setForm] = useState({ ...defaultForm })
  const [closeId, setCloseId] = useState(null)
  const [closePrice, setClosePrice] = useState('')
  const [reviewId, setReviewId] = useState(null)
  const [reviewData, setReviewData] = useState({})
  const [reviewNotes, setReviewNotes] = useState('')

  const tier = getTier(balance)
  const tierDef = TIERS[tier]

  // Accept pending trade from Ideas tab
  useEffect(() => {
    if (pendingTrade) {
      setForm({
        ticker: pendingTrade.ticker || '',
        strategy: pendingTrade.strategy || 'long_call',
        setupType: pendingTrade.setupType || 'momentum_breakout',
        contracts: '1',
        entryPrice: String(pendingTrade.entry || ''),
        stopLoss: String(pendingTrade.stop || ''),
        target: String(pendingTrade.target || ''),
        date: new Date().toISOString().split('T')[0],
        expiration: '',
        thesis: pendingTrade.reason || '',
      })
      clearPendingTrade()
    }
  }, [pendingTrade, clearPendingTrade])

  const updateField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // Risk calculations
  const entry = parseFloat(form.entryPrice) || 0
  const stop = parseFloat(form.stopLoss) || 0
  const target = parseFloat(form.target) || 0
  const contracts = parseInt(form.contracts) || 1
  const riskPerContract = Math.abs(entry - stop) * 100
  const totalRisk = riskPerContract * contracts
  const tierMaxRisk = balance * tierDef.riskPct
  const rr = stop > 0 && entry > 0 ? Math.abs(target - entry) / Math.abs(entry - stop) : 0
  const riskWarnings = []
  if (totalRisk > tierMaxRisk) riskWarnings.push(`Risk $${totalRisk.toFixed(0)} exceeds tier max $${tierMaxRisk.toFixed(0)}`)
  if (rr > 0 && rr < 2) riskWarnings.push(`R:R ${rr.toFixed(1)}:1 below minimum 2:1`)
  if (!form.thesis.trim()) riskWarnings.push('Thesis is required — no thesis, no trade')

  const openTrade = () => {
    if (!form.ticker || !form.entryPrice || !form.thesis.trim()) return
    const stratDef = STRATEGIES.find(s => s.key === form.strategy)
    const newTrade = {
      id: Date.now().toString(),
      ...form,
      entryPrice: entry,
      stopLoss: stop,
      target,
      contracts,
      maxRisk: totalRisk,
      rr: Math.round(rr * 100) / 100,
      direction: stratDef?.direction || 'bullish',
      strategyLabel: stratDef?.label || form.strategy,
      status: 'open',
      pnl: 0,
      closePrice: null,
      closeDate: null,
      review: null,
    }
    setTrades(prev => [...prev, newTrade])
    setForm({ ...defaultForm })
  }

  const closeTrade = () => {
    const cp = parseFloat(closePrice)
    if (!closeId || isNaN(cp)) return
    const trade = trades.find(t => t.id === closeId)
    if (!trade) return
    const stratDef = STRATEGIES.find(s => s.key === trade.strategy)
    const isDebit = stratDef?.type === 'debit'
    const pnl = isDebit
      ? (cp - trade.entryPrice) * trade.contracts * 100
      : (trade.entryPrice - cp) * trade.contracts * 100

    setTrades(prev => prev.map(t => t.id === closeId ? {
      ...t, status: 'closed', closePrice: cp, closeDate: new Date().toISOString().split('T')[0], pnl: Math.round(pnl * 100) / 100,
    } : t))
    const newBalance = balance + pnl
    setBalance(newBalance)
    setBalanceHistory(prev => {
      const today = new Date().toISOString().split('T')[0]
      const existing = prev.findIndex(h => h.date === today)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { date: today, balance: newBalance }
        return updated
      }
      return [...prev, { date: today, balance: newBalance }]
    })
    setReviewId(closeId)
    setCloseId(null)
    setClosePrice('')
  }

  const submitReview = () => {
    if (!reviewId) return
    const totalWeight = REVIEW_CRITERIA.reduce((a, c) => a + c.weight, 0)
    const earned = REVIEW_CRITERIA.reduce((a, c) => a + (reviewData[c.key] ? c.weight : 0), 0)
    const execGrade = Math.round((earned / totalWeight) * 100)
    const gradeLabel = execGrade >= 90 ? 'A+' : execGrade >= 80 ? 'A' : execGrade >= 70 ? 'B' : execGrade >= 60 ? 'C' : 'D'

    setTrades(prev => prev.map(t => t.id === reviewId ? {
      ...t, review: { criteria: { ...reviewData }, execGrade, gradeLabel, notes: reviewNotes, timestamp: Date.now() },
    } : t))
    setReviewId(null)
    setReviewData({})
    setReviewNotes('')
  }

  const deleteTrade = (id) => {
    const trade = trades.find(t => t.id === id)
    if (trade && trade.status === 'closed' && trade.pnl) {
      const newBalance = balance - trade.pnl
      setBalance(newBalance)
    }
    setTrades(prev => prev.filter(t => t.id !== id))
  }

  const openPositions = trades.filter(t => t.status === 'open')
  const closedTrades = trades.filter(t => t.status === 'closed')

  return (
    <div style={{ padding: 12 }}>
      {/* New Trade Form */}
      <SectionHeader>New Trade</SectionHeader>
      <Panel>
        <Grid cols={2}>
          <Input label="Ticker" value={form.ticker} onChange={v => updateField('ticker', v.toUpperCase())} placeholder="AAPL" />
          <Select label="Strategy" value={form.strategy} onChange={v => updateField('strategy', v)}
            options={STRATEGIES.filter(s => tierDef.strategies.includes(s.key)).map(s => ({ value: s.key, label: s.label }))} />
          <Select label="Setup Type" value={form.setupType} onChange={v => updateField('setupType', v)}
            options={SETUP_TYPES.map(s => ({ value: s.key, label: s.label }))} />
          <Input label="Contracts" value={form.contracts} onChange={v => updateField('contracts', v)} type="number" />
          <Input label="Entry Price" value={form.entryPrice} onChange={v => updateField('entryPrice', v)} type="number" placeholder="0.00" />
          <Input label="Stop Loss" value={form.stopLoss} onChange={v => updateField('stopLoss', v)} type="number" placeholder="0.00" />
          <Input label="Target" value={form.target} onChange={v => updateField('target', v)} type="number" placeholder="0.00" />
          <Input label="Date" value={form.date} onChange={v => updateField('date', v)} type="date" />
        </Grid>
        <Input label="Expiration" value={form.expiration} onChange={v => updateField('expiration', v)} type="date" />
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Thesis (Required)</label>
          <textarea
            value={form.thesis}
            onChange={e => updateField('thesis', e.target.value)}
            placeholder="Why this trade? What's the edge?"
            rows={3}
            style={{
              width: '100%', padding: '8px 12px', fontFamily: FONTS.body, fontSize: 12,
              color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
              borderRadius: 6, resize: 'vertical',
            }}
          />
        </div>

        {/* Risk Validation */}
        <Panel style={{ background: CC.bg, padding: 10, marginBottom: 10 }}>
          <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted, letterSpacing: 1.5, marginBottom: 6 }}>RISK VALIDATION</div>
          <Grid cols={3}>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>RISK $</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: totalRisk > tierMaxRisk ? CC.loss : CC.textBright }}>${totalRisk.toFixed(0)}</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>Max: ${tierMaxRisk.toFixed(0)}</div>
            </div>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>R:R</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: rr >= 2 ? CC.profit : CC.loss }}>{rr.toFixed(1)}:1</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>Min: 2:1</div>
            </div>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>TIER</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: tierDef.color }}>{tierDef.name}</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>{(tierDef.riskPct * 100).toFixed(1)}% risk</div>
            </div>
          </Grid>
          {riskWarnings.map((w, i) => (
            <div key={i} style={{ marginTop: 6, fontFamily: FONTS.body, fontSize: 11, color: CC.loss, padding: '4px 8px', background: `${CC.loss}08`, borderRadius: 4 }}>
              ⚠ {w}
            </div>
          ))}
        </Panel>

        <Button onClick={openTrade} variant="primary" disabled={!form.ticker || !form.entryPrice || !form.thesis.trim()} style={{ width: '100%', padding: 12 }}>
          OPEN TRADE
        </Button>
      </Panel>

      {/* Close Trade Modal */}
      {closeId && (
        <Panel style={{ borderColor: CC.warning + '40', marginBottom: 12 }}>
          <SectionHeader>Close Trade — {trades.find(t => t.id === closeId)?.ticker}</SectionHeader>
          <Input label="Close Price" value={closePrice} onChange={setClosePrice} type="number" placeholder="0.00" />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={closeTrade} variant="primary" style={{ flex: 1 }}>CLOSE TRADE</Button>
            <Button onClick={() => { setCloseId(null); setClosePrice('') }} variant="ghost" style={{ flex: 1 }}>CANCEL</Button>
          </div>
        </Panel>
      )}

      {/* Review Modal */}
      {reviewId && (
        <Panel style={{ borderColor: CC.accent + '40', marginBottom: 12 }}>
          <SectionHeader>Post-Trade Review — {trades.find(t => t.id === reviewId)?.ticker}</SectionHeader>
          <div style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.textMuted, marginBottom: 10 }}>Rate your execution on each criterion:</div>
          {REVIEW_CRITERIA.map(c => (
            <label key={c.key} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
              borderBottom: `1px solid ${CC.border}22`, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={!!reviewData[c.key]}
                onChange={e => setReviewData(prev => ({ ...prev, [c.key]: e.target.checked }))}
                style={{ accentColor: CC.accent }}
              />
              <span style={{ fontFamily: FONTS.body, fontSize: 12, color: CC.textBright, flex: 1 }}>{c.label}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>{c.weight}x</span>
            </label>
          ))}
          <div style={{ marginTop: 10 }}>
            <label style={{ display: 'block', fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Lessons / Notes</label>
            <textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder="What did you learn?"
              rows={2}
              style={{
                width: '100%', padding: '8px 12px', fontFamily: FONTS.body, fontSize: 12,
                color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
                borderRadius: 6, resize: 'vertical',
              }}
            />
          </div>
          <Button onClick={submitReview} variant="primary" style={{ width: '100%', marginTop: 10, padding: 12 }}>
            SUBMIT REVIEW
          </Button>
        </Panel>
      )}

      {/* Open Positions */}
      {openPositions.length > 0 && (
        <>
          <SectionHeader>Open Positions ({openPositions.length})</SectionHeader>
          {openPositions.map(t => (
            <Panel key={t.id} style={{ marginBottom: 6, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: FONTS.heading, fontSize: 14, fontWeight: 700, color: CC.textBright }}>{t.ticker}</span>
                  <Badge color={t.direction === 'bullish' ? CC.profit : t.direction === 'bearish' ? CC.loss : CC.blue}>{t.direction}</Badge>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button onClick={() => setCloseId(t.id)} variant="default" style={{ padding: '4px 10px', fontSize: 9 }}>CLOSE</Button>
                  <Button onClick={() => deleteTrade(t.id)} variant="danger" style={{ padding: '4px 10px', fontSize: 9 }}>DEL</Button>
                </div>
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
                {t.strategyLabel} • {t.contracts} ct @ ${t.entryPrice} • Stop ${t.stopLoss} • Target ${t.target} • R:R {t.rr}:1
              </div>
              <div style={{ fontFamily: FONTS.body, fontSize: 10, color: CC.textMuted, marginTop: 4, fontStyle: 'italic' }}>{t.thesis}</div>
            </Panel>
          ))}
        </>
      )}

      {/* Closed Trades */}
      {closedTrades.length > 0 && (
        <>
          <SectionHeader>Closed Trades ({closedTrades.length})</SectionHeader>
          {closedTrades.slice().reverse().map(t => (
            <Panel key={t.id} style={{ marginBottom: 6, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: FONTS.heading, fontSize: 13, fontWeight: 700, color: CC.textBright }}>{t.ticker}</span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.pnl >= 0 ? CC.profit : CC.loss }}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(0)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t.review && <Badge color={t.review.execGrade >= 80 ? CC.profit : t.review.execGrade >= 60 ? CC.warning : CC.loss}>{t.review.gradeLabel}</Badge>}
                  {!t.review && (
                    <Button onClick={() => setReviewId(t.id)} variant="ghost" style={{ padding: '3px 8px', fontSize: 8 }}>REVIEW</Button>
                  )}
                </div>
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginTop: 2 }}>
                {t.strategyLabel} • {t.contracts} ct • ${t.entryPrice} → ${t.closePrice} • {t.closeDate}
              </div>
              {t.review?.notes && (
                <div style={{ fontFamily: FONTS.body, fontSize: 10, color: CC.textMuted, marginTop: 4, fontStyle: 'italic' }}>📝 {t.review.notes}</div>
              )}
            </Panel>
          ))}
        </>
      )}
    </div>
  )
}
```

### src/challenge/tabs/WatchlistTab.jsx

```jsx
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
```

## 6g. Challenge Hooks — Full Contents

### src/challenge/hooks/useStorage.js

```js
// ── PERSISTENT STORAGE HOOK (localStorage) ────────────────────────────────
import { useState, useCallback } from 'react'

const PREFIX = 'mkw_5k_'

export function useStorage(key, defaultValue) {
  const storageKey = PREFIX + key

  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw !== null ? JSON.parse(raw) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const set = useCallback((newValue) => {
    setValue(prev => {
      const resolved = typeof newValue === 'function' ? newValue(prev) : newValue
      try {
        localStorage.setItem(storageKey, JSON.stringify(resolved))
      } catch { /* storage full */ }
      return resolved
    })
  }, [storageKey])

  const remove = useCallback(() => {
    localStorage.removeItem(storageKey)
    setValue(defaultValue)
  }, [storageKey, defaultValue])

  return [value, set, remove]
}

// Utility to reset all challenge data
export function resetAllChallengeData() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX))
  keys.forEach(k => localStorage.removeItem(k))
}
```

---

# SECTION 7: CONFIGURATION & CONSTANTS

## 7a. Challenge Engine Constants (src/challenge/engine/constants.js) — Full Contents

```js
// ── $5K CHALLENGE CONSTANTS ───────────────────────────────────────────────

export const CHALLENGE = {
  startDate: '2026-04-10',
  endDate: '2026-05-31',
  startingCapital: 5000,
  targetCapital: 15000,
}

export const TIERS = [
  {
    name: 'SURVIVAL',
    range: [0, 6500],
    riskPct: 0.015,
    maxPositions: 2,
    strategies: ['long_call', 'long_put', 'call_debit_spread', 'put_debit_spread'],
    rules: ['No earnings plays', 'Minimum 2:1 R:R', 'Debit spreads and single legs only', 'No overnight unless forced'],
    color: '#ef4444',
    tag: 'SURVIVE',
  },
  {
    name: 'GROWTH',
    range: [6500, 9000],
    riskPct: 0.02,
    maxPositions: 3,
    strategies: ['long_call', 'long_put', 'call_debit_spread', 'put_debit_spread', 'call_credit_spread', 'put_credit_spread'],
    rules: ['Wider spreads OK', 'Swing trades allowed', '1 overnight position OK', 'Minimum 2.5:1 R:R'],
    color: '#f59e0b',
    tag: 'GROW',
  },
  {
    name: 'ACCELERATE',
    range: [9000, 12000],
    riskPct: 0.02,
    maxPositions: 4,
    strategies: ['long_call', 'long_put', 'call_debit_spread', 'put_debit_spread', 'call_credit_spread', 'put_credit_spread', 'iron_condor', 'straddle', 'strangle', 'butterfly', 'calendar'],
    rules: ['Full toolkit unlocked', '5% asymmetric bets OK on A+ setups', 'Lock profits at 3:1+', 'Scale into winners'],
    color: '#00d4aa',
    tag: 'ACCELERATE',
  },
  {
    name: 'PROTECT',
    range: [12000, Infinity],
    riskPct: 0.015,
    maxPositions: 3,
    strategies: ['long_call', 'long_put', 'call_debit_spread', 'put_debit_spread', 'call_credit_spread', 'put_credit_spread', 'iron_condor', 'butterfly'],
    rules: ['High-conviction only', 'Trailing stops required', 'Protect gains — no hero trades', 'Reduce size if on tilt'],
    color: '#a855f7',
    tag: 'PROTECT',
  },
]

export const STRATEGIES = [
  { key: 'long_call', label: 'Long Call', direction: 'bullish', type: 'debit' },
  { key: 'long_put', label: 'Long Put', direction: 'bearish', type: 'debit' },
  { key: 'call_debit_spread', label: 'Call Debit Spread', direction: 'bullish', type: 'debit' },
  { key: 'put_debit_spread', label: 'Put Debit Spread', direction: 'bearish', type: 'debit' },
  { key: 'call_credit_spread', label: 'Call Credit Spread', direction: 'bearish', type: 'credit' },
  { key: 'put_credit_spread', label: 'Put Credit Spread', direction: 'bullish', type: 'credit' },
  { key: 'iron_condor', label: 'Iron Condor', direction: 'neutral', type: 'credit' },
  { key: 'straddle', label: 'Straddle', direction: 'neutral', type: 'debit' },
  { key: 'strangle', label: 'Strangle', direction: 'neutral', type: 'debit' },
  { key: 'butterfly', label: 'Butterfly', direction: 'neutral', type: 'debit' },
  { key: 'calendar', label: 'Calendar Spread', direction: 'neutral', type: 'debit' },
]

export const SETUP_TYPES = [
  { key: 'momentum_breakout', label: 'Momentum Breakout', icon: '▲' },
  { key: 'failed_breakdown', label: 'Failed Breakdown', icon: '◇' },
  { key: 'vol_crush', label: 'Volatility Crush', icon: '◈' },
  { key: 'episodic_pivot', label: 'Episodic Pivot', icon: '★' },
  { key: 'mean_reversion', label: 'Mean Reversion', icon: '↩' },
  { key: 'sr_rejection', label: 'S/R Rejection', icon: '⊘' },
  { key: 'other', label: 'Other', icon: '◎' },
]

export const REVIEW_CRITERIA = [
  { key: 'thesisCorrect', label: 'Thesis Correct', weight: 2 },
  { key: 'entryTiming', label: 'Entry Timing', weight: 2 },
  { key: 'positionSized', label: 'Position Sized', weight: 2 },
  { key: 'stopHonored', label: 'Stop Honored', weight: 3 },
  { key: 'exitTiming', label: 'Exit Timing', weight: 2 },
  { key: 'emotionFree', label: 'Emotion Free', weight: 3 },
  { key: 'rulesFollowed', label: 'Rules Followed', weight: 3 },
  { key: 'riskManaged', label: 'Risk Managed', weight: 2 },
  { key: 'journaled', label: 'Journaled', weight: 1 },
]

export const TIMEFRAME_MODES = {
  scalp: {
    key: 'scalp',
    label: 'Scalp',
    tag: '0-2 DTE',
    color: '#ff6b6b',
    dteRange: [0, 2],
    deltaRange: [0.55, 0.70],
    description: 'Intraday to next-day expiration. Speed and precision. Momentum-driven.',
    weights: { trend: 0.5, momentum: 1.8, volume: 1.6, iv: 0.3 },
    strategies: ['long_call', 'long_put', 'call_debit_spread', 'put_debit_spread'],
    rules: ['Tight stops — 30-50% max loss', 'Take profits at 50-100%', 'No holding through close unless planned', 'Volume confirmation required'],
    keyMetrics: ['Momentum Score', 'Volume Ratio', 'RSI', 'Intraday Trend'],
    idealSetups: ['momentum_breakout', 'sr_rejection'],
    warning: null,
  },
  swing: {
    key: 'swing',
    label: 'Swing',
    tag: '3-14 DTE',
    color: '#00d4aa',
    dteRange: [3, 14],
    deltaRange: [0.45, 0.60],
    description: 'Multi-day holds. Balanced scoring across all factors. DEFAULT MODE.',
    weights: { trend: 1.0, momentum: 1.0, volume: 1.0, iv: 1.0 },
    strategies: ['long_call', 'long_put', 'call_debit_spread', 'put_debit_spread', 'call_credit_spread', 'put_credit_spread'],
    rules: ['Hold 2-10 days typically', 'Trail stops after 2:1', 'Respect the daily close', 'Scale out at targets'],
    keyMetrics: ['Composite Score', 'Trend Score', 'RS 3M', 'HV Rank'],
    idealSetups: ['momentum_breakout', 'failed_breakdown', 'mean_reversion', 'sr_rejection'],
    warning: null,
  },
  position: {
    key: 'position',
    label: 'Position',
    tag: '14-45 DTE',
    color: '#00ccff',
    dteRange: [14, 45],
    deltaRange: [0.40, 0.55],
    description: 'Multi-week holds. Trend and IV environment dominate. Patient entries.',
    weights: { trend: 1.5, momentum: 0.7, volume: 0.5, iv: 1.3 },
    strategies: ['long_call', 'long_put', 'call_debit_spread', 'put_debit_spread', 'call_credit_spread', 'put_credit_spread', 'iron_condor', 'butterfly', 'calendar'],
    rules: ['Trend must be established', 'IV rank matters more', 'Wider stops OK', 'Roll if needed'],
    keyMetrics: ['Trend Score', 'HV Rank', 'ADX', 'Stage'],
    idealSetups: ['momentum_breakout', 'vol_crush', 'episodic_pivot'],
    warning: null,
  },
  leaps: {
    key: 'leaps',
    label: 'LEAPS',
    tag: '90+ DTE',
    color: '#a855f7',
    dteRange: [90, 730],
    deltaRange: [0.60, 0.80],
    description: 'Long-term directional. Trend is everything. Buy on IV dips.',
    weights: { trend: 2.0, momentum: 0.3, volume: 0.2, iv: 1.5 },
    strategies: ['long_call', 'long_put', 'call_debit_spread', 'put_debit_spread'],
    rules: ['Only Stage 2 confirmed uptrends', 'Buy when IV rank < 30', 'Deep ITM delta 0.60-0.80', 'Size smaller — time is your edge'],
    keyMetrics: ['Trend Score', 'Stage', 'IV Rank', 'RS 3M'],
    idealSetups: ['momentum_breakout', 'episodic_pivot'],
    warning: 'LEAPS require strong conviction and are capital-intensive. Size accordingly.',
  },
}

export const DEBRIEF_CHECKLIST = {
  premarkt: [
    'Reviewed overnight futures and macro',
    'Checked watchlist for gaps/news',
    'Set alerts at key levels',
    'Reviewed open positions and stops',
  ],
  execution: [
    'Followed pre-trade checklist before entry',
    'Position sized per tier rules',
    'Entered at planned level (no chasing)',
    'Set stop immediately after fill',
  ],
  postmarket: [
    'Logged all trades with thesis',
    'Completed trade reviews',
    'Updated equity curve',
    'Journaled lessons learned',
  ],
}

export const MOOD_STATES = [
  { key: 'locked', label: 'Locked In', emoji: '🎯', color: '#00d4aa' },
  { key: 'confident', label: 'Confident', emoji: '💪', color: '#22c55e' },
  { key: 'neutral', label: 'Neutral', emoji: '😐', color: '#f59e0b' },
  { key: 'shaky', label: 'Shaky', emoji: '😟', color: '#ef4444' },
  { key: 'tilted', label: 'Tilted', emoji: '🔥', color: '#ff2a44' },
]

export const PLAYBOOK_SETUPS = [
  {
    name: 'Momentum Breakout',
    type: 'long',
    winRate: '55-65%',
    rrTarget: '3:1',
    entry: 'Break above resistance with 1.3x+ volume, RSI 55-70, Stage 2 confirmed',
    timeframe: 'Swing (3-14 DTE) or Position (14-45 DTE)',
    sizing: 'Full size if A+ grade, half size if A',
    ivRule: 'Enter when HV Rank < 50 for debit plays',
    edge: 'Momentum + trend alignment + volume confirmation = highest probability setup',
  },
  {
    name: 'Failed Breakdown Recovery',
    type: 'long',
    winRate: '50-60%',
    rrTarget: '2.5:1',
    entry: 'Price reclaims support after failed breakdown, volume returns, RS improving',
    timeframe: 'Swing (5-14 DTE)',
    sizing: 'Half size initial, add on confirmation',
    ivRule: 'IV often elevated after breakdown — consider spreads',
    edge: 'Trapped shorts provide fuel. Counter-trend but with momentum shift.',
  },
  {
    name: 'IV Crush Play',
    type: 'neutral',
    winRate: '60-70%',
    rrTarget: '1.5:1',
    entry: 'HV Rank > 70, ADX < 20, sell iron condor at 1 SD wings',
    timeframe: 'Position (14-30 DTE)',
    sizing: 'Standard size, defined risk',
    ivRule: 'Only when IV Rank > 70 AND ADX < 20',
    edge: 'Mean reversion of volatility. Time decay + vol crush = double tailwind.',
  },
  {
    name: 'Episodic Pivot',
    type: 'long',
    winRate: '45-55%',
    rrTarget: '4:1',
    entry: 'Gap up on earnings/news with 3x+ volume, immediate follow-through',
    timeframe: 'Swing (5-14 DTE) or LEAPS for conviction',
    sizing: 'Smaller size — asymmetric R:R compensates',
    ivRule: 'IV will be high post-event — use spreads or wait for crush',
    edge: 'Institutional re-rating. The setup IS the catalyst. Ride the momentum.',
  },
  {
    name: 'Mean Reversion',
    type: 'long',
    winRate: '55-65%',
    rrTarget: '2:1',
    entry: 'RSI < 28 at key support level, oversold bounce setup',
    timeframe: 'Scalp (0-2 DTE) or Swing (3-7 DTE)',
    sizing: 'Half size — counter-trend is inherently riskier',
    ivRule: 'IV often elevated at extremes — consider selling premium',
    edge: 'Rubber band effect at support. Quick snap-back when selling exhausts.',
  },
  {
    name: 'S/R Rejection Short',
    type: 'short',
    winRate: '50-60%',
    rrTarget: '2.5:1',
    entry: 'Price rejected at resistance with declining RS, Stage 3-4, volume on rejection',
    timeframe: 'Swing (5-14 DTE)',
    sizing: 'Standard size with defined-risk puts or put spreads',
    ivRule: 'Puts are cheaper when IV is low — better entry',
    edge: 'Distribution phase. Smart money selling into retail buying. Gravity wins.',
  },
]

// Design tokens for the challenge module
export const CC = {
  bg: '#070b12',
  surface: '#0c1219',
  surfaceAlt: '#111a25',
  border: '#1a2535',
  borderHi: '#243247',
  text: '#c8d6e5',
  textBright: '#e8f0f8',
  textMuted: '#5a6a7e',
  accent: '#00d4aa',
  profit: '#22c55e',
  loss: '#ef4444',
  warning: '#f59e0b',
  blue: '#00ccff',
  purple: '#a855f7',
  gold: '#ffcc00',
}

export const FONTS = {
  heading: "'Chakra Petch', sans-serif",
  mono: "'JetBrains Mono', monospace",
  body: "'DM Sans', sans-serif",
}
```

## 7b. Challenge Engine Trade Builder (src/challenge/engine/tradeBuilder.js) — Full Contents

```js
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
```

## 7c. Color System / Theme

The color system is defined inline in src/App.jsx (lines 8-14) as the `C` design tokens object:
```js
const C = {
  bg: '#020408', panel: '#080d16', raised: '#0e1520',
  border: '#1a2535', borderHi: '#243247',
  green: '#00ff88', red: '#ff2a44', gold: '#ffcc00',
  blue: '#00ccff', purple: '#a855f7',
  textBright: '#e8edf5', text: 'rgba(180,200,230,0.7)', textDim: 'rgba(180,200,230,0.35)',
}
```

## 7d. Font Configuration

```js
const FO = "'Orbitron', monospace"      // Headers, grades, badges
const FR = "'Rajdhani', sans-serif"      // Body text, descriptions
const FM = "'Share Tech Mono', monospace" // Data values, monospace numbers
```

Google Fonts import: `https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;800;900&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap`

---

# SECTION 8: CATCH-ALL

## 8a. Remaining Challenge Tab Files

All challenge tab files have been fully included in Section 6.

## 8b. Challenge Debrief Tab (src/challenge/tabs/DebriefTab.jsx) — Full Contents

```jsx
// ── DEBRIEF TAB — Daily Debrief, Calendar, Checklist, Mood ────────────────
import { useState, useMemo } from 'react'
import { CHALLENGE, DEBRIEF_CHECKLIST, MOOD_STATES, CC, FONTS } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import { Panel, SectionHeader, Badge, Button, Grid } from '../components/shared.jsx'

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function getWeekDates(dateStr) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  const dates = []
  for (let i = 0; i < 5; i++) {
    const wd = new Date(monday)
    wd.setDate(monday.getDate() + i)
    dates.push(wd.toISOString().split('T')[0])
  }
  return dates
}

export default function DebriefTab({ trades, debriefs, setDebriefs, balanceHistory }) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const debrief = debriefs[selectedDate] || { checklist: {}, mood: null, notes: '', saved: false }

  const setDebrief = (updates) => {
    setDebriefs(prev => ({
      ...prev,
      [selectedDate]: { ...debrief, ...updates, saved: true },
    }))
  }

  // Day's trades
  const dayTrades = trades.filter(t => t.closeDate === selectedDate || t.date === selectedDate)
  const closedToday = dayTrades.filter(t => t.status === 'closed' && t.closeDate === selectedDate)
  const dayPL = closedToday.reduce((a, t) => a + (t.pnl || 0), 0)
  const dayWins = closedToday.filter(t => (t.pnl || 0) > 0)
  const dayWR = closedToday.length > 0 ? (dayWins.length / closedToday.length * 100) : 0
  const dayReviews = closedToday.filter(t => t.review)
  const avgExecGrade = dayReviews.length > 0 ? Math.round(dayReviews.reduce((a, t) => a + t.review.execGrade, 0) / dayReviews.length) : 0
  const dayGrade = dayPL > 0 ? (dayWR >= 60 ? 'A' : 'B') : dayPL === 0 ? 'C' : (dayWR >= 40 ? 'C' : 'D')
  const processGrade = avgExecGrade >= 80 ? 'A' : avgExecGrade >= 60 ? 'B' : avgExecGrade >= 40 ? 'C' : avgExecGrade > 0 ? 'D' : '—'

  // Streak
  const streak = useMemo(() => {
    const allDates = [...new Set(trades.filter(t => t.status === 'closed').map(t => t.closeDate))].sort().reverse()
    let s = 0
    for (const d of allDates) {
      const dTrades = trades.filter(t => t.closeDate === d && t.status === 'closed')
      const dPL = dTrades.reduce((a, t) => a + (t.pnl || 0), 0)
      if (dPL > 0) s++
      else break
    }
    return s
  }, [trades])

  // Pace
  const daysPassed = Math.max(1, (() => {
    let count = 0
    const d = new Date(CHALLENGE.startDate)
    const end = new Date(selectedDate)
    while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) count++; d.setDate(d.getDate() + 1) }
    return count
  })())
  const totalDays = (() => {
    let count = 0
    const d = new Date(CHALLENGE.startDate)
    const end = new Date(CHALLENGE.endDate)
    while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) count++; d.setDate(d.getDate() + 1) }
    return count
  })()
  const dailyRate = Math.pow(CHALLENGE.targetCapital / CHALLENGE.startingCapital, 1 / totalDays)
  const targetToday = CHALLENGE.startingCapital * Math.pow(dailyRate, daysPassed)
  const currentBalance = balanceHistory.find(h => h.date === selectedDate)?.balance || balanceHistory[balanceHistory.length - 1]?.balance || CHALLENGE.startingCapital

  // Week context
  const weekDates = getWeekDates(selectedDate)
  const weekTrades = trades.filter(t => t.status === 'closed' && weekDates.includes(t.closeDate))
  const weekPL = weekTrades.reduce((a, t) => a + (t.pnl || 0), 0)
  const weekWins = weekTrades.filter(t => (t.pnl || 0) > 0)
  const weekWR = weekTrades.length > 0 ? (weekWins.length / weekTrades.length * 100) : 0

  // Checklist
  const allCheckItems = [...DEBRIEF_CHECKLIST.premarkt, ...DEBRIEF_CHECKLIST.execution, ...DEBRIEF_CHECKLIST.postmarket]
  const checkedCount = allCheckItems.filter(item => debrief.checklist[item]).length

  // Calendar heatmap (last 20 trading days)
  const calendarDays = useMemo(() => {
    const days = []
    const d = new Date(selectedDate)
    let count = 0
    while (count < 20) {
      d.setDate(d.getDate() - 1)
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        const dateStr = d.toISOString().split('T')[0]
        const dayT = trades.filter(t => t.status === 'closed' && t.closeDate === dateStr)
        const pl = dayT.reduce((a, t) => a + (t.pnl || 0), 0)
        const hasDebrief = !!debriefs[dateStr]?.saved
        days.unshift({ date: dateStr, pnl: pl, trades: dayT.length, hasDebrief })
        count++
      }
    }
    return days
  }, [selectedDate, trades, debriefs])

  // Debrief history
  const debriefDates = Object.keys(debriefs).filter(d => debriefs[d].saved).sort().reverse().slice(0, 10)

  return (
    <div style={{ padding: 12 }}>
      {/* Date Navigator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Button onClick={() => setSelectedDate(addDays(selectedDate, -1))} variant="ghost" style={{ padding: '6px 12px' }}>◀</Button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: FONTS.heading, fontSize: 16, fontWeight: 700, color: CC.textBright }}>{formatDate(selectedDate)}</div>
          {selectedDate !== today && (
            <button onClick={() => setSelectedDate(today)} style={{
              fontFamily: FONTS.mono, fontSize: 9, color: CC.accent, background: 'none', border: 'none', cursor: 'pointer', marginTop: 2,
            }}>TODAY</button>
          )}
        </div>
        <Button onClick={() => setSelectedDate(addDays(selectedDate, 1))} variant="ghost" style={{ padding: '6px 12px' }}>▶</Button>
      </div>

      {/* Day Summary */}
      <Grid cols={2}>
        <MetricCard small label="P&L" value={`${dayPL >= 0 ? '+' : ''}$${dayPL.toFixed(0)}`} color={dayPL >= 0 ? CC.profit : CC.loss} />
        <MetricCard small label="Win Rate" value={`${dayWR.toFixed(0)}%`} color={dayWR >= 50 ? CC.profit : CC.loss} />
        <MetricCard small label="Day Grade" value={dayGrade} color={dayGrade <= 'B' ? CC.profit : CC.warning} />
        <MetricCard small label="Process" value={processGrade} color={processGrade <= 'B' ? CC.accent : CC.warning} />
      </Grid>

      <Grid cols={2} style={{ marginTop: 8 }}>
        <MetricCard small label="Win Streak" value={streak} color={streak > 0 ? CC.profit : CC.textMuted} />
        <MetricCard small label="Trades Today" value={closedToday.length} color={CC.textBright} />
      </Grid>

      {/* Pace Banner */}
      <Panel style={{ marginTop: 10, padding: '8px 12px', textAlign: 'center' }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: currentBalance >= targetToday ? CC.profit : CC.loss }}>
          Balance: ${currentBalance.toLocaleString()} {currentBalance >= targetToday ? '▲ AHEAD' : '▼ BEHIND'} target ${Math.round(targetToday).toLocaleString()}
        </span>
      </Panel>

      {/* Day's Trades */}
      {closedToday.length > 0 && (
        <>
          <SectionHeader style={{ marginTop: 10 }}>Day's Trades</SectionHeader>
          {closedToday.map(t => (
            <Panel key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', marginBottom: 4 }}>
              <div>
                <span style={{ fontFamily: FONTS.heading, fontSize: 13, fontWeight: 700, color: CC.textBright }}>{t.ticker}</span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginLeft: 8 }}>{t.strategyLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: t.pnl >= 0 ? CC.profit : CC.loss }}>
                  {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(0)}
                </span>
                {t.review && <Badge color={t.review.execGrade >= 70 ? CC.profit : CC.warning}>{t.review.gradeLabel}</Badge>}
              </div>
            </Panel>
          ))}
        </>
      )}

      {/* Week Context */}
      <SectionHeader style={{ marginTop: 10 }}>Week Context</SectionHeader>
      <Grid cols={3}>
        <MetricCard small label="Week P&L" value={`${weekPL >= 0 ? '+' : ''}$${weekPL.toFixed(0)}`} color={weekPL >= 0 ? CC.profit : CC.loss} />
        <MetricCard small label="Week WR" value={`${weekWR.toFixed(0)}%`} color={weekWR >= 50 ? CC.profit : CC.loss} />
        <MetricCard small label="Week Trades" value={weekTrades.length} color={CC.textBright} />
      </Grid>

      {/* Daily Checklist */}
      <SectionHeader style={{ marginTop: 10 }}>Daily Checklist ({checkedCount}/{allCheckItems.length})</SectionHeader>
      {Object.entries(DEBRIEF_CHECKLIST).map(([phase, items]) => (
        <Panel key={phase} style={{ marginBottom: 6 }}>
          <div style={{ fontFamily: FONTS.heading, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: CC.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>
            {phase === 'premarkt' ? 'Pre-Market' : phase === 'execution' ? 'Execution' : 'Post-Market'}
          </div>
          {items.map(item => (
            <label key={item} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
              borderBottom: `1px solid ${CC.border}11`, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={!!debrief.checklist[item]}
                onChange={e => setDebrief({ checklist: { ...debrief.checklist, [item]: e.target.checked } })}
                style={{ accentColor: CC.accent }}
              />
              <span style={{ fontFamily: FONTS.body, fontSize: 12, color: debrief.checklist[item] ? CC.textBright : CC.textMuted }}>{item}</span>
            </label>
          ))}
        </Panel>
      ))}

      {/* Mood Tracker */}
      <SectionHeader>Mood</SectionHeader>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {MOOD_STATES.map(m => (
          <button key={m.key} onClick={() => setDebrief({ mood: m.key })} style={{
            flex: 1, padding: '10px 4px', borderRadius: 6, cursor: 'pointer', textAlign: 'center',
            background: debrief.mood === m.key ? `${m.color}20` : CC.surface,
            border: `1px solid ${debrief.mood === m.key ? m.color : CC.border}`,
          }}>
            <div style={{ fontSize: 18 }}>{m.emoji}</div>
            <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: debrief.mood === m.key ? m.color : CC.textMuted, marginTop: 2 }}>{m.label}</div>
          </button>
        ))}
      </div>

      {/* Journal Notes */}
      <SectionHeader>Journal</SectionHeader>
      <textarea
        value={debrief.notes || ''}
        onChange={e => setDebrief({ notes: e.target.value })}
        placeholder="What did you learn today? What would you do differently?"
        rows={4}
        style={{
          width: '100%', padding: '10px 12px', fontFamily: FONTS.body, fontSize: 12,
          color: CC.textBright, background: CC.surface, border: `1px solid ${CC.border}`,
          borderRadius: 6, resize: 'vertical', marginBottom: 12,
        }}
      />

      {/* Performance Calendar */}
      <SectionHeader>Last 20 Trading Days</SectionHeader>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 12 }}>
        {calendarDays.map(d => {
          const color = d.trades === 0 ? CC.textMuted : d.pnl > 0 ? CC.profit : d.pnl < 0 ? CC.loss : CC.warning
          const bg = d.trades === 0 ? CC.surface : d.pnl > 0 ? `${CC.profit}15` : d.pnl < 0 ? `${CC.loss}15` : `${CC.warning}10`
          return (
            <button
              key={d.date}
              onClick={() => setSelectedDate(d.date)}
              style={{
                padding: '6px 2px', borderRadius: 6, cursor: 'pointer', textAlign: 'center',
                background: d.date === selectedDate ? `${CC.accent}25` : bg,
                border: `1px solid ${d.date === selectedDate ? CC.accent : d.hasDebrief ? `${CC.accent}40` : CC.border}`,
              }}
            >
              <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>{d.date.slice(5)}</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color }}>
                {d.trades === 0 ? '—' : `${d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(0)}`}
              </div>
              {d.hasDebrief && <div style={{ width: 4, height: 4, borderRadius: 2, background: CC.accent, margin: '2px auto 0' }} />}
            </button>
          )
        })}
      </div>

      {/* Debrief History */}
      {debriefDates.length > 0 && (
        <>
          <SectionHeader>Recent Debriefs</SectionHeader>
          {debriefDates.map(d => {
            const db = debriefs[d]
            const mood = MOOD_STATES.find(m => m.key === db.mood)
            return (
              <Panel key={d} onClick={() => setSelectedDate(d)} style={{ cursor: 'pointer', padding: '8px 12px', marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.textBright }}>{formatDate(d)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {mood && <span style={{ fontSize: 14 }}>{mood.emoji}</span>}
                    {db.notes && <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>📝</span>}
                  </div>
                </div>
              </Panel>
            )
          })}
        </>
      )}
    </div>
  )
}
```

## 8c. Challenge Command Tab (src/challenge/tabs/CommandTab.jsx) — Full Contents

```jsx
// ── COMMAND TAB — Dashboard Overview ──────────────────────────────────────
import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { CHALLENGE, TIERS, CC, FONTS, SETUP_TYPES } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { Panel, Grid, SectionHeader, Badge } from '../components/shared.jsx'

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

function tradingDaysBetween(start, end) {
  let count = 0
  const d = new Date(start)
  const e = new Date(end)
  while (d <= e) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export default function CommandTab({ balance, trades, balanceHistory, openPositions }) {
  const tier = getTier(balance)
  const tierDef = TIERS[tier]

  const today = new Date().toISOString().split('T')[0]
  const totalDays = tradingDaysBetween(CHALLENGE.startDate, CHALLENGE.endDate)
  const daysPassed = Math.max(0, tradingDaysBetween(CHALLENGE.startDate, today))
  const daysLeft = Math.max(0, totalDays - daysPassed)

  // Compound target curve
  const dailyRate = Math.pow(CHALLENGE.targetCapital / CHALLENGE.startingCapital, 1 / totalDays)
  const targetToday = CHALLENGE.startingCapital * Math.pow(dailyRate, daysPassed)
  const pace = balance >= targetToday ? 'AHEAD' : balance >= targetToday * 0.9 ? 'ON PACE' : 'BEHIND'
  const paceColor = pace === 'AHEAD' ? CC.profit : pace === 'ON PACE' ? CC.warning : CC.loss

  // Today's P&L
  const todayTrades = trades.filter(t => t.closeDate === today && t.status === 'closed')
  const todayPL = todayTrades.reduce((a, t) => a + (t.pnl || 0), 0)
  const requiredDaily = daysLeft > 0 ? (CHALLENGE.targetCapital - balance) / daysLeft : 0

  // Performance stats
  const closedTrades = trades.filter(t => t.status === 'closed')
  const wins = closedTrades.filter(t => (t.pnl || 0) > 0)
  const losses = closedTrades.filter(t => (t.pnl || 0) <= 0)
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length * 100) : 0
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / losses.length) : 0
  const profitFactor = avgLoss > 0 && losses.length > 0
    ? (wins.reduce((a, t) => a + t.pnl, 0)) / Math.abs(losses.reduce((a, t) => a + t.pnl, 0)) : 0
  const expectancy = closedTrades.length > 0
    ? (winRate / 100 * avgWin) - ((100 - winRate) / 100 * avgLoss) : 0

  // Portfolio heat
  const openHeat = openPositions.reduce((a, t) => a + (t.maxRisk || 0), 0)
  const maxHeat = balance * tierDef.riskPct * tierDef.maxPositions

  // Equity curve data
  const chartData = useMemo(() => {
    const data = []
    let day = 0
    const d = new Date(CHALLENGE.startDate)
    const endD = new Date(CHALLENGE.endDate)
    while (d <= endD) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) {
        const dateStr = d.toISOString().split('T')[0]
        const targetVal = CHALLENGE.startingCapital * Math.pow(dailyRate, day)
        const histEntry = balanceHistory.find(h => h.date === dateStr)
        data.push({
          date: dateStr,
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          target: Math.round(targetVal),
          actual: histEntry ? histEntry.balance : null,
        })
        day++
      }
      d.setDate(d.getDate() + 1)
    }
    return data
  }, [balanceHistory, dailyRate])

  // Setup performance
  const setupPerf = useMemo(() => {
    const map = {}
    closedTrades.forEach(t => {
      const key = t.setupType || 'other'
      if (!map[key]) map[key] = { wins: 0, losses: 0, pnl: 0, count: 0 }
      map[key].count++
      map[key].pnl += t.pnl || 0
      if ((t.pnl || 0) > 0) map[key].wins++
      else map[key].losses++
    })
    return Object.entries(map).map(([key, v]) => ({
      key,
      label: SETUP_TYPES.find(s => s.key === key)?.label || key,
      ...v,
      winRate: v.count > 0 ? (v.wins / v.count * 100) : 0,
    })).sort((a, b) => b.pnl - a.pnl)
  }, [closedTrades])

  return (
    <div style={{ padding: 12 }}>
      {/* Pace Banner */}
      <div style={{
        textAlign: 'center', padding: '8px 14px', marginBottom: 12,
        background: `${paceColor}10`, border: `1px solid ${paceColor}30`,
        borderRadius: 8, fontFamily: FONTS.heading,
      }}>
        <span style={{ fontSize: 10, color: CC.textMuted, letterSpacing: 2 }}>PACE STATUS </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: paceColor, letterSpacing: 3 }}>{pace}</span>
        <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginTop: 2 }}>
          Day {daysPassed}/{totalDays} • Target today: ${Math.round(targetToday).toLocaleString()} • {daysLeft} days left
        </div>
      </div>

      {/* Key Metrics */}
      <Grid cols={2}>
        <MetricCard label="Balance" value={`$${balance.toLocaleString()}`} color={CC.accent} icon="◈" sub={`${((balance - CHALLENGE.startingCapital) / CHALLENGE.startingCapital * 100).toFixed(1)}% return`} />
        <MetricCard label="Target" value={`$${CHALLENGE.targetCapital.toLocaleString()}`} color={CC.gold} icon="★" sub={`$${(CHALLENGE.targetCapital - balance).toLocaleString()} to go`} />
        <MetricCard label="Today P&L" value={`${todayPL >= 0 ? '+' : ''}$${todayPL.toFixed(0)}`} color={todayPL >= 0 ? CC.profit : CC.loss} icon="△" sub={`${todayTrades.length} trades`} />
        <MetricCard label="Required Daily" value={`$${Math.round(requiredDaily).toLocaleString()}`} color={CC.blue} icon="→" sub={`${(requiredDaily / balance * 100).toFixed(1)}% per day`} />
      </Grid>

      {/* Challenge Progress */}
      <Panel style={{ marginTop: 10 }}>
        <ProgressBar
          value={balance - CHALLENGE.startingCapital}
          max={CHALLENGE.targetCapital - CHALLENGE.startingCapital}
          label="Challenge Progress"
          color={tierDef.color}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
          <span>$5,000</span>
          {TIERS.map(t => (
            <span key={t.name} style={{ color: t.color }}>{t.name}</span>
          ))}
          <span>$15,000</span>
        </div>
      </Panel>

      {/* Equity Curve */}
      <SectionHeader>Equity Curve</SectionHeader>
      <Panel style={{ height: 200, padding: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CC.accent} stopOpacity={0.3} />
                <stop offset="100%" stopColor={CC.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: CC.textMuted, fontFamily: FONTS.mono }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: CC.textMuted, fontFamily: FONTS.mono }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11 }}
              labelStyle={{ color: CC.textMuted }}
              formatter={(v, name) => [`$${v?.toLocaleString() || '—'}`, name === 'target' ? 'Target' : 'Actual']}
            />
            <Area type="monotone" dataKey="target" stroke={CC.textMuted} strokeDasharray="4 3" fill="none" strokeWidth={1} />
            <Area type="monotone" dataKey="actual" stroke={CC.accent} fill="url(#actualGrad)" strokeWidth={2} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      {/* Performance Stats */}
      <SectionHeader>Performance</SectionHeader>
      <Grid cols={3}>
        <MetricCard small label="Win Rate" value={`${winRate.toFixed(0)}%`} color={winRate >= 50 ? CC.profit : CC.loss} />
        <MetricCard small label="Profit Factor" value={profitFactor.toFixed(2)} color={profitFactor >= 1.5 ? CC.profit : profitFactor >= 1 ? CC.warning : CC.loss} />
        <MetricCard small label="Expectancy" value={`$${expectancy.toFixed(0)}`} color={expectancy > 0 ? CC.profit : CC.loss} />
        <MetricCard small label="Avg Win" value={`+$${avgWin.toFixed(0)}`} color={CC.profit} />
        <MetricCard small label="Avg Loss" value={`-$${avgLoss.toFixed(0)}`} color={CC.loss} />
        <MetricCard small label="Total Trades" value={closedTrades.length} color={CC.textBright} />
      </Grid>

      {/* Risk Monitor */}
      <SectionHeader>Risk Monitor</SectionHeader>
      <Grid cols={2}>
        <MetricCard small label="Current Tier" value={tierDef.name} color={tierDef.color} sub={tierDef.tag} />
        <MetricCard small label="Risk Per Trade" value={`$${Math.round(balance * tierDef.riskPct)}`} color={CC.accent} sub={`${(tierDef.riskPct * 100).toFixed(1)}%`} />
        <MetricCard small label="Max Positions" value={tierDef.maxPositions} color={CC.blue} sub={`${openPositions.length} open`} />
        <MetricCard small label="Open Heat" value={`$${openHeat.toFixed(0)}`} color={openHeat > maxHeat * 0.8 ? CC.loss : CC.accent} sub={`of $${Math.round(maxHeat)} max`} />
      </Grid>
      <ProgressBar value={openHeat} max={maxHeat} label="Portfolio Heat" color={openHeat > maxHeat * 0.8 ? CC.loss : CC.accent} />

      {/* Setup Performance */}
      {setupPerf.length > 0 && (
        <>
          <SectionHeader>Setup Performance</SectionHeader>
          {setupPerf.map(s => (
            <Panel key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', marginBottom: 6 }}>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 12, fontWeight: 600, color: CC.textBright }}>{s.label}</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>{s.count} trades • {s.winRate.toFixed(0)}% WR</div>
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700, color: s.pnl >= 0 ? CC.profit : CC.loss }}>
                {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(0)}
              </div>
            </Panel>
          ))}
        </>
      )}

      {/* Open Positions */}
      {openPositions.length > 0 && (
        <>
          <SectionHeader>Open Positions</SectionHeader>
          {openPositions.map(t => (
            <Panel key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', marginBottom: 6 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: FONTS.heading, fontSize: 13, fontWeight: 700, color: CC.textBright }}>{t.ticker}</span>
                  <Badge color={t.direction === 'bullish' ? CC.profit : t.direction === 'bearish' ? CC.loss : CC.blue}>{t.direction}</Badge>
                </div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>{t.strategyLabel || t.strategy} • {t.contracts} ct</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: CC.textMuted }}>Entry: ${t.entryPrice}</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.loss }}>Risk: ${(t.maxRisk || 0).toFixed(0)}</div>
              </div>
            </Panel>
          ))}
        </>
      )}
    </div>
  )
}
```

## 8d. Challenge Ideas Tab (src/challenge/tabs/IdeasTab.jsx) — Full Contents

```jsx
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
```

## 8e. Challenge Playbook Tab (src/challenge/tabs/PlaybookTab.jsx) — Full Contents

```jsx
// ── PLAYBOOK TAB — Tiers, Setups, Process ─────────────────────────────────
import { TIERS, PLAYBOOK_SETUPS, DEBRIEF_CHECKLIST, CC, FONTS } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import { Panel, SectionHeader, Badge, Grid } from '../components/shared.jsx'

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

export default function PlaybookTab({ balance }) {
  const currentTier = getTier(balance)

  return (
    <div style={{ padding: 12 }}>
      {/* Tier Cards */}
      <SectionHeader>Challenge Tiers</SectionHeader>
      {TIERS.map((tier, idx) => {
        const isCurrent = idx === currentTier
        return (
          <Panel key={tier.name} style={{
            marginBottom: 8, padding: '12px 14px',
            borderColor: isCurrent ? tier.color : CC.border,
            background: isCurrent ? `${tier.color}08` : CC.surface,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: FONTS.heading, fontSize: 16, fontWeight: 700, color: tier.color }}>{tier.name}</span>
                {isCurrent && <Badge color={tier.color}>CURRENT</Badge>}
              </div>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.textMuted }}>
                ${tier.range[0].toLocaleString()} — {tier.range[1] === Infinity ? '∞' : `$${tier.range[1].toLocaleString()}`}
              </span>
            </div>

            <Grid cols={3} style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>RISK</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.textBright }}>{(tier.riskPct * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>MAX POS</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.textBright }}>{tier.maxPositions}</div>
              </div>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>STRATEGIES</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.textBright }}>{tier.strategies.length}</div>
              </div>
            </Grid>

            <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted, letterSpacing: 1, marginBottom: 4 }}>RULES</div>
            {tier.rules.map((rule, i) => (
              <div key={i} style={{
                fontFamily: FONTS.body, fontSize: 11, color: CC.text,
                padding: '3px 0', borderBottom: i < tier.rules.length - 1 ? `1px solid ${CC.border}11` : 'none',
              }}>
                • {rule}
              </div>
            ))}

            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {tier.strategies.map(s => (
                <span key={s} style={{
                  fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted,
                  background: CC.bg, padding: '2px 5px', borderRadius: 3,
                }}>
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </Panel>
        )
      })}

      {/* High-Probability Setups */}
      <SectionHeader style={{ marginTop: 12 }}>High-Probability Setups</SectionHeader>
      {PLAYBOOK_SETUPS.map((setup, idx) => {
        const typeColor = setup.type === 'long' ? CC.profit : setup.type === 'short' ? CC.loss : CC.blue
        return (
          <Panel key={idx} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: FONTS.heading, fontSize: 14, fontWeight: 700, color: CC.textBright }}>{setup.name}</span>
                <Badge color={typeColor}>{setup.type}</Badge>
              </div>
            </div>

            <Grid cols={2} style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>WIN RATE</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.accent }}>{setup.winRate}</div>
              </div>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>R:R TARGET</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.accent }}>{setup.rrTarget}</div>
              </div>
            </Grid>

            {[
              { label: 'ENTRY', value: setup.entry },
              { label: 'TIMEFRAME', value: setup.timeframe },
              { label: 'SIZING', value: setup.sizing },
              { label: 'IV RULE', value: setup.ivRule },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 4 }}>
                <span style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>{item.label}: </span>
                <span style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.text }}>{item.value}</span>
              </div>
            ))}

            <div style={{
              marginTop: 6, padding: '6px 10px', background: `${CC.accent}08`, borderRadius: 4,
              fontFamily: FONTS.body, fontSize: 11, color: CC.accent, fontStyle: 'italic',
            }}>
              Edge: {setup.edge}
            </div>
          </Panel>
        )
      })}

      {/* Daily Process Checklist */}
      <SectionHeader style={{ marginTop: 12 }}>Daily Process</SectionHeader>
      {[
        { phase: 'Pre-Market', items: DEBRIEF_CHECKLIST.premarkt, color: CC.blue },
        { phase: 'Market Hours', items: DEBRIEF_CHECKLIST.execution, color: CC.accent },
        { phase: 'Post-Market', items: DEBRIEF_CHECKLIST.postmarket, color: CC.purple },
      ].map(section => (
        <Panel key={section.phase} style={{ marginBottom: 8 }}>
          <div style={{
            fontFamily: FONTS.heading, fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
            color: section.color, marginBottom: 6,
          }}>
            {section.phase.toUpperCase()}
          </div>
          {section.items.map((item, i) => (
            <div key={i} style={{
              fontFamily: FONTS.body, fontSize: 12, color: CC.text,
              padding: '4px 0', paddingLeft: 12,
              borderBottom: i < section.items.length - 1 ? `1px solid ${CC.border}11` : 'none',
            }}>
              {i + 1}. {item}
            </div>
          ))}
        </Panel>
      ))}
    </div>
  )
}
```

## 8f. Challenge Sizer Tab (src/challenge/tabs/SizerTab.jsx) — Full Contents

```jsx
// ── SIZER TAB — Position Sizer ────────────────────────────────────────────
import { useState, useMemo } from 'react'
import { TIERS, CC, FONTS } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import { Panel, SectionHeader, Button, Input, Grid } from '../components/shared.jsx'

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

export default function SizerTab({ balance }) {
  const [mode, setMode] = useState('single') // 'single' or 'spread'
  const [entry, setEntry] = useState('')
  const [stop, setStop] = useState('')
  const [target, setTarget] = useState('')
  const [width, setWidth] = useState('')
  const [cost, setCost] = useState('')

  const tier = getTier(balance)
  const tierDef = TIERS[tier]
  const riskBudget = balance * tierDef.riskPct

  const calc = useMemo(() => {
    if (mode === 'single') {
      const e = parseFloat(entry) || 0
      const s = parseFloat(stop) || 0
      const t = parseFloat(target) || 0
      if (e <= 0) return null
      const riskPerContract = Math.abs(e - s) * 100
      const maxContracts = riskPerContract > 0 ? Math.floor(riskBudget / riskPerContract) : 0
      const rr = s > 0 ? Math.abs(t - e) / Math.abs(e - s) : 0
      const maxLoss = maxContracts * riskPerContract
      const maxGain = maxContracts * Math.abs(t - e) * 100
      return { maxContracts, rr, maxLoss, maxGain, riskPerContract }
    } else {
      const w = parseFloat(width) || 0
      const c = parseFloat(cost) || 0
      if (c <= 0) return null
      const riskPerContract = c * 100
      const maxContracts = Math.floor(riskBudget / riskPerContract)
      const maxGainPerContract = (w - c) * 100
      const rr = c > 0 ? (w - c) / c : 0
      const maxLoss = maxContracts * riskPerContract
      const maxGain = maxContracts * maxGainPerContract
      return { maxContracts, rr, maxLoss, maxGain, riskPerContract }
    }
  }, [mode, entry, stop, target, width, cost, riskBudget])

  // Win streak projections
  const streakProjections = useMemo(() => {
    if (!calc || !calc.rr || calc.maxContracts <= 0) return []
    const avgWin = calc.riskPerContract * calc.rr * calc.maxContracts
    return [1, 2, 3, 5].map(n => ({
      streak: n,
      gain: Math.round(avgWin * n),
      balance: Math.round(balance + avgWin * n),
      pctGain: ((avgWin * n) / balance * 100).toFixed(1),
    }))
  }, [calc, balance])

  // Quick reference table
  const quickRef = useMemo(() => {
    const optionPrices = [0.25, 0.50, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0]
    return optionPrices.map(price => {
      const fullRisk = price * 100
      const full = Math.floor(riskBudget / fullRisk)
      const half = Math.floor(riskBudget / (fullRisk * 2)) // 50% stop
      const third = Math.floor(riskBudget / (fullRisk * 3)) // 33% stop
      return { price, full, half, third, risk: fullRisk }
    })
  }, [riskBudget])

  return (
    <div style={{ padding: 12 }}>
      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Button onClick={() => setMode('single')} variant={mode === 'single' ? 'primary' : 'ghost'} style={{ flex: 1 }}>SINGLE LEG</Button>
        <Button onClick={() => setMode('spread')} variant={mode === 'spread' ? 'primary' : 'ghost'} style={{ flex: 1 }}>SPREAD</Button>
      </div>

      {/* Tier Info */}
      <Panel style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', marginBottom: 10 }}>
        <div>
          <span style={{ fontFamily: FONTS.heading, fontSize: 11, fontWeight: 700, color: tierDef.color }}>{tierDef.name}</span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginLeft: 8 }}>{(tierDef.riskPct * 100).toFixed(1)}% risk</span>
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700, color: CC.accent }}>
          ${riskBudget.toFixed(0)} <span style={{ fontSize: 9, color: CC.textMuted }}>budget</span>
        </div>
      </Panel>

      {/* Input Fields */}
      <Panel>
        {mode === 'single' ? (
          <Grid cols={3}>
            <Input label="Entry" value={entry} onChange={setEntry} type="number" placeholder="0.00" />
            <Input label="Stop" value={stop} onChange={setStop} type="number" placeholder="0.00" />
            <Input label="Target" value={target} onChange={setTarget} type="number" placeholder="0.00" />
          </Grid>
        ) : (
          <Grid cols={2}>
            <Input label="Spread Width" value={width} onChange={setWidth} type="number" placeholder="e.g. 5.00" />
            <Input label="Net Cost" value={cost} onChange={setCost} type="number" placeholder="e.g. 1.50" />
          </Grid>
        )}
      </Panel>

      {/* Results */}
      {calc && (
        <>
          <Grid cols={2} style={{ marginTop: 10 }}>
            <MetricCard label="Max Contracts" value={calc.maxContracts} color={CC.accent} icon="◈" />
            <MetricCard label="R:R Ratio" value={`${calc.rr.toFixed(1)}:1`} color={calc.rr >= 3 ? CC.profit : calc.rr >= 2 ? CC.accent : CC.warning} icon="↔" />
            <MetricCard label="Max Loss" value={`$${calc.maxLoss.toFixed(0)}`} color={CC.loss} icon="▽" sub={`${(calc.maxLoss / balance * 100).toFixed(1)}% of balance`} />
            <MetricCard label="Max Gain" value={`$${calc.maxGain.toFixed(0)}`} color={CC.profit} icon="△" sub={`${(calc.maxGain / balance * 100).toFixed(1)}% of balance`} />
          </Grid>

          {/* Win Streak Projections */}
          {streakProjections.length > 0 && (
            <>
              <SectionHeader style={{ marginTop: 12 }}>Win Streak Projections</SectionHeader>
              <Panel>
                {streakProjections.map(p => (
                  <div key={p.streak} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 0', borderBottom: `1px solid ${CC.border}22`,
                  }}>
                    <span style={{ fontFamily: FONTS.heading, fontSize: 12, color: CC.textBright }}>
                      {p.streak} Win{p.streak > 1 ? 's' : ''}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: CC.profit }}>+${p.gain.toLocaleString()}</span>
                      <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginLeft: 8 }}>
                        → ${p.balance.toLocaleString()} (+{p.pctGain}%)
                      </span>
                    </div>
                  </div>
                ))}
              </Panel>
            </>
          )}
        </>
      )}

      {/* Quick Reference Table */}
      <SectionHeader style={{ marginTop: 12 }}>Quick Reference — Contracts by Option Price</SectionHeader>
      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${CC.border}` }}>
                {['Price', 'Full Risk', '50% Stop', '33% Stop'].map(h => (
                  <th key={h} style={{
                    fontFamily: FONTS.heading, fontSize: 9, fontWeight: 600, letterSpacing: 1,
                    color: CC.textMuted, textTransform: 'uppercase', padding: '8px 10px', textAlign: 'right',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quickRef.map(r => (
                <tr key={r.price} style={{ borderBottom: `1px solid ${CC.border}22` }}>
                  <td style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.textBright, padding: '6px 10px', textAlign: 'right' }}>
                    ${r.price.toFixed(2)}
                  </td>
                  <td style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.accent, padding: '6px 10px', textAlign: 'right' }}>
                    {r.full}
                  </td>
                  <td style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.accent, padding: '6px 10px', textAlign: 'right' }}>
                    {r.half}
                  </td>
                  <td style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.accent, padding: '6px 10px', textAlign: 'right' }}>
                    {r.third}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
```

---

# AUDIT SUMMARY

## Files Included with Full Contents

| # | File | Lines |
|---|------|-------|
| 1 | package.json | 22 |
| 2 | railway.json | 10 |
| 3 | nixpacks.toml | 14 |
| 4 | vite.config.js | 88 |
| 5 | src/main.jsx | 9 |
| 6 | src/App.jsx | 2616 |
| 7 | src/challenge/ChallengeApp.jsx | 281 |
| 8 | src/challenge/engine/analysis.js | 256 |
| 9 | src/challenge/engine/constants.js | 273 |
| 10 | src/challenge/engine/detection.js | 218 |
| 11 | src/challenge/engine/scoring.js | 92 |
| 12 | src/challenge/engine/tradeBuilder.js | 53 |
| 13 | src/challenge/hooks/useStorage.js | 40 |
| 14 | src/challenge/components/CandleChart.jsx | 156 |
| 15 | src/challenge/components/MetricCard.jsx | 36 |
| 16 | src/challenge/components/ProgressBar.jsx | 36 |
| 17 | src/challenge/components/shared.jsx | 114 |
| 18 | src/challenge/tabs/CommandTab.jsx | 234 |
| 19 | src/challenge/tabs/DebriefTab.jsx | 286 |
| 20 | src/challenge/tabs/IdeasTab.jsx | 242 |
| 21 | src/challenge/tabs/PlaybookTab.jsx | 150 |
| 22 | src/challenge/tabs/RiskTab.jsx | 212 |
| 23 | src/challenge/tabs/SizerTab.jsx | 186 |
| 24 | src/challenge/tabs/TradesTab.jsx | 323 |
| 25 | src/challenge/tabs/WatchlistTab.jsx | 311 |
| 26 | backend/main.py | 2631 |
| 27 | backend/options_engine.py | 912 |
| 28 | backend/trade_ideas.py | 770 |
| 29 | backend/qullamaggie.py | 711 |
| 30 | backend/polygon_client.py | 672 |
| 31 | backend/grading.py | 568 |
| 32 | backend/journal.py | 528 |
| 33 | backend/macro_engine.py | 477 |
| 34 | backend/data_router.py | 353 |
| 35 | backend/wizard.py | 339 |
| 36 | backend/finra_short_volume.py | 338 |
| 37 | backend/llm_provider.py | 310 |
| 38 | backend/indicators.py | 149 |
| 39 | backend/trade_rules.py | 215 |

## 10 Largest Source Files

```
 15185 total
  2631 backend/main.py
  2616 src/App.jsx
   912 backend/options_engine.py
   770 backend/trade_ideas.py
   711 backend/qullamaggie.py
   672 backend/polygon_client.py
   568 backend/grading.py
   528 backend/journal.py
   477 backend/macro_engine.py
   353 backend/data_router.py
```

## Sections with Zero Results

- Section 1c: No .env files committed (keys are in Railway env vars)
- Section 1e: No Prisma/SQL database schema (uses in-memory + JSON file storage)
- Section 2b: No direct Finnhub integration (yfinance used as fallback)
- Section 2e: No Unusual Whales API integration
- Section 3g: Relative strength is calculated inline in main.py, not a separate file
- Section 3h: Volume analysis (OBV, accumulation/distribution) is inline in main.py

## $5K Challenge Module

**YES** — The $5K Challenge module exists at `src/challenge/`

It is a complete sub-application with:
- Entry point: `src/challenge/ChallengeApp.jsx`
- Engine: `src/challenge/engine/` (analysis, constants, detection, scoring, tradeBuilder)
- Tabs: Command, Debrief, Ideas, Playbook, Risk, Sizer, Trades, Watchlist
- Components: CandleChart, MetricCard, ProgressBar, shared
- Hooks: useStorage (localStorage persistence)
- Lazy-loaded as a separate chunk in vite.config.js

## Audit File Statistics

- Total files with full contents: 38
- Approximate total lines in this audit: ~17673
