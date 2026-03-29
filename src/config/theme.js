// ════════════════════════════════════════════════════════════
// MKW DESIGN SYSTEM v2 — Modern Fintech Trading Interface
// Inspired by: TradingView clarity + Webull polish
// ════════════════════════════════════════════════════════════

// ─── COLOR TOKENS ───
// Rule: Green and red appear ONLY on P&L, directional signals, and
// explicit positive/negative states. Everything else is neutral.
export const colors = {
  // Backgrounds — layered depth system (darkest → lightest)
  bg: {
    root:     "#0a0e17",
    surface:  "#111622",
    elevated: "#171d2d",
    overlay:  "#1c2438",
    input:    "#0f1320",
  },

  // Borders — subtle, structural, never decorative
  border: {
    subtle:   "#1e2740",
    default:  "#263354",
    strong:   "#334675",
  },

  // Text — high contrast hierarchy
  text: {
    primary:   "#e2e8f4",
    secondary: "#8b97b8",
    tertiary:  "#505c7a",
    inverse:   "#0a0e17",
  },

  // Semantic — directional signals ONLY
  signal: {
    profit:      "#00c176",
    profitMuted: "#00c17625",
    loss:        "#e5334d",
    lossMuted:   "#e5334d25",
  },

  // Accent — brand/interactive elements
  accent: {
    primary:       "#3b7dff",
    primaryMuted:  "#3b7dff20",
    secondary:     "#7c5cfc",
    secondaryMuted:"#7c5cfc20",
    warning:       "#e5a318",
    warningMuted:  "#e5a31820",
    info:          "#2da5d6",
    infoMuted:     "#2da5d620",
  },

  // Chart palette — for multi-series data visualization
  chart: {
    blue:   "#3b7dff",
    purple: "#7c5cfc",
    amber:  "#e5a318",
    cyan:   "#2da5d6",
    rose:   "#e5334d",
    green:  "#00c176",
    slate:  "#505c7a",
  },

  // Grade colors — for scoring/grading systems
  grade: {
    aPlus: "#00c176",
    a:     "#00c176",
    bPlus: "#2da5d6",
    b:     "#3b7dff",
    c:     "#e5a318",
    d:     "#e5334d",
    f:     "#e5334d",
  },

  // Tier colors — challenge progression
  tier: {
    survival:   "#e5334d",
    growth:     "#e5a318",
    accelerate: "#3b7dff",
    protect:    "#00c176",
  },
};

// ─── TYPOGRAPHY ───
export const fonts = {
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'Geist Mono', 'JetBrains Mono', 'SF Mono', 'Consolas', monospace",
  heading: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// Font import string (add to root component or HTML head)
export const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
`;

// ─── SPACING ───
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

// ─── RADIUS ───
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};

// ─── SHADOWS ───
export const shadows = {
  sm: "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
  md: "0 4px 12px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)",
  lg: "0 8px 24px rgba(0,0,0,0.35), 0 4px 8px rgba(0,0,0,0.25)",
  focus: "0 0 0 2px #3b7dff40",
};

// ─── TRANSITIONS ───
export const transitions = {
  fast: "all 0.12s ease",
  normal: "all 0.2s ease",
  slow: "all 0.35s ease",
};

// ─── HELPER FUNCTIONS ───
export function gradeColor(grade) {
  if (!grade) return colors.text.tertiary;
  const g = grade.toString().toUpperCase();
  if (g === "A+" || g === "A" || g === "AA" || g === "AA+" || g === "AA-" || g === "AAA") return colors.grade.a;
  if (g === "B+" || g === "A-") return colors.grade.bPlus;
  if (g === "B" || g.startsWith("BBB")) return colors.grade.b;
  if (g === "C") return colors.grade.c;
  return colors.grade.f;
}

export function pnlColor(value) {
  if (value > 0) return colors.signal.profit;
  if (value < 0) return colors.signal.loss;
  return colors.text.secondary;
}

export function tierColor(tierName) {
  const key = tierName?.toLowerCase();
  return colors.tier[key] || colors.accent.primary;
}

export function zoneColor(z) {
  if (!z) return colors.text.tertiary;
  const s = String(z).toUpperCase();
  if (s.includes('CONVERGENCE')) return colors.accent.warning;
  if (s.includes('SECONDARY')) return colors.accent.info;
  if (s.includes('BUILDING')) return colors.accent.secondary;
  if (s.includes('SHORT')) return colors.signal.loss;
  return colors.text.tertiary;
}
