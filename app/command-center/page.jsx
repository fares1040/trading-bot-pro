'use client';

import React from 'react';
import AppNav from '@/components/ui/AppNav';
import AppFooter from '@/components/ui/AppFooter';
import CommandCenterView from '@/components/CommandCenterView';
import LiveRadar from '@/components/LiveRadar';

export default function CommandCenterPage() {
  return (
    <>
      <AppNav />
      <CommandCenterView />
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '0 16px 24px' }}>
        <LiveRadar />
      </div>
      <AppFooter />
    </>
  );
}
