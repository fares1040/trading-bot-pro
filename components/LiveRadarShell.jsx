'use client';

import React,{useMemo,useState} from 'react';
import LiveRadar from '@/components/LiveRadar';
import { buildLiveIntelligenceSummary } from '@/lib/live-intelligence-summary';

const items=[
  {label:'بيانات حديثة',key:'fresh',text:'لقطات السوق المتاحة حاليًا'},
  {label:'التسارع',key:'preparing',text:'حركة تتكوّن تدريجيًا'},
  {label:'التدفقات',key:'flowObserved',text:'تدفقات مدعومة بأدلة'},
  {label:'الإشعال',key:'ignition',text:'تلاقي عدة إشارات'},
];

const stateRank={IGNITION:4,PREPARING:3,OPPORTUNITY:2,WATCH:1};
function rankLiveEntry(entry){
  const state=entry?.earlyExplosion?.state||'QUIET';
  const pressure=Number(entry?.pulse?.pressureScore);
  const fresh=entry?.freshness==='FRESH'?1:0;
  return (stateRank[state]||0)*1000+(Number.isFinite(pressure)?pressure:0)*10+fresh;
}
function decisionLabel(entry){
  const state=entry?.earlyExplosion?.state;
  if(state==='IGNITION')return'إشعال';
  if(state==='PREPARING')return'تهيؤ';
  if(entry?.status==='OPPORTUNITY')return'فرصة';
  if(entry?.status==='WATCH')return'مراقبة';
  return'متابعة';
}

export default function LiveRadarShell(){
  const[liveData,setLiveData]=useState([]);
  const summary=useMemo(()=>buildLiveIntelligenceSummary(liveData),[liveData]);
  const topDecisions=useMemo(()=>liveData.filter(entry=>entry?.freshness==='FRESH'&&(['IGNITION','PREPARING'].includes(entry?.earlyExplosion?.state)||['OPPORTUNITY','WATCH'].includes(entry?.status))).sort((a,b)=>rankLiveEntry(b)-rankLiveEntry(a)).slice(0,3),[liveData]);
  return <div className="live-radar-shell" dir="rtl">
    <style jsx>{`.live-radar-shell{display:flex;flex-direction:column;gap:12px}.live-radar-cockpit{display:grid;grid-template-columns:minmax(220px,1.25fr) repeat(4,minmax(120px,1fr));gap:6px;padding:8px;border:1px solid rgba(52,211,153,.18);border-radius:12px;background:linear-gradient(135deg,rgba(16,185,129,.055),rgba(5,8,13,.86))}.live-radar-lead{padding:7px 10px}.live-radar-title{color:#34D399;font:900 9px/1 sans-serif;letter-spacing:.9px}.live-radar-subtitle{margin-top:5px;color:#64748B;font:600 8px/1.35 sans-serif}.live-radar-item{padding:7px 9px;border-right:1px solid rgba(71,85,105,.25)}.live-radar-item-label{color:#94A3B8;font:900 7px/1 sans-serif}.live-radar-item-value{margin-top:4px;color:#E2E8F0;font:900 12px/1 monospace}.live-radar-item-text{margin-top:3px;color:#64748B;font:600 7px/1.25 sans-serif}.live-radar-meta{display:flex;gap:8px;flex-wrap:wrap;padding:0 2px;color:#64748B;font:700 8px/1.4 sans-serif}.live-radar-disclaimer{padding:0 2px;color:#475569;font:600 8px/1.4 sans-serif}.live-decision-board{display:grid;grid-template-columns:1.15fr repeat(3,1fr);gap:6px;padding:8px;border:1px solid rgba(56,189,248,.16);border-radius:12px;background:linear-gradient(135deg,rgba(56,189,248,.045),rgba(5,8,13,.86))}.live-decision-lead{padding:7px 10px}.live-decision-title{color:#38BDF8;font:900 9px/1 sans-serif}.live-decision-subtitle{margin-top:5px;color:#64748B;font:600 8px/1.35 sans-serif}.live-decision-card{min-width:0;padding:8px 9px;border:1px solid rgba(71,85,105,.3);border-radius:9px;background:rgba(7,10,16,.72)}.live-decision-symbol{display:flex;justify-content:space-between;align-items:center;gap:6px;color:#E2E8F0;font:900 11px/1 monospace}.live-decision-state{color:#34D399;font:800 7px/1 sans-serif}.live-decision-details{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;color:#94A3B8;font:700 7px/1.3 sans-serif}.live-decision-empty{grid-column:1/-1;padding:9px;color:#64748B;font:700 8px/1.4 sans-serif;text-align:center}@media(max-width:900px){.live-radar-cockpit{grid-template-columns:1fr 1fr}.live-radar-lead{grid-column:1/-1}.live-decision-board{grid-template-columns:1fr 1fr}.live-decision-lead{grid-column:1/-1}}@media(max-width:520px){.live-radar-cockpit{grid-template-columns:1fr;padding:7px}.live-radar-lead{grid-column:auto;padding:7px 8px 9px}.live-radar-item{border-right:0;border-top:1px solid rgba(71,85,105,.25);padding:8px}.live-radar-title{font-size:8px}.live-radar-subtitle,.live-radar-item-text,.live-radar-disclaimer{font-size:7px}.live-decision-board{grid-template-columns:1fr;padding:7px}.live-decision-lead{grid-column:auto}.live-decision-card{padding:9px}}`}</style>
    <div className="live-radar-cockpit" aria-label="ملخص الاستخبارات المباشرة"><div className="live-radar-lead"><div className="live-radar-title">الاستخبارات المباشرة</div><div className="live-radar-subtitle">حداثة البيانات أولًا · الحركة ثانيًا · الأدلة أخيرًا.</div></div>{items.map(item=><div className="live-radar-item" key={item.label}><div className="live-radar-item-label">{item.label}</div><div className="live-radar-item-value">{summary[item.key]}</div><div className="live-radar-item-text">{item.text}</div></div>)}</div>
    <div className="live-decision-board" aria-label="لوحة القرار المباشر"><div className="live-decision-lead"><div className="live-decision-title">لوحة القرار المباشر</div><div className="live-decision-subtitle">أعلى الحالات الحديثة فقط — دون تغيير في درجات Hunter أو شروط التأهل.</div></div>{topDecisions.length?topDecisions.map(entry=><div className="live-decision-card" key={entry.symbol}><div className="live-decision-symbol"><span>{entry.symbol}</span><span className="live-decision-state">{decisionLabel(entry)}</span></div><div className="live-decision-details"><span>حديثة</span><span>·</span><span>ضغط {Number.isFinite(Number(entry?.pulse?.pressureScore))?Number(entry.pulse.pressureScore).toFixed(0):'—'}</span><span>·</span><span>{entry?.pulse?.direction==='UP'?'صاعد':entry?.pulse?.direction==='DOWN'?'هابط':'محايد'}</span></div></div>):<div className="live-decision-empty">لا توجد حالة حديثة تستحق العرض حاليًا. ستظهر تلقائيًا عند وصول أدلة صالحة.</div>}</div>
    <div className="live-radar-meta"><span>{summary.total} سهم مفحوص</span><span>·</span><span>{summary.opportunities} فرص</span><span>·</span><span>{summary.watches} مراقبة</span><span>·</span><span>{summary.freshRatio.toFixed(0)}% بيانات حديثة</span></div>
    <div className="live-radar-disclaimer">الرادار المباشر لمتابعة حركة السوق، وليس وعدًا بالتنفيذ أو ضمانًا لبيانات لحظية من البورصة.</div>
    <LiveRadar onData={setLiveData}/>
  </div>
}
