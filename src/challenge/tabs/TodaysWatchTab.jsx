// ── TODAY'S WATCH TAB — Top 5 Daily Plays ─────────────────────────────────
import { useState, useCallback } from 'react'
import { CC, FONTS } from '../engine/constants.js'

const BACKEND_URL = ''

const DIRECTION_COLORS = {
  LONG: CC.profit,
  SHORT: CC.loss,
}

const SETUP_LABELS = {
  MKW_CONVERGENCE: 'MKW Convergence',
  MKW_SECONDARY: 'MKW Secondary',
  STAGE_4_BREAKDOWN: 'Stage 4 Breakdown',
  FAILED_BREAKOUT: 'Failed Breakout',
  DISTRIBUTION_TOP: 'Distribution Top',
  PARABOLIC_EXHAUSTION: 'Parabolic Exhaustion',
  EMA_REJECTION_SHORT: 'EMA Rejection',
  EARNINGS_GAP_FADE: 'Earnings Gap Fade',
}

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', CC.accent, CC.textMuted]

function ConfidenceBadge({ confidence }) {
  let color = CC.textMuted
  let label = 'LOW'
  if (confidence >= 80) { color = CC.profit; label = 'HIGH' }
  else if (confidence >= 65) { color = CC.warning; label = 'MED' }
  else if (confidence >= 55) { color = CC.blue; label = 'OK' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 40, height: 5, background: CC.bg, borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${confidence}%`, background: color,
          borderRadius: 3, transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ fontFamily: FONTS.mono, fontSize: 10, fontWeight: 700, color }}>
        {confidence}%
      </span>
      <span style={{
        fontFamily: FONTS.mono, fontSize: 8, fontWeight: 600, padding: '1px 4px',
        borderRadius: 2, background: `${color}20`, color,
      }}>
        {label}
      </span>
    </div>
  )
}

function ConditionDots({ conditions }) {
  if (!conditions) return null
  const entries = Object.entries(conditions)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {entries.map(([key, passed]) => (
        <span key={key} style={{
          fontFamily: FONTS.mono, fontSize: 8, padding: '2px 5px',
          borderRadius: 3,
          background: passed ? `${CC.profit}15` : `${CC.loss}10`,
          color: passed ? CC.profit : CC.loss,
          border: `1px solid ${passed ? CC.profit : CC.loss}30`,
        }}>
          {passed ? '●' : '○'} {key.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  )
}

function PlayCard({ play, onOpenTrade }) {
  const [expanded, setExpanded] = useState(false)
  const dirColor = DIRECTION_COLORS[play.direction] || CC.textMuted
  const rankColor = RANK_COLORS[play.rank - 1] || CC.textMuted
  const setupLabel = SETUP_LABELS[play.setup_type] || play.setup_type

  const riskReward = play.stop && play.target1
    ? ((Math.abs(play.target1 - play.entry) / Math.abs(play.stop - play.entry)) || 0).toFixed(1)
    : '—'

  return (
    <div style={{
      background: CC.surface, border: `1px solid ${dirColor}25`,
      borderRadius: 10, marginBottom: 10, overflow: 'hidden',
      borderLeft: `3px solid ${dirColor}`,
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '10px 12px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Rank badge */}
            <div style={{
              width: 24, height: 24, borderRadius: 12,
              background: `${rankColor}20`, border: `2px solid ${rankColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FONTS.heading, fontSize: 11, fontWeight: 800, color: rankColor,
            }}>
              {play.rank}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: FONTS.heading, fontWeight: 800, fontSize: 15, color: CC.textBright }}>
                  {play.ticker}
                </span>
                <span style={{
                  fontFamily: FONTS.mono, fontSize: 8, fontWeight: 700, padding: '2px 6px',
                  borderRadius: 3, background: `${dirColor}20`, color: dirColor,
                  border: `1px solid ${dirColor}40`,
                }}>
                  {play.direction}
                </span>
              </div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
                {play.name || play.ticker} · {play.sector || '—'}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700, color: CC.textBright }}>
              ${play.price?.toLocaleString()}
            </div>
            <ConfidenceBadge confidence={play.confidence} />
          </div>
        </div>

        {/* Setup type + meta */}
        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: FONTS.heading, fontSize: 9, fontWeight: 600, letterSpacing: 1,
            padding: '2px 6px', borderRadius: 3,
            background: `${CC.accent}15`, color: CC.accent, border: `1px solid ${CC.accent}30`,
          }}>
            {setupLabel}
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
            Stage {play.stage} · RS {play.rs} · {play.phase}
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
            R:R {riskReward}
          </span>
        </div>

        {/* Thesis */}
        <div style={{
          fontFamily: FONTS.body, fontSize: 11, color: CC.text,
          marginTop: 6, lineHeight: 1.4,
        }}>
          {play.thesis}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${CC.border}` }}>
          {/* Levels */}
          <div style={{
            display: 'flex', gap: 8, marginTop: 10, marginBottom: 8,
          }}>
            <div style={{
              flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 6,
              background: `${CC.accent}10`, border: `1px solid ${CC.accent}30`,
            }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>ENTRY</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: CC.accent }}>
                ${play.entry}
              </div>
            </div>
            <div style={{
              flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 6,
              background: `${CC.loss}10`, border: `1px solid ${CC.loss}30`,
            }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>STOP</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: CC.loss }}>
                ${play.stop}
              </div>
            </div>
            <div style={{
              flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 6,
              background: `${CC.profit}10`, border: `1px solid ${CC.profit}30`,
            }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>T1</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: CC.profit }}>
                ${play.target1}
              </div>
            </div>
            <div style={{
              flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 6,
              background: `${CC.profit}10`, border: `1px solid ${CC.profit}20`,
            }}>
              <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted }}>T2</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: CC.profit }}>
                ${play.target2}
              </div>
            </div>
          </div>

          {/* Convergence details */}
          <div style={{
            display: 'flex', gap: 10, marginBottom: 8,
          }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
              TPL: <span style={{ color: play.tpl_score >= 7 ? CC.profit : CC.warning }}>{play.tpl_score}/8</span>
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
              Conv: <span style={{ color: CC.accent }}>{play.conv_score}/23</span>
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
              Zone: <span style={{ color: play.conv_zone?.includes('CONVERGENCE') ? CC.profit : CC.warning }}>
                {play.conv_zone}
              </span>
            </div>
          </div>

          {/* Conditions */}
          <ConditionDots conditions={play.conditions} />

          {/* Action button */}
          {onOpenTrade && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenTrade({
                  ticker: play.ticker,
                  direction: play.direction,
                  entry: play.entry,
                  stop: play.stop,
                  target1: play.target1,
                  target2: play.target2,
                  setup_type: play.setup_type,
                  thesis: play.thesis,
                })
              }}
              style={{
                width: '100%', marginTop: 10, padding: '10px 0',
                fontFamily: FONTS.heading, fontSize: 11, fontWeight: 700,
                letterSpacing: 1.5, textTransform: 'uppercase',
                borderRadius: 6, cursor: 'pointer',
                background: dirColor, color: '#fff', border: 'none',
              }}
            >
              OPEN AS TRADE
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function TodaysWatchTab({ apiKey, balance, onOpenTrade }) {
  const [plays, setPlays] = useState([])
  const [meta, setMeta] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPlays = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = `${BACKEND_URL}/api/todays-plays${force ? '?force=true' : ''}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setPlays(data.plays || [])
        setMeta({
          generated_at: data.generated_at,
          next_refresh: data.next_refresh,
          market_status: data.market_status,
          total_scanned: data.total_scanned,
          total_candidates: data.total_candidates,
        })
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  const longCount = plays.filter(p => p.direction === 'LONG').length
  const shortCount = plays.filter(p => p.direction === 'SHORT').length

  const marketStatusColor = {
    MARKET_OPEN: CC.profit,
    PRE_MARKET: CC.warning,
    AFTER_HOURS: CC.warning,
    WEEKEND: CC.textMuted,
  }

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{
            fontFamily: FONTS.heading, fontSize: 14, fontWeight: 800,
            letterSpacing: 2, color: CC.gold, textTransform: 'uppercase',
          }}>
            TODAY'S WATCH
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted, marginTop: 2 }}>
            Top 5 plays · Long + Short
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => fetchPlays(false)} disabled={loading} style={{
            fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
            padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
            background: `${CC.accent}15`, color: CC.accent,
            border: `1px solid ${CC.accent}40`, textTransform: 'uppercase',
            opacity: loading ? 0.5 : 1,
          }}>
            {loading ? 'LOADING...' : 'LOAD'}
          </button>
          <button onClick={() => fetchPlays(true)} disabled={loading} style={{
            fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
            padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
            background: CC.accent, color: CC.bg,
            border: 'none', textTransform: 'uppercase',
            opacity: loading ? 0.5 : 1,
          }}>
            REFRESH
          </button>
        </div>
      </div>

      {/* Market status bar */}
      {meta.market_status && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 10px', background: CC.surface, borderRadius: 6,
          border: `1px solid ${CC.border}`, marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 6, height: 6, borderRadius: 3,
              background: marketStatusColor[meta.market_status] || CC.textMuted,
            }} />
            <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.text }}>
              {meta.market_status?.replace('_', ' ')}
            </span>
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
            {meta.total_scanned && `${meta.total_scanned} scanned · ${meta.total_candidates} candidates`}
          </div>
        </div>
      )}

      {/* Stats bar */}
      {plays.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{
            flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 6,
            background: `${CC.profit}15`, border: `1px solid ${CC.profit}30`,
          }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 20, fontWeight: 800, color: CC.profit }}>
              {longCount}
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.profit }}>LONGS</div>
          </div>
          <div style={{
            flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 6,
            background: `${CC.loss}15`, border: `1px solid ${CC.loss}30`,
          }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 20, fontWeight: 800, color: CC.loss }}>
              {shortCount}
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.loss }}>SHORTS</div>
          </div>
          <div style={{
            flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 6,
            background: `${CC.accent}15`, border: `1px solid ${CC.accent}30`,
          }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 20, fontWeight: 800, color: CC.accent }}>
              {plays.length}
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 8, color: CC.accent }}>TOTAL</div>
          </div>
        </div>
      )}

      {/* Timestamp */}
      {meta.generated_at && (
        <div style={{
          fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted,
          marginBottom: 10, textAlign: 'center',
        }}>
          Generated: {new Date(meta.generated_at).toLocaleString()} · Next: {meta.next_refresh ? new Date(meta.next_refresh).toLocaleTimeString() : '—'}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: 12, background: `${CC.loss}10`, border: `1px solid ${CC.loss}30`,
          borderRadius: 6, fontFamily: FONTS.mono, fontSize: 11, color: CC.loss, marginBottom: 8,
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          textAlign: 'center', padding: 40,
          fontFamily: FONTS.mono, fontSize: 12, color: CC.textMuted,
        }}>
          Scanning universe for today's best plays...
        </div>
      )}

      {/* Play Cards */}
      {!loading && plays.map((play, i) => (
        <PlayCard
          key={`${play.ticker}-${play.direction}-${i}`}
          play={play}
          onOpenTrade={onOpenTrade}
        />
      ))}

      {/* Empty state */}
      {!loading && plays.length === 0 && !error && (
        <div style={{
          textAlign: 'center', padding: 50,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>
            {'\u25C8'}
          </div>
          <div style={{ fontFamily: FONTS.heading, fontSize: 13, fontWeight: 700, color: CC.textBright, marginBottom: 6 }}>
            TODAY'S TOP 5
          </div>
          <div style={{ fontFamily: FONTS.body, fontSize: 12, color: CC.textMuted, lineHeight: 1.5, maxWidth: 280, margin: '0 auto' }}>
            Click LOAD to fetch today's best long and short setups, ranked by confidence.
            Refreshes at 8:30 AM, 10:30 AM, and 2:00 PM ET.
          </div>
        </div>
      )}
    </div>
  )
}
