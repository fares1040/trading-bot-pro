'use client';

import React, { useState, useMemo } from 'react';

const panel = {
  backgroundColor: '#0B0F17',
  border: '1px solid #1F2636',
  borderRadius: '16px',
};

const qualityColor = {
  TOP: '#34D399',
  STRONG: '#22C55E',
  WATCH: '#FBBF24',
  WEAK: '#F87171',
  UNAVAILABLE: '#475569',
};

const setupTypeColor = {
  BREAKOUT: '#22C55E',
  PULLBACK: '#34D399',
  REVERSAL: '#F87171',
  SQUEEZE: '#818CF8',
  CONTINUATION: '#60A5FA',
  BASE: '#FBBF24',
  MOMENTUM: '#10B981',
  CONSOLIDATION: '#6366F1',
  OTHER: '#64748B',
};

const signalColor = {
  STRONG_BUY: '#34D399',
  BUY: '#22C55E',
  NEUTRAL: '#FBBF24',
  AVOID: '#F87171',
  UNAVAILABLE: '#475569',
};

const scoreColor = (score) => {
  if (score == null) return '#475569';
  if (score >= 85) return '#34D399';
  if (score >= 70) return '#22C55E';
  if (score >= 55) return '#FBBF24';
  if (score >= 40) return '#F87171';
  return '#475569';
};

const dataStatusColor = {
  complete: '#34D399',
  partial: '#FBBF24',
  unavailable: '#475569',
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
    setupScore, quality, componentScores, setupType, setupConfidence,
    signal, reasons, warnings, flags, dataCompleteness,
    price, rsi, relativeVolume, riskReward, bollingerBandwidth,
    technicalReady, dataAvailability,
  } = data || {};

  const typeColor = setupTypeColor[setupType] || '#64748B';

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
        <ScorePill score={setupScore} label="Setup" />
        <ScorePill score={componentScores?.setupStrength} label="Strength" />
        <ScorePill score={componentScores?.volumeConfirmation} label="Volume" />
        <ScorePill score={componentScores?.riskReward} label="R/R" />
        <ScorePill score={componentScores?.technicalReadiness} label="Tech" />
        <ScorePill score={componentScores?.dataCompleteness} label="Data" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <SmallTag value={setupType} color={typeColor} />
        {setupConfidence != null && (
          <SmallTag value={`Conf ${setupConfidence}`} color={typeColor} />
        )}
        {signal && signal !== 'UNAVAILABLE' && (
          <SmallTag value={signal} color={signalColor[signal]} />
        )}
        {dataCompleteness != null && (
          <SmallTag
            value={`Data ${dataCompleteness}%`}
            color={dataStatusColor[dataCompleteness >= 70 ? 'complete' : dataCompleteness >= 40 ? 'partial' : 'unavailable']}
          />
        )}
        {rsi != null && (
          <SmallTag value={`RSI ${rsi.toFixed(1)}`} color="#94A3B8" />
        )}
        {relativeVolume != null && (
          <SmallTag value={`RVOL ${relativeVolume.toFixed(1)}x`} color="#94A3B8" />
        )}
        {riskReward != null && (
          <SmallTag value={`R/R ${riskReward.toFixed(1)}`} color="#94A3B8" />
        )}
      </div>

      {!technicalReady && (
        <div style={{ fontSize: 10, color: '#F87171', marginBottom: 6 }}>
          ⚠️ Technical data incomplete
        </div>
      )}

      {price != null && (
        <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6, lineHeight: 1.6 }}>
          💰 Price: ${price.toFixed(2)} · Bandwidth: {bollingerBandwidth != null ? bollingerBandwidth.toFixed(2) + '%' : '—'}
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
            SMA:{dataAvailability.sma ? '✓' : '—'} · RSI:{dataAvailability.rsi ? '✓' : '—'} ·
            R/R:{dataAvailability.riskReward ? '✓' : '—'}
          </div>
        )}
      </div>
    </div>
  );
}

function SetupTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>
        لا توجد بيانات إعداد تقني متاحة حالياً.
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
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Setup</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Signal</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Price</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>R/R</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>RVOL</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>RSI</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Data %</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Flags</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.symbol} style={{ borderBottom: '1px solid #1F2636' }}>
              <td style={{ padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>{item.symbol || '—'}</td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: scoreColor(item.setupScore), fontFamily: 'monospace', fontWeight: 700 }}>
                {item.setupScore ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <Tag value={item.quality} colorMap={qualityColor} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <SmallTag value={item.setupType} color={setupTypeColor[item.setupType] || '#64748B'} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                {item.signal && item.signal !== 'UNAVAILABLE' ? (
                  <SmallTag value={item.signal} color={signalColor[item.signal]} />
                ) : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.price != null ? '$' + Number(item.price).toFixed(2) : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.riskReward != null ? Number(item.riskReward).toFixed(2) : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.relativeVolume != null ? Number(item.relativeVolume).toFixed(1) + 'x' : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.rsi != null ? Number(item.rsi).toFixed(1) : '—'}
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

export default function SetupRadar({ setupData, loading }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('score');

  const data = setupData?.data || [];
  const topOpportunities = setupData?.top || [];
  const alternatives = setupData?.alternatives || [];

  const filteredAndSorted = useMemo(() => {
    let result = data.filter((item) => {
      if (activeFilter === 'all') return true;
      if (['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'].includes(activeFilter)) {
        return item.quality === activeFilter;
      }
      if (activeFilter === 'signal') return item.signal && item.signal !== 'UNAVAILABLE' && item.signal !== 'NEUTRAL';
      if (['BREAKOUT', 'PULLBACK', 'REVERSAL', 'SQUEEZE', 'CONTINUATION', 'BASE', 'MOMENTUM', 'CONSOLIDATION'].includes(activeFilter)) {
        return item.setupType === activeFilter;
      }
      if (activeFilter === 'highRr') return item.riskReward != null && item.riskReward >= 2;
      if (activeFilter === 'sqz') return item.squeeze === true;
      if (activeFilter === 'lowData') return item.dataCompleteness != null && item.dataCompleteness < 60;
      return true;
    });

    const compare = (a, b) => {
      if (activeSort === 'score') return (b.setupScore ?? -1) - (a.setupScore ?? -1);
      if (activeSort === 'quality') {
        const qOrder = { TOP: 5, STRONG: 4, WATCH: 3, WEAK: 2, UNAVAILABLE: 1 };
        return (qOrder[b.quality] || 0) - (qOrder[a.quality] || 0);
      }
      if (activeSort === 'setup') return (b.setupConfidence ?? -1) - (a.setupConfidence ?? -1);
      if (activeSort === 'rr') return (b.riskReward ?? -1) - (a.riskReward ?? -1);
      if (activeSort === 'rvol') return (b.relativeVolume ?? -1) - (a.relativeVolume ?? -1);
      if (activeSort === 'data') return (b.dataCompleteness ?? -1) - (a.dataCompleteness ?? -1);
      if (activeSort === 'price') return (b.price ?? -1) - (a.price ?? -1);
      return 0;
    };

    return [...result].sort(compare);
  }, [data, activeFilter, activeSort]);

  const filterOptions = [
    { key: 'all', label: 'الكل' },
    { key: 'TOP', label: 'TOP' },
    { key: 'STRONG', label: 'STRONG' },
    { key: 'WATCH', label: 'WATCH' },
    { key: 'WEAK', label: 'WEAK' },
    { key: 'UNAVAILABLE', label: 'UNAVAILABLE' },
    { key: 'BREAKOUT', label: 'Breakout' },
    { key: 'PULLBACK', label: 'Pullback' },
    { key: 'REVERSAL', label: 'Reversal' },
    { key: 'SQUEEZE', label: 'Squeeze' },
    { key: 'CONTINUATION', label: 'Continuation' },
    { key: 'BASE', label: 'Base' },
    { key: 'MOMENTUM', label: 'Momentum' },
    { key: 'CONSOLIDATION', label: 'Consolidation' },
    { key: 'signal', label: 'Signal Active' },
    { key: 'highRr', label: 'High R/R' },
    { key: 'lowData', label: 'Low Data' },
  ];

  const sortOptions = [
    { key: 'score', label: 'الدرجة' },
    { key: 'quality', label: 'الجودة' },
    { key: 'setup', label: 'Setup Conf' },
    { key: 'rr', label: 'R/R' },
    { key: 'rvol', label: 'RVOL' },
    { key: 'data', label: 'البيانات' },
    { key: 'price', label: 'السعر' },
  ];

  return (
    <section style={{ ...panel, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#10B981', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            📊 TECHNICAL SETUP INTELLIGENCE · A7
          </div>
          <h3 style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 900, margin: 0 }}>
            رادار إعدادات التداول الفنية
          </h3>
        </div>
        <div style={{ fontSize: 9, color: '#64748B' }}>
          {data.length} نتيجة · تم فحص {setupData?.scanned || 0} رمز
        </div>
      </div>

      <p style={{ color: '#64748B', fontSize: 10, marginBottom: 12 }}>
        يصنف إعدادات التداول باستخدام بيانات Yahoo Finance الموجودة. لا يتم اختلاق بيانات. إعدادات محتمة (BREAKOUT, PULLBACK, REVERSAL, SQUEEZE, CONTINUATION, BASE, MOMENTUM, CONSOLIDATION).
      </p>

      {topOpportunities.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#10B981', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            🏆 أفضل فرص الإعدادات الفنية
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
        <div style={{ color: '#94A3B8', fontSize: 12, padding: 20 }}>⏳ جاري تحميل بيانات إعدادات التداول…</div>
      ) : (
        <SetupTable data={filteredAndSorted} />
      )}

      <div style={{ fontSize: 9, color: '#475569', marginTop: 12, lineHeight: 1.6 }}>
        <div>🚫 التصنيف الإعدادي ليس توقعًا للأداء المستقبلي</div>
        <div>🚫 لا يتم اختلاق أي قيم — البيانات المفقودة تبقى null</div>
        <div>⚠️ التحليل فقط — ليس توصية شراء/بيع. مصدر البيانات: Yahoo Finance</div>
      </div>
    </section>
  );
}
