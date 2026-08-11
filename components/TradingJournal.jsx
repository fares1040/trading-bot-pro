'use client';

import React, { useEffect, useMemo, useState } from 'react';

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

  return (
    <div className="space-y-8 p-6 bg-[#090A0F] text-slate-100 rounded-2xl border border-slate-800">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-xl font-black text-emerald-400">📓 HUNTER Trade Journal</h3>
          <p className="text-xs text-slate-400 mt-1">سجل حقيقي عند توفر Supabase، مع fallback محلي بدون بيانات وهمية.</p>
        </div>
        <button onClick={() => setShowFlexCard(true)} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold border border-slate-700">
          📸 بطاقة الصفقة
        </button>
      </div>

      <form onSubmit={addTrade} className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          ['السهم', ticker, setTicker],
          ['الدخول', entry, setEntry],
          ['الهدف', target, setTarget],
          ['الوقف', stop, setStop],
          ['الثقة', confidence, setConfidence],
        ].map(([label, value, setter]) => (
          <label key={label} className="text-[10px] text-slate-500">
            {label}
            <input value={value} onChange={(e) => setter(e.target.value)} className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-white" />
          </label>
        ))}
        <label className="text-[10px] text-slate-500">
          النوع
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-white">
            <option>Swing</option><option>Breakout</option><option>Momentum</option><option>Reversal</option>
          </select>
        </label>
        <button className="md:col-span-6 rounded-lg bg-emerald-600 text-white py-2 font-black text-xs">+ حفظ الصفقة</button>
      </form>

      {message && <div className="text-xs text-amber-300">{message}</div>}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="text-[10px] text-slate-500">الصفقات</div><strong>{stats.count}</strong></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="text-[10px] text-slate-500">Win Rate</div><strong>{stats.winRate == null ? '—' : `${stats.winRate}%`}</strong></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="text-[10px] text-slate-500">P/L المسجل</div><strong className={stats.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{stats.pnl >= 0 ? '+' : ''}${stats.pnl}</strong></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-slate-800 text-slate-500"><th className="p-2 text-right">السهم</th><th className="p-2 text-right">الدخول</th><th className="p-2 text-right">الهدف</th><th className="p-2 text-right">الوقف</th><th className="p-2 text-right">التاريخ</th></tr></thead>
          <tbody>{trades.slice(0, 20).map((trade) => (
            <tr key={trade.id || trade.created_at} className="border-b border-slate-900">
              <td className="p-2 font-black text-white">{trade.ticker}</td>
              <td className="p-2">${trade.price ?? '—'}</td>
              <td className="p-2">${trade.target_price ?? '—'}</td>
              <td className="p-2">${trade.stop_loss ?? '—'}</td>
              <td className="p-2 text-slate-500">{trade.created_at ? new Date(trade.created_at).toLocaleDateString('ar-SA') : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {showFlexCard && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-950 border border-purple-500/40 p-6 text-center">
            <button onClick={() => setShowFlexCard(false)} className="float-left text-slate-400">✕</button>
            <div className="text-[10px] text-purple-300">HUNTER AI · VERIFIED JOURNAL</div>
            <h3 className="text-xl font-black mt-3">بطاقة إنجاز</h3>
            <p className="text-xs text-slate-400 mt-2">البطاقة تعرض بيانات السجل فقط ولا تنشئ أرباحاً أو نتائج غير موجودة.</p>
            <div className="mt-5 p-4 rounded-xl bg-black border border-slate-800 text-sm">عدد الصفقات: {stats.count}</div>
          </div>
        </div>
      )}
    </div>
  );
}
