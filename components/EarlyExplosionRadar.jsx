'use client';

import React, { useState, useMemo } from 'react';

const panel = {
  backgroundColor: '#0B0F17',
  border: '1px solid #1F2636',
  borderRadius: '16px',
};

const qualityColor = {
  EXTREME: '#EF4444',
  HIGH: '#F87171',
  WATCH: '#FBBF24',
  LOW: '#94A3B8',
  UNAVAILABLE: '#475569',
};

const setupStrengthColor = {
  HIGH: '#34D399',
  MEDIUM: '#FBBF24',
  LOW: '#F87171',
};

const riskColor = {
  LOW: '#34D399',
  MODERATE: '#FBBF24',
  MODERATE_HIGH: '#FB923C',
  HIGH: '#F87171',
  EXTREME: '#EF4444',
  UNKNOWN: '#475569',
};

const dataStatusColor = {
  complete: '#34D399',
  partial: '#FBBF24',
  unavailable: '#475569',
};

const scoreColor = (score) => {
  if (score == null) return '#475569';
  if (score >= 70) return '#34D399';
  if (score >= 50) return '#FBBF24';
  if (score >= 30) return '#F87171';
  return '#475569';
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

function SymbolCard({ symbol, data }) {
  const {
    explosionScore, quality, setupClassification, componentScores, reasons, warnings, flags,
    dataCompleteness, riskReward, riskPercent, rewardPercent, atr, bollinger, rsi, relativeVolume,
    volumeAcceleration, priceExpansion, atrExpansion, bollingerSqueeze, rangeCompression,
    momentumAcceleration, liquidityConfirmation, breakoutProximity, srProximity, signal,
    signalStrength, directionBias, riskLevel, explosionRisk, liquidityRisk, entryZone, target1,
    target2, invalidation,
  } = data;

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
        <ScorePill score={explosionScore} label="Explosion" />
        <ScorePill score={componentScores?.volumeAcceleration} label="Vol Accel" />
        <ScorePill score={componentScores?.relativeVolumeExpansion} label="RVOL" />
        <ScorePill score={componentScores?.priceExpansion} label="Price Exp" />
        <ScorePill score={componentScores?.atrExpansion} label="ATR Exp" />
        <ScorePill score={componentScores?.bollingerSqueeze} label="BB Squeeze" />
        <ScorePill score={componentScores?.momentumAcceleration} label="Momentum" />
        <ScorePill score={componentScores?.liquidityConfirmation} label="Liquidity" />
        <ScorePill score={componentScores?.breakoutProximity} label="Breakout" />
        <ScorePill score={componentScores?.supportResistanceProximity} label="S/R Prox" />
        <ScorePill score={componentScores?.riskReward} label="R/R" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {setupClassification?.slice(0, 2).map((setup, idx) => (
          <Tag key={idx} value={setup.type} colorMap={setupStrengthColor} />
        ))}
        {setupClassification?.length > 2 && (
          <Tag value={`+${setupClassification.length - 2} more`} colorMap={setupStrengthColor} />
        )}
        {riskReward != null && (
          <Tag value={`R/R ${riskReward}`} colorMap={riskColor} />
        )}
        {dataCompleteness != null && (
          <Tag value={`Data ${dataCompleteness}%`} colorMap={dataStatusColor} />
        )}
      </div>

      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6, lineHeight: 1.6 }}>
        <div>🎯 Entry: {entryZone ?? '—'}</div>
        <div>🎯 T1: {target1 ?? '—'} | T2: {target2 ?? '—'}</div>
        <div>🛑 Stop: {invalidation ?? '—'} ({riskPercent ?? '—'}% risk / {rewardPercent ?? '—'}% reward)</div>
      </div>

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
        <div>RSI: {rsi ?? '—'} | RVOL: {relativeVolume ?? '—'} | Vol Accel: {volumeAcceleration ?? '—'}</div>
        <div>Price Exp: {priceExpansion ?? '—'}% | ATR Exp: {atrExpansion ?? '—'}% | BB: {bollinger?.squeeze ? 'Squeeze' : bollinger?.bandwidth ? bollinger.bandwidth + '%' : '—'}</div>
        <div>Range Comp: {rangeCompression ?? '—'}% | Momentum Accel: {momentumAcceleration ?? '—'}</div>
        <div>Liquidity: {liquidityConfirmation ?? '—'} | Breakout: {breakoutProximity ?? '—'}% | S/R: {srProximity ?? '—'}%</div>
        <div>ATR: {atr ?? '—'} | Signal: {signal} ({signalStrength}) | Bias: {directionBias} | Risk: {riskLevel}</div>
        <div>Explosion Risk: {explosionRisk ?? '—'} | Liquidity Risk: {liquidityRisk ?? '—'}</div>
      </div>
    </div>
  );
}

function ExplosionTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>
        لا توجد فرص انفجار مبكر متاحة حالياً.
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
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Setups</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>RVOL</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Vol Accel</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>BB Squeeze</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>R/R</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Risk</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Data %</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Signal</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.symbol} style={{ borderBottom: '1px solid #1F2636' }}>
              <td style={{ padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>{item.symbol || '—'}</td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: scoreColor(item.explosionScore), fontFamily: 'monospace', fontWeight: 700 }}>
                {item.explosionScore ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <Tag value={item.quality} colorMap={qualityColor} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                {item.setupClassification?.slice(0, 2).map((s, i) => (
                  <Tag key={i} value={s.type} colorMap={setupStrengthColor} />
                ))}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>
                {item.relativeVolume ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>
                {item.volumeAcceleration ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.bollinger?.squeeze ? '#34D399' : '#94A3B8', fontFamily: 'monospace' }}>
                {item.bollinger?.squeeze ? 'YES' : 'NO'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: scoreColor(item.riskReward), fontFamily: 'monospace' }}>
                {item.riskReward ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <Tag value={item.riskLevel} colorMap={riskColor} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.dataCompleteness ?? '—'}%
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>
                {item.signal ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EarlyExplosionRadar({ explosionData, loading }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('score');

  const data = explosionData?.data || [];

  const filteredAndSorted = useMemo(() => {
    let result = data.filter((item) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'extreme') return item.quality === 'EXTREME';
      if (activeFilter === 'high') return item.quality === 'EXTREME' || item.quality === 'HIGH';
      if (activeFilter === 'watch') return item.quality === 'WATCH';
      if (activeFilter === 'low') return item.quality === 'LOW';
      if (activeFilter === 'unavailable') return item.quality === 'UNAVAILABLE';
      if (activeFilter === 'has-setup') return item.setupClassification && item.setupClassification.length > 0;
      if (activeFilter === 'high-rr') return item.riskReward != null && item.riskReward >= 2;
      if (activeFilter === 'high-data') return item.dataCompleteness != null && item.dataCompleteness >= 70;
      if (activeFilter === 'bb-squeeze') return item.bollinger?.squeeze === true;
      return true;
    });

    const compare = (a, b) => {
      if (activeSort === 'score') return (b.explosionScore ?? -1) - (a.explosionScore ?? -1);
      if (activeSort === 'quality') {
        const qOrder = { EXTREME: 5, HIGH: 4, WATCH: 3, LOW: 2, UNAVAILABLE: 1 };
        return (qOrder[b.quality] || 0) - (qOrder[a.quality] || 0);
      }
      if (activeSort === 'rr') return (b.riskReward ?? -1) - (a.riskReward ?? -1);
      if (activeSort === 'data') return (b.dataCompleteness ?? -1) - (a.dataCompleteness ?? -1);
      if (activeSort === 'risk') {
        const rOrder = { LOW: 1, LOW_MODERATE: 2, MODERATE: 3, MODERATE_HIGH: 4, HIGH: 5, EXTREME: 6, UNKNOWN: 0 };
        return (rOrder[b.riskLevel] || 0) - (rOrder[a.riskLevel] || 0);
      }
      if (activeSort === 'rvol') return (b.relativeVolume ?? -1) - (a.relativeVolume ?? -1);
      return 0;
    };

    return [...result].sort(compare);
  }, [data, activeFilter, activeSort]);

  const topOpportunities = explosionData?.top || filteredAndSorted.slice(0, 5);
  const alternatives = explosionData?.alternatives || filteredAndSorted.slice(5, 10);

  const filterOptions = [
    { key: 'all', label: 'الكل' },
    { key: 'extreme', label: 'EXTREME' },
    { key: 'high', label: 'HIGH+' },
    { key: 'watch', label: 'WATCH' },
    { key: 'low', label: 'LOW' },
    { key: 'has-setup', label: 'بست أب' },
    { key: 'high-rr', label: 'R/R ≥ 2' },
    { key: 'high-data', label: 'Data ≥ 70%' },
    { key: 'bb-squeeze', label: 'BB Squeeze' },
    { key: 'unavailable', label: 'UNAVAILABLE' },
  ];

  const sortOptions = [
    { key: 'score', label: 'الدرجة' },
    { key: 'quality', label: 'الجودة' },
    { key: 'rr', label: 'R/R' },
    { key: 'data', label: 'البيانات' },
    { key: 'risk', label: 'المخاطرة' },
    { key: 'rvol', label: 'RVOL' },
  ];

  return (
    <section style={{ ...panel, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#EF4444', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            📊 EARLY EXPLOSION RADAR · B5
          </div>
          <h3 style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 900, margin: 0 }}>
            رادار الانفجار المبكر
          </h3>
        </div>
        <div style={{ fontSize: 9, color: '#64748B' }}>
          {data.length} فرص · تم فحص {explosionData?.scanned || 0} رمز
        </div>
      </div>

      <p style={{ color: '#64748B', fontSize: 10, marginBottom: 12 }}>
        يعتمد على بيانات Yahoo Finance فقط. لا يتم اختلاق مؤشرات أو بيانات.
        تسارع الحجم، RVOL، توسع السعر، توسع ATR، ضغط بولينجر، ضغط المدى، تسارع الزخم، تأكيد السيولة، قرب الاختراق، قرب الدعم/المقاومة.
      </p>

      {topOpportunities.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#EF4444', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            🏆 أفضل فرص الانفجار المبكر
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
              border: activeFilter === opt.key ? '1px solid #EF4444' : '1px solid #1F2636',
              backgroundColor: activeFilter === opt.key ? '#0B0F17' : '#05060D',
              color: activeFilter === opt.key ? '#EF4444' : '#94A3B8',
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
        <div style={{ color: '#94A3B8', fontSize: 12, padding: 20 }}>⏳ جاري تحميل بيانات الانفجار المبكر…</div>
      ) : (
        <ExplosionTable data={filteredAndSorted} />
      )}

      <div style={{ fontSize: 9, color: '#475569', marginTop: 12, lineHeight: 1.6 }}>
        <div>🚫 لا توجد بيانات Options Chain / Dark Pool / Institutional Flow من Yahoo Finance</div>
        <div>🚫 ATR تحسب فقط عند توفر High/Low/Close/Volume</div>
        <div>🚫 RVOL يتطلب 10+ أيام حجم تاريخي</div>
        <div>⚠️ التحليل فقط — ليس توصية شراء/بيع</div>
      </div>
    </section>
  );
}
