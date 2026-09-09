'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { colors, radius, panelStyle } from '@/components/ui/DesignTokens';

const panel = { ...panelStyle };

function firstValue(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== '') ?? null;
}

function formatNumber(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })
    : '—';
}

function formatDirection(value) {
  if (value === 'UP' || value === 'LONG' || value === 'BUY') return 'LONG';
  if (value === 'DOWN' || value === 'SHORT' || value === 'SELL') return 'SHORT';
  return 'NEUTRAL';
}

function directionColor(direction) {
  if (direction === 'LONG') return '#34D399';
  if (direction === 'SHORT') return '#F87171';
  return '#FBBF24';
}

function pickTopOpportunity(payload) {
  const opportunities = Array.isArray(payload?.raw?.opportunities) ? payload.raw.opportunities : [];
  const plans = Array.isArray(payload?.raw?.tradePlans) ? payload.raw.tradePlans : [];
  const explanations = Array.isArray(payload?.raw?.explanations) ? payload.raw.explanations : [];
  const opportunity = opportunities.find((item) => item?.symbol) || plans.find((item) => item?.symbol) || null;
  if (!opportunity) return null;

  const plan = plans.find((item) => item?.symbol === opportunity.symbol) || {};
  const explanation = explanations.find((item) => item?.symbol === opportunity.symbol) || {};
  const direction = formatDirection(firstValue(opportunity.direction, plan.direction, opportunity.opportunity?.direction));

  return {
    symbol: opportunity.symbol,
    direction,
    quality: firstValue(plan.planSignal, opportunity.quality, 'WATCH'),
    score: firstValue(plan.planScore, opportunity.opportunityScore),
    entry: firstValue(plan.entry, plan.entryPrice, opportunity.entry, opportunity.entryPrice),
    stop: firstValue(plan.stop, plan.stopPrice, opportunity.stop, opportunity.stopPrice),
    target: firstValue(plan.target, plan.targetPrice, opportunity.target, opportunity.targetPrice),
    whyNow: firstValue(explanation.headline, explanation.summary, explanation.whyNow, explanation.title),
  };
}

export default function HunterStartPanel() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/command-center?limit=3&raw=true', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json?.success) throw new Error(json?.error || 'Command Center unavailable');
      setPayload(json);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Unable to load decision summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const top = useMemo(() => pickTopOpportunity(payload), [payload]);
  const regime = payload?.regime || 'UNAVAILABLE';
  const marketClosed = payload?.marketStatus?.open === false;
  const opportunityCount = Number(payload?.opportunityCount || 0);
  const planCount = Number(payload?.planCount || 0);

  const regimeLabel = {
    BULLISH: 'BULLISH / RISK-ON',
    NEUTRAL: 'NEUTRAL / SELECTIVE',
    RISK_OFF: 'RISK-OFF / DEFENSIVE',
    BEARISH: 'BEARISH / RISK-OFF',
    UNAVAILABLE: 'MARKET CONTEXT UNAVAILABLE',
  }[regime] || regime;

  return (
    <section style={{ ...panel, padding: 16, margin: '10px auto 12px', maxWidth: 1600, border: '1px solid #243247' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ color: colors.accent.cyan, fontSize: 10, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            🐺 HUNTER START HERE
          </div>
          <div style={{ color: colors.text.primary, fontSize: 18, fontWeight: 900, marginTop: 4 }}>
            Decision first. Evidence second.
          </div>
          <div style={{ color: colors.text.muted, fontSize: 10, marginTop: 4 }}>
            This is the starting point. Everything below is supporting evidence and diagnostics.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ padding: '5px 9px', borderRadius: 9999, border: '1px solid #34D39940', background: '#34D39912', color: '#34D399', fontSize: 9, fontWeight: 800 }}>
            {opportunityCount} opportunities
          </span>
          <span style={{ padding: '5px 9px', borderRadius: 9999, border: '1px solid #38BDF840', background: '#38BDF812', color: '#38BDF8', fontSize: 9, fontWeight: 800 }}>
            {planCount} plans
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
        <div style={{ padding: 12, borderRadius: radius.md, background: '#070B12', border: '1px solid #1F2636' }}>
          <div style={{ color: colors.text.faint, fontSize: 8, fontWeight: 800, letterSpacing: 0.8 }}>01 · MARKET</div>
          <div style={{ color: colors.text.primary, fontSize: 13, fontWeight: 900, marginTop: 6 }}>{regimeLabel}</div>
          <div style={{ color: marketClosed ? '#FBBF24' : '#34D399', fontSize: 9, marginTop: 5 }}>
            {marketClosed ? '● US market closed — no live setup required' : '● Market session active'}
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: radius.md, background: '#070B12', border: '1px solid #1F2636' }}>
          <div style={{ color: colors.text.faint, fontSize: 8, fontWeight: 800, letterSpacing: 0.8 }}>02 · FIND THE HUNT</div>
          {loading ? (
            <div style={{ color: colors.text.muted, fontSize: 11, marginTop: 8 }}>Scanning…</div>
          ) : top ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ color: colors.text.primary, fontSize: 18, fontWeight: 950 }}>{top.symbol}</span>
                <span style={{ color: directionColor(top.direction), fontSize: 11, fontWeight: 900 }}>
                  {top.direction === 'LONG' ? '↑' : top.direction === 'SHORT' ? '↓' : '—'} {top.direction}
                </span>
              </div>
              <div style={{ color: colors.text.muted, fontSize: 9, marginTop: 4 }}>
                {top.quality}{top.score != null ? ` · score ${formatNumber(top.score, 0)}` : ''}
              </div>
            </>
          ) : (
            <div style={{ color: colors.text.muted, fontSize: 10, marginTop: 8 }}>
              No qualified setup right now. That is a valid Hunter decision.
            </div>
          )}
        </div>

        <div style={{ padding: 12, borderRadius: radius.md, background: '#070B12', border: '1px solid #1F2636' }}>
          <div style={{ color: colors.text.faint, fontSize: 8, fontWeight: 800, letterSpacing: 0.8 }}>03 · TRADE PLAN</div>
          {top ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}>
              <div><div style={{ color: colors.text.faint, fontSize: 7 }}>ENTRY</div><div style={{ color: colors.text.primary, fontSize: 11, fontWeight: 800 }}>{formatNumber(top.entry)}</div></div>
              <div><div style={{ color: colors.text.faint, fontSize: 7 }}>STOP</div><div style={{ color: '#F87171', fontSize: 11, fontWeight: 800 }}>{formatNumber(top.stop)}</div></div>
              <div><div style={{ color: colors.text.faint, fontSize: 7 }}>TARGET</div><div style={{ color: '#34D399', fontSize: 11, fontWeight: 800 }}>{formatNumber(top.target)}</div></div>
            </div>
          ) : (
            <div style={{ color: colors.text.muted, fontSize: 10, marginTop: 8 }}>No trade plan until a qualified setup exists.</div>
          )}
        </div>

        <div style={{ padding: 12, borderRadius: radius.md, background: '#070B12', border: '1px solid #1F2636' }}>
          <div style={{ color: colors.text.faint, fontSize: 8, fontWeight: 800, letterSpacing: 0.8 }}>04 · WHY / EVIDENCE</div>
          <div style={{ color: colors.text.secondary, fontSize: 10, lineHeight: 1.5, marginTop: 7 }}>
            {top?.whyNow || 'Open the supporting panels below to inspect C9 Why Now, C8 Trade Plan, C10 Market Regime, C7 ranking and B1-B6 evidence.'}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 10, padding: 8, borderRadius: radius.sm, background: '#F9731610', border: '1px solid #F9731630', color: '#FBBF24', fontSize: 9 }}>
          Decision summary unavailable: {error}. Existing intelligence panels remain available below.
        </div>
      )}
    </section>
  );
}
