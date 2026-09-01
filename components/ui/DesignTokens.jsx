/**
 * Trading Bot Pro — Design Tokens
 *
 * Single source of truth for colors, spacing, typography and component styles.
 * All existing radar components share this palette implicitly; this module
 * makes it explicit so the Command Center can reuse the same language.
 *
 * IMPORTANT: These are presentation-only tokens. No business logic here.
 */

export const colors = {
  bg: '#07090E',
  panel: '#0B0F17',
  panelHover: '#0F1420',
  border: '#1F2636',
  borderStrong: '#2A3346',
  text: {
    primary: '#F8FAFC',
    secondary: '#CBD5E1',
    muted: '#94A3B8',
    faint: '#64748B',
    disabled: '#475569',
  },
  accent: {
    gold: '#FBBF24',
    blue: '#38BDF8',
    violet: '#8B5CF6',
    pink: '#EC4899',
    emerald: '#34D399',
    green: '#22C55E',
    red: '#F87171',
    crimson: '#EF4444',
    amber: '#F59E0B',
    slate: '#64748B',
  },
  semantic: {
    long: '#34D399',
    short: '#F87171',
    neutral: '#FBBF24',
    bullish: '#34D399',
    bearish: '#EF4444',
    riskOff: '#F87171',
    unavailable: '#475569',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#EF4444',
    info: '#38BDF8',
  },
  status: {
    ready: '#38BDF8',
    triggered: '#FBBF24',
    sent: '#34D399',
    failed: '#EF4444',
    disabled: '#475569',
    active: '#22C55E',
    new: '#34D399',
    acknowledged: '#A78BFA',
    resolved: '#9CA3AF',
    expired: '#6B7280',
  },
  quality: {
    TOP: '#34D399',
    STRONG: '#22C55E',
    WATCH: '#FBBF24',
    WEAK: '#F87171',
    UNAVAILABLE: '#475569',
  },
  confidence: {
    HIGH: '#34D399',
    MODERATE: '#22C55E',
    LOW: '#F87171',
    VERY_LOW: '#EF4444',
    UNKNOWN: '#475569',
  },
  regime: {
    BULLISH: '#34D399',
    NEUTRAL: '#FBBF24',
    RISK_OFF: '#F87171',
    BEARISH: '#EF4444',
    UNAVAILABLE: '#475569',
  },
  signal: {
    STRONG_PLAN: '#34D399',
    VALID_PLAN: '#22C55E',
    WATCH: '#FBBF24',
    AVOID: '#F87171',
    UNAVAILABLE: '#475569',
  },
  direction: {
    LONG: '#34D399',
    SHORT: '#F87171',
    NEUTRAL: '#FBBF24',
    UNAVAILABLE: '#475569',
  },
  severity: {
    CRITICAL: '#EF4444',
    HIGH: '#F59E0B',
    MEDIUM: '#FBBF24',
    LOW: '#60A5FA',
    INFO: '#94A3B8',
  },
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
};

export const radius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  full: '9999px',
};

export const typography = {
  mono: '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  display: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

export const panelStyle = {
  backgroundColor: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
};

export const focusRing = {
  outline: 'none',
  boxShadow: `0 0 0 2px ${colors.accent.blue}40`,
};

export function scoreColor(score) {
  if (score == null) return colors.text.disabled;
  if (score >= 85) return colors.quality.TOP;
  if (score >= 70) return colors.quality.STRONG;
  if (score >= 55) return colors.quality.WATCH;
  if (score >= 40) return colors.quality.WEAK;
  return colors.text.disabled;
}

export function riskRewardColor(rr) {
  if (rr == null) return colors.text.disabled;
  if (rr >= 2) return colors.semantic.long;
  if (rr >= 1) return colors.semantic.neutral;
  return colors.semantic.short;
}

export function formatPrice(value) {
  if (value == null) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 2 });
}

export function formatPercent(value) {
  if (value == null) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatVolume(value) {
  if (value == null) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(0);
}

export function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}