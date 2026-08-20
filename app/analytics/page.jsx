'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { buildWatchListItem, classifyWatchFreshness, buildStrategyCandidates } from '@/lib/options-intelligence.js';

const gold = '#F4C95D';
const bg = '#05070B';
const panel = '#0B0F17';
const line = '#1B2535';

const fmt = (v, d = 2) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : '—';
};

function Pill({ children, tone = 'blue' }) {
  const colors = {
    green: ['#052E24', '#34D399'],
    red: ['#3B1118', '#FB7185'],
    gold: ['#33270A', gold],
    purple: ['#21143C', '#C4B5FD'],
    blue: ['#0B2638', '#38BDF8'],
  };
  const [a, b] = colors[tone] || colors.blue;
  return <span style={{ background: a, color: b, border: `1px solid ${b}33`, borderRadius: 999, padding: '5px 9px', fontSize: 10, fontWeight: 900 }}>{children}</span>;
}

function Metric({ label, value, sub }) {
  return (
    <div className="metric-card">
      <div className="muted">{label}</div>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function readJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable; watchlist is best-effort local state */
  }
}

const WATCHLIST_KEY = 'hunter_options_watchlist_v1';
const WATCHSNAP_KEY = 'hunter_options_watch_snapshots_v1';

function OpportunityCard({ item, onSelect }) {
  const isOption = item.kind === 'OPTIONS_CENTS';
  const isPenny = item.kind === 'PENNY';
  const tone = item.score >= 85 ? 'green' : item.score >= 75 ? 'gold' : 'blue';

  const optInt = item.optionsIntelligence;
  const optFlow = item.optionsFlow;
  const rank = item.contractQuality;

  return (
    <button className="op-card" onClick={() => onSelect(item)}>
      <div className="op-top">
        <div style={{ textAlign: 'right' }}>
          <div className="symbol">{item.symbol}</div>
          <div className="muted">{isOption ? item.contract : isPenny ? 'LOW-PRICE RADAR' : 'TECHNICAL HUNTER'}</div>
        </div>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill tone={tone}>{item.score}/100</Pill>
          {isOption && rank && <Pill tone={rank === 'EXCEPTIONAL' || rank === 'STRONG' ? 'green' : rank === 'GOOD' ? 'gold' : 'blue'}>{rank}</Pill>}
          <Pill tone={isOption ? 'purple' : isPenny ? 'red' : 'blue'}>{item.kind}</Pill>
        </div>
      </div>

      <div className="op-grid">
        {isOption ? (
          <>
            <span>Premium <b>${fmt(item.premium)}</b></span>
            <span>Strike <b>${fmt(item.strike)}</b></span>
            <span>DTE <b>{item.daysToExpiration != null ? item.daysToExpiration : '—'}</b></span>
            <span>Vol <b>{Number(item.volume || 0).toLocaleString()}</b></span>
            <span>OI <b>{Number(item.openInterest || 0).toLocaleString()}</b></span>
            <span>IV <b>{item.impliedVolatility != null ? (item.impliedVolatility * 100).toFixed(1) + '%' : '—'}</b></span>
            {optFlow && <span>Flow <b>{optFlow.callPutPressure || '—'}</b></span>}
            {optFlow && <span>Activity <b>{optFlow.activityStrength || '—'}</b></span>}
          </>
        ) : (
          <>
            <span>السعر <b>${fmt(item.price)}</b></span>
            <span>RVOL <b>{fmt(item.rvol)}x</b></span>
            <span>RSI <b>{fmt(item.rsi, 1)}</b></span>
            <span>Score <b>{item.setupScore ?? '—'}</b></span>
          </>
        )}
      </div>

      <div className="op-foot">
        <span>{item.action || 'مراجعة قبل القرار'}</span>
        <span>›</span>
      </div>
    </button>
  );
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState('command');
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const lastKeyRef = useRef('');
  const [riyadh, setRiyadh] = useState('');
  const [production, setProduction] = useState(null);
  const [access, setAccess] = useState(null);
  const [optionsSort, setOptionsSort] = useState('contractRankScore');
  const [optionsFilterQuality, setOptionsFilterQuality] = useState('ALL');
  const [optionsFilterRisk, setOptionsFilterRisk] = useState('ALL');
  const [optionsFilterFlow, setOptionsFilterFlow] = useState('ALL');
  const [optionsFilterDecision, setOptionsFilterDecision] = useState('ALL');
  const [optionsFilterExecution, setOptionsFilterExecution] = useState('ALL');

  const [strategySort, setStrategySort] = useState('strategyScore');
  const [strategyFilterType, setStrategyFilterType] = useState('ALL');
  const [strategyFilterQuality, setStrategyFilterQuality] = useState('ALL');
  const [strategyFilterRisk, setStrategyFilterRisk] = useState('ALL');
  const [strategyFilterDecision, setStrategyFilterDecision] = useState('ALL');

  // A2.6 — Watchlist state (client/local only, persisted to localStorage)
  const [watchlist, setWatchlist] = useState([]); // array of contract ids (occ symbol)
  const [watchSnapshots, setWatchSnapshots] = useState({}); // id -> last watch item
  const [watchSelected, setWatchSelected] = useState(null); // id for detail view
  const [watchSort, setWatchSort] = useState('watchRankScore');
  const [watchFilterStatus, setWatchFilterStatus] = useState('ALL');
  const [watchFilterDecision, setWatchFilterDecision] = useState('ALL');
  const [watchFilterRisk, setWatchFilterRisk] = useState('ALL');
  const [watchFilterExecution, setWatchFilterExecution] = useState('ALL');
  const [watchFilterDte, setWatchFilterDte] = useState('ALL');
  const [watchMinScore, setWatchMinScore] = useState(0);
  const watchlistRef = useRef(watchlist);
  const selectedWatchRef = useRef(null);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const [healthRes, accessRes] = await Promise.all([
          fetch('/api/health', { cache: 'no-store' }),
          fetch('/api/access', { cache: 'no-store' }),
        ]);
        const health = await healthRes.json().catch(() => null);
        const access = await accessRes.json().catch(() => null);
        if (healthRes.ok) setProduction(health);
        if (accessRes.ok) setAccess(access);
      } catch {
        // Optional status services must never block analytics.
      }
    };
    loadStatus();
  }, []);

  const load = async () => {
    try {
      const response = await fetch('/api/opportunities', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'تعذر تحديث Hunter');
      setData(json);
      setError('');

      // A2.6 — Watchlist sync: recompute monitored snapshots from fresh options data
      const watched = watchlistRef.current || [];
      if (watched.length) {
        setWatchSnapshots((prev) => {
          const next = { ...prev };
          const optsById = new Map((json.options || []).map((o) => [o.contract || `${o.symbol}`, o]));
          for (const id of watched) {
            const contract = optsById.get(id);
            const previous = prev[id] || null;
            if (contract) {
              const item = buildWatchListItem(contract, previous);
              item.previous = previous; // preserve prior snapshot for "WHAT CHANGED"
              next[id] = item;
            }
            // If contract not in current data, keep last snapshot (history / expired stays visible)
          }
          writeJSON(WATCHSNAP_KEY, next);
          return next;
        });
      }

      const top = json.top?.[0];
      const key = top ? `${top.kind}:${top.contract || top.symbol}:${top.score}` : '';
      if (key && lastKeyRef.current && key !== lastKeyRef.current) {
        setNotification(`🎯 Hunter رصد فرصة جديدة: ${top.symbol}${top.contract ? ` — ${top.contract}` : ''}`);
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('HUNTER AI — فرصة جديدة', {
            body: `${top.symbol} · Score ${top.score}/100${top.premium ? ` · Premium $${top.premium}` : ''}`,
          });
        }
      }
      if (key) lastKeyRef.current = key;
    } catch (e) {
      setError(e?.message || 'تعذر التحديث');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  // A2.6 — Restore watchlist from localStorage (client only)
  useEffect(() => {
    setWatchlist(readJSON(WATCHLIST_KEY, []));
    setWatchSnapshots(readJSON(WATCHSNAP_KEY, {}));
  }, []);

  useEffect(() => { watchlistRef.current = watchlist; }, [watchlist]);

  useEffect(() => {
    const tick = () => setRiyadh(new Date().toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh', hour12: true }));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      setNotification('المتصفح لا يدعم تنبيهات الجهاز.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotification(permission === 'granted' ? '✅ تم تفعيل تنبيهات الجهاز.' : 'التنبيهات غير مفعلة.');
  };

  const technical = data?.technical || [];
  const penny = data?.penny || [];
  const options = data?.options || [];
  const top = data?.top || [];
  const regime = data?.market;

  // A2.6 — Watchlist helpers
  const addToWatchlist = (contract) => {
    const id = contract.contract || contract.symbol;
    if (!id) return;
    setWatchlist((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      writeJSON(WATCHLIST_KEY, next);
      return next;
    });
    setWatchSnapshots((prev) => {
      if (prev[id]) return prev;
      const item = buildWatchListItem(contract, null);
      const next = { ...prev, [id]: item };
      writeJSON(WATCHSNAP_KEY, next);
      return next;
    });
  };

  const removeFromWatchlist = (id) => {
    setWatchlist((prev) => {
      const next = prev.filter((x) => x !== id);
      writeJSON(WATCHLIST_KEY, next);
      return next;
    });
    if (watchSelected === id) setWatchSelected(null);
  };

  const watchItems = useMemo(() => Object.values(watchSnapshots), [watchSnapshots]);

  const filteredWatch = useMemo(() => {
    let result = [...watchItems];
    if (watchFilterStatus !== 'ALL') result = result.filter((x) => x.watchStatus === watchFilterStatus);
    if (watchFilterDecision !== 'ALL') result = result.filter((x) => x.decisionStatus === watchFilterDecision);
    if (watchFilterRisk !== 'ALL') result = result.filter((x) => x.decisionRisk === watchFilterRisk);
    if (watchFilterExecution !== 'ALL') result = result.filter((x) => x.executionQuality === watchFilterExecution);
    if (watchFilterDte !== 'ALL') {
      result = result.filter((x) => {
        const dte = Number(x.daysToExpiration);
        if (watchFilterDte === 'EXPIRED') return !Number.isFinite(dte) || dte <= 0;
        if (watchFilterDte === 'CRITICAL') return Number.isFinite(dte) && dte > 0 && dte <= 3;
        if (watchFilterDte === 'HIGH_ATTENTION') return Number.isFinite(dte) && dte > 3 && dte <= 7;
        if (watchFilterDte === 'NORMAL') return Number.isFinite(dte) && dte > 7;
        return true;
      });
    }
    if (watchMinScore > 0) result = result.filter((x) => Number(x.decisionScore || 0) >= watchMinScore);
    const val = (x, key) => {
      if (key === 'lastUpdated') return x.lastUpdated ? new Date(x.lastUpdated).getTime() : 0;
      if (key === 'dte') return Number(x.daysToExpiration ?? 999);
      return Number(x[key] ?? 0);
    };
    result.sort((a, b) => {
      if (watchSort === 'risk' || watchSort === 'execution') {
        const order = { LOW: 0, EXCELLENT: 0, GOOD: 1, MODERATE: 1, WATCH: 2, HIGH: 2, POOR: 3, EXTREME: 3 };
        return (order[a[watchSort]] ?? 9) - (order[b[watchSort]] ?? 9);
      }
      return (val(b, watchSort)) - (val(a, watchSort));
    });
    return result;
  }, [watchItems, watchFilterStatus, watchFilterDecision, watchFilterRisk, watchFilterExecution, watchFilterDte, watchMinScore, watchSort]);

  const availableOptions = useMemo(
    () => options.filter((o) => o.contract && !watchlist.includes(o.contract)).slice(0, 50),
    [options, watchlist]
  );

  const filteredOptions = useMemo(() => {
    let result = [...options];
    if (optionsFilterQuality !== 'ALL') {
      result = result.filter(x => x.contractQuality === optionsFilterQuality);
    }
    if (optionsFilterRisk !== 'ALL') {
      result = result.filter(x => x.riskAdjustedLevel === optionsFilterRisk || x.optionsIntelligence?.riskLevel === optionsFilterRisk);
    }
    if (optionsFilterFlow !== 'ALL') {
      result = result.filter(x => x.optionsFlow?.callPutPressure === optionsFilterFlow);
    }
    if (optionsFilterDecision !== 'ALL') {
      result = result.filter(x => x.decisionStatus === optionsFilterDecision);
    }
    if (optionsFilterExecution !== 'ALL') {
      result = result.filter(x => x.executionQuality === optionsFilterExecution);
    }
    result.sort((a, b) => {
      const aVal = optionsSort === 'contractRankScore' ? a.contractRankScore : optionsSort === 'optionsScore' ? a.optionsIntelligence?.optionsScore : optionsSort === 'riskAdjustedScore' ? a.riskAdjustedScore : optionsSort === 'volume' ? a.volume : optionsSort === 'openInterest' ? a.openInterest : optionsSort === 'dte' ? a.daysToExpiration : optionsSort === 'iv' ? a.impliedVolatility : optionsSort === 'flowScore' ? a.optionsFlow?.flowScore : optionsSort === 'decisionScore' ? a.decisionScore : a.score;
      const bVal = optionsSort === 'contractRankScore' ? b.contractRankScore : optionsSort === 'optionsScore' ? b.optionsIntelligence?.optionsScore : optionsSort === 'riskAdjustedScore' ? b.riskAdjustedScore : optionsSort === 'volume' ? b.volume : optionsSort === 'openInterest' ? b.openInterest : optionsSort === 'dte' ? b.daysToExpiration : optionsSort === 'iv' ? b.impliedVolatility : optionsSort === 'flowScore' ? b.optionsFlow?.flowScore : optionsSort === 'decisionScore' ? b.decisionScore : b.score;
      return (bVal || 0) - (aVal || 0);
    });
    return result;
  }, [options, optionsSort, optionsFilterQuality, optionsFilterRisk, optionsFilterFlow, optionsFilterDecision, optionsFilterExecution]);

  const strategies = useMemo(() => {
    const all = [];
    if (data?.optionsRanking) {
      for (const [symbol, ranking] of Object.entries(data.optionsRanking)) {
        const strategySummary = ranking?.strategy;
        if (!strategySummary || !strategySummary.bestStrategy) continue;
        all.push({
          symbol,
          ...strategySummary.bestStrategy,
          strategyDecision: ranking?.strategyDecision,
        });
      }
    }
    return all;
  }, [data?.optionsRanking]);

  const filteredStrategies = useMemo(() => {
    let result = [...strategies];
    if (strategyFilterType !== 'ALL') {
      result = result.filter(s => s.strategyType === strategyFilterType);
    }
    if (strategyFilterQuality !== 'ALL') {
      result = result.filter(s => s.strategyQuality === strategyFilterQuality);
    }
    if (strategyFilterRisk !== 'ALL') {
      result = result.filter(s => s.combinedRisk === strategyFilterRisk || s.strategyRisk === strategyFilterRisk);
    }
    if (strategyFilterDecision !== 'ALL') {
      result = result.filter(s => s.decisionStatus === strategyFilterDecision);
    }
    result.sort((a, b) => {
      const aVal = strategySort === 'strategyScore' ? a.strategyScore : strategySort === 'strategyDecisionScore' ? a.strategyDecisionScore : strategySort === 'maxProfit' ? a.strategyEconomics?.maxProfit : strategySort === 'maxLoss' ? a.strategyEconomics?.maxLoss : strategySort === 'breakeven' ? a.strategyEconomics?.breakeven : a.score;
      const bVal = strategySort === 'strategyScore' ? b.strategyScore : strategySort === 'strategyDecisionScore' ? b.strategyDecisionScore : strategySort === 'maxProfit' ? b.strategyEconomics?.maxProfit : strategySort === 'maxLoss' ? b.strategyEconomics?.maxLoss : strategySort === 'breakeven' ? b.strategyEconomics?.breakeven : b.score;
      if (aVal == null || bVal == null) return 0;
      return (bVal || 0) - (aVal || 0);
    });
    return result;
  }, [strategies, strategySort, strategyFilterType, strategyFilterQuality, strategyFilterRisk, strategyFilterDecision]);

  const stats = useMemo(() => ({
    total: technical.length,
    penny: penny.length,
    options: options.length,
    a: top.filter((x) => Number(x.score) >= 85).length,
    strategies: strategies.length,
  }), [technical, penny, options, top, strategies]);

  const tabs = [
    ['command', '⌂ القيادة'],
    ['radar', '🎯 الأسهم'],
    ['penny', '🪙 سنتات الأسهم'],
    ['options', '⚡ عقود السنتات'],
    ['strategies', '📊 إستراتيجيات الخيارات'],
    ['watchlist', '📡 مراقبة العقود'],
    ['institutional', '🏛️ المؤسسات'],
    ['alerts', '🔔 التنبيهات'],
  ];

  return (
    <main className="hunter-shell" dir="rtl">
      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${bg}; color: #F8FAFC; }
        button, input, select { font: inherit; }
        .hunter-shell { min-height: 100vh; background:
          radial-gradient(circle at 85% 0%, rgba(244,201,93,.09), transparent 28%),
          radial-gradient(circle at 10% 20%, rgba(56,189,248,.06), transparent 26%),
          ${bg}; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,sans-serif; padding-bottom: 90px; }
        .container { width: min(1450px, calc(100% - 28px)); margin: auto; }
        .hero { padding: 24px 0 18px; display:flex; justify-content:space-between; gap:16px; align-items:flex-end; flex-wrap:wrap; }
        .brand { display:flex; gap:12px; align-items:center; }
        .brand-mark { width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#F4C95D,#8C6815);color:#05070B;font-size:22px;font-weight:1000;box-shadow:0 0 35px rgba(244,201,93,.18); }
        .eyebrow { color:${gold}; font-size:10px; font-weight:1000; letter-spacing:1.5px; }
        h1 { margin:3px 0 4px; font-size:clamp(23px,4vw,36px); letter-spacing:-1px; }
        .subtitle,.muted { color:#718096; font-size:11px; }
        .status-row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .glass { background:linear-gradient(145deg,rgba(16,22,34,.94),rgba(7,10,16,.94)); border:1px solid ${line}; box-shadow:0 18px 50px rgba(0,0,0,.22); border-radius:20px; }
        .hero-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .btn { border:1px solid ${line}; background:#0B1019; color:#CBD5E1; border-radius:11px; padding:9px 12px; cursor:pointer; font-weight:800; font-size:11px; }
        .btn.gold { background:${gold}; color:#07090E; border-color:${gold}; }
        .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
        .metric-card { padding:15px; border:1px solid ${line}; border-radius:16px; background:#090D14; }
        .metric-card strong { display:block; margin-top:6px; font-size:23px; color:#F8FAFC; }
        .metric-card small { color:#64748B; display:block; margin-top:4px; font-size:9px; }
        .regime { display:grid; grid-template-columns:1.5fr 1fr 1fr; gap:10px; margin-bottom:14px; }
        .regime-card { padding:16px; }
        .regime-value { font-size:25px; font-weight:1000; margin-top:5px; }
        .nav { display:flex; gap:7px; overflow:auto; padding:5px; margin-bottom:14px; position:sticky; top:8px; z-index:10; background:rgba(5,7,11,.78); backdrop-filter:blur(18px); border-radius:15px; }
        .nav button { white-space:nowrap; border:1px solid ${line}; background:#0A0F17; color:#94A3B8; padding:10px 13px; border-radius:10px; cursor:pointer; font-size:11px; font-weight:900; }
        .nav button.active { background:${gold}; color:#07090E; border-color:${gold}; }
        .section { padding:18px; }
        .section-head { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:13px; }
        .section-head h2 { margin:0; font-size:17px; }
        .op-grid-list { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
        .op-card { text-align:right; width:100%; color:#F8FAFC; background:#070B11; border:1px solid ${line}; border-radius:16px; padding:14px; cursor:pointer; transition:.18s; }
        .op-card:hover { transform:translateY(-2px); border-color:#3B4B68; }
        .op-top { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
        .symbol { font-size:17px; font-weight:1000; color:${gold}; }
        .op-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-top:13px; color:#64748B; font-size:10px; }
        .op-grid b { color:#E2E8F0; margin-right:3px; }
        .op-foot { display:flex; justify-content:space-between; border-top:1px solid ${line}; margin-top:12px; padding-top:10px; color:#94A3B8; font-size:10px; }
        .empty { padding:35px; text-align:center; color:#64748B; border:1px dashed #253047; border-radius:15px; }
        .warning { padding:12px 14px; border:1px solid #7F1D1D; background:#1A0C11; color:#FDA4AF; border-radius:13px; font-size:11px; margin-bottom:12px; }
        .detail { padding:18px; margin-top:12px; border:1px solid #3B82F6; border-radius:18px; background:#07111D; }
        .detail-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin-top:12px; }
        .detail-box { background:#050A11; border:1px solid ${line}; border-radius:10px; padding:10px; font-size:10px; }
        .bottom-nav { display:none; }
        .note { color:#64748B; font-size:10px; line-height:1.7; margin-top:10px; }
        @media(max-width:1000px){ .op-grid-list{grid-template-columns:repeat(2,1fr)} .metrics{grid-template-columns:repeat(2,1fr)} .regime{grid-template-columns:1fr 1fr} .detail-grid{grid-template-columns:repeat(2,1fr)} }
        @media(max-width:650px){ .container{width:min(100% - 16px,1450px)} .hero{padding-top:15px}.hero-actions{width:100%}.hero-actions .btn{flex:1}.metrics{grid-template-columns:repeat(2,1fr)} .regime{grid-template-columns:1fr}.op-grid-list{grid-template-columns:1fr}.section{padding:13px}.nav{display:none}.bottom-nav{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;bottom:0;left:0;right:0;padding:8px 6px calc(8px + env(safe-area-inset-bottom));background:rgba(5,7,11,.94);backdrop-filter:blur(20px);border-top:1px solid ${line};z-index:50}.bottom-nav button{background:none;border:0;color:#64748B;font-size:9px;font-weight:900;padding:6px 2px}.bottom-nav button.active{color:${gold}} .detail-grid{grid-template-columns:repeat(2,1fr)} h1{font-size:24px}.status-row{width:100%} }
      `}</style>

      <div className="container">
        <div className="glass" style={{ padding: 12, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="eyebrow">PRODUCTION PIPELINE</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', fontSize: 9, fontWeight: 900 }}>
            <span style={{ color: '#34D399' }}>P1✓</span><span style={{ color: '#34D399' }}>P2✓</span><span style={{ color: '#34D399' }}>P3✓</span><span style={{ color: '#34D399' }}>P4✓</span>
            <span style={{ color: production?.phases?.institutionalIntelligence?.status === 'active' ? '#34D399' : '#FBBF24' }}>P5{production?.phases?.institutionalIntelligence?.status === 'active' ? '✓' : '○'}</span>
            <span style={{ color: '#34D399' }}>P6✓</span><span style={{ color: '#34D399' }}>P7✓</span><span style={{ color: '#C4B5FD' }}>P8✓</span>
            <span style={{ color: '#94A3B8' }}>{access?.plan ? `PLAN ${String(access.plan).toUpperCase()}` : 'PLAN FREE'}</span>
          </div>
        </div>
        <header className="hero">
          <div className="brand">
            <div className="brand-mark">H</div>
            <div>
              <div className="eyebrow">HUNTER AI · COMMAND CENTER</div>
              <h1>صيد الفرص قبل الزحام</h1>
              <div className="subtitle">Technical Radar · Penny Radar · Options Cents · Risk · Alerts</div>
            </div>
          </div>
          <div className="hero-actions">
            <button className="btn" onClick={load}>↻ تحديث</button>
            <button className="btn" onClick={enableNotifications}>🔔 تنبيهات الجوال</button>
            <Link className="btn gold" href="/">⌂ الرئيسية</Link>
          </div>
        </header>

        <div className="status-row" style={{ marginBottom: 12 }}>
          <Pill tone={regime?.risk === 'FAVORABLE' ? 'green' : regime?.risk === 'DEFENSIVE' ? 'red' : 'gold'}>
            MARKET · {regime?.label || 'جارٍ القراءة'}
          </Pill>
          <Pill tone="blue">🇸🇦 {riyadh || '—'}</Pill>
          <Pill tone="purple">● LIVE DATA</Pill>
          {notification && <Pill tone="green">{notification}</Pill>}
        </div>

        {error && <div className="warning">⚠️ {error}</div>}

        <div className="metrics">
          <Metric label="TECHNICAL RADAR" value={stats.total} sub="فرص فنية مؤهلة" />
          <Metric label="PENNY WATCH" value={stats.penny} sub="سهم ≤ $5" />
          <Metric label="OPTIONS CENTS" value={stats.options} sub="Premium ≤ $1" />
           <Metric label="STRATEGIES" value={stats.strategies} sub="A2.7" />
          <Metric label="HIGH CONVICTION" value={stats.a} sub="Score ≥ 85" />
        </div>

        <div className="regime">
          <div className="glass regime-card">
            <div className="eyebrow">MARKET REGIME</div>
            <div className="regime-value" style={{ color: regime?.risk === 'DEFENSIVE' ? '#FB7185' : regime?.risk === 'FAVORABLE' ? '#34D399' : gold }}>
              {regime?.label || 'متوازن'}
            </div>
            <div className="subtitle">{regime?.score != null ? `سياق السوق ${regime.score}/100 · VIX ${regime.vix ?? '—'}` : 'جاري بناء قراءة السياق'}</div>
          </div>
          <div className="glass regime-card">
            <div className="eyebrow">DECISION ENGINE</div>
            <div style={{ marginTop: 8, fontWeight: 900 }}>لا صفقة بلا خطة مخاطرة</div>
            <div className="note">Score ≠ احتمال ربح. لا نستخدم الرافعة لتعويض صفقة خاسرة.</div>
          </div>
          <div className="glass regime-card">
            <div className="eyebrow">DATA HONESTY</div>
            <div style={{ marginTop: 8, fontWeight: 900 }}>Options حقيقية عند توفر السلسلة</div>
            <div className="note">Dark Pool والمؤسسات تبقى غير متاحة حتى يوجد مزود فعلي.</div>
          </div>
        </div>

        <nav className="nav">
          {tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
        </nav>

        {tab === 'command' && (
          <section className="glass section">
            <div className="section-head">
              <div><div className="eyebrow">TOP HUNTS</div><h2>أفضل الفرص الآن</h2></div>
              <Pill tone="gold">AUTO RANKED</Pill>
            </div>
            {loading ? <div className="empty">⏳ جاري صيد الفرص...</div> : !top.length ? <div className="empty">لا توجد فرصة فوق العتبة الآن. وهذا أفضل من اختلاق فرصة.</div> :
              <div className="op-grid-list">{top.slice(0, 9).map((x, i) => <OpportunityCard key={`${x.kind}-${x.contract || x.symbol}-${i}`} item={x} onSelect={setSelected} />)}</div>}
            <div className="note">Hunter يعمل بمنطق متعدد الطبقات: سياق السوق → Technical Setup → سيولة نسبية → فئة السعر → مخاطرة. فرص الخيارات الرخيصة عالية المخاطر بطبيعتها.</div>
          </section>
        )}

        {tab === 'radar' && (
          <section className="glass section">
            <div className="section-head"><div><div className="eyebrow">TECHNICAL</div><h2>الرادار الفني</h2></div><Pill tone="blue">{technical.length} فرصة</Pill></div>
            {technical.length ? <div className="op-grid-list">{technical.map((x, i) => <OpportunityCard key={`${x.symbol}-${i}`} item={x} onSelect={setSelected} />)}</div> : <div className="empty">لا توجد فرص فنية مؤهلة.</div>}
          </section>
        )}

        {tab === 'penny' && (
          <section className="glass section">
            <div className="section-head"><div><div className="eyebrow">SPECULATIVE EQUITIES</div><h2>أسهم منخفضة السعر ≤ $5</h2></div><Pill tone="red">HIGH RISK</Pill></div>
            <div className="warning">هذه ليست دعوة لمطاردة أسهم السنتات. نرفعها للرادار فقط عندما توجد بيانات سعر/حجم حقيقية وإشارة فنية قابلة للمراجعة.</div>
            {penny.length ? <div className="op-grid-list">{penny.map((x, i) => <OpportunityCard key={`${x.symbol}-${i}`} item={{ ...x, kind: 'PENNY', score: x.opportunityScore, rvol: x.relativeVolume }} onSelect={setSelected} />)}</div> : <div className="empty">لا توجد أسهم ≤ $5 مؤهلة الآن.</div>}
          </section>
        )}

        {tab === 'options' && (
          <section className="glass section">
            <div className="section-head"><div><div className="eyebrow">OPTIONS RADAR</div><h2>عقود الـCents</h2></div><Pill tone="purple">PREMIUM ≤ $1</Pill></div>
            <div className="warning">العقد بـ$0.50 لا يعني أنه سيتحول إلى $1.00. هذه عقود مضاربية عالية المخاطر. نعرض Volume/OI/Spread لتصفية السيولة الضعيفة.</div>

            {/* Best Contract Summary */}
            {data?.optionsRanking && Object.keys(data.optionsRanking).length > 0 && (
              <div style={{ marginBottom: 14 }}>
                {Object.entries(data.optionsRanking).map(([symbol, ranking]) => {
                  if (!ranking || !ranking.summary) return null;
                  const summary = ranking.summary;
                  return (
                    <div key={symbol} style={{ padding: '10px 14px', border: '1px solid #3B82F6', borderRadius: 12, background: '#07111D', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                        <span className="symbol" style={{ fontSize: 14 }}>{symbol}</span>
                        <Pill tone={summary.bestContractQuality === 'EXCEPTIONAL' || summary.bestContractQuality === 'STRONG' ? 'green' : 'gold'}>
                          BEST: {summary.bestContractQuality || '—'}
                        </Pill>
                        <span className="muted">Rank: <b>{summary.bestContractRankScore ?? '—'}</b></span>
                        <span className="muted">Contracts: <b>{summary.contractCount}</b></span>
                      </div>
                      {summary.bestContractReasons && summary.bestContractReasons.length > 0 && (
                        <div style={{ color: '#94A3B8', fontSize: 10 }}>
                          {summary.bestContractReasons.slice(0, 2).map((r, i) => <span key={i}>• {r} </span>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
              <select value={optionsSort} onChange={e => setOptionsSort(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="contractRankScore">Rank Score</option>
                <option value="optionsScore">Options Score</option>
                <option value="riskAdjustedScore">Risk Adjusted</option>
                <option value="decisionScore">Decision Score</option>
                <option value="volume">Volume</option>
                <option value="openInterest">Open Interest</option>
                <option value="dte">DTE</option>
                <option value="iv">IV</option>
                <option value="flowScore">Flow Score</option>
              </select>
              <select value={optionsFilterQuality} onChange={e => setOptionsFilterQuality(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Quality</option>
                <option value="EXCEPTIONAL">EXCEPTIONAL</option>
                <option value="STRONG">STRONG</option>
                <option value="GOOD">GOOD</option>
                <option value="MODERATE">MODERATE</option>
                <option value="WEAK">WEAK</option>
              </select>
              <select value={optionsFilterRisk} onChange={e => setOptionsFilterRisk(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Risk</option>
                <option value="LOW">LOW</option>
                <option value="MODERATE">MODERATE</option>
                <option value="HIGH">HIGH</option>
                <option value="EXTREME">EXTREME</option>
              </select>
              <select value={optionsFilterFlow} onChange={e => setOptionsFilterFlow(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Flow</option>
                <option value="CALL_PRESSURE">CALL_PRESSURE</option>
                <option value="PUT_PRESSURE">PUT_PRESSURE</option>
                <option value="BALANCED">BALANCED</option>
                <option value="UNAVAILABLE">UNAVAILABLE</option>
              </select>
              <select value={optionsFilterDecision} onChange={e => setOptionsFilterDecision(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Decision</option>
                <option value="HIGH_QUALITY">HIGH QUALITY</option>
                <option value="GOOD_QUALITY">GOOD QUALITY</option>
                <option value="WATCH">WATCH</option>
                <option value="LOW_QUALITY">LOW QUALITY</option>
              </select>
              <select value={optionsFilterExecution} onChange={e => setOptionsFilterExecution(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Execution</option>
                <option value="EXCELLENT">EXCELLENT</option>
                <option value="GOOD">GOOD</option>
                <option value="WATCH">WATCH</option>
                <option value="POOR">POOR</option>
              </select>
            </div>

            {filteredOptions.length ? <div className="op-grid-list">{filteredOptions.map((x, i) => <OpportunityCard key={`${x.contract}-${i}`} item={{ ...x, kind: 'OPTIONS_CENTS' }} onSelect={setSelected} />)}</div> : <div className="empty">لا توجد عقود Cents متاحة حاليًا أو لم تُرجع سلسلة الخيارات بيانات.</div>}
          </section>
        )}

        {tab === 'strategies' && (
          <section className="glass section">
            <div className="section-head">
              <div>
                <div className="eyebrow">OPTIONS STRATEGY INTELLIGENCE</div>
                <h2>إستراتيجيات الخيارات (A2.7 • A2.8)</h2>
              </div>
              <Pill tone="purple">{strategies.length} إستراتيجية</Pill>
            </div>
            <div className="warning">
              الإستراتيجيات مبنية على عقود حقيقية فقط — لا يتم تقليد أي ستراتيجي أو بريك.
              إستراتيجيات الـ Spread تتطلب ستراتيجية بيع (Short) — قد تتعرض لإسناد (Assignment).
              لا نتنبأ باتجاه السعر.
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
              <select value={strategySort} onChange={e => setStrategySort(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="strategyScore">Strategy Score</option>
                <option value="maxProfit">Max Profit</option>
                <option value="maxLoss">Max Loss</option>
                <option value="breakeven">Breakeven</option>
              </select>
              <select value={strategyFilterType} onChange={e => setStrategyFilterType(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Types</option>
                <option value="SINGLE_CALL">Long Call</option>
                <option value="SINGLE_PUT">Long Put</option>
                <option value="CALL_SPREAD">Call Spread</option>
                <option value="PUT_SPREAD">Put Spread</option>
              </select>
              <select value={strategyFilterQuality} onChange={e => setStrategyFilterQuality(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Quality</option>
                <option value="EXCEPTIONAL">EXCEPTIONAL</option>
                <option value="STRONG">STRONG</option>
                <option value="GOOD">GOOD</option>
                <option value="MODERATE">MODERATE</option>
                <option value="WEAK">WEAK</option>
              </select>
              <select value={strategyFilterRisk} onChange={e => setStrategyFilterRisk(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Risk</option>
                <option value="LOW">LOW</option>
                <option value="MODERATE">MODERATE</option>
                <option value="HIGH">HIGH</option>
                <option value="EXTREME">EXTREME</option>
              </select>
              <select value={strategyFilterDecision} onChange={e => setStrategyFilterDecision(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Decision</option>
                <option value="HIGH_QUALITY">HIGH QUALITY</option>
                <option value="GOOD_QUALITY">GOOD QUALITY</option>
                <option value="WATCH">WATCH</option>
                <option value="LOW_QUALITY">LOW QUALITY</option>
              </select>
            </div>

            {filteredStrategies.length ? (
              <div className="op-grid-list">
                {filteredStrategies.map((s, i) => {
                  const econ = s.strategyEconomics || {};
                  const scoreTone = (s.strategyDecisionScore ?? s.strategyScore) >= 85 ? 'green' : (s.strategyDecisionScore ?? s.strategyScore) >= 75 ? 'gold' : 'blue';
                  const riskTone = s.combinedRisk === 'LOW' ? 'green' : s.combinedRisk === 'MODERATE' ? 'gold' : s.combinedRisk === 'HIGH' ? 'red' : s.combinedRisk === 'EXTREME' ? 'red' : 'blue';
                  const execTone = s.classifiedExecutionQuality === 'EXCELLENT' ? 'green' : s.classifiedExecutionQuality === 'GOOD' ? 'gold' : s.classifiedExecutionQuality === 'POOR' ? 'red' : 'blue';
                  return (
                    <div key={`${s.symbol}-${s.strategyType}-${i}`} className="op-card" style={{ cursor: 'pointer' }} onClick={() => setSelected({ kind: 'STRATEGY', ...s })}>
                      <div className="op-top">
                        <div style={{ textAlign: 'right' }}>
                          <div className="symbol">{s.symbol}</div>
                          <div className="muted">{s.label || s.strategyType}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Pill tone={scoreTone}>{s.strategyDecisionScore ?? s.strategyScore ?? '—'}/100</Pill>
                          <Pill tone={riskTone}>{s.combinedRisk || '—'}</Pill>
                          <Pill tone={execTone}>{s.classifiedExecutionQuality || '—'}</Pill>
                          {s.decisionStatus && <Pill tone={s.decisionStatus === 'HIGH_QUALITY' ? 'green' : s.decisionStatus === 'GOOD_QUALITY' ? 'gold' : s.decisionStatus === 'WATCH' ? 'blue' : 'red'}>{s.decisionStatus}</Pill>}
                        </div>
                      </div>
                      <div className="op-grid">
                        <span>Breakeven <b>${fmt(econ.breakeven)}</b></span>
                        <span>Max Loss <b>${fmt(econ.maxLoss)}</b></span>
                        <span>Max Profit <b>{econ.maxProfit != null ? `$${fmt(econ.maxProfit)}` : '—'}</b></span>
                        <span>Net Premium <b>${fmt(econ.netPremium, 3)}</b></span>
                        <span>DTE <b>{s.legs?.[0]?.contract?.daysToExpiration != null ? s.legs[0].contract.daysToExpiration : '—'}</b></span>
                        <span>Exec <b>{s.classifiedExecutionQuality || '—'}</b></span>
                      </div>
                      <div className="op-foot">
                        <span>{s.description || 'استراتيجية خيارات'}</span>
                        <span>›</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">لا توجد إستراتيجيات متاحة. تحتاج إلى سلسلة خيارات مع عقود Calls و Puts بنفس الانتهاء.</div>
            )}
          </section>
        )}

        {tab === 'watchlist' && (
          <section className="glass section">
            <div className="section-head"><div><div className="eyebrow">OPTIONS WATCHLIST · MONITORING</div><h2>مراقبة العقود المختارة</h2></div><Pill tone="purple">{watchItems.length} مُراقب</Pill></div>
            <div className="warning">طبقة مراقبة فقط — لا إشارات شراء/بيع ولا اتجاه (Bullish/Bearish). تقارن لقطات البيانات كل 60 ثانية لاكتشاف التغيرات في Score والمخاطر والسيولة وIV والحجم.</div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
              <select
                value=""
                onChange={(e) => { const c = availableOptions.find((o) => (o.contract || o.symbol) === e.target.value); if (c) addToWatchlist(c); e.target.value = ''; }}
                style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10, minWidth: 200 }}
              >
                <option value="">+ إضافة عقد للمراقبة...</option>
                {availableOptions.map((o) => (
                  <option key={o.contract || o.symbol} value={o.contract || o.symbol}>{o.symbol} · {o.contract || '—'} · ${fmt(o.premium)}</option>
                ))}
              </select>
              <button className="btn" onClick={load}>↻ تحديث</button>
              <span className="muted">آخر تحديث: {new Date().toLocaleTimeString('ar-SA', { hour12: false })}</span>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
              <select value={watchSort} onChange={(e) => setWatchSort(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="watchRankScore">Watch Rank</option>
                <option value="decisionScore">Decision Score</option>
                <option value="risk">Risk</option>
                <option value="volume">Volume</option>
                <option value="openInterest">Open Interest</option>
                <option value="dte">DTE</option>
                <option value="lastUpdated">Last Updated</option>
              </select>
              <select value={watchFilterStatus} onChange={(e) => setWatchFilterStatus(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Watch Status</option>
                <option value="NEW">NEW</option>
                <option value="IMPROVING">IMPROVING</option>
                <option value="STABLE">STABLE</option>
                <option value="SLIGHTLY_DETERIORATING">SLIGHTLY_DETERIORATING</option>
                <option value="DETERIORATING">DETERIORATING</option>
                <option value="RISK_INCREASED">RISK_INCREASED</option>
                <option value="RISK_DECREASED">RISK_DECREASED</option>
                <option value="LIQUIDITY_IMPROVED">LIQUIDITY_IMPROVED</option>
                <option value="LIQUIDITY_DETERIORATED">LIQUIDITY_DETERIORATED</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
              <select value={watchFilterDecision} onChange={(e) => setWatchFilterDecision(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Decision</option>
                <option value="HIGH_QUALITY">HIGH QUALITY</option>
                <option value="GOOD_QUALITY">GOOD QUALITY</option>
                <option value="WATCH">WATCH</option>
                <option value="LOW_QUALITY">LOW QUALITY</option>
              </select>
              <select value={watchFilterRisk} onChange={(e) => setWatchFilterRisk(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Risk</option>
                <option value="LOW">LOW</option>
                <option value="MODERATE">MODERATE</option>
                <option value="HIGH">HIGH</option>
                <option value="EXTREME">EXTREME</option>
              </select>
              <select value={watchFilterExecution} onChange={(e) => setWatchFilterExecution(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All Execution</option>
                <option value="EXCELLENT">EXCELLENT</option>
                <option value="GOOD">GOOD</option>
                <option value="WATCH">WATCH</option>
                <option value="POOR">POOR</option>
              </select>
              <select value={watchFilterDte} onChange={(e) => setWatchFilterDte(e.target.value)} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value="ALL">All DTE</option>
                <option value="CRITICAL">DTE ≤ 3 (Critical)</option>
                <option value="HIGH_ATTENTION">DTE ≤ 7</option>
                <option value="NORMAL">DTE &gt; 7</option>
                <option value="EXPIRED">Expired</option>
              </select>
              <select value={watchMinScore} onChange={(e) => setWatchMinScore(Number(e.target.value))} style={{ background: '#0B1019', color: '#CBD5E1', border: `1px solid ${line}`, borderRadius: 8, padding: '6px 10px', fontSize: 10 }}>
                <option value={0}>Min Decision ≥ 0</option>
                <option value={55}>Min Decision ≥ 55</option>
                <option value={70}>Min Decision ≥ 70</option>
                <option value={85}>Min Decision ≥ 85</option>
              </select>
            </div>

            {/* Watch items grid */}
            {filteredWatch.length ? (
              <div className="op-grid-list">
                {filteredWatch.map((w) => {
                  const statusTone = w.watchStatus === 'IMPROVING' || w.watchStatus === 'RISK_DECREASED' || w.watchStatus === 'LIQUIDITY_IMPROVED' ? 'green'
                    : w.watchStatus === 'DETERIORATING' || w.watchStatus === 'RISK_INCREASED' || w.watchStatus === 'EXPIRED' ? 'red'
                    : w.watchStatus === 'SLIGHTLY_DETERIORATING' || w.watchStatus === 'LIQUIDITY_DETERIORATED' ? 'gold' : 'blue';
                  const fresh = classifyWatchFreshness(w.lastUpdated);
                  return (
                    <div key={w.contract} className="op-card" style={{ cursor: 'pointer' }} onClick={() => setWatchSelected(w.contract)}>
                      <div className="op-top">
                        <div style={{ textAlign: 'right' }}>
                          <div className="symbol">{w.underlying || w.symbol || w.contract}</div>
                          <div className="muted">{w.contract}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Pill tone={statusTone}>{w.watchStatus}</Pill>
                          {w.watchDteStatus && <Pill tone={w.watchDteStatus === 'EXPIRED' || w.watchDteStatus === 'CRITICAL' ? 'red' : 'gold'}>{w.watchDteStatus}</Pill>}
                          <Pill tone={fresh === 'FRESH' ? 'green' : fresh === 'AGING' ? 'gold' : fresh === 'STALE' ? 'red' : 'blue'}>{fresh}</Pill>
                        </div>
                      </div>
                      <div className="op-grid">
                        <span>Premium <b>${fmt(w.premium)}</b></span>
                        <span>Decision <b>{w.decisionScore ?? '—'}</b></span>
                        <span>Quality <b>{w.contractQuality || '—'}</b></span>
                        <span>Execution <b>{w.executionQuality || '—'}</b></span>
                        <span>Risk <b>{w.decisionRisk || '—'}</b></span>
                        <span>Vol <b>{Number(w.volume || 0).toLocaleString()}</b></span>
                        <span>OI <b>{Number(w.openInterest || 0).toLocaleString()}</b></span>
                        <span>IV <b>{w.impliedVolatility != null ? (w.impliedVolatility * 100).toFixed(1) + '%' : '—'}</b></span>
                        <span>DTE <b>{w.daysToExpiration != null ? w.daysToExpiration : '—'}{w.watchDteStatus ? ` · ${w.watchDteStatus}` : ''}</b></span>
                        <span>Watch Rank <b>{w.watchRankScore ?? '—'}</b></span>
                      </div>
                      <div className="op-foot">
                        <span>⏱ {w.lastUpdated ? new Date(w.lastUpdated).toLocaleTimeString('ar-SA', { hour12: false }) : '—'}</span>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: 9 }} onClick={(e) => { e.stopPropagation(); removeFromWatchlist(w.contract); }}>إزالة</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">لا توجد عقود في المراقبة. أضف عقدًا من القائمة أعلاه لبدء المراقبة.</div>
            )}

            {/* Detail view */}
            {watchSelected && watchSnapshots[watchSelected] && (() => {
              const w = watchSnapshots[watchSelected];
              const prev = w.previous || {};
              const diffRow = (label, a, b, fmtFn = (v) => (v == null ? '—' : v)) => (
                <div className="detail-box">{label}<br/><b>{fmtFn(a)} → {fmtFn(b)}</b></div>
              );
              const statusTone = w.watchStatus === 'IMPROVING' || w.watchStatus === 'RISK_DECREASED' || w.watchStatus === 'LIQUIDITY_IMPROVED' ? 'green'
                : w.watchStatus === 'DETERIORATING' || w.watchStatus === 'RISK_INCREASED' || w.watchStatus === 'EXPIRED' ? 'red'
                : w.watchStatus === 'SLIGHTLY_DETERIORATING' || w.watchStatus === 'LIQUIDITY_DETERIORATED' ? 'gold' : 'blue';
              return (
                <div className="detail" style={{ marginTop: 14 }}>
                  <div className="section-head">
                    <div><div className="eyebrow">WATCH DETAIL</div><h2>{w.underlying || w.symbol || w.contract} · {w.contract}</h2></div>
                    <button className="btn" onClick={() => setWatchSelected(null)}>إغلاق</button>
                  </div>
                  <div className="detail-grid">
                    <div className="detail-box">Decision<br/><b>{w.decisionScore ?? '—'}</b></div>
                    <div className="detail-box">Quality<br/><b>{w.contractQuality || '—'}</b></div>
                    <div className="detail-box">Execution<br/><b>{w.executionQuality || '—'}</b></div>
                    <div className="detail-box">Risk<br/><b>{w.decisionRisk || '—'}</b></div>
                  </div>

                  <div className="detail-grid" style={{ marginTop: 12 }}>
                    <div className="detail-box">Watch Status<br/><Pill tone={statusTone}>{w.watchStatus}</Pill></div>
                    <div className="detail-box">Watch Rank<br/><b>{w.watchRankScore ?? '—'}</b></div>
                    <div className="detail-box">Premium<br/><b>${fmt(w.premium)}</b></div>
                    <div className="detail-box">Strike / DTE<br/><b>${fmt(w.strike)} · {w.daysToExpiration ?? '—'}</b></div>
                    <div className="detail-box">Volume / OI<br/><b>{Number(w.volume || 0).toLocaleString()} / {Number(w.openInterest || 0).toLocaleString()}</b></div>
                    <div className="detail-box">IV<br/><b>{w.impliedVolatility != null ? (w.impliedVolatility * 100).toFixed(1) + '%' : '—'}</b></div>
                    <div className="detail-box">Spread<br/><b>{w.spreadPct != null ? w.spreadPct.toFixed(1) + '%' : '—'}</b></div>
                    <div className="detail-box">Freshness<br/><b>{classifyWatchFreshness(w.lastUpdated)}</b></div>
                  </div>

                  {w.watchReasons && w.watchReasons.length > 0 && (
                    <div className="detail-grid" style={{ marginTop: 12 }}>
                      <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                        <div className="eyebrow">WHY</div>
                        <ul style={{ margin: '8px 0 0 16px', padding: 0, color: '#94A3B8', fontSize: 10 }}>
                          {w.watchReasons.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}

                  {w.watchWarnings && w.watchWarnings.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {w.watchWarnings.map((wr, i) => <Pill key={i} tone="red">{wr}</Pill>)}
                    </div>
                  )}

                  <div className="detail-grid" style={{ marginTop: 14 }}>
                    <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                      <div className="eyebrow">WHAT CHANGED</div>
                      <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                        {diffRow('Decision Score', prev.decisionScore, w.decisionScore)}
                        {diffRow('Contract Rank', prev.contractRankScore, w.contractRankScore)}
                        {diffRow('Risk Adj', prev.riskAdjustedScore, w.riskAdjustedScore)}
                        {diffRow('Risk', prev.decisionRisk, w.decisionRisk)}
                        {diffRow('Volume', prev.volume, w.volume, (v) => Number(v || 0).toLocaleString())}
                        {diffRow('Open Interest', prev.openInterest, w.openInterest, (v) => Number(v || 0).toLocaleString())}
                        {diffRow('IV', prev.impliedVolatility, w.impliedVolatility, (v) => v != null ? (v * 100).toFixed(1) + '%' : '—')}
                        {diffRow('Premium', prev.premium, w.premium, (v) => '$' + fmt(v))}
                        {diffRow('DTE', prev.daysToExpiration, w.daysToExpiration)}
                      </div>
                      {!prev.decisionScore && !prev.contractRankScore && (
                        <div className="note" style={{ marginTop: 8 }}>أول لقطة مراقبة — لا يوجد سابق للمقارنة.</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {tab === 'institutional' && (
          <section className="glass section">
            <div className="section-head"><div><div className="eyebrow">INSTITUTIONAL INTELLIGENCE</div><h2>تدفق المؤسسات (FINRA ATS/OTC)</h2></div>
              <Pill tone={data?.dataAvailability?.institutionalFlow ? 'green' : 'gold'}>
                {data?.dataAvailability?.institutionalFlow ? 'متاح' : 'مزود غير متصل'}
              </Pill>
            </div>
            <div className="warning">
              بيانات FINRA ATS/OTC أسبوعية ومجمعة ومتأخرة. لا تشير إلى اتجاه الشراء/البيع وليست تدفق Dark Pool فوري.
            </div>
            {data?.opportunities && data.opportunities.length > 0 ? (
              <div className="op-grid-list">
                {data.opportunities.slice(0, 9).map((opp, i) => {
                  const inst = opp.institutionalIntelligence;
                  const score = inst?.score;
                  const available = inst?.available;
                  const provider = inst?.provider;
                  const reason = inst?.reason;
                  const capabilities = inst?.capabilities;
                  return (
                    <div key={`${opp.symbol}-inst-${i}`} className="op-card" style={{ cursor: 'default' }}>
                      <div className="op-top">
                        <div style={{ textAlign: 'right' }}>
                          <div className="symbol">{opp.symbol}</div>
                          <div className="muted">INSTITUTIONAL FLOW</div>
                        </div>
                        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                          <Pill tone={available ? 'green' : 'gold'}>
                            {available ? `Score ${score}/100` : 'غير متاح'}
                          </Pill>
                          <Pill tone="blue">{provider || '—'}</Pill>
                        </div>
                      </div>
                      <div className="op-grid">
                        {available ? (
                          <>
                            <span>ATS Volume <b>{Number(opp.institutionalData?.atsShareQuantity || 0).toLocaleString()}</b></span>
                            <span>ATS Trades <b>{Number(opp.institutionalData?.atsTradeCount || 0).toLocaleString()}</b></span>
                            <span>Week <b>{opp.institutionalData?.weekStartDate || '—'}</b></span>
                            <span>Tier <b>{opp.institutionalData?.tier || '—'}</b></span>
                          </>
                        ) : (
                          <>
                            <span>الحالة <b>{reason || 'مزود غير متصل'}</b></span>
                            <span>ATS Activity <b>{capabilities?.atsActivity ? 'نعم' : 'لا'}</b></span>
                            <span>OTC Activity <b>{capabilities?.otcActivity ? 'نعم' : 'لا'}</b></span>
                            <span>Real-time <b>{capabilities?.darkPoolRealtime ? 'نعم' : 'لا'}</b></span>
                          </>
                        )}
                      </div>
                      <div className="op-foot">
                        <span>{available ? 'نشاط ATS/OTC مؤكد' : 'يتطلب ربط FINRA API'}</span>
                        <span>›</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">لا توجد فرص مؤهلة لعرض بيانات المؤسسات.</div>
            )}
            <div className="note">
              Institutional Score (0-100) يعكس شدة نشاط ATS فقط (حجم الأسهم + عدد الصفقات + حداثة البيانات).
              لا يشير إلى اتجاه. يتطلب FINRA_API_CLIENT_ID و FINRA_API_CLIENT_SECRET.
            </div>
          </section>
        )}

        {tab === 'alerts' && (
          <section className="glass section">
            <div className="section-head"><div><div className="eyebrow">AUTOMATION</div><h2>التنبيهات التلقائية</h2></div><Pill tone="green">HUNTER ALERTS</Pill></div>
            <div className="op-grid-list">
              <div className="detail-box"><b>Telegram</b><div className="note">يُرسل التنبيه من السيرفر عند تجاوز عتبات Hunter إذا كانت إعدادات Telegram موجودة.</div></div>
              <div className="detail-box"><b>Discord</b><div className="note">نفس محرك التنبيه، بدون كشف أسرار webhook للمتصفح.</div></div>
              <div className="detail-box"><b>الجوال</b><div className="note">فعّل زر تنبيهات الجوال. طالما المنصة مفتوحة، يراقب المتصفح الفرص الجديدة.</div></div>
            </div>
            <div className="note">التنبيهات السيرفرية تعتمد على Vercel Cron. على Hobby الجدولة محدودة إلى مرة يوميًا؛ على Pro يمكن تشغيلها كل دقيقة.</div>
          </section>
        )}

        {selected && (
          <section className="detail">
            <div className="section-head">
              <div><div className="eyebrow">HUNTER DETAIL</div><h2>{selected.symbol} {selected.contract ? `· ${selected.contract}` : ''}</h2></div>
              <button className="btn" onClick={() => setSelected(null)}>إغلاق</button>
            </div>
            <div className="detail-grid">
              <div className="detail-box">Score<br/><b>{selected.score ?? selected.setupScore ?? '—'}</b></div>
              <div className="detail-box">Price / Premium<br/><b>${fmt(selected.price ?? selected.premium)}</b></div>
              <div className="detail-box">RVOL / Volume<br/><b>{selected.rvol != null ? `${fmt(selected.rvol)}x` : Number(selected.volume || 0).toLocaleString()}</b></div>
              <div className="detail-box">RSI / OI<br/><b>{selected.rsi ?? selected.openInterest ?? '—'}</b></div>
            </div>

            {/* Options Intelligence */}
            {isOption && selected.optionsIntelligence && (
              <div className="detail-grid" style={{ marginTop: 12 }}>
                <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                  <div className="eyebrow">OPTIONS INTELLIGENCE</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                    <Pill tone={selected.optionsIntelligence.available ? 'green' : selected.optionsIntelligence.state === 'timeout' ? 'red' : selected.optionsIntelligence.state === 'error' ? 'red' : 'gold'}>
                      {selected.optionsIntelligence.state?.toUpperCase() || 'UNAVAILABLE'}
                    </Pill>
                    <span className="muted">Source: {selected.optionsIntelligence.source || '—'}</span>
                    {selected.optionsIntelligence.reason && <span className="muted">Reason: {selected.optionsIntelligence.reason}</span>}
                  </div>
                  {selected.optionsIntelligence.summary && (
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                      <div className="detail-box">Underlying<br/><b>${fmt(selected.optionsIntelligence.summary.underlyingPrice)}</b></div>
                      <div className="detail-box">Expiry<br/><b>{selected.optionsIntelligence.summary.expiry || '—'}</b></div>
                      <div className="detail-box">Contracts<br/><b>{selected.optionsIntelligence.summary.count}</b></div>
                      <div className="detail-box">Calls / Puts<br/><b>{selected.optionsIntelligence.summary.calls} / {selected.optionsIntelligence.summary.puts}</b></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Options Ranking */}
            {isOption && selected.contractRankScore != null && (
              <div className="detail-grid" style={{ marginTop: 12 }}>
                <div className="detail-box">Rank Score<br/><b>{selected.contractRankScore ?? '—'}</b></div>
                <div className="detail-box">Quality<br/><b>{selected.contractQuality || '—'}</b></div>
                <div className="detail-box">Risk Adjusted<br/><b>{selected.riskAdjustedScore ?? '—'} {selected.riskAdjustedLevel ? `(${selected.riskAdjustedLevel})` : ''}</b></div>
                <div className="detail-box">DTE Risk<br/><b>{selected.dteRisk || '—'}</b></div>
                <div className="detail-box">IV Level<br/><b>{selected.ivLevel || '—'}</b></div>
                <div className="detail-box">Strike<br/><b>{selected.strikeClassification || '—'}</b></div>
                <div className="detail-box">Premium Quality<br/><b>{selected.premiumQualityLevel || '—'}</b></div>
                <div className="detail-box">Data Status<br/><b>{selected.optionsIntelligence?.dataStatus || selected.optionsFlow?.dataStatus || '—'}</b></div>
              </div>
            )}

            {/* Options Flow */}
            {isOption && selected.optionsFlow && (
              <div className="detail-grid" style={{ marginTop: 12 }}>
                <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                  <div className="eyebrow">OPTIONS FLOW</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                    <Pill tone={selected.optionsFlow.flowDirection === 'UNAVAILABLE' ? 'gold' : 'blue'}>
                      FLOW: {selected.optionsFlow.flowDirection || 'UNAVAILABLE'}
                    </Pill>
                    <span className="muted">Confidence: <b>{selected.optionsFlow.flowConfidence ?? '—'}</b></span>
                    <span className="muted">Score: <b>{selected.optionsFlow.flowScore ?? '—'}</b></span>
                    <span className="muted">Divergence: <b>{selected.optionsFlow.flowDivergence || '—'}</b></span>
                  </div>
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                    <div className="detail-box">Call Vol<br/><b>{Number(selected.optionsFlow.callVolume || 0).toLocaleString()}</b></div>
                    <div className="detail-box">Put Vol<br/><b>{Number(selected.optionsFlow.putVolume || 0).toLocaleString()}</b></div>
                    <div className="detail-box">Call OI<br/><b>{Number(selected.optionsFlow.callOI || 0).toLocaleString()}</b></div>
                    <div className="detail-box">Put OI<br/><b>{Number(selected.optionsFlow.putOI || 0).toLocaleString()}</b></div>
                    <div className="detail-box">Vol/OI<br/><b>{selected.optionsFlow.volumeToOIRatio != null ? selected.optionsFlow.volumeToOIRatio.toFixed(2) : '—'}</b></div>
                    <div className="detail-box">Activity<br/><b>{selected.optionsFlow.activityStrength || '—'}</b></div>
                    <div className="detail-box">Call/Put Pressure<br/><b>{selected.optionsFlow.callPutPressure || '—'}</b></div>
                    <div className="detail-box">Premium Pressure<br/><b>{selected.optionsFlow.premiumPressureScore ?? '—'}</b></div>
                  </div>
                  {selected.optionsFlow.flowRiskFlags && selected.optionsFlow.flowRiskFlags.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {selected.optionsFlow.flowRiskFlags.map((flag, i) => <Pill key={i} tone="red">{flag}</Pill>)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Decision Engine */}
            {isOption && selected.decisionStatus && (
              <div className="detail-grid" style={{ marginTop: 12 }}>
                <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                  <div className="eyebrow">DECISION ENGINE</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                    <Pill tone={selected.decisionStatus === 'HIGH_QUALITY' ? 'green' : selected.decisionStatus === 'GOOD_QUALITY' ? 'gold' : selected.decisionStatus === 'WATCH' ? 'blue' : 'red'}>
                      {selected.decisionStatus}
                    </Pill>
                    <span className="muted">Decision Score: <b>{selected.decisionScore ?? '—'}</b></span>
                    <span className="muted">Execution: <b>{selected.executionQuality || '—'}</b></span>
                    <span className="muted">Risk: <b>{selected.decisionRisk || '—'}</b></span>
                  </div>
                  {selected.decisionReasons && selected.decisionReasons.length > 0 && (
                    <div style={{ marginTop: 10, color: '#94A3B8', fontSize: 10 }}>
                      <div className="muted" style={{ marginBottom: 4 }}>WHY</div>
                      {selected.decisionReasons.map((r, i) => <div key={i}>• {r}</div>)}
                    </div>
                  )}
                  {selected.decisionWarnings && selected.decisionWarnings.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {selected.decisionWarnings.map((w, i) => <Pill key={i} tone="red">{w}</Pill>)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Options Warnings & Reasons */}
            {isOption && selected.contractWarnings && selected.contractWarnings.length > 0 && (
              <div className="detail-grid" style={{ marginTop: 12 }}>
                <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                  <div className="eyebrow">CONTRACT WARNINGS</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {selected.contractWarnings.map((w, i) => <Pill key={i} tone="red">{w}</Pill>)}
                  </div>
                </div>
              </div>
            )}

            {isOption && selected.contractReasons && selected.contractReasons.length > 0 && (
              <div className="detail-grid" style={{ marginTop: 12 }}>
                <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                  <div className="eyebrow">WHY THIS CONTRACT</div>
                  <ul style={{ margin: '8px 0 0 16px', padding: 0, color: '#94A3B8', fontSize: 10 }}>
                    {selected.contractReasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* Best Contract */}
            {isOption && selected.optionsRanking && selected.symbol && (
              (() => {
                const ranking = selected.optionsRanking[selected.symbol];
                if (!ranking || !ranking.summary) return null;
                const summary = ranking.summary;
                return (
                  <div className="detail-grid" style={{ marginTop: 12 }}>
                    <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                      <div className="eyebrow">BEST CONTRACT</div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                        <Pill tone={summary.bestContractQuality === 'EXCEPTIONAL' || summary.bestContractQuality === 'STRONG' ? 'green' : 'gold'}>
                          {summary.bestContractQuality || '—'}
                        </Pill>
                        <span className="muted">Rank: <b>{summary.bestContractRankScore ?? '—'}</b></span>
                        <span className="muted">Contracts: <b>{summary.contractCount}</b></span>
                        <span className="muted">Avg Rank: <b>{summary.averageRankScore ?? '—'}</b></span>
                      </div>
                      {summary.bestContractReasons && summary.bestContractReasons.length > 0 && (
                        <div style={{ marginTop: 8, color: '#94A3B8', fontSize: 10 }}>
                          {summary.bestContractReasons.slice(0, 3).map((r, i) => <div key={i}>• {r}</div>)}
                        </div>
                      )}
                      {summary.alternativeContracts && summary.alternativeContracts.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div className="muted" style={{ marginBottom: 4 }}>TOP ALTERNATIVES</div>
                          {summary.alternativeContracts.map((alt, i) => (
                            <div key={i} style={{ fontSize: 10, color: '#94A3B8', padding: '2px 0' }}>
                              #{i + 1} Rank: {alt.contractRankScore ?? '—'} | Quality: {alt.contractQuality || '—'}
                              {alt.reasons && alt.reasons[0] && ` | ${alt.reasons[0]}`}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}

            {/* Options Signal */}
            {selected.optionsSignal && (
              <div className="detail-grid" style={{ marginTop: 12 }}>
                <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                  <div className="eyebrow">OPTIONS SIGNAL (NON-SCORING)</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                    <Pill tone={selected.optionsSignal.bias === 'bullish' ? 'green' : selected.optionsSignal.bias === 'bearish' ? 'red' : selected.optionsSignal.bias === 'neutral' ? 'blue' : 'gold'}>
                      {selected.optionsSignal.bias?.toUpperCase() || 'INSUFFICIENT'}
                    </Pill>
                    <span className="muted">Score: <b>{selected.optionsSignal.score ?? '—'}</b>/100</span>
                    <span className="muted">Confidence: <b>{selected.optionsSignal.confidence ?? '—'}</b>/100</span>
                    <span className="muted">Source: {selected.optionsSignal.source || '—'}</span>
                  </div>
                  {selected.optionsSignal.factors && (
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                      <div className="detail-box">Call Vol<br/><b>{Number(selected.optionsSignal.factors.callVolume || 0).toLocaleString()}</b></div>
                      <div className="detail-box">Put Vol<br/><b>{Number(selected.optionsSignal.factors.putVolume || 0).toLocaleString()}</b></div>
                      <div className="detail-box">Call/Put Vol Ratio<br/><b>{selected.optionsSignal.factors.callPutRatio != null ? selected.optionsSignal.factors.callPutRatio.toFixed(2) : '—'}</b></div>
                      <div className="detail-box">Call/Put OI Ratio<br/><b>{selected.optionsSignal.factors.oiRatio != null ? selected.optionsSignal.factors.oiRatio.toFixed(2) : '—'}</b></div>
                      <div className="detail-box">Call OI<br/><b>{Number(selected.optionsSignal.factors.callOpenInterest || 0).toLocaleString()}</b></div>
                      <div className="detail-box">Put OI<br/><b>{Number(selected.optionsSignal.factors.putOpenInterest || 0).toLocaleString()}</b></div>
                      <div className="detail-box">Avg IV<br/><b>{selected.optionsSignal.factors.impliedVolatility != null ? (selected.optionsSignal.factors.impliedVolatility * 100).toFixed(1) + '%' : '—'}</b></div>
                      <div className="detail-box">Avg Liquidity<br/><b>{selected.optionsSignal.factors.liquidity ?? '—'}</b>/100</div>
                    </div>
                  )}
                  <div className="note" style={{ marginTop: 8 }}>
                    {selected.optionsSignal.reason || 'لا توجد إشارة خيارات.'}
                  </div>
                </div>
              </div>
            )}

            {/* Institutional Intelligence */}
            {selected.institutionalIntelligence && (
              <div className="detail-grid" style={{ marginTop: 12 }}>
                <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                  <div className="eyebrow">INSTITUTIONAL INTELLIGENCE</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                    <Pill tone={selected.institutionalIntelligence.available ? 'green' : 'gold'}>
                      {selected.institutionalIntelligence.available ? `Score ${selected.institutionalIntelligence.score}/100` : 'غير متاح'}
                    </Pill>
                    <span className="muted">Provider: {selected.institutionalIntelligence.provider || '—'}</span>
                    {selected.institutionalIntelligence.reason && <span className="muted">Reason: {selected.institutionalIntelligence.reason}</span>}
                  </div>
                  {selected.institutionalData && selected.institutionalIntelligence.available && (
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                      <div className="detail-box">ATS Volume<br/><b>{Number(selected.institutionalData.atsShareQuantity || 0).toLocaleString()}</b></div>
                      <div className="detail-box">ATS Trades<br/><b>{Number(selected.institutionalData.atsTradeCount || 0).toLocaleString()}</b></div>
                      <div className="detail-box">Week Start<br/><b>{selected.institutionalData.weekStartDate || '—'}</b></div>
                      <div className="detail-box">Tier<br/><b>{selected.institutionalData.tier || '—'}</b></div>
                    </div>
                  )}
                  <div className="note" style={{ marginTop: 8 }}>
                    {selected.institutionalIntelligence.note || 'بيانات مؤسسية غير متاحة.'}
                  </div>
                </div>
              </div>
            )}

              {/* Options Strategy */}
              {selected.kind === 'STRATEGY' && selected.strategyType && (
                <div className="detail-grid" style={{ marginTop: 12 }}>
                  <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                    <div className="eyebrow">OPTIONS STRATEGY</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                      <Pill tone={selected.strategyQuality === 'EXCEPTIONAL' || selected.strategyQuality === 'STRONG' ? 'green' : selected.strategyQuality === 'GOOD' ? 'gold' : 'blue'}>
                        {selected.strategyQuality || '—'}
                      </Pill>
                      <Pill tone={selected.combinedRisk === 'LOW' ? 'green' : selected.combinedRisk === 'MODERATE' ? 'gold' : selected.combinedRisk === 'HIGH' ? 'red' : selected.combinedRisk === 'EXTREME' ? 'red' : 'blue'}>
                        RISK: {selected.combinedRisk || '—'}
                      </Pill>
                      <span className="muted">A2.7 Score: <b>{selected.strategyScore ?? '—'}/100</b></span>
                      <span className="muted">A2.8 Decision: <b>{selected.strategyDecisionScore ?? '—'}/100</b></span>
                      <span className="muted">Symbol: <b>{selected.symbol || '—'}</b></span>
                      {selected.decisionStatus && <Pill tone={selected.decisionStatus === 'HIGH_QUALITY' ? 'green' : selected.decisionStatus === 'GOOD_QUALITY' ? 'gold' : selected.decisionStatus === 'WATCH' ? 'blue' : 'red'}>{selected.decisionStatus}</Pill>}
                    </div>
                    {selected.description && <div className="subtitle" style={{ marginTop: 6 }}>{selected.description}</div>}
                    {selected.strategyEconomics && (
                      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                        <div className="detail-box">Max Profit<br/><b>{selected.strategyEconomics.maxProfit != null ? '$' + fmt(selected.strategyEconomics.maxProfit) : '—'}</b></div>
                        <div className="detail-box">Max Loss<br/><b>${fmt(selected.strategyEconomics.maxLoss)}</b></div>
                        <div className="detail-box">Breakeven<br/><b>${fmt(selected.strategyEconomics.breakeven)}</b></div>
                        <div className="detail-box">Net Premium<br/><b>${fmt(selected.strategyEconomics.netPremium, 3)}</b></div>
                        {selected.strategyEconomics.spreadWidth != null && (
                          <div className="detail-box">Spread Width<br/><b>${fmt(selected.strategyEconomics.spreadWidth)}</b></div>
                        )}
                        <div className="detail-box">Economics Quality<br/><b>{selected.economicsQuality ?? '—'}/100</b></div>
                        <div className="detail-box">Underlying<br/><b>${fmt(selected.strategyEconomics.underlying || selected.underlying)}</b></div>
                        <div className="detail-box">DTE<br/><b>{selected.legs?.[0]?.contract?.daysToExpiration ?? '—'}</b></div>
                      </div>
                    )}
                    {selected.classifiedExecutionQuality && (
                      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                        <div className="detail-box">Execution Quality<br/><b>{selected.classifiedExecutionQuality}</b></div>
                        <div className="detail-box">Combined Risk<br/><b>{selected.combinedRisk || '—'}</b></div>
                        <div className="detail-box">Data Status<br/><b>{selected.strategyEconomics ? (selected.legs?.every(l => l.contract.premium != null && l.contract.strike != null) ? 'complete' : 'partial') : '—'}</b></div>
                        <div className="detail-box">Valid<br/><b>{selected.strategyValid ? 'Yes' : 'No'}</b></div>
                      </div>
                    )}
                    {selected.decisionReasons && selected.decisionReasons.length > 0 && (
                      <div style={{ marginTop: 10, color: '#94A3B8', fontSize: 10 }}>
                        <div className="muted" style={{ marginBottom: 4 }}>DECISION REASONS</div>
                        {selected.decisionReasons.map((r, i) => <div key={i}>• {r}</div>)}
                      </div>
                    )}
                    {selected.decisionFlags && selected.decisionFlags.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selected.decisionFlags.map((f, i) => <Pill key={i} tone={f.includes('HIGH_RISK') ? 'red' : f.includes('TOP_RANKED') || f.includes('HIGH_QUALITY') ? 'green' : 'blue'}>{f}</Pill>)}
                      </div>
                    )}
                    {selected.strategyWarnings && selected.strategyWarnings.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selected.strategyWarnings.map((w, i) => <Pill key={i} tone="red">{w}</Pill>)}
                      </div>
                    )}
                    {selected.legs && selected.legs.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div className="muted" style={{ marginBottom: 4 }}>LEGS</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                          {selected.legs.map((leg, i) => {
                            const c = leg.contract;
                            return (
                              <div key={i} className="detail-box">
                                <div style={{ fontSize: 9 }}>{leg.role} {leg.ratio === 1 ? 'BUY' : 'SELL'}</div>
                                <b>{c?.symbol || '—'}</b>
                                <div className="muted" style={{ fontSize: 9 }}>{c?.optionType} ${fmt(c?.strike)} @ ${fmt(c?.premium)}</div>
                                <div className="muted" style={{ fontSize: 9 }}>Rank: {leg.rank?.contractRankScore ?? '—'}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Strategy summary with decision for options contract detail */}
              {selected.kind === 'OPTIONS_CENTS' && selected.symbol && data?.optionsRanking && (data.optionsRanking[selected.symbol]?.strategy || data.optionsRanking[selected.symbol]?.strategyDecision) && (
                <div className="detail-grid" style={{ marginTop: 12 }}>
                  <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                    <div className="eyebrow">OPTIONS STRATEGY (A2.7 • A2.8) — {selected.symbol}</div>
                    {(() => {
                      const stratDec = data.optionsRanking[selected.symbol]?.strategyDecision;
                      const strat = data.optionsRanking[selected.symbol]?.strategy?.bestStrategy;
                      if (!strat && !stratDec?.recommended) {
                        return <span className="muted">لا توجد إستراتيجيات متاحة لهذا الرمز.</span>;
                      }
                      const rec = stratDec?.recommended || strat;
                      const econ = rec?.strategyEconomics || {};
                      return (
                        <>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                            <Pill tone={rec?.strategyQuality === 'EXCEPTIONAL' || rec?.strategyQuality === 'STRONG' ? 'green' : 'gold'}>
                              {rec?.label} — {rec?.strategyQuality}
                            </Pill>
                            <Pill tone={rec?.combinedRisk === 'LOW' ? 'green' : rec?.combinedRisk === 'MODERATE' ? 'gold' : 'red'}>
                              RISK: {rec?.combinedRisk || rec?.strategyRisk || '—'}
                            </Pill>
                            <span className="muted">A2.7: <b>{rec?.strategyScore ?? '—'}</b></span>
                            <span className="muted">A2.8: <b>{rec?.strategyDecisionScore ?? '—'}</b></span>
                            <span className="muted">Decision: <b>{rec?.decisionStatus || '—'}</b></span>
                            <span className="muted">Exec: <b>{rec?.classifiedExecutionQuality || '—'}</b></span>
                          </div>
                          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                            <div className="detail-box">Max Profit<br/><b>{econ.maxProfit != null ? '$' + fmt(econ.maxProfit) : '—'}</b></div>
                            <div className="detail-box">Max Loss<br/><b>${fmt(econ.maxLoss)}</b></div>
                            <div className="detail-box">Breakeven<br/><b>${fmt(econ.breakeven)}</b></div>
                            <div className="detail-box">Net Premium<br/><b>${fmt(econ.netPremium, 3)}</b></div>
                          </div>
                        </>
                      );
                    })()}
                    {(() => {
                      const stratDec = data.optionsRanking[selected.symbol]?.strategyDecision;
                      if (stratDec?.alternativeStrategies && stratDec.alternativeStrategies.length > 0) {
                        return (
                          <div style={{ marginTop: 10 }}>
                            <div className="muted" style={{ marginBottom: 4 }}>ALTERNATIVE STRATEGIES</div>
                            <div style={{ fontSize: 10, color: '#94A3B8' }}>
                              {stratDec.alternativeStrategies.map((a, i) => (
                                <div key={i} style={{ padding: '2px 0' }}>
                                  • {a.label || a.strategyType} — Score {a.strategyDecisionScore ?? a.strategyScore ?? '—'} — Risk {a.combinedRisk || a.strategyRisk || '—'}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {(() => {
                      const stratDec = data.optionsRanking[selected.symbol]?.strategyDecision;
                      if (stratDec?.avoidStrategies && stratDec.avoidStrategies.length > 0) {
                        return (
                          <div style={{ marginTop: 10 }}>
                            <div className="muted" style={{ marginBottom: 4, color: '#FB7185' }}>AVOID STRATEGIES</div>
                            <div style={{ fontSize: 10, color: '#FB7185' }}>
                              {stratDec.avoidStrategies.map((a, i) => (
                                <div key={i} style={{ padding: '2px 0' }}>
                                  • {a.strategyType} — Score {a.strategyDecisionScore ?? '—'} — {a.reasons.join(', ')}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}

            <div className="note">{(selected.reasons || []).join(' • ') || selected.action || 'لا توجد ملاحظات إضافية.'}</div>
          </section>
        )}
      </div>

      <div className="bottom-nav">
        {tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
    </main>
  );
}
