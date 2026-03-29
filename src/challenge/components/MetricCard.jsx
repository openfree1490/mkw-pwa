// ── METRIC CARD COMPONENT ─────────────────────────────────────────────────
import { CC, FONTS } from '../engine/constants.js'

export default function MetricCard({ label, value, sub, color = CC.textBright, icon, small, style }) {
  return (
    <div style={{
      background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 8,
      padding: small ? '8px 10px' : '12px 14px', position: 'relative', overflow: 'hidden',
      ...style,
    }}>
      {icon && (
        <span style={{ position: 'absolute', top: 8, right: 10, fontSize: small ? 14 : 18, opacity: 0.15 }}>{icon}</span>
      )}
      <div style={{
        fontFamily: FONTS.heading, fontSize: 9, fontWeight: 600, letterSpacing: 1.5,
        color: CC.textMuted, textTransform: 'uppercase', marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: FONTS.mono, fontSize: small ? 16 : 22, fontWeight: 700,
        color, lineHeight: 1.1,
        textShadow: color !== CC.textBright ? `0 0 12px ${color}40` : 'none',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: FONTS.mono, fontSize: 10, color: CC.textMuted, marginTop: 2,
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}
