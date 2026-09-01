import React from 'react';
import {
  colors,
  spacing,
  radius,
  panelStyle,
  scoreColor,
  riskRewardColor,
  formatPrice,
  formatPercent,
  clamp,
} from './DesignTokens';

// ── Tag ──────────────────────────────────────────────────────────────────────
export function Tag({ value, colorMap, size = 'md' }) {
  if (value == null || value === '') return null;
  const color = colorMap?.[value] || colors.text.disabled;
  const fontSize = size === 'sm' ? 8 : size === 'lg' ? 10 : 9;
  const padding = size === 'sm' ? '1px 6px' : size === 'lg' ? '3px 10px' : '2px 8px';
  return (
    <span style={{
      color,
      fontSize,
      fontWeight: 700,
      backgroundColor: color + '1A',
      border: `1px solid ${color}40`,
      padding,
      borderRadius: radius.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {value}
    </span>
  );
}

// ── SmallTag ─────────────────────────────────────────────────────────────────
export function SmallTag({ value, color }) {
  if (!value && value !== 0) return null;
  return (
    <span style={{
      color: color || colors.text.faint,
      fontSize: 8,
      fontWeight: 600,
      backgroundColor: (color ? color + '1A' : '#1E293B'),
      border: `1px solid ${color ? color + '40' : '#334155'}`,
      padding: '1px 6px',
      borderRadius: 4,
      letterSpacing: 0.3,
      whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {value}
    </span>
  );
}

// ── ScoreBar ─────────────────────────────────────────────────────────────────
export function ScoreBar({ score, max = 100, color, height = 6 }) {
  const pct = clamp(score, 0, max);
  const barColor = color || scoreColor(score);
  return (
    <div style={{ height, backgroundColor: '#1E293B', borderRadius: Math.max(1, height / 2), overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${(pct / max) * 100}%`, backgroundColor: barColor, transition: 'width 0.3s' }} />
    </div>
  );
}

// ── LevelRow ─────────────────────────────────────────────────────────────────
export function LevelRow({ label, value, fallback = '—', mono = true }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10, color: colors.text.secondary, lineHeight: 1.7 }}>
      <span style={{ color: colors.text.faint }}>{label}</span>
      <span style={{ color: value != null ? colors.text.primary : colors.text.disabled, fontFamily: mono ? 'inherit' : 'inherit', fontWeight: 700 }}>
        {value ?? fallback}
      </span>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────
export function Panel({ children, style, ...props }) {
  return (
    <div style={{ ...panelStyle, ...style }} {...props}>
      {children}
    </div>
  );
}

// ── SectionTitle ─────────────────────────────────────────────────────────────
export function SectionTitle({ label, icon, color = colors.accent.blue, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
      <div>
        <div style={{ color, fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
          {icon && `${icon} `}{label}
        </div>
        {children}
      </div>
    </div>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ icon = '—', message = 'No data available', sub }) {
  return (
    <div style={{ ...panelStyle, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>{icon}</div>
      <div style={{ color: colors.text.muted, fontSize: 12 }}>{message}</div>
      {sub && <div style={{ color: colors.text.faint, fontSize: 10, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── LoadingState ─────────────────────────────────────────────────────────────
export function LoadingState({ message = 'Loading…' }) {
  return (
    <div style={{ ...panelStyle, padding: 24, textAlign: 'center' }}>
      <div style={{ color: colors.text.muted, fontSize: 12 }}>⏳ {message}</div>
    </div>
  );
}

// ── ErrorState ───────────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }) {
  return (
    <div style={{ ...panelStyle, padding: 20, borderColor: '#7F1D1D', textAlign: 'center' }}>
      <div style={{ color: '#FCA5A5', fontSize: 12, marginBottom: 8 }}>⚠️ {message}</div>
      {onRetry && (
        <button onClick={onRetry} style={{
          fontSize: 11, color: colors.accent.blue, background: 'none', border: 'none',
          cursor: 'pointer', textDecoration: 'underline',
        }}>Retry</button>
      )}
    </div>
  );
}

// ── AlertBadge ───────────────────────────────────────────────────────────────
export function AlertBadge({ status }) {
  const map = {
    READY: colors.status.ready,
    TRIGGERED: colors.status.triggered,
    SENT: colors.status.sent,
    FAILED: colors.status.failed,
    DISABLED: colors.status.disabled,
    ACTIVE: colors.status.active,
    NEW: colors.status.new,
    ACKNOWLEDGED: colors.status.acknowledged,
    RESOLVED: colors.status.resolved,
    EXPIRED: colors.status.expired,
  };
  const color = map[status] || colors.text.disabled;
  return (
    <span style={{
      color,
      fontSize: 8,
      fontWeight: 700,
      backgroundColor: color + '1A',
      border: `1px solid ${color}40`,
      padding: '1px 6px',
      borderRadius: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      whiteSpace: 'nowrap',
    }}>
      ● {status}
    </span>
  );
}

// ── QualityBadge ─────────────────────────────────────────────────────────────
export function QualityBadge({ quality }) {
  const colorMap = { TOP: '#34D399', STRONG: '#22C55E', WATCH: '#FBBF24', WEAK: '#F87171', UNAVAILABLE: '#475569' };
  return <Tag value={quality} colorMap={colorMap} />;
}

// ── DirectionBadge ───────────────────────────────────────────────────────────
export function DirectionBadge({ direction }) {
  const colorMap = { LONG: '#34D399', SHORT: '#F87171', NEUTRAL: '#FBBF24', UNAVAILABLE: '#475569' };
  return <Tag value={direction} colorMap={colorMap} />;
}

// ── StatusDot ────────────────────────────────────────────────────────────────
export function StatusDot({ status, size = 8 }) {
  const colorMap = {
    active: '#34D399', new: '#34D399', confirmed: '#38BDF8',
    triggered: '#FBBF24', sent: '#34D399', failed: '#EF4444',
    disabled: '#475569', watch: '#94A3B8', ready: '#38BDF8',
  };
  const color = colorMap[status] || '#475569';
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      backgroundColor: color, display: 'inline-block',
      boxShadow: `0 0 6px ${color}60`,
    }} />
  );
}

// ── Button ───────────────────────────────────────────────────────────────────
export function Button({ children, onClick, variant = 'default', size = 'md', ...props }) {
  const variants = {
    default: { bg: '#0B0F17', color: '#CBD5E1', border: '#1F2636', hover: '#141B28' },
    primary: { bg: '#1E3A5F', color: '#38BDF8', border: '#1E3A5F', hover: '#254A6E' },
    accent: { bg: '#FBBF2420', color: '#FBBF24', border: '#FBBF2440', hover: '#FBBF2430' },
    danger: { bg: '#7F1D1D20', color: '#EF4444', border: '#7F1D1D40', hover: '#7F1D1D30' },
  };
  const sizes = { sm: { px: '8px', py: '4px', fontSize: 10 }, md: { px: '12px', py: '6px', fontSize: 11 }, lg: { px: '16px', py: '8px', fontSize: 12 } };
  const v = variants[variant] || variants.default;
  const s = sizes[size] || sizes.md;
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: v.bg, color: v.color, border: `1px solid ${v.border}`,
        borderRadius: radius.md, padding: `${s.py} ${s.px}`, fontSize: s.fontSize,
        fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = v.hover}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = v.bg}
      {...props}
    >
      {children}
    </button>
  );
}

// ── TabGroup ─────────────────────────────────────────────────────────────────
export function TabGroup({ tabs, active, onTabChange, variant = 'default' }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const activeColors = {
          default: { bg: '#0B0F17', color: '#38BDF8', border: '#38BDF8' },
          gold: { bg: '#FBBF2420', color: '#FBBF24', border: '#FBBF24' },
          violet: { bg: '#8B5CF620', color: '#8B5CF6', border: '#8B5CF6' },
        };
        const c = activeColors[variant] || activeColors.default;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              fontSize: 10, fontWeight: 600, padding: '4px 12px', borderRadius: 8,
              border: isActive ? `1px solid ${c.border}` : '1px solid #1F2636',
              backgroundColor: isActive ? c.bg : '#05060D',
              color: isActive ? c.color : '#94A3B8',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── PriceDisplay ─────────────────────────────────────────────────────────────
export function PriceDisplay({ value, variant = 'primary' }) {
  const colorMap = {
    primary: colors.text.primary,
    positive: colors.semantic.long,
    negative: colors.semantic.short,
  };
  return (
    <span style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: colorMap[variant] || colorMap.primary }}>
      {formatPrice(value)}
    </span>
  );
}

// ── ChangeDisplay ────────────────────────────────────────────────────────────
export function ChangeDisplay({ value }) {
  if (value == null) return <span style={{ color: colors.text.disabled, fontSize: 11 }}>—</span>;
  const isUp = Number(value) >= 0;
  return (
    <span style={{ color: isUp ? colors.semantic.long : colors.semantic.short, fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
      {isUp ? '▲' : '▼'} {Math.abs(Number(value)).toFixed(2)}%
    </span>
  );
}