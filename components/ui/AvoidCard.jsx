'use client';

import React from 'react';
import { colors, radius, scoreColor, formatPrice } from './DesignTokens';
import { Tag } from './Primitives';

const CLASS_COLOR = {
  AVOID: '#EF4444',
};

export default function AvoidCard({ item, plan, explanation, onClick }) {
  const oppScore = item.opportunityScore ?? item.setupScore ?? null;
  const planSignal = plan?.planSignal || null;
  const reason = plan?.warnings?.[0] || item.warnings?.[0] || explanation?.warnings?.[0] || 'Poor setup quality';

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#1A0A0A',
        border: '1px solid #EF444440',
        borderRadius: radius.md,
        padding: '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: '#FCA5A5' }}>{item.symbol || '—'}</span>
        <Tag value="AVOID" colorMap={CLASS_COLOR} size="sm" />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: scoreColor(oppScore), fontFamily: 'monospace' }}>
          {oppScore ?? '—'}
        </span>
        {plan?.riskReward != null && (
          <span style={{ fontSize: 10, color: '#F87171', fontWeight: 700 }}>R/R {plan.riskReward}</span>
        )}
      </div>
      <div style={{ fontSize: 9, color: colors.text.secondary, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {reason}
      </div>
    </div>
  );
}
