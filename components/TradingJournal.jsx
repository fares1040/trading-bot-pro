'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { colors, radius } from '@/components/ui/DesignTokens';

const panel = { backgroundColor: '#090A0F', border: '1px solid #1F2636', borderRadius: radius.lg };

export default function AutoPilotJournalAndReports() {
  const [trades, setTrades] = useState([]);
  const [ticker, setTicker] = useState('');
  const [entry, setEntry] = useState('');
  const [target, setTarget] = useState('');
  const [stop, setStop] = useState('');
  const [confidence, setConfidence] = useState('');
  const [type, setType] = useState('Swing');
  const [message, setMessage] = useState('');
  const [showFlexCard, setShowFlexCard] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/journal', { cache: 'no-store' });
        const json = await response.json();
        if (response.ok && json?.success) {
          setTrades(json.data || []);
          return;
        }
      } catch {}
      try {
        const local = JSON.parse(localStorage.getItem('hunter_journal_v1') || '[]');
        if (Array.isArray(local)) setTrades(local);
      } catch {}
    };
    load();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('hunter_journal_v1', JSON.stringify(trades));
    } catch {}
  }, [trades]);

  const addTrade = async (event) => {
    event.preventDefault();
    const cleanTicker = ticker.trim().toUpperCase();
    const payload = {
      ticker: cleanTicker,
      price: Number(entry),
      target_price: Number(target),
      stop_loss: Number(stop),
      confidence: confidence === '' ? null : Number(confidence),
      option_idea: `${type} | سجل يدوي`,
    };

    if (!/^[A-Z][A-Z0-9.^=-]{0,11}$/.test(cleanTicker) || ![payload.price, payload.target_price, payload.stop_loss].every(Number.isFinite)) {
      setMessage('أدخل رمزًا وأسعارًا صحيحة.');
      return;
    }

    try {
      const response = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) throw new Error(json?.error || 'تعذر حفظ الصفقة');
      setTrades((prev) => [json.data || { ...payload, id: Date.now(), created_at: new Date().toISOString() }, ...prev]);
      setMessage('تم حفظ الصفقة في السجل.');
    } catch (error) {
      const fallback = { ...payload, id: Date.now(), created_at: new Date().toISOString(), status: 'LOCAL' };
      setTrades((prev) => [fallback, ...prev]);
      setMessage(`تم حفظها محلياً: ${error?.message || 'Supabase غير متاح'}`);
    }
    setTicker('');
    setEntry('');
    setTarget('');
    setStop('');
    setConfidence('');
  };

  const stats = useMemo(() => {
    const rows = trades.filter((x) => Number.isFinite(Number(x.price)));
    const withResult = rows.filter((x) => Number.isFinite(Number(x.pnl)));
    const wins = withResult.filter((x) => Number(x.pnl) > 0).length;
    const pnl = withResult.reduce((sum, x) => sum + Number(x.pnl), 0);
    return {
      count: rows.length,
      winRate: withResult.length ? Math.round((wins / withResult.length) * 100) : null,
      pnl: Number(pnl.toFixed(2)),
    };
  }, [trades]);

  const inputStyle = { width: '100%', marginTop: 4, borderRadius: radius.sm, backgroundColor: '#0B0F17', border: '1px solid #1F2636', padding: '8px 10px', color: colors.text.primary, fontSize: 12, outline: 'none' };
  const labelStyle = { display: 'block', fontSize: 10, color: colors.text.muted, marginBottom: 4 };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 16, padding: 16, backgroundColor: '#090A0F', color: colors.text.primary, borderRadius: radius.lg, border: '1px solid #1F2636' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: colors.semantic.success }}>📓 HUNTER Trade Journal</h3>
          <p style={{ fontSize: 11, color: colors.text.muted, marginTop: 4 }}>سجل حقيقي عند توفر Supabase، مع fallback محلي بدون بيانات وهمية.</p>
        </div>
        <button onClick={() => setShowFlexCard(true)} style={{ padding: '8px 16px', backgroundColor: '#1E293B', color: colors.text.primary, borderRadius: radius.md, fontSize: 11, fontWeight: 800, border: '1px solid #334155', cursor: 'pointer' }}>
          📸 بطاقة الصفقة
        </button>
      </div>

      <form onSubmit={addTrade} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {[
          ['السهم', ticker, setTicker],
          ['الدخول', entry, setEntry],
          ['الهدف', target, setTarget],
          ['الوقف', stop, setStop],
          ['الثقة', confidence, setConfidence],
        ].map(([label, value, setter]) => (
          <label key={label} style={labelStyle}>
            {label}
            <input value={value} onChange={(e) => setter(e.target.value)} style={inputStyle} />
          </label>
        ))}
        <label style={labelStyle}>
          النوع
          <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
            <option>Swing</option><option>Breakout</option><option>Momentum</option><option>Reversal</option>
          </select>
        </label>
        <button type="submit" style={{ gridColumn: '1 / -1', borderRadius: radius.md, backgroundColor: colors.semantic.success, color: '#fff', padding: '10px 16px', fontWeight: 900, fontSize: 12, border: 'none', cursor: 'pointer' }}>+ حفظ الصفقة</button>
      </form>

      {message && <div style={{ fontSize: 11, color: '#FBBF24' }}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
        <div style={{ ...panel, padding: 16 }}><div style={{ fontSize: 10, color: colors.text.faint }}>الصفقات</div><strong style={{ fontSize: 20 }}>{stats.count}</strong></div>
        <div style={{ ...panel, padding: 16 }}><div style={{ fontSize: 10, color: colors.text.faint }}>Win Rate</div><strong style={{ fontSize: 20 }}>{stats.winRate == null ? '—' : `${stats.winRate}%`}</strong></div>
        <div style={{ ...panel, padding: 16 }}><div style={{ fontSize: 10, color: colors.text.faint }}>P/L المسجل</div><strong style={{ fontSize: 20, color: stats.pnl >= 0 ? colors.semantic.success : colors.semantic.danger }}>{stats.pnl >= 0 ? '+' : ''}${stats.pnl}</strong></div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${colors.border}`, color: colors.text.faint }}>
              <th style={{ padding: '8px', textAlign: 'right' }}>السهم</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>الدخول</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>الهدف</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>الوقف</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 20).map((trade) => (
              <tr key={trade.id || trade.created_at} style={{ borderBottom: `1px solid ${colors.border}` }}>
                <td style={{ padding: '8px', fontWeight: 900, color: colors.text.primary }}>{trade.ticker}</td>
                <td style={{ padding: '8px' }}>${trade.price ?? '—'}</td>
                <td style={{ padding: '8px' }}>${trade.target_price ?? '—'}</td>
                <td style={{ padding: '8px' }}>${trade.stop_loss ?? '—'}</td>
                <td style={{ padding: '8px', color: colors.text.faint }}>{trade.created_at ? new Date(trade.created_at).toLocaleDateString('ar-SA') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showFlexCard && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000000E0', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 320, borderRadius: radius.lg, backgroundColor: '#0B0F17', border: '1px solid #8B5CF640', padding: 24, textAlign: 'center' }}>
            <button onClick={() => setShowFlexCard(false)} style={{ float: 'left', color: colors.text.muted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
            <div style={{ fontSize: 10, color: '#C4B5FD' }}>HUNTER AI · VERIFIED JOURNAL</div>
            <h3 style={{ fontSize: 18, fontWeight: 900, marginTop: 12 }}>بطاقة إنجاز</h3>
            <p style={{ fontSize: 11, color: colors.text.muted, marginTop: 8 }}>البطاقة تعرض بيانات السجل فقط ولا تنشئ أرباحاً أو نتائج غير موجودة.</p>
            <div style={{ marginTop: 20, padding: 16, borderRadius: radius.md, backgroundColor: '#000', border: '1px solid #1F2636', fontSize: 14 }}>عدد الصفقات: {stats.count}</div>
          </div>
        </div>
      )}
    </div>
  );
}
