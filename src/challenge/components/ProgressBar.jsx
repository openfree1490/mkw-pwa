// ── ANIMATED PROGRESS BAR ─────────────────────────────────────────────────
import { CC, FONTS } from '../engine/constants.js'

export default function ProgressBar({ value, max, label, color = CC.accent, height = 8, showPct = true, style }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  return (
    <div style={{ marginBottom: 8, ...style }}>
      {(label || showPct) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          {label && (
            <span style={{ fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.2, color: CC.textMuted, textTransform: 'uppercase' }}>
              {label}
            </span>
          )}
          {showPct && (
            <span style={{ fontFamily: FONTS.mono, fontSize: 10, color }}>
              {pct.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div style={{
        width: '100%', height, background: CC.bg, borderRadius: height / 2,
        border: `1px solid ${CC.border}`, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: height / 2,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          boxShadow: `0 0 8px ${color}40`,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}
