import { useState, useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────
// DESIGN SYSTEM
// ─────────────────────────────────────────────
const C = {
  bg:   '#0a0e1a', p1: '#0f1520', p2: '#141d2e',
  b1:   '#1a2540', b2: '#243050',
  tx:   '#8899bb', td: '#2a3a58', tb: '#ddeeff',
  g:    '#00ff88', r:  '#ff2a44', a:  '#ffcc00',
  bl:   '#00ccff', pu: '#a855f7', em: '#ff6b35',
  gd:   '#ffcc00',
}
const fm = "'Share Tech Mono',monospace"
const fh = "'Orbitron',sans-serif"
const fb = "'Rajdhani',sans-serif"
const ZC = { CONVERGENCE:C.gd, SECONDARY:C.bl, BUILDING:C.pu, WATCH:C.td }
const SZC = { SHORT_CONVERGENCE:C.em, SHORT_SECONDARY:'#ff8c42', SHORT_WATCH:C.td, NEUTRAL:C.td }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased}
  ::-webkit-scrollbar{display:none}
  body{background:${C.bg};overscroll-behavior:none}
  @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
  @keyframes glow{0%,100%{text-shadow:0 0 6px currentColor}50%{text-shadow:0 0 18px currentColor,0 0 36px currentColor}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .scanline{position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,0.03) 0px,rgba(0,0,0,0.03) 1px,transparent 1px,transparent 2px);z-index:999}
  .tab-bounce:active{transform:scale(0.92)}
  input{outline:none}
`

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
const Pc = ({ v, s = 13 }) => v == null
  ? <span style={{ color: C.td, fontSize: s, fontFamily: fm }}>—</span>
  : <span style={{ color: v >= 0 ? C.g : C.r, fontSize: s, fontFamily: fm, textShadow: `0 0 8px ${v >= 0 ? C.g : C.r}60` }}>
      {v >= 0 ? '▲+' : '▼'}{Math.abs(v).toFixed(2)}%
    </span>

const Dot = ({ col, sz = 8 }) =>
  <div style={{ width: sz, height: sz, borderRadius: '50%', background: col,
    boxShadow: `0 0 6px ${col}80`, display: 'inline-block', flexShrink: 0 }} />

const Bar = ({ score, max, col }) => {
  const c = col || (score >= 20 ? C.gd : score >= 15 ? C.bl : score >= 10 ? C.pu : C.td)
  return <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
    <div style={{ width: 44, height: 4, background: C.b1, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${(score / max) * 100}%`, height: '100%', background: c,
        boxShadow: `0 0 6px ${c}80`, borderRadius: 2 }} />
    </div>
    <span style={{ fontSize: 10, fontFamily: fm, color: c }}>{score}</span>
  </div>
}

const Badge = ({ zone, short }) => {
  const colors = short ? SZC : ZC
  const c = colors[zone] || C.td
  const labels = {
    CONVERGENCE: '⚡ CONV', SECONDARY: '◈ SEC', BUILDING: '◇ BUILD', WATCH: '◌ WATCH',
    SHORT_CONVERGENCE: '🔻 S·CONV', SHORT_SECONDARY: '🔻 S·SEC', SHORT_WATCH: '🔻 WATCH', NEUTRAL: '—',
  }
  return <span style={{ fontSize: 8, fontFamily: fm, padding: '2px 7px', borderRadius: 3,
    color: c, background: c + '16', border: `1px solid ${c}40`, letterSpacing: 0.5 }}>
    {labels[zone] || zone}
  </span>
}

const Panel = ({ children, style = {}, glow: glowColor }) =>
  <div style={{
    background: 'rgba(15,21,32,0.92)', border: `1px solid ${C.b1}`,
    backdropFilter: 'blur(10px)', borderRadius: 12, overflow: 'hidden',
    position: 'relative',
    boxShadow: glowColor ? `0 0 20px ${glowColor}15` : 'none',
    ...style,
  }}>
    {glowColor && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1,
      background: `linear-gradient(90deg,transparent,${glowColor}60,transparent)` }} />}
    {children}
  </div>

const Spinner = () =>
  <div style={{ width: 20, height: 20, border: `2px solid ${C.b2}`,
    borderTopColor: C.gd, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />

const EmaRow = ({ kell }) =>
  <div style={{ display: 'flex', gap: 3 }}>
    <Dot col={kell.emaD === 'bull' ? C.g : kell.emaD === 'bear' ? C.r : C.a} sz={7} />
    <Dot col={kell.emaW === 'bull' ? C.g : kell.emaW === 'bear' ? C.r : C.a} sz={7} />
    <Dot col={kell.emaM === 'bull' ? C.g : kell.emaM === 'bear' ? C.r : C.a} sz={7} />
  </div>

// ─────────────────────────────────────────────
// API HOOK
// ─────────────────────────────────────────────
function useApi(endpoint, ttlMs = 5 * 60 * 1000) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [ts, setTs]         = useState(null)
  const timerRef = useRef(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const r = await fetch(endpoint)
      if (!r.ok) throw new Error(`${r.status}`)
      const d = await r.json()
      setData(d)
      setTs(Date.now())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, ttlMs)
    return () => clearInterval(timerRef.current)
  }, [load, ttlMs])

  return { data, loading, error, reload: load, ts }
}

// ─────────────────────────────────────────────
// CHECKLIST (Parts 7 + 8)
// ─────────────────────────────────────────────
const CHECKLIST_SECTIONS = [
  { id: 'market', label: 'MARKET ENVIRONMENT', color: C.g, items: [
    { id: 'm1', label: 'S&P 500 in Weinstein Stage 2 (above rising 150d SMA)', critical: true, autoKey: 'spxStage2' },
    { id: 'm2', label: 'Kell Green Light (S&P daily above 20 EMA)', critical: true, autoKey: 'kellGreen' },
    { id: 'm3', label: 'Minervini breadth: 500+ names passing Template', critical: true, autoKey: 'breadthOk' },
  ]},
  { id: 'trend', label: 'STAGE & TREND', color: C.gd, items: [
    { id: 't1', label: 'Weinstein Stage 2A confirmed (full size) or 2B (reduced)', critical: true, autoKey: 'stage2A' },
    { id: 't2', label: 'Minervini Template 8/8 (no partial credit)', critical: true, autoKey: 'tpl8' },
    { id: 't3', label: 'RS Rating ≥ 80 (ideal 90+, min 70 reduced size)', critical: true, autoKey: 'rs80' },
    { id: 't4', label: 'Kell EMA alignment daily AND weekly bullish', critical: true, autoKey: 'emaAligned' },
    { id: 't5', label: 'Leading industry group (sector outperforming S&P)', critical: false },
  ]},
  { id: 'entry', label: 'ENTRY SETUP & TIMING', color: C.bl, items: [
    { id: 'e1', label: 'VCP formed: 2+ tightening contractions (ideal 3-4)', critical: true, autoKey: 'vcp2ct' },
    { id: 'e2', label: 'Volume dry-up in final contraction (< 60% of 50d avg)', critical: false, autoKey: 'volDryup' },
    { id: 'e3', label: 'Kell phase actionable (Crossback=ideal, Pop=go, Base n Break=ok)', critical: true, autoKey: 'kellPhaseOk' },
    { id: 'e4', label: 'Breakout volume ≥ 1.5x average (ideal 2x)', critical: true },
    { id: 'e5', label: 'Entry within 5% of pivot (0-3%=ideal, >5%=no trade)', critical: false, autoKey: 'nearPivot' },
  ]},
  { id: 'options', label: 'OPTIONS FILTERS', color: C.pu, items: [
    { id: 'o1', label: 'IV Rank < 50 (ideal < 30, > 70 = no go)', critical: true },
    { id: 'o2', label: 'DTE appropriate: Swing 30-60d, LEAP 180-365d (< 21 = no go)', critical: true },
    { id: 'o3', label: 'Strike selection: Swing delta 0.50-0.65, LEAP ≥ 0.70', critical: false },
    { id: 'o4', label: 'Bid-ask spread < 10% of mid (< 5% ideal, > 10% = no go)', critical: false },
    { id: 'o5', label: 'Open interest ≥ 100 on selected strike (≥ 500 ideal)', critical: false },
    { id: 'o6', label: 'No earnings within DTE window (unless intentional)', critical: true },
  ]},
  { id: 'risk', label: 'RISK MANAGEMENT', color: C.r, items: [
    { id: 'r1', label: 'Stop-loss defined BEFORE entering (VCP low / EMA support)', critical: true },
    { id: 'r2', label: 'Max risk per trade 1-2% of portfolio', critical: true },
    { id: 'r3', label: 'Total portfolio heat < 10% (safe < 6%)', critical: true },
    { id: 'r4', label: 'Risk/reward ratio ≥ 3:1 (ideal ≥ 4:1)', critical: true },
    { id: 'r5', label: 'Scaling plan defined (50/25/25 entry, 1/3 at T1, T2, trail)', critical: false },
    { id: 'r6', label: 'Exit triggers defined (stage change, red light, template fail)', critical: true },
  ]},
]

const NO_GO_LIST = [
  'Market in Stage 3 or 4', 'VIX above 30', 'Stock RS below 70',
  'No VCP or defined entry structure', 'IV Rank above 70', 'DTE below 21',
  "Can't define stop level", 'Portfolio heat above 10%',
  'Chasing — stock 5%+ above pivot', 'Earnings within 2 weeks of expiry',
]

function ChecklistPanel({ stock, breadth }) {
  const totalItems = CHECKLIST_SECTIONS.reduce((a, s) => a + s.items.length, 0)
  const [checked, setChecked] = useState({})
  const [expanded, setExpanded] = useState({})

  // Auto-populate from stock + breadth data
  const autoChecks = stock && breadth ? {
    spxStage2:    breadth.spxStage === 2,
    kellGreen:    breadth.spxEma === 'above',
    breadthOk:    (breadth.tplCount || 0) > 300,
    stage2A:      stock.wein?.stage === '2A',
    tpl8:         stock.min?.tplScore === 8,
    rs80:         (stock.min?.rs || 0) >= 80,
    emaAligned:   stock.kell?.emaD === 'bull' && stock.kell?.emaW === 'bull',
    vcp2ct:       (stock.vcp?.count || 0) >= 2,
    volDryup:     stock.vcp?.volDryup || false,
    kellPhaseOk:  ['EMA Crossback','Pop','Base n Break'].includes(stock.kell?.phase),
    nearPivot:    stock.vcp?.pivot ? Math.abs(stock.px / stock.vcp.pivot - 1) <= 0.05 : false,
  } : {}

  const allItems = CHECKLIST_SECTIONS.flatMap(s => s.items)
  const passCount = allItems.filter(item =>
    item.autoKey ? autoChecks[item.autoKey] : checked[item.id]
  ).length

  const pct = Math.round((passCount / totalItems) * 100)
  const verdict = pct >= 100 ? ['ALL CLEAR — EXECUTE', C.g] :
                  pct >= 85  ? ['NEAR READY', C.a] :
                               ['IN PROGRESS', C.td]

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {/* Progress */}
    <Panel style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: fh, fontSize: 11, color: C.tb }}>Pre-Trade Checklist</span>
        <span style={{ fontFamily: fm, fontSize: 13, fontWeight: 700, color: verdict[1],
          textShadow: `0 0 8px ${verdict[1]}60` }}>{passCount}/{totalItems}</span>
      </div>
      <div style={{ background: C.b1, height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: verdict[1],
          boxShadow: `0 0 8px ${verdict[1]}60`, borderRadius: 3, transition: 'width .4s ease' }} />
      </div>
      <div style={{ fontFamily: fb, fontSize: 12, fontWeight: 600, color: verdict[1] }}>{verdict[0]}</div>
    </Panel>

    {/* Sections */}
    {CHECKLIST_SECTIONS.map(sec => {
      const secPass = sec.items.filter(item => item.autoKey ? autoChecks[item.autoKey] : checked[item.id]).length
      return <Panel key={sec.id} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: `${sec.color}08`,
          borderBottom: `1px solid ${sec.color}20` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: fm, fontSize: 9, color: sec.color, letterSpacing: 1.5 }}>{sec.label}</span>
            <span style={{ fontFamily: fm, fontSize: 9, color: sec.color }}>{secPass}/{sec.items.length}</span>
          </div>
        </div>
        {sec.items.map(item => {
          const isAuto  = !!item.autoKey
          const passed  = isAuto ? autoChecks[item.autoKey] : checked[item.id]
          const isExp   = expanded[item.id]
          return <div key={item.id}
            onClick={() => {
              if (!isAuto) setChecked(p => ({ ...p, [item.id]: !p[item.id] }))
              setExpanded(p => ({ ...p, [item.id]: !p[item.id] }))
            }}
            style={{ padding: '8px 14px', borderBottom: `1px solid ${C.b1}20`,
              cursor: 'pointer', background: passed ? `${sec.color}06` : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, color: passed ? sec.color : C.td,
                textShadow: passed ? `0 0 6px ${sec.color}60` : 'none' }}>
                {passed ? '✓' : '○'}
              </span>
              <span style={{ fontFamily: fb, fontSize: 11, color: passed ? C.tx : C.td, flex: 1 }}>{item.label}</span>
              <span style={{ fontSize: 7, fontFamily: fm, padding: '1px 5px', borderRadius: 3,
                color: item.critical ? C.r : C.a,
                background: item.critical ? `${C.r}15` : `${C.a}15` }}>
                {item.critical ? 'MUST' : 'IMP'}
              </span>
              {isAuto && <span style={{ fontSize: 7, fontFamily: fm, color: C.td }}>AUTO</span>}
            </div>
          </div>
        })}
      </Panel>
    })}

    {/* No-Go List */}
    <Panel style={{ padding: 14, border: `1px solid ${C.r}20` }}>
      <div style={{ fontFamily: fm, fontSize: 9, color: C.r, letterSpacing: 1.5, marginBottom: 8 }}>🚫 INSTANT NO-GO — ANY ONE = WALK AWAY</div>
      {NO_GO_LIST.map((item, i) =>
        <div key={i} style={{ fontFamily: fb, fontSize: 11, color: C.td, padding: '3px 0',
          borderBottom: `1px solid ${C.b1}20` }}>• {item}</div>
      )}
    </Panel>
  </div>
}

// ─────────────────────────────────────────────
// STOCK DETAIL VIEW
// ─────────────────────────────────────────────
function DetailView({ stock: s, onBack, breadth }) {
  const [tab, setTab] = useState('overview')
  if (!s) return null
  const zc = ZC[s.conv?.zone] || C.td

  return <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeUp .25s ease' }}>
    {/* Header */}
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.b1}`,
      background: C.p1, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.td,
        fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>←</button>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: fh, fontSize: 18, fontWeight: 700, color: C.tb,
            textShadow: `0 0 10px ${zc}30` }}>{s.tk}</span>
          <div style={{ fontSize: 22, fontFamily: fm, fontWeight: 700, color: zc,
            textShadow: `0 0 12px ${zc}60` }}>{s.conv?.score}<span style={{ fontSize: 11, color: C.td }}>/{s.conv?.max}</span></div>
        </div>
        <div style={{ fontFamily: fb, fontSize: 11, color: C.td }}>{s.nm} · ${s.px}</div>
      </div>
    </div>

    {/* Sub-tabs */}
    <div style={{ display: 'flex', background: C.p2, borderBottom: `1px solid ${C.b1}`, flexShrink: 0 }}>
      {['overview','checklist','short'].map(t =>
        <button key={t} onClick={() => setTab(t)}
          style={{ flex: 1, padding: '8px 4px', background: 'none', border: 'none',
            borderBottom: tab === t ? `2px solid ${zc}` : '2px solid transparent',
            color: tab === t ? C.tb : C.td, fontFamily: fm, fontSize: 9, cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {t === 'short' ? 'SHORT' : t}
        </button>
      )}
    </div>

    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', paddingBottom: 30 }}>
      {tab === 'overview' && <DetailOverview s={s} zc={zc} />}
      {tab === 'checklist' && <ChecklistPanel stock={s} breadth={breadth} />}
      {tab === 'short' && <ShortAnalysis s={s} />}
    </div>
  </div>
}

function DetailOverview({ s, zc }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', gap: 4 }}>
      <Badge zone={s.conv?.zone} /><Badge zone={s.shortConv?.zone} short />
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      {[['Day', s.dp],['Week', s.wp],['Month', s.mp]].map(([l, v]) =>
        <Panel key={l} style={{ flex: 1, padding: '8px 10px' }}>
          <div style={{ fontSize: 7, color: C.td, fontFamily: fb, textTransform: 'uppercase', letterSpacing: 1 }}>{l}</div>
          <Pc v={v} s={14} />
        </Panel>
      )}
    </div>

    {/* Three frameworks */}
    {[
      ['WEINSTEIN', C.g, `Stage ${s.wein?.stage} · 30w MA $${s.wein?.ma150} (${s.wein?.slopeRising ? `rising ${s.wein?.slopeWeeks}wk` : 'flat/declining'}) · ${s.wein?.pctFromMA > 0 ? '+' : ''}${s.wein?.pctFromMA}% from MA`],
      ['MINERVINI', C.pu, `Template ${s.min?.tplScore}/8 · RS ${s.min?.rs} · VCP: ${s.vcp?.count ? `${s.vcp.count}ct (${s.vcp.depths})` : 'None'}\nEPS: ${s.min?.eps > 0 ? '+' : ''}${s.min?.eps}% · Rev: ${s.min?.rev > 0 ? '+' : ''}${s.min?.rev}%${s.min?.pivot ? ` · Pivot $${s.min.pivot}` : ''}`],
      ['KELL', C.bl, `Phase: ${s.kell?.phase} · Light: ${s.kell?.light}\nEMA D/W/M: ${s.kell?.emaD}/${s.kell?.emaW}/${s.kell?.emaM} · Base #${s.kell?.base || '—'}`],
    ].map(([name, color, detail]) =>
      <Panel key={name} style={{ padding: '12px 14px', borderLeft: `3px solid ${color}50` }}>
        <div style={{ fontSize: 8, fontFamily: fm, color, letterSpacing: 2, marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 11, fontFamily: fm, color: C.tx, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{detail}</div>
      </Panel>
    )}

    {/* Thesis */}
    <Panel style={{ padding: '12px 14px', borderLeft: `3px solid ${zc}` }} glow={zc}>
      <div style={{ fontSize: 8, fontFamily: fm, color: zc, letterSpacing: 2, marginBottom: 4 }}>CONVERGENCE THESIS</div>
      <div style={{ fontSize: 12, fontFamily: fb, color: C.tx, lineHeight: 1.8 }}>{s.setup}</div>
    </Panel>

    {s.optPlay && s.optPlay !== 'No play' && s.optPlay !== 'Wait for phase confirmation' && <Panel style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 8, fontFamily: fm, color: C.bl, letterSpacing: 2, marginBottom: 4 }}>OPTIONS PLAY</div>
      <div style={{ fontSize: 13, fontFamily: fm, color: C.bl, textShadow: `0 0 8px ${C.bl}60` }}>{s.optPlay}</div>
    </Panel>}

    {s.flags?.length > 0 && <Panel style={{ padding: '12px 14px', borderLeft: `3px solid ${C.r}` }}>
      <div style={{ fontSize: 8, fontFamily: fm, color: C.r, letterSpacing: 2, marginBottom: 4 }}>⚠ FLAGS</div>
      {s.flags.map((f, i) => <div key={i} style={{ fontSize: 11, fontFamily: fb, color: C.a, marginTop: 2 }}>• {f}</div>)}
    </Panel>}

    {/* Template breakdown */}
    {s.min?.tpl && <Panel style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 8, fontFamily: fm, color: C.pu, letterSpacing: 2, marginBottom: 8 }}>MINERVINI 8-POINT TEMPLATE</div>
      {[
        'Price > 50d MA', 'Price > 150d MA', 'Price > 200d MA',
        '50d MA > 150d MA', '150d MA > 200d MA', '200d MA trending up 20d',
        'Within 25% of 52-week high', 'RS Rating ≥ 70',
      ].map((label, i) => {
        const ok = s.min.tpl[i]
        return <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: fb, padding: '3px 0',
          borderBottom: `1px solid ${C.b1}20` }}>
          <span style={{ color: ok ? C.g : C.r, textShadow: `0 0 5px ${ok ? C.g : C.r}60` }}>{ok ? '✓' : '✗'}</span>
          <span style={{ color: ok ? C.tx : C.td }}>{label}</span>
        </div>
      })}
    </Panel>}
  </div>
}

function ShortAnalysis({ s }) {
  const sc = s.shortConv
  const col = SZC[sc?.zone] || C.td
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeUp .2s ease' }}>
    <Panel style={{ padding: '12px 14px', borderLeft: `3px solid ${col}` }} glow={col}>
      <div style={{ fontSize: 8, fontFamily: fm, color: col, letterSpacing: 2, marginBottom: 4 }}>SHORT CONVERGENCE ANALYSIS</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Badge zone={sc?.zone} short />
        <div style={{ fontSize: 22, fontFamily: fm, fontWeight: 700, color: col }}>
          {sc?.score}<span style={{ fontSize: 11, color: C.td }}>/22</span>
        </div>
      </div>
      <Bar score={sc?.score || 0} max={22} col={col} />
    </Panel>

    <Panel style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 8, fontFamily: fm, color: C.em, letterSpacing: 2, marginBottom: 8 }}>INVERSE MINERVINI TEMPLATE</div>
      {[
        'Price < 50d MA', 'Price < 150d MA', 'Price < 200d MA',
        '50d MA < 150d MA', '150d MA < 200d MA', '200d MA declining 20d',
        'At least 25% below 52-week high', 'RS Rating ≤ 30',
      ].map((label, i) => {
        const ok = sc?.invTpl?.[i]
        return <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: fb, padding: '3px 0',
          borderBottom: `1px solid ${C.b1}20` }}>
          <span style={{ color: ok ? C.em : C.td }}>{ok ? '✓' : '○'}</span>
          <span style={{ color: ok ? C.tx : C.td }}>{label}</span>
        </div>
      })}
    </Panel>

    <Panel style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 8, fontFamily: fm, color: C.td, letterSpacing: 2, marginBottom: 6 }}>SHORT FRAMEWORK NOTES</div>
      <div style={{ fontFamily: fb, fontSize: 12, color: C.td, lineHeight: 1.8 }}>
        Stage {s.wein?.stage} · RS {s.min?.rs} · {s.kell?.phase}<br/>
        {sc?.zone === 'SHORT_CONVERGENCE' && <span style={{ color: C.em }}>⚠ Short convergence — all 3 frameworks bearish. Consider put play.</span>}
        {sc?.zone === 'SHORT_SECONDARY' && <span style={{ color: '#ff8c42' }}>◈ Secondary short — building bearish case.</span>}
        {(sc?.zone === 'SHORT_WATCH' || sc?.zone === 'NEUTRAL') && <span style={{ color: C.td }}>No short setup. Bullish or neutral.</span>}
      </div>
    </Panel>
  </div>
}

// ─────────────────────────────────────────────
// HOME TAB
// ─────────────────────────────────────────────
function HomeTab({ watchlistData, breadthData, onSelect }) {
  if (!watchlistData || !breadthData) return <LoadingScreen msg="Loading market data…" />

  const stocks  = watchlistData.stocks || []
  const b       = breadthData
  const conv    = stocks.filter(s => s.conv?.zone === 'CONVERGENCE')
  const sec     = stocks.filter(s => s.conv?.zone === 'SECONDARY')
  const shortConv = stocks.filter(s => ['SHORT_CONVERGENCE','SHORT_SECONDARY'].includes(s.shortConv?.zone))
  const wOk     = b.spxStage === 2
  const kOk     = b.spxEma === 'above'
  const mOk     = (b.tplCount || 0) > 300
  const allOk   = wOk && kOk && mOk

  return <div style={{ padding: '12px 14px', paddingBottom: 90, display: 'flex', flexDirection: 'column', gap: 12 }}>
    {/* Market Triple-Check */}
    <Panel style={{ padding: '12px 14px' }} glow={allOk ? C.g : C.a}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: fh, fontSize: 11, color: C.tb }}>Market Triple-Check</span>
        <span style={{ fontFamily: fm, fontSize: 10, fontWeight: 700, color: allOk ? C.g : C.a,
          textShadow: `0 0 8px ${allOk ? C.g : C.a}60` }}>
          {allOk ? '✓ ALL CLEAR' : '△ MIXED'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[['W', `Stage ${b.spxStage}`, wOk, C.g], ['M', `${b.tplCount||'?'} TPL`, mOk, C.pu], ['K', `${b.spxEma||'?'} 20e`, kOk, C.bl]].map(([l, v, ok, c]) =>
          <div key={l} style={{ flex: 1, background: C.p2, borderRadius: 8, padding: '8px 10px',
            border: `1px solid ${ok ? c : C.r}25` }}>
            <div style={{ fontSize: 8, fontFamily: fm, color: c, letterSpacing: 1 }}>{l}</div>
            <div style={{ fontSize: 11, fontFamily: fm, fontWeight: 600, color: C.tb, marginTop: 2 }}>{v}</div>
            <div style={{ fontSize: 16, marginTop: 2 }}>{ok ? '✅' : '⚠️'}</div>
          </div>
        )}
      </div>
    </Panel>

    {/* Quick Stats */}
    <div style={{ display: 'flex', gap: 6 }}>
      {[['VIX', b.vix || '—', b.vix > 20 ? C.a : C.g], ['>50d', (b.spx?.pct50 || '—') + '%', C.bl], ['Conv', conv.length, C.gd]].map(([l, v, c]) =>
        <Panel key={l} style={{ flex: 1, padding: '8px 10px' }}>
          <div style={{ fontSize: 7, fontFamily: fb, color: C.td, letterSpacing: 1, textTransform: 'uppercase' }}>{l}</div>
          <div style={{ fontSize: 18, fontFamily: fm, fontWeight: 700, color: c, marginTop: 2 }}>{v}</div>
        </Panel>
      )}
    </div>

    {/* Convergence Zone */}
    {conv.length > 0 && <Panel style={{ padding: '12px 14px' }} glow={C.gd}>
      <div style={{ fontFamily: fh, fontSize: 11, color: C.gd, marginBottom: 10,
        textShadow: `0 0 10px ${C.gd}60` }}>⚡ Full Convergence</div>
      {conv.map(s =>
        <div key={s.tk} onClick={() => onSelect(s)} style={{ background: C.p2, borderRadius: 8,
          padding: '10px 12px', marginBottom: 6, border: `1px solid ${C.gd}20`, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><span style={{ fontFamily: fh, fontSize: 14, fontWeight: 700, color: C.tb }}>{s.tk}</span>
              <span style={{ fontSize: 10, fontFamily: fm, color: C.td, marginLeft: 6 }}>${s.px}</span></div>
            <Bar score={s.conv.score} max={s.conv.max} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}><Pc v={s.dp} /><Pc v={s.wp} /><Pc v={s.mp} /></div>
          <div style={{ fontSize: 9, fontFamily: fm, color: C.gd, marginTop: 6 }}>
            {s.kell.phase} · RS {s.min.rs}{s.vcp?.count > 0 ? ` · VCP ${s.vcp.count}ct` : ''}</div>
          <div style={{ fontSize: 10, fontFamily: fb, color: C.tx, marginTop: 4, lineHeight: 1.5 }}>{s.setup}</div>
          {s.optPlay && !['No play','Wait for phase confirmation','Wait for breakout confirmation'].includes(s.optPlay) &&
            <div style={{ fontSize: 10, fontFamily: fm, color: C.bl, marginTop: 6, padding: '4px 8px',
              background: `${C.bl}10`, borderRadius: 6 }}>📋 {s.optPlay}</div>}
        </div>
      )}
    </Panel>}

    {/* Secondary */}
    {sec.length > 0 && <Panel style={{ padding: '12px 14px', border: `1px solid ${C.bl}20` }}>
      <div style={{ fontFamily: fh, fontSize: 10, color: C.bl, marginBottom: 8 }}>◈ Secondary — Continuation</div>
      {sec.map(s =>
        <div key={s.tk} onClick={() => onSelect(s)} style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.b1}30`, cursor: 'pointer' }}>
          <div><span style={{ fontFamily: fh, fontSize: 12, color: C.tb }}>{s.tk}</span>
            <span style={{ fontSize: 9, fontFamily: fm, color: C.td, marginLeft: 4 }}>Base #{s.kell.base}</span></div>
          <Bar score={s.conv.score} max={s.conv.max} />
        </div>
      )}
    </Panel>}

    {/* Short opportunities */}
    {shortConv.length > 0 && <Panel style={{ padding: '12px 14px', border: `1px solid ${C.em}20` }}>
      <div style={{ fontFamily: fh, fontSize: 10, color: C.em, marginBottom: 8 }}>🔻 Short Setups</div>
      {shortConv.map(s =>
        <div key={s.tk} onClick={() => onSelect(s)} style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.b1}30`, cursor: 'pointer' }}>
          <div><span style={{ fontFamily: fh, fontSize: 12, color: C.r }}>{s.tk}</span>
            <span style={{ fontSize: 9, fontFamily: fm, color: C.td, marginLeft: 4 }}>Stage {s.wein.stage}</span></div>
          <Bar score={s.shortConv.score} max={22} col={C.em} />
        </div>
      )}
    </Panel>}

    {/* Sector heatmap */}
    {b.sectors?.length > 0 && <Panel style={{ padding: '12px 14px' }}>
      <div style={{ fontFamily: fh, fontSize: 9, color: C.tb, marginBottom: 8 }}>Sector Rotation</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
        {[...b.sectors].sort((a, x) => x.p - a.p).slice(0, 8).map(s => {
          const c = s.p > .5 ? C.g : s.p > -.5 ? C.td : C.r
          return <div key={s.n} style={{ background: s.p > 0 ? `rgba(0,255,136,${Math.min(Math.abs(s.p)/4,.2)})` : `rgba(255,42,68,${Math.min(Math.abs(s.p)/4,.2)})`, borderRadius: 6, padding: '6px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 7, fontFamily: fb, color: C.td }}>{s.n}</div>
            <div style={{ fontSize: 12, fontFamily: fm, fontWeight: 700, color: c }}>{s.p > 0 ? '+' : ''}{s.p}%</div>
          </div>
        })}
      </div>
    </Panel>}
  </div>
}

// ─────────────────────────────────────────────
// WATCH TAB (Long/Short toggle)
// ─────────────────────────────────────────────
function WatchTab({ watchlistData, onSelect }) {
  const [mode, setMode] = useState('long')
  if (!watchlistData) return <LoadingScreen msg="Loading watchlist…" />
  const stocks = watchlistData.stocks || []

  const longZones  = ['CONVERGENCE','SECONDARY','BUILDING','WATCH']
  const shortZones = ['SHORT_CONVERGENCE','SHORT_SECONDARY','SHORT_WATCH']

  const zonesLabels = {
    CONVERGENCE: '⚡ Full Convergence', SECONDARY: '◈ Secondary',
    BUILDING: '◇ Building', WATCH: '◌ Watch',
    SHORT_CONVERGENCE: '🔻 Short Convergence', SHORT_SECONDARY: '🔻 Short Secondary', SHORT_WATCH: '🔻 Short Watch',
  }

  const filtered = mode === 'long'
    ? longZones.map(z => ({ zone: z, items: stocks.filter(s => s.conv?.zone === z) })).filter(g => g.items.length)
    : shortZones.map(z => ({ zone: z, items: stocks.filter(s => s.shortConv?.zone === z) })).filter(g => g.items.length)

  return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    {/* Toggle */}
    <div style={{ display: 'flex', padding: '8px 14px', gap: 8, background: C.p1,
      borderBottom: `1px solid ${C.b1}`, flexShrink: 0 }}>
      {[['long','LONG ↑', C.gd], ['short','SHORT ↓', C.em]].map(([m, label, c]) =>
        <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '7px 10px', borderRadius: 8,
          background: mode === m ? `${c}20` : C.p2, border: `1px solid ${mode === m ? c : C.b1}`,
          color: mode === m ? c : C.td, fontFamily: fh, fontSize: 10, cursor: 'pointer',
          fontWeight: mode === m ? 700 : 400 }}>{label}</button>
      )}
    </div>

    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', paddingBottom: 90,
      display: 'flex', flexDirection: 'column', gap: 10 }}>
      {filtered.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: C.td, fontFamily: fb }}>
        No {mode} setups found
      </div>}
      {filtered.map(({ zone, items }) => {
        const zc = mode === 'long' ? ZC[zone] : SZC[zone]
        return <Panel key={zone} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: `${zc}08`, borderBottom: `1px solid ${C.b1}` }}>
            <span style={{ fontFamily: fh, fontSize: 10, fontWeight: 700, color: zc }}>{zonesLabels[zone]}</span>
            <span style={{ fontSize: 8, fontFamily: fm, color: C.td, marginLeft: 6 }}>{items.length}</span>
          </div>
          {items.map((s, i) =>
            <div key={s.tk} onClick={() => onSelect(s)} style={{ padding: '10px 12px',
              borderBottom: i < items.length - 1 ? `1px solid ${C.b1}20` : 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: fh, fontSize: 14, fontWeight: 700, color: mode === 'short' ? C.r : C.tb }}>{s.tk}</span>
                  <span style={{ fontFamily: fm, fontSize: 10, color: C.td }}>${s.px}</span>
                </div>
                <Bar score={mode === 'long' ? s.conv?.score : s.shortConv?.score} max={22}
                  col={mode === 'short' ? C.em : undefined} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Pc v={s.dp} s={10} /><Pc v={s.wp} s={10} /><Pc v={s.mp} s={10} />
                <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: fm,
                  color: s.min?.rs >= 80 ? C.g : s.min?.rs >= 70 ? C.a : C.r }}>RS {s.min?.rs}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <EmaRow kell={s.kell} />
                <span style={{ fontSize: 9, fontFamily: fm, color: C.tx }}>{s.kell?.phase}</span>
                <span style={{ fontSize: 8, fontFamily: fm, color: C.td, marginLeft: 'auto' }}>
                  Wein {s.wein?.stage}
                </span>
              </div>
              {s.flags?.length > 0 && <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                {s.flags.map(f => <span key={f} style={{ fontSize: 7, fontFamily: fm, padding: '1px 5px',
                  borderRadius: 3, background: `${C.r}12`, color: C.r, border: `1px solid ${C.r}20` }}>⚠ {f}</span>)}
              </div>}
            </div>
          )}
        </Panel>
      })}
    </div>
  </div>
}

// ─────────────────────────────────────────────
// PLAYS TAB (Parts 4 + 7)
// ─────────────────────────────────────────────
function PlaysTab({ watchlistData, breadthData }) {
  const [view, setView] = useState('plays')
  const [selPlay, setSelPlay] = useState(null)
  if (!watchlistData) return <LoadingScreen msg="Loading plays…" />

  const stocks = watchlistData.stocks || []
  const plays = stocks.filter(s => ['CONVERGENCE','SECONDARY'].includes(s.conv?.zone))
  const shortPlays = stocks.filter(s => ['SHORT_CONVERGENCE','SHORT_SECONDARY'].includes(s.shortConv?.zone))

  const totalRisk = plays.length * 2  // rough estimate %

  return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    {/* Sub-nav */}
    <div style={{ display: 'flex', background: C.p1, borderBottom: `1px solid ${C.b1}`, flexShrink: 0 }}>
      {[['plays','📋 PLAYS'], ['checklist','✓ CHECKLIST'], ['short','🔻 SHORT']].map(([v, l]) =>
        <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: '9px 4px', background: 'none', border: 'none',
          borderBottom: view === v ? `2px solid ${C.gd}` : '2px solid transparent',
          color: view === v ? C.tb : C.td, fontFamily: fm, fontSize: 8, cursor: 'pointer', letterSpacing: 0.5 }}>
          {l}
        </button>
      )}
    </div>

    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', paddingBottom: 90 }}>
      {view === 'plays' && <>
        {/* Portfolio Heat Summary */}
        <Panel style={{ padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: fh, fontSize: 10, color: C.tb }}>Portfolio Overview</span>
            <span style={{ fontFamily: fm, fontSize: 9, color: totalRisk > 10 ? C.r : totalRisk > 6 ? C.a : C.g }}>
              Heat: ~{totalRisk}%
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['Active Long', plays.length, C.gd],['Active Short', shortPlays.length, C.em],['Max Risk%', `~${totalRisk}%`, totalRisk > 10 ? C.r : C.a]].map(([l, v, c]) =>
              <div key={l} style={{ flex: 1, background: C.p2, borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 7, color: C.td, fontFamily: fb, textTransform: 'uppercase', letterSpacing: 0.8 }}>{l}</div>
                <div style={{ fontSize: 16, fontFamily: fm, fontWeight: 700, color: c, marginTop: 2 }}>{v}</div>
              </div>
            )}
          </div>
        </Panel>

        {plays.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: C.td, fontFamily: fb }}>
          No plays currently meet convergence criteria
        </div>}

        {plays.map(s => <PlayCard key={s.tk} s={s} sel={selPlay === s.tk} onTap={() => setSelPlay(selPlay === s.tk ? null : s.tk)} />)}
      </>}

      {view === 'checklist' && <ChecklistPanel stock={plays[0]} breadth={breadthData} />}

      {view === 'short' && <>
        <Panel style={{ padding: '12px 14px', marginBottom: 12, border: `1px solid ${C.em}20` }}>
          <div style={{ fontFamily: fh, fontSize: 10, color: C.em, marginBottom: 6 }}>🔻 Short Convergence Plays</div>
          <div style={{ fontFamily: fb, fontSize: 11, color: C.td }}>Put plays on confirmed Stage 3/4 breakdowns with all 3 frameworks bearish.</div>
        </Panel>
        {shortPlays.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: C.td, fontFamily: fb }}>No short setups confirmed</div>}
        {shortPlays.map(s => <ShortPlayCard key={s.tk} s={s} />)}
      </>}
    </div>
  </div>
}

function PlayCard({ s, sel, onTap }) {
  const isConv = s.conv.zone === 'CONVERGENCE'
  const col    = isConv ? C.gd : C.bl
  const size   = isConv ? '5% portfolio (Conv)' : '3% portfolio (Sec)'
  const pivot  = s.vcp?.pivot
  const stop   = pivot ? (pivot * 0.93).toFixed(2) : '—'
  const t1     = pivot ? (pivot * 1.08).toFixed(2) : '—'
  const t2     = pivot ? (pivot * 1.20).toFixed(2) : '—'

  return <Panel key={s.tk} style={{ marginBottom: 10, overflow: 'hidden' }} glow={col}>
    <div onClick={onTap} style={{ padding: '12px 14px', cursor: 'pointer',
      background: `linear-gradient(90deg,${col}0a,transparent)`, borderLeft: `3px solid ${col}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: fh, fontSize: 16, fontWeight: 700, color: C.tb }}>{s.tk}</span>
          <Badge zone={s.conv.zone} />
        </div>
        <Bar score={s.conv.score} max={22} />
      </div>
      <div style={{ fontFamily: fb, fontSize: 11, color: C.tx, lineHeight: 1.5 }}>{s.setup}</div>
    </div>

    {sel && <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.b1}` }}>
      {/* Entry */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 8, fontFamily: fm, color: col, letterSpacing: 2, marginBottom: 6 }}>ENTRY</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            ['Strike/Expiry', s.optPlay || '—'],
            ['Delta target', isConv ? '0.55 (swing)' : '0.55 (swing)'],
            ['Max entry', pivot ? `Near $${pivot}` : '—'],
            ['Position size', size],
          ].map(([l, v]) => <Row key={l} label={l} val={v} />)}
        </div>
      </div>

      {/* Stop */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 8, fontFamily: fm, color: C.r, letterSpacing: 2, marginBottom: 6 }}>STOP</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            ['Stock stop', `Below $${stop} (VCP low / EMA support)`],
            ['Option stop', '50% of premium paid'],
          ].map(([l, v]) => <Row key={l} label={l} val={v} col={C.r} />)}
        </div>
      </div>

      {/* Targets */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 8, fontFamily: fm, color: C.g, letterSpacing: 2, marginBottom: 6 }}>TARGETS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            ['T1 — Scale 1/3', `$${t1} (~+8%) · +40-50% option`],
            ['T2 — Scale 1/3', `$${t2} (~+20%) · +100% option`],
            ['T3 — Trail 1/3', 'Trail via 21 EMA on daily'],
          ].map(([l, v]) => <Row key={l} label={l} val={v} col={C.g} />)}
        </div>
      </div>

      {/* Management Rules */}
      <div style={{ background: `${C.pu}10`, borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ fontSize: 8, fontFamily: fm, color: C.pu, letterSpacing: 2, marginBottom: 6 }}>MANAGEMENT RULES</div>
        {[
          '→ ADD on Kell EMA Crossback confirmation',
          '→ TIGHTEN stop to breakeven after T1 hit',
          '→ EXIT ALL if Weinstein stage changes to 3+',
          '→ EXIT ALL if Kell turns Red Light',
          '→ EXIT ALL if Minervini Template fails (< 6/8)',
        ].map((r, i) => <div key={i} style={{ fontFamily: fb, fontSize: 11, color: C.tx, padding: '2px 0' }}>{r}</div>)}
      </div>
    </div>}
  </Panel>
}

function ShortPlayCard({ s }) {
  const col  = C.em
  const stage = s.wein?.stage
  return <Panel style={{ marginBottom: 10, overflow: 'hidden' }}>
    <div style={{ padding: '12px 14px', background: `${col}0a`, borderLeft: `3px solid ${col}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: fh, fontSize: 16, fontWeight: 700, color: C.r }}>{s.tk}</span>
        <Badge zone={s.shortConv?.zone} short />
      </div>
      <div style={{ fontFamily: fb, fontSize: 11, color: C.tx }}>{s.setup}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 10 }}>
        {[
          ['Type', stage === '3' ? 'Stage 3 Distribution (early warning)' : 'Stage 4 Decline — Put play'],
          ['Timing', 'Buy puts on failed rally into declining EMAs'],
          ['Strike', 'ATM to slight ITM put (delta 0.45-0.60), 30-60 DTE'],
          ['Stop', 'Close if stock reclaims both 10 AND 20 EMA on daily'],
        ].map(([l, v]) => <Row key={l} label={l} val={v} col={col} />)}
      </div>
    </div>
  </Panel>
}

const Row = ({ label, val, col }) =>
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0',
    borderBottom: `1px solid ${C.b1}20` }}>
    <span style={{ fontSize: 9, fontFamily: fm, color: C.td, flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: 10, fontFamily: fb, color: col || C.tx, textAlign: 'right' }}>{val}</span>
  </div>

// ─────────────────────────────────────────────
// BRIEF TAB (Part 10)
// ─────────────────────────────────────────────
function BriefTab() {
  const { data, loading, error, reload, ts } = useApi('/api/daily-brief', 30 * 60 * 1000)

  const minsAgo = ts ? Math.round((Date.now() - ts) / 60000) : null

  return <div style={{ padding: '12px 14px', paddingBottom: 90, display: 'flex', flexDirection: 'column', gap: 12 }}>
    {/* Header */}
    <Panel style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: fh, fontSize: 13, color: C.gd, textShadow: `0 0 10px ${C.gd}60` }}>
          ◈ Morning Brief
        </span>
        <button onClick={reload} style={{ background: `${C.bl}15`, border: `1px solid ${C.bl}30`,
          borderRadius: 6, padding: '5px 10px', color: C.bl, fontFamily: fm, fontSize: 9, cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>
      {minsAgo !== null && <div style={{ fontSize: 8, fontFamily: fm, color: C.td, marginTop: 4 }}>
        Generated {minsAgo === 0 ? 'just now' : `${minsAgo}m ago`}
      </div>}
    </Panel>

    {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>}
    {error && <Panel style={{ padding: 16, border: `1px solid ${C.r}20` }}>
      <div style={{ color: C.r, fontFamily: fb }}>Error loading brief: {error}</div>
    </Panel>}
    {data && <Panel style={{ padding: '14px 16px' }}>
      <div style={{ fontFamily: fb, fontSize: 13, color: C.tx, lineHeight: 2, whiteSpace: 'pre-wrap' }}>
        {/* Render markdown-like content */}
        {(data.content || '').split('\n').map((line, i) => {
          if (line.startsWith('## ')) return <div key={i} style={{ fontFamily: fh, fontSize: 13, color: C.gd,
            marginTop: 16, marginBottom: 6, textShadow: `0 0 8px ${C.gd}40` }}>{line.replace('## ','')}</div>
          if (line.startsWith('### ')) return <div key={i} style={{ fontFamily: fh, fontSize: 11, color: C.bl,
            marginTop: 10, marginBottom: 4 }}>{line.replace('### ','')}</div>
          if (line.startsWith('- ') || line.startsWith('• ')) return <div key={i} style={{ color: C.tx, paddingLeft: 12 }}>• {line.slice(2)}</div>
          if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ color: C.tb, fontWeight: 700 }}>{line.slice(2,-2)}</div>
          if (line.trim() === '') return <div key={i} style={{ height: 8 }} />
          return <div key={i}>{line}</div>
        })}
      </div>
    </Panel>}
  </div>
}

// ─────────────────────────────────────────────
// ANALYZE TAB (Part 3)
// ─────────────────────────────────────────────
function AnalyzeTab() {
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)
  const [history, setHistory]   = useState([])
  const inputRef = useRef()

  async function search(ticker) {
    const tk = (ticker || query).toUpperCase().trim()
    if (!tk) return
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await fetch(`/api/analyze/${tk}`)
      if (!r.ok) throw new Error(`Could not analyze ${tk}`)
      const d = await r.json()
      setResult(d)
      setHistory(h => [tk, ...h.filter(x => x !== tk)].slice(0, 5))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return <div style={{ padding: '12px 14px', paddingBottom: 90, display: 'flex', flexDirection: 'column', gap: 12 }}>
    {/* Search */}
    <Panel style={{ padding: '12px 14px' }}>
      <div style={{ fontFamily: fh, fontSize: 11, color: C.gd, marginBottom: 10 }}>◈ MKW Analyzer</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="TICKER"
          style={{ flex: 1, background: C.p2, border: `1px solid ${C.b1}`, borderRadius: 8,
            padding: '10px 14px', color: C.tb, fontFamily: fh, fontSize: 14,
            letterSpacing: 2, textTransform: 'uppercase' }}
        />
        <button onClick={() => search()}
          style={{ background: `${C.gd}20`, border: `1px solid ${C.gd}40`, borderRadius: 8,
            padding: '10px 16px', color: C.gd, fontFamily: fh, fontSize: 11, cursor: 'pointer' }}>
          {loading ? '…' : 'ANALYZE'}
        </button>
      </div>
      {/* History */}
      {history.length > 0 && <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {history.map(tk => <button key={tk} onClick={() => { setQuery(tk); search(tk) }}
          style={{ background: C.p2, border: `1px solid ${C.b1}`, borderRadius: 6, padding: '4px 10px',
            color: C.td, fontFamily: fm, fontSize: 10, cursor: 'pointer' }}>{tk}</button>)}
      </div>}
    </Panel>

    {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>}
    {error && <Panel style={{ padding: 16, border: `1px solid ${C.r}20` }}>
      <div style={{ color: C.r, fontFamily: fb }}>{error}</div>
    </Panel>}

    {result && <>
      {/* Verdict */}
      <Panel style={{ padding: '14px 16px' }} glow={ZC[result.conv?.zone] || C.td}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: fh, fontSize: 20, fontWeight: 700, color: C.tb }}>{result.tk}</div>
            <div style={{ fontFamily: fb, fontSize: 12, color: C.td }}>{result.nm} · ${result.px}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontFamily: fm, fontWeight: 700, color: ZC[result.conv?.zone] || C.td,
              textShadow: `0 0 12px ${ZC[result.conv?.zone] || C.td}60` }}>
              {result.conv?.score}<span style={{ fontSize: 12, color: C.td }}>/22</span>
            </div>
            <Badge zone={result.conv?.zone} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <Pc v={result.dp} /><Pc v={result.wp} /><Pc v={result.mp} />
        </div>
      </Panel>

      <DetailOverview s={result} zc={ZC[result.conv?.zone] || C.td} />
      <ShortAnalysis s={result} />

      {/* Add to watchlist note */}
      <Panel style={{ padding: '12px 14px' }}>
        <div style={{ fontFamily: fb, fontSize: 11, color: C.td }}>
          To track this ticker, add it to the WATCHLIST array in backend/main.py and redeploy.
        </div>
      </Panel>
    </>}
  </div>
}

// ─────────────────────────────────────────────
// NEWS TAB (Part 9)
// ─────────────────────────────────────────────
function NewsTab() {
  const { data, loading, error } = useApi('/api/news', 15 * 60 * 1000)

  const fmt = (ts) => {
    if (!ts) return ''
    const d = new Date(ts * 1000)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const NewsItem = ({ item, highlight }) =>
    <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.b1}20`,
      borderLeft: highlight ? `3px solid ${C.gd}` : '3px solid transparent' }}>
      {highlight && <span style={{ fontSize: 8, fontFamily: fm, color: C.gd, letterSpacing: 1 }}>
        {item.ticker} ·{' '}
      </span>}
      <div style={{ fontFamily: fb, fontSize: 13, fontWeight: 600, color: C.tb, marginBottom: 3, lineHeight: 1.4 }}>
        {item.headline}
      </div>
      <div style={{ fontFamily: fb, fontSize: 10, color: C.td }}>{item.source} · {fmt(item.time)}</div>
      {item.summary && <div style={{ fontFamily: fb, fontSize: 11, color: C.tx, marginTop: 4, lineHeight: 1.5 }}>
        {item.summary.slice(0, 180)}{item.summary.length > 180 ? '…' : ''}
      </div>}
    </div>

  return <div style={{ paddingBottom: 90, display: 'flex', flexDirection: 'column' }}>
    {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>}

    {!loading && !error && data?.note && <Panel style={{ margin: 14, padding: 14, border: `1px solid ${C.a}20` }}>
      <div style={{ fontFamily: fb, color: C.a, fontSize: 12 }}>ℹ️ {data.note}</div>
    </Panel>}

    {data?.watchlistAlerts?.length > 0 && <>
      <div style={{ padding: '10px 14px', fontFamily: fh, fontSize: 10, color: C.gd }}>
        ⚡ WATCHLIST ALERTS
      </div>
      <Panel>
        {data.watchlistAlerts.map((item, i) => <NewsItem key={i} item={item} highlight />)}
      </Panel>
    </>}

    {data?.marketNews?.length > 0 && <>
      <div style={{ padding: '10px 14px', fontFamily: fh, fontSize: 10, color: C.bl, marginTop: 10 }}>
        ◈ MARKET & MACRO
      </div>
      <Panel>
        {data.marketNews.map((item, i) => <NewsItem key={i} item={item} />)}
      </Panel>
    </>}

    {!loading && !data && <div style={{ padding: 30, textAlign: 'center', color: C.td, fontFamily: fb }}>
      Configure FINNHUB_API_KEY to enable news feed
    </div>}
  </div>
}

// ─────────────────────────────────────────────
// RISK / DIVERGENCE TAB
// ─────────────────────────────────────────────
function RiskTab({ threatsData }) {
  const [sel, setSel] = useState(null)
  const threats = threatsData?.threats || []

  return <div style={{ padding: '12px 14px', paddingBottom: 90, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <Panel style={{ padding: '12px 14px', border: `1px solid ${C.r}20` }}>
      <div style={{ fontFamily: fh, fontSize: 11, color: C.r, marginBottom: 4 }}>Divergence Zone — Triple Exit</div>
      <div style={{ fontFamily: fb, fontSize: 11, color: C.td }}>Where all 3 frameworks say EXIT. Weinstein S3/S4 + Template failing + Kell Red Light.</div>
    </Panel>
    {threats.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: C.td, fontFamily: fb }}>Loading threat data…</div>}
    {threats.map(t =>
      <Panel key={t.tk} style={{ overflow: 'hidden', border: `1px solid ${sel?.tk === t.tk ? C.r : C.b1}30` }}>
        <div onClick={() => setSel(sel?.tk === t.tk ? null : t)} style={{ padding: '12px 14px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><span style={{ fontFamily: fh, fontSize: 14, fontWeight: 700, color: C.r }}>{t.tk}</span>
              <span style={{ fontSize: 10, fontFamily: fm, color: C.td, marginLeft: 6 }}>{t.type}</span></div>
            <span style={{ fontFamily: fm, fontSize: 12, fontWeight: 700, color: C.r,
              padding: '2px 8px', background: '#2a0812', borderRadius: 4 }}>{t.sc}/10</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            {t.sf > 0 && <span style={{ fontSize: 9, fontFamily: fm, color: C.r }}>Short: {t.sf}%</span>}
            <Pc v={t.mc} s={10} />
            {t.insiderSells > 0 && <span style={{ fontSize: 9, fontFamily: fm, color: C.a }}>Insider sells: {t.insiderSells}</span>}
          </div>
        </div>
        {sel?.tk === t.tk && <div style={{ padding: '0 14px 14px' }}>
          <div style={{ fontFamily: fb, fontSize: 11, color: C.tx, lineHeight: 1.8, marginBottom: 8 }}>{t.sum}</div>
          <div style={{ fontSize: 8, fontFamily: fm, color: C.r, letterSpacing: 1, marginBottom: 6 }}>EXIT SIGNALS</div>
          {(t.divSignals || []).map((e, i) =>
            <div key={i} style={{ fontSize: 10, fontFamily: fb, color: C.tx,
              padding: '3px 0 3px 10px', borderLeft: `2px solid ${C.r}40`, marginBottom: 3 }}>✗ {e}</div>
          )}
          {t.news?.length > 0 && <>
            <div style={{ fontSize: 8, fontFamily: fm, color: C.td, letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>RECENT NEWS</div>
            {t.news.map((n, i) =>
              <div key={i} style={{ fontFamily: fb, fontSize: 11, color: C.td, padding: '3px 0', lineHeight: 1.4 }}>{n.h}</div>
            )}
          </>}
        </div>}
      </Panel>
    )}
  </div>
}

// ─────────────────────────────────────────────
// MARKET BREADTH TAB
// ─────────────────────────────────────────────
function BreadthTab({ breadthData }) {
  const b = breadthData
  if (!b) return <LoadingScreen msg="Loading breadth data…" />

  let es = 0
  if (b.spxStage === 2) es++
  if (b.spxEma === 'above') es++
  if ((b.tplCount || 0) > 300) es++
  if ((b.vix || 25) < 20) es++
  if (b.sectors?.filter(s => s.p > 1).length >= 4) es++
  const ec = es >= 4 ? C.g : es >= 3 ? C.a : C.r

  return <div style={{ padding: '12px 14px', paddingBottom: 90, display: 'flex', flexDirection: 'column', gap: 12 }}>
    {/* Index cards */}
    <div style={{ display: 'flex', gap: 6 }}>
      {[['S&P 500', b.spx], ['NASDAQ', b.ndx], ['RUSSELL', b.rut]].map(([l, d]) =>
        d ? <Panel key={l} style={{ flex: 1, padding: '8px 10px' }}>
          <div style={{ fontSize: 7, color: C.td, fontFamily: fb, textTransform: 'uppercase', letterSpacing: 1 }}>{l}</div>
          <div style={{ fontSize: 15, fontFamily: fm, fontWeight: 700, color: C.tb, marginTop: 2 }}>{d.price?.toLocaleString()}</div>
          <Pc v={d.chg} s={10} />
          <div style={{ fontSize: 7, fontFamily: fm, color: C.td, marginTop: 2 }}>S{d.stage} · {d.ema20} 20e</div>
        </Panel> : null
      )}
    </div>

    {/* Position sizing guide */}
    <Panel style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: fh, fontSize: 10, color: C.tb }}>Position Sizing Guide</span>
        <span style={{ fontFamily: fm, fontSize: 20, fontWeight: 700, color: ec,
          textShadow: `0 0 12px ${ec}60` }}>{es}<span style={{ fontSize: 11, color: C.td }}>/5</span></span>
      </div>
      <div style={{ background: C.b1, height: 5, borderRadius: 3, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ width: `${(es/5)*100}%`, height: '100%', background: ec,
          boxShadow: `0 0 8px ${ec}60`, borderRadius: 3 }} />
      </div>
      <div style={{ fontFamily: fh, fontSize: 13, color: ec, marginBottom: 8 }}>
        {es >= 5 ? 'FULL SIZE' : es >= 3 ? 'STANDARD' : es >= 2 ? 'HALF SIZE' : 'CASH'}
      </div>
      {[
        ['S&P Stage 2', b.spxStage === 2], ['Kell Green', b.spxEma === 'above'],
        ['>300 TPL qualifiers', (b.tplCount||0) > 300], ['VIX < 20', (b.vix||25) < 20],
        ['≥4 hot sectors', (b.sectors||[]).filter(s => s.p > 1).length >= 4],
      ].map(([l, p]) =>
        <div key={l} style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: fb, marginBottom: 3 }}>
          <span style={{ color: p ? C.g : C.r }}>{p ? '✓' : '✗'}</span>
          <span style={{ color: C.td }}>{l}</span>
        </div>
      )}
    </Panel>

    {/* Sector grid */}
    {b.sectors?.length > 0 && <Panel style={{ padding: '12px 14px' }}>
      <div style={{ fontFamily: fh, fontSize: 10, color: C.tb, marginBottom: 8 }}>Sector Heatmap</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
        {[...b.sectors].sort((a, x) => x.p - a.p).map(s => {
          const c = s.p > .5 ? C.g : s.p > -.5 ? C.td : C.r
          return <div key={s.n} style={{ background: s.p > 0 ? `rgba(0,255,136,${Math.min(Math.abs(s.p)/4,.2)})` : `rgba(255,42,68,${Math.min(Math.abs(s.p)/4,.2)})`, borderRadius: 8, padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: 7, fontFamily: fb, color: C.td }}>{s.n}</div>
            <div style={{ fontSize: 13, fontFamily: fm, fontWeight: 700, color: c }}>{s.p > 0 ? '+' : ''}{s.p}%</div>
            <div style={{ fontSize: 7, fontFamily: fm, color: C.td }}>{s.stage}</div>
          </div>
        })}
      </div>
    </Panel>}
  </div>
}

// ─────────────────────────────────────────────
// JOURNAL TAB
// ─────────────────────────────────────────────
const JOURNAL_INIT = [
  { id:1, d:'03-17', tk:'TSEM', a:'BUY', st:'$140C 04/17', pnl:43.5, conv:'PRIMARY', n:'Full convergence VCP pop' },
  { id:2, d:'03-14', tk:'CF',   a:'BUY', st:'$125C 04/17', pnl:27.1, conv:'PARTIAL', n:'EMA crossback, RS<70' },
  { id:3, d:'03-10', tk:'NVDA', a:'STOP',st:'$950C 03/21', pnl:-100,conv:'EXIT',    n:'S3 transition — sold per MKW' },
]

function JournalTab() {
  const [journal, setJournal] = useState(JOURNAL_INIT)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ tk:'', a:'BUY', st:'', pnl:'', conv:'PRIMARY', n:'' })

  const w = journal.filter(j => j.pnl > 0).length
  const avg = journal.reduce((s,j) => s + j.pnl, 0) / (journal.length || 1)

  const add = () => {
    if (!form.tk) return
    setJournal(j => [{ id: Date.now(), d: new Date().toLocaleDateString('en-US',{month:'2-digit',day:'2-digit'}),
      ...form, pnl: parseFloat(form.pnl)||0 }, ...j])
    setShowAdd(false)
    setForm({ tk:'', a:'BUY', st:'', pnl:'', conv:'PRIMARY', n:'' })
  }

  return <div style={{ padding: '12px 14px', paddingBottom: 90, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', gap: 6 }}>
      {[['Trades', journal.length, C.tb], ['Win%', `${((w/(journal.length||1))*100).toFixed(0)}%`, w/(journal.length||1)>=.5?C.g:C.r], ['Avg', `${avg>=0?'+':''}${avg.toFixed(0)}%`, avg>=0?C.g:C.r]].map(([l,v,c]) =>
        <Panel key={l} style={{ flex:1, padding: '8px 10px' }}>
          <div style={{ fontSize:7, color:C.td, fontFamily:fb, textTransform:'uppercase', letterSpacing:1 }}>{l}</div>
          <div style={{ fontSize:17, fontFamily:fm, fontWeight:700, color:c, marginTop:2 }}>{v}</div>
        </Panel>
      )}
    </div>

    <button onClick={() => setShowAdd(!showAdd)} style={{ background:`${C.gd}15`, border:`1px solid ${C.gd}30`, borderRadius:8, padding:'10px', color:C.gd, fontFamily:fh, fontSize:10, cursor:'pointer' }}>
      + ADD TRADE
    </button>

    {showAdd && <Panel style={{ padding:'14px' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {[['Ticker', 'tk'], ['Strike/Expiry', 'st'], ['P&L%', 'pnl'], ['Notes', 'n']].map(([l, k]) =>
          <div key={k}>
            <div style={{ fontSize:8, color:C.td, fontFamily:fm, marginBottom:3 }}>{l}</div>
            <input value={form[k]} onChange={e => setForm(f => ({...f, [k]: e.target.value}))}
              style={{ width:'100%', background:C.p2, border:`1px solid ${C.b1}`, borderRadius:6, padding:'8px 10px', color:C.tb, fontFamily:fm, fontSize:12 }} />
          </div>
        )}
        <div style={{ display:'flex', gap:6 }}>
          {[['BUY','BUY'],['SELL','SELL'],['STOP','STOP']].map(([l,v]) =>
            <button key={v} onClick={() => setForm(f=>({...f, a:v}))} style={{ flex:1, padding:'7px', borderRadius:6,
              background: form.a === v ? `${C.gd}20` : C.p2, border:`1px solid ${form.a===v?C.gd:C.b1}`,
              color: form.a===v?C.gd:C.td, fontFamily:fm, fontSize:10, cursor:'pointer' }}>{l}</button>
          )}
        </div>
        <button onClick={add} style={{ background:`${C.g}20`, border:`1px solid ${C.g}30`, borderRadius:8, padding:'10px', color:C.g, fontFamily:fh, fontSize:10, cursor:'pointer' }}>SAVE TRADE</button>
      </div>
    </Panel>}

    {journal.map(j =>
      <Panel key={j.id} style={{ padding:'10px 12px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div><span style={{ fontFamily:fh, fontSize:13, fontWeight:700, color:C.tb }}>{j.tk}</span>
            <span style={{ fontSize:9, fontFamily:fm, color:j.a==='BUY'?C.g:j.a==='STOP'?C.r:C.a, marginLeft:6, fontWeight:600 }}>{j.a}</span></div>
          <span style={{ fontFamily:fm, fontSize:13, fontWeight:700, color:j.pnl>=0?C.g:C.r }}>{j.pnl>=0?'+':''}{j.pnl}%</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
          <span style={{ fontSize:9, fontFamily:fm, color:C.bl }}>{j.st}</span>
          <span style={{ fontSize:7, fontFamily:fm, padding:'1px 5px', borderRadius:3,
            color:j.conv==='PRIMARY'?C.gd:j.conv==='EXIT'?C.r:C.a,
            background:(j.conv==='PRIMARY'?C.gd:j.conv==='EXIT'?C.r:C.a)+'15' }}>{j.conv}</span>
        </div>
        <div style={{ fontSize:9, fontFamily:fb, color:C.td, marginTop:4 }}>{j.d} · {j.n}</div>
      </Panel>
    )}
  </div>
}

// ─────────────────────────────────────────────
// MORE SHEET (overlay)
// ─────────────────────────────────────────────
const MORE_PAGES = [
  { id: 'analyze', icon: '◈', label: 'Analyze', color: C.gd },
  { id: 'news',    icon: '◉', label: 'News',    color: C.bl },
  { id: 'risk',    icon: '⚠', label: 'Risk',    color: C.r  },
  { id: 'breadth', icon: '◎', label: 'Breadth', color: C.pu },
  { id: 'journal', icon: '⊞', label: 'Journal', color: C.a  },
]

function MoreSheet({ open, onClose, onPage, activeMore }) {
  if (!open) return null
  return <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
    <div style={{ position: 'fixed', bottom: 56, left: 0, right: 0, background: C.p1,
      borderTop: `1px solid ${C.b1}`, borderRadius: '16px 16px 0 0', zIndex: 41,
      padding: '16px 20px 20px', animation: 'slideUp .25s ease' }}>
      <div style={{ width: 36, height: 4, background: C.b2, borderRadius: 2, margin: '0 auto 16px' }} />
      <div style={{ fontFamily: fh, fontSize: 11, color: C.td, letterSpacing: 1, marginBottom: 12 }}>MORE SCREENS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
        {MORE_PAGES.map(p =>
          <button key={p.id} onClick={() => { onPage(p.id); onClose() }}
            className="tab-bounce"
            style={{ background: activeMore === p.id ? `${p.color}20` : C.p2,
              border: `1px solid ${activeMore === p.id ? p.color : C.b1}`,
              borderRadius: 10, padding: '10px 6px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 20, color: p.color }}>{p.icon}</span>
            <span style={{ fontFamily: fb, fontSize: 9, color: p.color }}>{p.label}</span>
          </button>
        )}
      </div>
    </div>
  </>
}

// ─────────────────────────────────────────────
// LOADING / ERROR
// ─────────────────────────────────────────────
function LoadingScreen({ msg }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', gap: 16, color: C.td, fontFamily: fb }}>
    <Spinner />
    <span style={{ fontSize: 13 }}>{msg || 'Loading…'}</span>
  </div>
}

function LastUpdated({ ts }) {
  const [ago, setAgo] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setAgo(ts ? Math.round((Date.now() - ts) / 60000) : 0), 30000)
    return () => clearInterval(t)
  }, [ts])
  if (!ts) return null
  return <span style={{ fontSize: 8, fontFamily: fm, color: C.td }}>
    {ago === 0 ? 'live' : `${ago}m ago`}
  </span>
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
const MAIN_TABS = [
  { id: 'home',   icon: '◈', label: 'Home'  },
  { id: 'watch',  icon: '◉', label: 'Watch' },
  { id: 'plays',  icon: '✦', label: 'Plays' },
  { id: 'brief',  icon: '◎', label: 'Brief' },
  { id: 'more',   icon: '⊞', label: 'More'  },
]

export default function App() {
  const [tab,       setTab]       = useState('home')
  const [moreOpen,  setMoreOpen]  = useState(false)
  const [morePage,  setMorePage]  = useState(null)
  const [detail,    setDetail]    = useState(null)
  const [time,      setTime]      = useState(new Date())

  const { data: watchlistData, loading: wlLoad, ts: wlTs } = useApi('/api/watchlist')
  const { data: breadthData,   loading: brLoad             } = useApi('/api/breadth')
  const { data: threatsData,   loading: thLoad             } = useApi('/api/threats')

  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(i)
  }, [])

  const convCount = (watchlistData?.stocks || []).filter(s => s.conv?.zone === 'CONVERGENCE').length

  const onSelect = (s) => { setDetail(s); setMoreOpen(false) }
  const onBack   = () => setDetail(null)

  const handleTab = (id) => {
    if (id === 'more') {
      setMoreOpen(m => !m)
    } else {
      setTab(id); setDetail(null); setMoreOpen(false); setMorePage(null)
    }
  }

  const currentMore = morePage

  return <div style={{ fontFamily: fm, background: C.bg, color: C.tx, height: '100vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <style>{CSS}</style>
    <div className="scanline" />

    {/* Status bar */}
    <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', borderBottom: `1px solid ${C.b1}`, background: C.p1, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: fh, fontSize: 15, fontWeight: 900, color: C.gd,
          textShadow: `0 0 12px ${C.gd}60`, letterSpacing: 1 }}>MKW</span>
        {convCount > 0 && <span style={{ fontSize: 8, fontFamily: fm, padding: '2px 7px',
          borderRadius: 10, background: `${C.gd}15`, color: C.gd, border: `1px solid ${C.gd}30`,
          animation: 'pulse 2s infinite' }}>⚡{convCount}</span>}
        {(wlLoad || brLoad) && <Spinner />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LastUpdated ts={wlTs} />
        <span style={{ fontSize: 9, fontFamily: fm, color: C.td }}>
          {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>

    {/* Main content */}
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
      {/* Detail view overlay */}
      {detail && <DetailView stock={detail} onBack={onBack} breadth={breadthData} />}

      {/* Main tabs (hidden when detail is open) */}
      {!detail && <>
        {tab === 'home'  && <HomeTab watchlistData={watchlistData} breadthData={breadthData} onSelect={onSelect} />}
        {tab === 'watch' && <WatchTab watchlistData={watchlistData} onSelect={onSelect} />}
        {tab === 'plays' && <PlaysTab watchlistData={watchlistData} breadthData={breadthData} />}
        {tab === 'brief' && <BriefTab />}

        {/* More pages */}
        {currentMore === 'analyze' && <AnalyzeTab />}
        {currentMore === 'news'    && <NewsTab />}
        {currentMore === 'risk'    && <RiskTab threatsData={threatsData} />}
        {currentMore === 'breadth' && <BreadthTab breadthData={breadthData} />}
        {currentMore === 'journal' && <JournalTab />}

        {/* Empty state if more tab active but no page selected */}
        {tab === 'more' && !currentMore && null}
      </>}
    </div>

    {/* More sheet */}
    <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)}
      onPage={(p) => { setMorePage(p); setTab('more') }} activeMore={currentMore} />

    {/* Bottom tab bar */}
    <div style={{ display: 'flex', justifyContent: 'space-around', padding: '6px 0 20px',
      background: C.p1, borderTop: `1px solid ${C.b1}`, flexShrink: 0, zIndex: 30 }}>
      {MAIN_TABS.map(t => {
        const isActive = t.id === 'more' ? moreOpen || tab === 'more' : tab === t.id && !moreOpen
        return <button key={t.id} onClick={() => handleTab(t.id)} className="tab-bounce"
          style={{ background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '4px 16px', color: isActive ? C.gd : C.td, transition: 'color .15s' }}>
          <span style={{ fontSize: 20, textShadow: isActive ? `0 0 8px ${C.gd}60` : 'none' }}>{t.icon}</span>
          <span style={{ fontSize: 8, fontFamily: fb, fontWeight: isActive ? 700 : 400 }}>{t.label}</span>
        </button>
      })}
    </div>
  </div>
}
