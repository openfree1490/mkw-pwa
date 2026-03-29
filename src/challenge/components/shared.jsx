// ── SHARED UI COMPONENTS ──────────────────────────────────────────────────
import { CC, FONTS } from '../engine/constants.js'

export const Input = ({ label, value, onChange, type = 'text', placeholder, style, ...props }) => (
  <div style={{ marginBottom: 10, ...style }}>
    {label && <label style={{ display: 'block', fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>{label}</label>}
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '8px 12px', fontFamily: FONTS.mono, fontSize: 13,
        color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
        borderRadius: 6, transition: 'border-color 0.2s',
      }}
      onFocus={e => e.target.style.borderColor = CC.accent}
      onBlur={e => e.target.style.borderColor = CC.border}
      {...props}
    />
  </div>
)

export const Select = ({ label, value, onChange, options, style }) => (
  <div style={{ marginBottom: 10, ...style }}>
    {label && <label style={{ display: 'block', fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>{label}</label>}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '8px 12px', fontFamily: FONTS.mono, fontSize: 13,
        color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
        borderRadius: 6, appearance: 'none', cursor: 'pointer',
      }}
    >
      {options.map(o => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
  </div>
)

export const Button = ({ children, onClick, variant = 'default', disabled, style, ...props }) => {
  const variants = {
    default: { bg: `${CC.accent}15`, color: CC.accent, border: `1px solid ${CC.accent}40` },
    primary: { bg: CC.accent, color: CC.bg, border: 'none' },
    danger: { bg: `${CC.loss}15`, color: CC.loss, border: `1px solid ${CC.loss}40` },
    ghost: { bg: 'transparent', color: CC.textMuted, border: `1px solid ${CC.border}` },
    profit: { bg: `${CC.profit}15`, color: CC.profit, border: `1px solid ${CC.profit}40` },
  }
  const v = variants[variant] || variants.default
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
        padding: '8px 16px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
        background: v.bg, color: v.color, border: v.border,
        opacity: disabled ? 0.4 : 1, transition: 'opacity 0.2s',
        textTransform: 'uppercase', ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export const Badge = ({ children, color = CC.accent, style }) => (
  <span style={{
    fontFamily: FONTS.heading, fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
    padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase',
    background: `${color}20`, color, border: `1px solid ${color}40`,
    ...style,
  }}>
    {children}
  </span>
)

export const SectionHeader = ({ children, style }) => (
  <div style={{
    fontFamily: FONTS.heading, fontSize: 11, fontWeight: 700, letterSpacing: 2,
    color: CC.textMuted, textTransform: 'uppercase', padding: '12px 0 6px',
    borderBottom: `1px solid ${CC.border}`, marginBottom: 10, ...style,
  }}>
    {children}
  </div>
)

export const Panel = ({ children, style }) => (
  <div style={{
    background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 8,
    padding: 14, marginBottom: 10, ...style,
  }}>
    {children}
  </div>
)

export const Row = ({ children, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}>
    {children}
  </div>
)

export const Grid = ({ children, cols = 2, style }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, ...style,
  }}>
    {children}
  </div>
)
