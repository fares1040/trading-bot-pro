'use client';

import React, { useEffect, useMemo, useState } from 'react';

export default function PaperTradingDesk({ defaultSymbol = 'NVDA' }) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [qty, setQty] = useState('100');
  const [current, setCurrent] = useState(null);
  const [currentPrices, setCurrentPrices] = useState({});
  const [trades, setTrades] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('hunter_paper_trades_v1') || '[]');
      if (Array.isArray(saved)) setTrades(saved);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('hunter_paper_trades_v1', JSON.stringify(trades));
  }, [trades]);

  const loadPrice = async () => {
    const clean = symbol.trim().toUpperCase();
    if (!clean) return;
    setMessage('');
    try {
      const response = await fetch(`/api/market-data?symbol=${encodeURIComponent(clean)}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'تعذر جلب السعر');
      const price = Number(json?.data?.[0]?.price);
      if (!Number.isFinite(price)) throw new Error('السعر الحالي غير متاح');
      setCurrent(price);
      setCurrentPrices((prev) => ({ ...prev, [clean]: price }));
      if (!entry) setEntry(price.toFixed(2));
    } catch (error) {
      setMessage(error?.message || 'تعذر تحديث السعر');
    }
  };

  const openTrade = () => {
    const e = Number(entry), s = Number(stop), t = Number(target), q = Number(qty);
    if (![e, s, t, q].every(Number.isFinite) || e <= 0 || s <= 0 || t <= 0 || q <= 0 || s >= e || t <= e) {
      setMessage('أدخل دخولًا ووقفًا وهدفًا وكمية صالحة.');
      return;
    }
    const trade = {
      id: Date.now(),
      symbol: symbol.trim().toUpperCase(),
      entry: e,
      stop: s,
      target: t,
      qty: Math.floor(q),
      openedAt: new Date().toISOString(),
      status: 'OPEN',
    };
    setTrades((prev) => [trade, ...prev]);
    setMessage('تم فتح صفقة محاكاة فقط.');
  };

  const closeTrade = (id) => {
    setTrades((prev) =>
      prev.map((trade) =>
        trade.id === id
          ? { ...trade, status: 'CLOSED', closedAt: new Date().toISOString(), closePrice: currentPrices[trade.symbol] ?? trade.entry }
          : trade
      )
    );
  };

  const openTrades = trades.filter((trade) => trade.status === 'OPEN');
  const totalPnl = useMemo(
    () =>
      trades.reduce((sum, trade) => {
        const price = trade.status === 'OPEN' ? (currentPrices[trade.symbol] ?? trade.entry) : Number(trade.closePrice ?? trade.entry);
        return sum + (price - trade.entry) * trade.qty;
      }, 0),
    [trades, current]
  );

  return (
    <div style={{ ...styles.panel }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, color: '#FBBF24' }}>🧪 Paper Trading Desk</h3>
          <p style={{ margin: '5px 0 0', color: '#94A3B8', fontSize: 11 }}>
            محاكاة تنفيذ محلية فقط — لا يوجد اتصال بوسيط ولا أوامر حقيقية.
          </p>
        </div>
        <div style={{ color: totalPnl >= 0 ? '#34D399' : '#F87171', fontWeight: 900 }}>
          P/L {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginTop: 18 }}>
        {[
          ['السهم', symbol, setSymbol],
          ['الدخول', entry, setEntry],
          ['الوقف', stop, setStop],
          ['الهدف', target, setTarget],
          ['الكمية', qty, setQty],
        ].map(([label, value, setter]) => (
          <label key={label} style={{ color: '#94A3B8', fontSize: 10 }}>
            {label}
            <input value={value} onChange={(e) => setter(e.target.value)} style={styles.input} />
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button onClick={loadPrice} style={styles.secondary}>تحديث السعر {current ? `$${current.toFixed(2)}` : ''}</button>
        <button onClick={openTrade} style={styles.primary}>فتح محاكاة</button>
      </div>

      {message && <div style={{ marginTop: 10, color: '#FBBF24', fontSize: 11 }}>{message}</div>}

      <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
        {!openTrades.length && <div style={{ color: '#64748B', fontSize: 11 }}>لا توجد صفقات مفتوحة.</div>}
        {trades.slice(0, 8).map((trade) => {
          const price = trade.status === 'OPEN' ? (currentPrices[trade.symbol] ?? trade.entry) : Number(trade.closePrice ?? trade.entry);
          const pnl = (price - trade.entry) * trade.qty;
          return (
            <div key={trade.id} style={styles.trade}>
              <div><b style={{ color: '#F8FAFC' }}>{trade.symbol}</b> · {trade.qty} سهم</div>
              <div style={{ color: pnl >= 0 ? '#34D399' : '#F87171' }}>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</div>
              <div style={{ color: '#94A3B8' }}>{trade.status === 'OPEN' ? 'مفتوحة' : 'مغلقة'}</div>
              {trade.status === 'OPEN' && <button onClick={() => closeTrade(trade.id)} style={styles.secondary}>إغلاق</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  panel: { background: '#0B0F17', border: '1px solid #1F2636', borderRadius: 16, padding: 20, color: '#F8FAFC' },
  input: { display: 'block', width: '100%', marginTop: 5, background: '#07090E', color: '#FFF', border: '1px solid #334155', padding: 9, borderRadius: 8, boxSizing: 'border-box' },
  primary: { background: '#FBBF24', color: '#000', border: 0, padding: '9px 14px', borderRadius: 8, fontWeight: 900, cursor: 'pointer' },
  secondary: { background: '#1E293B', color: '#38BDF8', border: '1px solid #334155', padding: '9px 14px', borderRadius: 8, cursor: 'pointer' },
  trade: { display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center', padding: 10, background: '#07090E', border: '1px solid #1F2636', borderRadius: 10, fontSize: 11 },
};
