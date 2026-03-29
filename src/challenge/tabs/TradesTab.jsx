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
