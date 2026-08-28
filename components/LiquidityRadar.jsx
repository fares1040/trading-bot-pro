'use client';

import React, { useState, useMemo } from 'react';

const panel = {
  backgroundColor: '#0B0F17',
  border: '1px solid #1F2636',
  borderRadius: '16px',
};

const qualityColor = {
  EXCELLENT: '#34D399',
  GOOD: '#22C55E',
  MODERATE: '#FBBF24',
  POOR: '#F87171',
  CRITICAL: '#EF4444',
  UNAVAILABLE: '#475569',
};

const riskColor = {
  MINIMAL: '#34D399',
  LOW: '#22C55E',
  MODERATE: '#FBBF24',
  HIGH: '#F87171',
  CRITICAL: '#EF4444',
};

const scoreColor = (score) => {
  if (score == null) return '#475569';
  if (score >= 85) return '#34D399';
  if (score >= 70) return '#22C55E';
  if (score >= 45) return '#FBBF24';
  if (score >= 25) return '#F87171';
  return '#EF4444';
};

function ScorePill({ score, label }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 55 }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: scoreColor(score), fontFamily: 'monospace' }}>
        {score ?? '—'}
      </div>
      <div style={{ fontSize: 8, color: '#64748B' }}>{label}</div>
    </div>
  );
}

function Tag({ value, colorMap }) {
  const color = colorMap[value] || '#475569';
  return (
    <span
      style={{
        color,
        fontSize: 9,
        fontWeight: 700,
        backgroundColor: color + '1A',
        border: '1px solid ' + color + '40',
        padding: '2px 8px',
        borderRadius: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
      }}
    >
      {value || '—'}
    </span>
  );
}

function SmallTag({ value, color }) {
  if (!value && value !== 0) return null;
  return (
    <span
      style={{
        color: color || '#64748B',
        fontSize: 8,
        fontWeight: 600,
        backgroundColor: (color ? color + '1A' : '#1E293B'),
        border: '1px solid ' + (color ? color + '40' : '#334155'),
        padding: '1px 6px',
        borderRadius: 4,
        letterSpacing: 0.3,
      }}
    >
      {value}
    </span>
  );
}

function SymbolCard({ symbol, data }) {
  const {
    liquidityScore, quality, componentScores,
    dollarVolume, dollarVolumeClass,
    averageVolume20, relativeVolume, volume, price,
    liquidityTraps, liquidityRisk,
    reasons, warnings, flags, dataCompleteness,
    technicalReady, dataAvailability,
  } = data || {};

  return (
    <div
      style={{
        ...panel,
        padding: 14,
        borderRadius: 12,
        minWidth: 280,
        maxWidth: 320,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ color: '#F8FAFC', fontFamily: 'monospace', fontSize: 14 }}>
          {symbol || '—'}
        </strong>
        <Tag value={quality} colorMap={qualityColor} />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <ScorePill score={liquidityScore} label="Liquidity" />
        <ScorePill score={componentScores?.volumeTier} label="Vol Tier" />
        <ScorePill score={componentScores?.dollarVolume} label="$Vol" />
        <ScorePill score={componentScores?.volumeConfirmation} label="Conf" />
        <ScorePill score={componentScores?.liquidityDepth} label="Depth" />
        <ScorePill score={componentScores?.dataCompleteness} label="Data" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {liquidityRisk?.level && (
          <SmallTag value={liquidityRisk.level} color={riskColor[liquidityRisk.level]} />
        )}
        {liquidityTraps?.length > 0 && (
          <SmallTag value={`Traps ${liquidityTraps.length}`} color="#EF4444" />
        )}
        {relativeVolume != null && (
          <SmallTag value={`RVOL ${relativeVolume.toFixed(1)}x`} color="#94A3B8" />
        )}
        {dataCompleteness != null && (
          <SmallTag value={`Data ${dataCompleteness}%`} color="#64748B" />
        )}
      </div>

      {!technicalReady && (
        <div style={{ fontSize: 10, color: '#F87171', marginBottom: 6 }}>
          ⚠️ Market data incomplete
        </div>
      )}

      {price != null && dollarVolume != null && (
        <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6, lineHeight: 1.6 }}>
          💰 ${price.toFixed(2)} · $Vol ${Number((dollarVolume / 1_000_000).toFixed(1))}M · AvgVol ${averageVolume20 != null ? Math.round(averageVolume20 / 1_000).toLocaleString() + 'K' : '—'}
        </div>
      )}

      {reasons?.length > 0 && (
        <div style={{ fontSize: 9, color: '#CBD5E1', marginBottom: 6, lineHeight: 1.5 }}>
          {reasons.slice(0, 3).map((r, i) => (
            <div key={i}>• {r}</div>
          ))}
        </div>
      )}

      {warnings?.length > 0 && (
        <div style={{ fontSize: 9, color: '#F87171', marginBottom: 6 }}>
          ⚠ {warnings.slice(0, 2).join(' • ')}
        </div>
      )}

      {flags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {flags.slice(0, 4).map((f) => (
            <span key={f} style={{ fontSize: 8, color: '#818CF8', backgroundColor: '#1E293B', padding: '1px 6px', borderRadius: 4 }}>
              {f}
            </span>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#64748B', marginTop: 6, lineHeight: 1.6 }}>
        {dataAvailability && (
          <div>
            Data: Price:{dataAvailability.price ? '✓' : '—'} · Volume:{dataAvailability.volume ? '✓' : '—'} ·
            AvgVol:{dataAvailability.averageVolume ? '✓' : '—'} · RVOL:{dataAvailability.relativeVolume ? '✓' : '—'} ·
            BB:{dataAvailability.bollinger ? '✓' : '—'}
          </div>
        )}
      </div>
    </div>
  );
}

function LiquidityTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>
        لا توجد بيانات سيولة متاحة حالياً.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>الرمز</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Score</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Quality</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Risk</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Price</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>$Volume</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>RVOL</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Traps</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Data %</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Flags</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.symbol} style={{ borderBottom: '1px solid #1F2636' }}>
              <td style={{ padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>{item.symbol || '—'}</td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: scoreColor(item.liquidityScore), fontFamily: 'monospace', fontWeight: 700 }}>
                {item.liquidityScore ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <Tag value={item.quality} colorMap={qualityColor} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                {item.liquidityRisk?.level ? (
                  <SmallTag value={item.liquidityRisk.level} color={riskColor[item.liquidityRisk.level]} />
                ) : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.price != null ? '$' + Number(item.price).toFixed(2) : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.dollarVolume != null ? '$' + Number((item.dollarVolume / 1_000_000).toFixed(1)) + 'M' : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.relativeVolume != null ? Number(item.relativeVolume).toFixed(1) + 'x' : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.liquidityTrapCount != null ? item.liquidityTrapCount : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.dataCompleteness ?? 0}%
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                {item.flags?.slice(0, 3).map(f => (
                  <SmallTag key={f} value={f} color="#818CF8" />
                )).reverse() || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LiquidityRadar({ liquidityData, loading }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('score');

  const data = liquidityData?.data || [];
  const topOpportunities = liquidityData?.top || [];
  const alternatives = liquidityData?.alternatives || [];

  const filteredAndSorted = useMemo(() => {
    let result = data.filter((item) => {
      if (activeFilter === 'all') return true;
      if (['EXCELLENT', 'GOOD', 'MODERATE', 'POOR', 'CRITICAL', 'UNAVAILABLE'].includes(activeFilter)) {
        return item.quality === activeFilter;
      }
      if (activeFilter === 'excellent') return item.quality === 'EXCELLENT';
      if (activeFilter === 'good') return item.quality === 'GOOD';
      if (activeFilter === 'po' || activeFilter === 'poor') return item.quality === 'POOR' || item.quality === 'CRITICAL';
      if (activeFilter === 'trap') return item.liquidityTrapCount > 0;
      if (activeFilter === 'highRisk') return item.liquidityRisk?.level === 'HIGH' || item.liquidityRisk?.level === 'CRITICAL';
      if (activeFilter === 'lowLiquidity') return item.liquidityScore != null && item.liquidityScore <= 30;
      if (activeFilter === 'highVol') return item.liquidityRisk != null && item.liquidityRisk.level !== 'MINIMAL' && item.liquidityRisk.level !== 'LOW';
      if (activeFilter === 'lowData') return item.dataCompleteness != null && item.dataCompleteness < 60;
      return true;
    });

    const compare = (a, b) => {
      if (activeSort === 'score') return (b.liquidityScore ?? -1) - (a.liquidityScore ?? -1);
      if (activeSort === 'quality') {
        const qOrder = { EXCELLENT: 5, GOOD: 4, MODERATE: 3, POOR: 2, CRITICAL: 1, UNAVAILABLE: 0 };
        return (qOrder[b.quality] || 0) - (qOrder[a.quality] || 0);
      }
      if (activeSort === 'risk') {
        const rOrder = { MINIMAL: 1, LOW: 2, MODERATE: 3, HIGH: 4, CRITICAL: 5 };
        const ra = rOrder[a.liquidityRisk?.level] || 0;
        const rb = rOrder[b.liquidityRisk?.level] || 0;
        return rb - ra;
      }
      if (activeSort === 'dv') return (b.dollarVolume ?? -1) - (a.dollarVolume ?? -1);
      if (activeSort === 'rvol') return (b.relativeVolume ?? -1) - (a.relativeVolume ?? -1);
      if (activeSort === 'price') return (b.price ?? -1) - (a.price ?? -1);
      if (activeSort === 'trap') return (b.liquidityTrapCount ?? 0) - (a.liquidityTrapCount ?? 0);
      if (activeSort === 'data') return (b.dataCompleteness ?? -1) - (a.dataCompleteness ?? -1);
      return 0;
    };

    return [...result].sort(compare);
  }, [data, activeFilter, activeSort]);

  const filterOptions = [
    { key: 'all', label: 'الكل' },
    { key: 'excellent', label: 'EXCELLENT' },
    { key: 'good', label: 'GOOD' },
    { key: 'moderate', label: 'MODERATE' },
    { key: 'po', label: 'POOR/CRITICAL' },
    { key: 'trap', label: 'Traps' },
    { key: 'highRisk', label: 'High Risk' },
    { key: 'lowLiquidity', label: 'Low Liquidity' },
    { key: 'lowData', label: 'Low Data' },
  ];

  const sortOptions = [
    { key: 'score', label: 'الدرجة' },
    { key: 'quality', label: 'الجودة' },
    { key: 'risk', label: 'المخاطرة' },
    { key: 'dv', label: '$Volume' },
    { key: 'rvol', label: 'RVOL' },
    { key: 'price', label: 'السعر' },
    { key: 'trap', label: 'Traps' },
    { key: 'data', label: 'البيانات' },
  ];

  return (
    <section style={{ ...panel, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#10B981', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            💧 سيولة السوق — LIQUIDITY INTELLIGENCE · A8
          </div>
          <h3 style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 900, margin: 0 }}>
            تحليل جودة السيولة
          </h3>
        </div>
        <div style={{ fontSize: 9, color: '#64748B' }}>
          {data.length} نتيجة · تم فحص {liquidityData?.scanned || 0} رمز
        </div>
      </div>

      <p style={{ color: '#64748B', fontSize: 10, marginBottom: 12 }}>
        يصنف جودة السيولة باستخدام بيانات Yahoo Finance الموجودة. لا يتم اختلاق بيانات.
        يكتشف فخوخ السيولة — ارتفاع حجم غير مدعوم بسيولة حقيقية.
      </p>

      {topOpportunities.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#34D399', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            🏆 أفضل جودة سيولة
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {topOpportunities.map((item) => (
              <SymbolCard key={item.symbol} symbol={item.symbol} data={item} />
            ))}
          </div>
        </div>
      )}

      {alternatives.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#FBBF24', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            📋 بدائل مراقبة
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {alternatives.map((item) => (
              <SymbolCard key={item.symbol} symbol={item.symbol} data={item} />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 9, color: '#64748B', alignSelf: 'center' }}>تصفية:</div>
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setActiveFilter(opt.key)}
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: 8,
              border: activeFilter === opt.key ? '1px solid #10B981' : '1px solid #1F2636',
              backgroundColor: activeFilter === opt.key ? '#0B0F17' : '#05060D',
              color: activeFilter === opt.key ? '#10B981' : '#94A3B8',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
        <div style={{ fontSize: 9, color: '#64748B', alignSelf: 'center', marginLeft: 'auto' }}>
          ترتيب:
        </div>
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setActiveSort(opt.key)}
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: 8,
              border: activeSort === opt.key ? '1px solid #FBBF24' : '1px solid #1F2636',
              backgroundColor: activeSort === opt.key ? '#0B0F17' : '#05060D',
              color: activeSort === opt.key ? '#FBBF24' : '#94A3B8',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#94A3B8', fontSize: 12, padding: 20 }}>⏳ جاري تحميل بيانات السيولة…</div>
      ) : (
        <LiquidityTable data={filteredAndSorted} />
      )}

      <div style={{ fontSize: 9, color: '#475569', marginTop: 12, lineHeight: 1.6 }}>
        <div>🚫 تحليل السيولة ليس توقعًا للأداء المستقبلي</div>
        <div>🚫 لا يتم اختلاق أي قيم — البيانات المفقودة تبقى null</div>
        <div>⚠️ التحليل فقط — ليس توصية شراء/بيع. مصدر البيانات: Yahoo Finance</div>
      </div>
    </section>
  );
}
