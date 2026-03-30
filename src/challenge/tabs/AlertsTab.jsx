// ── PATTERN ALERTS TAB — Phase 4 ──────────────────────────────────────────
import { useState, useCallback } from 'react'
import { CC, FONTS } from '../engine/constants.js'

const ALERT_ICONS = {
  approaching_ema: '📍',
  volume_drying_up: '📉',
  rs_breakout: '💪',
  ema_reclaim: '🔄',
}

const ALERT_COLORS = {
  high: CC.loss,
  medium: CC.warning,
  low: CC.textMuted,
}

const BACKEND_URL = ''

function AlertCard({ alert }) {
  const [expanded, setExpanded] = useState(false)
  const urgencyColor = ALERT_COLORS[alert.urgency] || CC.textMuted
  const icon = ALERT_ICONS[alert.type] || '📊'
  const condMet = alert.conditionsMet || 0
  const condTotal = alert.conditionsTotal || 6

  // Progress bar for conditions met
  const pct = Math.round((condMet / condTotal) * 100)
  const barColor = condMet >= 5 ? CC.profit : condMet >= 3 ? CC.warning : CC.loss

  return (
    <div style={{
      background: CC.surface, border: `1px solid ${urgencyColor}30`, borderRadius: 8,
      marginBottom: 8, overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '10px 12px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <div>
              <div style={{ fontFamily: FONTS.heading, fontWeight: 700, fontSize: 13, color: CC.textBright }}>
                {alert.ticker}
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: urgencyColor, fontWeight: 600 }}>
                {alert.title}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color: barColor,
            }}>
              {condMet}/{condTotal}
            </div>
            <div style={{
              fontFamily: FONTS.mono, fontSize: 8, padding: '1px 4px', borderRadius: 2,
              background: `${urgencyColor}20`, color: urgencyColor,
            }}>
              {alert.urgency?.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Conditions progress bar */}
        <div style={{ height: 3, background: CC.bg, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`, background: barColor,
            borderRadius: 2, transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Detail text */}
        <div style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.text, marginTop: 6, lineHeight: 1.4 }}>
          {alert.detail}
        </div>
      </div>

      {/* Expanded: show what's needed */}
      {expanded && alert.conditionsNeeded && alert.conditionsNeeded.length > 0 && (
        <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${CC.border}` }}>
          <div style={{
            fontFamily: FONTS.heading, fontSize: 9, fontWeight: 600, letterSpacing: 1.5,
            color: CC.textMuted, textTransform: 'uppercase', marginTop: 8, marginBottom: 6,
          }}>
            STILL NEEDED FOR TRIGGER
          </div>
          {alert.conditionsNeeded.map((need, i) => (
            <div key={i} style={{
              fontFamily: FONTS.mono, fontSize: 10, color: CC.warning,
              padding: '3px 0', borderBottom: `1px solid ${CC.border}30`,
            }}>
              ○ {need}
            </div>
          ))}
          <div style={{ marginTop: 8, fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
            Partial score: {alert.partialScore}/10
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationPanel() {
  const [status, setStatus] = useState(null)
  const [testing, setTesting] = useState(false)

  const checkStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/notifications/status`)
      setStatus(await res.json())
    } catch {}
  }

  const testNotification = async (channel) => {
    setTesting(true)
    try {
      await fetch(`${BACKEND_URL}/api/notifications/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, message: 'MKW Alert System — Test notification!' }),
      })
    } catch {}
    setTesting(false)
  }

  if (!status) {
    return (
      <div style={{
        background: CC.surface, borderRadius: 8, padding: 12, marginBottom: 12,
        border: `1px solid ${CC.border}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, textTransform: 'uppercase' }}>
            NOTIFICATIONS
          </span>
          <button onClick={checkStatus} style={{
            fontFamily: FONTS.heading, fontSize: 9, fontWeight: 600, letterSpacing: 1,
            padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
            background: `${CC.accent}15`, color: CC.accent, border: `1px solid ${CC.accent}40`,
          }}>CHECK STATUS</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: CC.surface, borderRadius: 8, padding: 12, marginBottom: 12,
      border: `1px solid ${CC.border}`,
    }}>
      <div style={{ fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
        NOTIFICATION CHANNELS
      </div>
      {['telegram', 'discord', 'email'].map(ch => (
        <div key={ch} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 0', borderBottom: `1px solid ${CC.border}30`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 6, height: 6, borderRadius: 3,
              background: status[ch] ? CC.profit : CC.loss,
            }} />
            <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: CC.text, textTransform: 'capitalize' }}>
              {ch}
            </span>
          </div>
          {status[ch] && (
            <button
              onClick={() => testNotification(ch)}
              disabled={testing}
              style={{
                fontFamily: FONTS.mono, fontSize: 9, padding: '2px 8px',
                borderRadius: 3, cursor: 'pointer',
                background: `${CC.accent}15`, color: CC.accent, border: `1px solid ${CC.accent}30`,
              }}
            >
              TEST
            </button>
          )}
        </div>
      ))}
      <div style={{ marginTop: 6, fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
        Set TELEGRAM_BOT_TOKEN, DISCORD_WEBHOOK_URL, or SMTP_* env vars to enable channels.
      </div>
    </div>
  )
}

export default function AlertsTab({ watchlist }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [filterUrgency, setFilterUrgency] = useState('all')

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tickers = watchlist.length > 0 ? watchlist.join(',') : ''
      const url = tickers
        ? `${BACKEND_URL}/api/pattern-alerts?tickers=${tickers}`
        : `${BACKEND_URL}/api/pattern-alerts`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setAlerts(data.alerts || [])
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [watchlist])

  // Filter
  let filtered = [...alerts]
  if (filterType !== 'all') filtered = filtered.filter(a => a.type === filterType)
  if (filterUrgency !== 'all') filtered = filtered.filter(a => a.urgency === filterUrgency)

  const hotAlerts = alerts.filter(a => a.conditionsMet >= 4)
  const warmAlerts = alerts.filter(a => a.conditionsMet >= 2 && a.conditionsMet < 4)

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: FONTS.heading, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: CC.accent, textTransform: 'uppercase' }}>
          PATTERN ALERTS
        </div>
        <button onClick={fetchAlerts} disabled={loading} style={{
          fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
          padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
          background: CC.accent, color: CC.bg, border: 'none', textTransform: 'uppercase',
          opacity: loading ? 0.5 : 1,
        }}>
          {loading ? 'SCANNING...' : 'SCAN'}
        </button>
      </div>

      {/* Notification Panel */}
      <NotificationPanel />

      {/* Stats */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{
            flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 6,
            background: `${CC.loss}15`, border: `1px solid ${CC.loss}30`,
          }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 18, fontWeight: 800, color: CC.loss }}>{hotAlerts.length}</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.loss }}>HOT (4+ conds)</div>
          </div>
          <div style={{
            flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 6,
            background: `${CC.warning}15`, border: `1px solid ${CC.warning}30`,
          }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 18, fontWeight: 800, color: CC.warning }}>{warmAlerts.length}</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.warning }}>WARM (2-3)</div>
          </div>
          <div style={{
            flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 6,
            background: `${CC.textMuted}15`, border: `1px solid ${CC.textMuted}30`,
          }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 18, fontWeight: 800, color: CC.textMuted }}>{alerts.length}</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>TOTAL</div>
          </div>
        </div>
      )}

      {/* Filters */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{
            padding: '4px 8px', fontFamily: FONTS.mono, fontSize: 10,
            background: CC.bg, color: CC.text, border: `1px solid ${CC.border}`, borderRadius: 4,
          }}>
            <option value="all">All Patterns</option>
            <option value="approaching_ema">Approaching EMA</option>
            <option value="volume_drying_up">Volume Drying Up</option>
            <option value="rs_breakout">RS Breakout</option>
            <option value="ema_reclaim">EMA Reclaim</option>
          </select>
          <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)} style={{
            padding: '4px 8px', fontFamily: FONTS.mono, fontSize: 10,
            background: CC.bg, color: CC.text, border: `1px solid ${CC.border}`, borderRadius: 4,
          }}>
            <option value="all">All Urgency</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: 12, background: `${CC.loss}10`, border: `1px solid ${CC.loss}30`, borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11, color: CC.loss, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 30, fontFamily: FONTS.mono, fontSize: 12, color: CC.textMuted }}>
          Scanning for forming patterns...
        </div>
      )}

      {/* Alert Cards */}
      {!loading && filtered.map((alert, i) => (
        <AlertCard key={`${alert.ticker}-${alert.type}-${i}`} alert={alert} />
      ))}

      {!loading && alerts.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: 40, fontFamily: FONTS.body, fontSize: 12, color: CC.textMuted }}>
          Click SCAN to check your watchlist for forming patterns.
          Alerts fire when setups are developing but not yet triggered.
        </div>
      )}
    </div>
  )
}
