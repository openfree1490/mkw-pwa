// ════════════════════════════════════════════════════════════
// MKW Shared UI Components — Modern Fintech Design System
// ════════════════════════════════════════════════════════════
import { colors, fonts, space, radius, shadows, transitions } from '../../config/theme.js'

// ─── PANEL ───
// Primary container. Variants: default, elevated, outlined, accent
// Padding: default (20px), tight (14px), none (0)
export const Panel = ({ children, variant = 'default', padding = 'default', accentColor, style, onClick }) => {
  const padMap = { default: space.xl, tight: 14, none: 0 }
  const variants = {
    default:  { background: colors.bg.surface, border: `1px solid ${colors.border.subtle}` },
    elevated: { background: colors.bg.elevated, border: `1px solid ${colors.border.subtle}` },
    outlined: { background: 'transparent', border: `1px solid ${colors.border.default}` },
    accent:   { background: colors.bg.surface, border: `1px solid ${colors.border.subtle}`, borderLeft: `3px solid ${accentColor || colors.accent.primary}` },
  }
  const v = variants[variant] || variants.default
  return (
    <div onClick={onClick} style={{
      borderRadius: radius.lg,
      padding: padMap[padding] ?? space.xl,
      ...v,
      cursor: onClick ? 'pointer' : undefined,
      transition: transitions.normal,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── DATA CELL ───
// Purpose-built metric display.
export const DataCell = ({ label, value, sentiment, size = 'default', color: colorProp, mono = true, style }) => {
  const sizeMap = { default: 20, large: 28, small: 16 }
  let valueColor = colors.text.primary
  if (sentiment === 'positive') valueColor = colors.signal.profit
  else if (sentiment === 'negative') valueColor = colors.signal.loss
  if (colorProp) valueColor = colorProp
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs + 2, ...style }}>
      {label && (
        <span style={{
          fontFamily: fonts.body, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          color: colors.text.tertiary,
        }}>{label}</span>
      )}
      <span style={{
        fontFamily: mono ? fonts.mono : fonts.body,
        fontSize: sizeMap[size] || sizeMap.default,
        fontWeight: 700, color: valueColor, lineHeight: 1.2,
      }}>{value ?? '—'}</span>
    </div>
  )
}

// ─── BUTTON ───
export const Button = ({ children, onClick, variant = 'primary', size = 'default', disabled, style, ...props }) => {
  const variants = {
    primary:   { background: colors.accent.primary, color: '#fff', border: 'none' },
    secondary: { background: 'transparent', color: colors.accent.primary, border: `1px solid ${colors.accent.primary}` },
    danger:    { background: colors.signal.loss, color: '#fff', border: 'none' },
    ghost:     { background: 'transparent', color: colors.text.secondary, border: 'none' },
    profit:    { background: colors.signal.profit, color: '#fff', border: 'none' },
  }
  const v = variants[variant] || variants.primary
  const padMap = { default: '10px 20px', sm: '6px 14px' }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: fonts.body, fontSize: size === 'sm' ? 11 : 13, fontWeight: 600,
        letterSpacing: '0.02em', textTransform: 'uppercase',
        padding: padMap[size] || padMap.default,
        borderRadius: radius.sm, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: transitions.normal,
        ...v,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── BADGE ───
export const Badge = ({ children, color = colors.accent.primary, style }) => (
  <span style={{
    display: 'inline-block', fontFamily: fonts.body,
    fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
    padding: '3px 10px', borderRadius: radius.sm,
    background: `${color}18`, color, border: `1px solid ${color}40`,
    ...style,
  }}>
    {children}
  </span>
)

// ─── PROGRESS BAR ───
export const ProgressBar = ({ value = 0, max = 100, color = colors.accent.primary, height = 6, style }) => (
  <div style={{
    width: '100%', height, background: colors.bg.input,
    borderRadius: radius.full, overflow: 'hidden', ...style,
  }}>
    <div style={{
      width: `${Math.min(100, Math.max(0, (value / max) * 100))}%`,
      height: '100%', background: color, borderRadius: radius.full,
      transition: transitions.normal,
    }} />
  </div>
)

// ─── INPUT ───
export const Input = ({ label, value, onChange, type = 'text', placeholder, style, ...props }) => (
  <div style={{ marginBottom: space.md, ...style }}>
    {label && (
      <label style={{
        display: 'block', fontFamily: fonts.body, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: colors.text.tertiary, marginBottom: space.xs,
      }}>{label}</label>
    )}
    <input
      type={type} value={value}
      onChange={e => onChange(type === 'number' ? e.target.value : e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '10px 14px',
        fontFamily: type === 'number' ? fonts.mono : fonts.body, fontSize: 13,
        color: colors.text.primary, background: colors.bg.input,
        border: `1px solid ${colors.border.subtle}`, borderRadius: radius.sm,
        transition: transitions.normal, outline: 'none',
      }}
      onFocus={e => { e.target.style.borderColor = colors.border.strong; e.target.style.boxShadow = shadows.focus }}
      onBlur={e => { e.target.style.borderColor = colors.border.subtle; e.target.style.boxShadow = 'none' }}
      {...props}
    />
  </div>
)

// ─── SELECT ───
export const Select = ({ label, value, onChange, options, style }) => (
  <div style={{ marginBottom: space.md, ...style }}>
    {label && (
      <label style={{
        display: 'block', fontFamily: fonts.body, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: colors.text.tertiary, marginBottom: space.xs,
      }}>{label}</label>
    )}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '10px 14px',
        fontFamily: fonts.mono, fontSize: 13,
        color: colors.text.primary, background: colors.bg.input,
        border: `1px solid ${colors.border.subtle}`, borderRadius: radius.sm,
        appearance: 'none', cursor: 'pointer', outline: 'none',
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

// ─── SECTION HEADER ───
export const SectionHeader = ({ children, sub, right, onClick, expanded, style }) => (
  <div onClick={onClick} style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: space.lg, cursor: onClick ? 'pointer' : 'default',
    ...style,
  }}>
    <div>
      <div style={{
        fontFamily: fonts.heading, fontSize: 16, fontWeight: 700,
        color: colors.text.primary,
      }}>{children}</div>
      {sub && (
        <div style={{
          fontFamily: fonts.body, fontSize: 12,
          color: colors.text.secondary, marginTop: 2,
        }}>{sub}</div>
      )}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
      {right}
      {onClick != null && (
        <span style={{ fontSize: 11, color: colors.text.tertiary }}>{expanded ? '\u25B2' : '\u25BC'}</span>
      )}
    </div>
  </div>
)

// ─── TAB BAR ───
export const TabBar = ({ tabs, active, onSelect, style }) => (
  <div style={{
    display: 'flex', gap: 0, overflowX: 'auto',
    borderBottom: `1px solid ${colors.border.subtle}`,
    ...style,
  }}>
    {tabs.map(t => {
      const key = typeof t === 'string' ? t : t.key
      const label = typeof t === 'string' ? t : (t.label || t.key)
      const isActive = active === key
      return (
        <button key={key} onClick={() => onSelect(key)} style={{
          fontFamily: fonts.body, fontWeight: isActive ? 600 : 500, fontSize: 13,
          color: isActive ? colors.text.primary : colors.text.tertiary,
          padding: '12px 18px', flexShrink: 0, cursor: 'pointer',
          borderBottom: isActive ? `2px solid ${colors.accent.primary}` : '2px solid transparent',
          background: 'none', border: 'none',
          borderBottomWidth: 2, borderBottomStyle: 'solid',
          borderBottomColor: isActive ? colors.accent.primary : 'transparent',
          transition: transitions.normal,
        }}>{label}</button>
      )
    })}
  </div>
)

// ─── ROW / GRID ───
export const Row = ({ children, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, ...style }}>
    {children}
  </div>
)

export const Grid = ({ children, cols = 2, style }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: space.lg, ...style,
  }}>
    {children}
  </div>
)

// ─── COLLAPSIBLE ───
import { useState } from 'react'
export const Collapsible = ({ title, right, children, defaultOpen = false, style }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Panel style={{ marginBottom: space.md, ...style }} padding="none">
      <div onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${space.md}px ${space.lg}px`, cursor: 'pointer',
        borderBottom: open ? `1px solid ${colors.border.subtle}` : 'none',
      }}>
        <span style={{ fontFamily: fonts.heading, fontSize: 14, fontWeight: 700, color: colors.text.primary }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
          {right}
          <span style={{ fontSize: 11, color: colors.text.tertiary }}>{open ? '\u25B2' : '\u25BC'}</span>
        </div>
      </div>
      {open && <div style={{ padding: space.lg }}>{children}</div>}
    </Panel>
  )
}

// ─── MONO TEXT ───
export const Mono = ({ children, color, size = 12, style: s }) => (
  <span style={{ fontFamily: fonts.mono, fontSize: size, color: color || colors.text.primary, ...s }}>{children}</span>
)

// ─── PCT ───
export const Pct = ({ v, size = 13 }) => {
  if (v == null || isNaN(v)) return <span style={{ color: colors.text.tertiary, fontSize: size, fontFamily: fonts.mono }}>—</span>
  const n = Number(v)
  const c = n >= 0 ? colors.signal.profit : colors.signal.loss
  return <span style={{ color: c, fontSize: size, fontFamily: fonts.mono }}>{n >= 0 ? '+' : ''}{n.toFixed(2)}%</span>
}
