'use client';

import React, { useState, useMemo } from 'react';

const panel = {
  backgroundColor: '#0B0F17',
  border: '1px solid #1F2636',
  borderRadius: '16px',
};

const qualityColor = {
  TOP: '#34D399',
  STRONG: '#FBBF24',
  WATCH: '#F87171',
  WEAK: '#94A3B8',
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
  const setups = data.setups || data.setupClassification || [];
  const zones = data.zones || {
    entryZone: data.entryZone,
    target1: data.target1,
    target2: data.target2,
    invalidation: data.invalidation,
    riskPercent: data.riskPercent,
    rewardPercent: data.rewardPercent,
    stopLoss: data.stopLoss,
  };
  const { swingScore, quality, componentScores, reasons, warnings, flags, dataCompleteness, riskReward, riskPercent, rewardPercent, atr, atrPercentile, bollinger, sma20, sma50, sma200, resistance, support, resistanceDistance, cluster, clusterRange, signal, signalStrength, directionBias, riskLevel } = data;

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
        <ScorePill score={swingScore} label="Swing" />
        <ScorePill score={componentScores?.trend} label="Trend" />
        <ScorePill score={componentScores?.momentum} label="Momentum" />
        <ScorePill score={componentScores?.structure} label="Structure" />
        <ScorePill score={componentScores?.volume} label="Volume" />
        <ScorePill score={componentScores?.rsi} label="RSI" />
        <ScorePill score={componentScores?.bollinger} label="BB" />
        <ScorePill score={componentScores?.riskReward} label="R/R" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {setups?.slice(0, 2).map((setup, idx) => (
          <Tag key={idx} value={setup.type} colorMap={setupStrengthColor} />
        ))}
        {setups?.length > 2 && (
          <Tag value={`+${setups.length - 2} more`} colorMap={setupStrengthColor} />
        )}
        {riskReward != null && (
          <Tag value={`R/R ${riskReward}`} colorMap={riskColor} />
        )}
        {dataCompleteness != null && (
          <Tag value={`Data ${dataCompleteness}%`} colorMap={dataStatusColor} />
        )}
      </div>

      {zones && (
        <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6, lineHeight: 1.6 }}>
          <div>🎯 Entry: {zones.entryZone}</div>
          <div>🎯 T1: {zones.target1} | T2: {zones.target2}</div>
          <div>🛑 Stop: {zones.invalidation} ({zones.riskPercent}% risk / {zones.rewardPercent}% reward)</div>
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

       {data.risks?.length > 0 && (
         <div style={{ fontSize: 9, color: '#FBBF24', marginBottom: 6 }}>
           🔎 {data.risks.slice(0, 2).map(r => `${r.label} (${r.severity})`).join(' • ')}
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
        <div>RSI: {componentScores?.rsi != null ? componentScores.rsi : '—'} | RVOL: {data.relativeVolume ?? '—'}</div>
        <div>SMA20: {sma20 ?? '—'} | SMA50: {sma50 ?? '—'} | SMA200: {sma200 ?? '—'}</div>
        <div>Resistance: {resistance ?? '—'} ({resistanceDistance ?? '—'}%) | Support: {support ?? '—'}</div>
        <div>ATR: {atr ?? '—'} ({atrPercentile ?? '—'}%) | BB: {bollinger?.squeeze ? 'Squeeze' : bollinger?.bandwidth ? bollinger.bandwidth + '%' : '—'}</div>
        <div>Cluster: {cluster ? 'Yes (' + clusterRange + '%)' : 'No'}</div>
        <div>Signal: {signal} ({signalStrength}) | Bias: {directionBias} | Risk: {riskLevel}</div>
      </div>
    </div>
  );
}

function SwingTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>
        لا توجد فرص سوينغ متاحة حالياً.
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
              <td style={{ textAlign: 'center', padding: '8px 6px', color: scoreColor(item.swingScore), fontFamily: 'monospace', fontWeight: 700 }}>
                {item.swingScore ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <Tag value={item.quality} colorMap={qualityColor} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                {item.setups?.slice(0, 2).map((s, i) => (
                  <Tag key={i} value={s.type} colorMap={setupStrengthColor} />
                ))}
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

export default function SwingRadar({ swingData, loading }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('score');

  const data = swingData?.data || [];

  const filteredAndSorted = useMemo(() => {
    let result = data.filter((item) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'top') return item.quality === 'TOP';
      if (activeFilter === 'strong') return item.quality === 'TOP' || item.quality === 'STRONG';
      if (activeFilter === 'watch') return item.quality === 'WATCH';
      if (activeFilter === 'weak') return item.quality === 'WEAK';
      if (activeFilter === 'unavailable') return item.quality === 'UNAVAILABLE';
      if (activeFilter === 'has-setup') return item.setups && item.setups.length > 0;
      if (activeFilter === 'high-rr') return item.riskReward != null && item.riskReward >= 2;
      if (activeFilter === 'high-data') return item.dataCompleteness != null && item.dataCompleteness >= 70;
      return true;
    });

    const compare = (a, b) => {
      if (activeSort === 'score') return (b.swingScore ?? -1) - (a.swingScore ?? -1);
      if (activeSort === 'quality') {
        const qOrder = { TOP: 5, STRONG: 4, WATCH: 3, WEAK: 2, UNAVAILABLE: 1 };
        return (qOrder[b.quality] || 0) - (qOrder[a.quality] || 0);
      }
      if (activeSort === 'rr') return (b.riskReward ?? -1) - (a.riskReward ?? -1);
      if (activeSort === 'data') return (b.dataCompleteness ?? -1) - (a.dataCompleteness ?? -1);
      if (activeSort === 'risk') {
        const rOrder = { LOW: 1, MODERATE: 2, HIGH: 3, EXTREME: 4, UNKNOWN: 0 };
        return (rOrder[a.riskLevel] || 0) - (rOrder[b.riskLevel] || 0);
      }
      return 0;
    };

    return [...result].sort(compare);
  }, [data, activeFilter, activeSort]);

  const topOpportunities = swingData?.top || filteredAndSorted.slice(0, 5);
  const alternatives = swingData?.alternatives || filteredAndSorted.slice(5, 10);

  const filterOptions = [
    { key: 'all', label: 'الكل' },
    { key: 'top', label: 'TOP' },
    { key: 'strong', label: 'STRONG+' },
    { key: 'watch', label: 'WATCH' },
    { key: 'weak', label: 'WEAK' },
    { key: 'has-setup', label: 'بست أب' },
    { key: 'high-rr', label: 'R/R ≥ 2' },
    { key: 'high-data', label: 'Data ≥ 70%' },
    { key: 'unavailable', label: 'UNAVAILABLE' },
  ];

  const sortOptions = [
    { key: 'score', label: 'الدرجة' },
    { key: 'quality', label: 'الجودة' },
    { key: 'rr', label: 'R/R' },
    { key: 'data', label: 'البيانات' },
    { key: 'risk', label: 'المخاطرة' },
  ];

  return (
    <section style={{ ...panel, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#818CF8', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            📊 SWING RADAR · B4
          </div>
          <h3 style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 900, margin: 0 }}>
            محرك الذكاء السوينغ
          </h3>
        </div>
        <div style={{ fontSize: 9, color: '#64748B' }}>
          {data.length} فرص · تم فحص {swingData?.scanned || 0} رمز
        </div>
      </div>

      <p style={{ color: '#64748B', fontSize: 10, marginBottom: 12 }}>
        يعتمد على بيانات Yahoo Finance فقط. لا يتم اختلاق مؤشرات أو بيانات.
        B4 Swing Intelligence Manager يركز على A4: MA50/MA200، RSI، ATR، VWAP،
        دعم/مقاودة، حجم، Bollinger Squeeze، كلاستر سعري.
      </p>

      {/* Top Opportunities */}
      {topOpportunities.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#34D399', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            🏆 أفضل فرص السوينغ
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {topOpportunities.map((item) => (
              <SymbolCard key={item.symbol} symbol={item.symbol} data={item} />
            ))}
          </div>
        </div>
      )}

      {/* Alternatives */}
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

      {/* Filters */}
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
              border: activeFilter === opt.key ? '1px solid #34D399' : '1px solid #1F2636',
              backgroundColor: activeFilter === opt.key ? '#0B0F17' : '#05060D',
              color: activeFilter === opt.key ? '#34D399' : '#94A3B8',
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

      {/* Table */}
      {loading ? (
        <div style={{ color: '#94A3B8', fontSize: 12, padding: 20 }}>⏳ جاري تحميل بيانات السوينغ…</div>
      ) : (
        <SwingTable data={filteredAndSorted} />
      )}

      {/* Data limitations */}
      <div style={{ fontSize: 9, color: '#475569', marginTop: 12, lineHeight: 1.6 }}>
        <div>🚫 لا توجد بيانات Options Chain / Dark Pool / Institutional Flow من Yahoo Finance</div>
        <div>🚫 SMA200 تحسب فقط عند توفر 200 إغلاق تاريخي</div>
        <div>🚫 ATR/VWAP تحسب فقط عند توفر High/Low/Close/Volume</div>
        <div>🚫 رؤوسية/أهداف/إيقاف الخسارة — تحليلية فقط، ليست توصية شراء/بيع</div>
        <div>⚠️ التحليل فقط — ليس توصية شراء/بيع. لا يتم اختراع أو تعديل البيانات.</div>
        <div>© B4 Swing Intelligence Manager — يركز على A4 محرك ذكاء السوينغ</div>
      </div>
    </section>
  );
}