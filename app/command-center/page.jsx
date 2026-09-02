'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  colors, radius, panelStyle, scoreColor, riskRewardColor,
} from '@/components/ui/DesignTokens';
import {
  Tag, SmallTag, SectionTitle, EmptyState, LoadingState, ErrorState, StatusDot,
  TabGroup, ScoreBar,
} from '@/components/ui/Primitives';
import { deriveTradeStage, DecisionBanner } from '@/components/ui/Lifecycle';
import { NotificationAlertPanel } from '@/components/ui/NotificationAlertPanel';
import { NOTIFICATION_STATUSES } from '@/lib/notification-contract';

const panel = { ...panelStyle };
const REGIME_META = {
  BULLISH: { label: 'BULLISH', desc: 'RISK-ON', color: '#34D399' },
  NEUTRAL: { label: 'NEUTRAL', desc: 'SELECTIVE', color: '#FBBF24' },
  RISK_OFF: { label: 'RISK-OFF', desc: 'DEFENSIVE', color: '#F87171' },
  BEARISH: { label: 'BEARISH', desc: 'RISK-OFF', color: '#EF4444' },
  UNAVAILABLE: { label: 'UNAVAILABLE', desc: 'NO DATA', color: '#475569' },
};
const Q_COLOR = { TOP: '#34D399', STRONG: '#22C55E', WATCH: '#FBBF24', WEAK: '#F87171', UNAVAILABLE: '#475569' };
const D_COLOR = { LONG: '#34D399', SHORT: '#F87171', NEUTRAL: '#FBBF24', UNAVAILABLE: '#475569' };
const S_COLOR = { STRONG_PLAN: '#34D399', VALID_PLAN: '#22C55E', WATCH: '#FBBF24', AVOID: '#EF4444', UNAVAILABLE: '#475569' };
const CLASS_COLOR = { 'STRONG OPPORTUNITY': '#34D399', 'WATCH': '#FBBF24', 'CAUTION': '#FBBF24', 'AVOID': '#EF4444' };

function classifyOpportunity(quality, planSignal) {
  if (planSignal === 'AVOID' || quality === 'UNAVAILABLE') return { label: 'AVOID', emoji: '❌', color: '#EF4444' };
  if (planSignal === 'WATCH') return { label: 'WATCH', emoji: '👀', color: '#FBBF24' };
  if (planSignal === 'STRONG_PLAN' || planSignal === 'VALID_PLAN') return { label: 'STRONG OPPORTUNITY', emoji: '🔥', color: '#34D399' };
  if (quality === 'TOP' || quality === 'STRONG') return { label: 'STRONG OPPORTUNITY', emoji: '🔥', color: '#34D399' };
  if (quality === 'WATCH') return { label: 'WATCH', emoji: '👀', color: '#FBBF24' };
  if (quality === 'WEAK') return { label: 'CAUTION', emoji: '⚠️', color: '#FBBF24' };
  return { label: 'AVOID', emoji: '❌', color: '#EF4444' };
}

function fmtLvl(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 2 });
}

function ZoneLabel({ label, icon, color = colors.accent.blue }) {
  return (
    <div style={{
      color, fontSize: 8, fontWeight: 900, textTransform: 'uppercase',
      letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4,
    }}>
      {icon && <span style={{ opacity: 0.6 }}>{icon}</span>}{label}
    </div>
  );
}

function MarketHeader({ indices, regime, regimeScore, confidenceLevel, vix, marketStatus, lastUpdate, warning }) {
  const meta = REGIME_META[regime] || REGIME_META.UNAVAILABLE;
  return (
    <div style={{ ...panel, padding: '16px 20px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: marketStatus?.open ? '#34D399' : '#EF4444',
            boxShadow: `0 0 6px ${marketStatus?.open ? '#34D39960' : '#EF444460'}`,
          }} />
          <div>
            <div style={{ fontSize: 9, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              HUNTER AI <span style={{ color: colors.accent.blue, marginLeft: 6 }}>LIVE</span>
            </div>
            <div style={{ fontSize: 10, color: colors.text.secondary, marginTop: 2 }}>
              {marketStatus?.open ? 'US Market Open' : 'US Market Closed'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {indices.slice(0, 4).map((idx) => (
            <div key={idx.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: colors.text.faint, fontSize: 9, fontWeight: 700 }}>{idx.symbol}</span>
              <span style={{ color: colors.text.primary, fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>
                {Number(idx.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
              <span style={{ color: idx.isUp ? '#34D399' : '#EF4444', fontSize: 10, fontWeight: 700 }}>
                {idx.isUp ? '▲' : '▼'} {Math.abs(Number(idx.change || 0)).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{
          padding: '10px 14px', backgroundColor: meta.color + '12',
          border: `1px solid ${meta.color}35`, borderRadius: radius.md,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: meta.color, fontFamily: 'monospace', letterSpacing: 0.8 }}>{meta.label}</div>
          <div style={{ width: 1, height: 22, backgroundColor: colors.border }} />
          <div>
            <div style={{ fontSize: 8, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{meta.desc}</div>
            {regimeScore != null && (
              <div style={{ fontSize: 11, fontWeight: 800, color: meta.color, fontFamily: 'monospace', marginTop: 1 }}>
                Score {regimeScore}
              </div>
            )}
          </div>
        </div>
        {confidenceLevel && <Tag value={confidenceLevel} colorMap={{ HIGH: '#34D399', MODERATE: '#22C55E', LOW: '#F87171', VERY_LOW: '#EF4444', UNKNOWN: '#475569' }} />}
        {vix != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', backgroundColor: '#07090E', border: `1px solid ${colors.border}`, borderRadius: radius.sm }}>
            <span style={{ color: colors.text.faint, fontSize: 8, fontWeight: 700 }}>VIX</span>
            <span style={{ color: vix > 20 ? '#EF4444' : vix > 15 ? '#FBBF24' : '#34D399', fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>{vix}</span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {warning && (<span style={{ color: '#FBBF24', fontSize: 9, fontWeight: 600 }}>⚠ {warning}</span>)}
          <span style={{ color: colors.text.faint, fontSize: 8, fontFamily: 'monospace' }}>
            {lastUpdate ? new Date(lastUpdate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function HuntCard({ item, plan, explanation, isSelected, onClick }) {
  const oppScore = item.opportunityScore ?? item.setupScore ?? null;
  const planScore = plan?.planScore ?? null;
  const direction = plan?.direction || item.directionBias || item.direction || null;
  const riskReward = plan?.riskReward ?? item.riskReward ?? null;
  const planSignal = plan?.planSignal || null;
  const classification = classifyOpportunity(item.quality, planSignal);
  const whyNow = explanation?.whyNow?.slice(0, 2) || [];
  const strongest = explanation?.positiveEvidence?.slice(0, 2) || item.evidence?.slice(0, 2) || [];
  const warning = plan?.warnings?.[0] || item.warnings?.[0] || explanation?.warnings?.[0] || null;

  return (
    <div onClick={onClick} style={{
      backgroundColor: isSelected ? '#0F1420' : '#0B0F17',
      border: `1px solid ${isSelected ? colors.accent.blue + '55' : colors.border}`,
      borderRadius: radius.lg, padding: '14px 16px', cursor: 'pointer',
      transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 16, color: colors.text.primary }}>{item.symbol || '—'}</span>
          <span style={{ fontSize: 14 }} title={classification.label}>{classification.emoji}</span>
        </div>
        <Tag value={classification.label} colorMap={CLASS_COLOR} size="sm" />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: scoreColor(oppScore), fontFamily: 'monospace' }}>{oppScore ?? '—'}</div>
          <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>C7</div>
        </div>
        {planScore != null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: scoreColor(planScore), fontFamily: 'monospace' }}>{planScore}</div>
            <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>C8</div>
          </div>
        )}
        <div style={{ width: 1, height: 28, backgroundColor: colors.border }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {direction && <Tag value={direction} colorMap={D_COLOR} size="sm" />}
          <Tag value={item.quality} colorMap={Q_COLOR} size="sm" />
          {planSignal && <Tag value={planSignal} colorMap={S_COLOR} size="sm" />}
        </div>
      </div>
      {(plan?.entryZone || plan?.entryPrice || plan?.stopLoss || plan?.target1) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {(plan.entryZone || plan.entryPrice) ? (
            <div style={{ padding: '6px 8px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>Entry</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: colors.text.primary, fontFamily: 'monospace' }}>{fmtLvl(plan.entryZone || plan.entryPrice)}</div>
            </div>
          ) : null}
          {(plan.stopLoss || plan.invalidation) ? (
            <div style={{ padding: '6px 8px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>Stop</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#EF4444', fontFamily: 'monospace' }}>{fmtLvl(plan.stopLoss || plan.invalidation)}</div>
            </div>
          ) : null}
          {plan.target1 ? (
            <div style={{ padding: '6px 8px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>Target</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#34D399', fontFamily: 'monospace' }}>{fmtLvl(plan.target1)}</div>
            </div>
          ) : null}
        </div>
      )}
      {riskReward != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase' }}>R/R</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: riskRewardColor(riskReward), fontFamily: 'monospace' }}>{riskReward}</span>
          <ScoreBar score={Math.min(riskReward * 20, 100)} max={100} color={riskRewardColor(riskReward)} height={4} />
        </div>
      )}
      {whyNow.length > 0 && (
        <div style={{ fontSize: 9, color: colors.accent.amber, lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>WHY NOW</span>
          <div style={{ marginTop: 2, color: colors.text.secondary }}>
            {whyNow.map((f, i) => (<div key={i} style={{ marginBottom: 2 }}><span style={{ color: colors.accent.amber }}>•</span> {f.factor}: {f.explanation}</div>))}
          </div>
        </div>
      )}
      {strongest.length > 0 && (
        <div style={{ fontSize: 9, color: colors.text.secondary, lineHeight: 1.5 }}>
          <span style={{ color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Evidence</span>
          <div style={{ marginTop: 2 }}>
            {strongest.slice(0, 2).map((ev, i) => (
              <div key={i} style={{ marginBottom: 1 }}>
                <span style={{ color: '#34D399' }}>+</span> {typeof ev === 'string' ? ev : (ev.factor || ev.signal || ev.label || 'Evidence')}
              </div>
            ))}
          </div>
        </div>
      )}
      {warning && (
        <div style={{ fontSize: 9, color: '#FBBF24', lineHeight: 1.4, padding: '4px 8px', backgroundColor: '#1A1500', borderRadius: radius.sm }}>
          <span style={{ fontWeight: 700 }}>⚠</span> {warning}
        </div>
      )}
    </div>
  );
}

function TopHunts({ opportunities, plansBySymbol, explanationsBySymbol, selectedSymbol, onSelectSymbol, loading }) {
  if (loading) {
    return (
      <div style={{ ...panel, padding: 24, textAlign: 'center', marginBottom: 12 }}>
        <LoadingState message="Loading opportunities..." />
      </div>
    );
  }
  if (!opportunities?.length) {
    return (
      <div style={{ ...panel, padding: 24, textAlign: 'center', marginBottom: 12 }}>
        <EmptyState icon="🎯" message="No opportunities available" sub="Top hunts will appear here" />
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <ZoneLabel label="TOP HUNTS" icon="🔥" />
        <span style={{ fontSize: 9, color: colors.text.faint }}>{opportunities.length} opportunities</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
        {opportunities.slice(0, 12).map((item) => (
          <HuntCard
            key={item.symbol}
            item={item}
            plan={plansBySymbol?.[item.symbol]}
            explanation={explanationsBySymbol?.[item.symbol]}
            isSelected={selectedSymbol === item.symbol}
            onClick={() => onSelectSymbol(item.symbol)}
          />
        ))}
      </div>
    </div>
  );
}

const RADAR_TABS = [
  { key: 'ALL', label: 'ALL' },
  { key: 'PENNY', label: '💰 PENNY' },
  { key: 'EXPLOSION', label: '🧨 EXPLOSION' },
  { key: 'OPTIONS', label: '⚡ OPTIONS' },
  { key: 'INSTITUTIONAL', label: '🏦 INSTITUTIONAL' },
  { key: 'SWING', label: '📈 SWING' },
  { key: 'STRUCTURE', label: '🏔 STRUCTURE' },
  { key: 'SUPPLY_DEMAND', label: '🎯 S/D' },
];

function RadarHub({ opportunities, plansBySymbol, explanationsBySymbol, selectedSymbol, onSelectSymbol }) {
  const [activeTab, setActiveTab] = useState('ALL');
  const filtered = useMemo(() => {
    if (activeTab === 'ALL') return opportunities;
    return opportunities.filter((o) => {
      const da = o.dataAvailability || {};
      switch (activeTab) {
        case 'PENNY': return da.pennyIntelligence === true;
        case 'EXPLOSION': return da.earlyExplosion === true;
        case 'OPTIONS': return da.optionsIntelligence === true;
        case 'INSTITUTIONAL': return da.institutionalRadar === true;
        case 'SWING': return da.swingIntelligence === true;
        case 'STRUCTURE': {
          const ce = o.classicalEvidence || {};
          return ce.breaker?.detected || ce.fvg?.detected || ce.marketStructure?.mssDetected ||
            (o.flags || []).some(f => f.includes('BREAKER') || f.includes('FVG') || f.includes('MARKET_STRUCTURE'));
        }
        case 'SUPPLY_DEMAND': {
          const plan = plansBySymbol?.[o.symbol];
          return !!(plan?.entryZone || plan?.entryPrice || plan?.stopLoss || plan?.target1);
        }
        default: return true;
      }
    });
  }, [opportunities, activeTab, plansBySymbol]);

  return (
    <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <ZoneLabel label="RADAR HUB" icon="📡" color={colors.accent.violet} />
        <span style={{ fontSize: 9, color: colors.text.faint }}>{filtered.length} {activeTab === 'ALL' ? 'total' : 'matched'}</span>
      </div>
      <div style={{ marginBottom: 12 }}>
        <TabGroup tabs={RADAR_TABS} active={activeTab} onTabChange={setActiveTab} />
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <span style={{ color: colors.text.muted, fontSize: 11 }}>No data for this radar</span>
          <div style={{ color: colors.text.faint, fontSize: 9, marginTop: 4 }}>UNAVAILABLE</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
          {filtered.slice(0, 8).map((item) => {
            const plan = plansBySymbol?.[item.symbol];
            const explanation = explanationsBySymbol?.[item.symbol];
            const oppScore = item.opportunityScore ?? item.setupScore ?? null;
            const planScore = plan?.planScore ?? null;
            const planSignal = plan?.planSignal || null;
            const cls = classifyOpportunity(item.quality, planSignal);
            return (
              <div key={item.symbol} onClick={() => onSelectSymbol(item.symbol)} style={{
                padding: '10px 12px',
                backgroundColor: selectedSymbol === item.symbol ? '#0F1420' : '#07090E',
                border: `1px solid ${selectedSymbol === item.symbol ? colors.accent.blue + '55' : colors.border}`,
                borderRadius: radius.sm, cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: colors.text.primary }}>{item.symbol}</span>
                  <span style={{ fontSize: 11 }}>{cls.emoji}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: scoreColor(oppScore), fontFamily: 'monospace' }}>{oppScore ?? '—'}</span>
                  {planScore != null && <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(planScore), opacity: 0.8 }}>/{planScore}</span>}
                  <Tag value={item.quality} colorMap={Q_COLOR} size="sm" />
                  {planSignal && <Tag value={planSignal} colorMap={S_COLOR} size="sm" />}
                </div>
                {plan?.riskReward != null && (
                  <div style={{ fontSize: 10, color: riskRewardColor(plan.riskReward), fontWeight: 700 }}>R/R {plan.riskReward}</div>
                )}
                {explanation?.whyNow?.length > 0 && (
                  <div style={{ fontSize: 9, color: colors.accent.amber, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {explanation.whyNow[0].factor}: {explanation.whyNow[0].explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TradePlanBlock({ plan }) {
  if (!plan) {
    return (
      <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
        <ZoneLabel label="TRADE PLAN" icon="📐" />
        <div style={{ color: colors.text.muted, fontSize: 11 }}>No trade plan available</div>
      </div>
    );
  }
  const levels = [
    { label: 'ENTRY', value: plan.entryZone ?? plan.entryPrice, color: colors.text.primary },
    { label: 'STOP', value: plan.stopLoss ?? plan.invalidation, color: '#EF4444' },
    { label: 'T1', value: plan.target1, color: '#34D399' },
    { label: 'T2', value: plan.target2, color: '#22C55E' },
    { label: 'INV', value: plan.invalidation, color: '#F87171' },
    { label: 'R/R', value: plan.riskReward != null ? Number(plan.riskReward).toFixed(2) : null, color: riskRewardColor(plan.riskReward) },
  ];
  return (
    <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <ZoneLabel label="TRADE PLAN" icon="📐" />
        <Tag value={plan.planQuality} colorMap={Q_COLOR} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {levels.map(({ label, value, color }) => (
          <div key={label} style={{
            textAlign: 'center', padding: '10px 6px', backgroundColor: '#07090E',
            borderRadius: radius.sm, border: `1px solid ${colors.border}`,
          }}>
            <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color, fontFamily: 'monospace', lineHeight: 1.2 }}>
              {value != null ? fmtLvl(value) : '—'}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: `1px solid ${colors.border}` }}>
        {plan.planSignal && <Tag value={plan.planSignal} colorMap={S_COLOR} />}
        {plan.direction && <Tag value={plan.direction} colorMap={DIRECTION_COLOR} />}
        {(plan.risks || []).slice(0, 2).map((r, i) => (
          <SmallTag key={i} value={r.label} color={r.severity === 'HIGH' ? '#EF4444' : '#FBBF24'} />
        ))}
      </div>
    </div>
  );
}

function StructureBlock({ opportunity }) {
  if (!opportunity) return null;
  const ce = opportunity.classicalEvidence || {};
  const ms = ce.marketStructure || {};
  const flags = opportunity.flags || [];
  const hasBreaker = ce.breaker?.detected || flags.some(f => f.includes('BREAKER'));
  const hasFvg = ce.fvg?.detected || flags.some(f => f.includes('FVG'));
  const hasMss = ms.mssDetected || flags.some(f => f.includes('MARKET_STRUCTURE'));
  const hasSweep = ce.sweep?.detected || flags.some(f => f.includes('SWEEP') || f.includes('TURTLE'));
  const hasSupport = ce.support?.length > 0;
  const hasResistance = ce.resistance?.length > 0;
  if (!hasBreaker && !hasFvg && !hasMss && !hasSweep && !hasSupport && !hasResistance) {
    return (
      <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
        <ZoneLabel label="STRUCTURE" icon="🏔" />
        <div style={{ color: colors.text.muted, fontSize: 11 }}>No structure data available</div>
      </div>
    );
  }
  const sTrend = ms.trend || 'UNAVAILABLE';
  return (
    <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <ZoneLabel label="STRUCTURE" icon="🏔" color={colors.accent.violet} />
        {sTrend !== 'UNAVAILABLE' && <Tag value={sTrend} colorMap={{ BULLISH: '#34D399', BEARISH: '#EF4444', NEUTRAL: '#FBBF24', UNAVAILABLE: '#475569' }} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Breaker', active: hasBreaker },
          { label: 'FVG', active: hasFvg, extra: ce.fvg?.gaps?.length ? `${ce.fvg.gaps.length} gaps` : null },
          { label: 'Liquidity', active: hasSweep },
          { label: 'MSS', active: hasMss },
          { label: 'HH / HL', active: ms.higherHighs && ms.higherLows },
          { label: 'LH / LL', active: ms.lowerHighs && ms.lowerLows },
          { label: 'Support', active: hasSupport },
          { label: 'Resistance', active: hasResistance },
        ].map((item) => (
          <div key={item.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 10px', backgroundColor: '#07090E', borderRadius: radius.sm,
            border: `1px solid ${colors.border}`,
          }}>
            <span style={{ fontSize: 9, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: item.active ? '#34D399' : colors.text.disabled }}>
              {item.active ? (item.extra || 'DETECTED') : '—'}
            </span>
          </div>
        ))}
      </div>
      {(hasSupport || hasResistance) && (
        <div style={{ fontSize: 9, color: colors.text.faint, lineHeight: 1.6 }}>
          {hasSupport && <div>Support: {Array.isArray(ce.support) ? ce.support.map(s => fmtLvl(s)).join(', ') : '—'}</div>}
          {hasResistance && <div>Resistance: {Array.isArray(ce.resistance) ? ce.resistance.map(r => fmtLvl(r)).join(', ') : '—'}</div>}
        </div>
      )}
    </div>
  );
}

function EvidenceBlock({ explanation, opportunity }) {
  const positive = explanation?.positiveEvidence || opportunity?.evidence || [];
  const negative = explanation?.negativeEvidence || [];
  const sources = explanation?.supportingEvidence || [];
  const flags = opportunity?.flags || [];
  if (!positive.length && !negative.length && !sources.length && !flags.length) {
    return (
      <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
        <ZoneLabel label="EVIDENCE" icon="🔍" />
        <div style={{ color: colors.text.muted, fontSize: 11 }}>No evidence available</div>
      </div>
    );
  }
  return (
    <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
      <ZoneLabel label="EVIDENCE" icon="🔍" color={colors.accent.emerald} />
      {sources.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 8, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Sources</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sources.slice(0, 6).map((s, i) => {
              const found = typeof s.evidence === 'string' ? s.evidence : (Array.isArray(s.evidence) ? s.evidence.join(', ') : String(s.evidence || s));
              return (
                <span key={i} style={{ fontSize: 9, color: colors.text.secondary, backgroundColor: '#07090E', padding: '2px 8px', borderRadius: 4, border: `1px solid ${colors.border}` }}>
                  {s.source ? `${s.source}: ${found}` : found}
                </span>
              );
            })}
          </div>
        </div>
      )}
      {positive.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 8, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Strongest Evidence</div>
          {positive.slice(0, 4).map((ev, i) => (
            <div key={i} style={{ fontSize: 10, color: colors.semantic.long, lineHeight: 1.5, marginBottom: 2, paddingLeft: 10 }}>
              <span style={{ color: colors.semantic.long, fontWeight: 900 }}>+</span>{' '}
              {ev.factor || ev.signal || 'Evidence'}: {ev.explanation || ev.signal}
              {ev.evidence?.length > 0 && (<span style={{ color: colors.text.muted, fontSize: 8 }}> [{ev.evidence.slice(0, 3).join(', ')}]</span>)}
            </div>
          ))}
        </div>
      )}
      {negative.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 8, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Weakest Evidence</div>
          {negative.slice(0, 4).map((ev, i) => (
            <div key={i} style={{ fontSize: 10, color: colors.semantic.short, lineHeight: 1.5, marginBottom: 2, paddingLeft: 10 }}>
              <span style={{ color: colors.semantic.short, fontWeight: 900 }}>−</span>{' '}
              {ev.factor || ev.label || 'Weakness'}: {ev.explanation || ev.description || 'Noted'}
            </div>
          ))}
        </div>
      )}
      {positive.length === 0 && negative.length === 0 && flags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {flags.slice(0, 8).map((f, i) => (
            <span key={i} style={{ fontSize: 9, color: colors.text.secondary, backgroundColor: '#07090E', padding: '2px 8px', borderRadius: 4, border: `1px solid ${colors.border}` }}>
              {f.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DataConfidenceBlock({ opportunity, plan }) {
  const oppDa = opportunity?.dataAvailability || {};
  const planDa = plan?.dataAvailability || {};
  const sources = [
    { key: 'pennyIntelligence', label: 'B1 PENNY', opp: oppDa.pennyIntelligence, plan: planDa.pennyIntelligence },
    { key: 'optionsIntelligence', label: 'B2 OPTIONS', opp: oppDa.optionsIntelligence, plan: planDa.optionsIntelligence },
    { key: 'institutionalRadar', label: 'B3 INSTITUTIONAL', opp: oppDa.institutionalRadar, plan: planDa.institutionalRadar },
    { key: 'swingIntelligence', label: 'B4 SWING', opp: oppDa.swingIntelligence, plan: planDa.swingIntelligence },
    { key: 'earlyExplosion', label: 'B5 EXPLOSION', opp: oppDa.earlyExplosion, plan: planDa.earlyExplosion },
    { key: 'catalystIntelligence', label: 'B6 CATALYST', opp: oppDa.catalystIntelligence, plan: planDa.catalystIntelligence },
  ];
  const scoredCount = sources.filter(s => s.opp || s.plan).length;
  const hasPartial = scoredCount > 0 && scoredCount < sources.length;
  return (
    <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <ZoneLabel label="DATA CONFIDENCE" icon="📊" />
        <span style={{ fontSize: 10, fontWeight: 700, color: hasPartial ? '#FBBF24' : '#34D399' }}>{scoredCount}/{sources.length} SOURCES</span>
      </div>
      {hasPartial && (
        <div style={{ padding: '8px 12px', backgroundColor: '#1A1500', border: '1px solid #FBBF2440', borderRadius: radius.sm, marginBottom: 10, fontSize: 10, color: '#FBBF24', fontWeight: 700 }}>
          ⚠ PARTIAL INTELLIGENCE
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sources.map((s) => {
          const avail = s.opp || s.plan;
          return (
            <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', backgroundColor: avail ? '#0B1F15' : '#0B0F17', borderRadius: radius.sm, border: `1px solid ${avail ? '#14532D' : colors.border}` }}>
              <span style={{ fontSize: 9, color: colors.text.secondary, fontWeight: 700 }}>{s.label}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: avail ? '#34D399' : colors.text.disabled }}>{avail ? 'AVAILABLE' : 'UNAVAILABLE'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertCenterPanel({ alerts, highPriorityAlerts }) {
  const feed = highPriorityAlerts.length ? highPriorityAlerts : alerts.slice(0, 6);
  return (
    <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <ZoneLabel label="ALERT CENTER" icon="🔔" />
      </div>
      {feed.length === 0 ? (
        <div style={{ color: colors.text.muted, fontSize: 11 }}>No alerts</div>
      ) : (
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {feed.slice(0, 8).map((alert) => (
            <div key={alert.id} style={{
              padding: '8px 10px', marginBottom: 4, backgroundColor: '#07090E',
              borderRadius: radius.sm,
              borderLeft: `2px solid ${alert.priority >= 80 ? '#EF4444' : alert.priority >= 60 ? '#F59E0B' : colors.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: colors.text.primary }}>{alert.symbol}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 8, color: colors.text.faint }}>#{alert.priority}</span>
                  <StatusDot status={alert.status === 'READY' ? 'ready' : alert.status === 'TRIGGERED' ? 'triggered' : alert.status === 'SENT' ? 'sent' : alert.status === 'FAILED' ? 'failed' : 'disabled'} />
                </div>
              </div>
              <div style={{ fontSize: 9, color: colors.text.secondary, marginTop: 2 }}>{alert.type?.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OpportunityDetail({ symbol, opportunityData, tradePlanData, aiExplanationData }) {
  const opp = useMemo(() => {
    if (!opportunityData?.data) return null;
    return opportunityData.data.find(o => o.symbol === symbol) || null;
  }, [opportunityData, symbol]);

  const plan = useMemo(() => {
    if (!tradePlanData?.data) return null;
    return tradePlanData.data.find(t => t.symbol === symbol) || null;
  }, [tradePlanData, symbol]);

  const explanation = useMemo(() => {
    if (!aiExplanationData?.data) return null;
    return aiExplanationData.data.find(e => e.symbol === symbol) || null;
  }, [aiExplanationData, symbol]);

  if (!symbol) {
    return (
      <div style={{ ...panel, padding: 32, textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>🎯</div>
        <div style={{ color: colors.text.muted, fontSize: 12 }}>Select an opportunity</div>
        <div style={{ color: colors.text.faint, fontSize: 10, marginTop: 4 }}>Click a ticker from Top Hunts or Radar Hub</div>
      </div>
    );
  }

  const tradeStage = plan ? deriveTradeStage(plan.planSignal, plan.riskReward, plan.planScore, plan.planQuality) : deriveTradeStage(null, null, null, null);
  const oppScore = opp?.opportunityScore ?? opp?.setupScore ?? null;
  const planScore = plan?.planScore ?? null;
  const classification = classifyOpportunity(opp?.quality, plan?.planSignal);

  return (
    <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: colors.text.primary, fontFamily: 'monospace' }}>{symbol}</div>
            <span style={{ fontSize: 18 }} title={classification.label}>{classification.emoji}</span>
          </div>
          {opp?.price != null && (
            <div style={{ fontSize: 12, color: colors.text.muted, fontFamily: 'monospace' }}>
              ${Number(opp.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {plan?.direction && <Tag value={plan.direction} colorMap={D_COLOR} />}
            <Tag value={opp?.quality || 'UNAVAILABLE'} colorMap={Q_COLOR} />
            {plan?.planSignal && <Tag value={plan.planSignal} colorMap={S_COLOR} />}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: scoreColor(oppScore), fontFamily: 'monospace' }}>{oppScore ?? '—'}</div>
            <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>C7</div>
          </div>
          {planScore != null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: scoreColor(planScore), fontFamily: 'monospace' }}>{planScore}</div>
              <div style={{ fontSize: 7, color: colors.text.faint, textTransform: 'uppercase', fontWeight: 700 }}>C8</div>
            </div>
          )}
          <Tag value={classification.label} colorMap={CLASS_COLOR} />
        </div>
      </div>

      <DecisionBanner decision={tradeStage.decision} reason={tradeStage.reason} stage={tradeStage.stage} />

      {plan && (
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <TradeLifecycleStepper stage={tradeStage.stage} decision={tradeStage.decision} />
        </div>
      )}

      {explanation?.headline && (
        <div style={{ fontSize: 11, color: colors.accent.gold, marginBottom: 12, padding: '8px 10px', backgroundColor: '#1A1500', borderRadius: radius.sm }}>
          {explanation.headline}
        </div>
      )}

      {whyNowSection(explanation, opp)}

      <EvidenceBlock explanation={explanation} opportunity={opp} />
      <StructureBlock opportunity={opp} />
      <TradePlanBlock plan={plan} />
      <DataConfidenceBlock opportunity={opp} plan={plan} />

      {opp?.risks?.length > 0 && (
        <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
          <ZoneLabel label="RISKS" icon="⚠" color="#EF4444" />
          {opp.risks.slice(0, 3).map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: '#EF4444', marginBottom: 2, paddingLeft: 10 }}>
              <span style={{ fontWeight: 700 }}>[{r.severity}]</span> {r.label}
            </div>
          ))}
        </div>
      )}

      {(plan?.warnings || opp?.warnings || explanation?.warnings) && (
        <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
          <ZoneLabel label="WARNINGS" icon="⚠" color="#FBBF24" />
          {([...(plan?.warnings || []), ...(opp?.warnings || []), ...(explanation?.warnings || [])]).map((w, i) => (
            <div key={i} style={{ fontSize: 10, color: '#FBBF24', lineHeight: 1.4, marginBottom: 2 }}>
              <span style={{ fontWeight: 700 }}>⚠</span> {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function whyNowSection(explanation, opp) {
  const whyNow = explanation?.whyNow || [];
  const fallback = opp?.reasons || [];
  if (!whyNow.length && !fallback.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <ZoneLabel label="WHY NOW" icon="⏱" color={colors.accent.amber} />
      {whyNow.slice(0, 3).map((f, i) => (
        <div key={i} style={{ fontSize: 10, color: colors.text.secondary, lineHeight: 1.6, marginBottom: 4, paddingLeft: 10 }}>
          <span style={{ color: colors.accent.amber }}>•</span> {f.factor}: {f.explanation}
          {f.evidence?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2, marginRight: 12 }}>
              {f.evidence.slice(0, 3).map((e, j) => (
                <span key={j} style={{ fontSize: 8, color: colors.text.muted, backgroundColor: '#07090E', padding: '1px 6px', borderRadius: 3 }}>{e}</span>
              ))}
            </div>
          )}
        </div>
      ))}
      {whyNow.length === 0 && fallback.length > 0 && (
        fallback.slice(0, 3).map((r, i) => (
          <div key={i} style={{ fontSize: 10, color: colors.text.secondary, lineHeight: 1.6, marginBottom: 4, paddingLeft: 10 }}>
            <span style={{ color: colors.accent.amber }}>•</span> {r}
          </div>
        ))
      )}
    </div>
  );
}

function WatchlistPanel({ opportunities, onSelectSymbol }) {
  if (!opportunities?.length) return null;
  return (
    <div style={{ ...panel, padding: 16, marginBottom: 12 }}>
      <ZoneLabel label="WATCHLIST" icon="👁" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {opportunities.slice(0, 8).map((item) => (
          <div
            key={item.symbol}
            onClick={() => onSelectSymbol(item.symbol)}
            style={{
              padding: '6px 12px', backgroundColor: '#07090E',
              border: `1px solid ${colors.border}`, borderRadius: radius.sm,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: colors.text.primary }}>{item.symbol}</span>
            <span style={{ fontSize: 10, color: scoreColor(item.opportunityScore ?? item.setupScore) }}>
              {item.opportunityScore ?? item.setupScore ?? '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CommandCenter() {
  const [commandCenterData, setCommandCenterData] = useState(null);
  const [opportunityData, setOpportunityData] = useState(null);
  const [tradePlanData, setTradePlanData] = useState(null);
  const [aiExplanationData, setAiExplanationData] = useState(null);
  const [alertCenterData, setAlertCenterData] = useState(null);
  const [notificationAlerts, setNotificationAlerts] = useState([]);
  const [notificationFilter, setNotificationFilter] = useState('all');
  const [notificationAlertsByStage, setNotificationAlertsByStage] = useState({});
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marketStatus, setMarketStatus] = useState({ open: false });
  const [indices, setIndices] = useState([]);

  const fetchAll = useCallback(async () => {
    const origin = window.location.origin;
    try {
      const [ccRes, oppRes, planRes, aiRes, alertRes] = await Promise.allSettled([
        fetch(`${origin}/api/command-center`, { cache: 'no-store' }),
        fetch(`${origin}/api/opportunity-ranking`, { cache: 'no-store' }),
        fetch(`${origin}/api/trade-plan`, { cache: 'no-store' }),
        fetch(`${origin}/api/ai-explanation`, { cache: 'no-store' }),
        fetch(`${origin}/api/alert-center`, { cache: 'no-store' }),
      ]);

      if (ccRes.status === 'fulfilled' && ccRes.value.ok) {
        const json = await ccRes.value.json();
        setCommandCenterData(json);
        setIndices(json.indices || []);
        setError('');
      }
      if (oppRes.status === 'fulfilled' && oppRes.value.ok) {
        setOpportunityData(await oppRes.value.json().catch(() => null));
      }
      if (planRes.status === 'fulfilled' && planRes.value.ok) {
        setTradePlanData(await planRes.value.json().catch(() => null));
      }
      if (aiRes.status === 'fulfilled' && aiRes.value.ok) {
        setAiExplanationData(await aiRes.value.json().catch(() => null));
      }
      if (alertRes.status === 'fulfilled' && alertRes.value.ok) {
        const alertData = await alertRes.value.json().catch(() => null);
        setAlertCenterData(alertData);
        if (alertData?.alerts) {
          setNotificationAlerts(
            alertData.alerts
              .filter(a => a.status && Object.values(NOTIFICATION_STATUSES).includes(a.status))
              .slice(0, 12)
          );
          const byStage = {};
          alertData.alerts.forEach(a => {
            if (a.lifecycleStage) { byStage[a.lifecycleStage] = a; }
          });
          setNotificationAlertsByStage(byStage);
        }
      }
    } catch (err) {
      setError(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNotificationStatusChange = useCallback((alert, newStatus) => {
    setNotificationAlerts(prev => prev.map(a => {
      if (a.id === alert.id) return { ...a, status: newStatus };
      return a;
    }));
  }, []);

  useEffect(() => {
    const updateMarketStatus = () => {
      const nyParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date());
      const part = (type) => nyParts.find(x => x.type === type)?.value;
      const weekday = part('weekday');
      const hour = Number(part('hour'));
      const minute = Number(part('minute'));
      const total = hour * 60 + minute;
      const weekdayOpen = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);
      const open = weekdayOpen && total >= 570 && total < 960;
      setMarketStatus({ open });
    };

    updateMarketStatus();
    const t = setInterval(updateMarketStatus, 60_000);
    fetchAll();
    const refresh = setInterval(fetchAll, 60_000);
    return () => { clearInterval(t); clearInterval(refresh); };
  }, [fetchAll]);

  const regimeData = commandCenterData?.regime ?? commandCenterData?.sections?.marketRegime;
  const regime = regimeData?.regime || regimeData?.regimeName || null;
  const regimeScore = regimeData?.regimeScore ?? commandCenterData?.regimeScore ?? commandCenterData?.sections?.marketRegime?.regimeScore ?? null;
  const regimeConfidence = regimeData?.confidenceLevel ?? commandCenterData?.confidenceLevel ?? commandCenterData?.sections?.marketRegime?.confidenceLevel ?? null;
  const lastUpdate = commandCenterData?.timestamp;
  const vix = commandCenterData?.vix ?? commandCenterData?.sections?.marketRegime?.vix;
  const marketWarning = commandCenterData?.limitations || commandCenterData?.sections?.marketRegime?.limitations;

  const topOpportunities = (opportunityData?.top || opportunityData?.data || []).slice(0, 15);
  const plansBySymbol = useMemo(() => {
    const map = {};
    (tradePlanData?.data || []).forEach(p => { if (p?.symbol) map[p.symbol] = p; });
    return map;
  }, [tradePlanData]);
  const explanationsBySymbol = useMemo(() => {
    const map = {};
    (aiExplanationData?.data || []).forEach(e => { if (e?.symbol) map[e.symbol] = e; });
    return map;
  }, [aiExplanationData]);
  const alerts = alertCenterData?.alerts || [];
  const highPriorityAlerts = alerts.filter(a => (a.priority || 0) >= 50);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.bg,
      color: colors.text.primary,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '16px 20px' }}>
        <div style={{
          ...panel, padding: '10px 16px', marginBottom: 12, fontSize: 10, color: colors.text.faint,
        }}>
          <span style={{ color: colors.accent.blue }}>HUNTER AI</span> Command Center
          <span style={{ margin: '0 8px', color: colors.border }}>|</span>
          C7+C8+C9+C10 Intelligence
          <span style={{ margin: '0 8px', color: colors.border }}>|</span>
          <Link href="/analytics" style={{ color: colors.accent.blue, textDecoration: 'none' }}>Analytics</Link>
          <span style={{ margin: '0 8px', color: colors.border }}>|</span>
          <Link href="/alert-center" style={{ color: colors.accent.blue, textDecoration: 'none' }}>Alerts</Link>
        </div>

        {error && <ErrorState message={error} onRetry={fetchAll} />}

        <MarketHeader
          indices={indices}
          regime={regime}
          regimeScore={regimeScore}
          confidenceLevel={regimeConfidence}
          vix={vix}
          marketStatus={marketStatus}
          lastUpdate={lastUpdate}
          warning={marketWarning}
        />

        <TopHunts
          opportunities={topOpportunities}
          plansBySymbol={plansBySymbol}
          explanationsBySymbol={explanationsBySymbol}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={setSelectedSymbol}
          loading={loading}
        />

        <OpportunityDetail
          symbol={selectedSymbol}
          opportunityData={opportunityData}
          tradePlanData={tradePlanData}
          aiExplanationData={aiExplanationData}
          regime={regime}
          regimeScore={regimeScore}
          regimeConfidence={regimeConfidence}
        />

        <RadarHub
          opportunities={topOpportunities}
          plansBySymbol={plansBySymbol}
          explanationsBySymbol={explanationsBySymbol}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={setSelectedSymbol}
        />

        <div className="detail-columns">
          <div className="detail-main">
            <AlertCenterPanel alerts={alerts} highPriorityAlerts={highPriorityAlerts} />
            <NotificationAlertPanel
              alerts={notificationAlerts}
              loading={loading}
              onStatusChange={handleNotificationStatusChange}
              emptyMessage="No notification alerts"
            />
          </div>
          <div className="detail-side">
            <WatchlistPanel opportunities={topOpportunities} onSelectSymbol={setSelectedSymbol} />
          </div>
        </div>

        <div style={{ ...panel, padding: '12px 16px', textAlign: 'center', marginTop: 12 }}>
          <p style={{ color: colors.text.faint, fontSize: 9, margin: 0 }}>
            Last update: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString('en-US') : '—'}
          </p>
        </div>
      </div>

      <style>{`
        .detail-columns {
          display: grid;
          grid-template-columns: 1fr 240px;
          gap: 12;
          align-items: start;
        }
        @media (max-width: 768px) {
          .detail-columns {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
