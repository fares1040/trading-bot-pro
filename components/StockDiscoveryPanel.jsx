'use client';

import React, { useEffect, useState } from 'react';

const tone = {
  BUY: '#22C55E',
  WATCH: '#FBBF24',
  REJECT: '#EF4444',
};

export default function StockDiscoveryPanel() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/stocks?limit=12', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Discovery unavailable');
        if (active) { setStocks(Array.isArray(json.data) ? json.data : []); setError(null); }
      } catch (e) {
        if (active) setError(e?.message || 'Discovery unavailable');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  return (
    <section style={{ maxWidth: 1600, margin: '0 auto', padding: '0 16px 20px' }}>
      <div style={{ background: '#090A0F', border: '1px solid #1F2636', borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#38BDF8', fontSize: 15, fontWeight: 800 }}>Market Discovery</div>
            <div style={{ color: '#64748B', fontSize: 10, marginTop: 4 }}>Resilient stock universe — shown independently when C7 discovery is unavailable.</div>
          </div>
          <span style={{ color: '#22C55E', fontSize: 10, fontWeight: 800 }}>● DATA CONNECTED</span>
        </div>
        {loading ? (
          <div style={{ color: '#94A3B8', fontSize: 11, padding: 18, textAlign: 'center' }}>Scanning stock universe…</div>
        ) : error && !stocks.length ? (
          <div style={{ color: '#F87171', fontSize: 11, padding: 18, textAlign: 'center' }}>⚠ {error}</div>
        ) : !stocks.length ? (
          <div style={{ color: '#94A3B8', fontSize: 11, padding: 18, textAlign: 'center' }}>No qualifying stocks returned.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
            {stocks.map((stock) => {
              const decision = stock.decision || stock.signal || 'WATCH';
              const color = tone[decision] || '#94A3B8';
              return (
                <div key={stock.symbol} style={{ background: '#0B0F17', border: '1px solid #1F2636', borderRadius: 10, padding: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong style={{ color: '#F8FAFC', fontSize: 13 }}>{stock.symbol}</strong>
                    <span style={{ color, fontSize: 10, fontWeight: 800 }}>{decision === 'BUY' ? '↑' : decision === 'REJECT' ? '↓' : '→'} {decision}</span>
                  </div>
                  <div style={{ color: '#CBD5E1', fontSize: 12, marginTop: 8 }}>${Number(stock.price || 0).toFixed(2)}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: '#64748B', fontSize: 9 }}>
                    <span>Setup {stock.setupScore ?? '—'}</span>
                    <span>RVOL {stock.relativeVolume != null ? Number(stock.relativeVolume).toFixed(2) : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
