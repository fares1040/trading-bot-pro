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

const riskColor = {
  none: '#34D399',
  low: '#34D399',
  moderate: '#FBBF24',
  high: '#F87171',
  extreme: '#EF4444',
  unavailable: '#475569',
};

const dataStatusColor = {
  complete: '#34D399',
  partial: '#FBBF24',
  unavailable: '#475569',
};

const scoreColor = (score) => {
  if (score == null) return '#475569';
  if (score >= 85) return '#34D399';
  if (score >= 70) return '#22C55E';
  if (score >= 55) return '#FBBF24';
  if (score >= 40) return '#F87171';
  return '#475569';
};

const categoryColor = {
  MATERIAL_EVENT: '#EF4444',
  INSIDER_BUYING: '#34D399',
  INSIDER_SELLING: '#F87171',
  OFFERING: '#818CF8',
  DILUTION_RISK: '#F87171',
  SHELF_REGISTRATION: '#818CF8',
  ATM_CAPITAL_RAISE: '#818CF8',
  FINANCING: '#F59E0B',
  EARNINGS: '#22C55E',
  CORPORATE_UPDATE: '#60A5FA',
  OWNERSHIP_CHANGE: '#FBBF24',
  REGULATORY_EVENT: '#A78BFA',
  OTHER: '#64748B',
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
    secEdgarScore, quality, componentScores, filingCategory,
    latestFiling, reasons, warnings, flags, dataCompleteness,
    dilutionRisk, offeringRisk, insiderActivity, materialEventInfo,
    secRiskScore, secRiskLevel, dataAvailability,
  } = data || {};

  const catColor = categoryColor[filingCategory] || '#64748B';

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
        <ScorePill score={secEdgarScore} label="SEC Score" />
        <ScorePill score={componentScores?.filingSignificance} label="Signif" />
        <ScorePill score={componentScores?.filingRecency} label="Recency" />
        <ScorePill score={componentScores?.materialEvent} label="Material" />
        <ScorePill score={componentScores?.insiderSignal} label="Insider" />
        <ScorePill score={componentScores?.capitalStructure} label="Capital" />
        <ScorePill score={componentScores?.dataCompleteness} label="Data" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {filingCategory && filingCategory !== 'OTHER' && (
          <SmallTag value={filingCategory} color={catColor} />
        )}
        {latestFiling?.form && (
          <SmallTag value={latestFiling.form} color={catColor} />
        )}
        {latestFiling?.daysAgo != null && (
          <SmallTag value={`${latestFiling.daysAgo}d`} color="#60A5FA" />
        )}
        {dilutionRisk && dilutionRisk !== 'unavailable' && dilutionRisk !== 'none' && (
          <SmallTag value={`Dilution:${dilutionRisk}`} color={riskColor[dilutionRisk] || '#64748B'} />
        )}
        {offeringRisk && offeringRisk !== 'unavailable' && offeringRisk !== 'none' && (
          <SmallTag value={`Offering:${offeringRisk}`} color={riskColor[offeringRisk] || '#64748B'} />
        )}
        {dataCompleteness != null && (
          <SmallTag value={`Data ${dataCompleteness}%`} color={dataStatusColor[dataCompleteness >= 70 ? 'complete' : dataCompleteness >= 40 ? 'partial' : 'unavailable']} />
        )}
        {secRiskScore != null && (
          <SmallTag value={`Risk:${secRiskScore}`} color={riskColor[secRiskLevel] || '#475569'} />
        )}
      </div>

      {latestFiling && (
        <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6, lineHeight: 1.6 }}>
          📄 {latestFiling.form || '—'} · {latestFiling.filingDate || '—'} · {latestFiling.daysAgo != null ? `${latestFiling.daysAgo}d ago` : '—'}
          {latestFiling.accessionNumber && (
            <span style={{ color: '#64748B' }}> · {latestFiling.accessionNumber}</span>
          )}
        </div>
      )}

      {insiderActivity?.form4Detected && (
        <div style={{ fontSize: 10, color: '#CBD5E1', marginBottom: 6, lineHeight: 1.6 }}>
          👤 Form 4: {insiderActivity.filingCount} filing(s) · {insiderActivity.daysAgo != null ? `${insiderActivity.daysAgo}d ago` : '—'}
          {insiderActivity.direction && (
            <span style={{ color: insiderActivity.direction === 'BUY' ? '#34D399' : '#F87171' }}>
              {' · ' + insiderActivity.direction}
            </span>
          )}
          {insiderActivity.transactionValue != null && (
            <span style={{ color: '#64748B' }}> · ${insiderActivity.transactionValue.toLocaleString()}</span>
          )}
        </div>
      )}

      {materialEventInfo?.materialEventDetected && (
        <div style={{ fontSize: 10, color: '#F87171', marginBottom: 6, lineHeight: 1.6 }}>
          ⚡ 8-K material event · {materialEventInfo.daysAgo != null ? `${materialEventInfo.daysAgo}d ago` : 'recent'}
        </div>
      )}

      {dilutionRisk && dilutionRisk !== 'unavailable' && dilutionRisk !== 'none' && (
        <div style={{ fontSize: 10, color: '#F87171', marginBottom: 6, lineHeight: 1.6 }}>
          ⚠️ Dilution risk: {dilutionRisk} - {latestFiling?.form && ['S-1', 'S-3', '424B'].includes(latestFiling.form) ? 'Filing-based detection' : 'No dilution filings'}
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
            Data: Filings:{dataAvailability.filings ? '✓' : '—'} · Insider:{dataAvailability.insiderActivity ? '✓' : '—'} ·
            Material:{dataAvailability.materialEvents ? '✓' : '—'} · Risk:{dataAvailability.secRiskScore ? '✓' : '—'}
          </div>
        )}
      </div>
    </div>
  );
}

function SecEdgarTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>
        لا توجد بيانات SEC EDGAR متاحة حالياً.
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
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Filing</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Date</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Category</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Insider</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Dilution</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Offering</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Data %</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748B', fontWeight: 700 }}>Flags</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.symbol} style={{ borderBottom: '1px solid #1F2636' }}>
              <td style={{ padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>{item.symbol || '—'}</td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: scoreColor(item.secEdgarScore), fontFamily: 'monospace', fontWeight: 700 }}>
                {item.secEdgarScore ?? '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <Tag value={item.quality} colorMap={qualityColor} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#CBD5E1', fontFamily: 'monospace' }}>
                {item.latestFiling?.form || '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px', color: '#94A3B8' }}>
                {item.latestFiling?.filingDate || '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                <SmallTag value={item.filingCategory} color={categoryColor[item.filingCategory] || '#64748B'} />
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                {item.insiderActivity?.form4Detected ? (
                  <SmallTag value={`Form 4 (${item.insiderActivity.filingCount})`} color="#34D399" />
                ) : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                {item.dilutionRisk && item.dilutionRisk !== 'unavailable' && item.dilutionRisk !== 'none' ? (
                  <SmallTag value={item.dilutionRisk} color={riskColor[item.dilutionRisk] || '#64748B'} />
                ) : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                {item.offeringRisk && item.offeringRisk !== 'unavailable' && item.offeringRisk !== 'none' ? (
                  <SmallTag value={item.offeringRisk} color={riskColor[item.offeringRisk] || '#64748B'} />
                ) : '—'}
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

export default function SecEdgarRadar({ secEdgarData, loading }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('score');

  const data = secEdgarData?.data || [];
  const topOpportunities = secEdgarData?.top || [];
  const alternatives = secEdgarData?.alternatives || [];

  const filteredAndSorted = useMemo(() => {
    let result = data.filter((item) => {
      if (activeFilter === 'all') return true;
      if (['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'].includes(activeFilter)) {
        return item.quality === activeFilter;
      }
      if (activeFilter === 'insider') return item.insiderActivity?.form4Detected === true;
      if (activeFilter === 'offering') return item.offeringRisk !== 'unavailable' && item.offeringRisk !== 'none';
      if (activeFilter === 'dilution') return item.dilutionRisk !== 'unavailable' && item.dilutionRisk !== 'none';
      if (activeFilter === 'material') return item.materialEventInfo?.materialEventDetected === true;
      if (activeFilter === 'recent') {
        return item.latestFiling?.daysAgo != null && item.latestFiling.daysAgo <= 7;
      }
      return true;
    });

    const compare = (a, b) => {
      if (activeSort === 'score') return (b.secEdgarScore ?? -1) - (a.secEdgarScore ?? -1);
      if (activeSort === 'quality') {
        const qOrder = { TOP: 5, STRONG: 4, WATCH: 3, WEAK: 2, UNAVAILABLE: 1 };
        return (qOrder[b.quality] || 0) - (qOrder[a.quality] || 0);
      }
      if (activeSort === 'recency') {
        const da = a.latestFiling?.daysAgo ?? 9999;
        const db = b.latestFiling?.daysAgo ?? 9999;
        return da - db;
      }
      if (activeSort === 'significance') return (b.componentScores?.filingSignificance ?? -1) - (a.componentScores?.filingSignificance ?? -1);
      if (activeSort === 'risk') {
        const ra = a.secRiskScore ?? 100;
        const rb = b.secRiskScore ?? 100;
        return rb - ra;
      }
      if (activeSort === 'data') return (b.dataCompleteness ?? -1) - (a.dataCompleteness ?? -1);
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
    { key: 'insider', label: 'Insider' },
    { key: 'offering', label: 'Offering' },
    { key: 'dilution', label: 'Dilution' },
    { key: 'material', label: 'Material Event' },
    { key: 'recent', label: 'Recent (7d)' },
  ];

  const sortOptions = [
    { key: 'score', label: 'الدرجة' },
    { key: 'quality', label: 'الجودة' },
    { key: 'recency', label: 'Recency' },
    { key: 'significance', label: 'Significance' },
    { key: 'risk', label: 'Risk' },
    { key: 'data', label: 'البيانات' },
  ];

  return (
    <section style={{ ...panel, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#818CF8', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            📋 SEC EDGAR INTELLIGENCE · A6
          </div>
          <h3 style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 900, margin: 0 }}>
            رادار الأنظمة المالية SEC EDGAR
          </h3>
        </div>
        <div style={{ fontSize: 9, color: '#64748B' }}>
          {data.length} نتيجة · تم فحص {secEdgarData?.scanned || 0} رمز
        </div>
      </div>

      <p style={{ color: '#64748B', fontSize: 10, marginBottom: 12 }}>
        يعتمد على بيانات SEC EDGAR العامة. لا يتم اختلاق بيانات. يركز على Form 4، Form 144، 8-K، S-1، S-3، 424B5، 10-K، 10-Q، 6-K، 20-F.
      </p>

      {topOpportunities.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#818CF8', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            🏆 أفضل فرص SEC EDGAR
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
              border: activeFilter === opt.key ? '1px solid #818CF8' : '1px solid #1F2636',
              backgroundColor: activeFilter === opt.key ? '#0B0F17' : '#05060D',
              color: activeFilter === opt.key ? '#818CF8' : '#94A3B8',
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
        <div style={{ color: '#94A3B8', fontSize: 12, padding: 20 }}>⏳ جاري تحميل بيانات SEC EDGAR…</div>
      ) : (
        <SecEdgarTable data={filteredAndSorted} />
      )}

      <div style={{ fontSize: 9, color: '#475569', marginTop: 12, lineHeight: 1.6 }}>
        <div>🚫 SEC EDGAR data does not include real-time prices or volume</div>
        <div>🚫 Form 4 transaction direction (buy/sell) requires document-level parsing — not available via submissions JSON</div>
        <div>🚫 Filing content is not parsed — only metadata is analyzed</div>
        <div>🚫 لا يتم اختلاق أي قيم — البيانات المفقودة تبقى null</div>
        <div>⚠️ التحليل فقط — ليس توصية شراء/بيع. مصدر البيانات: SEC EDGAR العامة</div>
      </div>
    </section>
  );
}
