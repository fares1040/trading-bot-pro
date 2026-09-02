'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { colors, radius, panelStyle, scoreColor, riskRewardColor, formatPrice } from '@/components/ui/DesignTokens';
import { Tag, SmallTag, Panel, SectionTitle, EmptyState, LoadingState, ErrorState, Button, StatusDot } from '@/components/ui/Primitives';
import { ALERT_STATUS, ALERT_LIFECYCLE_STAGES, deriveTradeStage, TRADE_LIFECYCLE, TradeLifecycleStepper, DecisionBanner, AlertLifecycleGrid } from '@/components/ui/Lifecycle';
import { NotificationAlertPanel, NotificationStatusFilter, NotificationLifecycleIndicator } from '@/components/ui/NotificationAlertPanel';
import { NOTIFICATION_STATUSES } from '@/lib/notification-contract';

const panel = { ...panelStyle };

const regimeColorMap = { BULLISH: '#34D399', NEUTRAL: '#FBBF24', RISK_OFF: '#F87171', BEARISH: '#EF4444', UNAVAILABLE: '#475569' };
const qualityColorMap = { TOP: '#34D399', STRONG: '#22C55E', WATCH: '#FBBF24', WEAK: '#F87171', UNAVAILABLE: '#475569' };
const confidenceColorMap = { HIGH: '#34D399', MODERATE: '#22C55E', LOW: '#F87171', VERY_LOW: '#EF4444', UNKNOWN: '#475569' };
const directionColorMap = { LONG: '#34D399', SHORT: '#F87171', NEUTRAL: '#FBBF24', UNAVAILABLE: '#475569' };

const stageColorMap = {
  PRE_ENTRY: '#38BDF8',
  CONFIRMATION: '#A78BFA',
  ENTRY: '#34D399',
  TARGET_1: '#22C55E',
  TARGET_2: '#16A34A',
  STOP: '#EF4444',
  INVALIDATION: '#F87171',
  EXIT: '#60A5FA',
};

const classificationColorMap = {
  STRONG: '#34D399',
  WATCH: '#FBBF24',
  WEAK: '#F87171',
  AVOID: '#EF4444',
};

function classifyOpportunity(quality, planSignal, riskReward) {
  if (planSignal === 'AVOID' || quality === 'UNAVAILABLE' || quality === 'WEAK') {
    if (quality === 'WEAK' && planSignal !== 'AVOID') {
      return { label: 'WEAK', emoji: '⚠️', color: classificationColorMap.WEAK };
    }
    return { label: 'AVOID', emoji: '❌', color: classificationColorMap.AVOID };
  }
  if (quality === 'TOP' || quality === 'STRONG') {
    return { label: 'STRONG', emoji: '🔥', color: classificationColorMap.STRONG };
  }
  if (quality === 'WATCH') {
    return { label: 'WATCH', emoji: '👀', color: classificationColorMap.WATCH };
  }
  return { label: 'AVOID', emoji: '❌', color: classificationColorMap.AVOID };
}

function ZoneHeader({ label, icon }) {
  return (
    <div style={{
      color: colors.text.faint,
      fontSize: 9,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      {icon && <span style={{ opacity: 0.6 }}>{icon}</span>}
      {label}
    </div>
  );
}

function MarketStatusBar({ indices, regime, regimeScore, regimeConfidence, marketStatus, vix, lastUpdate, warning }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ ...panel, padding: '12px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: marketStatus?.open ? '#34D399' : '#EF4444',
          }} />
          <span style={{ color: marketStatus?.open ? '#34D399' : '#EF4444', fontSize: 11, fontWeight: 700 }}>
            {marketStatus?.open ? 'US Market Open' : 'US Market Closed'}
          </span>
        </div>

        <div style={{ width: 1, height: 16, backgroundColor: colors.border }} />

        {indices.slice(0, 4).map((idx) => (
          <div key={idx.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: colors.text.faint, fontSize: 10, fontWeight: 700 }}>{idx.symbol}</span>
            <span style={{ color: colors.text.primary, fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>
              {Number(idx.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
            <span style={{ color: idx.isUp ? '#34D399' : '#EF4444', fontSize: 10, fontWeight: 700 }}>
              {idx.isUp ? '▲' : '▼'} {Math.abs(Number(idx.change || 0)).toFixed(2)}%
            </span>
          </div>
        ))}

        <div style={{ width: 1, height: 16, backgroundColor: colors.border }} />

        {regime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: colors.text.faint, fontSize: 10 }}>Regime</span>
            <span style={{ color: regimeColorMap[regime] || colors.text.disabled, fontSize: 11, fontWeight: 800 }}>
              {regime}
            </span>
            {regimeScore != null && (
              <SmallTag value={regimeScore} color={regimeColorMap[regime]} />
            )}
          </div>
        )}

        {vix != null && (
          <>
            <div style={{ width: 1, height: 16, backgroundColor: colors.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: colors.text.faint, fontSize: 10 }}>VIX</span>
              <span style={{ color: vix > 20 ? '#EF4444' : vix > 15 ? '#FBBF24' : '#34D399', fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>
                {vix}
              </span>
            </div>
          </>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {warning && (
            <span style={{ color: '#F87171', fontSize: 10, fontWeight: 600 }}>{warning}</span>
          )}
          <span style={{ color: colors.text.faint, fontSize: 10, fontFamily: 'monospace' }}>{time}</span>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .market-status-bar > div:nth-child(n+4) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

function OpportunityRow({ item, plan, isSelected, onClick }) {
  const oppScore = item.opportunityScore ?? item.setupScore ?? null;
  const planScore = plan?.planScore ?? null;
  const direction = plan?.direction || item.directionBias || item.direction || null;
  const riskReward = plan?.riskReward ?? item.riskReward ?? null;
  const planSignal = plan?.planSignal || null;
  const classification = classifyOpportunity(item.quality, planSignal, riskReward);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '70px 1fr 60px 55px 55px 60px 50px 40px',
        gap: 8,
        alignItems: 'center',
        padding: '10px 12px',
        borderBottom: `1px solid ${colors.border}`,
        cursor: 'pointer',
        backgroundColor: isSelected ? '#0F1420' : 'transparent',
        transition: 'background-color 0.1s',
      }}
    >
      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 12, color: colors.text.primary }}>
        {item.symbol || '—'}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: scoreColor(oppScore), fontFamily: 'monospace' }}>
          {oppScore ?? '—'}
        </span>
        {planScore != null && (
          <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(planScore), fontFamily: 'monospace', opacity: 0.8 }}>
            /{planScore}
          </span>
        )}
        <Tag value={item.quality} colorMap={qualityColorMap} size="sm" />
        <span style={{ fontSize: 13 }} title={classification.label}>{classification.emoji}</span>
      </div>

      <span style={{ fontSize: 10, color: colors.text.secondary }}>
        {item.price != null ? formatPrice(item.price) : '—'}
      </span>

      <div>
        {direction && <Tag value={direction} colorMap={directionColorMap} size="sm" />}
      </div>

      <span style={{ fontFamily: 'monospace', fontSize: 10, color: riskRewardColor(riskReward), fontWeight: 700 }}>
        {riskReward != null ? `${riskReward}` : '—'}
      </span>

      <span style={{ fontSize: 10, color: item.confidence != null ? confidenceColorMap[item.confidenceLevel || item.confidence] || colors.text.secondary : colors.text.disabled }}>
        {item.confidence ?? item.confidenceLevel ?? '—'}
      </span>

      <span style={{ fontSize: 9, color: colors.text.faint }}>
        {item.availableComponents ? `${item.availableComponents.length}/6` : '—'}
      </span>

      <span style={{ fontSize: 10, color: planSignal ? (planSignal === 'AVOID' ? '#EF4444' : planSignal === 'WATCH' ? '#FBBF24' : '#34D399') : colors.text.disabled }}>
        {planSignal || '—'}
      </span>
    </div>
  );
}

 function OpportunityRadar({ opportunities, plansBySymbol, selectedSymbol, onSelectSymbol, loading }) {
  const headerCols = ['Ticker', 'C7/C8 / Q', 'Price', 'Dir', 'R/R', 'Conf', 'Src', 'Plan'];

  return (
    <div style={{ ...panel, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ZoneHeader label="Opportunity Radar" icon="🎯" />
        <div style={{ display: 'flex', gap: 8, fontSize: 9, color: colors.text.faint }}>
          <span>🔥 STRONG • 👀 WATCH • ⚠️ WEAK • ❌ AVOID</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 600 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '70px 1fr 60px 55px 55px 60px 50px 40px',
            gap: 8,
            padding: '8px 12px',
            borderBottom: `1px solid ${colors.border}`,
          }}>
            {headerCols.map(col => (
              <span key={col} style={{ fontSize: 9, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase' }}>{col}</span>
            ))}
          </div>

           {loading ? (
             <div style={{ padding: 24, textAlign: 'center' }}>
               <span style={{ color: colors.text.muted, fontSize: 11 }}>Loading opportunities…</span>
             </div>
           ) : opportunities.length === 0 ? (
             <div style={{ padding: 24, textAlign: 'center' }}>
               <span style={{ color: colors.text.muted, fontSize: 11 }}>No opportunities available</span>
             </div>
           ) : (
             opportunities.map((item) => (
               <OpportunityRow
                 key={item.symbol}
                 item={item}
                 plan={plansBySymbol?.[item.symbol]}
                 isSelected={selectedSymbol === item.symbol}
                 onClick={() => onSelectSymbol(item.symbol)}
               />
             ))
           )}
        </div>
      </div>
    </div>
  );
}

function WhyNowPanel({ explanation, opportunity }) {
  const whyNow = explanation?.whyNow || [];
  const fallbackReasons = opportunity?.reasons || [];

  if (!whyNow.length && !fallbackReasons.length) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: colors.accent.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        Why Now
      </div>
      {whyNow.slice(0, 3).map((f, i) => (
        <div key={i} style={{ fontSize: 10, color: colors.text.secondary, lineHeight: 1.5, marginBottom: 3 }}>
          <span style={{ color: colors.accent.amber }}>•</span> {f.factor}: {f.explanation}
          {f.evidence?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3, marginRight: 12 }}>
              {f.evidence.slice(0, 3).map((e, j) => (
                <span key={j} style={{ fontSize: 8, color: colors.text.muted, backgroundColor: '#07090E', padding: '1px 6px', borderRadius: 3 }}>
                  {e}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      {whyNow.length === 0 && fallbackReasons.length > 0 && (
        fallbackReasons.slice(0, 3).map((r, i) => (
          <div key={i} style={{ fontSize: 10, color: colors.text.secondary, lineHeight: 1.5, marginBottom: 3 }}>
            <span style={{ color: colors.accent.amber }}>•</span> {r}
          </div>
        ))
      )}
    </div>
  );
}

function EvidencePanel({ opportunity, explanation }) {
  const positive = explanation?.positiveEvidence || opportunity?.evidence || [];
  const negative = explanation?.negativeEvidence || [];
  const sources = explanation?.supportingEvidence || [];
  const flags = opportunity?.flags || [];

  if (!positive.length && !negative.length && !sources.length && !flags.length) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        Evidence
      </div>
      {sources.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {sources.slice(0, 6).map((s, i) => {
            const found = typeof s.evidence === 'string' ? s.evidence : (Array.isArray(s.evidence) ? s.evidence.join(', ') : String(s.evidence || s));
            return (
              <span key={i} style={{ fontSize: 9, color: colors.text.secondary, backgroundColor: '#07090E', padding: '2px 8px', borderRadius: 4 }}>
                {s.source ? `${s.source}: ${found}` : found}
              </span>
            );
          })}
        </div>
      )}
      {positive.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 8, color: colors.text.faint, marginBottom: 3 }}>Strongest Evidence</div>
          {positive.slice(0, 3).map((ev, i) => (
            <div key={i} style={{ fontSize: 9, color: colors.semantic.long, lineHeight: 1.4, marginBottom: 2 }}>
              <span style={{ color: colors.semantic.long }}>•</span> {ev.factor || ev.signal || 'Evidence'}: {ev.explanation || ev.signal}
              {ev.evidence?.length > 0 && (
                <span style={{ color: colors.text.muted, fontSize: 8 }}> [{ev.evidence.slice(0, 2).join(', ')}]</span>
              )}
            </div>
          ))}
        </div>
      )}
      {negative.length > 0 && (
        <div>
          <div style={{ fontSize: 8, color: colors.text.faint, marginBottom: 3 }}>Weakest Evidence</div>
          {negative.slice(0, 3).map((ev, i) => (
            <div key={i} style={{ fontSize: 9, color: colors.semantic.short, lineHeight: 1.4, marginBottom: 2 }}>
              <span style={{ color: colors.semantic.short }}>•</span> {ev.factor || ev.label || 'Weakness'}: {ev.explanation || ev.description || 'Noted'}</div>
          ))}
        </div>
      )}
      {positive.length === 0 && negative.length === 0 && flags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {flags.slice(0, 5).map((f, i) => (
            <span key={i} style={{ fontSize: 9, color: colors.text.secondary, backgroundColor: '#07090E', padding: '2px 8px', borderRadius: 4 }}>
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function WarningsPanel({ opportunity, plan, explanation }) {
  const warnings = [
    ...(opportunity?.warnings || []),
    ...(plan?.warnings || []),
    ...(explanation?.warnings || []),
  ];

  if (!warnings.length) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        Warnings
      </div>
      {warnings.map((w, i) => (
        <div key={i} style={{ fontSize: 9, color: '#FBBF24', lineHeight: 1.4, marginBottom: 2, padding: '2px 0' }}>
          <span style={{ color: '#FBBF24' }}>⚠</span> {w}
        </div>
      ))}
    </div>
  );
}

function IntelligenceSources({ opportunity }) {
  const sources = [
    { key: 'penny', label: 'B1 Penny', available: opportunity?.dataAvailability?.pennyIntelligence },
    { key: 'options', label: 'B2 Options', available: opportunity?.dataAvailability?.optionsIntelligence },
    { key: 'institutional', label: 'B3 Inst', available: opportunity?.dataAvailability?.institutionalRadar },
    { key: 'swing', label: 'B4 Swing', available: opportunity?.dataAvailability?.swingIntelligence },
    { key: 'explosion', label: 'B5 Expl', available: opportunity?.dataAvailability?.earlyExplosion },
    { key: 'catalyst', label: 'B6 Cat', available: opportunity?.dataAvailability?.catalystIntelligence },
  ];

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        Intelligence
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {sources.map(s => (
          <div key={s.key} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 9,
            color: s.available ? '#34D399' : colors.text.disabled,
            backgroundColor: s.available ? '#0B1F15' : '#0B0F17',
            padding: '2px 8px',
            borderRadius: 4,
            border: `1px solid ${s.available ? '#14532D' : colors.border}`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: s.available ? '#34D399' : colors.text.disabled }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function TradePlanDisplay({ plan }) {
  if (!plan) {
    return (
      <div style={{ ...panel, padding: 24, textAlign: 'center' }}>
        <span style={{ color: colors.text.muted, fontSize: 11 }}>No trade plan available</span>
      </div>
    );
  }

  const entries = [
    { label: 'Entry', value: plan.entryZone ?? plan.entryPrice ?? '—', color: colors.text.primary },
    { label: 'Stop', value: plan.stopLoss ?? plan.invalidation ?? '—', color: '#EF4444' },
    { label: 'T1', value: plan.target1 ?? '—', color: '#34D399' },
    { label: 'T2', value: plan.target2 ?? '—', color: '#34D399' },
    { label: 'Inv', value: plan.invalidation ?? '—', color: '#F87171' },
    { label: 'R/R', value: plan.riskReward != null ? `${plan.riskReward}` : '—', color: riskRewardColor(plan.riskReward) },
  ];

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <ZoneHeader label="Trade Plan" icon="📐" />
        <Tag value={plan.planQuality} colorMap={qualityColorMap} size="sm" />
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(6, 1fr)', 
        gap: 8, 
        marginBottom: 12
      }}>
        {entries.map(({ label, value, color }) => (
          <div key={label} style={{ 
            textAlign: 'center', 
            padding: '10px 4px', 
            backgroundColor: '#07090E', 
            borderRadius: radius.sm,
            border: `1px solid ${colors.border}`
          }}>
            <div style={{ fontSize: 7.5, color: colors.text.faint, marginBottom: 3, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'monospace', lineHeight: 1.2 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ 
        display: 'flex', 
        gap: 8, 
        flexWrap: 'wrap', 
        marginTop: 12,
        paddingTop: 12,
        borderTop: `1px solid ${colors.border}`
      }}>
        {plan.planSignal && <Tag value={plan.planSignal} colorMap={{ STRONG_PLAN: '#34D399', VALID_PLAN: '#22C55E', WATCH: '#FBBF24', AVOID: '#F87171', UNAVAILABLE: '#475569' }} size="sm" />}
        {plan.direction && <Tag value={plan.direction} colorMap={directionColorMap} size="sm" />}
        {plan.risks?.slice(0, 2).map((r, i) => (
          <SmallTag key={i} value={r.label} color={r.severity === 'HIGH' ? '#EF4444' : '#FBBF24'} />
        ))}
      </div>
    </div>
  );
}

function OpportunityDetail({ symbol, opportunityData, tradePlanData, aiExplanationData, regime, regimeScore, regimeConfidence }) {
  const opp = useMemo(() => {
    if (!opportunityData?.data) return null;
    return opportunityData.data.find(o => o.symbol === symbol);
  }, [opportunityData, symbol]);

  const plan = useMemo(() => {
    if (!tradePlanData?.data) return null;
    return tradePlanData.data.find(t => t.symbol === symbol);
  }, [tradePlanData, symbol]);

  const explanation = useMemo(() => {
    if (!aiExplanationData?.data) return null;
    return aiExplanationData.data.find(e => e.symbol === symbol);
  }, [aiExplanationData, symbol]);

  if (!symbol) {
    return (
      <div style={{ ...panel, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>🎯</div>
        <div style={{ color: colors.text.muted, fontSize: 12 }}>Select an opportunity</div>
        <div style={{ color: colors.text.faint, fontSize: 10, marginTop: 4 }}>Click a ticker from the radar to view details</div>
      </div>
    );
  }

  const tradeStage = plan ? deriveTradeStage(plan.planSignal, plan.riskReward, plan.planScore, plan.planQuality) : deriveTradeStage(null, null, null, null);
  const oppScore = opp?.opportunityScore ?? opp?.setupScore ?? null;
  const planScore = plan?.planScore ?? opp?.componentScores?.opportunityScore ?? null;
  const classification = classifyOpportunity(opp?.quality, plan?.planSignal, plan?.riskReward ?? opp?.riskReward);

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: colors.text.primary, fontFamily: 'monospace' }}>
              {symbol}
            </div>
            <span style={{ fontSize: 16 }} title={classification.label}>{classification.emoji}</span>
          </div>
          {opp?.price != null && (
            <div style={{ fontSize: 11, color: colors.text.muted, marginTop: 2 }}>
              ${Number(opp.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
          )}
          {plan?.direction && (
            <div style={{ marginTop: 2 }}>
              <Tag value={plan.direction} colorMap={directionColorMap} size="sm" />
            </div>
          )}
          {regime && (
            <div style={{ marginTop: 4 }}>
              <Tag value={regime} colorMap={regimeColorMap} size="sm" />
              {regimeScore != null && (
                <span style={{ fontSize: 9, color: colors.text.faint, marginLeft: 4 }}>({regimeScore})</span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: scoreColor(oppScore), fontFamily: 'monospace' }}>
              {oppScore ?? '—'}
            </div>
            <div style={{ fontSize: 7, color: colors.text.faint }}>C7 Score</div>
          </div>
          {planScore != null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: scoreColor(planScore), fontFamily: 'monospace' }}>
                {planScore}
              </div>
              <div style={{ fontSize: 7, color: colors.text.faint }}>C8 Plan</div>
            </div>
          )}
          <Tag value={opp?.quality || 'UNAVAILABLE'} colorMap={qualityColorMap} />
          <Tag value={plan?.planSignal || '—'} colorMap={{ STRONG_PLAN: '#34D399', VALID_PLAN: '#22C55E', WATCH: '#FBBF24', AVOID: '#F87171', UNAVAILABLE: '#475569' }} size="sm" />
        </div>
      </div>

      <DecisionBanner decision={tradeStage.decision} reason={tradeStage.reason} stage={tradeStage.stage} />

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <TradeLifecycleStepper stage={tradeStage.stage} decision={tradeStage.decision} />
      </div>

      {explanation?.headline && (
        <div style={{ fontSize: 11, color: colors.accent.gold, marginBottom: 12, padding: '8px 10px', backgroundColor: '#1A1500', borderRadius: radius.sm }}>
          {explanation.headline}
        </div>
      )}

      <WhyNowPanel explanation={explanation} opportunity={opp} />

      <EvidencePanel opportunity={opp} explanation={explanation} />

      <WarningsPanel opportunity={opp} plan={plan} explanation={explanation} />

      <IntelligenceSources opportunity={opp} />

      {opp?.risks?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: colors.text.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Risks
          </div>
          {opp.risks.slice(0, 3).map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: '#F87171', marginBottom: 2 }}>
              [{r.severity}] {r.label}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${colors.border}`, fontSize: 8, color: colors.text.disabled }}>
        Source: C7+C8+C9 Intelligence Aggregation
      </div>
    </div>
  );
}

function TradePlanPanel({ symbol, tradePlanData }) {
  const plan = useMemo(() => {
    if (!tradePlanData?.data) return null;
    return tradePlanData.data.find(t => t.symbol === symbol);
  }, [tradePlanData, symbol]);

  return (
    <div style={{ ...panel, padding: 16 }}>
      <ZoneHeader label="Trade Plan" icon="📐" />
      <TradePlanDisplay plan={plan} />
    </div>
  );
}

function AlertLifecyclePanel({ alertsByStage }) {
  const stages = ['PRE_ENTRY', 'CONFIRMATION', 'ENTRY', 'TARGET_1', 'TARGET_2', 'STOP', 'INVALIDATION', 'EXIT'];
  const stageLabels = {
    PRE_ENTRY: 'Pre-Entry',
    CONFIRMATION: 'Confirm',
    ENTRY: 'Entry',
    TARGET_1: 'T1',
    TARGET_2: 'T2',
    STOP: 'Stop',
    INVALIDATION: 'Invalid',
    EXIT: 'Exit',
  };

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
      {stages.map((stage) => {
        const alert = alertsByStage?.[stage];
        const status = alert?.status || 'DISABLED';
        const isActive = status === 'READY' || status === 'TRIGGERED';
        return (
          <div key={stage} style={{
            padding: '4px 10px',
            backgroundColor: isActive ? '#0B1F15' : '#07090E',
            border: `1px solid ${isActive ? '#14532D' : colors.border}`,
            borderRadius: radius.sm,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: status === 'READY' ? '#38BDF8' : status === 'TRIGGERED' ? '#FBBF24' : status === 'SENT' ? '#34D399' : status === 'FAILED' ? '#EF4444' : colors.text.disabled,
            }} />
            <span style={{ fontSize: 8, color: colors.text.faint, fontWeight: 700 }}>{stageLabels[stage]}</span>
          </div>
        );
      })}
    </div>
  );
}

function MonitoringPanel({ symbol, opportunityData, tradePlanData, notificationAlerts, notificationAlertsByStage }) {
  const opp = useMemo(() => {
    if (!opportunityData?.data) return null;
    return opportunityData.data.find(o => o.symbol === symbol);
  }, [opportunityData, symbol]);

  const plan = useMemo(() => {
    if (!tradePlanData?.data) return null;
    return tradePlanData.data.find(t => t.symbol === symbol);
  }, [tradePlanData, symbol]);

  const relevantAlerts = useMemo(() => {
    if (!notificationAlerts?.length) return [];
    return notificationAlerts.filter(a => a.ticker === symbol || a.symbol === symbol);
  }, [notificationAlerts, symbol]);

  return (
    <div style={{ ...panel, padding: 16 }}>
      <ZoneHeader label="Monitoring" icon="📡" />

      <AlertLifecyclePanel alertsByStage={notificationAlertsByStage} />

      {relevantAlerts.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          {relevantAlerts.slice(0, 3).map((alert) => (
            <div key={alert.id} style={{
              padding: 8,
              marginBottom: 6,
              backgroundColor: '#07090E',
              borderRadius: radius.sm,
              borderLeft: `2px solid ${stageColorMap[alert.lifecycleStage] || colors.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: colors.text.secondary }}>{alert.lifecycleStage?.replace('_', ' ')}</span>
                <Tag value={alert.status} colorMap={{
                  READY: '#38BDF8',
                  TRIGGERED: '#FBBF24',
                  SENT: '#34D399',
                  FAILED: '#EF4444',
                  DISABLED: '#475569',
                }} size="sm" />
              </div>
              {alert.reason && (
                <div style={{ fontSize: 9, color: colors.text.faint, lineHeight: 1.4 }}>{alert.reason}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: colors.text.faint, marginBottom: 12 }}>
          No alerts for {symbol || 'selected ticker'}
        </div>
      )}

      <div style={{ fontSize: 9, color: colors.text.disabled }}>
        Alert lifecycle: PRE_ENTRY → CONFIRMATION → ENTRY → TARGET_1 → TARGET_2 → EXIT
        <br />
        STOP / INVALIDATION can branch at any point
      </div>
    </div>
  );
}

function WatchlistPanel({ opportunities, onSelectSymbol }) {
  if (!opportunities?.length) {
    return (
      <div style={{ ...panel, padding: 16 }}>
        <ZoneHeader label="Watchlist" icon="👁" />
        <EmptyState icon="📋" message="No watchlist items" sub="Top opportunities appear here" />
      </div>
    );
  }

  return (
    <div style={{ ...panel, padding: 16 }}>
      <ZoneHeader label="Watchlist" icon="👁" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {opportunities.slice(0, 8).map(item => (
          <div
            key={item.symbol}
            onClick={() => onSelectSymbol(item.symbol)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#07090E',
              border: `1px solid ${colors.border}`,
              borderRadius: radius.sm,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: colors.text.primary }}>
              {item.symbol}
            </span>
            <span style={{ fontSize: 10, color: scoreColor(item.opportunityScore ?? item.setupScore) }}>
              {item.opportunityScore ?? item.setupScore ?? '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertCenterFeed({ alerts }) {
  if (!alerts?.length) {
    return (
      <div style={{ fontSize: 10, color: colors.text.faint }}>No alerts</div>
    );
  }

  return (
    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
      {alerts.slice(0, 8).map(alert => (
        <div key={alert.id} style={{
          padding: '8px 10px',
          marginBottom: 4,
          backgroundColor: '#07090E',
          borderRadius: radius.sm,
          borderLeft: `2px solid ${alert.priority >= 80 ? '#EF4444' : alert.priority >= 60 ? '#F59E0B' : colors.border}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: colors.text.primary }}>
              {alert.symbol}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 8, color: colors.text.faint }}>#{alert.priority}</span>
              <StatusDot status={alert.status === 'READY' ? 'ready' : alert.status === 'TRIGGERED' ? 'triggered' : alert.status === 'SENT' ? 'sent' : alert.status === 'FAILED' ? 'failed' : 'disabled'} />
            </div>
          </div>
          <div style={{ fontSize: 9, color: colors.text.secondary, marginTop: 2 }}>
            {alert.type?.replace('_', ' ')}
          </div>
        </div>
      ))}
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
            if (a.lifecycleStage) {
              byStage[a.lifecycleStage] = a;
            }
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
      if (a.id === alert.id) {
        return { ...a, status: newStatus };
      }
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
          ...panel,
          padding: '10px 16px',
          marginBottom: 12,
          fontSize: 10,
          color: colors.text.faint,
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

        <MarketStatusBar
          indices={indices}
          regime={regime}
          regimeScore={regimeScore}
          regimeConfidence={regimeConfidence}
          marketStatus={marketStatus}
          vix={vix}
          lastUpdate={lastUpdate}
          warning={marketWarning}
        />

        <div className="command-layout">
          <div className="main-column">
            <OpportunityRadar
              opportunities={topOpportunities}
              plansBySymbol={plansBySymbol}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              loading={loading}
            />
          </div>

          <div className="detail-column">
           <OpportunityDetail
             symbol={selectedSymbol}
             opportunityData={opportunityData}
             tradePlanData={tradePlanData}
             aiExplanationData={aiExplanationData}
             regime={regime}
             regimeScore={regimeScore}
             regimeConfidence={regimeConfidence}
           />

            {selectedSymbol && (
              <>
                <TradePlanPanel
                  symbol={selectedSymbol}
                  tradePlanData={tradePlanData}
                />

                <MonitoringPanel
                  symbol={selectedSymbol}
                  opportunityData={opportunityData}
                  tradePlanData={tradePlanData}
                  notificationAlerts={notificationAlerts}
                  notificationAlertsByStage={notificationAlertsByStage}
                />
              </>
            )}
          </div>

          <div className="side-column">
            <div style={{ ...panel, padding: 16 }}>
              <ZoneHeader label="Alert Center" icon="🔔" />
              {alertCenterData?.success && alertCenterData?.count > 0 && (
                <div style={{ fontSize: 10, color: colors.text.muted, marginBottom: 8 }}>
                  {alertCenterData.count} total
                  {alertCenterData.summary?.bySeverity?.CRITICAL > 0 && (
                    <span style={{ color: '#EF4444', fontWeight: 700, marginLeft: 4 }}>
                      {alertCenterData.summary.bySeverity.CRITICAL} critical
                    </span>
                  )}
                </div>
              )}
              <AlertCenterFeed alerts={highPriorityAlerts.length ? highPriorityAlerts : alerts.slice(0, 6)} />
            </div>

            <NotificationAlertPanel
              alerts={notificationAlerts}
              loading={loading}
              onStatusChange={handleNotificationStatusChange}
              emptyMessage="No notification alerts"
            />

            <WatchlistPanel
              opportunities={topOpportunities}
              onSelectSymbol={setSelectedSymbol}
            />
          </div>
        </div>

        <div style={{ ...panel, padding: '12px 16px', textAlign: 'center', marginTop: 12 }}>
          <p style={{ color: colors.text.faint, fontSize: 9, margin: 0 }}>
            Last update: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString('en-US') : '—'}
          </p>
        </div>
      </div>

      <style>{`
        .command-layout {
          display: grid;
          grid-template-columns: 1fr 380px 280px;
          gap: 12;
          align-items: start;
        }

        @media (max-width: 1280px) {
          .command-layout {
            grid-template-columns: 1fr 320px;
          }
          .side-column {
            display: none;
          }
        }

        @media (max-width: 900px) {
          .command-layout {
            grid-template-columns: 1fr;
          }
          .detail-column {
            order: 2;
          }
          .main-column {
            order: 1;
          }
        }

        @media (max-width: 640px) {
          .command-layout {
            gap: 8;
          }
        }
      `}</style>
    </div>
  );
}