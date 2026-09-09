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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 1.25fr) repeat(4, minmax(120px, 1fr))',
        gap: 6,
        padding: 8,
        border: '1px solid rgba(52,211,153,.18)',
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(16,185,129,.055), rgba(5,8,13,.86))',
      }}>
        <div style={{ padding: '7px 10px' }}>
          <div style={{ color: '#34D399', font: '900 9px/1 monospace', letterSpacing: '.9px' }}>LIVE INTELLIGENCE</div>
          <div style={{ marginTop: 5, color: '#64748B', font: '600 8px/1.35 sans-serif' }}>Read freshness first, then movement and evidence.</div>
        </div>
        {items.map((item) => (
          <div key={item.label} style={{ padding: '7px 9px', borderLeft: '1px solid rgba(71,85,105,.25)' }}>
            <div style={{ color: '#94A3B8', font: '900 7px/1 monospace', letterSpacing: '.7px' }}>{item.label}</div>
            <div style={{ marginTop: 4, color: '#64748B', font: '600 8px/1.25 sans-serif' }}>{item.text}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 2px', color: '#475569', font: '600 8px/1.4 sans-serif' }}>
        LIVE RADAR is a movement monitor — not a promise of execution or guaranteed exchange-level real-time data.
      </div>

      <LiveRadar />
    </div>
  );
}
