// ── TODAY'S WATCH TAB — Top 5 Daily Plays (Long + Short) ──────────────────
import { useState, useCallback } from 'react'
import { CC, FONTS } from '../engine/constants.js'
import { Panel, SectionHeader, Badge, Button, Grid } from '../components/shared.jsx'

const DIRECTION_CONFIG = {
  LONG: { color: CC.profit, icon: '▲', label: 'LONG' },
  SHORT: { color: CC.loss, icon: '▼', label: 'SHORT' },
}

const SETUP_LABELS = {
  STAGE_4_BREAKDOWN: 'Stage 4 Breakdown',
  FAILED_BREAKOUT: 'Failed Breakout',
  DISTRIBUTION_TOP: 'Distribution Top',
  PARABOLIC_EXHAUSTION: 'Parabolic Exhaustion',
  EMA_REJECTION_SHORT: 'EMA Rejection',
  EARNINGS_GAP_FADE: 'Earnings Gap Fade',
  CONVERGENCE: 'Full Convergence',
  SECONDARY: 'Secondary Setup',
}

function ConfidenceMeter({ value }) {
  const color = value >= 75 ? CC.profit : value >= 55 ? CC.accent : CC.warning
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 60, height: 4, background: CC.border, borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(value, 100)}%`, height: '100%', background: color,
          borderRadius: 2, transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, color }}>{value}%</span>
    </div>
  )
}

function PlayCard({ play, rank, expanded, onToggle, onOpenTrade }) {
  const dir = DIRECTION_CONFIG[play.direction] || DIRECTION_CONFIG.LONG
  const gradeScore = play.gradeScore || 0
  const gradeColor = gradeScore >= 80 ? CC.profit : gradeScore >= 60 ? CC.accent : CC.warning
  const rr = play.stop && play.entry && play.target
    ? Math.abs((play.target - play.entry) / (play.stop - play.entry)).toFixed(1)
    : '—'

  return (
    <Panel style={{ padding: 0, overflow: 'hidden', borderColor: expanded ? `${dir.color}40` : CC.border }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{ padding: '12px 14px', cursor: 'pointer', position: 'relative' }}
      >
        {/* Rank badge */}
        <div style={{
          position: 'absolute', top: 8, right: 12,
          fontFamily: FONTS.mono, fontSize: 24, fontWeight: 800,
          color: `${CC.textMuted}30`, lineHeight: 1,
        }}>
          #{rank}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{
            fontFamily: FONTS.heading, fontSize: 18, fontWeight: 800, color: CC.textBright,
          }}>{play.ticker}</span>
          <Badge color={dir.color}>{dir.icon} {dir.label}</Badge>
          <Badge color={CC.purple}>{SETUP_LABELS[play.setupType] || play.setupType}</Badge>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>CONFIDENCE</div>
            <ConfidenceMeter value={play.confidence} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>R:R</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700, color: parseFloat(rr) >= 3 ? CC.profit : CC.accent }}>{rr}:1</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>STAGE</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700, color: CC.textBright }}>{play.weinStage}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>RS</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700, color: play.rs >= 70 ? CC.profit : play.rs <= 30 ? CC.loss : CC.text }}>{play.rs}</div>
          </div>
          {play.name && play.name !== play.ticker && (
            <div style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.textMuted }}>{play.name}</div>
          )}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${CC.border}`, padding: 14 }}>
          {/* Thesis / Setup Detail */}
          <Panel style={{ background: CC.bg, padding: 10, marginBottom: 10 }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted, letterSpacing: 1.5, marginBottom: 4 }}>THESIS</div>
            <div style={{ fontFamily: FONTS.body, fontSize: 12, color: CC.text, lineHeight: 1.6 }}>{play.setupDetail}</div>
          </Panel>

          {/* Trade Spec Grid */}
          <SectionHeader>Trade Spec</SectionHeader>
          <Grid cols={4}>
            {[
              { label: 'ENTRY', value: `$${play.entry?.toFixed(2) || '—'}`, color: CC.blue },
              { label: 'STOP', value: `$${play.stop?.toFixed(2) || '—'}`, color: CC.loss },
              { label: 'TARGET', value: `$${play.target?.toFixed(2) || '—'}`, color: CC.profit },
              { label: 'R:R', value: `${rr}:1`, color: parseFloat(rr) >= 3 ? CC.profit : CC.accent },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>{s.label}</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </Grid>

          {/* Signals */}
          {play.signals && play.signals.length > 0 && (
            <>
              <SectionHeader style={{ marginTop: 10 }}>Signals</SectionHeader>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {play.signals.map((sig, i) => (
                  <Badge key={i} color={dir.color} style={{ fontSize: 8 }}>{sig}</Badge>
                ))}
              </div>
            </>
          )}

          {/* Grade */}
          {play.grade && (
            <>
              <SectionHeader style={{ marginTop: 10 }}>Grade</SectionHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  fontFamily: FONTS.mono, fontSize: 28, fontWeight: 800,
                  color: gradeColor,
                }}>
                  {play.grade.grade || play.grade.letterGrade || '—'}
                </div>
                <div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.textBright }}>
                    Score: {gradeScore}/100
                  </div>
                  <div style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.textMuted }}>
                    {play.grade.description || (gradeScore >= 80 ? 'Strong setup' : gradeScore >= 60 ? 'Tradeable' : 'Watch only')}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Action Button */}
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <Button variant="primary" onClick={() => onOpenTrade && onOpenTrade(play)}>
              {play.direction === 'SHORT' ? 'TRADE SHORT' : 'TRADE LONG'}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  )
}

export default function TodaysWatchTab({ onOpenTrade }) {
  const [plays, setPlays] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [meta, setMeta] = useState(null)

  const fetchPlays = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/todays-watch')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPlays(data.plays || [])
      setMeta({
        totalScanned: data.totalScanned || 0,
        totalCandidates: data.totalCandidates || 0,
        generated: data.generated,
      })
      if (data.plays?.length > 0) setExpanded(0)
    } catch (err) {
      setError(err.message)
      setPlays([])
    }
    setLoading(false)
  }, [])

  const longCount = plays.filter(p => p.direction === 'LONG').length
  const shortCount = plays.filter(p => p.direction === 'SHORT').length

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <Panel style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 14px', marginBottom: 10, borderColor: `${CC.gold}30`,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: FONTS.heading, fontSize: 14, fontWeight: 800, color: CC.gold, letterSpacing: 1 }}>
              TODAY'S WATCH
            </span>
            <Badge color={CC.gold}>TOP 5</Badge>
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
            Best setups from full universe scan — long + short
          </div>
        </div>
        <Button onClick={fetchPlays} disabled={loading} variant="primary">
          {loading ? 'SCANNING...' : 'SCAN'}
        </Button>
      </Panel>

      {/* Stats Bar */}
      {meta && (
        <Panel style={{ padding: '8px 14px', marginBottom: 10, display: 'flex', gap: 16, alignItems: 'center' }}>
          <div>
            <span style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>SCANNED </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.textBright }}>{meta.totalScanned}</span>
          </div>
          <div>
            <span style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>CANDIDATES </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.textBright }}>{meta.totalCandidates}</span>
          </div>
          <div>
            <Badge color={CC.profit} style={{ fontSize: 8 }}>{longCount} LONG</Badge>
          </div>
          <div>
            <Badge color={CC.loss} style={{ fontSize: 8 }}>{shortCount} SHORT</Badge>
          </div>
          {meta.generated && (
            <div style={{ marginLeft: 'auto', fontFamily: FONTS.mono, fontSize: 9, color: CC.textMuted }}>
              {new Date(meta.generated).toLocaleTimeString()}
            </div>
          )}
        </Panel>
      )}

      {/* Error */}
      {error && (
        <Panel style={{ textAlign: 'center', padding: 16, borderColor: `${CC.loss}40` }}>
          <div style={{ fontFamily: FONTS.body, fontSize: 13, color: CC.loss }}>{error}</div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginTop: 4 }}>
            Ensure backend is running at /api/todays-watch
          </div>
        </Panel>
      )}

      {/* Empty State */}
      {!loading && !error && plays.length === 0 && (
        <Panel style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontFamily: FONTS.heading, fontSize: 20, color: CC.gold, marginBottom: 8 }}>
            ◈
          </div>
          <div style={{ fontFamily: FONTS.body, fontSize: 14, color: CC.textMuted, marginBottom: 4 }}>
            Hit SCAN to find today's top 5 plays
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
            Scans full universe for best long + short setups
          </div>
        </Panel>
      )}

      {/* Loading */}
      {loading && (
        <Panel style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontFamily: FONTS.heading, fontSize: 14, color: CC.accent, marginBottom: 8 }}>
            Scanning universe...
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted }}>
            Running 6 short detectors + convergence analysis on every ticker
          </div>
        </Panel>
      )}

      {/* Play Cards */}
      {plays.map((play, idx) => (
        <PlayCard
          key={`${play.ticker}-${play.direction}-${idx}`}
          play={play}
          rank={play.rank || idx + 1}
          expanded={expanded === idx}
          onToggle={() => setExpanded(expanded === idx ? null : idx)}
          onOpenTrade={onOpenTrade}
        />
      ))}
    </div>
  )
}
