'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

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

function OpportunityCard({ item, onSelect }) {
  const isOption = item.kind === 'OPTIONS_CENTS';
  const isPenny = item.kind === 'PENNY';
  const tone = item.score >= 85 ? 'green' : item.score >= 75 ? 'gold' : 'blue';

  return (
    <button className="op-card" onClick={() => onSelect(item)}>
      <div className="op-top">
        <div style={{ textAlign: 'right' }}>
          <div className="symbol">{item.symbol}</div>
          <div className="muted">{isOption ? item.contract : isPenny ? 'LOW-PRICE RADAR' : 'TECHNICAL HUNTER'}</div>
        </div>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <Pill tone={tone}>{item.score}/100</Pill>
          <Pill tone={isOption ? 'purple' : isPenny ? 'red' : 'blue'}>{item.kind}</Pill>
        </div>
      </div>

      <div className="op-grid">
        {isOption ? (
          <>
            <span>Premium <b>${fmt(item.premium)}</b></span>
            <span>Contract <b>${fmt(item.contractCost)}</b></span>
            <span>Strike <b>${fmt(item.strike)}</b></span>
            <span>Expiry <b>{item.expiry || '—'}</b></span>
            <span>Volume <b>{Number(item.volume || 0).toLocaleString()}</b></span>
            <span>OI <b>{Number(item.openInterest || 0).toLocaleString()}</b></span>
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

  const stats = useMemo(() => ({
    total: technical.length,
    penny: penny.length,
    options: options.length,
    a: top.filter((x) => Number(x.score) >= 85).length,
  }), [technical, penny, options, top]);

  const tabs = [
    ['command', '⌂ القيادة'],
    ['radar', '🎯 الأسهم'],
    ['penny', '🪙 سنتات الأسهم'],
    ['options', '⚡ عقود السنتات'],
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
            {options.length ? <div className="op-grid-list">{options.map((x, i) => <OpportunityCard key={`${x.contract}-${i}`} item={{ ...x, kind: 'OPTIONS_CENTS' }} onSelect={setSelected} />)}</div> : <div className="empty">لا توجد عقود Cents متاحة حاليًا أو لم تُرجع سلسلة الخيارات بيانات.</div>}
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
            {selected.optionsIntelligence && (
              <div className="detail-grid" style={{ marginTop: 12 }}>
                <div className="detail-box" style={{ gridColumn: 'span 4' }}>
                  <div className="eyebrow">OPTIONS INTELLIGENCE</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
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
