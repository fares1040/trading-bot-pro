'use client';

import React, { useMemo, useState } from 'react';

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

const confidenceColor = {
  HIGH: '#34D399',
  MODERATE: '#22C55E',
  LOW: '#F87171',
  VERY_LOW: '#EF4444',
  UNKNOWN: '#475569',
};

const sourceColor = {
  'B1 Penny Intelligence': '#22C55E',
  'B2 Options Intelligence': '#38BDF8',
  'B3 Institutional Radar': '#818CF8',
  'B4 Swing Intelligence': '#FBBF24',
  'B5 Early Explosion': '#EC4899',
  'B6 Catalyst Intelligence': '#F59E0B',
  'C7 Opportunity Ranking': '#A78BFA',
  'C8 Trade Plan': '#34D399',
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
  if (value == null || value === '') return null;
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

function EvidenceCard({ evidence }) {
  return (
    <div style={{ ...panel, padding: 10, borderRadius: 8, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: '#FBBF24', fontSize: 10, fontWeight: 700 }}>{evidence.factor || 'Evidence'}</span>
        {evidence.signal && <Tag value={evidence.signal} colorMap={signalColor} />}
      </div>
      <div style={{ fontSize: 9, color: '#CBD5E1', marginBottom: 6, lineHeight: 1.5 }}>
        {evidence.explanation || '—'}
      </div>
      {evidence.evidence && evidence.evidence.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {evidence.evidence.slice(0, 4).map((ev, i) => (
            <SmallTag key={i} value={ev} color="#64748B" />
          ))}
        </div>
      )}
      {evidence.risk && (
        <div style={{ fontSize: 8, color: '#F87171', marginTop: 6, lineHeight: 1.4 }}>
          ⚠️ {evidence.risk}
        </div>
      )}
    </div>
  );
}

function WhyNowCard({ factor }) {
  return (
    <div style={{ ...panel, padding: 10, borderRadius: 8, marginBottom: 8, borderLeft: '3px solid #FBBF24' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: '#FBBF24', fontSize: 10, fontWeight: 700 }}>{factor.factor}</span>
        <span style={{ color: factor.strength != null ? '#34D399' : '#64748B', fontSize: 9, fontFamily: 'monospace', fontWeight: 700 }}>
          {factor.strength != null ? factor.strength + '/100' : '—'}
        </span>
      </div>
      <div style={{ fontSize: 9, color: '#CBD5E1', marginBottom: 6, lineHeight: 1.5 }}>
        {factor.explanation || '—'}
      </div>
      {factor.evidence && factor.evidence.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {factor.evidence.slice(0, 3).map((ev, i) => (
            <SmallTag key={i} value={ev} color="#818CF8" />
          ))}
        </div>
      )}
    </div>
  );
}
function DomainSection({ title, explanation, evidence, color }) {
  if (!explanation) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: color || '#FBBF24', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 9, color: '#CBD5E1', lineHeight: 1.6, marginBottom: 4 }}>
        {explanation}
      </div>
      {evidence && evidence.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {evidence.slice(0, 4).map((ev, i) => (
            <SmallTag key={i} value={ev} color={color || '#64748B'} />
          ))}
        </div>
      )}
    </div>
  );
}

function SymbolCard({ symbol, data }) {
  const {
    headline, summary, thesis, whyNow, whyItMatters,
    directionBias, direction, directionWord, setup, timeframe,
    keyLevels, entryExplanation, stopExplanation, targetExplanation, riskRewardExplanation,
    risks, warnings, conflicts,
    confidence, confidenceExplanation,
    dataAvailability, dataCompleteness,
    provenance, limitations, disclaimer, available,
  } = data || {};

  return (
    <div
      style={{
        ...panel,
        padding: 14,
        borderRadius: 12,
        minWidth: 300,
        maxWidth: 360,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ color: '#F8FAFC', fontFamily: 'monospace', fontSize: 14 }}>
          {symbol || '—'}
        </strong>
        <Tag value={available ? 'LIVE' : 'UNAVAILABLE'} colorMap={{ LIVE: '#34D399', UNAVAILABLE: '#475569' }} />
      </div>

      {headline && (
        <div style={{ fontSize: 11, color: '#FBBF24', fontWeight: 700, marginBottom: 6, lineHeight: 1.5 }}>
          {headline}
        </div>
      )}

      {whyNow && whyNow.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: '#F59E0B', fontSize: 9, fontWeight: 700, marginBottom: 6 }}>
            ⚡ WHY NOW
          </div>
          {whyNow.slice(0, 3).map((f, i) => (
            <WhyNowCard key={i} factor={f} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <Tag value={directionBias} colorMap={directionColor} />
        {setup && <SmallTag value={setup} color="#CBD5E1" />}
        {timeframe && timeframe !== 'UNKNOWN' && <SmallTag value={timeframe} color="#64748B" />}
        {dataCompleteness != null && (
          <SmallTag value={'DC ' + dataCompleteness + '%'} color={dataCompleteness >= 70 ? '#34D399' : dataCompleteness >= 40 ? '#FBBF24' : '#F87171'} />
        )}
      </div>

      <div style={{ background: '#07090E', borderRadius: 8, padding: 8, marginBottom: 8 }}>
        <LevelRow label="Entry Zone" value={keyLevels && keyLevels.entryZone} fallback="—" />
        <LevelRow label="Stop Loss" value={keyLevels && keyLevels.stopLoss} fallback="—" />
        <LevelRow label="Target 1" value={keyLevels && keyLevels.target1} fallback="—" />
        <LevelRow label="Target 2" value={keyLevels && keyLevels.target2} fallback="—" />
        <LevelRow label="Invalidation" value={keyLevels && keyLevels.invalidation} fallback="—" />
        <LevelRow label="R/R" value={keyLevels && keyLevels.riskReward} fallback="—" />
      </div>

      {confidence && confidence.score != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 10 }}>
          <span style={{ color: '#64748B' }}>الConfidence</span>
          <span style={{ color: confidenceColor[confidence.level] || '#64748B', fontFamily: 'monospace', fontWeight: 700 }}>
            {confidence.score}/100 · {confidence.level}
          </span>
        </div>
      )}

      {summary && (
        <div style={{ fontSize: 9, color: '#CBD5E1', marginBottom: 6, lineHeight: 1.6 }}>
          {summary}
        </div>
      )}

      {risks && risks.length > 0 && risks.slice(0, 3).map((r, i) => (
        <div key={i} style={{ fontSize: 9, color: '#F59E0B', marginBottom: 4, lineHeight: 1.4 }}>
          [{r.severity}] {r.label}: {r.description}
        </div>
      ))}

      {conflicts && conflicts.length > 0 && (
        <div style={{ fontSize: 9, color: '#EF4444', marginBottom: 6, lineHeight: 1.4 }}>
          ⚠️ نزاع: {conflicts.map((c) => c.description).join(' | ')}
        </div>
      )}

      {dataAvailability && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {Object.entries(dataAvailability).map(([key, val]) => (
            <SmallTag
              key={key}
              value={key.replace('Intelligence', '').replace('Radar', '').slice(0, 4) + ': ' + (val ? '✓' : '—')}
              color={val ? '#34D399' : '#475569'}
            />
          ))}
        </div>
      )}

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
        لا توجد شرحات تحليل متاحة حالياً.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>الرمز</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Signal</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>الاتجاه</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Setup</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Stop</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>T1</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>R/R</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Confidence</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>DC%</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Accent</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>السطور</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.symbol} style={{ borderBottom: '1px solid #1F2636' }}>
              <td style={{ padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>{item.symbol || '—'}</td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <Tag value={item.quality || 'UNAVAILABLE'} colorMap={qualityColor} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: directionColor[item.directionBias] || '#475569', fontFamily: 'monospace', fontWeight: 700 }}>
                {item.directionBias || '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#CBD5E1' }}>{item.setup || '—'}</td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.keyLevels && item.keyLevels.stopLoss != null ? '#F8FAFC' : '#475569', fontFamily: 'monospace' }}>
                {item.keyLevels && item.keyLevels.stopLoss != null ? item.keyLevels.stopLoss : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.keyLevels && item.keyLevels.target1 != null ? '#34D399' : '#475569', fontFamily: 'monospace' }}>
                {item.keyLevels && item.keyLevels.target1 != null ? item.keyLevels.target1 : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: item.keyLevels && item.keyLevels.riskReward != null ? '#34D399' : '#475569', fontFamily: 'monospace', fontWeight: 700 }}>
                {item.keyLevels && item.keyLevels.riskReward != null ? item.keyLevels.riskReward : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <SmallTag value={item.confidence && item.confidence.level} color={confidenceColor[item.confidence && item.confidence.level] || '#64748B'} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                {item.dataCompleteness ?? 0}%
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                {item.risks && item.risks.filter((r) => r.severity === 'HIGH').length > 0 ? (
                  <SmallTag value={'HIGH ' + item.risks.filter((r) => r.severity === 'HIGH').length} color="#EF4444" />
                ) : (
                  <SmallTag value="LOW" color="#34D399" />
                )}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                {item.conflicts && item.conflicts.length > 0 ? (
                  <SmallTag value={'CONFLICT ' + item.conflicts.length} color="#EF4444" />
                ) : (
                  <SmallTag value="OK" color="#34D399" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AIExplanationRadar({ aiExplanationData, loading }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const data = aiExplanationData?.data || [];
  const topOpportunities = aiExplanationData?.top || [];
  const alternatives = aiExplanationData?.alternatives || [];
  const qualityBreakdown = aiExplanationData?.qualityBreakdown || {};

  const filtered = useMemo(() => {
    if (!data.length) return [];
    if (activeFilter === 'all') return data;
    return data.filter((item) => {
      if (!item) return false;
      if (activeFilter === 'LONG') return item.directionBias === 'LONG';
      if (activeFilter === 'SHORT') return item.directionBias === 'SHORT';
      if (activeFilter === 'NEUTRAL') return item.directionBias === 'NEUTRAL';
      if (activeFilter === 'UNAVAILABLE') return item.directionBias === 'UNAVAILABLE' || !item.available;
      if (activeFilter === 'HIGH_RISK') return (item.risks || []).some((r) => r.severity === 'HIGH');
      if (activeFilter === 'LOW_DATA') return (item.dataCompleteness ?? 100) < 50;
      if (activeFilter === 'CONFLICT') return (item.conflicts || []).length > 0;
      return true;
    });
  }, [data, activeFilter]);

  const filterOptions = [
    { key: 'all', label: 'الكل' },
    { key: 'LONG', label: 'Long' },
    { key: 'SHORT', label: 'Short' },
    { key: 'NEUTRAL', label: 'ال المحايد' },
    { key: 'UNAVAILABLE', label: 'غير متاح' },
    { key: 'HIGH_RISK', label: 'ACCENT عالي' },
    { key: 'LOW_DATA', label: 'بيانات قليلة' },
    { key: 'CONFLICT', label: 'نزاع' },
  ];

  return (
    <section style={{ ...panel, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#8B5CF6', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            🧠 AI EXPLANATION · C9
          </div>
          <h3 style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 900, margin: 0 }}>
            شرح الذكاء الاصطناعي
          </h3>
        </div>
        <div style={{ fontSize: 9, color: '#64748B' }}>
          {data.length} شرح · تم فحص {aiExplanationData?.scanned || 0} Near
        </div>
      </div>

      <p style={{ color: '#64748B', fontSize: 10, marginBottom: 12 }}>
        شرح مبن على مصادر ذكاء موجودة فقط — لا يخترع مستويات أو ثقة. ال Rusha تُعرض فقط عند وجود دليل فعلي.
      </p>

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
            ⚡ أفضل Explanation تحليل
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
            📋 Explanation مراقبة
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {alternatives.map((item) => (
              <SymbolCard key={item.symbol} symbol={item.symbol} data={item} />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
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
      </div>

      {loading ? (
        <div style={{ color: '#94A3B8', fontSize: 12, padding: 20 }}>⏳ جاري تحميل شرحات الذكاء…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>
          لا توجد شرحات مطابدة ل更多 المحددة.
        </div>
      ) : (
        <OpportunityTable data={filtered} />
      )}

      <div style={{ fontSize: 9, color: '#475569', marginTop: 12, lineHeight: 1.6 }}>
        <div>⚠️ الExplanation ليست توقعًا لسعر أو توصية شراء/بيع</div>
        <div>⚠️ المستويات التي لا توجد لها بيانات موثوقة تبقى غير متاحة</div>
        <div>⚠️ C9 يركّب B1-B6 + C7 + C8 — لا يخترع مستويات أو ثقة</div>
        <div>⚠️ التحليل فقط — ليس توصية شراء/بيع. مصادر البيانات: SEC EDGAR و Yahoo Finance.</div>
      </div>
    </section>
  );
}

export default AIExplanationRadar;
