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
