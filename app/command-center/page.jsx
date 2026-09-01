'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { colors, radius, panelStyle, scoreColor, riskRewardColor, formatPrice, formatPercent } from '@/components/ui/DesignTokens';
import { Tag, SmallTag, Panel, SectionTitle, EmptyState, LoadingState, ErrorState, Button, TabGroup, DirectionBadge, QualityBadge, StatusDot } from '@/components/ui/Primitives';
import { ALERT_STATUS, ALERT_LIFECYCLE_STAGES, deriveTradeStage, TRADE_LIFECYCLE, DecisionBanner } from '@/components/ui/Lifecycle';
import TopOpportunitiesPanel from '@/components/ui/OpportunityPanel';
import { NotificationAlertPanel, NotificationStatusFilter, NotificationLifecycleIndicator } from '@/components/ui/NotificationAlertPanel';
import { NOTIFICATION_STATUSES } from '@/lib/notification-contract';

const panel = { ...panelStyle };

const regimeColorMap = { BULLISH: '#34D399', NEUTRAL: '#FBBF24', RISK_OFF: '#F87171', BEARISH: '#EF4444', UNAVAILABLE: '#475569' };
const qualityColorMap = { TOP: '#34D399', STRONG: '#22C55E', WATCH: '#FBBF24', WEAK: '#F87171', UNAVAILABLE: '#475569' };
const confidenceColorMap = { HIGH: '#34D399', MODERATE: '#22C55E', LOW: '#F87171', VERY_LOW: '#EF4444', UNKNOWN: '#475569' };
const signalColorMap = { STRONG_PLAN: '#34D399', VALID_PLAN: '#22C55E', WATCH: '#FBBF24', AVOID: '#F87171', UNAVAILABLE: '#475569' };

function TopBar({ indices, regime, regimeScore, regimeConfidence, marketStatus, lastUpdate, loading }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      ...panel,
      padding: '10px 16px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    }}
    className="top-bar"
  >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: marketStatus?.open ? '#34D399' : '#EF4444', boxShadow: marketStatus?.open ? '0 0 8px #34D39960' : 'none' }} />
        <span style={{ color: marketStatus?.open ? '#34D399' : '#EF4444', fontSize: 11, fontWeight: 700 }}>
          {marketStatus?.label || (loading ? 'Loading…' : 'Market Unknown')}
        </span>
      </div>

      <div className="top-bar-divider" style={{ width: 1, height: 20, backgroundColor: colors.border }} />

      {indices.slice(0, 3).map((idx) => (
        <div key={idx.symbol} className="index-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: colors.text.faint, fontSize: 11, fontWeight: 700 }}>{idx.symbol}</span>
          <span style={{ color: colors.text.primary, fontSize: 11, fontFamily: 'inherit', fontWeight: 700 }}>
            {Number(idx.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
          <span style={{ color: idx.isUp ? '#34D399' : '#EF4444', fontSize: 10, fontWeight: 700 }}>
            {idx.isUp ? '▲' : '▼'} {Math.abs(Number(idx.change || 0)).toFixed(2)}%
          </span>
        </div>
      ))}

      <div className="top-bar-divider regime-divider" style={{ width: 1, height: 20, backgroundColor: colors.border }} />

      {regime && (
        <div className="regime-item" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: colors.text.faint, fontSize: 11 }}>Regime:</span>
          <span style={{ color: regimeColorMap[regime] || colors.text.disabled, fontSize: 11, fontWeight: 800 }}>
            {regime}
          </span>
          {regimeScore != null && (
            <SmallTag value={`${regimeScore}/100`} color={regimeColorMap[regime]} />
          )}
          {regimeConfidence && (
            <SmallTag value={regimeConfidence} color={confidenceColorMap[regimeConfidence] || colors.text.disabled} />
          )}
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: colors.text.faint, fontSize: 11, fontFamily: 'monospace' }}>{time}</span>
        {lastUpdate && (
          <span className="last-update" style={{ color: colors.text.faint, fontSize: 10 }}>
            Updated {new Date(lastUpdate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <style>{`
        @media (max-width: 768px) {
          .top-bar {
            gap: 8px !important;
            padding: 8px 12px !important;
          }
          .top-bar-divider {
            display: none !important;
          }
          .index-item {
            font-size: 10px !important;
          }
          .regime-divider {
            display: block !important;
            width: 100% !important;
            height: 1px !important;
            margin: 4px 0 !important;
          }
          .regime-item {
            flex-wrap: wrap !important;
          }
          .last-update {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function MarketContextCard({ regimeData }) {
  if (!regimeData?.available) {
    return (
      <div style={{ ...panel, padding: 16 }}>
        <div style={{ color: colors.text.muted, fontSize: 11 }}>Market context unavailable</div>
      </div>
    );
  }

  const regime = regimeData.regime || 'UNAVAILABLE';
  const regimeScore = regimeData.regimeScore ?? null;
  const regimeConfidence = regimeData.confidenceLevel || 'UNKNOWN';
  const dataCompleteness = regimeData.dataCompleteness ?? null;

  return (
    <div style={{ ...panel, padding: 16 }}>
      <SectionTitle label="Market Context" icon="📊" color={regimeColorMap[regime] || colors.text.disabled} />
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: regimeColorMap[regime], fontFamily: 'inherit', lineHeight: 1.1 }}>
            {regime}
          </div>
          <div style={{ color: colors.text.faint, fontSize: 9, marginTop: 2 }}>Market Regime</div>
        </div>
        {regimeScore != null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: colors.text.primary, fontFamily: 'monospace' }}>{regimeScore}</div>
            <div style={{ color: colors.text.faint, fontSize: 9 }}>/100</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <Tag value={regimeConfidence} colorMap={confidenceColorMap} size="sm" />
        {dataCompleteness != null && (
          <SmallTag value={`Data ${dataCompleteness}%`} color={dataCompleteness >= 70 ? '#34D399' : dataCompleteness >= 40 ? '#FBBF24' : '#F87171'} />
        )}
      </div>

      {regimeData.reasons?.length > 0 && (
        <div style={{ fontSize: 10, color: colors.text.muted, lineHeight: 1.6 }}>
          {regimeData.reasons.slice(0, 3).map((r, i) => <div key={i}>• {r}</div>)}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 9, color: colors.text.disabled, lineHeight: 1.5 }}>
        Source: C10 Market Regime Engine
      </div>
    </div>
  );
}

function WatchlistPanel({ opportunities }) {
  if (!opportunities?.length) {
    return (
      <div style={{ ...panel, padding: 16 }}>
        <SectionTitle label="Watchlist" icon="👁" color={colors.accent.blue} />
        <EmptyState icon="📋" message="No watchlist items" sub="Top opportunities will appear here" />
      </div>
    );
  }

  return (
    <div style={{ ...panel, padding: 16 }}>
      <SectionTitle label="Watchlist" icon="👁" color={colors.accent.blue} />
      <div className="responsive-table">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr>
              {['Ticker', 'Score', 'Quality', 'Direction', 'R/R', 'Conf', 'Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: colors.text.faint, fontWeight: 700, borderBottom: `1px solid ${colors.border}` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {opportunities.slice(0, 8).map(item => (
              <tr key={item.symbol} style={{ borderBottom: `1px solid ${colors.border}` }}>
                <td style={{ padding: '6px 8px', color: colors.text.primary, fontFamily: 'monospace', fontWeight: 700 }}>{item.symbol || '—'}</td>
                <td style={{ padding: '6px 8px', color: scoreColor(item.opportunityScore ?? item.setupScore), fontFamily: 'monospace', fontWeight: 700 }}>
                  {item.opportunityScore ?? item.setupScore ?? '—'}
                </td>
                <td style={{ padding: '6px 8px' }}><Tag value={item.quality} colorMap={qualityColorMap} size="sm" /></td>
                <td style={{ padding: '6px 8px' }}><Tag value={item.directionBias || item.direction} colorMap={{ LONG: '#34D399', SHORT: '#F87171', NEUTRAL: '#FBBF24', UNAVAILABLE: '#475569' }} size="sm" /></td>
                <td style={{ padding: '6px 8px', color: riskRewardColor(item.riskReward), fontFamily: 'monospace', fontWeight: 700 }}>
                  {item.riskReward ?? '—'}
                </td>
                <td style={{ padding: '6px 8px', color: colors.text.secondary, fontFamily: 'monospace' }}>
                  {item.confidence ?? '—'}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <StatusDot status={item.quality === 'TOP' || item.quality === 'STRONG' ? 'active' : 'watch'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpportunityDetailPanel({ symbol, opportunityData, tradePlanData, aiExplanationData }) {
  const opp = useMemo(() => {
    if (!opportunityData?.data) return null;
    return opportunityData.data.find(o => o.symbol === symbol);
  }, [opportunityData, symbol]);

  const plan = useMemo(() => {
    if (!tradePlanData?.data) return null;
    return tradePlanData.data.find(t => t.symbol === symbol);
  }, [tradePlanData, symbol]);

  const explanation = useMemo(() => {
    if (!aiExplanationData?.data) return null;
    return aiExplanationData.data.find(e => e.symbol === symbol);
  }, [aiExplanationData, symbol]);

  if (!symbol) {
    return (
      <div style={{ ...panel, padding: 24 }}>
        <EmptyState icon="🎯" message="Select an opportunity" sub="Click a ticker from the top opportunities to view its details" />
      </div>
    );
  }

  const tradeStage = plan ? deriveTradeStage(plan.planSignal, plan.riskReward, plan.planScore, plan.planQuality) : deriveTradeStage(null, null, null, null);

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: colors.text.primary, fontFamily: 'monospace' }}>
            {symbol}
          </div>
          {explanation?.headline && (
            <div style={{ fontSize: 11, color: colors.accent.gold, marginTop: 4, maxWidth: 400 }}>
              {explanation.headline}
            </div>
          )}
        </div>
        {opp && <Tag value={opp.quality || 'UNAVAILABLE'} colorMap={qualityColorMap} />}
      </div>

      <DecisionBanner
        decision={tradeStage.decision}
        reason={tradeStage.reason}
        stage={tradeStage.stage}
      />

      <div style={{ marginTop: 14, marginBottom: 14 }}>
        <TradeLifecycleStepper stage={tradeStage.stage} decision={tradeStage.decision} />
      </div>

      {plan && (
        <div style={{ backgroundColor: '#07090E', borderRadius: radius.md, padding: 12, marginBottom: 14 }}>
          <div style={{ color: colors.text.faint, fontSize: 10, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Trade Plan</div>
          <div className="trade-plan-grid">
            {[
              ['Entry', plan.entryZone ?? plan.entryPrice ?? '—'],
              ['Stop', plan.stopLoss ?? plan.invalidation ?? '—'],
              ['T1', plan.target1 ?? '—'],
              ['T2', plan.target2 ?? '—'],
              ['Inv.', plan.invalidation ?? '—'],
              ['R/R', plan.riskReward != null ? `${plan.riskReward}` : '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ color: colors.text.faint, fontSize: 9 }}>{label}</div>
                <div style={{ color: colors.text.primary, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>{value}</div>
              </div>
            ))}
          </div>
          <style>{`
            .trade-plan-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
            }
            @media (max-width: 480px) {
              .trade-plan-grid {
                grid-template-columns: repeat(2, 1fr);
              }
            }
          `}</style>
        </div>
      )}

      {opp && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: scoreColor(opp.opportunityScore ?? opp.setupScore), fontFamily: 'inherit' }}>
              {opp.opportunityScore ?? opp.setupScore ?? '—'}
            </div>
            <div style={{ color: colors.text.faint, fontSize: 8 }}>Opp Score</div>
          </div>
          {opp.confidenceLevel && <Tag value={opp.confidenceLevel} colorMap={confidenceColorMap} />}
          {opp.dataCompleteness != null && <SmallTag value={`Data ${opp.dataCompleteness}%`} color={opp.dataCompleteness >= 70 ? '#34D399' : '#FBBF24'} />}
          {opp.availableComponents && <SmallTag value={`${opp.availableComponents.length}/6 src`} color="#94A3B8" />}
        </div>
      )}

      {explanation?.whyNow?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: colors.accent.amber, fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Why Now
          </div>
          {explanation.whyNow.slice(0, 3).map((f, i) => (
            <div key={i} style={{ fontSize: 10, color: colors.text.secondary, lineHeight: 1.5, marginBottom: 4 }}>
              <span style={{ color: colors.accent.amber, fontWeight: 700 }}>•</span> {f.factor}: {f.explanation}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, color: colors.text.disabled, lineHeight: 1.5 }}>
        Source: C7+C8+C9 Intelligence Aggregation
      </div>
    </div>
  );
}

function AlertFeed({ alerts }) {
  if (!alerts?.length) {
    return <EmptyState icon="🔔" message="No alerts ready" sub="Below priority threshold or market scanning" />;
  }

  return (
    <div>
      {alerts.slice(0, 6).map(alert => (
        <div key={alert.id} style={{
          padding: '10px 12px', marginBottom: 6, backgroundColor: '#05060D',
          borderLeft: `2px solid ${alert.priority >= 80 ? '#EF4444' : alert.priority >= 60 ? '#F59E0B' : colors.border}`,
          borderRadius: radius.sm,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <strong style={{ color: colors.text.primary, fontFamily: 'monospace', fontSize: 12 }}>{alert.symbol}</strong>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: colors.text.faint }}>#{alert.priority}</span>
              <StatusDot status={alert.status === 'READY' ? 'ready' : alert.status === 'TRIGGERED' ? 'triggered' : alert.status === 'SENT' ? 'sent' : alert.status === 'FAILED' ? 'failed' : 'disabled'} />
            </div>
          </div>
          <div style={{ fontSize: 9, color: colors.text.secondary, lineHeight: 1.4 }}>{alert.type?.replace('_', ' ')}</div>
          {alert.message && <div style={{ fontSize: 9, color: colors.text.muted, marginTop: 2, lineHeight: 1.4 }}>{alert.message}</div>}
        </div>
      ))}
    </div>
  );
}

export default function CommandCenter() {
  const [commandCenterData, setCommandCenterData] = useState(null);
  const [opportunityData, setOpportunityData] = useState(null);
  const [tradePlanData, setTradePlanData] = useState(null);
  const [aiExplanationData, setAiExplanationData] = useState(null);
  const [alertCenterData, setAlertCenterData] = useState(null);
  const [notificationAlerts, setNotificationAlerts] = useState([]);
  const [notificationFilter, setNotificationFilter] = useState('all');
  const [notificationAlertsByStage, setNotificationAlertsByStage] = useState({});
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('opportunities');
  const [marketStatus, setMarketStatus] = useState({ open: false, label: 'Loading…' });
  const [indices, setIndices] = useState([]);

  const fetchAll = useCallback(async () => {
    const origin = window.location.origin;
    try {
      const [ccRes, oppRes, planRes, aiRes, alertRes] = await Promise.allSettled([
        fetch(`${origin}/api/command-center`, { cache: 'no-store' }),
        fetch(`${origin}/api/opportunity-ranking`, { cache: 'no-store' }),
        fetch(`${origin}/api/trade-plan`, { cache: 'no-store' }),
        fetch(`${origin}/api/ai-explanation`, { cache: 'no-store' }),
        fetch(`${origin}/api/alert-center`, { cache: 'no-store' }),
      ]);
      if (ccRes.status === 'fulfilled' && ccRes.value.ok) {
        const json = await ccRes.value.json();
        setCommandCenterData(json);
        setIndices(json.indices || []);
        setError('');
      }
      if (oppRes.status === 'fulfilled' && oppRes.value.ok) {
        setOpportunityData(await oppRes.value.json().catch(() => null));
      }
      if (planRes.status === 'fulfilled' && planRes.value.ok) {
        setTradePlanData(await planRes.value.json().catch(() => null));
      }
      if (aiRes.status === 'fulfilled' && aiRes.value.ok) {
        setAiExplanationData(await aiRes.value.json().catch(() => null));
      }
      if (alertRes.status === 'fulfilled' && alertRes.value.ok) {
        const alertData = await alertRes.value.json().catch(() => null);
        setAlertCenterData(alertData);
        if (alertData?.alerts) {
          setNotificationAlerts(
            alertData.alerts
              .filter(a => a.status && Object.values(NOTIFICATION_STATUSES).includes(a.status))
              .slice(0, 8)
          );
        }
      }
    } catch (err) {
      setError(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNotificationStatusChange = (alert, newStatus) => {
    setNotificationAlerts(prev => prev.map(a => {
      if (a.id === alert.id) {
        return { ...a, status: newStatus };
      }
      return a;
    }));
  };

  useEffect(() => {
    const updateMarketStatus = () => {
      const nyParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date());
      const part = (type) => nyParts.find(x => x.type === type)?.value;
      const weekday = part('weekday');
      const hour = Number(part('hour'));
      const minute = Number(part('minute'));
      const total = hour * 60 + minute;
      const weekdayOpen = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);
      const open = weekdayOpen && total >= 570 && total < 960;
      setMarketStatus({ open, label: open ? 'Market Open' : 'Market Closed' });
    };
    updateMarketStatus();
    const t = setInterval(updateMarketStatus, 60_000);
    fetchAll();
    const refresh = setInterval(fetchAll, 60_000);
    return () => { clearInterval(t); clearInterval(refresh); };
  }, [fetchAll]);

  const regime = commandCenterData?.regime || commandCenterData?.sections?.marketRegime?.regime;
  const regimeScore = commandCenterData?.regimeScore ?? commandCenterData?.sections?.marketRegime?.regimeScore;
  const regimeConfidence = commandCenterData?.confidenceLevel || commandCenterData?.sections?.marketRegime?.confidenceLevel;
  const lastUpdate = commandCenterData?.timestamp;

  const topOpportunities = (opportunityData?.top || opportunityData?.data || []).slice(0, 10);
  const topPlan = (tradePlanData?.top || tradePlanData?.data || []).slice(0, 5);
  const alerts = alertCenterData?.alerts || [];
  const highPriorityAlerts = alerts.filter(a => (a.priority || 0) >= 50).slice(0, 6);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.bg,
      color: colors.text.primary,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      direction: 'ltr',
    }}>
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '16px 20px' }}>
        <TopBar
          indices={indices}
          regime={regime}
          regimeScore={regimeScore}
          regimeConfidence={regimeConfidence}
          marketStatus={marketStatus}
          lastUpdate={lastUpdate}
          loading={loading}
        />

        <div style={{
          ...panel,
          padding: '10px 14px',
          marginBottom: 16,
          backgroundColor: '#0B0F17',
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          fontSize: 10,
          color: colors.text.faint,
        }}>
          📡 HUNTER AI Command Center — aggregates C7+C8+C9+C10 intelligence. No fabricated data. All scores are evidence-based.
          <span style={{ marginLeft: 12 }}>|</span>
          <Link href="/analytics" style={{ color: colors.accent.blue, marginLeft: 8, textDecoration: 'none' }}>Analytics ↗</Link>
          <Link href="/alert-center" style={{ color: colors.accent.blue, marginLeft: 8, textDecoration: 'none' }}>Alerts ↗</Link>
        </div>

        {error && <ErrorState message={error} onRetry={fetchAll} />}

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 16,
          marginBottom: 16,
          alignItems: 'start'
        }}
        className="command-center-grid"
      >
          <div>
            <div style={{ ...panel, padding: '14px 16px', marginBottom: 16 }}>
              <SectionTitle label="Top Opportunities" icon="🎯" color={colors.accent.gold} />
              <TopOpportunitiesPanel
                topData={topOpportunities}
                loading={loading}
                onSelectSymbol={setSelectedSymbol}
              />
            </div>

            <div style={{ ...panel, padding: '14px 16px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <TabGroup
                  tabs={[
                    { key: 'opportunities', label: 'Opportunities' },
                    { key: 'plans', label: 'Trade Plans' },
                    { key: 'intelligence', label: 'Intelligence' },
                  ]}
                  active={activeTab}
                  onTabChange={setActiveTab}
                  variant="default"
                />
              </div>

              {activeTab === 'opportunities' && (
                <div className="responsive-table">
                  {!topOpportunities.length && !loading ? (
                    <EmptyState icon="🎯" message="No opportunities available" />
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                      <thead>
                        <tr>
                          {['Ticker', 'Score', 'Quality', 'Direction', 'R/R', 'Confidence', 'Data %', 'Sources'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: colors.text.faint, fontWeight: 700, borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {topOpportunities.map((item, i) => (
                          <tr
                            key={item.symbol}
                            onClick={() => setSelectedSymbol(item.symbol)}
                            style={{ borderBottom: `1px solid ${colors.border}`, cursor: 'pointer', backgroundColor: selectedSymbol === item.symbol ? '#0F1420' : 'transparent' }}
                          >
                            <td style={{ padding: '6px 8px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: colors.text.primary }}>{item.symbol || '—'}</span>
                            </td>
                            <td style={{ padding: '6px 8px', color: scoreColor(item.opportunityScore ?? item.setupScore), fontFamily: 'monospace', fontWeight: 700 }}>
                              {item.opportunityScore ?? item.setupScore ?? '—'}
                            </td>
                            <td style={{ padding: '6px 8px' }}><Tag value={item.quality} colorMap={qualityColorMap} size="sm" /></td>
                            <td style={{ padding: '6px 8px' }}><Tag value={item.directionBias || item.direction} colorMap={{ LONG: '#34D399', SHORT: '#F87171', NEUTRAL: '#FBBF24', UNAVAILABLE: '#475569' }} size="sm" /></td>
                            <td style={{ padding: '6px 8px', color: riskRewardColor(item.riskReward), fontFamily: 'monospace', fontWeight: 700 }}>{item.riskReward ?? '—'}</td>
                            <td style={{ padding: '6px 8px', color: colors.text.secondary, fontFamily: 'monospace' }}>{item.confidence ?? item.confidenceLevel ?? '—'}</td>
                            <td style={{ padding: '6px 8px', color: colors.text.secondary, fontFamily: 'monospace' }}>{item.dataCompleteness ?? '—'}%</td>
                            <td style={{ padding: '6px 8px' }}>
                              <SmallTag value={item.availableComponents ? `${item.availableComponents.length}/6` : '—'} color="#94A3B8" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'plans' && (
                <div className="responsive-table">
                  {!topPlan.length && !loading ? (
                    <EmptyState icon="🧭" message="No trade plans available" />
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                      <thead>
                        <tr>
                          {['Ticker', 'Plan Score', 'Quality', 'Signal', 'Direction', 'Entry', 'Stop', 'T1', 'R/R'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: colors.text.faint, fontWeight: 700, borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {topPlan.map(item => (
                          <tr key={item.symbol} onClick={() => setSelectedSymbol(item.symbol)} style={{ borderBottom: `1px solid ${colors.border}`, cursor: 'pointer', backgroundColor: selectedSymbol === item.symbol ? '#0F1420' : 'transparent' }}>
                            <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 700 }}>{item.symbol || '—'}</td>
                            <td style={{ padding: '6px 8px', color: scoreColor(item.planScore), fontFamily: 'monospace', fontWeight: 700 }}>{item.planScore ?? '—'}</td>
                            <td style={{ padding: '6px 8px' }}><Tag value={item.planQuality} colorMap={qualityColorMap} size="sm" /></td>
                            <td style={{ padding: '6px 8px' }}><Tag value={item.planSignal} colorMap={signalColorMap} size="sm" /></td>
                            <td style={{ padding: '6px 8px' }}><Tag value={item.direction} colorMap={{ LONG: '#34D399', SHORT: '#F87171', NEUTRAL: '#FBBF24', UNAVAILABLE: '#475569' }} size="sm" /></td>
                            <td style={{ padding: '6px 8px', color: colors.text.secondary, fontFamily: 'monospace' }}>{item.entryZone ?? item.entryPrice ?? '—'}</td>
                            <td style={{ padding: '6px 8px', color: colors.text.secondary, fontFamily: 'monospace' }}>{item.stopLoss ?? '—'}</td>
                            <td style={{ padding: '6px 8px', color: colors.semantic.long, fontFamily: 'monospace', fontWeight: 700 }}>{item.target1 ?? '—'}</td>
                            <td style={{ padding: '6px 8px', color: riskRewardColor(item.riskReward), fontFamily: 'monospace', fontWeight: 700 }}>{item.riskReward ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'intelligence' && (
                <div className="intelligence-grid">
                  {[
                    { label: 'Penny (B1)', available: opportunityData?.dataAvailability?.pennyIntelligence, color: '#22C55E' },
                    { label: 'Options (B2)', available: opportunityData?.dataAvailability?.optionsIntelligence, color: '#818CF8' },
                    { label: 'Institutional (B3)', available: opportunityData?.dataAvailability?.institutionalRadar, color: '#A78BFA' },
                    { label: 'Swing (B4)', available: opportunityData?.dataAvailability?.swingIntelligence, color: '#34D399' },
                    { label: 'Early Explosion (B5)', available: opportunityData?.dataAvailability?.earlyExplosion, color: '#EC4899' },
                    { label: 'Catalyst (B6)', available: opportunityData?.dataAvailability?.catalystIntelligence, color: '#F59E0B' },
                  ].map(src => (
                    <div key={src.label} style={{ padding: 10, backgroundColor: '#07090E', borderRadius: radius.md, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: src.available ? src.color : colors.text.disabled, boxShadow: src.available ? `0 0 6px ${src.color}60` : 'none' }} />
                      <span style={{ color: src.available ? colors.text.secondary : colors.text.disabled, fontSize: 10, fontWeight: 600 }}>{src.label}</span>
                      <span style={{ marginLeft: 'auto', color: src.available ? '#34D399' : colors.text.disabled, fontSize: 9 }}>{src.available ? '✓' : '✗'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            className="command-center-sidebar"
          >
            <OpportunityDetailPanel
              symbol={selectedSymbol}
              opportunityData={opportunityData}
              tradePlanData={tradePlanData}
              aiExplanationData={aiExplanationData}
            />

            <MarketContextCard regimeData={commandCenterData?.sections?.marketRegime} />

            <div style={{ ...panel, padding: 16 }}>
              <SectionTitle label="Alert Center" icon="🔔" color={colors.accent.pink} />
              {alertCenterData?.success && alertCenterData?.count > 0 ? (
                <div style={{ marginBottom: 8, fontSize: 11, color: colors.text.muted }}>
                  {alertCenterData.count} total alerts
                  {alertCenterData.summary?.bySeverity?.CRITICAL > 0 && (
                    <span style={{ color: '#EF4444', fontWeight: 700, marginLeft: 8 }}>
                      {alertCenterData.summary.bySeverity.CRITICAL} CRITICAL
                    </span>
                  )}
                </div>
              ) : null}
              <AlertFeed alerts={highPriorityAlerts.length ? highPriorityAlerts : alerts.slice(0, 4)} />
            </div>

            <div style={{ ...panel, padding: 16 }}>
              <SectionTitle label="Notification Alerts" icon="📡" color={colors.accent.emerald} />
              <NotificationStatusFilter
                activeFilter={notificationFilter}
                onFilterChange={setNotificationFilter}
              />
              <NotificationLifecycleIndicator alertsByStage={notificationAlertsByStage} />
              <NotificationAlertPanel
                alerts={notificationAlerts}
                loading={loading}
                onStatusChange={handleNotificationStatusChange}
              />
            </div>

            <WatchlistPanel opportunities={topOpportunities} />
          </div>
        </div>

        <div style={{ ...panel, padding: '10px 16px', textAlign: 'center', marginTop: 8 }}>
          <p style={{ color: colors.text.faint, fontSize: 10, margin: 0 }}>
            HUNTER AI Command Center · Last update: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString('en-US') : '—'}
          </p>
          <p style={{ color: colors.text.disabled, fontSize: 9, marginTop: 4, margin: 0 }}>
            Intelligence: C7 Opportunity Ranking · C8 Trade Plan Engine · C9 AI Explanation · C10 Market Regime
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .command-center-grid {
            grid-template-columns: 1fr !important;
          }
          .command-center-sidebar {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
          }
        }
        @media (max-width: 768px) {
          .command-center-sidebar {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .command-center-grid {
            gap: 12px !important;
          }
        }
        .responsive-table {
          overflow-x: auto;
          display: block;
        }
        .responsive-table table {
          min-width: 600px;
        }
        @media (max-width: 768px) {
          .responsive-table {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .responsive-table table {
            min-width: 500px;
          }
        }
        .intelligence-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 480px) {
          .intelligence-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
