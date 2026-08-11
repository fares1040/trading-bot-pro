'use client';

import React, { useMemo, useState } from 'react';
import { buildRiskPlan } from '@/lib/hunter-intelligence';

export default function HunterRiskDesk() {
  const [capital, setCapital] = useState('10000');
  const [riskPercent, setRiskPercent] = useState('1');
  const [entry, setEntry] = useState('20');
  const [stop, setStop] = useState('19');
  const [target, setTarget] = useState('23');

  const plan = useMemo(
    () => buildRiskPlan({ capital, riskPercent, entry, stop, target }),
    [capital, riskPercent, entry, stop, target]
  );

  const field = (label, value, setter) => (
    <label className="text-xs text-slate-400">
      <span className="block mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => setter(e.target.value)}
        inputMode="decimal"
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-500"
      />
    </label>
  );

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-[#090A0F] p-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-[10px] font-black tracking-widest text-emerald-400">CAPITAL DEFENSE ENGINE</div>
          <h3 className="text-lg font-black mt-1">🛡️ قبل أي صفقة: كم أخاطر فعلياً؟</h3>
        </div>
        <span className="text-[10px] text-slate-500">أداة حساب — لا تنفذ أوامر تداول.</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {field('رأس المال $', capital, setCapital)}
        {field('المخاطرة %', riskPercent, setRiskPercent)}
        {field('الدخول $', entry, setEntry)}
        {field('الوقف $', stop, setStop)}
        {field('الهدف $', target, setTarget)}
      </div>

      {plan.valid ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          {[
            ['مبلغ المخاطرة', `$${plan.riskAmount}`],
            ['عدد الأسهم', plan.shares],
            ['قيمة المركز', `$${plan.positionValue}`],
            ['R/R', plan.riskReward],
            ['ملاحظة', plan.note],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <div className="text-[10px] text-slate-500">{label}</div>
              <div className="text-sm font-black text-white mt-1">{value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-950/10 p-3 text-xs text-amber-300">
          {plan.error}
        </div>
      )}
    </section>
  );
}
