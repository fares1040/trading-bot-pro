'use client';

import React from 'react';
import LiveRadar from '@/components/LiveRadar';

const items = [
  { label: 'FRESH', text: 'Current polled snapshot' },
  { label: 'ACCEL', text: 'Price + volume acceleration' },
  { label: 'FLOW', text: 'Evidence-bearing flow only' },
  { label: 'IGNITION', text: 'Derived multi-signal state' },
];

export default function LiveRadarShell() {
  return (
    <div className="live-radar-shell">
      <style jsx>{`
        .live-radar-shell { display: flex; flex-direction: column; gap: 12px; }
        .live-radar-cockpit { display: grid; grid-template-columns: minmax(220px, 1.25fr) repeat(4, minmax(120px, 1fr)); gap: 6px; padding: 8px; border: 1px solid rgba(52,211,153,.18); border-radius: 12px; background: linear-gradient(135deg, rgba(16,185,129,.055), rgba(5,8,13,.86)); }
        .live-radar-lead { padding: 7px 10px; }
        .live-radar-title { color: #34D399; font: 900 9px/1 monospace; letter-spacing: .9px; }
        .live-radar-subtitle { margin-top: 5px; color: #64748B; font: 600 8px/1.35 sans-serif; }
        .live-radar-item { padding: 7px 9px; border-left: 1px solid rgba(71,85,105,.25); }
        .live-radar-item-label { color: #94A3B8; font: 900 7px/1 monospace; letter-spacing: .7px; }
        .live-radar-item-text { margin-top: 4px; color: #64748B; font: 600 8px/1.25 sans-serif; }
        .live-radar-disclaimer { padding: 0 2px; color: #475569; font: 600 8px/1.4 sans-serif; }
        @media (max-width: 900px) {
          .live-radar-cockpit { grid-template-columns: 1fr 1fr; }
          .live-radar-lead { grid-column: 1 / -1; }
        }
        @media (max-width: 520px) {
          .live-radar-cockpit { grid-template-columns: 1fr; padding: 7px; }
          .live-radar-lead { grid-column: auto; padding: 7px 8px 9px; }
          .live-radar-item { border-left: 0; border-top: 1px solid rgba(71,85,105,.25); padding: 8px; }
          .live-radar-title { font-size: 8px; }
          .live-radar-subtitle, .live-radar-item-text, .live-radar-disclaimer { font-size: 7px; }
        }
      `}</style>

      <div className="live-radar-cockpit" aria-label="Live intelligence context">
        <div className="live-radar-lead">
          <div className="live-radar-title">LIVE INTELLIGENCE</div>
          <div className="live-radar-subtitle">Read freshness first, then movement and evidence.</div>
        </div>
        {items.map((item) => (
          <div className="live-radar-item" key={item.label}>
            <div className="live-radar-item-label">{item.label}</div>
            <div className="live-radar-item-text">{item.text}</div>
          </div>
        ))}
      </div>

      <div className="live-radar-disclaimer">
        LIVE RADAR is a movement monitor — not a promise of execution or guaranteed exchange-level real-time data.
      </div>

      <LiveRadar />
    </div>
  );
}
