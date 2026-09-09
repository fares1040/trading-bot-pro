'use client';

import React, { useMemo, useState } from 'react';
import LiveRadar from '@/components/LiveRadar';
import { buildLiveIntelligenceSummary } from '@/lib/live-intelligence-summary';

const items = [
  { label: 'FRESH', key: 'fresh', text: 'Current polled snapshot' },
  { label: 'ACCEL', key: 'preparing', text: 'Movement building' },
  { label: 'FLOW', key: 'flowObserved', text: 'Evidence-bearing flow' },
  { label: 'IGNITION', key: 'ignition', text: 'Multi-signal state' },
];

export default function LiveRadarShell() {
  const [liveData, setLiveData] = useState([]);
  const summary = useMemo(() => buildLiveIntelligenceSummary(liveData), [liveData]);

  return (
    <div className="live-radar-shell">
      <style jsx>{`
        .live-radar-shell { display:flex; flex-direction:column; gap:12px; }
        .live-radar-cockpit { display:grid; grid-template-columns:minmax(220px,1.25fr) repeat(4,minmax(120px,1fr)); gap:6px; padding:8px; border:1px solid rgba(52,211,153,.18); border-radius:12px; background:linear-gradient(135deg,rgba(16,185,129,.055),rgba(5,8,13,.86)); }
        .live-radar-lead { padding:7px 10px; }
        .live-radar-title { color:#34D399; font:900 9px/1 monospace; letter-spacing:.9px; }
        .live-radar-subtitle { margin-top:5px; color:#64748B; font:600 8px/1.35 sans-serif; }
        .live-radar-item { padding:7px 9px; border-left:1px solid rgba(71,85,105,.25); }
        .live-radar-item-label { color:#94A3B8; font:900 7px/1 monospace; letter-spacing:.7px; }
        .live-radar-item-value { margin-top:4px; color:#E2E8F0; font:900 12px/1 monospace; }
        .live-radar-item-text { margin-top:3px; color:#64748B; font:600 7px/1.25 sans-serif; }
        .live-radar-meta { display:flex; gap:8px; flex-wrap:wrap; padding:0 2px; color:#64748B; font:700 8px/1.4 monospace; }
        .live-radar-disclaimer { padding:0 2px; color:#475569; font:600 8px/1.4 sans-serif; }
        @media(max-width:900px){.live-radar-cockpit{grid-template-columns:1fr 1fr}.live-radar-lead{grid-column:1/-1}}
        @media(max-width:520px){.live-radar-cockpit{grid-template-columns:1fr;padding:7px}.live-radar-lead{grid-column:auto;padding:7px 8px 9px}.live-radar-item{border-left:0;border-top:1px solid rgba(71,85,105,.25);padding:8px}.live-radar-title{font-size:8px}.live-radar-subtitle,.live-radar-item-text,.live-radar-disclaimer{font-size:7px}}
      `}</style>
      <div className="live-radar-cockpit" aria-label="Live intelligence context">
        <div className="live-radar-lead">
          <div className="live-radar-title">LIVE INTELLIGENCE</div>
          <div className="live-radar-subtitle">Freshness first · movement second · evidence last.</div>
        </div>
        {items.map((item) => (
          <div className="live-radar-item" key={item.label}>
            <div className="live-radar-item-label">{item.label}</div>
            <div className="live-radar-item-value">{summary[item.key]}</div>
            <div className="live-radar-item-text">{item.text}</div>
          </div>
        ))}
      </div>
      <div className="live-radar-meta">
        <span>{summary.total} scanned</span><span>·</span><span>{summary.opportunities} opportunities</span><span>·</span><span>{summary.watches} watch</span><span>·</span><span>{summary.freshRatio.toFixed(0)}% fresh</span>
      </div>
      <div className="live-radar-disclaimer">LIVE RADAR is a movement monitor — not a promise of execution or guaranteed exchange-level real-time data.</div>
      <LiveRadar onData={setLiveData} />
    </div>
  );
}
