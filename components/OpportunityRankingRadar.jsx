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

const scoreColor = (score) => {
  if (score == null) return '#475569';
  if (score >= 85) return '#34D399';
  if (score >= 70) return '#22C55E';
  if (score >= 55) return '#FBBF24';
  if (score >= 40) return '#F87171';
  return '#475569';
};

const confidenceColor = {
  HIGH: '#34D399',
  MODERATE: '#22C55E',
  LOW: '#F87171',
  VERY_LOW: '#EF4444',
  UNKNOWN: '#475569',
};

const sourceColor = {
  pennyIntelligence: '#22C55E',
  optionsIntelligence: '#818CF8',
  institutionalRadar: '#A78BFA',
  swingIntelligence: '#34D399',
  earlyExplosion: '#FBBF24',
  catalystIntelligence: '#EC4899',
};

function ScorePill({ score, label }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 50 }}>
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
  if (!value) return null;
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
    opportunityScore, quality, rank, confidence, confidenceLevel,
    componentScores, availableComponents, dataCompleteness,
    reasons, warnings, flags, risks,
    sourceScores, dataAvailability, provenance,
  } = data || {};

  return (
    <div
      style={{
        ...panel,
        padding: 14,
        borderRadius: 12,
        minWidth: 280,
        maxWidth: 340,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ color: '#F8FAFC', fontFamily: 'monospace', fontSize: 14 }}>
          {symbol || '—'}
        </strong>
        <Tag value={quality} colorMap={qualityColor} />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <ScorePill score={opportunityScore} label="Opp Score" />
        <ScorePill score={confidence} label="Confidence" />
        <ScorePill score={dataCompleteness} label="Data %" />
        <div style={{ textAlign: 'center', minWidth: 50 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#CBD5E1', fontFamily: 'monospace' }}>
            #{rank ?? '—'}
          </div>
          <div style={{ fontSize: 8, color: '#64748B' }}>Rank</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <SmallTag value={confidenceLevel} color={confidenceColor[confidenceLevel] || '#64748B'} />
        {availableComponents && availableComponents.length > 0 && (
          <SmallTag value={`${availableComponents.length}/6 sources`} color="#CBD5E1" />
        )}
      </div>

      {/* Component scores */}
      {componentScores && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {Object.entries(componentScores).map(([key, val]) => {
            if (val == null) return null;
            return (
              <SmallTag
                key={key}
                value={`${key.replace(/Score$/, '')}: ${val}`}
                color={sourceColor[key.replace(/Score$/, '')] || '#64748B'}
              />
            );
          })}
        </div>
      )}

      {/* Source scores */}
      {sourceScores && Object.keys(sourceScores).length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {Object.entries(sourceScores).map(([key, val]) => (
            <SmallTag key={key} value={val} color={sourceColor[key] || '#64748B'} />
          ))}
        </div>
      )}

      {/* Data availability */}
      {dataAvailability && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {Object.entries(dataAvailability).map(([key, val]) => (
            <SmallTag
              key={key}
              value={`${key.slice(0, 4)}: ${val ? '✓' : '—'}`}
              color={val ? '#34D399' : '#475569'}
            />
          ))}
        </div>
      )}

      {/* Reasons */}
      {reasons && reasons.length > 0 && (
        <div style={{ fontSize: 9, color: '#CBD5E1', marginBottom: 6, lineHeight: 1.5 }}>
          {reasons.slice(0, 3).map((r, i) => (
            <div key={i}>• {r}</div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div style={{ fontSize: 9, color: '#F87171', marginBottom: 6 }}>
          ⚠ {warnings.slice(0, 3).join(' • ')}
        </div>
      )}

      {/* Flags */}
      {flags && flags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {flags.slice(0, 5).map((f) => (
            <span key={f} style={{ fontSize: 8, color: '#818CF8', backgroundColor: '#1E293B', padding: '1px 6px', borderRadius: 4 }}>
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Risks */}
      {risks && risks.length > 0 && risks.slice(0, 2).map((r, i) => (
        <div key={i} style={{ fontSize: 9, color: '#F59E0B', marginBottom: 4, lineHeight: 1.4 }}>
          ⚠️ [{r.severity}] {r.label}: {r.description}
        </div>
      ))}

      {/* Provenance */}
      <div style={{ fontSize: 8, color: '#475569', marginTop: 8, lineHeight: 1.6 }}>
        الذكاء: {provenance?.intelligence || '—'} · المحرك: {provenance?.engine || '—'}
      </div>
    </div>
  );
}

function OpportunityTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>
        لا توجد بيانات فرص التداول المتاحة حالياً.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>الرمز</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Opp Score</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Quality</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Rank</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Confidence</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Data %</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Sources</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Penny</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Options</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Inst</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Swing</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Explosion</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Catalyst</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Flags</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.symbol} style={{ borderBottom: '1px solid #1F2636' }}>
              <td style={{ padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>{item.symbol || '—'}</td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: scoreColor(item.opportunityScore), fontFamily: 'monospace', fontWeight: 700 }}>
                {item.opportunityScore ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <Tag value={item.quality} colorMap={qualityColor} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace', fontWeight: 700 }}>
                {item.rank ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <SmallTag value={item.confidenceLevel} color={confidenceColor[item.confidenceLevel] || '#64748B'} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.dataCompleteness ?? 0}%
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8' }}>
                {item.availableComponents?.length || 0}/6
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.sourceScores?.pennyIntelligence != null ? scoreColor(item.sourceScores.pennyIntelligence) : '#475569', fontFamily: 'monospace' }}>
                {item.sourceScores?.pennyIntelligence ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.sourceScores?.optionsIntelligence != null ? scoreColor(item.sourceScores.optionsIntelligence) : '#475569', fontFamily: 'monospace' }}>
                {item.sourceScores?.optionsIntelligence ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.sourceScores?.institutionalRadar != null ? scoreColor(item.sourceScores.institutionalRadar) : '#475569', fontFamily: 'monospace' }}>
                {item.sourceScores?.institutionalRadar ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.sourceScores?.swingIntelligence != null ? scoreColor(item.sourceScores.swingIntelligence) : '#475569', fontFamily: 'monospace' }}>
                {item.sourceScores?.swingIntelligence ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.sourceScores?.earlyExplosion != null ? scoreColor(item.sourceScores.earlyExplosion) : '#475569', fontFamily: 'monospace' }}>
                {item.sourceScores?.earlyExplosion ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.sourceScores?.catalystIntelligence != null ? scoreColor(item.sourceScores.catalystIntelligence) : '#475569', fontFamily: 'monospace' }}>
                {item.sourceScores?.catalystIntelligence ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                {item.flags?.slice(0, 3).map(f => (
                  <SmallTag key={f} value={f} color="#818CF8" />
                )) || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AvailabilityBar({ opportunityData }) {
  if (!opportunityData || !opportunityData.dataAvailability) return null;

  const da = opportunityData.dataAvailability;
  const sourceLabels = [
    { key: 'pennyIntelligence', label: 'B1 Penny' },
    { key: 'optionsIntelligence', label: 'B2 Options' },
    { key: 'institutionalRadar', label: 'B3 Institutional' },
    { key: 'swingIntelligence', label: 'B4 Swing' },
    { key: 'earlyExplosion', label: 'B5 Explosion' },
    { key: 'catalystIntelligence', label: 'B6 Catalyst' },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      {sourceLabels.map((src) => (
        <span
          key={src.key}
          style={{
            fontSize: 9,
            color: da[src.key] ? '#34D399' : '#475569',
            backgroundColor: da[src.key] ? '#142E1C' : '#1E293B',
            border: '1px solid ' + (da[src.key] ? '#14532D' : '#334155'),
            padding: '4px 10px',
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          {src.label}: {da[src.key] ? '✓' : '✗'}
        </span>
      ))}
    </div>
  );
}

export default function OpportunityRankingRadar({ opportunityData, loading }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('score');

  const data = opportunityData?.data || [];
  const topOpportunities = opportunityData?.top || [];
  const alternatives = opportunityData?.alternatives || [];
  const qualityBreakdown = opportunityData?.qualityBreakdown || {};

  const filteredAndSorted = useMemo(() => {
    let result = data.filter((item) => {
      if (!item) return false;
      if (activeFilter === 'all') return true;

      const filterMap = {
        TOP: () => item.quality === 'TOP',
        STRONG: () => item.quality === 'STRONG',
        WATCH: () => item.quality === 'WATCH',
        WEAK: () => item.quality === 'WEAK',
        UNAVAILABLE: () => item.quality === 'UNAVAILABLE',
        VERIFIED: () => item.confidenceLevel === 'HIGH' || item.confidenceLevel === 'MODERATE',
        HIGH_CONFIDENCE: () => item.confidenceLevel === 'HIGH',
        RECENT: () => item.rank <= 10,
        CATALYST: () => item.dataAvailability?.catalystIntelligence === true,
        INSTITUTIONAL: () => item.dataAvailability?.institutionalRadar === true,
        FULL_COVERAGE: () => item.availableComponents?.length === 6,
        NO_CATALYST: () => item.dataAvailability?.catalystIntelligence === false,
      };

      const check = filterMap[activeFilter];
      return check ? check() : true;
    });

    const compare = (a, b) => {
      if (activeSort === 'score') {
        const sa = a.opportunityScore ?? -1;
        const sb = b.opportunityScore ?? -1;
        if (sa === -1 && sb !== -1) return 1;
        if (sb === -1 && sa !== -1) return -1;
        if (sb !== sa) return sb - sa;
        const da = a.dataCompleteness ?? 0;
        const db = b.dataCompleteness ?? 0;
        return db - da;
      }
      if (activeSort === 'quality') {
        const qOrder = { TOP: 5, STRONG: 4, WATCH: 3, WEAK: 2, UNAVAILABLE: 1 };
        const qa = qOrder[a.quality] || 0;
        const qb = qOrder[b.quality] || 0;
        if (qb !== qa) return qb - qa;
        return (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1);
      }
      if (activeSort === 'rank') {
        return (a.rank ?? 999) - (b.rank ?? 999);
      }
      if (activeSort === 'confidence') {
        const ord = { HIGH: 4, MODERATE: 3, LOW: 2, VERY_LOW: 1, UNKNOWN: 0 };
        const sa = ord[a.confidenceLevel] || 0;
        const sb = ord[b.confidenceLevel] || 0;
        if (sb !== sa) return sb - sa;
        return (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1);
      }
      if (activeSort === 'data_completeness') {
        const da = a.dataCompleteness ?? 0;
        const db = b.dataCompleteness ?? 0;
        return db - da;
      }
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
    { key: 'VERIFIED', label: 'Verified' },
    { key: 'HIGH_CONFIDENCE', label: 'High Conf' },
    { key: 'INSTITUTIONAL', label: 'Institutional' },
    { key: 'CATALYST', label: 'Catalyst' },
    { key: 'FULL_COVERAGE', label: 'Full Coverage' },
  ];

  const sortOptions = [
    { key: 'score', label: 'الدرجة' },
    { key: 'quality', label: 'الجودة' },
    { key: 'rank', label: 'الترتيب' },
    { key: 'confidence', label: 'Confidence' },
    { key: 'data_completeness', label: 'البيانات' },
  ];

  return (
    <section style={{ ...panel, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#8B5CF6', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            🎯 OPPORTUNITY RANKING · C7
          </div>
          <h3 style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 900, margin: 0 }}>
            تصنيف فرص التداول (Opportunity Ranking)
          </h3>
        </div>
        <div style={{ fontSize: 9, color: '#64748B' }}>
          {data.length} نتيق · تم فحص {opportunityData?.scanned || 0} رمز
        </div>
      </div>

      <p style={{ color: '#64748B', fontSize: 10, marginBottom: 12 }}>
        تصنيف موحد للفرص بناءً على 6 مصادر ذكاء (B1–B6). الدرجة = وزن مركّز للبيانات المتاحة — ليس متوسط بسيط. لا يتم اختلالق بيانات.
      </p>

      {opportunityData && opportunityData.dataAvailability && (
        <AvailabilityBar opportunityData={opportunityData} />
      )}

      {/* Quality Breakdown */}
      {qualityBreakdown && Object.keys(qualityBreakdown).length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          {Object.entries(qualityBreakdown).map(([q, count]) => (
            <div key={q} style={{ textAlign: 'center', minWidth: 60 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: qualityColor[q] || '#475569' }}>{count}</div>
              <div style={{ fontSize: 9, color: '#64748B' }}>{q}</div>
            </div>
          ))}
        </div>
      )}

      {topOpportunities.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#8B5CF6', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            ⚡ أفضل فرص التداول
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
              border: activeFilter === opt.key ? '1px solid #8B5CF6' : '1px solid #1F2636',
              backgroundColor: activeFilter === opt.key ? '#0B0F17' : '#05060D',
              color: activeFilter === opt.key ? '#8B5CF6' : '#94A3B8',
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
        <div style={{ color: '#94A3B8', fontSize: 12, padding: 20 }}>⏳ جاري تحميل فرص التداول…</div>
      ) : filteredAndSorted.length === 0 ? (
        <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>
          لا توجد أسهم مطابقة لمعايير التصفية المحددة.
        </div>
      ) : (
        <OpportunityTable data={filteredAndSorted} />
      )}

      <div style={{ fontSize: 9, color: '#475569', marginTop: 12, lineHeight: 1.6 }}>
        <div>⚠️ الدرجة ليست توقعًا لسعر أو توصية شراء/بيع</div>
        <div>⚠️ Intelligence sources (B1-B6) are evidence providers — never averaged</div>
        <div>⚠️ Missing sources result in null component scores — never fabricated</div>
        <div>⚠️ التحليل فقط — ليس توصية شراء/بيع. مصادر البيانات: SEC EDGAR و Yahoo Finance.</div>
      </div>
    </section>
  );
}
