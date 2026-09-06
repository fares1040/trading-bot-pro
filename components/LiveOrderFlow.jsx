'use client';

import React, { useEffect, useState } from 'react';
import { colors, radius } from '@/components/ui/DesignTokens';

const panel = { backgroundColor: '#090A0F', border: '1px solid #1F2636', borderRadius: radius.lg };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.accent.cyan, display: 'flex', alignItems: 'center', gap: 8 }}>
            🐋 رادار نشاط السيولة
          </h3>
          <p style={{ fontSize: 11, color: colors.text.muted, marginTop: 4 }}>
            وكيل فني مبني على RVOL والحجم الحقيقي — وليس Dark Pool أو Options Flow.
          </p>
        </div>
        <span style={{ fontSize: 10, padding: '6px 14px', borderRadius: 9999, backgroundColor: '#164E6320', border: '1px solid #22D3EE40', color: colors.accent.cyan, fontWeight: 700 }}>
          ● LIVE TECHNICAL PROXY
        </span>
      </div>

      <div style={{ ...panel, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: colors.text.primary }}>⚡ أعلى نشاط نسبي في الرادار</h4>
          <span style={{ fontSize: 10, color: '#FBBF24' }}>
            Options / Dark Pool: غير متاح بدون مزود فعلي
          </span>
        </div>

        {loading ? (
          <div style={{ fontSize: 11, color: colors.text.muted, padding: '24px 0', textAlign: 'center' }}>⏳ جاري تحديث النشاط...</div>
        ) : !rows.length ? (
          <div style={{ fontSize: 11, color: colors.text.muted, padding: '24px 0', textAlign: 'center' }}>لا توجد بيانات نشاط متاحة حالياً.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'monospace', fontSize: 11 }}>
            {rows.map((row) => (
              <div
                key={row.symbol}
                style={{ padding: '12px 14px', borderRadius: radius.md, backgroundColor: '#0B0F17D0', border: '1px solid #1F263660', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: colors.text.primary, fontWeight: 900 }}>{row.symbol}</span>
                  <span style={{ color: colors.text.muted }}>${Number(row.price).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ color: colors.semantic.success }}>RVOL {Number(row.relativeVolume).toFixed(2)}x</span>
                  <span style={{ color: colors.accent.cyan }}>Score {row.setupScore ?? '—'}</span>
                  <span style={{ color: colors.text.muted }}>حجم {Number(row.volume || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1F2636', fontSize: 10, color: colors.text.faint }}>
          هذه قراءة نشاط فني فقط. لا تُفسّر كصفقة مؤسسية أو Dark Pool أو Options Flow.
        </div>
      </div>
    </div>
  );
}
