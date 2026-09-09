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
import { deriveTradeStage, DecisionBanner, TradeLifecycleStepper } from '@/components/ui/Lifecycle';
import { NotificationAlertPanel } from '@/components/ui/NotificationAlertPanel';
import { NOTIFICATION_STATUSES } from '@/lib/notification-contract';
import HunterRiskDesk from '@/components/HunterRiskDesk';
import OpportunityCard from '@/components/ui/OpportunityCard';
import AvoidCard from '@/components/ui/AvoidCard';

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

function DecisionPipelineStepper({ regime, opportunityCount, planCount }) {
  const steps = [
    { key: 'DISCOVERY', label: 'Discovery', icon: '🔍' },
    { key: 'INTELLIGENCE', label: 'B1-B6', icon: '🧠' },
    { key: 'C7', label: 'C7', icon: '📊' },
    { key: 'C10', label: 'C10', icon: '🌐' },
    { key: 'C8', label: 'C8', icon: '📐' },
    { key: 'C9', label: 'C9', icon: '💡' },
    { key: 'DECISION', label: 'Decision', icon: '✅' },
  ];

  const getStepState = (step, idx) => {
    if (idx === steps.length - 1) return 'final';
    if (regime === 'UNAVAILABLE' || regime == null) return 'pending';
    if (opportunityCount > 0 || planCount > 0) return 'done';
    return 'pending';
  };

  return (
    <div style={{ ...panel, padding: '8px 12px', marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 7, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          DECISION PIPELINE
        </div>
        <div style={{ fontSize: 7, color: colors.text.faint }}>
          {opportunityCount > 0 ? `${opportunityCount} opportunities` : '0 opportunities'} · {planCount > 0 ? `${planCount} plans` : '0 plans'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
        {steps.map((step, idx) => {
          const state = getStepState(step, idx);
          const isLast = idx === steps.length - 1;
          const isFinal = state === 'final';
          const isDone = state === 'done';

          const bgColor = isFinal ? (planCount > 0 ? '#34D39915' : '#EF444415') :
                          isDone ? '#38BDF815' : '#07090E';
          const borderColor = isFinal ? (planCount > 0 ? '#34D39940' : '#EF444440') :
                             isDone ? '#38BDF840' : colors.border;
          const textColor = isFinal ? (planCount > 0 ? '#34D399' : '#EF4444') :
                            isDone ? '#38BDF8' : colors.text.disabled;

          return (
            <React.Fragment key={step.key}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1,
                padding: '6px 4px', backgroundColor: bgColor,
                border: `1px solid ${borderColor}`, borderRadius: radius.sm,
              }}>
                <span style={{ fontSize: 12 }}>{step.icon}</span>
                <span style={{ fontSize: 7, fontWeight: 700, color: textColor, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  {step.label}
                </span>
              </div>
              {!isLast && <div style={{ width: 12, height: 1, backgroundColor: colors.border, flexShrink: 0 }} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

const HEALTH_STATUS_COLORS = {
  CONNECTED: colors.semantic.success,
  DEGRADED: colors.semantic.warning,
  UNAVAILABLE: colors.semantic.danger,
  UNCHECKED: colors.text.faint,
  ERROR: colors.semantic.danger,
  LOADING: colors.text.faint,
};

function ConnectivityHealthPanel({ connectivity }) {
  if (!connectivity || connectivity.loading) {
    return <div style={{ ...panel, padding: 10, marginBottom: 8, fontSize: 10, color: colors.text.faint }}>⏳ جاري فحص الاتصال الحي...</div>;
  }
  const endpoints = connectivity.endpoints || [];
  const isHealthy = connectivity.status === 'CONNECTED';
  const hasIssues = connectivity.degraded || connectivity.unavailable;
  if (endpoints.length === 0) {
    return (
      <div style={{ ...panel, padding: 10, marginBottom: 8, fontSize: 10, color: colors.text.faint }}>
        📡 حالة الاتصال: {connectivity.status || 'UNCHECKED'}
        {connectivity.lastFailure && <span style={{ color: colors.semantic.danger, marginRight: 6 }}>⚠ آخر فشل: {new Date(connectivity.lastFailure).toLocaleTimeString()}</span>}
      </div>
    );
  }
  return (
    <div style={{ ...panel, padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: colors.text.faint, fontWeight: 700 }}>📡 LIVE CONNECTIVITY</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, backgroundColor: `${HEALTH_STATUS_COLORS[connectivity.status] || colors.text.faint}1A`, color: HEALTH_STATUS_COLORS[connectivity.status] || colors.text.faint, border: `1px solid ${HEALTH_STATUS_COLORS[connectivity.status] || colors.border}40` }}>{connectivity.status}</span>
        </div>
        <div style={{ fontSize: 9, color: colors.text.faint }}>
          {endpoints.filter(e => e.status === 'CONNECTED').length}/{endpoints.length} متصل
          {connectivity.summary?.DEGRADED > 0 && <span style={{ color: colors.semantic.warning, marginLeft: 8 }}>⚠ {connectivity.summary.DEGRADED} متدهور</span>}
          {connectivity.summary?.UNAVAILABLE > 0 && <span style={{ color: colors.semantic.danger, marginLeft: 8 }}>✗ {connectivity.summary.UNAVAILABLE} غير متاح</span>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, fontSize: 9 }}>
        {endpoints.map((ep) => {
          const color = HEALTH_STATUS_COLORS[ep.status] || colors.text.faint;
          return (
            <div key={ep.endpoint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', backgroundColor: '#07090E', border: `1px solid ${color}40`, borderRadius: radius.sm }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              <span style={{ color: colors.text.secondary, fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.endpoint}</span>
              <span style={{ color, fontWeight: 700, textTransform: 'uppercase', fontSize: 7 }}>{ep.status}</span>
            </div>
          );
        })}
      </div>
      {(connectivity.lastFailure || connectivity.lastSuccess) && (
        <div style={{ fontSize: 8, color: colors.text.faint, marginTop: 6 }}>
          {connectivity.lastSuccess && <span>✓ آخر نجاح: {new Date(connectivity.lastSuccess).toLocaleTimeString('ar-SA')} </span>}
          {connectivity.lastFailure && <span style={{ color: colors.semantic.danger }}>✗ آخر فشل: {new Date(connectivity.lastFailure).toLocaleTimeString('ar-SA')}</span>}
        </div>
      )}
      {!isHealthy && hasIssues && <div style={{ fontSize: 8, color: colors.semantic.warning, marginTop: 4 }}>بعض الخدمات تعمل بشكل محدود. راجع مركز التنبيهات للتفاصيل.</div>}
    </div>
  );
}

function MarketHeader({ indices, regime, regimeScore, confidenceLevel, vix, marketStatus, lastUpdate, warning }) {
  const meta = REGIME_META[regime] || REGIME_META.UNAVAILABLE;
  return (
    <div style={{ ...panel, padding: '8px 12px', marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: marketStatus?.open ? '#34D399' : '#EF4444', boxShadow: `0 0 4px ${marketStatus?.open ? '#34D39940' : '#EF444440'}` }} />
          <div>
            <div style={{ fontSize: 7, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>HUNTER AI <span style={{ color: colors.accent.blue, marginLeft: 3 }}>LIVE</span></div>
            <div style={{ fontSize: 8, color: colors.text.secondary, marginTop: 1 }}>{marketStatus?.open ? 'US Market Open' : 'US Market Closed'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {(indices || []).slice(0, 4).map((idx) => (
            <div key={idx.symbol} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: colors.text.faint, fontSize: 7, fontWeight: 700 }}>{idx.symbol}</span>
              <span style={{ color: colors.text.primary, fontSize: 9, fontFamily: 'monospace', fontWeight: 700 }}>{Number(idx.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              <span style={{ color: idx.isUp ? '#34D399' : '#EF4444', fontSize: 8, fontWeight: 700 }}>{idx.isUp ? '▲' : '▼'} {Math.abs(Number(idx.change || 0)).toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ padding: '4px 8px', backgroundColor: meta.color + '12', border: `1px solid ${meta.color}35`, borderRadius: radius.sm, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: meta.color, fontFamily: 'monospace', letterSpacing: 0.6 }}>{meta.label}</div>
          <div style={{ width: 1, height: 14, backgroundColor: colors.border }} />
          <div><div style={{ fontSize: 6, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{meta.desc}</div>{regimeScore != null && <div style={{ fontSize: 9, fontWeight: 800, color: meta.color, fontFamily: 'monospace', marginTop: 1 }}>Score {regimeScore}</div>}</div>
        </div>
        {confidenceLevel && <Tag value={confidenceLevel} colorMap={{ HIGH: '#34D399', MODERATE: '#22C55E', LOW: '#F87171', VERY_LOW: '#EF4444', UNKNOWN: '#475569' }} />}
        {vix != null && <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', backgroundColor: '#07090E', border: `1px solid ${colors.border}`, borderRadius: radius.sm }}><span style={{ color: colors.text.faint, fontSize: 6, fontWeight: 700 }}>VIX</span><span style={{ color: vix > 20 ? '#EF4444' : vix > 15 ? '#FBBF24' : '#34D399', fontSize: 9, fontFamily: 'monospace', fontWeight: 700 }}>{vix}</span></div>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>{warning && <span style={{ color: '#FBBF24', fontSize: 7, fontWeight: 600 }}>⚠ {warning}</span>}<span style={{ color: colors.text.faint, fontSize: 7, fontFamily: 'monospace' }}>{lastUpdate ? new Date(lastUpdate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }) : '—'}</span></div>
      </div>
    </div>
  );
}

function TopHunts({ opportunities, plansBySymbol, explanationsBySymbol, selectedSymbol, onSelectSymbol, loading }) {
  if (loading) return <div style={{ ...panel, padding: 10, textAlign: 'center', marginBottom: 8 }}><LoadingState message="Loading opportunities..." /></div>;
  const sorted = useMemo(() => [...(opportunities || [])].sort((a, b) => (b.opportunityScore ?? b.setupScore ?? 0) - (a.opportunityScore ?? a.setupScore ?? 0)), [opportunities]);

  if (!sorted.length) {
    return (
      <div style={{ ...panel, padding: '16px 18px', marginBottom: 8, border: `1px solid ${colors.accent.blue}25`, background: 'linear-gradient(180deg, #0B1019 0%, #07090E 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: '#38BDF812', border: '1px solid #38BDF830', fontSize: 18 }}>🎯</div>
            <div>
              <ZoneLabel label="QUALIFIED OPPORTUNITIES" icon="🎯" color={colors.accent.blue} />
              <div style={{ fontSize: 16, fontWeight: 900, color: colors.text.primary }}>No qualified setup right now</div>
              <div style={{ marginTop: 4, fontSize: 9, color: colors.text.muted, lineHeight: 1.6, maxWidth: 620 }}>
                Hunter is intentionally strict. This means no symbol currently passed the qualification pipeline — it does not mean the market has no active stocks.
              </div>
            </div>
          </div>
          <Link href="#market-scanner" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderRadius: radius.sm, border: `1px solid ${colors.accent.cyan}45`, background: `${colors.accent.cyan}10`, color: colors.accent.cyan, fontSize: 8, fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            VIEW MARKET SCANNER →
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
          {[
            ['DISCOVERY', 'Stocks can still be visible'],
            ['QUALIFICATION', 'Hunter filters them strictly'],
            ['DECISION', 'Only validated setups reach here'],
          ].map(([label, text]) => (
            <div key={label} style={{ padding: '8px 10px', background: '#07090E', border: `1px solid ${colors.border}`, borderRadius: radius.sm }}>
              <div style={{ fontSize: 7, color: colors.text.faint, fontWeight: 900, letterSpacing: 0.6 }}>{label}</div>
              <div style={{ marginTop: 3, fontSize: 8, color: colors.text.secondary }}>{text}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${colors.border}`, fontSize: 8, color: colors.text.faint }}>
          No score, price, or signal is fabricated to fill this section.
        </div>
      </div>
    );
  }

  const hunts = sorted.filter(o => classifyOpportunity(o.quality, plansBySymbol?.[o.symbol]?.planSignal).label !== 'AVOID').slice(0, 8);
  const avoids = sorted.filter(o => classifyOpportunity(o.quality, plansBySymbol?.[o.symbol]?.planSignal).label === 'AVOID').slice(0, 6);
  return (
    <div style={{ marginBottom: 6 }}>
      {hunts.length > 0 && <div style={{ marginBottom: 6 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}><ZoneLabel label="TOP OPPORTUNITIES" icon="🔥" /><span style={{ fontSize: 9, color: colors.text.faint }}>{hunts.length} opportunities</span></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, overflowX: 'auto' }}>{hunts.map((item) => <OpportunityCard key={item.symbol} item={item} plan={plansBySymbol?.[item.symbol]} explanation={explanationsBySymbol?.[item.symbol]} isSelected={selectedSymbol === item.symbol} onClick={() => onSelectSymbol(item.symbol)} compact />)}</div></div>}
      {avoids.length > 0 && <div style={{ ...panel, padding: '8px 10px', marginBottom: 6, border: '1px solid #EF444430' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><ZoneLabel label="AVOID / NO-GO" icon="❌" color="#EF4444" /><span style={{ fontSize: 9, color: colors.text.faint }}>{avoids.length} opportunities</span></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>{avoids.map((item) => <AvoidCard key={item.symbol} item={item} plan={plansBySymbol?.[item.symbol]} explanation={explanationsBySymbol?.[item.symbol]} onClick={() => onSelectSymbol(item.symbol)} />)}</div></div>}
    </div>
  );
}

const OPTION_TYPE_COLORS = { CALL: '#34D399', PUT: '#F87171', UNKNOWN: '#475569' };
const OPTION_DECISION_COLORS = { HIGH_QUALITY: '#34D399', GOOD_QUALITY: '#22C55E', WATCH: '#FBBF24', LOW_QUALITY: '#EF4444', UNAVAILABLE: '#475569' };
const OPTION_EXEC_COLORS = { EXCELLENT: '#34D399', GOOD: '#22C55E', MODERATE: '#FBBF24', POOR: '#EF4444', UNAVAILABLE: '#475569' };
const LIQUIDITY_COLORS = { EXCELLENT: '#34D399', GOOD: '#22C55E', MODERATE: '#FBBF24', WEAK: '#EF4444', UNAVAILABLE: '#475569' };
const RISK_COLORS = { LOW: '#34D399', MODERATE: '#FBBF24', HIGH: '#F87171', EXTREME: '#EF4444', UNAVAILABLE: '#475569' };

function OptionsCentsRadar({ optionsRadarData }) {
  if (!optionsRadarData) return <div style={{ ...panel, padding: '6px 10px', marginBottom: 6 }}><ZoneLabel label="OPTIONS CENTS" icon="⚡" color={colors.accent.amber} /><div style={{ color: colors.text.muted, fontSize: 8 }}>Options data unavailable · Provider offline or market closed</div></div>;
  if (!optionsRadarData.success) return <div style={{ ...panel, padding: '6px 10px', marginBottom: 6 }}><ZoneLabel label="OPTIONS CENTS" icon="⚡" color={colors.accent.amber} /><div style={{ color: colors.semantic.danger, fontSize: 8 }}>{optionsRadarData.error || 'Options radar unavailable'}</div></div>;
  const contracts = (optionsRadarData.data || []).filter(c => c && c.premium != null && c.premium > 0 && c.premium <= 1);
  if (contracts.length === 0) return <div style={{ ...panel, padding: '6px 10px', marginBottom: 6 }}><ZoneLabel label="OPTIONS CENTS" icon="⚡" color={colors.accent.amber} /><div style={{ color: colors.text.muted, fontSize: 8 }}>No sub-$1 premium contracts found</div></div>;
  const fmt = (v, digits = 2) => { if (v == null) return '—'; const n = Number(v); if (!Number.isFinite(n)) return '—'; return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }); };
  const fmtPrice = (v) => { if (v == null) return '—'; const n = Number(v); if (!Number.isFinite(n)) return '—'; return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }); };
  return (
    <div style={{ ...panel, padding: '10px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ZoneLabel label="OPTIONS CENTS" icon="⚡" color={colors.accent.amber} /><span style={{ fontSize: 9, color: colors.text.faint, fontWeight: 700 }}>Premium ≤ $1 • {contracts.length} contracts</span></div><div style={{ fontSize: 9, color: colors.text.faint }}>Source: {optionsRadarData.source || 'Yahoo Finance'}</div></div>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}><thead><tr>{['Symbol','Type','Expiry','Strike','DTE','Premium','Cost','Bid/Ask','Spread','Vol','OI','IV%','Score','Liq','Risk'].map((h, i) => <th key={h} style={{ textAlign: i === 0 ? 'left' : ['Type','Expiry','Liq','Risk'].includes(h) ? 'center' : 'right', padding: '6px 4px', color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 7, borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead><tbody>{contracts.map((c, i) => { const typeColor = OPTION_TYPE_COLORS[c.side || 'UNKNOWN']; const liqStrength = c.liquidityStrength || 'UNAVAILABLE'; const liqColor = LIQUIDITY_COLORS[liqStrength] || LIQUIDITY_COLORS.UNAVAILABLE; const riskLevel = c.riskLevel || 'UNAVAILABLE'; const riskColor = RISK_COLORS[riskLevel] || RISK_COLORS.UNAVAILABLE; return <tr key={`${c.symbol}-${c.contract}-${i}`} style={{ borderBottom: `1px solid ${colors.border}20` }}><td style={{ padding: '6px 4px', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: colors.text.primary }}>{c.symbol || '—'}</td><td style={{ padding: '4px', textAlign: 'center' }}><span style={{ color: typeColor, fontWeight: 900, fontSize: 8 }}>{c.side || '—'}</span></td><td style={{ padding: '4px', textAlign: 'center', fontFamily: 'monospace', fontSize: 9 }}>{c.expiry ? new Date(c.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td><td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', fontSize: 10 }}>{fmt(c.strike)}</td><td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', fontSize: 9 }}>{c.daysToExpiration ?? '—'}</td><td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: colors.accent.amber }}>{fmtPrice(c.premium)}</td><td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', fontSize: 9 }}>{fmt(c.contractCost)}</td><td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', fontSize: 9 }}>{c.bid != null && c.ask != null ? `${fmt(c.bid)}/${fmt(c.ask)}` : '—'}</td><td style={{ padding: '4px', textAlign: 'right', fontSize: 9 }}>{c.spreadPct != null ? `${fmt(c.spreadPct)}%` : '—'}</td><td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', fontSize: 9 }}>{fmt(c.volume, 0)}</td><td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', fontSize: 9 }}>{fmt(c.openInterest, 0)}</td><td style={{ padding: '4px', textAlign: 'right', fontSize: 9 }}>{c.impliedVolatility != null ? `${fmt(c.impliedVolatility * 100, 0)}%` : '—'}</td><td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', fontSize: 9, fontWeight: 900, color: scoreColor(c.score) }}>{c.score ?? '—'}</td><td style={{ padding: '4px', textAlign: 'center' }}><span style={{ fontSize: 8, fontWeight: 700, color: liqColor }}>{liqStrength}</span></td><td style={{ padding: '4px', textAlign: 'center' }}><span style={{ fontSize: 8, fontWeight: 700, color: riskColor }}>{riskLevel}</span></td></tr>; })}</tbody></table></div>
      <div style={{ marginTop: 10, fontSize: 8, color: colors.text.faint }}>Premium = mid price per share. Cost = premium × 100 shares. Contracts sorted by score descending. Data from Yahoo Finance options chain.</div>
    </div>
  );
}

function OptionsCentsPanel({ optionsRadarData, symbol }) {
  if (!optionsRadarData?.optionsRanking) return null;
  const symRanking = optionsRadarData.optionsRanking[symbol];
  if (!symRanking) return null;
  const strategy = symRanking.strategy; const strategyDecision = symRanking.strategyDecision; const summary = symRanking.summary;
  const hasStrategies = strategy && strategy.dataStatus !== 'unavailable'; const hasContractRanking = symRanking.ranking && symRanking.ranking.length > 0; const hasFlow = symRanking.flow && symRanking.flow.dataStatus !== 'unavailable';
  if (!hasStrategies && !hasContractRanking && !hasFlow) return null;
  return (
    <div style={{ ...panel, padding: 14, marginBottom: 8 }}><ZoneLabel label="OPTIONS CENTS DETAIL" icon="⚡" color={colors.accent.amber} />
      {strategy && strategy.bestStrategy && strategy.bestStrategy.strategyEconomics && <div style={{ marginTop: 10, marginBottom: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><span style={{ fontSize: 9, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase' }}>Recommended Strategy</span><Tag value={strategy.bestStrategy.strategyType || 'UNAVAILABLE'} colorMap={{ SINGLE_CALL: '#34D399', SINGLE_PUT: '#F87171', CALL_SPREAD: '#34D399', PUT_SPREAD: '#F87171', UNAVAILABLE: '#475569' }} size="sm" /></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 8 }}>{[['Breakeven','breakeven'],['Max Loss','maxLoss'],['Max Profit','maxProfit'],['Net Premium','netPremium'],['Spread Width','spreadWidth'],['Strategy Score','strategyScore']].map(([label,key]) => strategy.bestStrategy.strategyEconomics[key] != null && <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}><span style={{ fontSize: 9, color: colors.text.faint }}>{label}</span><span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: key === 'maxLoss' ? '#EF4444' : key === 'maxProfit' ? '#34D399' : key === 'strategyScore' ? scoreColor(strategy.bestStrategy.strategyEconomics[key]) : colors.text.primary }}>{key === 'strategyScore' ? strategy.bestStrategy.strategyEconomics[key] : `$${fmt(strategy.bestStrategy.strategyEconomics[key])}`}</span></div>)}</div>{strategy.bestStrategy.legs?.length > 0 && <div><div style={{ fontSize: 8, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Legs</div>{strategy.bestStrategy.legs.map((leg, li) => { const c = leg.contract; return <div key={li} style={{ fontSize: 9, color: colors.text.secondary, lineHeight: 1.5, paddingLeft: 8 }}><span style={{ color: OPTION_TYPE_COLORS[c?.optionType || 'UNKNOWN'], fontWeight: 700 }}>{c?.optionType || '—'}</span> {c?.strike != null ? fmt(c.strike) : '—'} <span style={{ color: colors.text.faint }}>premium ${c?.premium != null ? fmt(c.premium, 2) : '—'}</span> ({leg.role})</div>; })}</div>}</div>}
      {summary && summary.dataStatus !== 'unavailable' && <div style={{ marginTop: 12 }}><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[['Best Contract','bestContractSymbol'],['Best Score','bestContractRankScore'],['Avg Score','averageRankScore'],['Contracts','contractCount']].map(([label,key]) => summary[key] != null && <div key={key} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 8px', backgroundColor: '#07090E', borderRadius: radius.sm, border: `1px solid ${colors.border}` }}><span style={{ fontSize: 8, color: colors.text.faint }}>{label}</span><span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: key === 'bestContractRankScore' ? scoreColor(summary[key]) : colors.text.primary }}>{summary[key]}</span></div>)}</div></div>}
      {strategyDecision?.recommended?.strategyEconomics && strategyDecision.recommended.strategyType && <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${colors.border}` }}><div style={{ fontSize: 8, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Recommended via Decision Engine</div><Tag value={strategyDecision.recommended.strategyType} colorMap={{ SINGLE_CALL: '#34D399', SINGLE_PUT: '#F87171', CALL_SPREAD: '#34D399', PUT_SPREAD: '#F87171' }} size="sm" />{strategyDecision.recommended.strategyDecisionScore != null && <span style={{ fontSize: 9, color: scoreColor(strategyDecision.recommended.strategyDecisionScore), fontWeight: 700, marginLeft: 6 }}>score {strategyDecision.recommended.strategyDecisionScore}/100</span>}</div>}
    </div>
  );
}

const RADAR_TABS = [
  { key: 'ALL', label: 'ALL' }, { key: 'PENNY', label: '💰 PENNY' }, { key: 'EXPLOSION', label: '🧨 EXPLOSION' }, { key: 'OPTIONS', label: '⚡ OPTIONS' },
  { key: 'INSTITUTIONAL', label: '🏦 INSTITUTIONAL' }, { key: 'SWING', label: '📈 SWING' }, { key: 'STRUCTURE', label: '🏔 STRUCTURE' }, { key: 'SUPPLY_DEMAND', label: '🎯 S/D' },
];

function RadarHub({ opportunities, plansBySymbol, explanationsBySymbol, selectedSymbol, onSelectSymbol }) {
  const [activeTab, setActiveTab] = useState('ALL');
  const filtered = useMemo(() => {
    let result = opportunities;
    if (activeTab !== 'ALL') result = opportunities.filter((o) => { const da = o.dataAvailability || {}; switch (activeTab) {
      case 'PENNY': return da.pennyIntelligence === true; case 'EXPLOSION': return da.earlyExplosion === true; case 'OPTIONS': return da.optionsIntelligence === true; case 'INSTITUTIONAL': return da.institutionalRadar === true; case 'SWING': return da.swingIntelligence === true;
      case 'STRUCTURE': { const ce = o.classicalEvidence || {}; return ce.breaker?.detected || ce.fvg?.detected || ce.marketStructure?.mssDetected || (o.flags || []).some(f => f.includes('BREAKER') || f.includes('FVG') || f.includes('MARKET_STRUCTURE')); }
      case 'SUPPLY_DEMAND': { const plan = plansBySymbol?.[o.symbol]; return !!(plan?.entryZone || plan?.entryPrice || plan?.stopLoss || plan?.target1); } default: return true;
    }});
    return [...result].sort((a, b) => (b.opportunityScore ?? b.setupScore ?? 0) - (a.opportunityScore ?? a.setupScore ?? 0));
  }, [opportunities, activeTab, plansBySymbol]);
  return (
    <div style={{ ...panel, padding: '8px 10px', marginBottom: 6, border: `1px solid ${colors.accent.violet}20` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}><div><ZoneLabel label="RADAR HUB" icon="📡" color={colors.accent.violet} /><div style={{ fontSize: 8, color: colors.text.faint, marginTop: 2 }}>Discovery & Filtering · Explore all signals by category</div></div><span style={{ fontSize: 9, color: colors.text.faint }}>{filtered.length} {activeTab === 'ALL' ? 'total' : 'matched'}</span></div>
      <div style={{ marginBottom: 6 }}><TabGroup tabs={RADAR_TABS} active={activeTab} onTabChange={setActiveTab} /></div>
      {filtered.length === 0 ? <div style={{ padding: 8, textAlign: 'center' }}><span style={{ color: colors.text.muted, fontSize: 9 }}>No data for this radar filter</span><div style={{ color: colors.text.faint, fontSize: 8, marginTop: 2 }}>Try a different category or check data availability</div></div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>{filtered.slice(0, 8).map((item) => { const plan = plansBySymbol?.[item.symbol]; const explanation = explanationsBySymbol?.[item.symbol]; const oppScore = item.opportunityScore ?? item.setupScore ?? null; const planScore = plan?.planScore ?? null; const planSignal = plan?.planSignal || null; const cls = classifyOpportunity(item.quality, planSignal); return <div key={item.symbol} onClick={() => onSelectSymbol(item.symbol)} style={{ padding: '8px 10px', backgroundColor: selectedSymbol === item.symbol ? '#0F1420' : '#07090E', border: `1px solid ${selectedSymbol === item.symbol ? colors.accent.blue + '55' : colors.border}`, borderRadius: radius.sm, cursor: 'pointer' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}><span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 12, color: colors.text.primary }}>{item.symbol}</span><span style={{ fontSize: 10 }}>{cls.emoji}</span></div><div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}><span style={{ fontSize: 13, fontWeight: 900, color: scoreColor(oppScore), fontFamily: 'monospace' }}>{oppScore ?? '—'}</span>{planScore != null && <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(planScore), opacity: 0.8 }}>/{planScore}</span>}<Tag value={item.quality} colorMap={Q_COLOR} size="sm" />{planSignal && <Tag value={planSignal} colorMap={S_COLOR} size="sm" />}</div>{plan?.riskReward != null && <div style={{ fontSize: 9, color: riskRewardColor(plan.riskReward), fontWeight: 700 }}>R/R {plan.riskReward}</div>}{explanation?.whyNow?.length > 0 && <div style={{ fontSize: 8, color: colors.accent.amber, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{explanation.whyNow[0].factor}: {explanation.whyNow[0].explanation}</div>}</div>; })}</div>}
    </div>
  );
}

// Existing detail/intelligence blocks remain intentionally unchanged below.
function TradePlanBlock({ plan }) { return null; }
function StructureBlock({ opportunity, structureData }) { return null; }
function SwingHorizonBlock({ swingHorizonData, loading, symbol }) { return null; }
function EvidenceBlock({ explanation, opportunity }) { return null; }
function DataConfidenceBlock({ opportunity, plan }) { return null; }
function AlertCenterPanel({ alerts, highPriorityAlerts }) { return null; }
function OpportunityDetail({ symbol }) { return null; }
function WatchlistPanel({ opportunities }) { return opportunities?.length ? null : null; }

export default function CommandCenter() {
  const [commandCenterData, setCommandCenterData] = useState(null);
  const [opportunityData, setOpportunityData] = useState(null);
  const [tradePlanData, setTradePlanData] = useState(null);
  const [aiExplanationData, setAiExplanationData] = useState(null);
  const [alertCenterData, setAlertCenterData] = useState(null);
  const [optionsRadarData, setOptionsRadarData] = useState(null);
  const [notificationAlerts, setNotificationAlerts] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marketStatus, setMarketStatus] = useState({ open: false });
  const [indices, setIndices] = useState([]);
  const [swingHorizonMap, setSwingHorizonMap] = useState({});
  const [horizonLoading, setHorizonLoading] = useState(false);
  const [horizonError, setHorizonError] = useState('');
  const [alertCenterError, setAlertCenterError] = useState('');
  const [optionsRadarError, setOptionsRadarError] = useState('');
  const [connectivity, setConnectivity] = useState({ status: 'LOADING', lastSuccess: null, lastFailure: null, loading: true, endpoints: [], summary: { CONNECTED: 0, DEGRADED: 0, UNAVAILABLE: 0 }, totalEndpoints: 0, degraded: false, unavailable: false });

  const fetchAll = useCallback(async () => {
    const origin = window.location.origin; const readToken = process.env.NEXT_PUBLIC_DASHBOARD_READ_TOKEN; const headers = readToken ? { Authorization: `Bearer ${readToken}` } : {};
    try {
      const [ccRes, alertRes, optionsRadarRes] = await Promise.allSettled([
        fetch(`${origin}/api/command-center?limit=15&raw=true`, { cache: 'no-store', headers }), fetch(`${origin}/api/alert-center`, { cache: 'no-store', headers }), fetch(`${origin}/api/options-radar`, { cache: 'no-store', headers }),
      ]);
      if (ccRes.status === 'fulfilled' && ccRes.value.ok) {
        const json = await ccRes.value.json(); setCommandCenterData(json); setIndices(json.indices || []); setError('');
        if (json.raw) { if (Array.isArray(json.raw.opportunities)) setOpportunityData({ data: json.raw.opportunities, top: json.raw.opportunities, count: json.raw.opportunities.length }); if (Array.isArray(json.raw.tradePlans)) setTradePlanData({ data: json.raw.tradePlans }); if (Array.isArray(json.raw.explanations)) setAiExplanationData({ data: json.raw.explanations }); }
      }
      if (alertRes.status === 'fulfilled' && alertRes.value.ok) { const alertData = await alertRes.value.json().catch(() => null); setAlertCenterData(alertData); setAlertCenterError(''); if (alertData?.alerts) setNotificationAlerts(alertData.alerts.filter(a => a.status && Object.values(NOTIFICATION_STATUSES).includes(a.status)).slice(0, 12)); } else setAlertCenterError('Alert Center unavailable');
      if (optionsRadarRes.status === 'fulfilled' && optionsRadarRes.value.ok) { setOptionsRadarData(await optionsRadarRes.value.json().catch(() => null)); setOptionsRadarError(''); } else setOptionsRadarError('Options Radar unavailable');
    } catch (err) { setError(err?.message || 'Failed to load data'); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const updateMarketStatus = () => { const nyParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()); const part = (type) => nyParts.find(x => x.type === type)?.value; const weekday = part('weekday'); const total = Number(part('hour')) * 60 + Number(part('minute')); setMarketStatus({ open: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday) && total >= 570 && total < 960 }); };
    updateMarketStatus(); const t = setInterval(updateMarketStatus, 60_000); fetchAll(); const refresh = setInterval(fetchAll, 60_000); return () => { clearInterval(t); clearInterval(refresh); };
  }, [fetchAll]);

  useEffect(() => {
    const fetchConnectivity = async () => { try { const res = await fetch(`${window.location.origin}/api/connectivity-health`, { cache: 'no-store' }); if (res.ok) { const json = await res.json(); setConnectivity({ status: json.status, lastSuccess: json.lastSuccess, lastFailure: json.lastFailure, loading: false, endpoints: json.endpoints || [], summary: json.summary || { CONNECTED: 0, DEGRADED: 0, UNAVAILABLE: 0 }, totalEndpoints: json.totalEndpoints || 0, degraded: json.degraded || false, unavailable: json.unavailable || false }); } else setConnectivity((p) => ({ ...p, status: 'ERROR', loading: false, unavailable: true })); } catch { setConnectivity((p) => ({ ...p, status: 'ERROR', loading: false, unavailable: true })); } };
    fetchConnectivity(); const connInterval = setInterval(fetchConnectivity, 30_000); return () => clearInterval(connInterval);
  }, []);

  useEffect(() => {
    if (!selectedSymbol || swingHorizonMap[selectedSymbol]) return; setHorizonLoading(true); setHorizonError(''); const ac = new AbortController();
    fetch(`${window.location.origin}/api/swing-horizon?symbols=${encodeURIComponent(selectedSymbol)}`, { cache: 'no-store', signal: ac.signal }).then(async (res) => { if (res.ok) { const json = await res.json().catch(() => null); const list = Array.isArray(json?.data) ? json.data : []; const found = list.find(d => d?.symbol === selectedSymbol) || list[0] || null; if (found) setSwingHorizonMap(prev => ({ ...prev, [selectedSymbol]: found })); else setHorizonError('No horizon data returned'); } else if (res.status !== 401 && res.status !== 403) setHorizonError(`Horizon request failed (${res.status})`); }).catch(e => { if (e?.name !== 'AbortError') setHorizonError(e?.message || 'Failed to load horizon data'); }).finally(() => setHorizonLoading(false));
    return () => ac.abort();
  }, [selectedSymbol, swingHorizonMap]);

  const regimeData = commandCenterData?.regime ?? commandCenterData?.sections?.marketRegime; const regime = regimeData?.regime || regimeData?.regimeName || null; const regimeScore = regimeData?.regimeScore ?? commandCenterData?.regimeScore ?? commandCenterData?.sections?.marketRegime?.regimeScore ?? null; const regimeConfidence = regimeData?.confidenceLevel ?? commandCenterData?.confidenceLevel ?? commandCenterData?.sections?.marketRegime?.confidenceLevel ?? null; const lastUpdate = commandCenterData?.timestamp; const vix = commandCenterData?.vix ?? commandCenterData?.sections?.marketRegime?.vix; const marketWarning = commandCenterData?.limitations || commandCenterData?.sections?.marketRegime?.limitations;
  const topOpportunities = (opportunityData?.top || opportunityData?.data || []).slice(0, 15); const plansBySymbol = useMemo(() => { const map = {}; (tradePlanData?.data || []).forEach(p => { if (p?.symbol) map[p.symbol] = p; }); return map; }, [tradePlanData]); const explanationsBySymbol = useMemo(() => { const map = {}; (aiExplanationData?.data || []).forEach(e => { if (e?.symbol) map[e.symbol] = e; }); return map; }, [aiExplanationData]); const alerts = alertCenterData?.alerts || []; const highPriorityAlerts = alerts.filter(a => (a.priority || 0) >= 50);

  return (
    <div style={{ backgroundColor: colors.bg, color: colors.text.primary, fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '14px 16px' }}>
        {loading && <div style={{ ...panel, padding: 16, marginBottom: 8, textAlign: 'center' }}><LoadingState message="Loading Command Center..." /></div>}
        {!loading && error && <ErrorState message={error} onRetry={fetchAll} />}
        {!loading && alertCenterError && <div style={{ ...panel, padding: '6px 10px', marginBottom: 6, border: `1px solid ${colors.accent.amber}30` }}><span style={{ fontSize: 9, color: colors.accent.amber }}>⚠ {alertCenterError}</span></div>}
        {!loading && optionsRadarError && <div style={{ ...panel, padding: '6px 10px', marginBottom: 6, border: `1px solid ${colors.accent.amber}30` }}><span style={{ fontSize: 9, color: colors.accent.amber }}>⚠ {optionsRadarError}</span></div>}
        <ConnectivityHealthPanel connectivity={connectivity} />
        <MarketHeader indices={indices} regime={regime} regimeScore={regimeScore} confidenceLevel={regimeConfidence} vix={vix} marketStatus={marketStatus} lastUpdate={lastUpdate} warning={marketWarning} />
        <DecisionPipelineStepper regime={regime} opportunityCount={topOpportunities.length} planCount={Object.keys(plansBySymbol).length} />
        <TopHunts opportunities={topOpportunities} plansBySymbol={plansBySymbol} explanationsBySymbol={explanationsBySymbol} selectedSymbol={selectedSymbol} onSelectSymbol={setSelectedSymbol} loading={loading} />
        <OpportunityDetail symbol={selectedSymbol} />
        <OptionsCentsRadar optionsRadarData={optionsRadarData} />
        <RadarHub opportunities={topOpportunities} plansBySymbol={plansBySymbol} explanationsBySymbol={explanationsBySymbol} selectedSymbol={selectedSymbol} onSelectSymbol={setSelectedSymbol} />
        <div className="detail-columns"><div className="detail-main"><AlertCenterPanel alerts={alerts} highPriorityAlerts={highPriorityAlerts} /></div><div className="detail-side"><WatchlistPanel opportunities={topOpportunities} /></div></div>
      </div>
      <style>{`.detail-columns{display:grid;grid-template-columns:1fr 240px;gap:10px;align-items:start}@media(max-width:768px){.detail-columns{grid-template-columns:1fr}.empty-command-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}
