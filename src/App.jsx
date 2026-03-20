import { useState, useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────
// iOS DESIGN SYSTEM
// ─────────────────────────────────────────────
const C = {
  bg:  '#000000',
  p1:  '#1C1C1E',
  p2:  '#2C2C2E',
  p3:  '#3A3A3C',
  b1:  '#38383A',
  b2:  '#48484A',
  tb:  '#FFFFFF',
  tx:  'rgba(235,235,245,0.6)',
  td:  'rgba(235,235,245,0.18)',
  g:   '#30D158',
  r:   '#FF453A',
  a:   '#FF9F0A',
  bl:  '#0A84FF',
  pu:  '#BF5AF2',
  em:  '#FF6B35',
  gd:  '#FF9F0A',
}
const fs = `-apple-system,"SF Pro Display","SF Pro Text",system-ui,sans-serif`
const fm = `"SF Mono",ui-monospace,Menlo,monospace`
const ZC  = { CONVERGENCE: C.gd, SECONDARY: C.bl, BUILDING: C.pu, WATCH: 'rgba(235,235,245,0.28)' }
const SZC = { SHORT_CONVERGENCE: C.em, SHORT_SECONDARY: '#FF8C42', SHORT_WATCH: 'rgba(235,235,245,0.28)', NEUTRAL: 'rgba(235,235,245,0.18)' }

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
  ::-webkit-scrollbar{display:none}
  html,body,#root{height:100%;width:100%;background:#000;overflow:hidden}
  body{overscroll-behavior:none}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}
  button{-webkit-tap-highlight-color:transparent}
  input{outline:none;-webkit-appearance:none}
  .press:active{opacity:0.6;transform:scale(0.98)}
`

// ─────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────
const Pct = ({ v, size = 15 }) =>
  v == null
    ? <span style={{ color: C.td, fontSize: size, fontFamily: fm }}>—</span>
    : <span style={{ color: v >= 0 ? C.g : C.r, fontSize: size, fontFamily: fm, fontWeight: 600 }}>
        {v >= 0 ? '+' : ''}{v.toFixed(2)}%
      </span>

const Dot = ({ ok, size = 8 }) =>
  <div style={{ width: size, height: size, borderRadius: '50%',
    background: ok === 'bull' ? C.g : ok === 'bear' ? C.r : C.a,
    flexShrink: 0 }} />

const ScoreBar = ({ score, max = 18, color }) => {
  const pct = Math.min(100, (score / max) * 100)
  const c = color || (pct >= 94 ? C.gd : pct >= 67 ? C.bl : pct >= 44 ? C.pu : C.td)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 48, height: 3, background: C.b1, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 13, fontFamily: fm, color: c, fontWeight: 600 }}>{score}</span>
    </div>
  )
}

const Pill = ({ zone, short }) => {
  const colors = short ? SZC : ZC
  const c = colors[zone] || C.td
  const labels = {
    CONVERGENCE: 'CONV', SECONDARY: 'SEC', BUILDING: 'BUILD', WATCH: 'WATCH',
    SHORT_CONVERGENCE: 'S·CONV', SHORT_SECONDARY: 'S·SEC', SHORT_WATCH: 'S·WATCH', NEUTRAL: '—',
  }
  return (
    <span style={{
      fontSize: 11, fontFamily: fm, fontWeight: 600,
      padding: '3px 8px', borderRadius: 20,
      background: c + '22', color: c,
      letterSpacing: 0.3,
    }}>
      {labels[zone] || zone}
    </span>
  )
}

const Card = ({ children, style = {}, onPress }) =>
  <div className={onPress ? 'press' : ''} onClick={onPress}
    style={{ background: C.p1, borderRadius: 12, overflow: 'hidden', ...style }}>
    {children}
  </div>

const Sep = () => <div style={{ height: 1, background: C.b1, marginLeft: 16 }} />

const SectionHeader = ({ label, right }) =>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px 6px', fontFamily: fs }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: C.tx, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    {right && <span style={{ fontSize: 12, color: C.bl }}>{right}</span>}
  </div>

const Row = ({ label, value, valueColor, mono }) =>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', fontFamily: fs }}>
    <span style={{ fontSize: 15, color: C.tx }}>{label}</span>
    <span style={{ fontSize: 15, color: valueColor || C.tb, fontFamily: mono ? fm : fs, fontWeight: 500 }}>{value}</span>
  </div>

const Spinner = () =>
  <div style={{ width: 18, height: 18, border: `2px solid ${C.b2}`,
    borderTopColor: C.bl, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />

const EmaRow = ({ kell }) =>
  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
    <Dot ok={kell?.emaD} size={7} />
    <Dot ok={kell?.emaW} size={7} />
    <Dot ok={kell?.emaM} size={7} />
  </div>

// ─────────────────────────────────────────────
// API HOOK
// ─────────────────────────────────────────────
function useApi(endpoint, ttlMs = 5 * 60 * 1000) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [ts, setTs]           = useState(null)
  const timerRef = useRef(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const r = await fetch(endpoint)
      if (!r.ok) throw new Error(`${r.status}`)
      const d = await r.json()
      setData(d); setTs(Date.now()); setError(null)
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
// CHECKLIST DATA
// ─────────────────────────────────────────────
const CHECKLIST_SECTIONS = [
  { id: 'market', label: 'Market Environment', color: C.g, items: [
    { id: 'm1', label: 'S&P 500 in Weinstein Stage 2', critical: true, autoKey: 'spxStage2' },
    { id: 'm2', label: 'Kell Green Light — S&P above 20 EMA', critical: true, autoKey: 'kellGreen' },
    { id: 'm3', label: 'Breadth: 500+ names passing Template', critical: true, autoKey: 'breadthOk' },
  ]},
  { id: 'trend', label: 'Stage & Trend', color: C.gd, items: [
    { id: 't1', label: 'Weinstein Stage 2A confirmed', critical: true, autoKey: 'stage2A' },
    { id: 't2', label: 'Minervini Template 8/8', critical: true, autoKey: 'tpl8' },
    { id: 't3', label: 'RS Rating ≥ 80 (min 70)', critical: true, autoKey: 'rs80' },
    { id: 't4', label: 'Kell EMA alignment daily + weekly', critical: true, autoKey: 'emaAligned' },
    { id: 't5', label: 'Leading industry group', critical: false },
  ]},
  { id: 'entry', label: 'Entry Setup & Timing', color: C.bl, items: [
    { id: 'e1', label: 'VCP: 2+ tightening contractions', critical: true, autoKey: 'vcp2ct' },
    { id: 'e2', label: 'Volume dry-up < 60% of 50d avg', critical: false, autoKey: 'volDryup' },
    { id: 'e3', label: 'Kell phase actionable', critical: true, autoKey: 'kellPhaseOk' },
    { id: 'e4', label: 'Breakout volume ≥ 1.5x average', critical: true },
    { id: 'e5', label: 'Entry within 5% of pivot', critical: false, autoKey: 'nearPivot' },
  ]},
  { id: 'options', label: 'Options Filters', color: C.pu, items: [
    { id: 'o1', label: 'IV Rank < 50 (ideal < 30)', critical: true },
    { id: 'o2', label: 'DTE: Swing 30-60d, LEAP 180-365d', critical: true },
    { id: 'o3', label: 'Strike: Swing delta 0.50-0.65', critical: false },
    { id: 'o4', label: 'Bid-ask spread < 10% of mid', critical: false },
    { id: 'o5', label: 'Open interest ≥ 100 on strike', critical: false },
    { id: 'o6', label: 'No earnings within DTE window', critical: true },
  ]},
  { id: 'risk', label: 'Risk Management', color: C.r, items: [
    { id: 'r1', label: 'Stop-loss defined before entering', critical: true },
    { id: 'r2', label: 'Max risk per trade 1-2% of portfolio', critical: true },
    { id: 'r3', label: 'Total portfolio heat < 10%', critical: true },
    { id: 'r4', label: 'Risk/reward ratio ≥ 3:1', critical: true },
    { id: 'r5', label: 'Scaling plan defined', critical: false },
    { id: 'r6', label: 'Exit triggers defined', critical: true },
  ]},
]

const NO_GO_LIST = [
  'Market in Stage 3 or 4', 'VIX above 30', 'RS below 70',
  'No VCP or defined entry', 'IV Rank above 70', 'DTE below 21',
  "Can't define stop level", 'Portfolio heat above 10%',
  'Chasing — 5%+ above pivot', 'Earnings within 2 weeks of expiry',
]

function ChecklistPanel({ stock, breadth }) {
  const totalItems = CHECKLIST_SECTIONS.reduce((a, s) => a + s.items.length, 0)
  const [checked, setChecked] = useState({})

  const autoChecks = stock && breadth ? {
    spxStage2:   breadth.spxStage === 2,
    kellGreen:   breadth.spxEma === 'above',
    breadthOk:   (breadth.tplCount || 0) > 300,
    stage2A:     stock.wein?.stage === '2A',
    tpl8:        stock.min?.tplScore === 8,
    rs80:        (stock.min?.rs || 0) >= 80,
    emaAligned:  stock.kell?.emaD === 'bull' && stock.kell?.emaW === 'bull',
    vcp2ct:      (stock.vcp?.count || 0) >= 2,
    volDryup:    stock.vcp?.volDryup || false,
    kellPhaseOk: ['EMA Crossback','Pop','Base n Break'].includes(stock.kell?.phase),
    nearPivot:   stock.vcp?.pivot ? Math.abs(stock.px / stock.vcp.pivot - 1) <= 0.05 : false,
  } : {}

  const allItems = CHECKLIST_SECTIONS.flatMap(s => s.items)
  const passCount = allItems.filter(i => i.autoKey ? autoChecks[i.autoKey] : checked[i.id]).length
  const pct = Math.round((passCount / totalItems) * 100)
  const [verdictLabel, verdictColor] =
    pct >= 100 ? ['All Clear — Execute', C.g] :
    pct >= 85  ? ['Near Ready', C.a] :
                 ['In Progress', C.td]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 20 }}>
      {/* Progress */}
      <Card style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontFamily: fs, fontSize: 17, fontWeight: 600, color: C.tb }}>Pre-Trade Checklist</span>
          <span style={{ fontFamily: fm, fontSize: 17, fontWeight: 700, color: verdictColor }}>{passCount}/{totalItems}</span>
        </div>
        <div style={{ background: C.p2, height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: verdictColor, borderRadius: 2, transition: 'width .4s ease' }} />
        </div>
        <div style={{ fontFamily: fs, fontSize: 13, color: verdictColor, fontWeight: 500 }}>{verdictLabel}</div>
      </Card>

      {CHECKLIST_SECTIONS.map(sec => {
        const secPass = sec.items.filter(item => item.autoKey ? autoChecks[item.autoKey] : checked[item.id]).length
        return (
          <div key={sec.id}>
            <SectionHeader label={sec.label} right={`${secPass}/${sec.items.length}`} />
            <Card>
              {sec.items.map((item, i) => {
                const isAuto = !!item.autoKey
                const passed = isAuto ? autoChecks[item.autoKey] : checked[item.id]
                return (
                  <div key={item.id}>
                    <div className="press" onClick={() => {
                      if (!isAuto) setChecked(p => ({ ...p, [item.id]: !p[item.id] }))
                    }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: passed ? sec.color : 'transparent',
                        border: `2px solid ${passed ? sec.color : C.b2}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {passed && <span style={{ color: '#000', fontSize: 12, fontWeight: 700 }}>✓</span>}
                      </div>
                      <span style={{ fontFamily: fs, fontSize: 15, color: passed ? C.tb : C.tx, flex: 1 }}>{item.label}</span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {isAuto && <span style={{ fontSize: 11, fontFamily: fm, color: C.td }}>AUTO</span>}
                        <span style={{ fontSize: 11, fontFamily: fm, color: item.critical ? C.r : C.a }}>
                          {item.critical ? '!' : '·'}
                        </span>
                      </div>
                    </div>
                    {i < sec.items.length - 1 && <Sep />}
                  </div>
                )
              })}
            </Card>
          </div>
        )
      })}

      <div>
        <SectionHeader label="Instant No-Go" />
        <Card>
          {NO_GO_LIST.map((item, i) => (
            <div key={i}>
              <div style={{ padding: '11px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ color: C.r, fontSize: 13 }}>✕</span>
                <span style={{ fontFamily: fs, fontSize: 15, color: C.tx }}>{item}</span>
              </div>
              {i < NO_GO_LIST.length - 1 && <Sep />}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// DETAIL VIEW
// ─────────────────────────────────────────────
function DetailView({ stock: s, onBack, breadth }) {
  const [tab, setTab] = useState('overview')
  if (!s) return null
  const zc = ZC[s.conv?.zone] || C.td

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn .2s ease' }}>
      {/* Nav */}
      <div style={{ padding: '12px 16px 0', background: C.bg, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.bl,
            fontFamily: fs, fontSize: 17, cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
            ‹ Back
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: fs, fontSize: 28, fontWeight: 700, color: C.tb, letterSpacing: -0.5 }}>{s.tk}</div>
            <div style={{ fontFamily: fs, fontSize: 13, color: C.tx, marginTop: 2 }}>{s.nm}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: fm, fontSize: 28, fontWeight: 700, color: zc }}>{s.conv?.score}<span style={{ fontSize: 15, color: C.tx, fontWeight: 400 }}>/18</span></div>
            <Pill zone={s.conv?.zone} />
          </div>
        </div>
        {/* Segmented */}
        <div style={{ display: 'flex', gap: 2, background: C.p2, borderRadius: 9, padding: 2, marginBottom: 0 }}>
          {['overview','checklist','short'].map(t =>
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '6px 4px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: tab === t ? C.p3 : 'transparent',
              color: tab === t ? C.tb : C.tx,
              fontFamily: fs, fontSize: 13, fontWeight: tab === t ? 600 : 400,
              transition: 'all .15s'
            }}>
              {t === 'short' ? 'Short' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px', paddingBottom: 32 }}>
        {tab === 'overview'  && <DetailOverview s={s} zc={zc} />}
        {tab === 'checklist' && <ChecklistPanel stock={s} breadth={breadth} />}
        {tab === 'short'     && <ShortAnalysis s={s} />}
      </div>
    </div>
  )
}

function DetailOverview({ s, zc }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Price row */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['Day', s.dp], ['Week', s.wp], ['Month', s.mp]].map(([l, v]) => (
          <Card key={l} style={{ flex: 1, padding: '12px 14px' }}>
            <div style={{ fontFamily: fs, fontSize: 12, color: C.tx, marginBottom: 6 }}>{l}</div>
            <Pct v={v} size={17} />
          </Card>
        ))}
      </div>

      {/* Frameworks */}
      <div>
        <SectionHeader label="Analysis" />
        <Card>
          {[
            { name: 'Weinstein', color: C.g,
              lines: [`Stage ${s.wein?.stage} — 150d MA $${s.wein?.ma150}`,
                      `${s.wein?.slopeRising ? `Rising ${s.wein?.slopeWeeks}wk` : 'Flat/declining'} · ${s.wein?.pctFromMA > 0 ? '+' : ''}${s.wein?.pctFromMA}% from MA`] },
            { name: 'Minervini', color: C.pu,
              lines: [`Template ${s.min?.tplScore}/8 · RS ${s.min?.rs}`,
                      `${s.vcp?.count ? `VCP ${s.vcp.count}ct (${s.vcp.depths})` : 'No VCP'} · EPS ${s.min?.eps > 0 ? '+' : ''}${s.min?.eps}%`] },
            { name: 'Kell', color: C.bl,
              lines: [`${s.kell?.phase} · ${s.kell?.light} light`,
                      `EMA D/W/M: ${s.kell?.emaD}/${s.kell?.emaW}/${s.kell?.emaM}`] },
          ].map((fw, i, arr) => (
            <div key={fw.name}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 3, borderRadius: 2, background: fw.color, alignSelf: 'stretch', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: fs, fontSize: 13, color: fw.color, fontWeight: 600, marginBottom: 4 }}>{fw.name}</div>
                    {fw.lines.map((l, j) =>
                      <div key={j} style={{ fontFamily: fs, fontSize: 14, color: j === 0 ? C.tb : C.tx, marginBottom: 2 }}>{l}</div>
                    )}
                  </div>
                </div>
              </div>
              {i < arr.length - 1 && <Sep />}
            </div>
          ))}
        </Card>
      </div>

      {/* Setup */}
      <div>
        <SectionHeader label="Setup" />
        <Card style={{ padding: 16 }}>
          <div style={{ fontFamily: fs, fontSize: 15, color: C.tx, lineHeight: 1.6 }}>{s.setup}</div>
        </Card>
      </div>

      {/* Options play */}
      {s.optPlay && !['No play','Wait for phase confirmation','Wait for breakout confirmation'].includes(s.optPlay) && (
        <div>
          <SectionHeader label="Options Play" />
          <Card style={{ padding: 16 }}>
            <div style={{ fontFamily: fm, fontSize: 15, color: C.bl }}>{s.optPlay}</div>
          </Card>
        </div>
      )}

      {/* Flags */}
      {s.flags?.length > 0 && (
        <div>
          <SectionHeader label="Flags" />
          <Card>
            {s.flags.map((f, i, arr) => (
              <div key={i}>
                <div style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ color: C.a, fontSize: 14 }}>⚠</span>
                  <span style={{ fontFamily: fs, fontSize: 15, color: C.tx }}>{f}</span>
                </div>
                {i < arr.length - 1 && <Sep />}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Template */}
      {s.min?.tpl && (
        <div>
          <SectionHeader label="Minervini Template" />
          <Card>
            {[
              'Price > 50-day MA', 'Price > 150-day MA', 'Price > 200-day MA',
              '50d MA > 150d MA', '150d MA > 200d MA', '200d MA trending up',
              'Within 25% of 52-week high', 'RS Rating ≥ 70',
            ].map((label, i) => {
              const ok = s.min.tpl[i]
              return (
                <div key={i}>
                  <div style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ color: ok ? C.g : C.r, fontSize: 15, fontWeight: 700 }}>{ok ? '✓' : '✕'}</span>
                    <span style={{ fontFamily: fs, fontSize: 15, color: ok ? C.tb : C.tx }}>{label}</span>
                  </div>
                  {i < 7 && <Sep />}
                </div>
              )
            })}
          </Card>
        </div>
      )}
    </div>
  )
}

function ShortAnalysis({ s }) {
  const sc = s.shortConv
  const col = SZC[sc?.zone] || C.td
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Pill zone={sc?.zone} short />
          <div style={{ fontFamily: fm, fontSize: 24, fontWeight: 700, color: col }}>
            {sc?.score}<span style={{ fontSize: 14, color: C.tx, fontWeight: 400 }}>/22</span>
          </div>
        </div>
        <ScoreBar score={sc?.score || 0} max={22} color={col} />
      </Card>
      <div>
        <SectionHeader label="Inverse Template" />
        <Card>
          {['Price < 50d MA','Price < 150d MA','Price < 200d MA','50d MA < 150d MA',
            '150d MA < 200d MA','200d MA declining','≥25% below 52-week high','RS ≤ 30'].map((label, i) => {
            const ok = sc?.invTpl?.[i]
            return (
              <div key={i}>
                <div style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ color: ok ? C.em : C.td, fontSize: 15 }}>{ok ? '✓' : '○'}</span>
                  <span style={{ fontFamily: fs, fontSize: 15, color: ok ? C.tb : C.tx }}>{label}</span>
                </div>
                {i < 7 && <Sep />}
              </div>
            )
          })}
        </Card>
      </div>
      <Card style={{ padding: 16 }}>
        <div style={{ fontFamily: fs, fontSize: 15, color: C.tx, lineHeight: 1.6 }}>
          Stage {s.wein?.stage} · RS {s.min?.rs} · {s.kell?.phase}<br />
          {sc?.zone === 'SHORT_CONVERGENCE' && <span style={{ color: C.em }}>Short convergence — all 3 frameworks bearish. Consider put play.</span>}
          {sc?.zone === 'SHORT_SECONDARY'   && <span style={{ color: '#FF8C42' }}>Secondary short — building bearish case.</span>}
          {(sc?.zone === 'SHORT_WATCH' || sc?.zone === 'NEUTRAL') && <span>No short setup confirmed.</span>}
        </div>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────
// HOME TAB
// ─────────────────────────────────────────────
function HomeTab({ watchlistData, breadthData, onSelect }) {
  if (!watchlistData || !breadthData) return <LoadingScreen msg="Loading market data…" />
  const stocks = watchlistData.stocks || []
  const b = breadthData
  const conv      = stocks.filter(s => s.conv?.zone === 'CONVERGENCE')
  const sec       = stocks.filter(s => s.conv?.zone === 'SECONDARY')
  const shortConv = stocks.filter(s => ['SHORT_CONVERGENCE','SHORT_SECONDARY'].includes(s.shortConv?.zone))
  const wOk = b.spxStage === 2
  const kOk = b.spxEma === 'above'
  const mOk = (b.tplCount || 0) > 200

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Market status */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontFamily: fs, fontSize: 13, fontWeight: 600, color: C.tx,
          textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Market Environment</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            ['W', `Stage ${b.spxStage}`, wOk],
            ['K', `${b.spxEma === 'above' ? 'Above' : 'Below'} EMA`, kOk],
            ['M', `${b.tplCount || 0} TPL`, mOk],
          ].map(([l, v, ok]) => (
            <Card key={l} style={{ flex: 1, padding: '14px 12px' }}>
              <div style={{ fontFamily: fs, fontSize: 11, fontWeight: 600, color: ok ? C.g : C.r,
                marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{l}</div>
              <div style={{ fontFamily: fs, fontSize: 14, fontWeight: 600, color: C.tb }}>{v}</div>
              <div style={{ fontSize: 18, marginTop: 6 }}>{ok ? '✅' : '⚠️'}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0' }}>
        {[
          ['VIX', b.vix?.toFixed(1) || '—', b.vix > 25 ? C.r : b.vix > 20 ? C.a : C.g],
          ['Conv', conv.length, conv.length > 0 ? C.gd : C.tx],
          ['Sec', sec.length, sec.length > 0 ? C.bl : C.tx],
        ].map(([l, v, c]) => (
          <Card key={l} style={{ flex: 1, padding: '12px 14px' }}>
            <div style={{ fontFamily: fs, fontSize: 12, color: C.tx, marginBottom: 4 }}>{l}</div>
            <div style={{ fontFamily: fm, fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
          </Card>
        ))}
      </div>

      {/* Convergence */}
      {conv.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <SectionHeader label="Full Convergence" />
          <Card>
            {conv.map((s, i) => (
              <div key={s.tk}>
                <div className="press" onClick={() => onSelect(s)}
                  style={{ padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontFamily: fs, fontSize: 20, fontWeight: 700, color: C.tb }}>{s.tk}</span>
                      <span style={{ fontFamily: fs, fontSize: 14, color: C.tx, marginLeft: 8 }}>${s.px}</span>
                    </div>
                    <ScoreBar score={s.conv.score} max={18} color={C.gd} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Pct v={s.dp} size={14} />
                    <Pct v={s.wp} size={14} />
                    <Pct v={s.mp} size={14} />
                    <EmaRow kell={s.kell} />
                    <span style={{ fontFamily: fs, fontSize: 13, color: C.tx, marginLeft: 'auto' }}>{s.kell?.phase}</span>
                  </div>
                </div>
                {i < conv.length - 1 && <Sep />}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Secondary */}
      {sec.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <SectionHeader label="Secondary" />
          <Card>
            {sec.map((s, i) => (
              <div key={s.tk}>
                <div className="press" onClick={() => onSelect(s)}
                  style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <div>
                    <span style={{ fontFamily: fs, fontSize: 20, fontWeight: 700, color: C.tb }}>{s.tk}</span>
                    <span style={{ fontFamily: fs, fontSize: 13, color: C.tx, marginLeft: 8 }}>Base #{s.kell?.base}</span>
                    <div style={{ marginTop: 4, display: 'flex', gap: 10 }}>
                      <Pct v={s.dp} size={13} />
                      <Pct v={s.wp} size={13} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <ScoreBar score={s.conv.score} max={18} color={C.bl} />
                    <span style={{ fontFamily: fs, fontSize: 12, color: C.tx }}>{s.kell?.phase}</span>
                  </div>
                </div>
                {i < sec.length - 1 && <Sep />}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Short setups */}
      {shortConv.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <SectionHeader label="Short Setups" />
          <Card>
            {shortConv.map((s, i) => (
              <div key={s.tk}>
                <div className="press" onClick={() => onSelect(s)}
                  style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <div>
                    <span style={{ fontFamily: fs, fontSize: 20, fontWeight: 700, color: C.r }}>{s.tk}</span>
                    <span style={{ fontFamily: fs, fontSize: 13, color: C.tx, marginLeft: 8 }}>Stage {s.wein?.stage}</span>
                  </div>
                  <ScoreBar score={s.shortConv?.score || 0} max={22} color={C.em} />
                </div>
                {i < shortConv.length - 1 && <Sep />}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Empty state */}
      {conv.length === 0 && sec.length === 0 && (
        <div style={{ marginTop: 20 }}>
          <SectionHeader label="Setups" />
          <Card style={{ padding: 32, alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: fs, fontSize: 17, color: C.tx }}>No setups ready</div>
            <div style={{ fontFamily: fs, fontSize: 14, color: C.td, textAlign: 'center', lineHeight: 1.5 }}>
              Market conditions aren't ideal right now.{'\n'}Check the Watch tab for stocks building.
            </div>
          </Card>
        </div>
      )}

      {/* Sector heatmap */}
      {b.sectors?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <SectionHeader label="Sector Rotation" />
          <Card style={{ padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {[...b.sectors].sort((a, x) => x.p - a.p).slice(0, 8).map(s => {
                const c = s.p > 0.5 ? C.g : s.p > -0.5 ? C.tx : C.r
                return (
                  <div key={s.n} style={{ background: C.p2, borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ fontFamily: fs, fontSize: 10, color: C.tx, marginBottom: 3 }}>{s.n}</div>
                    <div style={{ fontFamily: fm, fontSize: 13, fontWeight: 700, color: c }}>{s.p > 0 ? '+' : ''}{s.p}%</div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// WATCH TAB
// ─────────────────────────────────────────────
function WatchTab({ watchlistData, onSelect }) {
  const [mode, setMode] = useState('long')
  if (!watchlistData) return <LoadingScreen msg="Loading watchlist…" />
  const stocks = watchlistData.stocks || []
  const longZones  = ['CONVERGENCE','SECONDARY','BUILDING','WATCH']
  const shortZones = ['SHORT_CONVERGENCE','SHORT_SECONDARY','SHORT_WATCH']
  const zoneLabels = {
    CONVERGENCE: 'Full Convergence', SECONDARY: 'Secondary',
    BUILDING: 'Building', WATCH: 'Watch List',
    SHORT_CONVERGENCE: 'Short Convergence', SHORT_SECONDARY: 'Short Secondary', SHORT_WATCH: 'Short Watch',
  }
  const filtered = (mode === 'long' ? longZones : shortZones)
    .map(z => ({ zone: z, items: stocks.filter(s => (mode === 'long' ? s.conv?.zone : s.shortConv?.zone) === z) }))
    .filter(g => g.items.length)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Segmented control */}
      <div style={{ padding: '12px 16px', flexShrink: 0, background: C.bg }}>
        <div style={{ display: 'flex', gap: 2, background: C.p2, borderRadius: 9, padding: 2 }}>
          {[['long','Long ↑'], ['short','Short ↓']].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '7px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: mode === m ? C.p3 : 'transparent',
              color: mode === m ? (m === 'short' ? C.r : C.g) : C.tx,
              fontFamily: fs, fontSize: 14, fontWeight: mode === m ? 600 : 400,
            }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontFamily: fs, fontSize: 15, color: C.tx }}>
            No {mode} setups found
          </div>
        )}
        {filtered.map(({ zone, items }) => {
          const zc = (mode === 'long' ? ZC : SZC)[zone]
          return (
            <div key={zone} style={{ marginBottom: 20 }}>
              <SectionHeader label={zoneLabels[zone]} right={`${items.length}`} />
              <Card>
                {items.map((s, i) => (
                  <div key={s.tk}>
                    <div className="press" onClick={() => onSelect(s)}
                      style={{ padding: '14px 16px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: fs, fontSize: 20, fontWeight: 700,
                            color: mode === 'short' ? C.r : C.tb }}>{s.tk}</span>
                          <span style={{ fontFamily: fm, fontSize: 13, color: C.tx }}>${s.px}</span>
                        </div>
                        <ScoreBar score={(mode === 'long' ? s.conv?.score : s.shortConv?.score) || 0}
                          max={mode === 'long' ? 18 : 22} color={mode === 'short' ? C.em : zc} />
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Pct v={s.dp} size={13} />
                        <Pct v={s.wp} size={13} />
                        <EmaRow kell={s.kell} />
                        <span style={{ fontFamily: fs, fontSize: 12, color: C.tx }}>{s.kell?.phase}</span>
                        <span style={{ fontFamily: fm, fontSize: 12, color: s.min?.rs >= 80 ? C.g : s.min?.rs >= 70 ? C.a : C.r, marginLeft: 'auto' }}>
                          RS {s.min?.rs}
                        </span>
                      </div>
                      {s.flags?.length > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {s.flags.map(f => (
                            <span key={f} style={{ fontFamily: fm, fontSize: 11, color: C.a,
                              background: C.a + '18', borderRadius: 4, padding: '2px 6px' }}>⚠ {f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {i < items.length - 1 && <Sep />}
                  </div>
                ))}
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// PLAYS TAB
// ─────────────────────────────────────────────
function PlaysTab({ watchlistData, breadthData }) {
  const [view, setView]     = useState('plays')
  const [selPlay, setSelPlay] = useState(null)
  if (!watchlistData) return <LoadingScreen msg="Loading plays…" />
  const stocks     = watchlistData.stocks || []
  const plays      = stocks.filter(s => ['CONVERGENCE','SECONDARY'].includes(s.conv?.zone))
  const shortPlays = stocks.filter(s => ['SHORT_CONVERGENCE','SHORT_SECONDARY'].includes(s.shortConv?.zone))
  const totalRisk  = plays.length * 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Segmented */}
      <div style={{ padding: '12px 16px', flexShrink: 0, background: C.bg }}>
        <div style={{ display: 'flex', gap: 2, background: C.p2, borderRadius: 9, padding: 2 }}>
          {[['plays','Plays'],['checklist','Checklist'],['short','Short']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{
              flex: 1, padding: '7px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: view === v ? C.p3 : 'transparent',
              color: view === v ? C.tb : C.tx,
              fontFamily: fs, fontSize: 14, fontWeight: view === v ? 600 : 400,
            }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {view === 'plays' && (
          <>
            {/* Portfolio overview */}
            <div style={{ padding: '0 16px', marginBottom: 4 }}>
              <SectionHeader label="Portfolio Overview" />
              <Card>
                <div style={{ display: 'flex' }}>
                  {[['Active Long', plays.length, C.gd],['Active Short', shortPlays.length, C.em],['Heat', `~${totalRisk}%`, totalRisk > 10 ? C.r : C.a]].map(([l, v, c], i) => (
                    <div key={l} style={{ flex: 1, padding: '14px 16px',
                      borderRight: i < 2 ? `1px solid ${C.b1}` : 'none' }}>
                      <div style={{ fontFamily: fs, fontSize: 12, color: C.tx, marginBottom: 4 }}>{l}</div>
                      <div style={{ fontFamily: fm, fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {plays.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <div style={{ fontFamily: fs, fontSize: 17, color: C.tx, marginBottom: 8 }}>No convergence plays</div>
                <div style={{ fontFamily: fs, fontSize: 14, color: C.td }}>Stocks need to reach Secondary or Convergence zone.</div>
              </div>
            ) : (
              <div style={{ padding: '0 16px' }}>
                <SectionHeader label="Active Plays" />
                {plays.map(s => <PlayCard key={s.tk} s={s} sel={selPlay === s.tk} onTap={() => setSelPlay(selPlay === s.tk ? null : s.tk)} />)}
              </div>
            )}
          </>
        )}

        {view === 'checklist' && (
          <div style={{ padding: '0 16px' }}>
            <ChecklistPanel stock={plays[0]} breadth={breadthData} />
          </div>
        )}

        {view === 'short' && (
          <div style={{ padding: '0 16px' }}>
            {shortPlays.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: fs, fontSize: 17, color: C.tx }}>No short setups confirmed</div>
            ) : (
              <>
                <SectionHeader label="Short Plays" />
                {shortPlays.map(s => <ShortPlayCard key={s.tk} s={s} />)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PlayCard({ s, sel, onTap }) {
  const isConv = s.conv.zone === 'CONVERGENCE'
  const col    = isConv ? C.gd : C.bl
  const pivot  = s.vcp?.pivot
  const stop   = pivot ? (pivot * 0.93).toFixed(2) : '—'
  const t1     = pivot ? (pivot * 1.08).toFixed(2) : '—'
  const t2     = pivot ? (pivot * 1.20).toFixed(2) : '—'

  return (
    <Card style={{ marginBottom: 10, overflow: 'hidden' }}>
      <div className="press" onClick={onTap} style={{ padding: '14px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: fs, fontSize: 22, fontWeight: 700, color: C.tb }}>{s.tk}</span>
            <Pill zone={s.conv.zone} />
          </div>
          <ScoreBar score={s.conv.score} max={18} color={col} />
        </div>
        <div style={{ fontFamily: fs, fontSize: 14, color: C.tx, lineHeight: 1.5 }}>{s.setup}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Pct v={s.dp} size={13} /><Pct v={s.wp} size={13} />
        </div>
      </div>

      {sel && (
        <div style={{ borderTop: `1px solid ${C.b1}` }}>
          <SectionHeader label="Entry" />
          <Card style={{ margin: '0 0', borderRadius: 0, background: C.p2 }}>
            {[
              ['Options play', s.optPlay || '—'],
              ['Max entry near', pivot ? `$${pivot}` : '—'],
              ['Position size', isConv ? '5% portfolio' : '3% portfolio'],
            ].map((r, i, arr) => (
              <div key={r[0]}>
                <Row label={r[0]} value={r[1]} />
                {i < arr.length - 1 && <Sep />}
              </div>
            ))}
          </Card>

          <SectionHeader label="Stop & Targets" />
          <Card style={{ margin: 0, borderRadius: 0, background: C.p2 }}>
            {[
              ['Stock stop', `$${stop} (VCP low)`],
              ['Option stop', '50% of premium'],
              ['T1 — Scale ⅓', `$${t1} (~+8%)`],
              ['T2 — Scale ⅓', `$${t2} (~+20%)`],
              ['T3 — Trail ⅓', 'Trail 21 EMA'],
            ].map((r, i, arr) => (
              <div key={r[0]}>
                <Row label={r[0]} value={r[1]} valueColor={i < 2 ? C.r : C.g} />
                {i < arr.length - 1 && <Sep />}
              </div>
            ))}
          </Card>

          <SectionHeader label="Management Rules" />
          <Card style={{ margin: 0, borderRadius: 0, background: C.p2, padding: '8px 0' }}>
            {[
              'Add on Kell EMA Crossback confirmation',
              'Tighten stop to breakeven after T1',
              'Exit all if Weinstein stage → 3+',
              'Exit all if Kell turns Red Light',
              'Exit all if Template fails (< 6/8)',
            ].map((r, i, arr) => (
              <div key={i}>
                <div style={{ padding: '10px 16px', fontFamily: fs, fontSize: 14, color: C.tx }}>→ {r}</div>
                {i < arr.length - 1 && <Sep />}
              </div>
            ))}
          </Card>
        </div>
      )}
    </Card>
  )
}

function ShortPlayCard({ s }) {
  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: fs, fontSize: 22, fontWeight: 700, color: C.r }}>{s.tk}</span>
          <Pill zone={s.shortConv?.zone} short />
        </div>
        <div style={{ fontFamily: fs, fontSize: 14, color: C.tx, marginBottom: 12 }}>{s.setup}</div>
        {[
          ['Type', s.wein?.stage === '3' ? 'Stage 3 Distribution' : 'Stage 4 Decline — Put play'],
          ['Timing', 'Buy puts on failed rally into declining EMAs'],
          ['Strike', 'ATM to slight ITM, delta 0.45-0.60, 30-60 DTE'],
          ['Stop', 'Close if stock reclaims 10 AND 20 EMA'],
        ].map((r, i, arr) => (
          <div key={r[0]}>
            <Row label={r[0]} value={r[1]} valueColor={C.tx} />
            {i < arr.length - 1 && <Sep />}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────
// BRIEF TAB
// ─────────────────────────────────────────────
function BriefTab() {
  const { data, loading, error, reload, ts } = useApi('/api/daily-brief', 30 * 60 * 1000)
  const minsAgo = ts ? Math.round((Date.now() - ts) / 60000) : null

  const renderContent = (text) =>
    (text || '').split('\n').map((line, i) => {
      if (line.startsWith('# '))   return <div key={i} style={{ fontFamily: fs, fontSize: 20, fontWeight: 700, color: C.tb, marginTop: 8, marginBottom: 8 }}>{line.slice(2)}</div>
      if (line.startsWith('## '))  return <div key={i} style={{ fontFamily: fs, fontSize: 17, fontWeight: 600, color: C.tb, marginTop: 20, marginBottom: 8, paddingTop: 16, borderTop: `1px solid ${C.b1}` }}>{line.slice(3)}</div>
      if (line.startsWith('### ')) return <div key={i} style={{ fontFamily: fs, fontSize: 15, fontWeight: 600, color: C.tx, marginTop: 12, marginBottom: 4 }}>{line.slice(4)}</div>
      if (line.startsWith('- ') || line.startsWith('• ')) return <div key={i} style={{ fontFamily: fs, fontSize: 15, color: C.tx, paddingLeft: 16, marginBottom: 4, lineHeight: 1.5 }}>• {line.slice(2)}</div>
      if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
      return <div key={i} style={{ fontFamily: fs, fontSize: 15, color: C.tx, lineHeight: 1.6, marginBottom: 2 }}>{line}</div>
    })

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: fs, fontSize: 22, fontWeight: 700, color: C.tb }}>Morning Brief</div>
          {minsAgo !== null && <div style={{ fontFamily: fs, fontSize: 13, color: C.tx, marginTop: 2 }}>
            {minsAgo === 0 ? 'Just generated' : `${minsAgo}m ago`}
          </div>}
        </div>
        <button onClick={reload} style={{ background: C.bl + '22', border: 'none', borderRadius: 20,
          padding: '8px 16px', color: C.bl, fontFamily: fs, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>}

      {error && (
        <div style={{ margin: '0 16px' }}>
          <Card style={{ padding: 20 }}>
            <div style={{ fontFamily: fs, fontSize: 17, fontWeight: 600, color: C.a, marginBottom: 8 }}>Brief Unavailable</div>
            <div style={{ fontFamily: fs, fontSize: 15, color: C.tx, lineHeight: 1.6 }}>
              Add <span style={{ fontFamily: fm, color: C.bl }}>ANTHROPIC_API_KEY</span> in Railway → Variables to enable AI briefs.
            </div>
          </Card>
        </div>
      )}

      {data && (
        <div style={{ padding: '0 16px' }}>
          <Card style={{ padding: 16 }}>
            {renderContent(data.content)}
          </Card>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// ANALYZE TAB
// ─────────────────────────────────────────────
function AnalyzeTab() {
  const [query, setQuery]   = useState('')
  const [loading, setLoad]  = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError]   = useState(null)
  const [history, setHist]  = useState([])
  const inputRef = useRef()

  async function search(ticker) {
    const tk = (ticker || query).toUpperCase().trim()
    if (!tk) return
    setLoad(true); setError(null); setResult(null)
    try {
      const r = await fetch(`/api/analyze/${tk}`)
      if (!r.ok) throw new Error(`Could not analyze ${tk}`)
      const d = await r.json()
      setResult(d)
      setHist(h => [tk, ...h.filter(x => x !== tk)].slice(0, 5))
    } catch (e) { setError(e.message) }
    finally { setLoad(false) }
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: 16 }}>
        <div style={{ fontFamily: fs, fontSize: 22, fontWeight: 700, color: C.tb, marginBottom: 16 }}>Analyzer</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <input ref={inputRef} value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="TICKER"
            style={{ flex: 1, background: C.p1, border: 'none', borderRadius: 10,
              padding: '12px 16px', color: C.tb, fontFamily: fm, fontSize: 17,
              letterSpacing: 2 }} />
          <button onClick={() => search()} style={{ background: C.bl, border: 'none', borderRadius: 10,
            padding: '12px 20px', color: '#fff', fontFamily: fs, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            {loading ? '…' : 'Go'}
          </button>
        </div>
        {history.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {history.map(tk => (
              <button key={tk} onClick={() => { setQuery(tk); search(tk) }}
                style={{ background: C.p1, border: 'none', borderRadius: 20, padding: '6px 14px',
                  color: C.bl, fontFamily: fm, fontSize: 13, cursor: 'pointer' }}>
                {tk}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>}

      {error && (
        <div style={{ margin: '0 16px' }}>
          <Card style={{ padding: 16 }}>
            <div style={{ fontFamily: fs, fontSize: 15, color: C.r }}>{error}</div>
          </Card>
        </div>
      )}

      {result && (
        <div style={{ animation: 'fadeIn .2s ease' }}>
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontFamily: fs, fontSize: 28, fontWeight: 700, color: C.tb, letterSpacing: -0.5 }}>{result.tk}</div>
                <div style={{ fontFamily: fs, fontSize: 14, color: C.tx }}>{result.nm} · ${result.px}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: fm, fontSize: 28, fontWeight: 700, color: ZC[result.conv?.zone] || C.td }}>
                  {result.conv?.score}<span style={{ fontSize: 15, color: C.tx, fontWeight: 400 }}>/18</span>
                </div>
                <Pill zone={result.conv?.zone} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <Pct v={result.dp} size={15} /><Pct v={result.wp} size={15} /><Pct v={result.mp} size={15} />
            </div>
          </div>
          <div style={{ padding: '0 16px' }}>
            <DetailOverview s={result} zc={ZC[result.conv?.zone] || C.td} />
            <div style={{ marginTop: 20 }}>
              <ShortAnalysis s={result} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// NEWS TAB
// ─────────────────────────────────────────────
function NewsTab() {
  const { data, loading } = useApi('/api/news', 15 * 60 * 1000)

  const fmt = (ts) => {
    if (!ts) return ''
    const d = new Date(ts * 1000)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const NewsItem = ({ item, highlight }) => (
    <div style={{ padding: '14px 16px', borderLeft: highlight ? `3px solid ${C.gd}` : '3px solid transparent' }}>
      {highlight && <span style={{ fontFamily: fm, fontSize: 12, color: C.gd, fontWeight: 600 }}>{item.ticker} · </span>}
      <div style={{ fontFamily: fs, fontSize: 15, fontWeight: 600, color: C.tb, lineHeight: 1.4, marginBottom: 4 }}>{item.headline}</div>
      <div style={{ fontFamily: fs, fontSize: 13, color: C.td }}>{item.source} · {fmt(item.time)}</div>
      {item.summary && <div style={{ fontFamily: fs, fontSize: 14, color: C.tx, marginTop: 6, lineHeight: 1.5 }}>
        {item.summary.slice(0, 160)}{item.summary.length > 160 ? '…' : ''}
      </div>}
    </div>
  )

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ fontFamily: fs, fontSize: 22, fontWeight: 700, color: C.tb }}>News</div>
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>}

      {data?.watchlistAlerts?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionHeader label="Watchlist Alerts" />
          <Card>
            {data.watchlistAlerts.map((item, i) => (
              <div key={i}>
                <NewsItem item={item} highlight />
                {i < data.watchlistAlerts.length - 1 && <Sep />}
              </div>
            ))}
          </Card>
        </div>
      )}

      {data?.marketNews?.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          <SectionHeader label="Market & Macro" />
          <Card>
            {data.marketNews.map((item, i) => (
              <div key={i}>
                <NewsItem item={item} />
                {i < data.marketNews.length - 1 && <Sep />}
              </div>
            ))}
          </Card>
        </div>
      )}

      {!loading && !data && (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: fs, fontSize: 15, color: C.tx }}>
          Add FINNHUB_API_KEY to enable news feed
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// RISK TAB
// ─────────────────────────────────────────────
function RiskTab({ threatsData }) {
  const [sel, setSel] = useState(null)
  const threats = threatsData?.threats || []

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ fontFamily: fs, fontSize: 22, fontWeight: 700, color: C.tb }}>Risk Monitor</div>
        <div style={{ fontFamily: fs, fontSize: 14, color: C.tx, marginTop: 4 }}>
          Divergence signals — all 3 frameworks saying exit.
        </div>
      </div>
      {threats.length === 0 && (
        <div style={{ padding: '40px 16px', textAlign: 'center', fontFamily: fs, fontSize: 15, color: C.tx }}>
          Loading threat data…
        </div>
      )}
      {threats.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          <SectionHeader label="Divergence Alerts" />
          <Card>
            {threats.map((t, i) => (
              <div key={t.tk}>
                <div className="press" onClick={() => setSel(sel?.tk === t.tk ? null : t)}
                  style={{ padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontFamily: fs, fontSize: 20, fontWeight: 700, color: C.r }}>{t.tk}</span>
                      <span style={{ fontFamily: fs, fontSize: 14, color: C.tx, marginLeft: 8 }}>{t.type}</span>
                    </div>
                    <span style={{ fontFamily: fm, fontSize: 15, fontWeight: 700, color: C.r }}>{t.sc}/10</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {t.sf > 0 && <span style={{ fontFamily: fs, fontSize: 13, color: C.r }}>Short {t.sf}%</span>}
                    <Pct v={t.mc} size={13} />
                    {t.insiderSells > 0 && <span style={{ fontFamily: fs, fontSize: 13, color: C.a }}>Insiders: {t.insiderSells} sells</span>}
                  </div>
                  {sel?.tk === t.tk && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontFamily: fs, fontSize: 14, color: C.tx, lineHeight: 1.6, marginBottom: 10 }}>{t.sum}</div>
                      {(t.divSignals || []).map((e, j) => (
                        <div key={j} style={{ fontFamily: fs, fontSize: 14, color: C.tx,
                          padding: '6px 0 6px 14px', borderLeft: `2px solid ${C.r}` }}>✕ {e}</div>
                      ))}
                    </div>
                  )}
                </div>
                {i < threats.length - 1 && <Sep />}
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// BREADTH TAB
// ─────────────────────────────────────────────
function BreadthTab({ breadthData }) {
  const b = breadthData
  if (!b) return <LoadingScreen msg="Loading breadth data…" />

  let es = 0
  if (b.spxStage === 2) es++
  if (b.spxEma === 'above') es++
  if ((b.tplCount || 0) > 200) es++
  if ((b.vix || 25) < 20) es++
  if (b.sectors?.filter(s => s.p > 1).length >= 4) es++
  const ec = es >= 4 ? C.g : es >= 3 ? C.a : C.r
  const sizeLabel = es >= 5 ? 'Full Size' : es >= 3 ? 'Standard' : es >= 2 ? 'Half Size' : 'Cash'

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ fontFamily: fs, fontSize: 22, fontWeight: 700, color: C.tb }}>Market Breadth</div>
      </div>

      {/* Index cards */}
      <div style={{ padding: '0 16px', display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['S&P', b.spx],['NDX', b.ndx],['RUT', b.rut]].map(([l, d]) =>
          d ? (
            <Card key={l} style={{ flex: 1, padding: '12px 12px' }}>
              <div style={{ fontFamily: fs, fontSize: 12, color: C.tx, marginBottom: 4 }}>{l}</div>
              <div style={{ fontFamily: fm, fontSize: 16, fontWeight: 700, color: C.tb }}>{d.price?.toLocaleString()}</div>
              <Pct v={d.chg} size={12} />
              <div style={{ fontFamily: fm, fontSize: 11, color: C.td, marginTop: 4 }}>S{d.stage} · {d.ema20}</div>
            </Card>
          ) : null
        )}
      </div>

      {/* Position sizing */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <SectionHeader label="Position Sizing Guide" />
        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontFamily: fs, fontSize: 24, fontWeight: 700, color: ec }}>{sizeLabel}</div>
            <div style={{ fontFamily: fm, fontSize: 20, fontWeight: 700, color: ec }}>{es}<span style={{ fontSize: 14, color: C.tx }}>/5</span></div>
          </div>
          <div style={{ background: C.p2, height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ width: `${(es/5)*100}%`, height: '100%', background: ec, borderRadius: 2 }} />
          </div>
          {[
            ['S&P Stage 2', b.spxStage === 2],
            ['Kell Green (above 20 EMA)', b.spxEma === 'above'],
            ['≥200 TPL qualifiers', (b.tplCount||0) > 200],
            ['VIX < 20', (b.vix||25) < 20],
            ['≥4 sectors hot', (b.sectors||[]).filter(s => s.p > 1).length >= 4],
          ].map((r, i, arr) => (
            <div key={r[0]}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingVertical: 4 }}>
                <span style={{ color: r[1] ? C.g : C.r, fontSize: 15, fontWeight: 700 }}>{r[1] ? '✓' : '✕'}</span>
                <span style={{ fontFamily: fs, fontSize: 15, color: r[1] ? C.tb : C.tx }}>{r[0]}</span>
              </div>
              {i < arr.length - 1 && <div style={{ height: 8 }} />}
            </div>
          ))}
        </Card>
      </div>

      {/* Sector heatmap */}
      {b.sectors?.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          <SectionHeader label="Sector Heatmap" />
          <Card style={{ padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {[...b.sectors].sort((a, x) => x.p - a.p).map(s => {
                const c = s.p > 0.5 ? C.g : s.p > -0.5 ? C.tx : C.r
                return (
                  <div key={s.n} style={{ background: C.p2, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontFamily: fs, fontSize: 11, color: C.tx, marginBottom: 4 }}>{s.n}</div>
                    <div style={{ fontFamily: fm, fontSize: 15, fontWeight: 700, color: c }}>{s.p > 0 ? '+' : ''}{s.p}%</div>
                    <div style={{ fontFamily: fm, fontSize: 10, color: C.td, marginTop: 2 }}>S{s.stage}</div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// JOURNAL TAB
// ─────────────────────────────────────────────
const JOURNAL_INIT = [
  { id:1, d:'03-17', tk:'TSEM', a:'BUY',  st:'$140C 04/17', pnl:43.5,  conv:'PRIMARY', n:'Full convergence VCP pop' },
  { id:2, d:'03-14', tk:'CF',   a:'BUY',  st:'$125C 04/17', pnl:27.1,  conv:'PARTIAL', n:'EMA crossback, RS<70' },
  { id:3, d:'03-10', tk:'NVDA', a:'STOP', st:'$950C 03/21', pnl:-100,  conv:'EXIT',    n:'S3 transition — sold per MKW' },
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

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ fontFamily: fs, fontSize: 22, fontWeight: 700, color: C.tb }}>Journal</div>
      </div>

      {/* Stats */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['Trades', journal.length, C.tb],['Win %', `${((w/(journal.length||1))*100).toFixed(0)}%`, w/(journal.length||1)>=.5?C.g:C.r],['Avg P&L', `${avg>=0?'+':''}${avg.toFixed(0)}%`, avg>=0?C.g:C.r]].map(([l,v,c]) => (
            <Card key={l} style={{ flex:1, padding: '12px 14px' }}>
              <div style={{ fontFamily: fs, fontSize: 12, color: C.tx, marginBottom: 4 }}>{l}</div>
              <div style={{ fontFamily: fm, fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
            </Card>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          width: '100%', background: C.bl, border: 'none', borderRadius: 12,
          padding: '14px', color: '#fff', fontFamily: fs, fontSize: 16, fontWeight: 600, cursor: 'pointer'
        }}>Add Trade</button>
      </div>

      {showAdd && (
        <div style={{ padding: '0 16px', marginBottom: 20 }}>
          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['Ticker','tk'],['Strike/Expiry','st'],['P&L %','pnl'],['Notes','n']].map(([l,k]) => (
                <div key={k}>
                  <div style={{ fontFamily: fs, fontSize: 13, color: C.tx, marginBottom: 6 }}>{l}</div>
                  <input value={form[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))}
                    style={{ width:'100%', background:C.p2, border:'none', borderRadius:10, padding:'12px 14px', color:C.tb, fontFamily:fm, fontSize:15 }} />
                </div>
              ))}
              <div style={{ display:'flex', gap:8 }}>
                {['BUY','SELL','STOP'].map(v => (
                  <button key={v} onClick={() => setForm(f=>({...f,a:v}))} style={{
                    flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer',
                    background: form.a===v ? C.bl : C.p2,
                    color: form.a===v ? '#fff' : C.tx,
                    fontFamily:fs, fontSize:15, fontWeight:form.a===v?600:400
                  }}>{v}</button>
                ))}
              </div>
              <button onClick={add} style={{ background:C.g, border:'none', borderRadius:12, padding:14, color:'#000', fontFamily:fs, fontSize:16, fontWeight:700, cursor:'pointer' }}>Save Trade</button>
            </div>
          </Card>
        </div>
      )}

      <div style={{ padding: '0 16px' }}>
        <SectionHeader label="Trade History" />
        <Card>
          {journal.map((j, i) => (
            <div key={j.id}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <div>
                    <span style={{ fontFamily:fs, fontSize:18, fontWeight:700, color:C.tb }}>{j.tk}</span>
                    <span style={{ fontFamily:fs, fontSize:14, color:j.a==='BUY'?C.g:j.a==='STOP'?C.r:C.a, marginLeft:8, fontWeight:600 }}>{j.a}</span>
                  </div>
                  <span style={{ fontFamily:fm, fontSize:17, fontWeight:700, color:j.pnl>=0?C.g:C.r }}>{j.pnl>=0?'+':''}{j.pnl}%</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontFamily:fm, fontSize:13, color:C.bl }}>{j.st}</span>
                  <span style={{ fontFamily:fm, fontSize:11, color:j.conv==='PRIMARY'?C.gd:j.conv==='EXIT'?C.r:C.a }}>{j.conv}</span>
                </div>
                <div style={{ fontFamily:fs, fontSize:13, color:C.td, marginTop:4 }}>{j.d} · {j.n}</div>
              </div>
              {i < journal.length - 1 && <Sep />}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// MORE SHEET
// ─────────────────────────────────────────────
const MORE_PAGES = [
  { id:'analyze', label:'Analyze', icon:'🔍', color:C.bl  },
  { id:'news',    label:'News',    icon:'📰', color:C.tx  },
  { id:'risk',    label:'Risk',    icon:'⚠️', color:C.r   },
  { id:'breadth', label:'Breadth', icon:'📊', color:C.pu  },
  { id:'journal', label:'Journal', icon:'📋', color:C.gd  },
]

function MoreSheet({ open, onClose, onPage, activeMore }) {
  if (!open) return null
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:40 }} />
      <div style={{ position:'fixed', bottom:83, left:0, right:0,
        background: C.p1, borderTop:`1px solid ${C.b1}`,
        borderRadius:'20px 20px 0 0', zIndex:41, padding:'16px 20px 24px',
        animation:'slideUp .25s ease' }}>
        <div style={{ width:36, height:4, background:C.b2, borderRadius:2, margin:'0 auto 20px' }} />
        <div style={{ fontFamily:fs, fontSize:13, fontWeight:600, color:C.tx, letterSpacing:0.3, marginBottom:16 }}>More</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
          {MORE_PAGES.map(p => (
            <button key={p.id} className="press" onClick={() => { onPage(p.id); onClose() }}
              style={{ background: activeMore===p.id ? C.bl+'22' : C.p2,
                border: activeMore===p.id ? `1px solid ${C.bl}` : '1px solid transparent',
                borderRadius:12, padding:'12px 6px', cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:22 }}>{p.icon}</span>
              <span style={{ fontFamily:fs, fontSize:11, color: activeMore===p.id ? C.bl : C.tx, fontWeight:500 }}>{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────
// UTILITY SCREENS
// ─────────────────────────────────────────────
function LoadingScreen({ msg }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', height:'60vh', gap:16 }}>
      <Spinner />
      <span style={{ fontFamily:fs, fontSize:15, color:C.tx }}>{msg || 'Loading…'}</span>
    </div>
  )
}

function LastUpdated({ ts }) {
  const [ago, setAgo] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setAgo(ts ? Math.round((Date.now()-ts)/60000) : 0), 30000)
    return () => clearInterval(t)
  }, [ts])
  if (!ts) return null
  return <span style={{ fontFamily:fs, fontSize:13, color:C.td }}>{ago===0 ? 'Live' : `${ago}m ago`}</span>
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
const TABS = [
  { id:'home',  icon:'house.fill',      label:'Home',  emoji:'⌂'  },
  { id:'watch', icon:'chart.bar.fill',  label:'Watch', emoji:'◉'  },
  { id:'plays', icon:'checkmark.circle',label:'Plays', emoji:'✓'  },
  { id:'brief', icon:'doc.text.fill',   label:'Brief', emoji:'◈'  },
  { id:'more',  icon:'ellipsis',        label:'More',  emoji:'…'  },
]

export default function App() {
  const [tab,      setTab]      = useState('home')
  const [moreOpen, setMoreOpen] = useState(false)
  const [morePage, setMorePage] = useState(null)
  const [detail,   setDetail]   = useState(null)
  const [time,     setTime]     = useState(new Date())

  const { data: watchlistData, loading: wlLoad, ts: wlTs } = useApi('/api/watchlist')
  const { data: breadthData,   loading: brLoad             } = useApi('/api/breadth')
  const { data: threatsData                                 } = useApi('/api/threats')

  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(i)
  }, [])

  const secCount  = (watchlistData?.stocks || []).filter(s => ['CONVERGENCE','SECONDARY'].includes(s.conv?.zone)).length
  const onSelect  = (s) => { setDetail(s); setMoreOpen(false) }
  const onBack    = () => setDetail(null)
  const handleTab = (id) => {
    if (id === 'more') { setMoreOpen(m => !m) }
    else { setTab(id); setDetail(null); setMoreOpen(false); setMorePage(null) }
  }

  return (
    <div style={{ fontFamily: fs, background: C.bg, color: C.tx,
      height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{CSS}</style>

      {/* Status bar */}
      <div style={{ padding: '12px 20px 10px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexShrink: 0, background: C.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: fs, fontSize: 17, fontWeight: 700, color: C.tb }}>MKW</span>
          {secCount > 0 && (
            <span style={{ fontFamily: fm, fontSize: 12, fontWeight: 600, color: C.gd,
              background: C.gd + '20', borderRadius: 20, padding: '3px 10px', animation: 'pulse 2s infinite' }}>
              {secCount} setup{secCount > 1 ? 's' : ''}
            </span>
          )}
          {(wlLoad || brLoad) && <Spinner />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LastUpdated ts={wlTs} />
          <span style={{ fontFamily: fs, fontSize: 13, color: C.tx }}>
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
        {detail ? (
          <DetailView stock={detail} onBack={onBack} breadth={breadthData} />
        ) : (
          <>
            {tab === 'home'  && <HomeTab watchlistData={watchlistData} breadthData={breadthData} onSelect={onSelect} />}
            {tab === 'watch' && <WatchTab watchlistData={watchlistData} onSelect={onSelect} />}
            {tab === 'plays' && <PlaysTab watchlistData={watchlistData} breadthData={breadthData} />}
            {tab === 'brief' && <BriefTab />}
            {morePage === 'analyze' && <AnalyzeTab />}
            {morePage === 'news'    && <NewsTab />}
            {morePage === 'risk'    && <RiskTab threatsData={threatsData} />}
            {morePage === 'breadth' && <BreadthTab breadthData={breadthData} />}
            {morePage === 'journal' && <JournalTab />}
          </>
        )}
      </div>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)}
        onPage={(p) => { setMorePage(p); setTab('more') }} activeMore={morePage} />

      {/* iOS Tab Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-around',
        padding: '10px 0 28px',
        background: 'rgba(28,28,30,0.92)',
        backdropFilter: 'blur(20px)',
        borderTop: `1px solid ${C.b1}`,
        flexShrink: 0, zIndex: 30 }}>
        {TABS.map(t => {
          const isActive = t.id === 'more' ? moreOpen || tab === 'more' : tab === t.id && !moreOpen
          return (
            <button key={t.id} onClick={() => handleTab(t.id)}
              className="press"
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '2px 20px', color: isActive ? C.bl : C.td, transition: 'color .1s' }}>
              <span style={{ fontSize: 22 }}>{t.emoji}</span>
              <span style={{ fontFamily: fs, fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
