'use client';

import React, { useState, useMemo, useEffect } from 'react';

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

const qualityColor = {
  TOP: '#34D399',
  STRONG: '#22C55E',
  WATCH: '#FBBF24',
  WEAK: '#F87171',
  UNAVAILABLE: '#475569',
};

const confidenceColor = {
  HIGH: '#34D399',
  MODERATE: '#22C55E',
  LOW: '#F87171',
  VERY_LOW: '#EF4444',
  UNKNOWN: '#475569',
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

const periodColor = (completeness) => {
  if (completeness >= 70) return '#34D399';
  if (completeness >= 40) return '#FBBF24';
  return completeness >= 0 ? '#F87171' : '#475569';
};

const REGIME_LABELS = Object.freeze({
  BULLISH: 'BULLISH',
  NEUTRAL: 'NEUTRAL',
  RISK_OFF: 'RISK_OFF',
  BEARISH: 'BEARISH',
  UNAVAILABLE: 'UNAVAILABLE',
});

function Tag({ value, colorMap }) {
  const color = colorMap[value] || '#475569';
  if (value == null || value === '') return null;
  return (
    <span style={{
      color,
      fontSize: 9,
      fontWeight: 700,
      backgroundColor: color + '1A',
      border: '1px solid ' + color + '40',
      padding: '2px 8px',
      borderRadius: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    }}>
      {value}
    </span>
  );
}

function SmallTag({ value, color }) {
  if (!value && value !== 0) return null;
  return (
    <span style={{
      color: color || '#64748B',
      fontSize: 8,
      fontWeight: 600,
      backgroundColor: (color ? color + '1A' : '#1E293B'),
      border: '1px solid ' + (color ? color + '40' : '#334155'),
      padding: '1px 6px',
      borderRadius: 4,
      letterSpacing: 0.3,
    }}>
      {value}
    </span>
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

function MarketRegimeCard({ data }) {
  if (!data.available) {
    return (
      <div style={{ ...panel, padding: 20, borderLeft: '4px solid #475569' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
          Market Regime: UNAVAILABLE
        </div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>
          {data.limitations || 'Market regime data could not be loaded.'}
        </div>
      </div>
    );
  }

  const color = regimeColor[data.regime] || '#475569';

  return (
    <div style={{ ...panel, padding: 20, background: color + '10', borderLeft: '4px solid ' + color }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: 1 }}>
            Market Regime
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color, marginTop: 4 }}>
            {data.regime}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#F8FAFC', fontFamily: 'monospace' }}>
            {data.regimeScore ?? '—'}
          </div>
          <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>Score/100</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Tag value={data.confidenceLevel} colorMap={confidenceColor} />
        {data.regimeScore != null && <Tag value={data.regimeScore + '/100'} color={color} />}
        {data.dataCompleteness != null && (
          <SmallTag value={'Data ' + data.dataCompleteness + '%'} color={periodColor(data.dataCompleteness)} />
        )}
      </div>

      {data.reasons && data.reasons.length > 0 && (
        <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.6 }}>
          {data.reasons.slice(0, 3).map((r, i) => (
            <div key={i}>• {r}</div>
          ))}
        </div>
      )}

      {data.freshness && (
        <div style={{ fontSize: 10, color: '#64748B', marginTop: 8 }}>
          Last evaluated: {data.freshness.evaluatedAt ? new Date(data.freshness.evaluatedAt).toLocaleTimeString('ar-SA') : '—'}
        </div>
      )}

      <div style={{ fontSize: 10, color: '#475569', marginTop: 8, lineHeight: 1.4 }}>
        {data.disclaimer || data.limitations || data.limitations}
      </div>
    </div>
  );
}

function OpportunityCard({ item }) {
  return (
    <div style={{ ...panel, padding: 12, minWidth: 260, maxWidth: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ color: '#F8FAFC', fontFamily: 'monospace', fontSize: 13 }}>
          {item.symbol || '—'}
        </strong>
        <Tag value={item.quality} colorMap={qualityColor} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <SmallTag value={item.opportunityScore != null ? item.opportunityScore + '/100' : '—'} color="#38BDF8" />
        <SmallTag value={'Rank #' + (item.rank || '')} color="#94A3B8" />
        {item.confidenceLevel && <SmallTag value={item.confidenceLevel} color={confidenceColor[item.confidenceLevel]} />}
      </div>

      {item.risks && item.risks.slice(0, 2).map((r, i) => (
        <div key={i} style={{ fontSize: 10, color: '#F59E0B', marginBottom: 2 }}>
          [{r.severity}] {r.label}
        </div>
      ))}

      <div style={{ fontSize: 9, color: '#475569', marginTop: 6 }}>
        {item.dataAvailability && Object.values(item.dataAvailability).filter(Boolean).length} of 6 sources
      </div>
    </div>
  );
}

function TradePlanCard({ item }) {
  return (
    <div style={{ ...panel, padding: 12, minWidth: 260, maxWidth: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ color: '#F8FAFC', fontFamily: 'monospace', fontSize: 13 }}>
          {item.symbol || '—'}
        </strong>
        <Tag value={item.planQuality} colorMap={qualityColor} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <Tag value={item.planSignal} colorMap={signalColor} />
        <SmallTag value={item.direction || '—'} color={directionColor[item.direction] || '#94A3B8'} />
        {item.riskReward != null && (
          <SmallTag value={'R/R ' + item.riskReward} color={item.riskReward >= 2 ? '#34D399' : item.riskReward >= 1 ? '#FBBF24' : '#F87171'} />
        )}
      </div>

      <div style={{ fontSize: 11, color: '#CBD5E1', fontFamily: 'monospace', marginBottom: 6 }}>
        Stop: {item.stopLoss != null ? item.stopLoss : '—'} | T1: {item.target1 != null ? item.target1 : '—'}
      </div>

      {item.risks && item.risks.slice(0, 2).map((r, i) => (
        <div key={i} style={{ fontSize: 10, color: '#F59E0B', marginBottom: 2 }}>
          [{r.severity}] {r.label}
        </div>
      ))}
    </div>
  );
}

function SourceAvailabilityBar({ sources }) {
  const sourceLabels = [
    { key: 'PENNY', label: 'B1 Penny' },
    { key: 'OPTIONS', label: 'B2 Options' },
    { key: 'INSTITUTIONAL', label: 'B3 Inst' },
    { key: 'SWING', label: 'B4 Swing' },
    { key: 'EARLY_EXPLOSION', label: 'B5 Expl' },
    { key: 'CATALYST', label: 'B6 Catalyst' },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      {sourceLabels.map((src) => (
        <span
          key={src.key}
          style={{
            fontSize: 9,
            color: sources[src.key]?.available ? '#34D399' : '#475569',
            backgroundColor: sources[src.key]?.available ? '#142E1C' : '#1E293B',
            border: '1px solid ' + (sources[src.key]?.available ? '#14532D' : '#334155'),
            padding: '4px 10px',
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          {src.label}: {sources[src.key]?.available ? '✓' : '✗'}
        </span>
      ))}
    </div>
  );
}

function QualityBreakdown({ breakdown }) {
  if (!breakdown) return null;
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
      {Object.entries(breakdown).map(([q, count]) => (
        <div key={q} style={{ textAlign: 'center', minWidth: 55 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: qualityColor[q] || '#475569' }}>{count}</div>
          <div style={{ fontSize: 9, color: '#64748B' }}>{q}</div>
        </div>
      ))}
    </div>
  );
}

function IntelligenceCoverageCard({ data }) {
  if (!data.available) {
    return (
      <div style={{ ...panel, padding: 20 }}>
        <div style={{ color: '#94A3B8', fontSize: 12 }}>Intelligence coverage unavailable.</div>
      </div>
    );
  }

  return (
    <div style={{ ...panel, padding: 20 }}>
      <div style={{ color: '#38BDF8', fontSize: 10, fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
        INTELLIGENCE COVERAGE
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#F8FAFC', marginBottom: 12 }}>
        {data.coverageCount} / {data.totalSources} sources
      </div>

      <SourceAvailabilityBar sources={data.sources} />

      <div style={{ fontSize: 11, color: '#94A3B8' }}>
        {data.limitations}
      </div>
    </div>
  );
}

function RiskCenterCard({ data }) {
  if (!data.available && data.risks.length === 0) {
    return null;
  }

  return (
    <div style={{ ...panel, padding: 20 }}>
      <div style={{ color: '#F87171', fontSize: 10, fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
        RISK CENTER
      </div>

      {data.risks && data.risks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {data.risks.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: '#F59E0B', marginBottom: 4 }}>
              <span style={{ color: '#F87171', fontWeight: 600 }}>[{r.severity}]</span> {r.label}: {r.description}
            </div>
          ))}
        </div>
      )}

      {data.unavailableItems && data.unavailableItems.length > 0 && (
        <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Unavailable Items:</div>
          {data.unavailableItems.map((item, i) => (
            <div key={i}>• {item.symbol} ({item.source})</div>
          ))}
        </div>
      )}

      {data.lowDataItem && data.lowDataItem.length > 0 && (
        <div style={{ fontSize: 10, color: '#FBBF24' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Low Data Items:</div>
          {data.lowDataItem.map((item, i) => (
            <div key={i}>• {item.symbol} ({item.source}, {item.dataCompleteness}% complete)</div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionQueueCard({ data }) {
  return (
    <div style={{ ...panel, padding: 20 }}>
      <div style={{ color: '#FBBF24', fontSize: 10, fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
        ACTION QUEUE
      </div>

      {data.topOpportunities && data.topOpportunities.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#34D399', fontWeight: 600 }}>Top Opportunities</div>
          {data.topOpportunities.map((item) => (
            <div key={item.symbol} style={{ fontSize: 9, color: '#CBD5E1' }}>
              {item.symbol} ({item.quality}, {item.opportunityScore})
            </div>
          ))}
        </div>
      )}

      {data.validTradePlans && data.validTradePlans.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#34D399', fontWeight: 600 }}>Valid Trade Plans</div>
          {data.validTradePlans.map((item) => (
            <div key={item.symbol} style={{ fontSize: 9, color: '#CBD5E1' }}>
              {item.symbol} ({item.direction}, R/R {item.riskReward})
            </div>
          ))}
        </div>
      )}

      {data.regimeWarnings && data.regimeWarnings.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#F87171', fontWeight: 600 }}>Regime Warnings</div>
          {data.regimeWarnings.map((w, i) => (
            <div key={i} style={{ fontSize: 9, color: '#F59E0B' }}>
              {w.type}: {JSON.stringify(w)}
            </div>
          ))}
        </div>
      )}

      {data.highRiskItems && data.highRiskItems.length > 0 && (
        <div style={{ fontSize: 9, color: '#EF4444' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>High Risk Items:</div>
          {data.highRiskItems.map((item) => (
            <div key={item.symbol}>• {item.symbol}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommandCenter({ commandCenterData, loading }) {
  const [activeTab, setActiveTab] = useState('overview');

  const sections = useMemo(() => {
    return commandCenterData?.sections || {};
  }, [commandCenterData]);

  const summary = useMemo(() => {
    return commandCenterData?.summary || {};
  }, [commandCenterData]);

  const overview = useMemo(() => {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
        <MarketRegimeCard data={sections.marketRegime} />
        <IntelligenceCoverageCard data={sections.intelligenceCoverage} />
      </div>
    );
  }, [sections]);

  const opportunities = useMemo(() => {
    return sections.topOpportunities?.top || [];
  }, [sections]);

  const plans = useMemo(() => {
    return sections.tradePlans?.top || [];
  }, [sections]);

  const regime = useMemo(() => {
    return sections.marketRegime?.regime || REGIME_LABELS.UNAVAILABLE;
  }, [sections]);

  const regimeBackgroundColor = regimeColor[regime] || '#475569';

  const topSection = useMemo(() => {
    return (
      <div style={{ ...panel, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#38BDF8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          D11 COMMAND CENTER
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div style={{ ...panel, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#64748B' }}>Regime</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: regimeBackgroundColor }}>{regime}</div>
          </div>
          <div style={{ ...panel, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#64748B' }}>Opportunities</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#34D399' }}>{sections.topOpportunities?.count || 0}</div>
          </div>
          <div style={{ ...panel, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#64748B' }}>Trade Plans</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#34D399' }}>{plans.length}</div>
          </div>
          <div style={{ ...panel, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#64748B' }}>Intelligence Coverage</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#38BDF8' }}>
              {sections.intelligenceCoverage?.coverageCount || 0}/6 sources
            </div>
          </div>
        </div>

        {commandCenterData?.limitations && (
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            {commandCenterData.limitations}
          </div>
        )}
      </div>
    );
  }, [sections, regime]);

  const renderContent = () => {
    if (loading) {
      return <div style={{ color: '#94A3B8', fontSize: 12, padding: 20 }}>⏳ Loading Command Center...</div>;
    }

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {topSection}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div style={{ ...panel, padding: 16 }}>
            <div style={{ color: '#8B5CF6', fontSize: 10, fontWeight: 800, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              TOP OPPORTUNITIES · C7
            </div>
            {opportunities.length === 0 ? (
              <div style={{ color: '#64748B', fontSize: 12, padding: 12 }}>No high-quality opportunities available.</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {opportunities.map((item) => (
                  <OpportunityCard key={item.symbol} item={item} />
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <IntelligenceCoverageCard data={sections.intelligenceCoverage} />
            {sections.riskCenter && (
              <RiskCenterCard data={sections.riskCenter} />
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div style={{ ...panel, padding: 16 }}>
            <div style={{ color: '#8B5CF6', fontSize: 10, fontWeight: 800, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              TRADE PLANS · C8
            </div>
            {plans.length === 0 ? (
              <div style={{ color: '#64748B', fontSize: 12, padding: 12 }}>No valid trade plans available.</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {plans.map((item) => (
                  <TradePlanCard key={item.symbol} item={item} />
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {sections.whyNow && sections.whyNow.available && (
              <div style={{ ...panel, padding: 16 }}>
                <div style={{ color: '#FBBF24', fontSize: 10, fontWeight: 800, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                  WHY NOW
                </div>
                <div style={{ fontSize: 11, color: '#CBD5E1' }}>
                  {sections.whyNow.count || 0} active explanations
                </div>
                {sections.whyNow.top && sections.whyNow.top.slice(0, 3).map((item, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                    <strong>{item.factor}</strong>: {item.explanation}
                  </div>
                ))}
              </div>
            )}
            <ActionQueueCard data={sections.actionQueue} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <section style={{ ...panel, padding: 20, marginBottom: 24 }}>
      {renderContent()}
    </section>
  );
}