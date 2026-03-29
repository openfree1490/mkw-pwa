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
