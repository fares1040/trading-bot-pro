'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { colors, radius } from './DesignTokens';

const NAV_ITEMS = [
  { href: '/', label: 'القيادة' },
  { href: '/alert-center', label: 'التنبيهات' },
  { href: '/track-record', label: 'السجل' },
];

export default function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isActive = (href) => href === '/' ? pathname === '/' || pathname === '/command-center' : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav dir="rtl" style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: colors.bg + 'F0', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${colors.border}` }}>
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '0 20px', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Link href="/" style={{ color: colors.accent.gold, fontSize: 14, fontWeight: 900, letterSpacing: 1, textDecoration: 'none', fontFamily: 'monospace' }}>HUNTER AI</Link>
        <div className="nav-links-desktop" style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          {NAV_ITEMS.map((item) => <Link key={item.href} href={item.href} style={{ padding: '10px 12px', borderRadius: radius.sm, fontSize: 11, fontWeight: 700, color: isActive(item.href) ? colors.accent.gold : colors.text.secondary, backgroundColor: isActive(item.href) ? colors.accent.gold + '18' : 'transparent', border: `1px solid ${isActive(item.href) ? colors.accent.gold + '40' : 'transparent'}`, textDecoration: 'none', whiteSpace: 'nowrap', minHeight: 44, boxSizing: 'border-box' }}>{item.label}</Link>)}
        </div>
        <button aria-label="فتح القائمة" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)} className="nav-mobile-toggle" style={{ display: 'none', background: 'none', border: `1px solid ${colors.border}`, borderRadius: radius.sm, color: colors.text.secondary, padding: '10px 12px', cursor: 'pointer', fontSize: 18, lineHeight: 1, minWidth: 44, minHeight: 44 }}>☰</button>
      </div>
      {mobileOpen && <div className="nav-mobile-menu" style={{ borderTop: `1px solid ${colors.border}`, padding: '8px 20px', flexDirection: 'column', gap: 4 }}>
        {NAV_ITEMS.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} style={{ padding: '12px 14px', borderRadius: radius.sm, fontSize: 13, fontWeight: 700, color: isActive(item.href) ? colors.accent.gold : colors.text.secondary, backgroundColor: isActive(item.href) ? colors.accent.gold + '18' : 'transparent', textDecoration: 'none', minHeight: 44, boxSizing: 'border-box' }}>{item.label}</Link>)}
      </div>}
      <style jsx global>{`@media(max-width:768px){.nav-links-desktop{display:none!important}.nav-mobile-toggle{display:block!important}.nav-mobile-menu{display:flex!important}}@media(min-width:769px){.nav-mobile-toggle{display:none!important}.nav-mobile-menu{display:none!important}}`}</style>
    </nav>
  );
}
