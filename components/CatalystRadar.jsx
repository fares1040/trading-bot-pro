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

const reliabilityColor = {
  VERIFIED: '#34D399',
  HIGH: '#34D399',
  MODERATE: '#FBBF24',
  LOW: '#F87171',
  UNAVAILABLE: '#475569',
};

const significanceColor = {
  CRITICAL: '#EF4444',
  HIGH: '#F87171',
  MODERATE: '#FBBF24',
  LOW: '#F59E0B',
  UNKNOWN: '#475569',
};

const catalystTypeColor = {
  EARNINGS: '#22C55E',
  SEC_MATERIAL_EVENT: '#EF4444',
  SEC_OFFERING: '#818CF8',
  SEC_DILUTION: '#F87171',
  SEC_FINANCING: '#F59E0B',
  FDA_REGULATORY: '#A78BFA',
  CONTRACT_DEAL: '#60A5FA',
  PARTNERSHIP: '#C4B5FD',
  PRODUCT_LAUNCH: '#34D399',
  ANALYST_ACTION: '#FBBF24',
  INSIDER_ACTIVITY: '#34D399',
  CORPORATE_EVENT: '#60A5FA',
  MACRO_SECTOR_EVENT: '#CBD5E1',
  OTHER: '#64748B',
  NO_VERIFIED_CATALYST: '#475569',
  UNAVAILABLE: '#475569',
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
    catalystScore, quality, catalystType, catalystTypes,
    reliability, significance, recency, catalystDate, daysAgo,
    upcoming, upcomingDate, event, source, provenance,
    dataAvailability, dataCompleteness, reasons, warnings, flags,
    catalystRisk, componentScores, catalysts, secEvidence,
  } = data || {};

  const typeColor = catalystTypeColor[catalystType] || '#64748B';

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
        <ScorePill score={catalystScore} label="Score" />
        {componentScores && (
          <>
            <ScorePill score={componentScores.significance} label="Sig" />
            <ScorePill score={componentScores.recency} label="Rec" />
            <ScorePill score={componentScores.reliability} label="Rel" />
          </>
        )}
        <ScorePill score={dataCompleteness} label="Data %" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {catalystType && catalystType !== 'NO_VERIFIED_CATALYST' && (
          <SmallTag value={catalystType} color={typeColor} />
        )}
        {upcoming && upcomingDate && (
          <SmallTag value={`UPCOMING: ${upcomingDate}`} color="#A78BFA" />
        )}
        {daysAgo != null && (
          <SmallTag value={`${daysAgo}d ago`} color="#60A5FA" />
        )}
        {reliability && reliability !== 'UNAVAILABLE' && (
          <SmallTag value={reliability} color={reliabilityColor[reliability] || '#64748B'} />
        )}
        {significance && significance !== 'UNKNOWN' && (
          <SmallTag value={significance} color={significanceColor[significance] || '#64748B'} />
        )}
      </div>

      {event && (
        <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6, lineHeight: 1.6 }}>
          📋 {event}
        </div>
      )}

      {catalystDate && (
        <div style={{ fontSize: 10, color: '#64748B', marginBottom: 6 }}>
          تاريخ المحفز: {catalystDate}
        </div>
      )}

      {source && (
        <div style={{ fontSize: 10, color: '#64748B', marginBottom: 6 }}>
          مصدر: {source}
        </div>
      )}

      {catalysts && catalysts.length > 0 && (
        <div style={{ fontSize: 9, color: '#CBD5E1', marginBottom: 6, lineHeight: 1.5 }}>
          {catalysts.slice(0, 3).map((c, i) => (
            <div key={i}>• {c.type}: {c.description || '—'}</div>
          ))}
        </div>
      )}

      {reasons && reasons.length > 0 && (
        <div style={{ fontSize: 9, color: '#CBD5E1', marginBottom: 6, lineHeight: 1.5 }}>
          {reasons.slice(0, 4).map((r, i) => (
            <div key={i}>• {r}</div>
          ))}
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div style={{ fontSize: 9, color: '#F87171', marginBottom: 6 }}>
          ⚠ {warnings.slice(0, 3).join(' • ')}
        </div>
      )}

      {flags && flags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {flags.slice(0, 5).map((f) => (
            <span key={f} style={{ fontSize: 8, color: '#818CF8', backgroundColor: '#1E293B', padding: '1px 6px', borderRadius: 4 }}>
              {f}
            </span>
          ))}
        </div>
      )}

      {secEvidence && (
        <div style={{ fontSize: 9, color: '#64748B', marginTop: 6, lineHeight: 1.6 }}>
          <div>SEC: {secEvidence.dataStatus || '—'}</div>
          {secEvidence.latestFiling && (
            <div>Latest: {secEvidence.latestFiling.form || '—'} · {secEvidence.latestFiling.filingDate || '—'}</div>
          )}
        </div>
      )}

      <div style={{ fontSize: 8, color: '#475569', marginTop: 8, lineHeight: 1.6 }}>
        الذكاء: {provenance?.intelligence || '—'} · المحرك: {provenance?.engine || '—'}
      </div>
    </div>
  );
}

function CatalystTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>
        لا توجد بيانات محفزات متاحة حالياً.
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
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Type</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Reliability</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Significance</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Date</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Upcoming</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Data %</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Flags</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.symbol} style={{ borderBottom: '1px solid #1F2636' }}>
              <td style={{ padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>{item.symbol || '—'}</td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: scoreColor(item.catalystScore), fontFamily: 'monospace', fontWeight: 700 }}>
                {item.catalystScore ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <Tag value={item.quality} colorMap={qualityColor} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <SmallTag value={item.catalystType} color={catalystTypeColor[item.catalystType] || '#64748B'} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <SmallTag value={item.reliability} color={reliabilityColor[item.reliability] || '#64748B'} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <SmallTag value={item.significance} color={significanceColor[item.significance] || '#64748B'} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8' }}>
                {item.catalystDate || '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                {item.upcoming && item.upcomingDate ? (
                  <SmallTag value={item.upcomingDate} color="#A78BFA" />
                ) : '—'}
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

function AvailabilityIndicator({ dataAvailability }) {
  if (!dataAvailability) return null;
  const items = [
    { key: 'secData', label: 'SEC' },
    { key: 'marketData', label: 'Market' },
    { key: 'catalysts', label: 'Catalysts' },
    { key: 'catalystScore', label: 'Score' },
    { key: 'insiderActivity', label: 'Insider' },
    { key: 'materialEvents', label: '8-K' },
    { key: 'earningsData', label: 'Earnings' },
    { key: 'offerings', label: 'Offerings' },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
      {items.map((item) => (
        <span
          key={item.key}
          style={{
            fontSize: 9,
            color: dataAvailability[item.key] ? '#34D399' : '#475569',
            backgroundColor: dataAvailability[item.key] ? '#142E1C' : '#1E293B',
            border: '1px solid ' + (dataAvailability[item.key] ? '#14532D' : '#334155'),
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          {item.label}: {dataAvailability[item.key] ? '✓' : '—'}
        </span>
      ))}
    </div>
  );
}

export default function CatalystRadar({ catalystData, loading }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('score');

  const data = catalystData?.data || [];
  const topOpportunities = catalystData?.top || [];
  const alternatives = catalystData?.alternatives || [];

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
        VERIFIED: () => item.reliability === 'VERIFIED',
        HIGH: () => item.reliability === 'HIGH',
        RECENT: () => {
          const da = item.catalysts?.[0]?.daysAgo;
          return da != null && da <= 7;
        },
        UPCOMING: () => item.upcoming === true,
        EARNINGS: () => (item.catalystTypes || []).includes('EARNINGS'),
        SEC: () => item.catalystTypes?.some(t => t.startsWith('SEC_')),
        OFFERING: () => (item.catalystTypes || []).some(t => t === 'SEC_OFFERING' || t === 'SEC_FINANCING' || t === 'SEC_DILUTION'),
        MATERIAL_EVENT: () => item.catalystType === 'SEC_MATERIAL_EVENT' || (item.flags || []).includes('SEC_MATERIAL_EVENT'),
        INSIDER: () => (item.catalystTypes || []).includes('INSIDER_ACTIVITY'),
        REGULATORY: () => (item.catalystTypes || []).includes('FDA_REGULATORY'),
        NO_CATALYST: () => item.catalystType === 'NO_VERIFIED_CATALYST' || (item.flags || []).includes('NO_VERIFIED_CATALYST') || (item.warnings || []).includes('NO_VERIFIED_CATALYST'),
      };

      const check = filterMap[activeFilter];
      return check ? check() : true;
    });

    const compare = (a, b) => {
      if (activeSort === 'score') {
        const sa = a.catalystScore ?? -1;
        const sb = b.catalystScore ?? -1;
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
        return (b.catalystScore ?? -1) - (a.catalystScore ?? -1);
      }
      if (activeSort === 'recency') {
        const da = a.catalysts?.[0]?.daysAgo ?? 9999;
        const db = b.catalysts?.[0]?.daysAgo ?? 9999;
        return da - db;
      }
      if (activeSort === 'significance') {
        const ord = { CRITICAL: 5, HIGH: 4, MODERATE: 3, LOW: 2, UNKNOWN: 1 };
        const sa = ord[a.significance] || 0;
        const sb = ord[b.significance] || 0;
        if (sb !== sa) return sb - sa;
        return (b.catalystScore ?? -1) - (a.catalystScore ?? -1);
      }
      if (activeSort === 'reliability') {
        const ord = { VERIFIED: 5, HIGH: 4, MODERATE: 3, LOW: 2, UNAVAILABLE: 1 };
        const sa = ord[a.reliability] || 0;
        const sb = ord[b.reliability] || 0;
        if (sb !== sa) return sb - sa;
        return (b.catalystScore ?? -1) - (a.catalystScore ?? -1);
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
    { key: 'VERIFIED', label: 'VERIFIED' },
    { key: 'HIGH', label: 'HIGH Reliability' },
    { key: 'RECENT', label: 'RECENT' },
    { key: 'UPCOMING', label: 'UPCOMING' },
    { key: 'EARNINGS', label: 'EARNINGS' },
    { key: 'SEC', label: 'SEC' },
    { key: 'OFFERING', label: 'OFFERING' },
    { key: 'MATERIAL_EVENT', label: 'MATERIAL_EVENT' },
    { key: 'INSIDER', label: 'INSIDER' },
    { key: 'REGULATORY', label: 'REGULATORY' },
    { key: 'NO_CATALYST', label: 'NO_CATALYST' },
  ];

  const sortOptions = [
    { key: 'score', label: 'الدرجة' },
    { key: 'quality', label: 'الجودة' },
    { key: 'recency', label: 'Recency' },
    { key: 'significance', label: 'Significance' },
    { key: 'reliability', label: 'Reliability' },
    { key: 'data_completeness', label: 'البيانات' },
  ];

  return (
    <section style={{ ...panel, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#EC4899', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            ⚡ CATALYST INTELLIGENCE · B6
          </div>
          <h3 style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 900, margin: 0 }}>
            رادار المحفزات (Catalyst Radar)
          </h3>
        </div>
        <div style={{ fontSize: 9, color: '#64748B' }}>
          {data.length} نتيجة · تم فحص {catalystData?.scanned || 0} رمز
        </div>
      </div>

      <p style={{ color: '#64748B', fontSize: 10, marginBottom: 12 }}>
        يعتمد على بيانات SEC EDGAR (A6) و Yahoo Finance عبر market-engine.js. لا يتم اختلاق أي محفزات.
        يركز على Form 4، Form 144، 8-K، S-1، S-3، 424B5، 10-K، 10-Q، 6-K، 20-F وتواريخ الأرباح.
      </p>

      {catalystData && catalystData.dataAvailability && (
        <AvailabilityIndicator dataAvailability={catalystData.dataAvailability} />
      )}

      {topOpportunities.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#EC4899', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            ⚡ أفضل فرص المحفزات
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
              border: activeFilter === opt.key ? '1px solid #EC4899' : '1px solid #1F2636',
              backgroundColor: activeFilter === opt.key ? '#0B0F17' : '#05060D',
              color: activeFilter === opt.key ? '#EC4899' : '#94A3B8',
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
        <div style={{ color: '#94A3B8', fontSize: 12, padding: 20 }}>⏳ جاري تحميل بيانات المحفزات…</div>
      ) : filteredAndSorted.length === 0 ? (
        <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>
          لا توجد أسهم مطابقة لمعايير التصفية المحددة.
        </div>
      ) : (
        <CatalystTable data={filteredAndSorted} />
      )}

      <div style={{ fontSize: 9, color: '#475569', marginTop: 12, lineHeight: 1.6 }}>
        <div>🚫 بيانات SEC محدودة للتقديرات العامة — لا يتم اختراع محفزات</div>
        <div>🚫 Form 4 transaction direction (buy/sell) يتطلب تحليل محتوى المستند — غير متاح عبر JSON submissions</div>
        <div>🚫 محتوى التقديرات غير محلل — يتم تحليل البيانات الوصفية فقط</div>
        <div>🚫 لا يتم اختلاق أي قيم — البيانات المفقودة تبقى null</div>
        <div>⚠️ التحليل فقط — ليس توصية شراء/بيع. مصدر البيانات: SEC EDGAR و Yahoo Finance.</div>
      </div>
    </section>
  );
}
