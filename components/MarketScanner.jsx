'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { colors, radius, panelStyle, scoreColor } from '@/components/ui/DesignTokens';

const panel = { ...panelStyle };
const FILTERS = [
  { key: 'ALL', label: 'ALL' },
  { key: 'BUY', label: 'BUY' },
  { key: 'WATCH', label: 'WATCH' },
  { key: 'SETUP', label: 'SETUP' },
];
const CORE_DISCOVERY_SYMBOLS = ['NVDA', 'AMD', 'TSLA', 'PLTR', 'AAPL', 'MSFT'];

function fmt(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function signalColor(signal) {
  if (signal === 'BUY') return '#34D399';
  if (signal === 'WATCH') return '#FBBF24';
  return '#94A3B8';
}

function directionLabel(item) {
  if (item?.directionBias === 'ميل فني صاعد') return 'LONG';
  if (item?.directionBias === 'ميل فني هابط') return 'SHORT';
  return 'NEUTRAL';
}

async function loadCoreFallback() {
  const fallbackResults = await Promise.allSettled(
    CORE_DISCOVERY_SYMBOLS.map(async (symbol) => {
      const directRes = await fetch(`/api/stocks?symbol=${symbol}`, { cache: 'no-store' });
      const directJson = await directRes.json().catch(() => null);
      if (!directRes.ok || directJson?.status !== 'success' || !Array.isArray(directJson.data) || !directJson.data[0]) return null;
      return directJson.data[0];
    })
  );
  return fallbackResults.filter((result) => result.status === 'fulfilled' && result.value).map((result) => result.value);
}

function mergeCoreSymbols(discoveryItems, coreItems) {
  const merged = new Map((discoveryItems || []).map((item) => [item.symbol, item]));
  for (const item of coreItems || []) if (item?.symbol && !merged.has(item.symbol)) merged.set(item.symbol, item);
  return [...merged.values()];
}

function ScoreRing({ score }) {
  const numeric = Number(score);
  const safe = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : null;
  const angle = safe == null ? 0 : safe * 3.6;
  return (
    <div style={{ width: 62, height: 62, borderRadius: '50%', background: safe == null ? '#111827' : `conic-gradient(${scoreColor(safe)} ${angle}deg, #111827 ${angle}deg)`, display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
      <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#07090E', display: 'grid', placeItems: 'center', border: `1px solid ${colors.border}` }}>
        <div style={{ textAlign: 'center' }}><div style={{ color: safe == null ? colors.text.muted : scoreColor(safe), font: '900 17px/1 monospace' }}>{safe == null ? '—' : safe}</div><div style={{ color: colors.text.faint, font: '700 6px/1 monospace', marginTop: 3 }}>SCORE</div></div>
      </div>
    </div>
  );
}

function SignalBadge({ decision }) {
  const color = signalColor(decision);
  return <span style={{ padding: '5px 9px', borderRadius: 9999, color, background: `${color}12`, border: `1px solid ${color}38`, fontSize: 8, fontWeight: 900, letterSpacing: .6 }}>{decision || 'REJECT'}</span>;
}

function ScannerRow({ item, rank }) {
  const direction = directionLabel(item);
  const directionColor = direction === 'LONG' ? '#34D399' : direction === 'SHORT' ? '#F87171' : '#94A3B8';
  const score = item.setupScore ?? item.technicalScore ?? item.discoveryScore;
  const flags = [item.squeeze ? 'SQUEEZE' : null, item.cluster ? 'CLUSTER' : null].filter(Boolean);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(100px,1.2fr) 90px 72px 64px 70px 72px minmax(130px,1fr)', gap: 8, alignItems: 'center', padding: '11px 12px', border: `1px solid ${colors.border}`, borderRadius: radius.sm, background: '#07090E', transition: 'border-color .18s ease, transform .18s ease' }}>
      <span style={{ color: colors.text.faint, fontSize: 9, fontFamily: 'monospace' }}>{String(rank).padStart(2, '0')}</span>
      <div style={{ minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><span style={{ color: colors.text.primary, fontSize: 13, fontWeight: 900, fontFamily: 'monospace' }}>{item.symbol}</span><span style={{ color: directionColor, fontSize: 8, fontWeight: 800 }}>{direction === 'LONG' ? '↑' : direction === 'SHORT' ? '↓' : '→'} {direction}</span></div><div style={{ color: colors.text.faint, fontSize: 8, marginTop: 2 }}>${fmt(item.price, item.price < 10 ? 3 : 2)}</div></div>
      <div><div style={{ color: item.changePercent >= 0 ? '#34D399' : '#F87171', fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}>{item.changePercent == null ? '—' : `${item.changePercent >= 0 ? '+' : ''}${fmt(item.changePercent)}%`}</div><div style={{ color: colors.text.faint, fontSize: 7 }}>TODAY</div></div>
      <div><div style={{ color: scoreColor(score), fontSize: 13, fontWeight: 900, fontFamily: 'monospace' }}>{score ?? '—'}</div><div style={{ color: colors.text.faint, fontSize: 7 }}>SCORE</div></div>
      <div><div style={{ color: colors.text.secondary, fontSize: 10, fontFamily: 'monospace' }}>{item.rsi == null ? '—' : fmt(item.rsi, 0)}</div><div style={{ color: colors.text.faint, fontSize: 7 }}>RSI</div></div>
      <div><div style={{ color: colors.text.secondary, fontSize: 10, fontFamily: 'monospace' }}>{item.relativeVolume == null ? '—' : `${fmt(item.relativeVolume, 1)}x`}</div><div style={{ color: colors.text.faint, fontSize: 7 }}>RVOL</div></div>
      <div><div style={{ color: colors.text.secondary, fontSize: 10, fontFamily: 'monospace' }}>{item.riskReward == null ? '—' : `${fmt(item.riskReward, 2)}x`}</div><div style={{ color: colors.text.faint, fontSize: 7 }}>R/R</div></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><SignalBadge decision={item.decision} />{flags.map((flag) => <span key={flag} style={{ padding: '3px 6px', borderRadius: 5, color: flag === 'CLUSTER' ? '#38BDF8' : '#FBBF24', background: flag === 'CLUSTER' ? '#38BDF810' : '#FBBF2410', border: `1px solid ${flag === 'CLUSTER' ? '#38BDF825' : '#FBBF2425'}`, fontSize: 7, fontWeight: 800 }}>{flag}</span>)}</div>
    </div>
  );
}

function ScannerCard({ item }) {
  const direction = directionLabel(item);
  const directionColor = direction === 'LONG' ? '#34D399' : direction === 'SHORT' ? '#F87171' : '#94A3B8';
  const score = item.setupScore ?? item.technicalScore ?? item.discoveryScore;
  const change = item.changePercent;
  return (
    <article style={{ ...panel, padding: 14, background: 'linear-gradient(145deg,#0A0D14,#06080C)', borderColor: colors.border, boxShadow: '0 12px 32px rgba(0,0,0,.18)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={{ color: colors.text.primary, font: '900 17px/1 monospace' }}>{item.symbol}</span><span style={{ color: directionColor, font: '800 8px/1 monospace' }}>{direction === 'LONG' ? '↑' : direction === 'SHORT' ? '↓' : '→'} {direction}</span></div><div style={{ color: colors.text.muted, fontSize: 9, marginTop: 5 }}>${fmt(item.price, item.price < 10 ? 3 : 2)} <span style={{ color: change >= 0 ? '#34D399' : '#F87171', fontFamily: 'monospace' }}>{change == null ? '· —' : `· ${change >= 0 ? '+' : ''}${fmt(change)}%`}</span></div></div>
        <ScoreRing score={score} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6, marginTop: 13 }}>{[['RSI', item.rsi == null ? '—' : fmt(item.rsi, 0)], ['RVOL', item.relativeVolume == null ? '—' : `${fmt(item.relativeVolume, 1)}x`], ['R/R', item.riskReward == null ? '—' : `${fmt(item.riskReward, 2)}x`], ['SMA50', item.sma50 == null ? '—' : fmt(item.sma50)]].map(([label, value]) => <div key={label} style={{ padding: '7px 4px', borderRadius: 7, border: `1px solid ${colors.border}`, background: '#05070B', textAlign: 'center' }}><div style={{ color: colors.text.primary, font: '800 9px/1 monospace' }}>{value}</div><div style={{ color: colors.text.faint, font: '700 6px/1 monospace', marginTop: 4 }}>{label}</div></div>)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 11 }}><SignalBadge decision={item.decision} />{item.squeeze && <span style={{ padding: '4px 7px', borderRadius: 9999, color: '#FBBF24', background: '#FBBF2410', border: '1px solid #FBBF2425', fontSize: 7, fontWeight: 800 }}>SQUEEZE</span>}{item.cluster && <span style={{ padding: '4px 7px', borderRadius: 9999, color: '#38BDF8', background: '#38BDF810', border: '1px solid #38BDF825', fontSize: 7, fontWeight: 800 }}>CLUSTER</span>}</div>
    </article>
  );
}

export default function MarketScanner() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [fallbackMode, setFallbackMode] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/stocks?limit=25', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || `Scanner request failed (${res.status})`);
      const discoveryItems = Array.isArray(json.data) ? json.data : [];
      const coreItems = await loadCoreFallback();
      const nextItems = mergeCoreSymbols(discoveryItems, coreItems);
      setItems(nextItems);
      setFallbackMode(discoveryItems.length === 0 || nextItems.length > discoveryItems.length);
      setUpdatedAt(json.timestamp || new Date().toISOString());
      setError(nextItems.length > 0 ? '' : 'No discovery symbols returned');
    } catch (err) {
      const discoveryError = err?.message || 'Market scanner unavailable';
      try {
        const fallbackItems = await loadCoreFallback();
        if (fallbackItems.length > 0) {
          setItems(fallbackItems); setFallbackMode(true); setUpdatedAt(new Date().toISOString()); setError('Discovery feed unavailable; showing direct core-symbol fallback.'); return;
        }
      } catch { /* preserve primary error */ }
      setError(discoveryError); setFallbackMode(false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const timer = setInterval(load, 60_000); return () => clearInterval(timer); }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return items;
    if (filter === 'BUY') return items.filter((item) => item.decision === 'BUY');
    if (filter === 'WATCH') return items.filter((item) => item.decision === 'WATCH');
    return items.filter((item) => item.squeeze || item.cluster || Number(item.relativeVolume) >= 1.5);
  }, [items, filter]);

  const buyCount = items.filter((item) => item.decision === 'BUY').length;
  const watchCount = items.filter((item) => item.decision === 'WATCH').length;
  const setupCount = items.filter((item) => item.squeeze || item.cluster || Number(item.relativeVolume) >= 1.5).length;
  const topScore = items.reduce((best, item) => Math.max(best, Number(item.setupScore ?? item.technicalScore ?? item.discoveryScore) || 0), 0);

  return (
    <section style={{ ...panel, padding: 16, margin: '0 auto 10px', maxWidth: 1600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <div><div style={{ color: colors.accent.cyan, font: '900 9px/1 monospace', letterSpacing: 1.5 }}>MARKET SCANNER · DISCOVERY</div><div style={{ color: colors.text.primary, fontSize: 22, fontWeight: 900, marginTop: 6 }}>Find the stocks first.</div><div style={{ color: colors.text.muted, fontSize: 10, marginTop: 5 }}>Discovery stays visible even when Hunter has zero qualified opportunities.</div></div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ padding: '6px 9px', borderRadius: 9999, border: `1px solid ${colors.border}`, background: '#07090E', color: colors.text.secondary, font: '800 8px/1 monospace' }}>{items.length} STOCKS</span><span style={{ padding: '6px 9px', borderRadius: 9999, border: '1px solid #34D39935', background: '#34D39910', color: '#34D399', font: '800 8px/1 monospace' }}>{buyCount} BUY</span><span style={{ padding: '6px 9px', borderRadius: 9999, border: '1px solid #FBBF2435', background: '#FBBF2410', color: '#FBBF24', font: '800 8px/1 monospace' }}>{watchCount} WATCH</span><span style={{ padding: '6px 9px', borderRadius: 9999, border: `1px solid ${colors.accent.cyan}35`, background: `${colors.accent.cyan}08`, color: colors.accent.cyan, font: '800 8px/1 monospace' }}>TOP {topScore || '—'}</span><button onClick={() => { setLoading(true); load(); }} disabled={loading} style={{ padding: '6px 10px', borderRadius: radius.sm, border: `1px solid ${colors.accent.cyan}45`, background: `${colors.accent.cyan}12`, color: colors.accent.cyan, fontSize: 8, fontWeight: 900, cursor: loading ? 'wait' : 'pointer' }}>{loading ? 'SCANNING…' : 'REFRESH'}</button></div>
      </div>
      {fallbackMode && <div style={{ marginBottom: 10, padding: '7px 10px', borderRadius: radius.sm, border: '1px solid #FBBF2430', background: '#FBBF2408', color: '#FBBF24', fontSize: 8 }}>⚠ Core-symbol visibility fallback is active; this does not change Hunter qualification.</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>{FILTERS.map((tab) => <button key={tab.key} onClick={() => setFilter(tab.key)} style={{ padding: '7px 12px', borderRadius: 9999, border: `1px solid ${filter === tab.key ? colors.accent.cyan + '70' : colors.border}`, background: filter === tab.key ? `${colors.accent.cyan}12` : '#07090E', color: filter === tab.key ? colors.accent.cyan : colors.text.muted, fontSize: 8, fontWeight: 900, cursor: 'pointer' }}>{tab.label}{tab.key === 'SETUP' ? ` · ${setupCount}` : ''}</button>)}</div>
      {loading && items.length === 0 ? <div style={{ padding: '42px 10px', textAlign: 'center', color: colors.text.muted, fontSize: 10 }}>Scanning market discovery…</div> : error && items.length === 0 ? <div style={{ padding: '28px 10px', textAlign: 'center', color: '#F87171', fontSize: 10 }}>Market scanner unavailable · {error}</div> : filtered.length === 0 ? <div style={{ padding: '30px 10px', textAlign: 'center', border: `1px dashed ${colors.border}`, borderRadius: radius.sm }}><div style={{ color: colors.text.primary, fontSize: 12, fontWeight: 800 }}>No matches in this view.</div><div style={{ color: colors.text.muted, fontSize: 9, marginTop: 5 }}>Try ALL or another filter. A zero result here does not mean the market is empty.</div></div> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 8, marginBottom: 10 }}>
          {filtered.slice(0, 8).map((item) => <ScannerCard key={item.symbol} item={item} />)}
        </div>
        {filtered.length > 8 && <div style={{ color: colors.text.faint, fontSize: 8, margin: '8px 2px' }}>Showing the first 8 cards · {filtered.length - 8} more in table.</div>}
        <div style={{ display: 'grid', gap: 6, overflowX: 'auto' }}>
          <div style={{ minWidth: 720, display: 'grid', gridTemplateColumns: '34px minmax(100px,1.2fr) 90px 72px 64px 70px 72px minmax(130px,1fr)', gap: 8, padding: '5px 12px', color: colors.text.faint, font: '700 7px/1 monospace', letterSpacing: .5 }}><span>#</span><span>SYMBOL</span><span>MOVE</span><span>SCORE</span><span>RSI</span><span>RVOL</span><span>R/R</span><span>DECISION · SETUP</span></div>
          {filtered.slice(0, 25).map((item, index) => <ScannerRow key={item.symbol} item={item} rank={index + 1} />)}
        </div>
      </>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 12, paddingTop: 9, borderTop: `1px solid ${colors.border}` }}><span style={{ color: colors.text.faint, fontSize: 7 }}>Discovery context · not a qualified trade decision</span><span style={{ color: colors.text.faint, font: '700 7px/1 monospace' }}>UPDATED {updatedAt ? new Date(updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span></div>
    </section>
  );
}
