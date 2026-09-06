'use client';

import React from 'react';
import Link from 'next/link';
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

export default function OpportunityCard({
  item,
  plan,
  explanation,
  isSelected,
  onClick,
  compact = false,
}) {
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

  if (compact) {
    return (
      <div
        onClick={onClick}
        style={{
          backgroundColor: isSelected ? '#0F1420' : '#0B0F17',
          border: `2px solid ${isSelected ? colors.accent.blue + '55' : colors.border}`,
          borderRadius: radius.lg,
          padding: '12px 14px',
          cursor: 'pointer',
          transition: 'all 0.15s',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minWidth: 260,
          maxWidth: 320,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 15, color: colors.text.primary }}>
              {item.symbol || '—'}
            </span>
            <span style={{ fontSize: 13 }} title={classification.label}>{classification.emoji}</span>
          </div>
          <Tag value={classification.label} colorMap={CLASS_COLOR} size="sm" />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: scoreColor(oppScore), fontFamily: 'monospace' }}>{oppScore ?? '—'}</div>
            <div style={{ fontSize: 6, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>C7</div>
          </div>
          {planScore != null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: scoreColor(planScore), fontFamily: 'monospace' }}>{planScore}</div>
              <div style={{ fontSize: 6, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>C8</div>
            </div>
          )}
          {direction && <Tag value={direction} colorMap={{ LONG: '#34D399', SHORT: '#F87171', NEUTRAL: '#FBBF24', UNAVAILABLE: '#475569' }} size="sm" />}
          {timeframe && <Tag value={timeframe} colorMap={{ [timeframe]: '#38BDF8' }} size="sm" />}
        </div>

        {plan && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 4 }}>
            {(plan.entryZone || plan.entryPrice) && (
              <div style={{ textAlign: 'center', padding: '4px 2px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
                <div style={{ fontSize: 6, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>Entry</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: colors.text.primary, fontFamily: 'monospace' }}>{formatPrice(plan.entryZone ?? plan.entryPrice)}</div>
              </div>
            )}
            {(plan.stopLoss || plan.invalidation) && (
              <div style={{ textAlign: 'center', padding: '4px 2px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
                <div style={{ fontSize: 6, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>Stop</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#EF4444', fontFamily: 'monospace' }}>{formatPrice(plan.stopLoss ?? plan.invalidation)}</div>
              </div>
            )}
            {plan.target1 && (
              <div style={{ textAlign: 'center', padding: '4px 2px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
                <div style={{ fontSize: 6, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>Target</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#34D399', fontFamily: 'monospace' }}>{formatPrice(plan.target1)}</div>
              </div>
            )}
          </div>
        )}

        {riskReward != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 8, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase' }}>R/R</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: riskRewardColor(riskReward), fontFamily: 'monospace' }}>{riskReward}x</span>
          </div>
        )}

        {whyNow && (
          <div style={{ fontSize: 9, color: colors.accent.amber, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 8 }}>Why Now</span>
            <span style={{ marginRight: 4 }}>{whyNow.explanation || String(whyNow)}</span>
          </div>
        )}

        {warning && (
          <div style={{ fontSize: 9, color: '#FBBF24', lineHeight: 1.3, padding: '3px 6px', backgroundColor: '#1A1500', borderRadius: radius.sm }}>
            ⚠ {warning}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: isSelected ? '#0F1420' : '#0B0F17',
        border: `2px solid ${isSelected ? colors.accent.blue + '55' : colors.border}`,
        borderRadius: radius.lg,
        padding: '16px 18px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 18, color: colors.text.primary }}>{item.symbol || '—'}</span>
          <SmallTag value={assetType} color="#38BDF8" />
          <span style={{ fontSize: 16 }} title={classification.label}>{classification.emoji}</span>
        </div>
        <Tag value={classification.label} colorMap={CLASS_COLOR} />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor(oppScore), fontFamily: 'monospace' }}>{oppScore ?? '—'}</div>
          <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>C7</div>
        </div>
        {planScore != null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor(planScore), fontFamily: 'monospace' }}>{planScore}</div>
            <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>C8</div>
          </div>
        )}
        {direction && <Tag value={direction} colorMap={{ LONG: '#34D399', SHORT: '#F87171', NEUTRAL: '#FBBF24', UNAVAILABLE: '#475569' }} />}
        {timeframe && <Tag value={timeframe} colorMap={{ [timeframe]: '#38BDF8' }} />}
      </div>

      {plan && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
          {(plan.entryZone || plan.entryPrice) && (
            <div style={{ textAlign: 'center', padding: '8px 6px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Entry</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: colors.text.primary, fontFamily: 'monospace' }}>{formatPrice(plan.entryZone ?? plan.entryPrice)}</div>
            </div>
          )}
          {(plan.stopLoss || plan.invalidation) && (
            <div style={{ textAlign: 'center', padding: '8px 6px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Stop</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#EF4444', fontFamily: 'monospace' }}>{formatPrice(plan.stopLoss ?? plan.invalidation)}</div>
            </div>
          )}
          {plan.target1 && (
            <div style={{ textAlign: 'center', padding: '8px 6px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Target 1</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#34D399', fontFamily: 'monospace' }}>{formatPrice(plan.target1)}</div>
            </div>
          )}
        </div>
      )}

      {riskReward != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase' }}>R/R</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: riskRewardColor(riskReward), fontFamily: 'monospace' }}>{riskReward}x</span>
        </div>
      )}

      {whyNow && (
        <div style={{ fontSize: 10, color: colors.accent.amber, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {whyNow.explanation || String(whyNow)}
        </div>
      )}

      {warning && (
        <div style={{ fontSize: 10, color: '#FBBF24', lineHeight: 1.4, padding: '4px 8px', backgroundColor: '#1A1500', borderRadius: radius.sm }}>
          ⚠ {warning}
        </div>
      )}
    </div>
  );
}
