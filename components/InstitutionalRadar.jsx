'use client';

import React, { useState, useMemo } from 'react';

const panel = {
  backgroundColor: '#0B0F17',
  border: '1px solid #1F2636',
  borderRadius: '16px',
};

const rankClassColor = {
  TOP: '#34D399',
  STRONG: '#FBBF24',
  WATCH: '#F87171',
  WEAK: '#94A3B8',
  UNAVAILABLE: '#475569',
};

const convictionColor = {
  HIGH: '#34D399',
  MEDIUM: '#FBBF24',
  LOW: '#F87171',
  UNAVAILABLE: '#475569',
};

const riskColor = {
  LOW: '#34D399',
  MODERATE: '#FBBF24',
  HIGH: '#F87171',
  EXTREME: '#EF4444',
  UNAVAILABLE: '#475569',
};

const activityColor = {
  HIGH: '#34D399',
  MODERATE: '#FBBF24',
  LOW: '#F87171',
  UNAVAILABLE: '#475569',
};

const dataStatusColor = {
  complete: '#34D399',
  partial: '#FBBF24',
  unavailable: '#475569',
};

const statusColor = {
  DECISION_TOP: '#34D399',
  DECISION_STRONG: '#34D399',
  DECISION_WATCH: '#FBBF24',
  DECISION_MONITOR: '#F87171',
  DECISION_OBSERVE: '#94A3B8',
  UNAVAILABLE: '#475569',
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
    <div style={{ textAlign: 'center', minWidth: 60 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: scoreColor(score), fontFamily: 'monospace' }}>
        {score ?? '—'}
      </div>
      <div style={{ fontSize: 9, color: '#64748B' }}>{label}</div>
    </div>
  );
}

function Tag({ value, colorMap }) {
  const color = colorMap[value] || '#475569';
  return (
    <span
      style={{
        color,
        fontSize: 10,
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

function SymbolCard({ symbol, intel, signal, rank, decision }) {
  const decisionScore = decision?.institutionalDecisionScore ?? rank?.institutionalDecisionScore ?? null;
  const decisionStatus = decision?.institutionalStatus ?? rank?.institutionalStatus ?? 'UNAVAILABLE';
  return (
    <div
      style={{
        ...panel,
        padding: 14,
        borderRadius: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ color: '#F8FAFC', fontFamily: 'monospace', fontSize: 14 }}>
          {symbol || '—'}
        </strong>
        {rank && (
          <Tag value={rank.institutionalRankClass} colorMap={rankClassColor} />
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <ScorePill score={signal?.institutionalSignalScore ?? rank?.institutionalSignalScore} label="Signal" />
        <ScorePill score={intel?.institutionalActivityScore ?? signal?.activityScore} label="Activity" />
        <ScorePill score={rank?.institutionalRankScore} label="Rank" />
        <ScorePill score={decisionScore} label="Decision" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <Tag value={decisionStatus} colorMap={statusColor} />
        <Tag value={signal?.institutionalConviction} colorMap={convictionColor} />
        <Tag value={signal?.institutionalRisk || intel?.institutionalRisk} colorMap={riskColor} />
        <Tag value={signal?.institutionalActivity} colorMap={activityColor} />
        <Tag value={signal?.dataStatus || intel?.dataStatus} colorMap={dataStatusColor} />
      </div>

      {signal?.dataQuality != null && (
        <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>
          Data Quality: {signal.dataQuality}/100
        </div>
      )}

      {signal?.freshness != null && (
        <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4 }}>
          Freshness: {signal.freshness}/100
        </div>
      )}

      {decision?.executionQuality != null && (
        <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>
          Execution Quality: {decision.executionQuality}/100
        </div>
      )}

      {decision?.warnings?.length > 0 && (
        <div style={{ fontSize: 9, color: '#F87171', marginBottom: 6 }}>
          ⚠ {decision.warnings.slice(0, 2).join(' • ')}
        </div>
      )}

      {rank?.flags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {rank.flags.slice(0, 4).map((f) => (
            <span key={f} style={{ fontSize: 8, color: '#818CF8', backgroundColor: '#1E293B', padding: '1px 6px', borderRadius: 4 }}>
              {f}
            </span>
          ))}
        </div>
      )}

      {rank?.warnings?.length > 0 && (
        <div style={{ fontSize: 9, color: '#F87171', marginBottom: 6 }}>
          ⚠ {rank.warnings.slice(0, 2).join(' • ')}
        </div>
      )}

      {intel?.filingSignals?.length > 0 && (
        <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 6 }}>
          📄 {intel.filingSignals.length} SEC filings · {intel.filingSignals[0]?.form || '—'}
          {intel.filingSignals.length > 1 && ` +${intel.filingSignals.length - 1}`}
        </div>
      )}

      {!intel?.filingSignals?.length && intel?.secDataStatus !== 'ok' && (
        <div style={{ fontSize: 9, color: '#475569', marginTop: 6 }}>
          📄 No SEC filing signals available
        </div>
      )}
    </div>
  );
}

function OpportunitiesTable({ signals, ranks, decisions }) {
  if (!signals || signals.length === 0) {
    return (
      <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>
        لا توجد بيانات مؤسسية متاحة حالياً.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>الملف</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Rank</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Signal</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Conviction</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Activity</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Risk</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Data</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Decision</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s) => {
            const r = ranks?.[s.symbol || s?.[0]];
            const d = decisions?.[s.symbol || s?.[0]];
            return (
              <tr key={s.symbol || s?.[0]} style={{ borderBottom: '1px solid #1F2636' }}>
                <td style={{ padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>{s.symbol || '—'}</td>
                <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                  <Tag value={r?.institutionalRankClass} colorMap={rankClassColor} />
                </td>
                <td style={{ textAlign: 'center', padding: '8px 6px', color: scoreColor(r?.institutionalSignalScore ?? s?.institutionalSignalScore), fontFamily: 'monospace' }}>
                  {r?.institutionalSignalScore ?? s?.institutionalSignalScore ?? '—'}
                </td>
                <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                  <Tag value={r?.institutionalConviction ?? s?.institutionalConviction} colorMap={convictionColor} />
                </td>
                <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                  <Tag value={r?.institutionalActivity ?? s?.institutionalActivity} colorMap={activityColor} />
                </td>
                <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                  <Tag value={r?.institutionalRisk ?? s?.institutionalRisk} colorMap={riskColor} />
                </td>
                <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                  <Tag value={r?.dataStatus ?? s?.dataStatus} colorMap={dataStatusColor} />
                </td>
                <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <span style={{ color: scoreColor(d?.institutionalDecisionScore), fontFamily: 'monospace', fontWeight: 700 }}>
                      {d?.institutionalDecisionScore ?? '—'}
                    </span>
                    <Tag value={d?.institutionalStatus} colorMap={statusColor} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function InstitutionalRadar({ opportunitiesData, loading }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('rank');

  const optionsRanking = opportunitiesData?.optionsRanking || {};
  const institutionalOpps = opportunitiesData?.institutionalOpportunities;
  const isFinraAvailable = opportunitiesData?.dataAvailability?.institutionalFlow === true;

  const allSignals = Object.values(optionsRanking)
    .filter((v) => v?.institutionalSignal)
    .map((v) => v.institutionalSignal);

  const allRanks = Object.fromEntries(
    Object.entries(optionsRanking)
      .filter(([, v]) => v?.institutionalRank)
      .map(([k, v]) => [k, v.institutionalRank])
  );

  const allDecisions = Object.fromEntries(
    Object.entries(optionsRanking)
      .filter(([, v]) => v?.institutionalDecision)
      .map(([k, v]) => [k, v.institutionalDecision])
  );

  const filteredAndSorted = useMemo(() => {
    let data = allSignals.filter((s) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'top') return s.institutionalConviction === 'HIGH';
      if (activeFilter === 'strong') return s.institutionalConviction === 'HIGH' || s.institutionalConviction === 'MEDIUM';
      if (activeFilter === 'watch') return s.institutionalConviction === 'LOW';
      if (activeFilter === 'unavailable') return s.institutionalConviction === 'UNAVAILABLE';
      if (activeFilter === 'high-risk') return s.institutionalRisk === 'HIGH' || s.institutionalRisk === 'EXTREME';
      if (activeFilter === 'high-activity') return s.institutionalActivity === 'HIGH';
      if (activeFilter === 'finra-only') return s.dataStatus === 'complete';
      return true;
    });

    const getDecisionScore = (s) => allDecisions[s.symbol]?.institutionalDecisionScore ?? s.institutionalSignalScore ?? 0;

    const compare = (a, b) => {
      if (activeSort === 'decision') return getDecisionScore(b) - getDecisionScore(a);
      if (activeSort === 'rank') return (allRanks[a.symbol]?.institutionalRankScore ?? 0) - (allRanks[b.symbol]?.institutionalRankScore ?? 0);
      if (activeSort === 'signal') return (b.institutionalSignalScore ?? 0) - (a.institutionalSignalScore ?? 0);
      if (activeSort === 'activity') {
        const activityOrder = { HIGH: 4, MODERATE: 3, LOW: 2, UNAVAILABLE: 0 };
        return (activityOrder[b.institutionalActivity] || 0) - (activityOrder[a.institutionalActivity] || 0);
      }
      return 0;
    };

    return [...data].sort(compare);
  }, [allSignals, allRanks, allDecisions, activeFilter, activeSort]);

  const topOpportunities = institutionalOpps?.top || [];
  const alternatives = institutionalOpps?.alternatives || [];
  const institutionalDecisions = opportunitiesData?.institutionalDecisions || [];

  const filterOptions = [
    { key: 'all', label: 'الكل' },
    { key: 'top', label: 'TOP' },
    { key: 'strong', label: 'STRONG+' },
    { key: 'watch', label: 'WATCH' },
    { key: 'high-risk', label: 'مخاطرة عالية' },
    { key: 'high-activity', label: 'نشاط عالي' },
    { key: 'finra-only', label: 'FINRA' },
    { key: 'unavailable', label: 'UNAVAILABLE' },
  ];

  const sortOptions = [
    { key: 'decision', label: 'القرار' },
    { key: 'rank', label: 'الترتيب' },
    { key: 'signal', label: 'الإشارة' },
    { key: 'activity', label: 'النشاط' },
  ];

  return (
    <section style={{ ...panel, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#818CF8', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            📊 INSTITUTIONAL RADAR · A3 FINAL
          </div>
          <h3 style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 900, margin: 0 }}>
            فحص الأنشطة المؤسسية
          </h3>
        </div>
        <div style={{ fontSize: 9, color: '#64748B' }}>
          {isFinraAvailable ? '✓ FINRA متاح' : 'FINRA غير متاح — بيانات SEC فقط'}
        </div>
      </div>

      <p style={{ color: '#64748B', fontSize: 10, marginBottom: 12 }}>
        يعتمد على بيانات SEC EDGAR العامة وبيانات FINRA ATS عندها تكون متاحة.
        لا يتم اختلاق تدفقات مؤسسية، dark-pool، whale، 13F أو insider.
      </p>

      {/* Top Opportunities */}
      {topOpportunities.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#34D399', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            🏆 أفضل الفرص المؤسسية
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {topOpportunities.map((r) => (
              <SymbolCard
                key={r.symbol}
                symbol={r.symbol}
                intel={optionsRanking[r.symbol]?.institutionalIntelligence}
                signal={optionsRanking[r.symbol]?.institutionalSignal}
                rank={r}
                decision={optionsRanking[r.symbol]?.institutionalDecision}
              />
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
            {alternatives.map((r) => (
              <SymbolCard
                key={r.symbol}
                symbol={r.symbol}
                intel={optionsRanking[r.symbol]?.institutionalIntelligence}
                signal={optionsRanking[r.symbol]?.institutionalSignal}
                rank={r}
                decision={optionsRanking[r.symbol]?.institutionalDecision}
              />
            ))}
          </div>
        </div>
      )}

      {/* Final Institutional Decisions */}
      {institutionalDecisions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#818CF8', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            🎯 قرارات مؤسسية نهائية (مرتبة حسب القرار)
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {institutionalDecisions.map((d) => (
              <SymbolCard
                key={d.symbol}
                symbol={d.symbol}
                intel={optionsRanking[d.symbol]?.institutionalIntelligence}
                signal={optionsRanking[d.symbol]?.institutionalSignal}
                rank={optionsRanking[d.symbol]?.institutionalRank}
                decision={d}
              />
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
        <div style={{ color: '#94A3B8', fontSize: 12, padding: 20 }}>⏳ جاري تحميل البيانات المؤسسية…</div>
      ) : (
        <OpportunitiesTable signals={filteredAndSorted} ranks={allRanks} decisions={allDecisions} />
      )}

      {/* Data limitations */}
      <div style={{ fontSize: 9, color: '#475569', marginTop: 12, lineHeight: 1.6 }}>
        <div>🚫 13F/Insider: غير متاح</div>
        <div>🚫 Dark Pool: غير متاح</div>
        <div>🚫 Whale Flow: غير متاح</div>
        <div>🚫 Real-time Flow: غير متاح — FINRA ATS مؤجل ومجمع أسبوعياً</div>
      </div>
    </section>
  );
}
