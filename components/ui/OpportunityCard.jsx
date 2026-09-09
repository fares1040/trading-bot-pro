'use client';

import React from 'react';
import { colors, radius, scoreColor, riskRewardColor, formatPrice } from './DesignTokens';
import { Tag, SmallTag } from './Primitives';

const CLASS_COLOR = {
  STRONG_OPPORTUNITY: '#34D399',
  WATCH: '#FBBF24',
  CAUTION: '#FBBF24',
  AVOID: '#EF4444',
};
const CLASS_EMOJI = {
  STRONG_OPPORTUNITY: '🔥',
  WATCH: '👀',
  CAUTION: '⚠️',
  AVOID: '❌',
};

function classifyOpportunity(quality, planSignal) {
  if (planSignal === 'AVOID' || quality === 'UNAVAILABLE') return { label: 'AVOID', emoji: '❌', color: '#EF4444' };
  if (planSignal === 'WATCH') return { label: 'WATCH', emoji: '👀', color: '#FBBF24' };
  if (planSignal === 'STRONG_PLAN' || planSignal === 'VALID_PLAN') return { label: 'STRONG OPPORTUNITY', emoji: '🔥', color: '#34D399' };
  if (quality === 'TOP' || quality === 'STRONG') return { label: 'STRONG OPPORTUNITY', emoji: '🔥', color: '#34D399' };
  if (quality === 'WATCH') return { label: 'WATCH', emoji: '👀', color: '#FBBF24' };
  if (quality === 'WEAK') return { label: 'CAUTION', emoji: '⚠️', color: '#FBBF24' };
  return { label: 'AVOID', emoji: '❌', color: '#EF4444' };
}

export default function OpportunityCard({ item, plan, explanation, isSelected, onClick, compact = false }) {
  const oppScore = item.opportunityScore ?? item.setupScore ?? null;
  const planScore = plan?.planScore ?? null;
  const direction = plan?.direction || item.directionBias || item.direction || null;
  const riskReward = plan?.riskReward ?? item.riskReward ?? null;
  const planSignal = plan?.planSignal || null;
  const classification = classifyOpportunity(item.quality, planSignal);
  const whyNow = explanation?.whyNow?.[0] || item.reasons?.[0] || null;
  const warning = plan?.warnings?.[0] || item.warnings?.[0] || explanation?.warnings?.[0] || null;
  const timeframe = plan?.expectedTimeframe || item.expectedTimeframe || null;
  const assetType = item.assetType || item.kind || 'STOCK';
  const accent = classification.color;

  const cardStyle = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: isSelected ? '#0F1420' : classification.label === 'AVOID' ? '#1A0A0A' : classification.label === 'WATCH' ? '#1A1500' : '#0B0F17',
    border: `1px solid ${isSelected ? colors.accent.blue + '70' : accent + '35'}`,
    borderRadius: radius.lg,
    padding: compact ? '12px 14px' : '16px 18px',
    cursor: 'pointer',
    transition: 'transform .16s ease, border-color .16s ease, box-shadow .16s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: compact ? 6 : 8,
    boxShadow: isSelected ? `0 0 0 1px ${colors.accent.blue}22, 0 10px 28px rgba(0,0,0,.2)` : '0 8px 24px rgba(0,0,0,.12)',
  };

  const scoreBlock = (
    <div dir="ltr" style={{ textAlign: 'center', minWidth: compact ? 42 : 48 }}>
      <div style={{ fontSize: compact ? 18 : 22, fontWeight: 900, color: scoreColor(oppScore), fontFamily: 'monospace', lineHeight: 1 }}>
        {oppScore ?? '—'}
      </div>
      <div style={{ fontSize: compact ? 6 : 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700, marginTop: 3 }}>C7</div>
    </div>
  );

  const planScoreBlock = planScore != null ? (
    <div dir="ltr" style={{ textAlign: 'center', minWidth: compact ? 42 : 48 }}>
      <div style={{ fontSize: compact ? 18 : 22, fontWeight: 900, color: scoreColor(planScore), fontFamily: 'monospace', lineHeight: 1 }}>{planScore}</div>
      <div style={{ fontSize: compact ? 6 : 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700, marginTop: 3 }}>C8</div>
    </div>
  ) : null;

  return (
    <div onClick={onClick} style={cardStyle} role="button" tabIndex={0}>
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}, transparent)` }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span dir="ltr" style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: compact ? 15 : 18, color: colors.text.primary }}>{item.symbol || '—'}</span>
          {!compact && <SmallTag value={assetType} color="#38BDF8" />}
          <span style={{ fontSize: compact ? 13 : 15 }} title={classification.label}>{classification.emoji}</span>
        </div>
        <Tag value={classification.label} colorMap={CLASS_COLOR} size={compact ? 'sm' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: compact ? 9 : 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {scoreBlock}
        {planScoreBlock}
        {direction && <Tag value={direction} colorMap={{ LONG: '#34D399', SHORT: '#F87171', NEUTRAL: '#FBBF24', UNAVAILABLE: '#475569' }} size={compact ? 'sm' : undefined} />}
        {timeframe && <Tag value={timeframe} colorMap={{ [timeframe]: '#38BDF8' }} size={compact ? 'sm' : undefined} />}
      </div>

      {plan && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: compact ? 6 : 8, marginTop: 3 }}>
          {(plan.entryZone || plan.entryPrice) && (
            <div style={{ textAlign: 'center', padding: compact ? '4px 2px' : '8px 6px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: compact ? 6 : 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>Entry</div>
              <div dir="ltr" style={{ fontSize: compact ? 11 : 14, fontWeight: 900, color: colors.text.primary, fontFamily: 'monospace' }}>{formatPrice(plan.entryZone ?? plan.entryPrice)}</div>
            </div>
          )}
          {(plan.stopLoss || plan.invalidation) && (
            <div style={{ textAlign: 'center', padding: compact ? '4px 2px' : '8px 6px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: compact ? 6 : 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>Stop</div>
              <div dir="ltr" style={{ fontSize: compact ? 11 : 14, fontWeight: 900, color: '#EF4444', fontFamily: 'monospace' }}>{formatPrice(plan.stopLoss ?? plan.invalidation)}</div>
            </div>
          )}
          {plan.target1 && (
            <div style={{ textAlign: 'center', padding: compact ? '4px 2px' : '8px 6px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: compact ? 6 : 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>Target {compact ? '' : '1'}</div>
              <div dir="ltr" style={{ fontSize: compact ? 11 : 14, fontWeight: 900, color: '#34D399', fontFamily: 'monospace' }}>{formatPrice(plan.target1)}</div>
            </div>
          )}
        </div>
      )}

      {riskReward != null && (
        <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 1 }}>
          <span style={{ fontSize: compact ? 8 : 9, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase' }}>R/R</span>
          <span style={{ fontSize: compact ? 13 : 16, fontWeight: 900, color: riskRewardColor(riskReward), fontFamily: 'monospace' }}>{riskReward}x</span>
        </div>
      )}

      {whyNow && (
        <div style={{ width: '100%', minWidth: 0, marginTop: 2, paddingTop: compact ? 5 : 6, borderTop: `1px solid ${colors.border}`, fontSize: compact ? 9 : 10, color: colors.accent.amber, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
          <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: compact ? 8 : 8, marginRight: 4 }}>Why Now</span>
          <span>{whyNow.explanation || String(whyNow)}</span>
        </div>
      )}

      {warning && (
        <div style={{ fontSize: compact ? 9 : 10, color: '#FBBF24', lineHeight: 1.35, padding: compact ? '3px 6px' : '4px 8px', backgroundColor: '#1A1500', borderRadius: radius.sm }}>
          ⚠ {warning}
        </div>
      )}
    </div>
  );
}