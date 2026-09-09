'use client';

import React from 'react';
import AppNav from '@/components/ui/AppNav';
import AppFooter from '@/components/ui/AppFooter';
import HunterStartPanel from '@/components/HunterStartPanel';
import MarketScanner from '@/components/MarketScanner';
import CommandCenterView from '@/components/CommandCenterView';
import LiveRadarShell from '@/components/LiveRadarShell';

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

const navItems = [
  { id: 'market-scanner', label: 'DISCOVERY', hint: 'Find' },
  { id: 'command-center', label: 'HUNTER', hint: 'Decide' },
  { id: 'live-radar', label: 'LIVE RADAR', hint: 'Move' },
];

const workflow = [
  { n: '01', title: 'DISCOVER', text: 'Surface the market before judging it.', tone: '#38BDF8' },
  { n: '02', title: 'QUALIFY', text: 'Let Hunter decide what earns attention.', tone: '#A78BFA' },
  { n: '03', title: 'MOVE', text: 'Watch fresh movement with evidence gates.', tone: '#34D399' },
];

const decisionContext = [
  { label: 'QUALITY', text: 'Does it qualify?' },
  { label: 'WHY NOW', text: 'What changed?' },
  { label: 'PLAN', text: 'Where is the setup?' },
  { label: 'RISK', text: 'What invalidates it?' },
];

export default function HomePage() {
  return (
    <>
      <AppNav />
      <HunterStartPanel />

      <style jsx global>{`
        html { scroll-behavior: smooth; }
        .hunter-home { background: radial-gradient(circle at 50% 0%, rgba(56,189,248,.055), transparent 30%), #030507; min-height: 100vh; }
        .hunter-nav { position: sticky; top: 8px; z-index: 20; max-width: 1600px; margin: 0 auto 12px; padding: 0 16px; }
        .hunter-nav-inner { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; padding: 7px 9px; border: 1px solid rgba(71,85,105,.45); border-radius: 12px; background: rgba(5,8,13,.88); backdrop-filter: blur(14px); box-shadow: 0 10px 30px rgba(0,0,0,.22); }
        .hunter-brand { color: #E2E8F0; font: 900 9px/1 monospace; letter-spacing: 1.1px; }
        .hunter-brand span { color: #38BDF8; }
        .hunter-links { display: flex; justify-content: center; gap: 5px; flex-wrap: wrap; }
        .hunter-link { display: inline-flex; align-items: center; gap: 5px; padding: 6px 9px; border-radius: 8px; border: 1px solid rgba(71,85,105,.35); background: rgba(15,23,42,.42); color: #94A3B8; font: 800 8px/1 monospace; letter-spacing: .5px; text-decoration: none; transition: .18s ease; }
        .hunter-link:hover { color: #E2E8F0; border-color: rgba(56,189,248,.45); background: rgba(56,189,248,.08); transform: translateY(-1px); }
        .hunter-link small { color: #475569; font-size: 7px; }
        .hunter-status { justify-self: end; color: #64748B; font: 700 7px/1 monospace; letter-spacing: .6px; }
        .hunter-section { scroll-margin-top: 76px; }
        .hunter-section.discovery, .hunter-section.command { padding-bottom: 2px; }
        .hunter-section.live { padding-bottom: 8px; }
        .hunter-divider { max-width: 1568px; margin: 2px auto 12px; height: 1px; background: linear-gradient(90deg, transparent, rgba(71,85,105,.35), transparent); }
        .hunter-workflow { max-width: 1600px; margin: 0 auto 14px; padding: 0 16px; }
        .hunter-workflow-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .hunter-workflow-card { position: relative; min-height: 58px; padding: 10px 12px 10px 42px; border: 1px solid rgba(71,85,105,.35); border-radius: 10px; background: linear-gradient(135deg, rgba(15,23,42,.65), rgba(5,8,13,.9)); overflow: hidden; }
        .hunter-workflow-card::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 0 0, var(--workflow-tone), transparent 38%); opacity: .045; pointer-events: none; }
        .hunter-workflow-num { position: absolute; left: 12px; top: 11px; color: var(--workflow-tone); font: 900 9px/1 monospace; }
        .hunter-workflow-title { color: #E2E8F0; font: 900 9px/1 monospace; letter-spacing: .8px; }
        .hunter-workflow-text { color: #64748B; font: 600 8px/1.35 sans-serif; margin-top: 5px; }
        .hunter-command-context { max-width: 1600px; margin: 0 auto 8px; padding: 0 16px; }
        .hunter-command-context-inner { display: grid; grid-template-columns: 1.4fr repeat(4, 1fr); gap: 6px; align-items: stretch; }
        .hunter-command-lead, .hunter-command-item { border: 1px solid rgba(71,85,105,.32); border-radius: 9px; background: rgba(7,10,16,.78); }
        .hunter-command-lead { padding: 9px 12px; background: linear-gradient(135deg, rgba(56,189,248,.075), rgba(7,10,16,.86)); }
        .hunter-command-lead-title { color: #E2E8F0; font: 900 9px/1 monospace; letter-spacing: .7px; }
        .hunter-command-lead-text { margin-top: 5px; color: #64748B; font: 600 8px/1.35 sans-serif; }
        .hunter-command-item { padding: 8px 9px; display: flex; flex-direction: column; justify-content: center; }
        .hunter-command-item strong { color: #38BDF8; font: 900 7px/1 monospace; letter-spacing: .7px; }
        .hunter-command-item span { color: #94A3B8; font: 700 8px/1.25 sans-serif; margin-top: 4px; }
        @media (max-width: 900px) {
          .hunter-command-context-inner { grid-template-columns: 1fr 1fr; }
          .hunter-command-lead { grid-column: 1 / -1; }
        }
        @media (max-width: 720px) {
          .hunter-nav { top: 4px; padding: 0 10px; }
          .hunter-nav-inner { grid-template-columns: 1fr; gap: 7px; padding: 7px; }
          .hunter-brand, .hunter-status { justify-self: center; }
          .hunter-links { order: 2; }
          .hunter-link { padding: 7px 8px; font-size: 7px; }
          .hunter-workflow { padding: 0 10px; }
          .hunter-workflow-grid { grid-template-columns: 1fr; gap: 6px; }
          .hunter-workflow-card { min-height: 50px; }
          .hunter-command-context { padding: 0 10px; }
          .hunter-command-context-inner { grid-template-columns: 1fr 1fr; }
          .hunter-command-lead { grid-column: 1 / -1; }
        }
      `}</style>

      <main className="hunter-home">
        <nav className="hunter-nav" aria-label="Hunter sections">
          <div className="hunter-nav-inner">
            <div className="hunter-brand">HUNTER AI <span>COMMAND DECK</span></div>
            <div className="hunter-links">
              {navItems.map((item) => (
                <a className="hunter-link" key={item.id} href={`#${item.id}`}>
                  {item.label} <small>{item.hint}</small>
                </a>
              ))}
            </div>
            <div className="hunter-status">DISCOVER → QUALIFY → MOVE</div>
          </div>
        </nav>

        <div className="hunter-workflow" aria-label="Hunter workflow">
          <div className="hunter-workflow-grid">
            {workflow.map((step) => (
              <div className="hunter-workflow-card" key={step.n} style={{ '--workflow-tone': step.tone }}>
                <div className="hunter-workflow-num">{step.n}</div>
                <div className="hunter-workflow-title">{step.title}</div>
                <div className="hunter-workflow-text">{step.text}</div>
              </div>
            ))}
          </div>
        </div>

        <section id="market-scanner" className="hunter-section discovery">
          <div style={sectionLabel}>01 · DISCOVERY — FIND THE MARKET FIRST</div>
          <MarketScanner />
        </section>

        <div className="hunter-divider" />

        <section id="command-center" className="hunter-section command">
          <div style={{ ...sectionLabel, color: '#38BDF8' }}>02 · HUNTER COMMAND CENTER — QUALIFIED DECISIONS</div>
          <div className="hunter-command-context" aria-label="Decision context">
            <div className="hunter-command-context-inner">
              <div className="hunter-command-lead">
                <div className="hunter-command-lead-title">DECISION DESK</div>
                <div className="hunter-command-lead-text">Read the opportunity in order: quality → catalyst → plan → invalidation.</div>
              </div>
              {decisionContext.map((item) => (
                <div className="hunter-command-item" key={item.label}>
                  <strong>{item.label}</strong>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
          <CommandCenterView />
        </section>

        <div className="hunter-divider" />

        <section id="live-radar" className="hunter-section live" style={{ maxWidth: 1600, margin: '0 auto', padding: '0 16px 24px' }}>
          <div style={{ ...sectionLabel, padding: 0, marginBottom: 6, color: '#34D399' }}>03 · LIVE RADAR — FRESH MARKET MOVEMENT</div>
          <LiveRadarShell />
        </section>
      </main>

      <AppFooter />
    </>
  );
}
