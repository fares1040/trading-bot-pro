'use client';

import React, { useMemo, useState } from 'react';

const panel = {
  backgroundColor: '#0B0F17',
  border: '1px solid #1F2636',
  borderRadius: '16px',
};

const regimeColor = {
  BULLISH: '#34D399',
  NEUTRAL: '#FBBF24',
  RISK_OFF: '#F87171',
  BEARISH: '#EF4444',
  UNAVAILABLE: '#475569',
};

const regimeBg = {
  BULLISH: 'rgba(52,211,153,0.08)',
  NEUTRAL: 'rgba(251,191,36,0.08)',
  RISK_OFF: 'rgba(248,113,113,0.08)',
  BEARISH: 'rgba(239,68,68,0.10)',
  UNAVAILABLE: 'rgba(71,85,105,0.08)',
};

const confidenceColor = {
  HIGH: '#34D399',
  MODERATE: '#22C55E',
  LOW: '#F87171',
  VERY_LOW: '#EF4444',
  UNKNOWN: '#475569',
};

const severityColor = {
  HIGH: '#EF4444',
  MEDIUM: '#F59E0B',
  LOW: '#64748B',
};

function Tag({ value, color }) {
  if (value == null || value === '') return null;
  return (
    <span style={{
      color: color || '#64748B', fontSize: 9, fontWeight: 700,
      backgroundColor: (color || '#64748B') + '1A', border: '1px solid ' + (color || '#64748B') + '40',
      padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.3,
    }}>{value}</span>
  );
}

function SmallTag({ value, color }) {
  if (value == null || value === '') return null;
  return (
    <span style={{
      color: color || '#64748B', fontSize: 8, fontWeight: 600,
      backgroundColor: (color ? color + '1A' : '#1E293B'), border: '1px solid ' + (color ? color + '40' : '#334155'),
      padding: '1px 6px', borderRadius: 4, letterSpacing: 0.3,
    }}>{value}</span>
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

function ScoreBar({ score, max = 100, color }) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div style={{ height: 6, backgroundColor: '#1E293B', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: pct + '%', backgroundColor: color || '#38BDF8', transition: 'width 0.3s' }} />
    </div>
  );
}

function EvidenceCard({ evidence }) {
  return (
    <div style={{ ...panel, padding: 10, borderRadius: 8, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: '#FBBF24', fontSize: 10, fontWeight: 700 }}>{evidence.component || 'Evidence'}</span>
        {evidence.score != null && (
          <span style={{ color: '#38BDF8', fontSize: 9, fontFamily: 'monospace', fontWeight: 700 }}>{evidence.score}/100</span>
        )}
      </div>
      {evidence.label && <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 4 }}>{evidence.label}</div>}
      {evidence.factors && evidence.factors.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {evidence.factors.slice(0, 4).map((f, i) => (
            <SmallTag key={i} value={typeof f === 'object' ? (f.name + ' ' + (f.change >= 0 ? '+' : '') + f.change.toFixed(2) + '%') : String(f)} color="#64748B" />
          ))}
        </div>
      )}
    </div>
  );
}

function ComponentTable({ components }) {
  const rows = [
    ['Trend', 'trend'],
    ['Momentum', 'momentum'],
    ['Breadth', 'breadth'],
    ['Volume', 'volume'],
    ['Volatility', 'volatility'],
  ];
  const hasAny = rows.some(([, k]) => components[k] && components[k].score != null);
  if (!hasAny) return null;
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 700 }}>Component</th>
            <th style={{ textAlign: 'center', padding: '6px 8px', color: '#64748B', fontWeight: 700 }}>Score</th>
            <th style={{ textAlign: 'center', padding: '6px 8px', color: '#64748B', fontWeight: 700 }}>Weight</th>
            <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 700 }}>Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, key]) => {
            const c = components[key] || {};
            const score = c.score;
            return (
              <tr key={key} style={{ borderBottom: '1px solid #1F2636' }}>
                <td style={{ padding: '6px 8px', color: '#CBD5E1' }}>{label}</td>
                <td style={{ textAlign: 'center', padding: '6px 8px', color: score != null ? '#F8FAFC' : '#475569', fontFamily: 'monospace', fontWeight: 700 }}>
                  {score ?? '—'}
                </td>
                <td style={{ textAlign: 'center', padding: '6px 8px', color: '#94A3B8', fontFamily: 'monospace' }}>
                  {c.weight != null ? c.weight : '—'}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(c.flags || []).slice(0, 3).map((f) => (
                      <SmallTag key={f} value={f} color="#818CF8" />
                    ))}
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

function LabelRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10, color: "#CBD5E1", lineHeight: 1.7 }}>
      <span style={{ color: "#64748B" }}>{label}</span>
      <span style={{ color: value != null ? "#F8FAFC" : "#475569", fontFamily: "monospace", fontWeight: 700 }}>{value ?? "—"}</span>
    </div>
  );
}
function ProvenanceRow({ provenance }) {
  const entries = Object.entries(provenance || {}).filter(([k]) => k !== 'intelligence' && k !== 'engine');
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: '#64748B', fontSize: 9, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Provenance</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {entries.map(([k, v]) => (
          <SmallTag key={k} value={k + ': ' + (v || '—')} color={v ? '#818CF8' : '#475569'} />
        ))}
      </div>
    </div>
  );
}

function FreshnessRow({ freshness }) {
  if (!freshness) return null;
  return (
    <div style={{ marginTop: 8, fontSize: 9, color: '#64748B' }}>
      Evaluated: {freshness.evaluatedAt ? new Date(freshness.evaluatedAt).toLocaleTimeString('ar-SA') : '—'}
      {freshness.universeSize != null ? ' · Universe ' + freshness.universeSize : ''}
      {freshness.indexCount != null ? ' · Indices ' + freshness.indexCount : ''}
    </div>
  );
}

function LimitationsList({ limitations }) {
  if (!limitations || limitations.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: '#64748B', fontSize: 9, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Limitations</div>
      {limitations.map((l, i) => (
        <div key={i} style={{ fontSize: 9, color: '#94A3B8', lineHeight: 1.5 }}>· {l}</div>
      ))}
    </div>
  );
}function RegimeDetail({ regime, regimeScore, confidence, confidenceLevel, dataCompleteness, flags }) {
  const color = regimeColor[regime] || '#475569';
  const bg = regimeBg[regime] || 'rgba(71,85,105,0.08)';
  return (
    <div style={{ ...panel, padding: 20, background: bg, border: '1px solid ' + color + '44' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#38BDF8', fontSize: 10, fontWeight: 900, letterSpacing: 1, marginBottom: 6 }}>
            CURRENT MARKET REGIME
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1.1 }}>
            {regime || 'UNAVAILABLE'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#64748B', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Score</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#F8FAFC', fontFamily: 'monospace' }}>
            {regimeScore ?? '—'}
          </div>
          <ScoreBar score={regimeScore ?? 0} color={color} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        <Tag value={confidenceLevel} color={confidenceColor[confidenceLevel]} />
        {regimeScore != null && <Tag value={regimeScore + '/100'} color={color} />}
        {dataCompleteness != null && (
          <Tag value={'Data ' + dataCompleteness + '%'} color={dataCompleteness >= 70 ? '#34D399' : dataCompleteness >= 40 ? '#FBBF24' : '#F87171'} />
        )}
        {(flags || []).slice(0, 4).map((f) => (
          <SmallTag key={f} value={f} color={color} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
        <div style={{ ...panel, padding: 10, background: '#07090E' }}>
          <div style={{ color: '#64748B', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Confidence</div>
          <div style={{ color: confidenceColor[confidenceLevel], fontSize: 16, fontWeight: 900, fontFamily: 'monospace' }}>
            {confidence ?? 0}
          </div>
        </div>
        <div style={{ ...panel, padding: 10, background: '#07090E' }}>
          <div style={{ color: '#64748B', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Data</div>
          <div style={{ color: '#38BDF8', fontSize: 16, fontWeight: 900, fontFamily: 'monospace' }}>
            {dataCompleteness ?? 0}%
          </div>
        </div>
        <div style={{ ...panel, padding: 10, background: '#07090E' }}>
          <div style={{ color: '#64748B', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Components</div>
          <div style={{ color: '#A78BFA', fontSize: 16, fontWeight: 900, fontFamily: 'monospace' }}>
            {Object.keys(components).filter((k) => components[k] && components[k].score != null).length}
          </div>
        </div>
      </div>
    </div>
  );
}function ReasonList({ reasons, color }) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: color || '#FBBF24', fontSize: 9, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reasons</div>
      {reasons.slice(0, 6).map((r, i) => (
        <div key={i} style={{ fontSize: 9, color: '#CBD5E1', lineHeight: 1.5, marginBottom: 2 }}>• {r}</div>
      ))}
    </div>
  );
}

function RiskList({ risks }) {
  if (!risks || risks.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: '#F87171', fontSize: 9, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Risks</div>
      {risks.slice(0, 5).map((r, i) => (
        <div key={i} style={{ fontSize: 9, lineHeight: 1.5, marginBottom: 2 }}>
          <span style={{ color: severityColor[r.severity] || '#64748B', fontWeight: 700 }}>[{r.severity || 'LOW'}]</span>
          <span style={{ color: '#CBD5E1' }}> {r.label}{r.description ? ' — ' + r.description : ''}</span>
        </div>
      ))}
    </div>
  );
}

function WarningList({ warnings }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ color: '#F59E0B', fontSize: 9, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Warnings</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {warnings.slice(0, 6).map((w) => (
          <SmallTag key={w} value={w} color="#F59E0B" />
        ))}
      </div>
    </div>
  );
}

export default function MarketRegimeRadar({ regimeData, loading }) {
  const data = regimeData || null;
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredEvidence = useMemo(() => {
    const ev = data?.supportingEvidence || [];
    if (!ev.length) return [];
    if (activeFilter === 'all') return ev;
    if (activeFilter === 'trend') return ev.filter((e) => e.component === 'trend');
    if (activeFilter === 'momentum') return ev.filter((e) => e.component === 'momentum');
    if (activeFilter === 'breadth') return ev.filter((e) => e.component === 'breadth');
    if (activeFilter === 'volume') return ev.filter((e) => e.component === 'volume');
    if (activeFilter === 'volatility') return ev.filter((e) => e.component === 'volatility');
    return ev;
  }, [data?.supportingEvidence, activeFilter]);

  const components = useMemo(() => {
    const comps = {};
    for (const [k, v] of Object.entries(data?.componentWeights || {})) {
      comps[k] = { weight: v, ...(data.components && data.components[k] ? data.components[k] : {}) };
    }
    return comps;
  }, [data]);

  const filterOptions = [
    { key: 'all', label: 'All' },
    { key: 'trend', label: 'Trend' },
    { key: 'momentum', label: 'Momentum' },
    { key: 'breadth', label: 'Breadth' },
    { key: 'volume', label: 'Volume' },
    { key: 'volatility', label: 'Volatility' },
  ];

  return (
    <section style={{ ...panel, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#38BDF8', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            MARKET REGIME · C10
          </div>
          <h3 style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 900, margin: 0 }}>
            سياق السوق
          </h3>
        </div>
        <div style={{ fontSize: 9, color: '#64748B' }}>
          {data?.regime || 'UNAVAILABLE'}
        </div>
      </div>

      <p style={{ color: '#64748B', fontSize: 10, marginBottom: 12 }}>
        Determines the current broad-market environment. Provides regime context to Hunter AI.
        Not a buy/sell signal. Missing evidence stays null — never fabricated.
      </p>

      {loading ? (
        <div style={{ color: '#94A3B8', fontSize: 12, padding: 20 }}>⏳ جاري تحميل سياق السوق…</div>
      ) : !data ? (
        <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>لا توجد بيانات سياق متاحة حالياً.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <RegimeDetail
              regime={data.regime}
              regimeScore={data.regimeScore}
              confidence={data.confidence}
              confidenceLevel={data.confidenceLevel}
              dataCompleteness={data.dataCompleteness}
              flags={data.flags}
            />

            <div style={{ ...panel, padding: 16 }}>
              <div style={{ color: '#A78BFA', fontSize: 10, fontWeight: 900, marginBottom: 8, letterSpacing: 0.5 }}>COMPONENT BREAKDOWN</div>
              <ComponentTable components={components} componentWeights={data.componentWeights} />
            </div>

            <div style={{ ...panel, padding: 16 }}>
              <div style={{ color: '#FBBF24', fontSize: 10, fontWeight: 900, marginBottom: 8, letterSpacing: 0.5 }}>Supporting Evidence</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {filterOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setActiveFilter(opt.key)}
                    style={{
                      fontSize: 10, fontWeight: 600, padding: '4px 12px', borderRadius: 8,
                      border: activeFilter === opt.key ? '1px solid #38BDF8' : '1px solid #1F2636',
                      backgroundColor: activeFilter === opt.key ? '#0B0F17' : '#05060D',
                      color: activeFilter === opt.key ? '#38BDF8' : '#94A3B8',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {filteredEvidence.length === 0 ? (
                <div style={{ color: '#64748B', fontSize: 12, padding: 16 }}>No evidence available for this component.</div>
              ) : (
                filteredEvidence.map((e, i) => (
                  <EvidenceCard key={i} evidence={e} />
                ))
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...panel, padding: 16 }}>
              <ReasonList reasons={data.reasons} color={regimeColor[data.regime] || '#FBBF24'} />
              <WarningList warnings={data.warnings} />
              <RiskList risks={data.risks} />
            </div>

            <div style={{ ...panel, padding: 16 }}>
              <div style={{ color: '#818CF8', fontSize: 10, fontWeight: 900, marginBottom: 8, letterSpacing: 0.5 }}>Audit</div>
              <LevelRow label="Total weight used" value={data.totalWeightUsed} />
              <LevelRow label="Data completeness" value={(data.dataCompleteness ?? 0) + '%'} />
              <ProvenanceRow provenance={data.provenance} />
              <FreshnessRow freshness={data.freshness} />
              <LimitationsList limitations={data.limitations} />
            </div>

            <div style={{ ...panel, padding: 12, background: '#07090E', border: '1px solid #1F2636' }}>
              <div style={{ fontSize: 9, color: '#64748B', lineHeight: 1.6 }}>
                {data.disclaimer}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}