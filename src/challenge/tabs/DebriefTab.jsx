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
