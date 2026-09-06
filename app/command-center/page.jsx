'use client';

import React from 'react';
import AppNav from '@/components/ui/AppNav';
import AppFooter from '@/components/ui/AppFooter';
import CommandCenterView from '@/components/CommandCenterView';

export default function CommandCenterPage() {
  return (
    <>
      <AppNav />
      <CommandCenterView />
      <AppFooter />
    </>
  );
}
