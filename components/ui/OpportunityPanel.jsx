'use client';

import React from 'react';
import { colors, radius, scoreColor } from './DesignTokens';
import { Tag, EmptyState, LoadingState } from './Primitives';

/**
 * Top Opportunities Panel
 *
 * Compact horizontal list of the highest-scoring opportunities from C7.
 * Each card shows: symbol, score, quality, direction, confidence, and basic
 * trade plan levels from C8. Clicking a card opens the detail view.
 *
 * Data source: C7 Opportunity Ranking (lib/opportunity-ranking.js)
 * No data fabrication — unavailable fields render as "—".
 */

const panelStyle = {
  backgroundColor: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
};

function TopOpportunityCard({ item, index, onClick }) {
  const symbol = item.symbol || '—';
  const oppScore = item.opportunityScore ?? item.setupScore ?? null;
  const quality = item.quality || 'UNAVAILABLE';
  const confidence = item.confidenceLevel || 'UNKNOWN';
  const confidenceNum = item.confidence ?? null;
  const riskReward = item.riskReward ?? null;
  const setup = item.setup || item.signal || '—';
  const direction = item.directionBias || item.direction || null;
  const entryZone = item.entryZone ?? item.keyLevels?.entryZone ?? null;
  const stopLoss = item.stopLoss ?? item.keyLevels?.stopLoss ?? null;
  const target1 = item.target1 ?? item.keyLevels?.target1 ?? null;
  const qualityColorMap = { TOP: '#34D399', STRONG: '#22C55E', WATCH: '#FBBF24', WEAK: '#F87171', UNAVAILABLE: '#475569' };

  const directionColorMap = { LONG: '#34D399', SHORT: '#F87171', NEUTRAL: '#FBBF24', UNAVAILABLE: '#475569' };
  const confidenceColorMap = { HIGH: '#34D399', MODERATE: '#22C55E', LOW: '#F87171', VERY_LOW: '#EF4444', UNKNOWN: '#475569' };

  return (
    <div
      onClick={onClick}
      style={{
        ...panelStyle,
        padding: 14,
        minWidth: 220,
        maxWidth: 260,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        borderRadius: 10,
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.accent.gold}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = colors.border}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <strong style={{ color: colors.text.primary, fontFamily: 'inherit', fontSize: 14 }}>
            {symbol}
          </strong>
          <div style={{ fontSize: 9, color: colors.text.faint, marginTop: 2 }}>
            {setup !== '—' ? setup : '—'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Tag value={quality} colorMap={qualityColorMap} size="sm" />
          <div style={{ fontSize: 9, color: colors.text.faint, marginTop: 2 }}>
            #{index + 1}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: scoreColor(oppScore), fontFamily: 'inherit' }}>
            {oppScore ?? '—'}
          </div>
          <div style={{ fontSize: 8, color: colors.text.faint }}>Score</div>
        </div>
        {direction && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: directionColorMap[direction] || colors.text.faint, fontFamily: 'inherit', textTransform: 'uppercase' }}>
              {direction}
            </div>
            <div style={{ fontSize: 8, color: colors.text.faint }}>Direction</div>
          </div>
        )}
        {confidenceNum != null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: confidenceColorMap[confidence] || colors.text.faint, fontFamily: 'inherit' }}>
              {confidenceNum}
            </div>
            <div style={{ fontSize: 8, color: colors.text.faint }}>Confidence</div>
          </div>
        )}
        {riskReward != null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: riskReward >= 2 ? '#34D399' : riskReward >= 1 ? '#FBBF24' : '#F87171', fontFamily: 'inherit' }}>
              {riskReward}
            </div>
            <div style={{ fontSize: 8, color: colors.text.faint }}>R/R</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: colors.text.faint, lineHeight: 1.8 }}>
        {entryZone && <div>Entry: {entryZone}</div>}
        {stopLoss && <div>Stop: {stopLoss}</div>}
        {target1 && <div>T1: {target1}</div>}
      </div>
    </div>
  );
}

export default function TopOpportunitiesPanel({ topData = [], loading, onSelectSymbol }) {
  const opportunities = topData.slice(0, 5);

  if (loading) return <LoadingState message="Loading opportunities…" />;
  if (!opportunities.length) return <EmptyState icon="🎯" message="No opportunities available" sub="Market data loading or no qualifying setups" />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {opportunities.map((item, i) => (
          <TopOpportunityCard
            key={item.symbol}
            item={item}
            index={i}
            onClick={() => onSelectSymbol && onSelectSymbol(item.symbol)}
          />
        ))}
      </div>
    </div>
  );
}
