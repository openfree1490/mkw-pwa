// ── PLAYBOOK TAB — Tiers, Setups, Process ─────────────────────────────────
import { TIERS, PLAYBOOK_SETUPS, DEBRIEF_CHECKLIST, CC, FONTS } from '../engine/constants.js'
import MetricCard from '../components/MetricCard.jsx'
import { Panel, SectionHeader, Badge, Grid } from '../components/shared.jsx'

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

export default function PlaybookTab({ balance }) {
  const currentTier = getTier(balance)

  return (
    <div style={{ padding: 12 }}>
      {/* Tier Cards */}
      <SectionHeader>Challenge Tiers</SectionHeader>
      {TIERS.map((tier, idx) => {
        const isCurrent = idx === currentTier
        return (
          <Panel key={tier.name} style={{
            marginBottom: 8, padding: '12px 14px',
            borderColor: isCurrent ? tier.color : CC.border,
            background: isCurrent ? `${tier.color}08` : CC.surface,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: FONTS.heading, fontSize: 16, fontWeight: 700, color: tier.color }}>{tier.name}</span>
                {isCurrent && <Badge color={tier.color}>CURRENT</Badge>}
              </div>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: CC.textMuted }}>
                ${tier.range[0].toLocaleString()} — {tier.range[1] === Infinity ? '∞' : `$${tier.range[1].toLocaleString()}`}
              </span>
            </div>

            <Grid cols={3} style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>RISK</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.textBright }}>{(tier.riskPct * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>MAX POS</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.textBright }}>{tier.maxPositions}</div>
              </div>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>STRATEGIES</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.textBright }}>{tier.strategies.length}</div>
              </div>
            </Grid>

            <div style={{ fontFamily: FONTS.heading, fontSize: 9, color: CC.textMuted, letterSpacing: 1, marginBottom: 4 }}>RULES</div>
            {tier.rules.map((rule, i) => (
              <div key={i} style={{
                fontFamily: FONTS.body, fontSize: 11, color: CC.text,
                padding: '3px 0', borderBottom: i < tier.rules.length - 1 ? `1px solid ${CC.border}11` : 'none',
              }}>
                • {rule}
              </div>
            ))}

            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {tier.strategies.map(s => (
                <span key={s} style={{
                  fontFamily: FONTS.mono, fontSize: 8, color: CC.textMuted,
                  background: CC.bg, padding: '2px 5px', borderRadius: 3,
                }}>
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </Panel>
        )
      })}

      {/* High-Probability Setups */}
      <SectionHeader style={{ marginTop: 12 }}>High-Probability Setups</SectionHeader>
      {PLAYBOOK_SETUPS.map((setup, idx) => {
        const typeColor = setup.type === 'long' ? CC.profit : setup.type === 'short' ? CC.loss : CC.blue
        return (
          <Panel key={idx} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: FONTS.heading, fontSize: 14, fontWeight: 700, color: CC.textBright }}>{setup.name}</span>
                <Badge color={typeColor}>{setup.type}</Badge>
              </div>
            </div>

            <Grid cols={2} style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>WIN RATE</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.accent }}>{setup.winRate}</div>
              </div>
              <div>
                <div style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>R:R TARGET</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: CC.accent }}>{setup.rrTarget}</div>
              </div>
            </Grid>

            {[
              { label: 'ENTRY', value: setup.entry },
              { label: 'TIMEFRAME', value: setup.timeframe },
              { label: 'SIZING', value: setup.sizing },
              { label: 'IV RULE', value: setup.ivRule },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 4 }}>
                <span style={{ fontFamily: FONTS.heading, fontSize: 8, color: CC.textMuted, letterSpacing: 1 }}>{item.label}: </span>
                <span style={{ fontFamily: FONTS.body, fontSize: 11, color: CC.text }}>{item.value}</span>
              </div>
            ))}

            <div style={{
              marginTop: 6, padding: '6px 10px', background: `${CC.accent}08`, borderRadius: 4,
              fontFamily: FONTS.body, fontSize: 11, color: CC.accent, fontStyle: 'italic',
            }}>
              Edge: {setup.edge}
            </div>
          </Panel>
        )
      })}

      {/* Daily Process Checklist */}
      <SectionHeader style={{ marginTop: 12 }}>Daily Process</SectionHeader>
      {[
        { phase: 'Pre-Market', items: DEBRIEF_CHECKLIST.premarkt, color: CC.blue },
        { phase: 'Market Hours', items: DEBRIEF_CHECKLIST.execution, color: CC.accent },
        { phase: 'Post-Market', items: DEBRIEF_CHECKLIST.postmarket, color: CC.purple },
      ].map(section => (
        <Panel key={section.phase} style={{ marginBottom: 8 }}>
          <div style={{
            fontFamily: FONTS.heading, fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
            color: section.color, marginBottom: 6,
          }}>
            {section.phase.toUpperCase()}
          </div>
          {section.items.map((item, i) => (
            <div key={i} style={{
              fontFamily: FONTS.body, fontSize: 12, color: CC.text,
              padding: '4px 0', paddingLeft: 12,
              borderBottom: i < section.items.length - 1 ? `1px solid ${CC.border}11` : 'none',
            }}>
              {i + 1}. {item}
            </div>
          ))}
        </Panel>
      ))}
    </div>
  )
}
