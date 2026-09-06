'use client';

import React, { useMemo, useState } from 'react';
import { buildRiskPlan } from '@/lib/hunter-intelligence';
import { colors, radius } from '@/components/ui/DesignTokens';

const panel = { backgroundColor: '#090A0F', border: '1px solid #1F2636', borderRadius: radius.lg };

export default function HunterRiskDesk({ initialValues = {} }) {
  const { entry: initEntry, stop: initStop, target: initTarget } = initialValues;
  const [capital, setCapital] = useState('10000');
  const [riskPercent, setRiskPercent] = useState('1');
  const [entry, setEntry] = useState(initEntry != null ? String(initEntry) : '20');
  const [stop, setStop] = useState(initStop != null ? String(initStop) : '19');
  const [target, setTarget] = useState(initTarget != null ? String(initTarget) : '23');

  const plan = useMemo(
    () => buildRiskPlan({ capital, riskPercent, entry, stop, target }),
    [capital, riskPercent, entry, stop, target]
  );

  const field = (label, value, setter) => (
    <label style={{ display: 'block', marginBottom: 6 }}>
      <span style={{ color: colors.text.muted, fontSize: 11, display: 'block', marginBottom: 4 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => setter(e.target.value)}
        inputMode="decimal"
        style={{ width: '100%', borderRadius: radius.md, border: '1px solid #1F2636', backgroundColor: '#0B0F17', padding: '10px 12px', color: colors.text.primary, outline: 'none', fontSize: 12 }}
        onFocus={(e) => e.currentTarget.style.borderColor = colors.semantic.success}
        onBlur={(e) => e.currentTarget.style.borderColor = '#1F2636'}
      />
    </label>
  );

  return (
    <section style={{ ...panel, padding: 20, color: colors.text.primary }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, color: colors.semantic.success }}>CAPITAL DEFENSE ENGINE</div>
          <h3 style={{ fontSize: 17, fontWeight: 900, marginTop: 4 }}>🛡️ قبل أي صفقة: كم أخاطر فعلياً؟</h3>
        </div>
        <span style={{ fontSize: 10, color: colors.text.faint }}>أداة حساب — لا تنفذ أوامر تداول.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {field('رأس المال $', capital, setCapital)}
        {field('المخاطرة %', riskPercent, setRiskPercent)}
        {field('الدخول $', entry, setEntry)}
        {field('الوقف $', stop, setStop)}
        {field('الهدف $', target, setTarget)}
      </div>

      {plan.valid ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 16 }}>
          {[
            ['مبلغ المخاطرة', `$${plan.riskAmount}`],
            ['عدد الأسهم', plan.shares],
            ['قيمة المركز', `$${plan.positionValue}`],
            ['R/R', plan.riskReward],
            ['ملاحظة', plan.note],
          ].map(([label, value]) => (
            <div key={label} style={{ borderRadius: radius.md, border: '1px solid #1F2636', backgroundColor: '#0B0F1780', padding: 14 }}>
              <div style={{ fontSize: 10, color: colors.text.faint }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: colors.text.primary, marginTop: 6 }}>{value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 16, borderRadius: radius.md, border: '1px solid #FBBF2440', backgroundColor: '#FBBF2410', padding: 14, fontSize: 11, color: '#FBBF24' }}>
          {plan.error}
        </div>
      )}
    </section>
  );
}
