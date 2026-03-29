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
