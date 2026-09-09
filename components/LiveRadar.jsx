'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { colors, radius } from '@/components/ui/DesignTokens';

const panel = { backgroundColor: '#090A0F', border: '1px solid #1F2636', borderRadius: radius.lg };
const STATUS_COLORS = { OPPORTUNITY: '#22C55E', WATCH: '#FBBF24', NO_OPPORTUNITY: '#6B7280', INSUFFICIENT_DATA: '#F97316', STALE_DATA: '#EF4444', ERROR: '#EF4444' };
const DIRECTION_COLORS = { LONG: '#22C55E', SHORT: '#EF4444', NEUTRAL: '#6B7280' };
const FRESHNESS_COLORS = { FRESH: '#22C55E', STALE: '#EF4444', INSUFFICIENT: '#F97316' };

function toUiDirection(direction) {
  if (direction === 'UP' || direction === 'LONG') return 'LONG';
  if (direction === 'DOWN' || direction === 'SHORT') return 'SHORT';
  return 'NEUTRAL';
}
function StatusBadge({ status }) { const color = STATUS_COLORS[status] || '#6B7280'; return <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 9999, backgroundColor: color + '20', border: `1px solid ${color}40`, color, fontWeight: 700 }}>{status || 'UNKNOWN'}</span>; }
function DirectionBadge({ direction }) { const uiDirection = toUiDirection(direction); const color = DIRECTION_COLORS[uiDirection]; return <span style={{ fontSize: 10, color, fontWeight: 700 }}>{uiDirection === 'LONG' ? '↑' : uiDirection === 'SHORT' ? '↓' : '—'} {uiDirection}</span>; }
function FreshnessBadge({ freshness }) { const color = FRESHNESS_COLORS[freshness] || '#6B7280'; return <span style={{ fontSize: 9, color }}>{freshness === 'FRESH' ? '● LIVE' : freshness === 'STALE' ? '⚠ STALE' : '⏳ INSUFFICIENT'}</span>; }
function PressureBar({ pressure }) { if (pressure == null) return <span style={{ fontSize: 10, color: colors.text.muted }}>—</span>; const value = Math.max(0, Math.min(100, Number(pressure))); const color = value >= 65 ? '#22C55E' : value <= 35 ? '#EF4444' : '#FBBF24'; return <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 60, height: 6, backgroundColor: '#1F2636', borderRadius: 3 }}><div style={{ width: `${value}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} /></div><span style={{ fontSize: 10, color, fontWeight: 700 }}>{value.toFixed(0)}</span></div>; }
function EvidenceValue({ label, value }) { return <span style={{ padding: '3px 7px', borderRadius: 6, background: '#111722', border: '1px solid #1F2636', color: colors.text.muted }}>{label}: {value ?? '—'}</span>; }

function OpportunityRow({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const options = entry.optionsFlow || entry.options || null;
  const smartMoney = entry.optionsSmartMoney || entry.smartMoney || null;
  const optionLabel = options ? (options.direction || options.dataQuality || 'OBSERVED') : 'NO DATA';
  const smartLabel = smartMoney?.classification || 'UNATTRIBUTED';
  const direction = entry.opportunity?.direction || entry.pulse?.direction || 'NEUTRAL';
  const status = entry.status || entry.opportunity?.status || 'UNKNOWN';
  const pressure = entry.pulse?.pressureScore ?? entry.pulse?.pressure ?? null;
  return <div style={{ padding: '12px 14px', borderRadius: radius.md, backgroundColor: '#0B0F17D0', border: '1px solid #1F263660', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ color: colors.text.primary, fontWeight: 900, fontSize: 13 }}>{entry.symbol}</span><DirectionBadge direction={direction} /><StatusBadge status={status} /></div><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><FreshnessBadge freshness={entry.freshness} /><PressureBar pressure={pressure} /></div></div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 9 }}>
      {entry.pulse?.priceChangePercent != null && <EvidenceValue label="Δ" value={`${entry.pulse.priceChangePercent.toFixed(2)}%`} />}
      {entry.acceleration?.direction && entry.acceleration.direction !== 'UNAVAILABLE' && <EvidenceValue label="ACCEL" value={entry.acceleration.direction} />}
      {entry.pulse?.volumeChangePercent != null && <EvidenceValue label="VOL" value={`${entry.pulse.volumeChangePercent.toFixed(1)}%`} />}
      <EvidenceValue label="OPT" value={optionLabel} />
      <EvidenceValue label="SMART" value={smartLabel} />
    </div>
    {entry.acceleration?.direction && entry.acceleration.direction !== 'UNAVAILABLE' && <div style={{ fontSize: 10, color: colors.text.muted }}>Acceleration: {entry.acceleration.direction}{entry.historySize ? ` (${entry.historySize} samples)` : ''}</div>}
    {entry.opportunity?.warnings?.length > 0 && <div style={{ fontSize: 10, color: '#FBBF24' }}>{entry.opportunity.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>}
    <button onClick={() => setExpanded(!expanded)} style={{ fontSize: 9, color: colors.text.muted, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>{expanded ? '▾ Hide evidence' : '▸ Show evidence'}</button>
    {expanded && <div style={{ fontSize: 10, color: colors.text.muted, fontFamily: 'monospace', lineHeight: 1.6 }}>{entry.evidence?.length > 0 && entry.evidence.map((e, i) => <div key={i}>{e}</div>)}{options && <div>OPTIONS: {JSON.stringify(options)}</div>}{smartMoney && <div>SMART_MONEY: {JSON.stringify(smartMoney)}</div>}</div>}
  </div>;
}

export default function LiveRadar() {
  const [data, setData] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const [symbols, setSymbols] = useState(''); const intervalRef = useRef(null);
  const fetchData = useCallback(async (syms) => { try { const res = await fetch(`/api/live-opportunities?symbols=${encodeURIComponent(syms)}`, { cache: 'no-store' }); const json = await res.json(); if (!json.success) { setError(json.errors?.[0]?.error || json.error || 'Failed to load'); setData([]); } else { setData(json.data || []); setError(null); } } catch (err) { setError(err?.message || 'Network error'); setData([]); } finally { setLoading(false); } }, []);
  const discoverSymbols = useCallback(async () => {
    try {
      const res = await fetch('/api/stocks?limit=10', { cache: 'no-store' });
      const json = await res.json();
      const discovered = Array.isArray(json?.data) ? json.data.map((item) => item?.symbol).filter(Boolean) : [];
      if (discovered.length) {
        const nextSymbols = discovered.join(',');
        setSymbols(nextSymbols);
        return nextSymbols;
      }
    } catch (err) {
      console.warn('Live Radar discovery unavailable:', err?.message || err);
    }
    return '';
  }, []);
  const refresh = useCallback(async () => {
    let syms = symbols;
    if (!syms) syms = await discoverSymbols();
    if (syms) await fetchData(syms);
    else setLoading(false);
  }, [symbols, discoverSymbols, fetchData]);
  useEffect(() => { refresh(); intervalRef.current = setInterval(refresh, 20000); return () => clearInterval(intervalRef.current); }, [refresh]);
  const handleSearch = () => { setLoading(true); clearInterval(intervalRef.current); refresh(); intervalRef.current = setInterval(refresh, 20000); };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}><div><h3 style={{ fontSize: 16, fontWeight: 800, color: colors.accent.cyan, display: 'flex', alignItems: 'center', gap: 8 }}>📡 Live Opportunity Radar</h3><p style={{ fontSize: 11, color: colors.text.muted, marginTop: 4 }}>Market pulse, acceleration, options flow and evidence-gated smart-money layers.</p></div><span style={{ fontSize: 10, padding: '6px 14px', borderRadius: 9999, backgroundColor: '#164E6320', border: '1px solid #22D3EE40', color: colors.accent.cyan, fontWeight: 700 }}>● LIVE RADAR</span></div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="text" value={symbols} onChange={(e) => setSymbols(e.target.value.toUpperCase())} placeholder="Auto-discovering stocks…" style={{ flex: 1, padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: radius.md, color: colors.text.primary, outline: 'none' }} /><button onClick={handleSearch} disabled={loading} style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, backgroundColor: colors.accent.cyan + '20', border: `1px solid ${colors.accent.cyan}40`, borderRadius: radius.md, color: colors.accent.cyan, cursor: loading ? 'wait' : 'pointer' }}>{loading ? '...' : 'Scan'}</button></div>
    <div style={{ ...panel, padding: 20 }}>{loading && data.length === 0 ? <div style={{ fontSize: 11, color: colors.text.muted, padding: '24px 0', textAlign: 'center' }}>⏳ Scanning market data...</div> : error && data.length === 0 ? <div style={{ fontSize: 11, color: '#EF4444', padding: '24px 0', textAlign: 'center' }}>❌ {error}</div> : data.length === 0 ? <div style={{ fontSize: 11, color: colors.text.muted, padding: '24px 0', textAlign: 'center' }}>No opportunities found. Try different symbols.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{data.map((entry) => <OpportunityRow key={entry.symbol} entry={entry} />)}</div>}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1F2636', fontSize: 10, color: colors.text.faint }}>Yahoo market data is polled and may be delayed. Options/flow/smart-money fields are shown only when supplied by an evidence-bearing source; no whale attribution is inferred from price or volume alone.</div>
    </div>
  </div>;
}
