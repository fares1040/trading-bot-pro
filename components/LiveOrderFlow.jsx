'use client';

import React, { useEffect, useState } from 'react';

export default function LiveOrderFlow() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const response = await fetch('/api/stocks', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'تعذر تحميل الرادار');

      const data = (json.data || [])
        .filter((item) => Number.isFinite(Number(item.relativeVolume)))
        .sort((a, b) => Number(b.relativeVolume) - Number(a.relativeVolume))
        .slice(0, 6);

      setRows(data);
    } catch (error) {
      console.error('Volume proxy load failed:', error?.message || error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-cyan-300 flex items-center gap-2">
            🐋 رادار نشاط السيولة
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            وكيل فني مبني على RVOL والحجم الحقيقي — وليس Dark Pool أو Options Flow.
          </p>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/40 text-cyan-300">
          ● LIVE TECHNICAL PROXY
        </span>
      </div>

      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-white">⚡ أعلى نشاط نسبي في الرادار</h4>
          <span className="text-[10px] text-amber-300">
            Options / Dark Pool: غير متاح بدون مزود فعلي
          </span>
        </div>

        {loading ? (
          <div className="text-xs text-slate-400 py-6 text-center">⏳ جاري تحديث النشاط...</div>
        ) : !rows.length ? (
          <div className="text-xs text-slate-400 py-6 text-center">لا توجد بيانات نشاط متاحة حالياً.</div>
        ) : (
          <div className="space-y-2 font-mono text-xs">
            {rows.map((row) => (
              <div
                key={row.symbol}
                className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/60 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white font-black">{row.symbol}</span>
                  <span className="text-slate-400">${Number(row.price).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-emerald-400">RVOL {Number(row.relativeVolume).toFixed(2)}x</span>
                  <span className="text-cyan-300">Score {row.setupScore ?? '—'}</span>
                  <span className="text-slate-400">حجم {Number(row.volume || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500">
          هذه قراءة نشاط فني فقط. لا تُفسّر كصفقة مؤسسية أو Dark Pool أو Options Flow.
        </div>
      </div>
    </div>
  );
}
