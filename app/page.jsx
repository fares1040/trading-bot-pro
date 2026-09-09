'use client';

import React from 'react';
import AppNav from '@/components/ui/AppNav';
import AppFooter from '@/components/ui/AppFooter';
import HunterStartPanel from '@/components/HunterStartPanel';
import MarketScanner from '@/components/MarketScanner';
import CommandCenterView from '@/components/CommandCenterView';
import LiveRadar from '@/components/LiveRadar';

const sectionLabel = {
  maxWidth: 1600,
  margin: '0 auto 6px',
  padding: '0 16px',
  color: '#64748B',
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
};

export default function HomePage() {
  return (
    <>
      <AppNav />
      <HunterStartPanel />

      <div id="market-scanner">
        <div style={sectionLabel}>01 · DISCOVERY — FIND THE MARKET FIRST</div>
        <MarketScanner />
      </div>

      <div id="command-center">
        <div style={{ ...sectionLabel, color: '#38BDF8' }}>02 · HUNTER COMMAND CENTER — QUALIFIED DECISIONS</div>
        <CommandCenterView />
      </div>

      <div id="live-radar" style={{ maxWidth: 1600, margin: '0 auto', padding: '0 16px 24px' }}>
        <div style={{ ...sectionLabel, padding: 0, marginBottom: 6, color: '#34D399' }}>03 · LIVE RADAR — FRESH MARKET MOVEMENT</div>
        <LiveRadar />
      </div>

      <AppFooter />
    </>
  );
}
