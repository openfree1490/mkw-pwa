import { useState, useEffect, useRef, useCallback } from 'react'

// ── DESIGN SYSTEM ──────────────────────────────────────────────────────────
const C = {
  bg:'#020408', p1:'#080D14', p2:'#0D1520', p3:'#121B27',
  b1:'#1A2535', b2:'#243247',
  tb:'#E8EDF5', tx:'rgba(180,200,230,0.6)', td:'rgba(180,200,230,0.25)',
  g:'#00E676', r:'#FF3D57', a:'#FF9F0A', bl:'#2979FF',
  pu:'#AA44FF', cy:'#00BCD4', gd:'#FFD700', em:'#FF6B35',
}
const ZC  = { CONVERGENCE:C.cy, SECONDARY:C.bl, BUILDING:C.pu, WATCH:C.td }
const SZC = { SHORT_CONVERGENCE:C.em, SHORT_SECONDARY:'#FF8C42', SHORT_WATCH:C.td, NEUTRAL:C.td }
const FO  = `'Orbitron',monospace`
const FR  = `'Rajdhani',sans-serif`
const FM  = `'Share Tech Mono',monospace`

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;800;900&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1A2535;border-radius:2px}
html,body,#root{height:100%;width:100%;background:#020408;overflow:hidden}
body{overscroll-behavior:none}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
.press:active{opacity:0.7;transform:scale(0.97)}
button{-webkit-tap-highlight-color:transparent;cursor:pointer;border:none;background:none}
input{outline:none;-webkit-appearance:none}
`

// ── PRIMITIVES ─────────────────────────────────────────────────────────────
const Pct = ({ v, size=13, bold=true }) =>
  v == null
    ? <span style={{color:C.td,fontSize:size,fontFamily:FM}}>—</span>
    : <span style={{color:v>=0?C.g:C.r,fontSize:size,fontFamily:FM,fontWeight:bold?600:400}}>
        {v>=0?'+':''}{v.toFixed(2)}%
      </span>

const Dot = ({ state, size=7 }) =>
  <div style={{width:size,height:size,borderRadius:'50%',flexShrink:0,
    background:state==='bull'?C.g:state==='bear'?C.r:C.a}} />

const ScoreBar = ({ score, max=22, color, width=56 }) => {
  const pct = Math.min(100,(score/max)*100)
  const c = color||(pct>=77?C.cy:pct>=54?C.bl:pct>=36?C.pu:C.td)
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div style={{width,height:3,background:C.b1,borderRadius:2,overflow:'hidden'}}>
        <div style={{width:`${pct}%`,height:'100%',background:c,borderRadius:2,transition:'width 0.4s'}}/>
      </div>
      <span style={{fontSize:12,fontFamily:FM,color:c,fontWeight:600,minWidth:28}}>{score}/{max}</span>
    </div>
  )
}

const Pill = ({ zone, short=false, small=false }) => {
  const colors = short?SZC:ZC
  const c = colors[zone]||C.td
  const L = { CONVERGENCE:'CONV',SECONDARY:'SEC',BUILDING:'BUILD',WATCH:'WATCH',
              SHORT_CONVERGENCE:'S·CONV',SHORT_SECONDARY:'S·SEC',SHORT_WATCH:'S·WATCH',NEUTRAL:'—' }
  return (
    <span style={{fontSize:small?9:10,fontFamily:FM,fontWeight:700,
      padding:small?'2px 5px':'3px 7px',borderRadius:12,
      background:`${c}22`,color:c,border:`1px solid ${c}44`,letterSpacing:0.5}}>
      {L[zone]||zone}
    </span>
  )
}

const Card = ({ children, style={}, glow, onClick }) =>
  <div className={onClick?'press':''} onClick={onClick}
    style={{background:C.p1,border:`1px solid ${glow?glow+'55':C.b1}`,borderRadius:10,
      overflow:'hidden',
      boxShadow:glow?`0 0 16px ${glow}22,0 0 1px ${glow}44`:'none',
      ...style}}>
    {children}
  </div>

const SH = ({ label, right, pad=true }) =>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:pad?'10px 12px 6px':'4px 0',
    borderBottom:`1px solid ${C.b1}`}}>
    <span style={{fontFamily:FO,fontSize:10,fontWeight:700,letterSpacing:'2px',color:C.td,textTransform:'uppercase'}}>{label}</span>
    {right}
  </div>

const Sep = () => <div style={{height:'1px',background:C.b1,margin:'0 12px'}}/>

const DR = ({ label, value, color, mono=true, right }) =>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:'5px 12px',minHeight:26}}>
    <span style={{fontFamily:FR,fontSize:10,fontWeight:600,color:C.tx,textTransform:'uppercase',letterSpacing:'0.8px'}}>{label}</span>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      {right}
      <span style={{fontFamily:mono?FM:FR,fontSize:12,color:color||C.tb,fontWeight:600}}>{value??'—'}</span>
    </div>
  </div>

const Spinner = ({ size=20 }) =>
  <div style={{width:size,height:size,border:`2px solid ${C.b1}`,borderTopColor:C.cy,
    borderRadius:'50%',animation:'spin 0.8s linear infinite',flexShrink:0}}/>

const Light = ({ color }) =>
  <div style={{width:10,height:10,borderRadius:'50%',background:color,flexShrink:0,
    boxShadow:`0 0 8px ${color}`}}/>

const Badge = ({ label, color }) =>
  <span style={{fontFamily:FO,fontSize:9,fontWeight:700,letterSpacing:'1.5px',
    padding:'2px 6px',borderRadius:4,background:`${color}22`,color,border:`1px solid ${color}44`}}>
    {label}
  </span>

const fmt = (n, dec=2) => n==null||isNaN(n)?'—':Number(n).toFixed(dec)
const fmtB = (n) => { if(!n||isNaN(n)) return '—'; const abs=Math.abs(n); if(abs>=1e12) return `$${(n/1e12).toFixed(1)}T`; if(abs>=1e9) return `$${(n/1e9).toFixed(1)}B`; if(abs>=1e6) return `$${(n/1e6).toFixed(1)}M`; return `$${n.toFixed(0)}`; }
const timeAgo = (ts) => { if(!ts) return ''; const d=Date.now()-ts*1000; if(d<3600000) return `${Math.floor(d/60000)}m ago`; if(d<86400000) return `${Math.floor(d/3600000)}h ago`; return `${Math.floor(d/86400000)}d ago`; }

// ── API HOOK ───────────────────────────────────────────────────────────────
function useApi(url, interval=0) {
  const [data,setData]   = useState(null)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState(null)
  const fetch_ = useCallback(() => {
    if(!url) return
    setLoading(true)
    fetch(url).then(r=>r.json()).then(d=>{ setData(d); setError(null) })
      .catch(e=>setError(e.message))
      .finally(()=>setLoading(false))
  },[url])
  useEffect(() => { fetch_(); if(interval>0){ const t=setInterval(fetch_,interval); return ()=>clearInterval(t) } },[fetch_,interval])
  return { data, loading, error, refetch:fetch_ }
}

// ── STAGE BADGE ────────────────────────────────────────────────────────────
const stageBadge = (s) => {
  const c = s==='2A'||s==='2B'?C.gd:s==='3'?C.a:s==='4A'||s==='4B'?C.r:s==='1A'||s==='1B'?C.tx:C.td
  return <Badge label={`STAGE ${s||'?'}`} color={c}/>
}

// ── KELL LIGHT COLOR ───────────────────────────────────────────────────────
const lightColor = (l) => l==='green'?C.g:l==='yellow'?C.a:l==='red'?C.r:'#555'

// ── STOCK CARD (Watchlist + Home) ──────────────────────────────────────────
function StockCard({ s, onAnalyze }) {
  const [open,setOpen] = useState(false)
  if(!s) return null
  const zone = s.conv?.zone
  const gc = ZC[zone]||C.td
  const rs = s.min?.rs??50
  const rsColor = rs>=80?C.g:rs>=70?C.a:C.r

  return (
    <Card glow={open?gc:null} style={{marginBottom:8}}>
      {/* HEADER */}
      <div className="press" onClick={()=>setOpen(!open)}
        style={{padding:'10px 12px',cursor:'pointer'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontFamily:FO,fontSize:18,fontWeight:900,color:gc,letterSpacing:'1px'}}>{s.tk}</span>
            <span style={{fontFamily:FR,fontSize:11,color:C.tx,fontWeight:500}}>{s.nm?.split(' ').slice(0,3).join(' ')}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <Pill zone={zone}/>
            {onAnalyze && <button onClick={e=>{e.stopPropagation();onAnalyze(s.tk)}}
              style={{fontSize:10,fontFamily:FM,color:C.bl,padding:'2px 6px',border:`1px solid ${C.bl}44`,borderRadius:4}}>
              ANALYZE
            </button>}
          </div>
        </div>
        <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontFamily:FM,fontSize:14,color:C.tb,fontWeight:600}}>${fmt(s.px)}</span>
          <Pct v={s.dp}/> <Pct v={s.wp}/> <Pct v={s.mp}/>
          <div style={{display:'flex',gap:4,marginLeft:'auto'}}>
            <Dot state={s.kell?.emaD}/><Dot state={s.kell?.emaW}/><Dot state={s.kell?.emaM}/>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6,flexWrap:'wrap'}}>
          <ScoreBar score={s.conv?.score??0} max={22}/>
          <span style={{fontFamily:FR,fontSize:10,color:rsColor,fontWeight:600}}>RS {rs}</span>
          <span style={{fontFamily:FM,fontSize:10,color:C.tx}}>TPL {s.min?.tplScore??0}/8</span>
          <span style={{fontFamily:FM,fontSize:10,color:lightColor(s.kell?.light)}}>{s.kell?.phase}</span>
          {stageBadge(s.wein?.stage)}
        </div>
      </div>

      {/* EXPANDED */}
      {open && <div style={{borderTop:`1px solid ${C.b1}`,animation:'fadeIn 0.2s ease'}}>

        {/* Section A: Stage */}
        <SH label="A · WEINSTEIN STAGE"/>
        <DR label="Stage" value={s.wein?.stage} color={ZC['CONVERGENCE']}/>
        <DR label="150d SMA (30wk proxy)" value={`$${fmt(s.wein?.ma150)}`}/>
        <DR label="Pct from MA" value={`${fmt(s.wein?.pctFromMA,1)}%`} color={s.wein?.pctFromMA>0?C.g:C.r}/>
        <DR label="Slope weeks" value={s.wein?.slopeWeeks}/>
        <DR label="Slope direction" value={s.wein?.slopeRising?'RISING':'FALLING'} color={s.wein?.slopeRising?C.g:C.r}/>

        {/* Section B: Template */}
        <SH label="B · MINERVINI TREND TEMPLATE"/>
        {(s.min?.tpl||[]).map((pass,i)=>{
          const labels=['Price > 50d SMA','Price > 150d SMA','Price > 200d SMA','50d SMA > 150d SMA',
            '150d SMA > 200d SMA','200d SMA trending up','Price ≥ 75% of 52w high','RS ≥ 70']
          return (
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 12px',
              background:pass?'transparent':undefined}}>
              <span style={{fontFamily:FR,fontSize:11,color:C.tx,fontWeight:500}}>{labels[i]}</span>
              <span style={{fontFamily:FM,fontSize:12,color:pass?C.g:C.r,fontWeight:700}}>{pass?'✓':'✗'}</span>
            </div>
          )
        })}
        <div style={{padding:'6px 12px'}}>
          <ScoreBar score={s.min?.tplScore??0} max={8} color={s.min?.tplScore===8?C.cy:s.min?.tplScore>=5?C.bl:C.r} width={80}/>
        </div>

        {/* Section C: Kell */}
        <SH label="C · KELL PHASE"/>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px'}}>
          <Light color={lightColor(s.kell?.light)}/>
          <span style={{fontFamily:FO,fontSize:13,fontWeight:700,color:lightColor(s.kell?.light)}}>{s.kell?.phase}</span>
        </div>
        {[['EMA 10',s.kell?.ema10v],['EMA 20',s.kell?.ema20v],['EMA 50',s.kell?.ema50v],
          ['EMA 100',s.kell?.ema100v],['EMA 200',s.kell?.ema200v]].map(([l,v])=>
          <DR key={l} label={l} value={v?`$${fmt(v)}`:'—'} color={s.px>v?C.g:C.r}/>
        )}
        <DR label="EMA Alignment D/W/M" value={`${s.kell?.emaD} / ${s.kell?.emaW} / ${s.kell?.emaM}`}/>
        {s.technicals?.adr_pct && <DR label="ADR %" value={`${fmt(s.technicals.adr_pct,1)}%`}/>}

        {/* Section D: VCP */}
        <SH label="D · VCP STATUS"/>
        <DR label="Contractions" value={s.vcp?.count??0} color={s.vcp?.count>=2?C.g:C.td}/>
        <DR label="Depths" value={s.vcp?.depths||'—'}/>
        <DR label="Pivot price" value={s.vcp?.pivot?`$${fmt(s.vcp.pivot)}`:'—'} color={C.cy}/>
        <DR label="Tightness" value={s.vcp?.tightness||0} right={<ScoreBar score={s.vcp?.tightness??0} max={100} width={40}/>}/>
        <DR label="Volume dry-up" value={s.vcp?.volDryup?'YES':'NO'} color={s.vcp?.volDryup?C.g:C.td}/>
        {s.vcp?.pivot && <DR label="Distance from pivot" value={`${fmt((s.px/s.vcp.pivot-1)*100,1)}%`} color={Math.abs(s.px/s.vcp.pivot-1)<0.07?C.g:C.td}/>}

        {/* Section E: Fundamentals */}
        <SH label="E · FUNDAMENTALS"/>
        <DR label="EPS growth YoY" value={`${s.min?.eps??0}%`} color={(s.min?.eps??0)>15?C.g:(s.min?.eps??0)>0?C.a:C.r}/>
        <DR label="Revenue growth YoY" value={`${s.min?.rev??0}%`} color={(s.min?.rev??0)>10?C.g:C.a}/>
        <DR label="Margins expanding" value={s.min?.marginsExpanding?'YES':'NO'} color={s.min?.marginsExpanding?C.g:C.r}/>
        <DR label="Gross margin" value={s.fundamentals?.grossMargins?`${(s.fundamentals.grossMargins*100).toFixed(1)}%`:'—'}/>
        <DR label="ROE" value={s.fundamentals?.returnOnEquity?`${(s.fundamentals.returnOnEquity*100).toFixed(1)}%`:'—'}/>
        <DR label="Free cash flow" value={fmtB(s.fundamentals?.freeCashflow)}/>
        <DR label="Market cap" value={fmtB(s.fundamentals?.marketCap)}/>
        <DR label="P/E (trailing)" value={fmt(s.fundamentals?.trailingPE,1)}/>
        <DR label="Forward P/E" value={fmt(s.fundamentals?.forwardPE,1)}/>
        <DR label="Next earnings" value={s.fundamentals?.nextEarningsDate||'—'} color={C.a}/>

        {/* Section F: Technicals (if available) */}
        {s.technicals?.rsi && <>
          <SH label="F · TECHNICAL INDICATORS"/>
          <DR label="RSI (14)" value={fmt(s.technicals.rsi,1)} color={s.technicals.rsi>70?C.r:s.technicals.rsi<30?C.g:C.tb}/>
          <DR label="MACD histogram" value={fmt(s.technicals.macd?.histogram,3)} color={s.technicals.macd?.bullish?C.g:C.r}/>
          <DR label="ADX (trend strength)" value={fmt(s.technicals.adx,1)} color={s.technicals.adx>25?C.g:C.td}/>
          <DR label="Stoch %K / %D" value={`${fmt(s.technicals.stoch?.k,1)} / ${fmt(s.technicals.stoch?.d,1)}`}/>
          <DR label="OBV trend" value={s.technicals.obv_trend?.toUpperCase()||'—'} color={s.technicals.obv_trend==='rising'?C.g:C.r}/>
          <DR label="BB squeeze" value={s.technicals.bb?.squeeze?'YES':'NO'} color={s.technicals.bb?.squeeze?C.cy:C.td}/>
          <DR label="52w high" value={`$${fmt(s.technicals.high52)}`}/>
          <DR label="% from 52w high" value={`${fmt(s.technicals.pctFrom52h,1)}%`} color={C.r}/>
        </>}

        {/* Section G: Convergence checklist */}
        <SH label="G · CONVERGENCE CHECKLIST"/>
        <ConvergenceChecklist s={s}/>

        {/* Section H: Flags */}
        {s.flags?.length>0 && <>
          <SH label="H · FLAGS & RISKS"/>
          {s.flags.map((f,i)=><DR key={i} label="⚠" value={f} color={C.a} mono={false}/>)}
        </>}

        {/* Action */}
        <div style={{padding:'10px 12px',display:'flex',gap:8}}>
          {s.vcp?.pivot && <span style={{fontFamily:FM,fontSize:11,color:C.cy}}>PIVOT ${fmt(s.vcp.pivot)} · OPT: {s.optPlay||'—'}</span>}
        </div>
      </div>}
    </Card>
  )
}

function ConvergenceChecklist({ s }) {
  const mkt = s._mktCriteria||{}
  const groups = [
    { label:'MARKET', items:[
      { k:'mkt_spx_stage2', label:'SPX Stage 2', note:`Stage ${s.wein?.stage}` },
      { k:'mkt_spx_ema',    label:'SPX above 20 EMA', note:'' },
      { k:'mkt_tpl_count',  label:'TPL count > 200', note:'' },
    ]},
    { label:'TREND', items:[
      { k:'trend_stage2', label:'Stock Stage 2A/2B', note:`Stage ${s.wein?.stage}` },
      { k:'trend_tpl8',   label:'8/8 Template', note:`${s.min?.tplScore}/8` },
      { k:'trend_rs70',   label:'RS ≥ 70', note:`RS ${s.min?.rs}` },
      { k:'trend_kell_ok',label:'Kell confirmatory', note:s.kell?.phase },
      { k:'trend_tpl5',   label:'Template ≥ 5/8', note:'' },
    ]},
    { label:'FUNDAMENTALS', items:[
      { k:'fund_eps',     label:'EPS growth > 15%', note:`${s.min?.eps}%` },
      { k:'fund_rev',     label:'Revenue growth > 10%', note:`${s.min?.rev}%` },
      { k:'fund_margins', label:'Margins expanding', note:'' },
    ]},
    { label:'ENTRY', items:[
      { k:'entry_vcp',   label:'VCP count ≥ 2', note:`${s.vcp?.count}ct` },
      { k:'entry_dryup', label:'Volume dry-up', note:'' },
      { k:'entry_phase', label:'Entry phase confirmed', note:s.kell?.phase },
      { k:'entry_pivot', label:'Near pivot (< 7%)', note:s.vcp?.pivot?`$${fmt(s.vcp.pivot)}`:'—' },
    ]},
    { label:'RISK', items:[
      { k:'risk_stop', label:'Stop defined', note:'User managed' },
      { k:'risk_size', label:'Position sized', note:'' },
      { k:'risk_rr',   label:'R:R acceptable', note:'' },
    ]},
  ]

  // Derive pass/fail from data
  const pass = (k) => {
    if(k==='trend_stage2') return ['2A','2B'].includes(s.wein?.stage)
    if(k==='trend_tpl8') return s.min?.tplScore===8
    if(k==='trend_rs70') return (s.min?.rs??0)>=70
    if(k==='trend_tpl5') return (s.min?.tplScore??0)>=5
    if(k==='trend_kell_ok') return ['EMA Crossback','Pop','Base n Break','Extension','Reversal'].includes(s.kell?.phase)
    if(k==='fund_eps') return (s.min?.eps??0)>15
    if(k==='fund_rev') return (s.min?.rev??0)>10
    if(k==='fund_margins') return s.min?.marginsExpanding
    if(k==='entry_vcp') return (s.vcp?.count??0)>=2
    if(k==='entry_dryup') return s.vcp?.volDryup
    if(k==='entry_phase') return ['EMA Crossback','Pop','Extension'].includes(s.kell?.phase)
    if(k==='entry_pivot') return s.vcp?.pivot&&Math.abs(s.px/s.vcp.pivot-1)<=0.07
    if(k.startsWith('risk_')) return true
    if(k.startsWith('mkt_')) return false // unknown without server data
    return false
  }

  return (
    <div style={{padding:'4px 0'}}>
      {groups.map(g=>(
        <div key={g.label} style={{marginBottom:2}}>
          <div style={{padding:'3px 12px',background:C.p2}}>
            <span style={{fontFamily:FO,fontSize:9,color:C.td,letterSpacing:'1.5px'}}>{g.label}</span>
          </div>
          {g.items.map(it=>{
            const p = pass(it.k)
            return (
              <div key={it.k} style={{display:'flex',justifyContent:'space-between',padding:'4px 12px',
                borderBottom:`1px solid ${C.b1}44`}}>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <span style={{fontFamily:FM,fontSize:11,color:p?C.g:C.r}}>{p?'✓':'✗'}</span>
                  <span style={{fontFamily:FR,fontSize:11,color:C.tx}}>{it.label}</span>
                </div>
                <span style={{fontFamily:FM,fontSize:10,color:C.td}}>{it.note}</span>
              </div>
            )
          })}
        </div>
      ))}
      <div style={{padding:'8px 12px',display:'flex',alignItems:'center',gap:8}}>
        <ScoreBar score={s.conv?.score??0} max={22}/>
        <Pill zone={s.conv?.zone}/>
      </div>
    </div>
  )
}

// ── HOME TAB ───────────────────────────────────────────────────────────────
function HomeTab({ onAnalyze }) {
  const { data:wl, loading:wlL } = useApi('/api/watchlist', 300000)
  const { data:br, loading:brL } = useApi('/api/breadth', 300000)

  const stocks  = wl?.stocks||[]
  const conv    = stocks.filter(s=>s.conv?.zone==='CONVERGENCE')
  const sec     = stocks.filter(s=>s.conv?.zone==='SECONDARY')
  const bld     = stocks.filter(s=>s.conv?.zone==='BUILDING')
  const approaching = stocks.filter(s=>(s.conv?.score??0)>=14&&(s.conv?.score??0)<17)

  const vix = br?.vix??0
  const spxStage = br?.spxStage??'?'
  const spxEma   = br?.spxEma??'?'
  const tplCount = br?.tplCount??0

  const allGood  = spxEma==='above'&&spxStage===2&&tplCount>200
  const verdictColor = allGood?C.g:spxEma==='below'?C.r:C.a
  const verdictText  = allGood?'AGGRESSIVE · ALL 3 ALIGNED · FULL POSITION SIZING':
    spxEma==='below'?'DEFENSIVE · MARKET BELOW 20 EMA · CASH HEAVY':'CAUTIOUS · MIXED SIGNALS · REDUCED SIZE'

  const indices = [
    { k:'spx', label:'SPY',  d:br?.spx },
    { k:'ndx', label:'QQQ',  d:br?.ndx },
    { k:'rut', label:'IWM',  d:br?.rut },
    { k:'vix', label:'VIX',  d:null, vix:true },
  ]

  return (
    <div style={{height:'100%',overflowY:'auto',padding:'8px'}}>
      {/* Market Regime */}
      <div style={{background:C.p1,border:`1px solid ${C.b1}`,borderRadius:10,marginBottom:8,overflow:'hidden'}}>
        <SH label="MARKET REGIME — TRIPLE FRAMEWORK"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'1px',background:C.b1}}>
          {/* Weinstein */}
          <div style={{background:C.p1,padding:'10px 10px'}}>
            <div style={{fontFamily:FO,fontSize:8,color:C.td,letterSpacing:'2px',marginBottom:4}}>WEINSTEIN</div>
            <div style={{fontFamily:FO,fontSize:22,fontWeight:900,color:C.gd}}>{spxStage}</div>
            <div style={{fontFamily:FR,fontSize:10,color:C.tx}}>S&P 500 Stage</div>
            <div style={{fontFamily:FM,fontSize:10,color:C.td,marginTop:2}}>30wk MA</div>
          </div>
          {/* Minervini */}
          <div style={{background:C.p1,padding:'10px 10px'}}>
            <div style={{fontFamily:FO,fontSize:8,color:C.td,letterSpacing:'2px',marginBottom:4}}>MINERVINI</div>
            <div style={{fontFamily:FO,fontSize:22,fontWeight:900,color:C.pu}}>{brL?'…':tplCount}</div>
            <div style={{fontFamily:FR,fontSize:10,color:C.tx}}>TPL Qualifiers</div>
            <div style={{fontFamily:FM,fontSize:10,color:tplCount>200?C.g:C.r,marginTop:2}}>
              {tplCount>200?'▲ IMPROVING':'▼ DECLINING'}
            </div>
          </div>
          {/* Kell */}
          <div style={{background:C.p1,padding:'10px 10px'}}>
            <div style={{fontFamily:FO,fontSize:8,color:C.td,letterSpacing:'2px',marginBottom:4}}>KELL</div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
              <Light color={spxEma==='above'?C.g:C.r}/>
              <span style={{fontFamily:FO,fontSize:16,fontWeight:900,color:spxEma==='above'?C.g:C.r}}>
                {spxEma==='above'?'GREEN':'RED'}
              </span>
            </div>
            <div style={{fontFamily:FR,fontSize:10,color:C.tx}}>SPX vs 20 EMA</div>
          </div>
        </div>
        {/* Verdict */}
        <div style={{padding:'8px 12px',background:`${verdictColor}15`,borderTop:`1px solid ${verdictColor}44`}}>
          <span style={{fontFamily:FO,fontSize:10,fontWeight:700,color:verdictColor,letterSpacing:'1.5px'}}>{verdictText}</span>
        </div>
        {/* Index strip */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1px',background:C.b1,borderTop:`1px solid ${C.b1}`}}>
          {indices.map(idx=>(
            <div key={idx.k} style={{background:C.p1,padding:'7px 8px'}}>
              <div style={{fontFamily:FO,fontSize:9,fontWeight:700,color:C.td,letterSpacing:'1px'}}>{idx.label}</div>
              {idx.vix
                ? <div style={{fontFamily:FM,fontSize:12,color:vix>30?C.r:vix>20?C.a:C.g}}>{fmt(vix,2)}</div>
                : <>
                    <div style={{fontFamily:FM,fontSize:12,color:C.tb}}>{idx.d?.price?`$${fmt(idx.d.price)}`:'—'}</div>
                    <Pct v={idx.d?.chg} size={10}/>
                  </>
              }
            </div>
          ))}
        </div>
      </div>

      {/* Convergence Radar */}
      <SectionGroup label="LONG CONVERGENCE" count={conv.length} color={C.cy}>
        {wlL && <div style={{padding:'20px',textAlign:'center'}}><Spinner/></div>}
        {!wlL && conv.length===0 && <EmptyState msg="No convergence setups in current environment"/>}
        {conv.map(s=><CompactStockRow key={s.tk} s={s} onAnalyze={onAnalyze}/>)}
      </SectionGroup>

      <SectionGroup label="SECONDARY SETUPS" count={sec.length} color={C.bl}>
        {sec.map(s=><CompactStockRow key={s.tk} s={s} onAnalyze={onAnalyze}/>)}
        {!wlL && sec.length===0 && <EmptyState msg="No secondary setups"/>}
      </SectionGroup>

      <SectionGroup label="APPROACHING CONVERGENCE" count={approaching.length} color={C.pu}>
        {approaching.map(s=><CompactStockRow key={s.tk} s={s} onAnalyze={onAnalyze}/>)}
        {!wlL && approaching.length===0 && <EmptyState msg="Nothing approaching threshold"/>}
      </SectionGroup>

      {/* Sector Heatmap */}
      <SectionGroup label="SECTOR HEATMAP" color={C.td}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:1,background:C.b1}}>
          {(br?.sectors||[]).map(sc=>{
            const sc_color = sc.stage==='2A'||sc.stage==='2B'?C.g:sc.stage==='3'?C.a:sc.stage?.startsWith('4')?C.r:C.td
            return (
              <div key={sc.etf} style={{background:C.p1,padding:'7px 10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontFamily:FR,fontSize:11,fontWeight:600,color:C.tb}}>{sc.n}</div>
                  <Badge label={`ST.${sc.stage||'?'}`} color={sc_color}/>
                </div>
                <div style={{textAlign:'right'}}>
                  <Pct v={sc.mp} size={12}/>
                  <div style={{fontFamily:FM,fontSize:10,color:C.td}}>{sc.etf}</div>
                </div>
              </div>
            )
          })}
        </div>
      </SectionGroup>

      {/* Breadth Gauges */}
      <SectionGroup label="BREADTH GAUGES" color={C.td}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,background:C.b1}}>
          <BreadthGauge label="VIX" value={fmt(vix,1)} sub={vix>30?'EXTREME':vix>20?'ELEVATED':'NORMAL'} color={vix>30?C.r:vix>20?C.a:C.g}/>
          <BreadthGauge label="TPL COUNT" value={tplCount} sub={`~${tplCount} stocks`} color={tplCount>200?C.g:C.r}/>
          <BreadthGauge label="SPX vs 20 EMA" value={spxEma?.toUpperCase()||'—'} sub="Kell signal" color={spxEma==='above'?C.g:C.r}/>
          <BreadthGauge label="MKT ENVIRONMENT" value={allGood?'BULL':spxEma==='below'?'BEAR':'MIXED'} sub="Overall" color={verdictColor}/>
        </div>
      </SectionGroup>

      <div style={{height:16}}/>
    </div>
  )
}

function SectionGroup({ label, count, color=C.td, children }) {
  const [collapsed,setCollapsed] = useState(false)
  return (
    <Card style={{marginBottom:8}}>
      <div className="press" onClick={()=>setCollapsed(!collapsed)}
        style={{display:'flex',justifyContent:'space-between',alignItems:'center',
          padding:'9px 12px',borderBottom:`1px solid ${C.b1}`,cursor:'pointer'}}>
        <span style={{fontFamily:FO,fontSize:10,fontWeight:700,letterSpacing:'2px',color,textTransform:'uppercase'}}>{label}</span>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {count!=null && <span style={{fontFamily:FM,fontSize:11,color,background:`${color}22`,
            padding:'2px 7px',borderRadius:10,border:`1px solid ${color}33`}}>{count}</span>}
          <span style={{color:C.td,fontSize:12}}>{collapsed?'▶':'▼'}</span>
        </div>
      </div>
      {!collapsed && children}
    </Card>
  )
}

function CompactStockRow({ s, onAnalyze }) {
  const zone = s.conv?.zone
  const gc = ZC[zone]||C.td
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
      padding:'9px 12px',borderBottom:`1px solid ${C.b1}44`}}>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <span style={{fontFamily:FO,fontSize:14,fontWeight:900,color:gc,minWidth:56}}>{s.tk}</span>
        <div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <span style={{fontFamily:FM,fontSize:12,color:C.tb}}>${fmt(s.px)}</span>
            <Pct v={s.dp} size={11}/>
          </div>
          <span style={{fontFamily:FM,fontSize:10,color:C.td}}>{s.kell?.phase} · RS {s.min?.rs}</span>
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
        <ScoreBar score={s.conv?.score??0} max={22} width={40}/>
        <div style={{display:'flex',gap:6}}>
          {stageBadge(s.wein?.stage)}
          {onAnalyze && <button onClick={()=>onAnalyze(s.tk)}
            style={{fontSize:9,fontFamily:FM,color:C.bl,padding:'1px 5px',border:`1px solid ${C.bl}44`,borderRadius:3}}>
            ▶
          </button>}
        </div>
      </div>
    </div>
  )
}

function BreadthGauge({ label, value, sub, color }) {
  return (
    <div style={{background:C.p1,padding:'10px 12px'}}>
      <div style={{fontFamily:FO,fontSize:8,letterSpacing:'1.5px',color:C.td,marginBottom:3}}>{label}</div>
      <div style={{fontFamily:FO,fontSize:18,fontWeight:900,color}}>{value}</div>
      <div style={{fontFamily:FR,fontSize:10,color:C.tx,marginTop:1}}>{sub}</div>
    </div>
  )
}

function EmptyState({ msg }) {
  return (
    <div style={{padding:'16px 12px',textAlign:'center',fontFamily:FR,fontSize:12,color:C.td}}>{msg}</div>
  )
}

// ── WATCHLIST TAB ──────────────────────────────────────────────────────────
function WatchlistTab({ onAnalyze }) {
  const { data, loading } = useApi('/api/watchlist', 300000)
  const [mode,setMode]   = useState('LONG')
  const [zone,setZone]   = useState('ALL')
  const [sort,setSort]   = useState('SCORE')

  const stocks = (data?.stocks||[])
  const filtered = stocks.filter(s=>{
    if(mode==='SHORT') return ['SHORT_CONVERGENCE','SHORT_SECONDARY'].includes(s.shortConv?.zone)
    if(zone!=='ALL') return s.conv?.zone===zone
    return true
  }).sort((a,b)=>{
    if(sort==='SCORE')  return (b.conv?.score??0)-(a.conv?.score??0)
    if(sort==='RS')     return (b.min?.rs??0)-(a.min?.rs??0)
    if(sort==='WEEK%')  return (b.wp??0)-(a.wp??0)
    if(sort==='MONTH%') return (b.mp??0)-(a.mp??0)
    return 0
  })

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Controls */}
      <div style={{background:C.p1,borderBottom:`1px solid ${C.b1}`,padding:'8px 10px',flexShrink:0}}>
        {/* Mode toggle */}
        <div style={{display:'flex',gap:6,marginBottom:6}}>
          {['LONG','SHORT'].map(m=>(
            <button key={m} onClick={()=>setMode(m)}
              style={{flex:1,padding:'6px',fontFamily:FO,fontSize:10,fontWeight:700,letterSpacing:'1px',
                borderRadius:6,border:`1px solid ${mode===m?C.cy:C.b1}`,
                background:mode===m?`${C.cy}22`:C.p1,color:mode===m?C.cy:C.td,cursor:'pointer'}}>
              {m}
            </button>
          ))}
        </div>
        {/* Zone filter */}
        <div style={{display:'flex',gap:4,overflowX:'auto',marginBottom:5}}>
          {['ALL','CONVERGENCE','SECONDARY','BUILDING','WATCH'].map(z=>(
            <button key={z} onClick={()=>setZone(z)}
              style={{padding:'3px 8px',fontFamily:FM,fontSize:9,fontWeight:700,borderRadius:10,flexShrink:0,
                border:`1px solid ${zone===z?(ZC[z]||C.cy):C.b1}`,
                background:zone===z?`${ZC[z]||C.cy}22`:C.p1,
                color:zone===z?(ZC[z]||C.cy):C.td,cursor:'pointer'}}>
              {z==='ALL'?`ALL (${stocks.length})`:z}
            </button>
          ))}
        </div>
        {/* Sort */}
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          <span style={{fontFamily:FR,fontSize:9,color:C.td,letterSpacing:'1px'}}>SORT:</span>
          {['SCORE','RS','WEEK%','MONTH%'].map(s=>(
            <button key={s} onClick={()=>setSort(s)}
              style={{padding:'2px 7px',fontFamily:FM,fontSize:9,borderRadius:4,
                border:`1px solid ${sort===s?C.bl:C.b1}`,
                background:sort===s?`${C.bl}22`:C.p1,
                color:sort===s?C.bl:C.td,cursor:'pointer'}}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stock list */}
      <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
        {loading && <div style={{padding:'40px',textAlign:'center'}}><Spinner size={32}/></div>}
        {!loading && filtered.length===0 && <EmptyState msg={`No ${mode.toLowerCase()} setups matching filters`}/>}
        {filtered.map(s=><StockCard key={s.tk} s={s} onAnalyze={onAnalyze}/>)}
        <div style={{height:16}}/>
      </div>
    </div>
  )
}

// ── PLAYS TAB ──────────────────────────────────────────────────────────────
const CHECKLIST_ITEMS = [
  { cat:'MARKET',   label:'Market in Stage 2',          auto:true,  key:'mkt_stage' },
  { cat:'MARKET',   label:'SPX above 20 EMA',            auto:true,  key:'mkt_ema' },
  { cat:'MARKET',   label:'VIX < 25',                    auto:true,  key:'mkt_vix' },
  { cat:'MARKET',   label:'TPL count > 300',             auto:true,  key:'mkt_tpl' },
  { cat:'MARKET',   label:'Sector in Stage 2',           auto:false, key:'mkt_sector' },
  { cat:'STOCK',    label:'Stage 2A or 2B',              auto:false, key:'stk_stage' },
  { cat:'STOCK',    label:'Trend template ≥ 6/8',        auto:false, key:'stk_tpl' },
  { cat:'STOCK',    label:'RS Rating ≥ 70',              auto:false, key:'stk_rs' },
  { cat:'STOCK',    label:'RS higher than 3 months ago', auto:false, key:'stk_rs3m' },
  { cat:'STOCK',    label:'Price above all key MAs',     auto:false, key:'stk_ma' },
  { cat:'STOCK',    label:'Volume dry-up visible',       auto:false, key:'stk_vol' },
  { cat:'STOCK',    label:'VCP detected',                auto:false, key:'stk_vcp' },
  { cat:'STOCK',    label:'Near pivot (within 7%)',      auto:false, key:'stk_pivot' },
  { cat:'FUND',     label:'EPS growth > 15%',            auto:false, key:'f_eps' },
  { cat:'FUND',     label:'Revenue growth > 10%',        auto:false, key:'f_rev' },
  { cat:'FUND',     label:'Margins expanding',           auto:false, key:'f_margin' },
  { cat:'FUND',     label:'No negative earnings surprise',auto:false,key:'f_surprise' },
  { cat:'ENTRY',    label:'Kell phase confirmatory',     auto:false, key:'e_kell' },
  { cat:'ENTRY',    label:'Volume expansion on break',   auto:false, key:'e_vol' },
  { cat:'ENTRY',    label:'Not overextended (ADR)',       auto:false, key:'e_adr' },
  { cat:'ENTRY',    label:'Options IV rank < 50',        auto:false, key:'e_iv' },
  { cat:'RISK',     label:'Stop level defined',          auto:false, key:'r_stop' },
  { cat:'RISK',     label:'Position size ≤ 5%',          auto:false, key:'r_size' },
  { cat:'RISK',     label:'R:R ratio ≥ 2:1',             auto:false, key:'r_rr' },
  { cat:'RISK',     label:'Total portfolio heat < 20%',  auto:false, key:'r_heat' },
]

function PlaysTab() {
  const { data, loading, refetch } = useApi('/api/positions', 0)
  const [subTab, setSubTab]   = useState('ACTIVE')
  const [showNew, setShowNew] = useState(false)
  const [checks, setChecks]   = useState({})
  const positions = data?.positions||[]
  const active = positions.filter(p=>p.status==='ACTIVE')

  const toggleCheck = (k) => setChecks(prev=>({...prev,[k]:!prev[k]}))
  const checkScore  = CHECKLIST_ITEMS.filter(i=>checks[i.key]).length

  const deletePos = async (id) => {
    await fetch(`/api/positions/${id}`,{method:'DELETE'})
    refetch()
  }

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Sub-tab bar */}
      <div style={{background:C.p1,borderBottom:`1px solid ${C.b1}`,padding:'0 10px',flexShrink:0,
        display:'flex',gap:4}}>
        {['ACTIVE','CHECKLIST','SHORTS'].map(t=>(
          <button key={t} onClick={()=>setSubTab(t)}
            style={{padding:'10px 12px',fontFamily:FO,fontSize:9,fontWeight:700,letterSpacing:'1px',
              border:'none',background:'none',
              color:subTab===t?C.cy:C.td,
              borderBottom:`2px solid ${subTab===t?C.cy:'transparent'}`,cursor:'pointer'}}>
            {t}
          </button>
        ))}
        <button onClick={()=>setShowNew(true)}
          style={{marginLeft:'auto',padding:'8px 12px',fontFamily:FO,fontSize:9,fontWeight:700,letterSpacing:'1px',
            border:`1px solid ${C.g}44`,background:`${C.g}11`,color:C.g,borderRadius:6,cursor:'pointer'}}>
          + NEW
        </button>
      </div>

      {/* Portfolio bar */}
      {subTab==='ACTIVE' && (
        <div style={{background:C.p2,borderBottom:`1px solid ${C.b1}`,padding:'8px 12px',
          display:'flex',gap:16,flexShrink:0,overflowX:'auto'}}>
          <div><div style={{fontFamily:FO,fontSize:8,color:C.td,letterSpacing:'1.5px'}}>POSITIONS</div>
            <div style={{fontFamily:FO,fontSize:16,fontWeight:900,color:C.cy}}>{active.length}</div></div>
          <div><div style={{fontFamily:FO,fontSize:8,color:C.td,letterSpacing:'1.5px'}}>ACTIVE</div>
            <div style={{fontFamily:FM,fontSize:14,color:C.g}}>{active.filter(p=>p.direction==='LONG').length}L · {active.filter(p=>p.direction==='SHORT').length}S</div></div>
        </div>
      )}

      <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
        {/* Active plays */}
        {subTab==='ACTIVE' && <>
          {loading && <div style={{padding:'40px',textAlign:'center'}}><Spinner size={32}/></div>}
          {!loading && active.length===0 && <EmptyState msg="No active positions. Tap + NEW to add one."/>}
          {active.map(p=><PositionCard key={p.id} p={p} onDelete={()=>deletePos(p.id)} onRefetch={refetch}/>)}
          <div style={{height:16}}/>
        </>}

        {/* Checklist */}
        {subTab==='CHECKLIST' && (
          <div>
            <Card style={{marginBottom:8,padding:'12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontFamily:FO,fontSize:11,fontWeight:700,color:C.cy}}>PRE-TRADE CHECKLIST</span>
                <ScoreBar score={checkScore} max={25} width={60}/>
              </div>
              {['MARKET','STOCK','FUND','ENTRY','RISK'].map(cat=>(
                <div key={cat} style={{marginBottom:6}}>
                  <div style={{fontFamily:FO,fontSize:9,color:C.td,letterSpacing:'1.5px',padding:'4px 0',
                    borderBottom:`1px solid ${C.b1}`,marginBottom:4}}>{cat}</div>
                  {CHECKLIST_ITEMS.filter(i=>i.cat===cat).map(item=>(
                    <div key={item.key} className="press" onClick={()=>toggleCheck(item.key)}
                      style={{display:'flex',gap:10,alignItems:'center',padding:'6px 4px',cursor:'pointer',
                        borderBottom:`1px solid ${C.b1}22`}}>
                      <div style={{width:18,height:18,borderRadius:4,flexShrink:0,
                        border:`2px solid ${checks[item.key]?C.g:C.b2}`,
                        background:checks[item.key]?C.g:C.p1,
                        display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {checks[item.key] && <span style={{fontSize:10,color:C.bg,fontWeight:900}}>✓</span>}
                      </div>
                      <span style={{fontFamily:FR,fontSize:12,color:checks[item.key]?C.tb:C.tx,fontWeight:500}}>{item.label}</span>
                      {item.auto && <span style={{fontFamily:FM,fontSize:8,color:C.bl,marginLeft:'auto'}}>AUTO</span>}
                    </div>
                  ))}
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Shorts */}
        {subTab==='SHORTS' && (
          <div>
            {positions.filter(p=>p.direction==='SHORT'&&p.status==='ACTIVE').map(p=>
              <PositionCard key={p.id} p={p} onDelete={()=>deletePos(p.id)} onRefetch={refetch}/>
            )}
            {positions.filter(p=>p.direction==='SHORT'&&p.status==='ACTIVE').length===0 &&
              <EmptyState msg="No active short positions"/>}
          </div>
        )}
      </div>

      {/* New Position Modal */}
      {showNew && <NewPositionModal onClose={()=>setShowNew(false)} onSaved={()=>{setShowNew(false);refetch()}}/>}
    </div>
  )
}

function PositionCard({ p, onDelete, onRefetch }) {
  const [expanded, setExpanded] = useState(false)
  const [newStop, setNewStop]   = useState('')
  const dir = p.direction==='LONG'
  const dirColor = dir?C.g:C.em

  const updateStop = async () => {
    if(!newStop) return
    await fetch(`/api/positions/${p.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({currentStop:parseFloat(newStop)})})
    setNewStop('')
    onRefetch()
  }

  return (
    <Card style={{marginBottom:8}} glow={dirColor}>
      <div className="press" onClick={()=>setExpanded(!expanded)}
        style={{padding:'10px 12px',cursor:'pointer'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{fontFamily:FO,fontSize:18,fontWeight:900,color:dirColor}}>{p.ticker}</span>
            <Badge label={p.direction} color={dirColor}/>
          </div>
          <div style={{fontFamily:FM,fontSize:10,color:C.td}}>{p.entryDate?.split('T')[0]}</div>
        </div>
        <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
          <div><div style={{fontFamily:FR,fontSize:9,color:C.td}}>ENTRY</div>
            <div style={{fontFamily:FM,fontSize:13,color:C.tb}}>${fmt(p.entryPrice)}</div></div>
          <div><div style={{fontFamily:FR,fontSize:9,color:C.td}}>STOP</div>
            <div style={{fontFamily:FM,fontSize:13,color:C.r}}>${fmt(p.currentStop||p.stopLevel)}</div></div>
          {p.target1 && <div><div style={{fontFamily:FR,fontSize:9,color:C.td}}>T1</div>
            <div style={{fontFamily:FM,fontSize:13,color:C.g}}>${fmt(p.target1)}</div></div>}
          {p.target2 && <div><div style={{fontFamily:FR,fontSize:9,color:C.td}}>T2</div>
            <div style={{fontFamily:FM,fontSize:13,color:C.g}}>${fmt(p.target2)}</div></div>}
          {p.optionStrike && <div><div style={{fontFamily:FR,fontSize:9,color:C.td}}>OPTION</div>
            <div style={{fontFamily:FM,fontSize:12,color:C.pu}}>${p.optionStrike}{dir?'C':'P'} {p.optionExpiry}</div></div>}
        </div>
        {p.notes && <div style={{fontFamily:FR,fontSize:11,color:C.tx,marginTop:4}}>{p.notes}</div>}
      </div>
      {expanded && (
        <div style={{borderTop:`1px solid ${C.b1}`,padding:'10px 12px',animation:'fadeIn 0.15s ease'}}>
          {/* Move stop */}
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <input value={newStop} onChange={e=>setNewStop(e.target.value)} placeholder="Move stop to..."
              style={{flex:1,padding:'6px 10px',background:C.p3,border:`1px solid ${C.b2}`,borderRadius:6,
                fontFamily:FM,fontSize:12,color:C.tb}}/>
            <button onClick={updateStop}
              style={{padding:'6px 12px',background:`${C.a}22`,border:`1px solid ${C.a}44`,
                borderRadius:6,fontFamily:FO,fontSize:9,color:C.a,fontWeight:700}}>
              MOVE STOP
            </button>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={onDelete}
              style={{flex:1,padding:'8px',background:`${C.r}15`,border:`1px solid ${C.r}44`,
                borderRadius:6,fontFamily:FO,fontSize:9,color:C.r,fontWeight:700}}>
              CLOSE POSITION
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

function NewPositionModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    ticker:'', direction:'LONG', entryPrice:'', stopLevel:'', target1:'', target2:'',
    optionStrike:'', optionExpiry:'', contracts:'1', notes:'', premiumPaid:'',
  })
  const set = (k,v) => setForm(p=>({...p,[k]:v}))
  const submit = async () => {
    if(!form.ticker||!form.entryPrice||!form.stopLevel) return
    const body = { ...form, entryPrice:+form.entryPrice, stopLevel:+form.stopLevel,
      target1:form.target1?+form.target1:null, target2:form.target2?+form.target2:null,
      optionStrike:form.optionStrike?+form.optionStrike:null, contracts:+form.contracts||1,
      premiumPaid:form.premiumPaid?+form.premiumPaid:null }
    await fetch('/api/positions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    onSaved()
  }

  const iStyle = {padding:'8px 10px',background:C.p3,border:`1px solid ${C.b2}`,borderRadius:6,
    fontFamily:FM,fontSize:13,color:C.tb,width:'100%'}

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(2,4,8,0.92)',zIndex:100,
      display:'flex',alignItems:'flex-end',animation:'fadeIn 0.15s ease'}}>
      <div style={{width:'100%',background:C.p1,borderRadius:'16px 16px 0 0',
        border:`1px solid ${C.b2}`,padding:'16px',animation:'slideUp 0.2s ease',
        maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <span style={{fontFamily:FO,fontSize:13,fontWeight:700,color:C.cy,letterSpacing:'2px'}}>NEW POSITION</span>
          <button onClick={onClose} style={{color:C.td,fontSize:20}}>✕</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div><label style={{fontFamily:FR,fontSize:10,color:C.td,letterSpacing:'1px'}}>TICKER</label>
            <input value={form.ticker} onChange={e=>set('ticker',e.target.value.toUpperCase())} style={iStyle} placeholder="NVDA"/></div>
          <div><label style={{fontFamily:FR,fontSize:10,color:C.td,letterSpacing:'1px'}}>DIRECTION</label>
            <select value={form.direction} onChange={e=>set('direction',e.target.value)}
              style={{...iStyle,appearance:'none'}}>
              <option>LONG</option><option>SHORT</option>
            </select></div>
          <div><label style={{fontFamily:FR,fontSize:10,color:C.td,letterSpacing:'1px'}}>ENTRY PRICE</label>
            <input type="number" value={form.entryPrice} onChange={e=>set('entryPrice',e.target.value)} style={iStyle} placeholder="0.00"/></div>
          <div><label style={{fontFamily:FR,fontSize:10,color:C.td,letterSpacing:'1px'}}>STOP LEVEL</label>
            <input type="number" value={form.stopLevel} onChange={e=>set('stopLevel',e.target.value)} style={iStyle} placeholder="0.00"/></div>
          <div><label style={{fontFamily:FR,fontSize:10,color:C.td,letterSpacing:'1px'}}>TARGET 1</label>
            <input type="number" value={form.target1} onChange={e=>set('target1',e.target.value)} style={iStyle} placeholder="0.00"/></div>
          <div><label style={{fontFamily:FR,fontSize:10,color:C.td,letterSpacing:'1px'}}>TARGET 2</label>
            <input type="number" value={form.target2} onChange={e=>set('target2',e.target.value)} style={iStyle} placeholder="0.00"/></div>
          <div><label style={{fontFamily:FR,fontSize:10,color:C.td,letterSpacing:'1px'}}>OPTION STRIKE</label>
            <input type="number" value={form.optionStrike} onChange={e=>set('optionStrike',e.target.value)} style={iStyle} placeholder="Optional"/></div>
          <div><label style={{fontFamily:FR,fontSize:10,color:C.td,letterSpacing:'1px'}}>OPTION EXPIRY</label>
            <input value={form.optionExpiry} onChange={e=>set('optionExpiry',e.target.value)} style={iStyle} placeholder="2026-04-17"/></div>
          <div><label style={{fontFamily:FR,fontSize:10,color:C.td,letterSpacing:'1px'}}>CONTRACTS</label>
            <input type="number" value={form.contracts} onChange={e=>set('contracts',e.target.value)} style={iStyle} placeholder="1"/></div>
          <div><label style={{fontFamily:FR,fontSize:10,color:C.td,letterSpacing:'1px'}}>PREMIUM PAID</label>
            <input type="number" value={form.premiumPaid} onChange={e=>set('premiumPaid',e.target.value)} style={iStyle} placeholder="Optional"/></div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontFamily:FR,fontSize:10,color:C.td,letterSpacing:'1px'}}>NOTES</label>
          <input value={form.notes} onChange={e=>set('notes',e.target.value)} style={iStyle} placeholder="Setup thesis..."/>
        </div>

        {/* R:R calc */}
        {form.entryPrice&&form.stopLevel&&form.target1 && (
          <div style={{background:C.p2,borderRadius:6,padding:'8px 12px',marginBottom:12,
            display:'flex',gap:16}}>
            <div><div style={{fontFamily:FR,fontSize:9,color:C.td}}>RISK</div>
              <div style={{fontFamily:FM,fontSize:12,color:C.r}}>{fmt((form.entryPrice-form.stopLevel)/form.entryPrice*100,1)}%</div></div>
            <div><div style={{fontFamily:FR,fontSize:9,color:C.td}}>REWARD T1</div>
              <div style={{fontFamily:FM,fontSize:12,color:C.g}}>{fmt((form.target1-form.entryPrice)/form.entryPrice*100,1)}%</div></div>
            <div><div style={{fontFamily:FR,fontSize:9,color:C.td}}>R:R</div>
              <div style={{fontFamily:FM,fontSize:12,color:C.cy}}>{fmt((form.target1-form.entryPrice)/Math.abs(form.entryPrice-form.stopLevel),1)}:1</div></div>
          </div>
        )}

        <button onClick={submit}
          style={{width:'100%',padding:'12px',background:`${C.g}22`,border:`1px solid ${C.g}55`,
            borderRadius:8,fontFamily:FO,fontSize:11,fontWeight:700,color:C.g,letterSpacing:'1px'}}>
          OPEN POSITION
        </button>
      </div>
    </div>
  )
}

// ── BRIEF TAB ──────────────────────────────────────────────────────────────
function BriefTab() {
  const { data, loading, error, refetch } = useApi('/api/daily-brief', 1800000)

  const renderBrief = (text) => {
    if(!text) return null
    return text.split('\n').map((line,i)=>{
      if(line.startsWith('# ')) return (
        <div key={i} style={{fontFamily:FO,fontSize:13,fontWeight:700,color:C.cy,letterSpacing:'2px',
          padding:'12px 0 6px',borderBottom:`1px solid ${C.b1}`,marginBottom:8}}>
          {line.replace(/^# /,'')}
        </div>
      )
      if(line.startsWith('## ')) return (
        <div key={i} style={{fontFamily:FO,fontSize:11,fontWeight:700,color:C.gd,letterSpacing:'1.5px',
          padding:'10px 0 4px',marginTop:4}}>
          {line.replace(/^## /,'')}
        </div>
      )
      if(line.startsWith('### ')) return (
        <div key={i} style={{fontFamily:FR,fontSize:12,fontWeight:700,color:C.bl,
          padding:'6px 0 2px',marginTop:2}}>
          {line.replace(/^### /,'')}
        </div>
      )
      if(line.startsWith('- ')) {
        const content = line.replace(/^- /,'')
        const parts = content.split(/(\*\*[^*]+\*\*)/)
        return (
          <div key={i} style={{display:'flex',gap:8,padding:'3px 0',alignItems:'flex-start'}}>
            <span style={{color:C.cy,fontFamily:FM,fontSize:10,flexShrink:0,marginTop:2}}>▸</span>
            <span style={{fontFamily:FR,fontSize:12,color:C.tx,lineHeight:1.5}}>
              {parts.map((p,j)=>p.startsWith('**')
                ? <strong key={j} style={{color:C.tb,fontWeight:600}}>{p.replace(/\*\*/g,'')}</strong>
                : p)}
            </span>
          </div>
        )
      }
      if(line.trim()==='') return <div key={i} style={{height:6}}/>
      return <div key={i} style={{fontFamily:FR,fontSize:12,color:C.tx,lineHeight:1.6,padding:'1px 0'}}>{line}</div>
    })
  }

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.p1,borderBottom:`1px solid ${C.b1}`,padding:'10px 12px',
        display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <div>
          <div style={{fontFamily:FO,fontSize:12,fontWeight:700,color:C.cy,letterSpacing:'2px'}}>MORNING BRIEF</div>
          <div style={{fontFamily:FM,fontSize:10,color:C.td}}>
            {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : 'Not yet generated'}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {data?.content?.length>500 && <Badge label="AI ENHANCED" color={C.pu}/>}
          <button onClick={refetch}
            style={{padding:'6px 12px',background:`${C.bl}22`,border:`1px solid ${C.bl}44`,
              borderRadius:6,fontFamily:FO,fontSize:9,color:C.bl,fontWeight:700}}>
            REFRESH
          </button>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'12px'}}>
        {loading && <div style={{padding:'60px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
          <Spinner size={28}/>
          <span style={{fontFamily:FR,fontSize:12,color:C.td}}>Generating brief...</span>
        </div>}
        {error && <div style={{padding:'20px',fontFamily:FR,fontSize:12,color:C.r}}>Error: {error}</div>}
        {data?.content && <div style={{animation:'fadeIn 0.3s ease'}}>{renderBrief(data.content)}</div>}
        <div style={{height:24}}/>
      </div>
    </div>
  )
}

// ── MORE TAB ───────────────────────────────────────────────────────────────
function MoreTab({ onAnalyze }) {
  const [panel, setPanel] = useState(null)
  const panels = [
    { id:'analyze',  icon:'🔍', label:'ANALYZE',  color:C.cy },
    { id:'news',     icon:'📡', label:'NEWS',      color:C.bl },
    { id:'breadth',  icon:'📊', label:'BREADTH',   color:C.pu },
    { id:'risk',     icon:'⚠️',  label:'RISK',      color:C.r  },
    { id:'journal',  icon:'📒', label:'JOURNAL',   color:C.gd },
    { id:'screener', icon:'🎯', label:'SCREENER',  color:C.g  },
  ]

  return (
    <div style={{height:'100%',overflowY:'auto',padding:'8px'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
        {panels.map(p=>(
          <button key={p.id} className="press" onClick={()=>setPanel(p.id)}
            style={{background:C.p1,border:`1px solid ${p.color}33`,borderRadius:12,padding:'20px 12px',
              display:'flex',flexDirection:'column',alignItems:'center',gap:8,cursor:'pointer'}}>
            <span style={{fontSize:28}}>{p.icon}</span>
            <span style={{fontFamily:FO,fontSize:10,fontWeight:700,color:p.color,letterSpacing:'2px'}}>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Panels */}
      {panel==='analyze'  && <FullPanel title="ANALYZE" color={C.cy} onBack={()=>setPanel(null)}><AnalyzePanel/></FullPanel>}
      {panel==='news'     && <FullPanel title="NEWS" color={C.bl} onBack={()=>setPanel(null)}><NewsPanel/></FullPanel>}
      {panel==='breadth'  && <FullPanel title="MARKET BREADTH" color={C.pu} onBack={()=>setPanel(null)}><BreadthPanel/></FullPanel>}
      {panel==='risk'     && <FullPanel title="RISK / DIVERGENCE" color={C.r} onBack={()=>setPanel(null)}><RiskPanel/></FullPanel>}
      {panel==='journal'  && <FullPanel title="TRADE JOURNAL" color={C.gd} onBack={()=>setPanel(null)}><JournalPanel/></FullPanel>}
      {panel==='screener' && <FullPanel title="SCREENER" color={C.g} onBack={()=>setPanel(null)}><ScreenerPanel/></FullPanel>}
    </div>
  )
}

function FullPanel({ title, color, onBack, children }) {
  return (
    <div style={{position:'fixed',inset:0,background:C.bg,zIndex:50,
      display:'flex',flexDirection:'column',animation:'slideUp 0.2s ease'}}>
      <div style={{background:C.p1,borderBottom:`1px solid ${color}44`,padding:'12px 14px',
        display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <button onClick={onBack}
          style={{fontFamily:FO,fontSize:10,color,padding:'4px 10px',
            border:`1px solid ${color}44`,borderRadius:6,background:`${color}11`}}>
          ◀ BACK
        </button>
        <span style={{fontFamily:FO,fontSize:12,fontWeight:700,color,letterSpacing:'2px'}}>{title}</span>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {children}
        <div style={{height:24}}/>
      </div>
    </div>
  )
}

// ── ANALYZE PANEL ──────────────────────────────────────────────────────────
const WATCHLIST_TICKERS = [
  'NVDA','AVGO','TSLA','AAPL','MSFT','GOOGL','META','AMZN','AMD','CRM',
  'PLTR','CRWD','PANW','NET','DDOG','APP','AXON','COIN','MELI','SHOP',
  'SNOW','NOW','ADBE','ORCL','TSM','ASML','KLAC','LRCX','AMAT','MRVL',
  'LLY','UNH','ISRG','VRTX','GE','CAT','DE','LMT','XOM','COST',
  'WMT','HD','V','MA','GS','JPM','TSEM','RKLB','DELL','CF',
  'GKOS','CELH','DUOL','HIMS','TOST','DECK','CMG','LULU','ON','MPWR',
]

function AnalyzePanel({ initialTicker }) {
  const [query, setQuery]   = useState('')
  const [ticker, setTicker] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('mkw_recent_searches')||'[]') } catch { return [] }
  })

  useEffect(()=>{ if(initialTicker) analyze(initialTicker) },[initialTicker])

  const suggestions = query.length>=1
    ? WATCHLIST_TICKERS.filter(t=>t.startsWith(query.toUpperCase())).slice(0,6)
    : []

  const analyze = async (tk) => {
    if(!tk) return
    setTicker(tk)
    setLoading(true)
    setResult(null)
    try {
      const r = await fetch(`/api/analyze/${tk}`)
      const d = await r.json()
      setResult(d)
      const updated = [tk,...recent.filter(x=>x!==tk)].slice(0,10)
      setRecent(updated)
      localStorage.setItem('mkw_recent_searches', JSON.stringify(updated))
    } catch(e) { setResult({error:e.message}) }
    setLoading(false)
    setQuery('')
  }

  const zone = result?.conv?.zone
  const zc   = ZC[zone]||C.td

  return (
    <div style={{padding:'12px'}}>
      {/* Search */}
      <div style={{position:'relative',marginBottom:8}}>
        <input value={query} onChange={e=>setQuery(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==='Enter'&&analyze(query)}
          placeholder="Enter ticker symbol..."
          style={{width:'100%',padding:'12px 14px',background:C.p2,border:`1px solid ${C.b2}`,
            borderRadius:10,fontFamily:FO,fontSize:16,fontWeight:700,color:C.tb,letterSpacing:'2px'}}/>
        {query && (
          <button onClick={()=>analyze(query)}
            style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',
              padding:'6px 12px',background:`${C.cy}22`,border:`1px solid ${C.cy}44`,
              borderRadius:6,fontFamily:FO,fontSize:9,color:C.cy,fontWeight:700}}>
            ANALYZE
          </button>
        )}
        {suggestions.length>0 && (
          <div style={{position:'absolute',top:'100%',left:0,right:0,background:C.p2,
            border:`1px solid ${C.b2}`,borderRadius:8,zIndex:10,overflow:'hidden',marginTop:2}}>
            {suggestions.map(s=>(
              <div key={s} className="press" onClick={()=>analyze(s)}
                style={{padding:'10px 14px',fontFamily:FO,fontSize:13,color:C.cy,
                  borderBottom:`1px solid ${C.b1}`,cursor:'pointer'}}>
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent */}
      {recent.length>0 && !result && !loading && (
        <div style={{marginBottom:12}}>
          <div style={{fontFamily:FO,fontSize:9,color:C.td,letterSpacing:'1.5px',marginBottom:6}}>RECENT</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {recent.map(r=>(
              <button key={r} onClick={()=>analyze(r)}
                style={{padding:'4px 10px',fontFamily:FO,fontSize:11,fontWeight:700,
                  background:C.p2,border:`1px solid ${C.b2}`,borderRadius:6,color:C.tb,cursor:'pointer'}}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={{padding:'60px',textAlign:'center',display:'flex',flexDirection:'column',
        alignItems:'center',gap:12}}>
        <Spinner size={28}/>
        <span style={{fontFamily:FO,fontSize:10,color:C.td,letterSpacing:'2px'}}>ANALYZING {ticker}...</span>
      </div>}

      {result?.error && <div style={{padding:'20px',fontFamily:FR,fontSize:12,color:C.r}}>Error: {result.error}</div>}

      {result && !result.error && (
        <div style={{animation:'fadeIn 0.3s ease'}}>
          {/* Full StockCard */}
          <StockCard s={result}/>

          {/* Technical Indicators */}
          {result.technicals && (
            <Card style={{marginBottom:8}}>
              <SH label="TECHNICAL INDICATORS"/>
              <DR label="RSI (14)" value={fmt(result.technicals.rsi,1)}
                color={result.technicals.rsi>70?C.r:result.technicals.rsi<30?C.g:C.tb}
                right={result.technicals.rsi>70?<Badge label="OVERBOUGHT" color={C.r}/>:result.technicals.rsi<30?<Badge label="OVERSOLD" color={C.g}/>:null}/>
              <DR label="MACD Line" value={fmt(result.technicals.macd?.line,3)}
                color={result.technicals.macd?.bullish?C.g:C.r}/>
              <DR label="MACD Signal" value={fmt(result.technicals.macd?.signal,3)}/>
              <DR label="MACD Histogram" value={fmt(result.technicals.macd?.histogram,3)}
                color={result.technicals.macd?.bullish?C.g:C.r}
                right={result.technicals.macd?.crossing_up?<Badge label="CROSS↑" color={C.g}/>:null}/>
              <DR label="ADX (trend strength)" value={fmt(result.technicals.adx,1)}
                color={result.technicals.adx>25?C.g:C.td}
                right={result.technicals.adx>25?<Badge label="TRENDING" color={C.g}/>:null}/>
              <DR label="Stochastic %K / %D"
                value={`${fmt(result.technicals.stoch?.k,1)} / ${fmt(result.technicals.stoch?.d,1)}`}/>
              <DR label="OBV Trend" value={result.technicals.obv_trend?.toUpperCase()||'—'}
                color={result.technicals.obv_trend==='rising'?C.g:C.r}/>
              <DR label="BB Width" value={`${fmt(result.technicals.bb?.width_pct,1)}%`}
                right={result.technicals.bb?.squeeze?<Badge label="SQUEEZE" color={C.cy}/>:null}/>
              <Sep/>
              <div style={{padding:'6px 12px'}}>
                <div style={{fontFamily:FO,fontSize:9,color:C.td,letterSpacing:'1.5px',marginBottom:4}}>MOVING AVERAGES</div>
                {[['EMA 10',result.technicals.mas?.ema10],['EMA 20',result.technicals.mas?.ema20],
                  ['SMA 50',result.technicals.mas?.sma50],['SMA 150',result.technicals.mas?.sma150],
                  ['SMA 200',result.technicals.mas?.sma200]].map(([l,v])=>{
                  const above = v&&result.px>v
                  return <DR key={l} label={l} value={v?`$${fmt(v)}`:'—'}
                    color={above?C.g:C.r}
                    right={<span style={{fontFamily:FM,fontSize:10,color:above?C.g:C.r}}>{above?'▲ ABOVE':'▼ BELOW'}</span>}/>
                })}
              </div>
              <DR label="52w High" value={`$${fmt(result.technicals.high52)}`}/>
              <DR label="52w Low" value={`$${fmt(result.technicals.low52)}`}/>
              <DR label="% from 52w High" value={`${fmt(result.technicals.pctFrom52h,1)}%`} color={C.r}/>
              <DR label="ADR %" value={`${fmt(result.technicals.adr_pct,1)}%`}/>
            </Card>
          )}

          {/* Support & Resistance */}
          {result.srLevels?.length>0 && (
            <Card style={{marginBottom:8}}>
              <SH label="SUPPORT & RESISTANCE"/>
              {result.srLevels.map((lvl,i)=>{
                const isAbove = lvl.price>result.px
                return (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 12px',
                    borderBottom:`1px solid ${C.b1}44`,
                    background:Math.abs(lvl.price-result.px)/result.px<0.03?`${C.cy}11`:'transparent'}}>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <Badge label={lvl.type} color={isAbove?C.r:C.g}/>
                      <span style={{fontFamily:FR,fontSize:11,color:C.tx}}>{lvl.label}</span>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:FM,fontSize:12,color:C.tb}}>${fmt(lvl.price)}</div>
                      <div style={{fontFamily:FM,fontSize:10,color:C.td}}>
                        {fmt((lvl.price-result.px)/result.px*100,1)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </Card>
          )}

          {/* Trade Setup */}
          {(result.conv?.score>=12) && (
            <Card style={{marginBottom:8}} glow={zc}>
              <SH label="TRADE SETUP GENERATOR"/>
              <div style={{padding:'10px 12px'}}>
                <div style={{fontFamily:FR,fontSize:12,color:C.tx,lineHeight:1.6,marginBottom:8}}>{result.setup}</div>
                <DR label="Entry" value={result.vcp?.pivot?`$${fmt(result.vcp.pivot)} (pivot)`:`$${fmt(result.px)} (market)`} color={C.g}/>
                <DR label="Stop" value={result.vcp?.pivot?`$${fmt(result.vcp.pivot*0.93)} (-7% from pivot)`:'8% below entry'} color={C.r}/>
                <DR label="Target 1" value={result.vcp?.pivot?`$${fmt(result.vcp.pivot*1.15)} (+15%)`:'+15%'} color={C.g}/>
                <DR label="Target 2" value={result.vcp?.pivot?`$${fmt(result.vcp.pivot*1.25)} (+25%)`:'+25%'} color={C.g}/>
                <DR label="Option play" value={result.optPlay||'—'} color={C.pu}/>
              </div>
            </Card>
          )}

          {/* Verdict */}
          <div style={{background:`${zc}22`,border:`1px solid ${zc}55`,borderRadius:10,
            padding:'14px 16px',marginBottom:8,textAlign:'center'}}>
            <div style={{fontFamily:FO,fontSize:16,fontWeight:900,color:zc,letterSpacing:'3px',marginBottom:4}}>
              {zone||'UNKNOWN'}
            </div>
            <div style={{fontFamily:FR,fontSize:12,color:C.tx}}>{result.setup}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── NEWS PANEL ─────────────────────────────────────────────────────────────
function NewsPanel() {
  const { data, loading } = useApi('/api/news', 900000)
  const [mode, setMode] = useState('WATCHLIST')

  const items = mode==='WATCHLIST'
    ? (data?.watchlistAlerts||[])
    : (data?.marketNews||[])

  return (
    <div style={{padding:'8px'}}>
      <div style={{display:'flex',gap:6,marginBottom:8}}>
        {['WATCHLIST','MARKET'].map(m=>(
          <button key={m} onClick={()=>setMode(m)}
            style={{flex:1,padding:'8px',fontFamily:FO,fontSize:10,fontWeight:700,letterSpacing:'1px',
              border:`1px solid ${mode===m?C.bl:C.b1}`,background:mode===m?`${C.bl}22`:C.p1,
              color:mode===m?C.bl:C.td,borderRadius:6,cursor:'pointer'}}>
            {m}
          </button>
        ))}
      </div>
      {loading && <div style={{padding:'40px',textAlign:'center'}}><Spinner/></div>}
      {!data?.watchlistAlerts && !loading && (
        <EmptyState msg="No news data. Configure FINNHUB_API_KEY for live news."/>
      )}
      {items.map((n,i)=><NewsItem key={i} n={n}/>)}
    </div>
  )
}

function NewsItem({ n }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Card style={{marginBottom:6}} onClick={()=>setExpanded(!expanded)}>
      <div style={{padding:'10px 12px'}}>
        {n.ticker && <Badge label={n.ticker} color={C.cy}/>}
        <div style={{fontFamily:FR,fontSize:13,fontWeight:600,color:C.tb,lineHeight:1.4,
          margin:'4px 0',marginTop:n.ticker?6:0}}>
          {n.headline}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontFamily:FM,fontSize:10,color:C.td}}>{n.source}</span>
          <span style={{fontFamily:FM,fontSize:10,color:C.td}}>·</span>
          <span style={{fontFamily:FM,fontSize:10,color:C.td}}>{timeAgo(n.time)}</span>
        </div>
        {expanded && n.summary && (
          <div style={{fontFamily:FR,fontSize:12,color:C.tx,lineHeight:1.5,marginTop:8,
            borderTop:`1px solid ${C.b1}`,paddingTop:8}}>
            {n.summary}
          </div>
        )}
      </div>
    </Card>
  )
}

// ── BREADTH PANEL ──────────────────────────────────────────────────────────
function BreadthPanel() {
  const { data, loading } = useApi('/api/breadth', 300000)
  if(loading) return <div style={{padding:'40px',textAlign:'center'}}><Spinner size={32}/></div>

  const indices = [
    { label:'S&P 500', key:'spx', d:data?.spx },
    { label:'NASDAQ',  key:'ndx', d:data?.ndx },
    { label:'RUSSELL', key:'rut', d:data?.rut },
  ]

  return (
    <div style={{padding:'8px'}}>
      {/* Index cards */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:8}}>
        {indices.map(idx=>{
          const stageColor = idx.d?.stage===2?C.g:idx.d?.stage===3?C.a:idx.d?.stage>=4?C.r:C.td
          return (
            <Card key={idx.key} style={{padding:'10px 10px'}}>
              <div style={{fontFamily:FO,fontSize:8,color:C.td,letterSpacing:'1.5px',marginBottom:4}}>{idx.label}</div>
              <div style={{fontFamily:FM,fontSize:13,color:C.tb,fontWeight:600}}>${fmt(idx.d?.price)}</div>
              <Pct v={idx.d?.chg} size={11}/>
              <div style={{marginTop:4,display:'flex',gap:4,flexWrap:'wrap'}}>
                <Badge label={`ST.${idx.d?.stage??'?'}`} color={stageColor}/>
                <Badge label={idx.d?.ema20==='above'?'↑ EMA':'↓ EMA'} color={idx.d?.ema20==='above'?C.g:C.r}/>
              </div>
            </Card>
          )
        })}
      </div>

      {/* VIX + TPL */}
      <Card style={{marginBottom:8,padding:'12px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <div style={{fontFamily:FO,fontSize:9,color:C.td,letterSpacing:'1.5px',marginBottom:4}}>VIX</div>
            <div style={{fontFamily:FO,fontSize:28,fontWeight:900,
              color:data?.vix>30?C.r:data?.vix>20?C.a:C.g}}>{fmt(data?.vix,1)}</div>
            <div style={{fontFamily:FR,fontSize:10,color:C.tx}}>
              {data?.vix>30?'EXTREME FEAR':data?.vix>20?'ELEVATED':'LOW / NORMAL'}
            </div>
          </div>
          <div>
            <div style={{fontFamily:FO,fontSize:9,color:C.td,letterSpacing:'1.5px',marginBottom:4}}>TPL COUNT</div>
            <div style={{fontFamily:FO,fontSize:28,fontWeight:900,
              color:data?.tplCount>200?C.g:C.r}}>{data?.tplCount??0}</div>
            <div style={{fontFamily:FR,fontSize:10,color:C.tx}}>Passing 8-pt Template</div>
            <ScoreBar score={Math.min(data?.tplCount??0,500)} max={500} width={80} color={data?.tplCount>200?C.g:C.r}/>
          </div>
        </div>
      </Card>

      {/* Sector grid */}
      <SectionGroup label="SECTOR PERFORMANCE" color={C.pu}>
        {(data?.sectors||[]).map(sc=>{
          const c = sc.stage==='2A'||sc.stage==='2B'?C.g:sc.stage==='3'?C.a:sc.stage?.startsWith('4')?C.r:C.td
          return (
            <div key={sc.etf} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'8px 12px',borderBottom:`1px solid ${C.b1}44`}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <Badge label={`ST.${sc.stage||'?'}`} color={c}/>
                <span style={{fontFamily:FR,fontSize:12,fontWeight:600,color:C.tb}}>{sc.n}</span>
              </div>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <Pct v={sc.wp} size={11}/>
                <Pct v={sc.mp} size={11}/>
                <span style={{fontFamily:FM,fontSize:9,color:C.td}}>{sc.etf}</span>
              </div>
            </div>
          )
        })}
      </SectionGroup>
    </div>
  )
}

// ── RISK PANEL ─────────────────────────────────────────────────────────────
function RiskPanel() {
  const { data, loading } = useApi('/api/threats', 300000)
  const threats = data?.threats||[]

  return (
    <div style={{padding:'8px'}}>
      {loading && <div style={{padding:'40px',textAlign:'center'}}><Spinner size={32}/></div>}
      {!loading && threats.length===0 && <EmptyState msg="No active threats detected"/>}
      {threats.map(t=>(
        <Card key={t.tk} style={{marginBottom:8}} glow={C.r}>
          <div style={{padding:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div>
                <span style={{fontFamily:FO,fontSize:18,fontWeight:900,color:C.r}}>{t.tk}</span>
                <div style={{fontFamily:FR,fontSize:11,color:C.tx,marginTop:2}}>{t.type}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:FO,fontSize:9,color:C.td,marginBottom:2}}>THREAT SCORE</div>
                <ScoreBar score={t.sc*2||0} max={20} color={C.r}/>
              </div>
            </div>
            {(t.divSignals||[]).map((sig,i)=>(
              <div key={i} style={{display:'flex',gap:6,padding:'3px 0'}}>
                <span style={{color:C.r,fontFamily:FM,fontSize:10}}>▸</span>
                <span style={{fontFamily:FR,fontSize:11,color:C.tx}}>{sig}</span>
              </div>
            ))}
            <div style={{marginTop:6,display:'flex',gap:8,flexWrap:'wrap'}}>
              {t.wein?.stage && stageBadge(t.wein.stage)}
              <Badge label={`SHORT ${t.shortConv?.score??0}/22`} color={C.em}/>
              {t.insiderSells>0 && <Badge label={`${t.insiderSells} INSIDER SELLS`} color={C.r}/>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── JOURNAL PANEL ──────────────────────────────────────────────────────────
function JournalPanel() {
  const [trades, setTrades] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('mkw_journal')||'[]') } catch { return [] }
  })
  const [form, setForm] = useState({ticker:'',direction:'LONG',entry:'',exit:'',pnl:'',zone:'CONVERGENCE',notes:''})
  const setF = (k,v) => setForm(p=>({...p,[k]:v}))

  const save = () => {
    if(!form.ticker||!form.entry) return
    const entry = { ...form, id:Date.now(), date:new Date().toISOString().split('T')[0] }
    const updated = [entry,...trades]
    setTrades(updated)
    localStorage.setItem('mkw_journal', JSON.stringify(updated))
    setForm({ticker:'',direction:'LONG',entry:'',exit:'',pnl:'',zone:'CONVERGENCE',notes:''})
  }

  const wins  = trades.filter(t=>parseFloat(t.pnl)>0)
  const total = trades.length

  const iStyle = {padding:'7px 10px',background:C.p3,border:`1px solid ${C.b2}`,borderRadius:6,
    fontFamily:FM,fontSize:12,color:C.tb,width:'100%'}

  return (
    <div style={{padding:'8px'}}>
      {/* Stats */}
      {total>0 && (
        <Card style={{marginBottom:8,padding:'12px'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            <div><div style={{fontFamily:FO,fontSize:8,color:C.td,letterSpacing:'1.5px'}}>TRADES</div>
              <div style={{fontFamily:FO,fontSize:18,fontWeight:900,color:C.cy}}>{total}</div></div>
            <div><div style={{fontFamily:FO,fontSize:8,color:C.td,letterSpacing:'1.5px'}}>WIN RATE</div>
              <div style={{fontFamily:FO,fontSize:18,fontWeight:900,color:C.g}}>
                {total?Math.round(wins.length/total*100):0}%</div></div>
            <div><div style={{fontFamily:FO,fontSize:8,color:C.td,letterSpacing:'1.5px'}}>TOTAL P&L</div>
              <div style={{fontFamily:FO,fontSize:14,fontWeight:900,
                color:trades.reduce((a,t)=>a+parseFloat(t.pnl||0),0)>=0?C.g:C.r}}>
                {fmtB(trades.reduce((a,t)=>a+parseFloat(t.pnl||0),0))}</div></div>
            <div><div style={{fontFamily:FO,fontSize:8,color:C.td,letterSpacing:'1.5px'}}>AVG P&L</div>
              <div style={{fontFamily:FM,fontSize:14,
                color:total&&trades.reduce((a,t)=>a+parseFloat(t.pnl||0),0)/total>=0?C.g:C.r}}>
                {total?fmtB(trades.reduce((a,t)=>a+parseFloat(t.pnl||0),0)/total):'—'}</div></div>
          </div>
        </Card>
      )}

      {/* Add trade */}
      <Card style={{marginBottom:8,padding:'12px'}}>
        <div style={{fontFamily:FO,fontSize:10,color:C.gd,letterSpacing:'2px',marginBottom:10}}>LOG TRADE</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div><label style={{fontFamily:FR,fontSize:9,color:C.td,letterSpacing:'1px'}}>TICKER</label>
            <input value={form.ticker} onChange={e=>setF('ticker',e.target.value.toUpperCase())} style={iStyle} placeholder="NVDA"/></div>
          <div><label style={{fontFamily:FR,fontSize:9,color:C.td,letterSpacing:'1px'}}>DIRECTION</label>
            <select value={form.direction} onChange={e=>setF('direction',e.target.value)}
              style={{...iStyle,appearance:'none'}}>
              <option>LONG</option><option>SHORT</option>
            </select></div>
          <div><label style={{fontFamily:FR,fontSize:9,color:C.td,letterSpacing:'1px'}}>ENTRY</label>
            <input type="number" value={form.entry} onChange={e=>setF('entry',e.target.value)} style={iStyle}/></div>
          <div><label style={{fontFamily:FR,fontSize:9,color:C.td,letterSpacing:'1px'}}>EXIT</label>
            <input type="number" value={form.exit} onChange={e=>setF('exit',e.target.value)} style={iStyle}/></div>
          <div><label style={{fontFamily:FR,fontSize:9,color:C.td,letterSpacing:'1px'}}>P&L ($)</label>
            <input type="number" value={form.pnl} onChange={e=>setF('pnl',e.target.value)} style={iStyle}/></div>
          <div><label style={{fontFamily:FR,fontSize:9,color:C.td,letterSpacing:'1px'}}>ZONE AT ENTRY</label>
            <select value={form.zone} onChange={e=>setF('zone',e.target.value)}
              style={{...iStyle,appearance:'none'}}>
              {['CONVERGENCE','SECONDARY','BUILDING','WATCH'].map(z=><option key={z}>{z}</option>)}
            </select></div>
        </div>
        <div style={{marginBottom:8}}>
          <label style={{fontFamily:FR,fontSize:9,color:C.td,letterSpacing:'1px'}}>NOTES</label>
          <input value={form.notes} onChange={e=>setF('notes',e.target.value)} style={iStyle}/>
        </div>
        <button onClick={save}
          style={{width:'100%',padding:'10px',background:`${C.gd}22`,border:`1px solid ${C.gd}44`,
            borderRadius:6,fontFamily:FO,fontSize:10,color:C.gd,fontWeight:700}}>
          LOG TRADE
        </button>
      </Card>

      {/* Trade list */}
      {trades.map(t=>(
        <Card key={t.id} style={{marginBottom:6}}>
          <div style={{padding:'10px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:2}}>
                <span style={{fontFamily:FO,fontSize:14,fontWeight:900,
                  color:t.direction==='LONG'?C.g:C.em}}>{t.ticker}</span>
                <Badge label={t.direction} color={t.direction==='LONG'?C.g:C.em}/>
                <Pill zone={t.zone} small/>
              </div>
              <div style={{fontFamily:FM,fontSize:10,color:C.td}}>{t.date} · Entry ${fmt(t.entry)} → Exit ${fmt(t.exit)}</div>
              {t.notes && <div style={{fontFamily:FR,fontSize:10,color:C.tx,marginTop:2}}>{t.notes}</div>}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:FM,fontSize:14,fontWeight:600,
                color:parseFloat(t.pnl)>=0?C.g:C.r}}>
                {parseFloat(t.pnl)>=0?'+':''}{fmtB(parseFloat(t.pnl))}
              </div>
            </div>
          </div>
        </Card>
      ))}
      {trades.length===0 && <EmptyState msg="No trades logged yet"/>}
    </div>
  )
}

// ── SCREENER PANEL ─────────────────────────────────────────────────────────
function ScreenerPanel() {
  const [filters, setFilters] = useState({
    rs_min:70, rs_max:99, stage:'', template_min:6, zone:'', vcp:false, short_mode:false
  })
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [presets, setPresets] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('mkw_presets')||'{}') } catch { return {} }
  })
  const [presetName, setPresetName] = useState('')
  const setF = (k,v) => setFilters(p=>({...p,[k]:v}))

  const runScreen = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k,v])=>{ if(v!==''&&v!==false) params.set(k,v) })
    try {
      const r = await fetch(`/api/screener?${params}`)
      const d = await r.json()
      setResults(d.stocks||[])
    } catch(e) { setResults([]) }
    setLoading(false)
  }

  const savePreset = () => {
    if(!presetName) return
    const updated = {...presets,[presetName]:filters}
    setPresets(updated)
    localStorage.setItem('mkw_presets', JSON.stringify(updated))
    setPresetName('')
  }

  const loadPreset = (name) => { setFilters(presets[name]) }

  return (
    <div style={{padding:'8px'}}>
      {/* Filter controls */}
      <Card style={{marginBottom:8,padding:'12px'}}>
        <div style={{fontFamily:FO,fontSize:10,color:C.g,letterSpacing:'2px',marginBottom:10}}>FILTER CRITERIA</div>

        <div style={{marginBottom:8}}>
          <label style={{fontFamily:FR,fontSize:9,color:C.td,letterSpacing:'1px'}}>RS MIN: {filters.rs_min}</label>
          <input type="range" min={0} max={99} value={filters.rs_min}
            onChange={e=>setF('rs_min',+e.target.value)}
            style={{width:'100%',marginTop:4,accentColor:C.g}}/>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div>
            <label style={{fontFamily:FR,fontSize:9,color:C.td,letterSpacing:'1px'}}>STAGE</label>
            <select value={filters.stage} onChange={e=>setF('stage',e.target.value)}
              style={{width:'100%',padding:'7px 8px',background:C.p3,border:`1px solid ${C.b2}`,
                borderRadius:6,fontFamily:FM,fontSize:12,color:C.tb,appearance:'none'}}>
              <option value="">ANY</option>
              <option value="2">STAGE 2</option>
              <option value="4">STAGE 4</option>
            </select>
          </div>
          <div>
            <label style={{fontFamily:FR,fontSize:9,color:C.td,letterSpacing:'1px'}}>TEMPLATE MIN</label>
            <select value={filters.template_min} onChange={e=>setF('template_min',+e.target.value)}
              style={{width:'100%',padding:'7px 8px',background:C.p3,border:`1px solid ${C.b2}`,
                borderRadius:6,fontFamily:FM,fontSize:12,color:C.tb,appearance:'none'}}>
              {[0,5,6,7,8].map(v=><option key={v} value={v}>{v===0?'ANY':`${v}/8+`}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontFamily:FR,fontSize:9,color:C.td,letterSpacing:'1px'}}>ZONE</label>
            <select value={filters.zone} onChange={e=>setF('zone',e.target.value)}
              style={{width:'100%',padding:'7px 8px',background:C.p3,border:`1px solid ${C.b2}`,
                borderRadius:6,fontFamily:FM,fontSize:12,color:C.tb,appearance:'none'}}>
              <option value="">ANY</option>
              {['CONVERGENCE','SECONDARY','BUILDING','WATCH'].map(z=><option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
            <label className="press" style={{display:'flex',gap:8,alignItems:'center',cursor:'pointer',
              padding:'7px 10px',background:filters.vcp?`${C.cy}22`:C.p3,
              border:`1px solid ${filters.vcp?C.cy:C.b2}`,borderRadius:6}}>
              <input type="checkbox" checked={filters.vcp} onChange={e=>setF('vcp',e.target.checked)}
                style={{width:14,height:14,accentColor:C.cy}}/>
              <span style={{fontFamily:FR,fontSize:11,color:filters.vcp?C.cy:C.tx}}>VCP ONLY</span>
            </label>
          </div>
        </div>

        <button onClick={runScreen}
          style={{width:'100%',padding:'11px',background:`${C.g}22`,border:`1px solid ${C.g}55`,
            borderRadius:8,fontFamily:FO,fontSize:11,fontWeight:700,color:C.g,letterSpacing:'1px',
            marginBottom:8}}>
          RUN SCREEN
        </button>

        {/* Presets */}
        {Object.keys(presets).length>0 && (
          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
            {Object.keys(presets).map(name=>(
              <button key={name} onClick={()=>loadPreset(name)}
                style={{padding:'3px 8px',fontFamily:FM,fontSize:9,color:C.gd,
                  border:`1px solid ${C.gd}44`,borderRadius:4,background:`${C.gd}11`,cursor:'pointer'}}>
                {name}
              </button>
            ))}
          </div>
        )}
        <div style={{display:'flex',gap:6}}>
          <input value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder="Preset name..."
            style={{flex:1,padding:'6px 10px',background:C.p3,border:`1px solid ${C.b2}`,borderRadius:6,
              fontFamily:FM,fontSize:11,color:C.tb}}/>
          <button onClick={savePreset}
            style={{padding:'6px 12px',background:`${C.gd}22`,border:`1px solid ${C.gd}44`,
              borderRadius:6,fontFamily:FO,fontSize:9,color:C.gd}}>
            SAVE
          </button>
        </div>
      </Card>

      {/* Results */}
      {loading && <div style={{padding:'40px',textAlign:'center'}}><Spinner size={32}/></div>}
      {results && !loading && (
        <div>
          <div style={{fontFamily:FO,fontSize:10,color:C.g,letterSpacing:'2px',marginBottom:8}}>
            {results.length} RESULTS
          </div>
          {results.length===0 && <EmptyState msg="No stocks match these criteria"/>}
          {results.map(s=><StockCard key={s.tk} s={s}/>)}
        </div>
      )}
      <div style={{height:16}}/>
    </div>
  )
}

// ── BOTTOM NAV ─────────────────────────────────────────────────────────────
function BottomNav({ active, onChange }) {
  const tabs = [
    { id:'home',  label:'HOME',  icon:'⌂' },
    { id:'watch', label:'WATCH', icon:'◎' },
    { id:'plays', label:'PLAYS', icon:'▶' },
    { id:'brief', label:'BRIEF', icon:'✦' },
    { id:'more',  label:'MORE',  icon:'⋯' },
  ]
  return (
    <div style={{background:'rgba(8,13,20,0.96)',backdropFilter:'blur(20px)',
      borderTop:`1px solid ${C.b1}`,display:'flex',flexShrink:0}}>
      {tabs.map(t=>{
        const isActive = active===t.id
        return (
          <button key={t.id} className="press" onClick={()=>onChange(t.id)}
            style={{flex:1,padding:'10px 4px 20px',display:'flex',flexDirection:'column',
              alignItems:'center',gap:3,border:'none',background:'none',cursor:'pointer',
              borderTop:`2px solid ${isActive?C.cy:'transparent'}`}}>
            <span style={{fontSize:16,color:isActive?C.cy:C.td}}>{t.icon}</span>
            <span style={{fontFamily:FO,fontSize:8,fontWeight:700,letterSpacing:'1px',
              color:isActive?C.cy:C.td}}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── APP ROOT ───────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]       = useState('home')
  const [analyzeTicker, setAnalyzeTicker] = useState(null)
  const [showAnalyze, setShowAnalyze] = useState(false)

  const openAnalyze = (tk) => {
    setAnalyzeTicker(tk)
    setShowAnalyze(true)
  }

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:C.bg,overflow:'hidden'}}>
      <style>{CSS}</style>

      {/* Scanline overlay */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:9999,
        background:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,188,212,0.012) 2px,rgba(0,188,212,0.012) 4px)'}}/>

      {/* Tab content */}
      <div style={{flex:1,overflow:'hidden',position:'relative'}}>
        {tab==='home'  && <HomeTab onAnalyze={openAnalyze}/>}
        {tab==='watch' && <WatchlistTab onAnalyze={openAnalyze}/>}
        {tab==='plays' && <PlaysTab/>}
        {tab==='brief' && <BriefTab/>}
        {tab==='more'  && <MoreTab onAnalyze={openAnalyze}/>}
      </div>

      <BottomNav active={tab} onChange={setTab}/>

      {/* Global analyze overlay */}
      {showAnalyze && (
        <FullPanel title={`ANALYZE: ${analyzeTicker||''}`} color={C.cy} onBack={()=>setShowAnalyze(false)}>
          <AnalyzePanel initialTicker={analyzeTicker}/>
        </FullPanel>
      )}
    </div>
  )
}
