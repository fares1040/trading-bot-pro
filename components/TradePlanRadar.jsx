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

const signalColor = {
  STRONG_PLAN: '#34D399',
  VALID_PLAN: '#22C55E',
  WATCH: '#FBBF24',
  AVOID: '#F87171',
  UNAVAILABLE: '#475569',
};

const directionColor = {
  LONG: '#34D399',
  SHORT: '#F87171',
  NEUTRAL: '#FBBF24',
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
  setupQuality: '#22C55E',
  riskRewardQuality: '#FBBF24',
  technicalReadiness: '#38BDF8',
  opportunityScore: '#818CF8',
  catalystFlowSupport: '#EC4899',
  dataCompleteness: '#94A3B8',
};

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

function LevelRow({ label, value, fallback }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10, color: '#CBD5E1', lineHeight: 1.7 }}>
      <span style={{ color: '#64748B' }}>{label}</span>
      <span style={{ color: value != null ? '#F8FAFC' : '#475569', fontFamily: 'monospace', fontWeight: 700 }}>
        {value ?? fallback ?? '—'}
      </span>
    </div>
  );
}

function SymbolCard({ symbol, data }) {
  const {
    planScore, planQuality, planSignal, direction, setup,
    entryZone, entryPrice, stopLoss, target1, target2, invalidation,
    riskReward, riskAmount, rewardAmount,
    confidence, confidenceLevel,
    supportingEvidence, risks, warnings, flags,
    componentScores, dataAvailability, provenance,
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
        <Tag value={planQuality} colorMap={qualityColor} />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <ScorePill score={planScore} label="Plan Score" />
        <ScorePill score={confidence} label="Confidence" />
        <div style={{ textAlign: 'center', minWidth: 50 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: directionColor[direction], fontFamily: 'monospace' }}>
            {direction || '—'}
          </div>
          <div style={{ fontSize: 8, color: '#64748B' }}>الاتجاه</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <Tag value={planSignal} colorMap={signalColor} />
        {setup && <SmallTag value={setup} color="#CBD5E1" />}
        {riskReward != null && (
          <SmallTag
            value={'R/R ' + riskReward}
            color={riskReward >= 2 ? '#34D399' : riskReward >= 1 ? '#FBBF24' : '#F87171'}
          />
        )}
      </div>

      <div style={{ background: '#07090E', borderRadius: 8, padding: 8, marginBottom: 8 }}>
        <LevelRow label="Entry Zone" value={entryZone} fallback="—" />
        <LevelRow label="Stop Loss" value={stopLoss} fallback="—" />
        <LevelRow label="Target 1" value={target1} fallback="—" />
        <LevelRow label="Target 2" value={target2} fallback="—" />
        <LevelRow label="Invalidation" value={invalidation} fallback="—" />
        <LevelRow label="Risk Amt" value={riskAmount} fallback="—" />
        <LevelRow label="Reward Amt" value={rewardAmount} fallback="—" />
      </div>

      {componentScores && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {Object.entries(componentScores).map(([key, val]) => {
            if (val == null) return null;
            return (
              <SmallTag
                key={key}
                value={key.replace(/Quality$/, '') + ': ' + val}
                color={sourceColor[key] || '#64748B'}
              />
            );
          })}
        </div>
      )}

      {dataAvailability && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {Object.entries(dataAvailability).map(([key, val]) => (
            <SmallTag
              key={key}
              value={key.slice(0, 4) + ': ' + (val ? '✓' : '—')}
              color={val ? '#34D399' : '#475569'}
            />
          ))}
        </div>
      )}

      {supportingEvidence && supportingEvidence.length > 0 && (
        <div style={{ fontSize: 9, color: '#CBD5E1', marginBottom: 6, lineHeight: 1.5 }}>
          {supportingEvidence.slice(0, 3).map((e, i) => (
            <div key={i}>• {e.label}: {e.score} {e.weight != null ? '(w ' + e.weight + ')' : ''}</div>
          ))}
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div style={{ fontSize: 9, color: '#F87171', marginBottom: 6 }}>
          {warnings.slice(0, 3).join(' • ')}
        </div>
      )}

      {risks && risks.length > 0 && risks.slice(0, 2).map((r, i) => (
        <div key={i} style={{ fontSize: 9, color: '#F59E0B', marginBottom: 4, lineHeight: 1.4 }}>
          [{r.severity}] {r.label}: {r.description}
        </div>
      ))}

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
        لا توجد خطط تداول متاحة حالياً.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>الرمز</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Plan Score</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>الجودة</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Signal</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>الاتجاه</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Setup</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Stop</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Target 1</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>R/R</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Confidence</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>البيانات</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Line</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Flags</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.symbol} style={{ borderBottom: '1px solid #1F2636' }}>
              <td style={{ padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>{item.symbol || '—'}</td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: scoreColor(item.planScore), fontFamily: 'monospace', fontWeight: 700 }}>
                {item.planScore ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <Tag value={item.planQuality} colorMap={qualityColor} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <Tag value={item.planSignal} colorMap={signalColor} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: directionColor[item.direction] || '#475569', fontFamily: 'monospace', fontWeight: 700 }}>
                {item.direction || '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#CBD5E1' }}>{item.setup || '—'}</td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.stopLoss != null ? '#F8FAFC' : '#475569', fontFamily: 'monospace' }}>
                {item.stopLoss ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.target1 != null ? '#34D399' : '#475569', fontFamily: 'monospace' }}>
                {item.target1 ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.riskReward != null ? scoreColor(item.riskReward * 25) : '#475569', fontFamily: 'monospace', fontWeight: 700 }}>
                {item.riskReward ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <SmallTag value={item.confidenceLevel} color={confidenceColor[item.confidenceLevel] || '#64748B'} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.dataCompleteness ?? 0}%
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
    { key: 'opportunityRanking', label: 'C7 Opp' },
    { key: 'swingIntelligence', label: 'B4 Swing' },
    { key: 'earlyExplosion', label: 'B5 Expl' },
    { key: 'optionsIntelligence', label: 'B2 Opt' },
    { key: 'institutionalRadar', label: 'B3 Inst' },
    { key: 'catalystIntelligence', label: 'B6 Cat' },
    { key: 'pennyIntelligence', label: 'B1 Penny' },
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

function QualityBreakdown({ breakdown }) {
  if (!breakdown || Object.keys(breakdown).length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
      {Object.entries(breakdown).map(([q, count]) => (
        <div key={q} style={{ textAlign: 'center', minWidth: 60 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: qualityColor[q] || '#475569' }}>{count}</div>
          <div style={{ fontSize: 9, color: '#64748B' }}>{q}</div>
        </div>
      ))}
    </div>
  );
}export default function TradePlanRadar({ tradePlanData, loading }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('score');

  const data = tradePlanData?.data || [];
  const topOpportunities = tradePlanData?.top || [];
  const alternatives = tradePlanData?.alternatives || [];
  const qualityBreakdown = tradePlanData?.qualityBreakdown || {};

  const filteredAndSorted = useMemo(() => {
    let result = data.filter((item) => {
      if (!item) return false;
      if (activeFilter === 'all') return true;

      const filterMap = {
        TOP: () => item.planQuality === 'TOP',
        STRONG: () => item.planQuality === 'STRONG',
        WATCH: () => item.planQuality === 'WATCH',
        WEAK: () => item.planQuality === 'WEAK',
        UNAVAILABLE: () => item.planQuality === 'UNAVAILABLE',
        LONG: () => item.direction === 'LONG',
        SHORT: () => item.direction === 'SHORT',
        HIGH_RR: () => item.riskReward != null && item.riskReward >= 2,
        LOW_RR: () => item.riskReward != null && item.riskReward < 1,
        HIGH_RISK: () => item.risks.some((r) => r.severity === 'HIGH'),
        LOW_DATA: () => (item.dataCompleteness ?? 100) < 50,
        VALID_PLAN: () => item.planSignal === 'STRONG_PLAN' || item.planSignal === 'VALID_PLAN',
      };

      const check = filterMap[activeFilter];
      return check ? check() : true;
    });

    const compare = (a, b) => {
      if (activeSort === 'score') {
        const sa = a.planScore ?? -1;
        const sb = b.planScore ?? -1;
        if (sa === -1 && sb !== -1) return 1;
        if (sb === -1 && sa !== -1) return -1;
        if (sb !== sa) return sb - sa;
        const da = a.dataCompleteness ?? 0;
        const db = b.dataCompleteness ?? 0;
        return db - da;
      }
      if (activeSort === 'quality') {
        const qOrder = { TOP: 5, STRONG: 4, WATCH: 3, WEAK: 2, UNAVAILABLE: 1 };
        const qa = qOrder[a.planQuality] || 0;
        const qb = qOrder[b.planQuality] || 0;
        if (qb !== qa) return qb - qa;
        return (b.planScore ?? -1) - (a.planScore ?? -1);
      }
      if (activeSort === 'rr') {
        const ra = a.riskReward ?? -1;
        const rb = b.riskReward ?? -1;
        if (rb !== ra) return rb - ra;
        return (b.planScore ?? -1) - (a.planScore ?? -1);
      }
      if (activeSort === 'confidence') {
        const ord = { HIGH: 4, MODERATE: 3, LOW: 2, VERY_LOW: 1, UNKNOWN: 0 };
        const sa = ord[a.confidenceLevel] || 0;
        const sb = ord[b.confidenceLevel] || 0;
        if (sb !== sa) return sb - sa;
        return (b.planScore ?? -1) - (a.planScore ?? -1);
      }
      if (activeSort === 'data_completeness') {
        const da = a.dataCompleteness ?? 0;
        const db = b.dataCompleteness ?? 0;
        return db - da;
      }
      if (activeSort === 'risk') {
        const ra = a.risks.filter((r) => r.severity === 'HIGH').length;
        const rb = b.risks.filter((r) => r.severity === 'HIGH').length;
        if (rb !== ra) return rb - ra;
        return (b.planScore ?? -1) - (a.planScore ?? -1);
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
    { key: 'LONG', label: 'Long' },
    { key: 'SHORT', label: 'Short' },
    { key: 'HIGH_RR', label: 'High R/R' },
    { key: 'LOW_RR', label: 'Low R/R' },
    { key: 'HIGH_RISK', label: 'High Risk' },
    { key: 'LOW_DATA', label: 'Low Data' },
    { key: 'VALID_PLAN', label: 'Valid Plan' },
  ];

  const sortOptions = [
    { key: 'score', label: 'الدرجة' },
    { key: 'quality', label: 'الجودة' },
    { key: 'rr', label: 'R/R' },
    { key: 'confidence', label: 'Confidence' },
    { key: 'data_completeness', label: 'البيانات' },
    { key: 'risk', label: 'المخاطرة' },
  ];

  return (
    <section style={{ ...panel, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#8B5CF6', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            🧭 TRADE PLAN ENGINE · C8
          </div>
          <h3 style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 900, margin: 0 }}>
            خطة Trading (Trade Plan)
          </h3>
        </div>
        <div style={{ fontSize: 9, color: '#64748B' }}>
          {data.length} Near · تم فحص {tradePlanData?.scanned || 0} Near
        </div>
      </div>

      <p style={{ color: '#64748B', fontSize: 10, marginBottom: 12 }}>
        خطة تداول مشروطة بناءً على C7 + B1-B6. الدرجة = وزن مركّز للبيانات المتاحة — ليس متوسط بسيط. لا يتم اختلالق مستويات.
      </p>

      {tradePlanData && tradePlanData.dataAvailability && (
        <AvailabilityBar opportunityData={tradePlanData} />
      )}

      <QualityBreakdown breakdown={qualityBreakdown} />

      {topOpportunities.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#8B5CF6', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            ⚡ أفضل خطط Trading
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
        <div style={{ color: '#94A3B8', fontSize: 12, padding: 20 }}>⏳ جاري تحميل خطط Trading…</div>
      ) : filteredAndSorted.length === 0 ? (
        <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>
          لا توجد خطط مطابقة ل Critiria المحددة.
        </div>
      ) : (
        <OpportunityTable data={filteredAndSorted} />
      )}

      <div style={{ fontSize: 9, color: '#475569', marginTop: 12, lineHeight: 1.6 }}>
        <div>⚠️ الدرجة ليست توقعًا لسعر أو توصية شراء/بيع</div>
        <div>⚠️ المستويات التي لا توجد لها بيانات موثوقة تبقى غير متاحة.</div>
        <div>⚠️ C8 يركّب C7 + B1-B6 — لا يخترع مستويات أو أسعارًا</div>
        <div>⚠️ التحليل فقط — ليس توصية شراء/بيع. مصادر البيانات: SEC EDGAR و Yahoo Finance.</div>
      </div>
    </section>
  );
}