'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { colors, radius } from './DesignTokens';

const NAV_ITEMS = [
  { href: '/', label: 'القيادة', labelEn: 'Command Center', mobile: true },
  { href: '/analytics', label: 'الفرص', labelEn: 'Opportunities', mobile: true },
  { href: '/analytics', label: 'الرادار', labelEn: 'Radar', mobile: false },
  { href: '/analytics', label: 'السوينغ', labelEn: 'Swing', mobile: false },
  { href: '/analytics', label: 'الخيارات', labelEn: 'Options', mobile: false },
  { href: '/analytics', label: 'الذكاء', labelEn: 'Intelligence', mobile: false },
  { href: '/alert-center', label: 'التنبيهات', labelEn: 'Alerts', mobile: true },
  { href: '/track-record', label: 'السجل', labelEn: 'Track Record', mobile: false },
];

export default function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href) => {
    if (href === '/') return pathname === '/' || pathname === '/command-center';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <>
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: colors.bg + 'F0',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1600,
            margin: '0 auto',
            padding: '0 20px',
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link
              href="/"
              style={{
                color: colors.accent.gold,
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: 1,
                textDecoration: 'none',
                fontFamily: 'monospace',
              }}
            >
              HUNTER AI
            </Link>
            <span
              style={{
                fontSize: 9,
                color: colors.text.faint,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                display: 'none',
              }}
              className="nav-subtitle-desktop"
            >
              Intelligence Command Center
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 4,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
            className="nav-links-desktop"
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  style={{
                    padding: '6px 10px',
                    borderRadius: radius.sm,
                    fontSize: 11,
                    fontWeight: 600,
                    color: active ? colors.accent.gold : colors.text.secondary,
                    backgroundColor: active ? colors.accent.gold + '18' : 'transparent',
                    border: `1px solid ${active ? colors.accent.gold + '40' : 'transparent'}`,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              display: 'none',
              background: 'none',
              border: `1px solid ${colors.border}`,
              borderRadius: radius.sm,
              color: colors.text.secondary,
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
            className="nav-mobile-toggle"
          >
            ☰
          </button>
        </div>

        {mobileOpen && (
          <div
            style={{
              borderTop: `1px solid ${colors.border}`,
              padding: '8px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
            className="nav-mobile-menu"
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: radius.sm,
                    fontSize: 13,
                    fontWeight: 600,
                    color: active ? colors.accent.gold : colors.text.secondary,
                    backgroundColor: active ? colors.accent.gold + '18' : 'transparent',
                    textDecoration: 'none',
                  }}
                >
                  {item.label} <span style={{ fontSize: 10, color: colors.text.faint }}>{item.labelEn}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <style jsx global>{`
        @media (max-width: 768px) {
          .nav-links-desktop {
            display: none !important;
          }
          .nav-subtitle-desktop {
            display: none !important;
          }
          .nav-mobile-toggle {
            display: block !important;
          }
          .nav-mobile-menu {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .nav-mobile-toggle {
            display: none !important;
          }
          .nav-mobile-menu {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
