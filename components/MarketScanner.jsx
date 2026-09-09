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

function ScannerRow({ item, rank }) {
  const direction = directionLabel(item);
  const directionColor = direction === 'LONG' ? '#34D399' : direction === 'SHORT' ? '#F87171' : '#94A3B8';
  const score = item.setupScore ?? item.technicalScore ?? item.discoveryScore;
  const flags = [
    item.squeeze ? 'SQUEEZE' : null,
    item.cluster ? 'CLUSTER' : null,
  ].filter(Boolean);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '34px minmax(80px, 1.2fr) 92px 72px 70px 70px 78px minmax(120px, 1fr)',
        gap: 8,
        alignItems: 'center',
        padding: '10px 12px',
        border: `1px solid ${colors.border}`,
        borderRadius: radius.sm,
        background: '#07090E',
      }}
    >
      <span style={{ color: colors.text.faint, fontSize: 9, fontFamily: 'monospace' }}>{String(rank).padStart(2, '0')}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: colors.text.primary, fontSize: 13, fontWeight: 900, fontFamily: 'monospace' }}>{item.symbol}</span>
          <span style={{ color: directionColor, fontSize: 8, fontWeight: 800 }}>{direction === 'LONG' ? '↑' : direction === 'SHORT' ? '↓' : '→'} {direction}</span>
        </div>
        <div style={{ color: colors.text.faint, fontSize: 8, marginTop: 2 }}>${fmt(item.price, item.price < 10 ? 3 : 2)}</div>
      </div>
      <div>
        <div style={{ color: item.changePercent >= 0 ? '#34D399' : '#F87171', fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}>{item.changePercent == null ? '—' : `${item.changePercent >= 0 ? '+' : ''}${fmt(item.changePercent)}%`}</div>
        <div style={{ color: colors.text.faint, fontSize: 7 }}>TODAY</div>
      </div>
      <div>
        <div style={{ color: scoreColor(score), fontSize: 13, fontWeight: 900, fontFamily: 'monospace' }}>{score ?? '—'}</div>
        <div style={{ color: colors.text.faint, fontSize: 7 }}>SCORE</div>
      </div>
      <div>
        <div style={{ color: colors.text.secondary, fontSize: 10, fontFamily: 'monospace' }}>{item.rsi == null ? '—' : fmt(item.rsi, 0)}</div>
        <div style={{ color: colors.text.faint, fontSize: 7 }}>RSI</div>
      </div>
      <div>
        <div style={{ color: colors.text.secondary, fontSize: 10, fontFamily: 'monospace' }}>{item.relativeVolume == null ? '—' : `${fmt(item.relativeVolume, 1)}x`}</div>
        <div style={{ color: colors.text.faint, fontSize: 7 }}>RVOL</div>
      </div>
      <div>
        <div style={{ color: colors.text.secondary, fontSize: 10, fontFamily: 'monospace' }}>{item.riskReward == null ? '—' : `${fmt(item.riskReward, 2)}x`}</div>
        <div style={{ color: colors.text.faint, fontSize: 7 }}>R/R</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ padding: '4px 8px', borderRadius: 9999, color: signalColor(item.decision), background: `${signalColor(item.decision)}15`, border: `1px solid ${signalColor(item.decision)}35`, fontSize: 8, fontWeight: 900 }}>{item.decision || 'REJECT'}</span>
        {flags.map((flag) => <span key={flag} style={{ padding: '3px 6px', borderRadius: 5, color: '#FBBF24', background: '#FBBF2410', border: '1px solid #FBBF2425', fontSize: 7, fontWeight: 800 }}>{flag}</span>)}
      </div>
    </div>
  );
}

function ScannerCard({ item }) {
  const direction = directionLabel(item);
  const directionColor = direction === 'LONG' ? '#34D399' : direction === 'SHORT' ? '#F87171' : '#94A3B8';
  const score = item.setupScore ?? item.technicalScore ?? item.discoveryScore;
  return (
    <div style={{ ...panel, padding: 12, background: '#07090E' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ color: colors.text.primary, fontSize: 15, fontWeight: 900, fontFamily: 'monospace' }}>{item.symbol}</span>
            <span style={{ color: directionColor, fontSize: 8, fontWeight: 800 }}>{direction === 'LONG' ? '↑' : direction === 'SHORT' ? '↓' : '→'} {direction}</span>
          </div>
          <div style={{ color: colors.text.faint, fontSize: 9, marginTop: 3 }}>${fmt(item.price, item.price < 10 ? 3 : 2)} · {item.changePercent == null ? '—' : `${item.changePercent >= 0 ? '+' : ''}${fmt(item.changePercent)}%`}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: scoreColor(score), fontSize: 20, fontWeight: 900, fontFamily: 'monospace' }}>{score ?? '—'}</div>
          <div style={{ color: colors.text.faint, fontSize: 7 }}>HUNTER SCORE</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginTop: 10 }}>
        {[
          ['RSI', item.rsi == null ? '—' : fmt(item.rsi, 0)],
          ['RVOL', item.relativeVolume == null ? '—' : `${fmt(item.relativeVolume, 1)}x`],
          ['R/R', item.riskReward == null ? '—' : `${fmt(item.riskReward, 2)}x`],
          ['SMA50', item.sma50 == null ? '—' : fmt(item.sma50)],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: '6px 4px', borderRadius: 5, border: `1px solid ${colors.border}`, textAlign: 'center' }}>
            <div style={{ color: colors.text.primary, fontSize: 9, fontWeight: 800, fontFamily: 'monospace' }}>{value}</div>
            <div style={{ color: colors.text.faint, fontSize: 6, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
        <span style={{ padding: '3px 7px', borderRadius: 9999, color: signalColor(item.decision), background: `${signalColor(item.decision)}15`, border: `1px solid ${signalColor(item.decision)}35`, fontSize: 7, fontWeight: 900 }}>{item.decision || 'REJECT'}</span>
        {item.squeeze && <span style={{ padding: '3px 7px', borderRadius: 9999, color: '#FBBF24', background: '#FBBF2410', border: '1px solid #FBBF2425', fontSize: 7, fontWeight: 800 }}>SQUEEZE</span>}
        {item.cluster && <span style={{ padding: '3px 7px', borderRadius: 9999, color: '#38BDF8', background: '#38BDF810', border: '1px solid #38BDF825', fontSize: 7, fontWeight: 800 }}>CLUSTER</span>}
      </div>
    </div>
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

      let nextItems = Array.isArray(json.data) ? json.data : [];
      let usedFallback = false;

      if (nextItems.length === 0) {
        const fallbackResults = await Promise.allSettled(
          CORE_DISCOVERY_SYMBOLS.map(async (symbol) => {
            const directRes = await fetch(`/api/stocks?symbol=${symbol}`, { cache: 'no-store' });
            const directJson = await directRes.json().catch(() => null);
            if (!directRes.ok || directJson?.status !== 'success' || !Array.isArray(directJson.data) || !directJson.data[0]) return null;
            return directJson.data[0];
          })
        );
        nextItems = fallbackResults
          .filter((result) => result.status === 'fulfilled' && result.value)
          .map((result) => result.value);
        usedFallback = nextItems.length > 0;
      }

      setItems(nextItems);
      setFallbackMode(usedFallback);
      setUpdatedAt(json.timestamp || new Date().toISOString());
      setError(nextItems.length > 0 ? '' : 'No discovery symbols returned');
    } catch (err) {
      setError(err?.message || 'Market scanner unavailable');
      setFallbackMode(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return items;
    if (filter === 'BUY') return items.filter((item) => item.decision === 'BUY');
    if (filter === 'WATCH') return items.filter((item) => item.decision === 'WATCH');
    return items.filter((item) => item.squeeze || item.cluster || Number(item.relativeVolume) >= 1.5);
  }, [items, filter]);

  const buyCount = items.filter((item) => item.decision === 'BUY').length;
  const watchCount = items.filter((item) => item.decision === 'WATCH').length;

  return (
    <section style={{ ...panel, padding: 16, margin: '0 auto 10px', maxWidth: 1600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ color: colors.accent.cyan, fontSize: 9, fontWeight: 900, letterSpacing: 1.4 }}>MARKET SCANNER · DISCOVERY</div>
          <div style={{ color: colors.text.primary, fontSize: 20, fontWeight: 900, marginTop: 4 }}>Find the stocks first.</div>
          <div style={{ color: colors.text.muted, fontSize: 10, marginTop: 4 }}>Discovery remains visible even when Hunter has zero qualified opportunities.</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ padding: '5px 9px', borderRadius: 9999, border: '1px solid #34D39935', background: '#34D39910', color: '#34D399', fontSize: 8, fontWeight: 800 }}>{items.length} STOCKS</span>
          <span style={{ padding: '5px 9px', borderRadius: 9999, border: '1px solid #34D39935', background: '#34D39910', color: '#34D399', fontSize: 8, fontWeight: 800 }}>{buyCount} BUY</span>
          <span style={{ padding: '5px 9px', borderRadius: 9999, border: '1px solid #FBBF2435', background: '#FBBF2410', color: '#FBBF24', fontSize: 8, fontWeight: 800 }}>{watchCount} WATCH</span>
          <button onClick={() => { setLoading(true); load(); }} disabled={loading} style={{ padding: '5px 10px', borderRadius: radius.sm, border: `1px solid ${colors.accent.cyan}45`, background: `${colors.accent.cyan}12`, color: colors.accent.cyan, fontSize: 8, fontWeight: 900, cursor: loading ? 'wait' : 'pointer' }}>{loading ? 'SCANNING…' : 'REFRESH'}</button>
        </div>
      </div>

      {fallbackMode && (
        <div style={{ marginBottom: 10, padding: '6px 9px', borderRadius: radius.sm, border: '1px solid #FBBF2430', background: '#FBBF2408', color: '#FBBF24', fontSize: 8 }}>
          ⚠ Discovery feed returned no candidates. Showing direct core-symbol fallback; this does not change Hunter qualification.
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {FILTERS.map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} style={{ padding: '6px 11px', borderRadius: 9999, border: `1px solid ${filter === tab.key ? colors.accent.cyan + '70' : colors.border}`, background: filter === tab.key ? `${colors.accent.cyan}12` : '#07090E', color: filter === tab.key ? colors.accent.cyan : colors.text.muted, fontSize: 8, fontWeight: 900, cursor: 'pointer' }}>{tab.label}</button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <div style={{ padding: '34px 10px', textAlign: 'center', color: colors.text.muted, fontSize: 10 }}>Scanning market discovery…</div>
      ) : error && items.length === 0 ? (
        <div style={{ padding: '24px 10px', textAlign: 'center', color: '#F87171', fontSize: 10 }}>Market scanner unavailable · {error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '28px 10px', textAlign: 'center', border: `1px dashed ${colors.border}`, borderRadius: radius.sm }}>
          <div style={{ color: colors.text.primary, fontSize: 12, fontWeight: 800 }}>No matches in this view.</div>
          <div style={{ color: colors.text.muted, fontSize: 9, marginTop: 4 }}>The market scanner is healthy; try ALL or another filter.</div>
        </div>
      ) : (
        <>
          <div className="scanner-desktop" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(80px, 1.2fr) 92px 72px 70px 70px 78px minmax(120px, 1fr)', gap: 8, padding: '0 12px 5px', color: colors.text.faint, fontSize: 7, fontWeight: 900, letterSpacing: 0.5 }}>
              <span>#</span><span>SYMBOL</span><span>CHANGE</span><span>SCORE</span><span>RSI</span><span>RVOL</span><span>R/R</span><span>DECISION / FLAGS</span>
            </div>
            {filtered.slice(0, 15).map((item, index) => <ScannerRow key={item.symbol} item={item} rank={index + 1} />)}
          </div>
          <div className="scanner-mobile" style={{ display: 'none', gridTemplateColumns: '1fr', gap: 7 }}>
            {filtered.slice(0, 15).map((item) => <ScannerCard key={item.symbol} item={item} />)}
          </div>
        </>
      )}

      <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', color: colors.text.faint, fontSize: 7 }}>
        <span>{updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString('en-US')}` : 'Waiting for data'} · Yahoo Finance discovery</span>
        <span>Discovery data is market context, not a qualified trade decision.</span>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .scanner-desktop { display: none !important; }
          .scanner-mobile { display: grid !important; }
        }
      `}</style>
    </section>
  );
}
