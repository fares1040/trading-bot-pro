'use client';

import React from 'react';
import Link from 'next/link';
import { colors, radius } from './DesignTokens';

const FOOTER_LINKS = [
  { href: '/portfolio-risk', label: 'Portfolio Risk' },
  { href: '/run-cron', label: 'Run Cron (Admin)' },
];

export default function AppFooter() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${colors.border}`,
        padding: '16px 20px',
        marginTop: 32,
      }}
    >
      <div
        style={{
          maxWidth: 1600,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 10, color: colors.text.faint }}>
          Hunter AI · Decision-first intelligence · No fabricated data
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: 10,
                color: colors.text.faint,
                textDecoration: 'none',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
