import React from 'react';
import { colors, radius } from './DesignTokens';
import { StatusDot } from './Primitives';

/**
 * Trade Lifecycle + Alert Lifecycle
 *
 * Renders a horizontal stepper showing the current trade state and
 * the alert readiness for each lifecycle stage. This component is
 * presentation-only — it derives the active stage from C7/C8/C9 outputs
 * and never invents state. If upstream data is missing, the stage is
 * shown as UNAVAILABLE.
 *
 * Trade lifecycle stages (canonical):
 *   WATCH → PRE-ENTRY → CONFIRMATION → ENTRY → TARGET 1 → TARGET 2 → EXIT
 *   Alt path: ENTRY → INVALIDATION → STOP / EXIT
 *
 * Alert lifecycle statuses (Telegram-ready contract):
 *   READY → TRIGGERED → SENT (or FAILED) → DISABLED
 */

export const TRADE_LIFECYCLE = Object.freeze({
  WATCH: 'WATCH',
  PRE_ENTRY: 'PRE_ENTRY',
  CONFIRMATION: 'CONFIRMATION',
  ENTRY: 'ENTRY',
  TARGET_1: 'TARGET_1',
  TARGET_2: 'TARGET_2',
  EXIT: 'EXIT',
  INVALIDATION: 'INVALIDATION',
  STOP: 'STOP',
  NOT_READY: 'NOT_READY',
});

export const TRADE_LIFECYCLE_STAGES = Object.freeze([
  { key: 'WATCH', label: 'Watch' },
  { key: 'PRE_ENTRY', label: 'Pre-Entry' },
  { key: 'CONFIRMATION', label: 'Confirmation' },
  { key: 'ENTRY', label: 'Entry' },
  { key: 'TARGET_1', label: 'Target 1' },
  { key: 'TARGET_2', label: 'Target 2' },
  { key: 'EXIT', label: 'Exit' },
]);

export const ALERT_LIFECYCLE_STAGES = Object.freeze([
  { key: 'WATCH', label: 'Watch' },
  { key: 'PRE_ENTRY', label: 'Pre-Entry' },
  { key: 'CONFIRMATION', label: 'Confirmation' },
  { key: 'ENTRY', label: 'Entry' },
  { key: 'TARGET_1', label: 'Target 1' },
  { key: 'TARGET_2', label: 'Target 2' },
  { key: 'STOP', label: 'Stop' },
  { key: 'INVALIDATION', label: 'Invalidation' },
  { key: 'EXIT', label: 'Exit' },
  { key: 'CATALYST', label: 'Catalyst' },
]);

export const ALERT_STATUS = Object.freeze({
  READY: 'READY',
  TRIGGERED: 'TRIGGERED',
  SENT: 'SENT',
  FAILED: 'FAILED',
  DISABLED: 'DISABLED',
});

/**
 * Derive trade lifecycle stage from C8 trade-plan output.
 * Pure mapping — does not invent stages.
 */
export function deriveTradeStage(planSignal, riskReward, planScore, planQuality) {
  if (!planSignal || planSignal === 'UNAVAILABLE' || planScore == null) {
    return { stage: TRADE_LIFECYCLE.NOT_READY, decision: 'NOT_READY', reason: 'Trade plan unavailable' };
  }
  if (planSignal === 'AVOID') {
    return { stage: TRADE_LIFECYCLE.WATCH, decision: 'WATCH', reason: 'C8 plan signal AVOID' };
  }
  if (planSignal === 'WATCH') {
    return { stage: TRADE_LIFECYCLE.WATCH, decision: 'WATCH', reason: 'C8 plan signal WATCH' };
  }
  if (planSignal === 'STRONG_PLAN' || planSignal === 'VALID_PLAN') {
    if (planQuality === 'TOP' || planQuality === 'STRONG') {
      return { stage: TRADE_LIFECYCLE.CONFIRMATION, decision: 'BUY', reason: 'Valid plan with strong quality' };
    }
    return { stage: TRADE_LIFECYCLE.PRE_ENTRY, decision: 'WATCH', reason: 'Plan valid but watch for confirmation' };
  }
  return { stage: TRADE_LIFECYCLE.WATCH, decision: 'WATCH', reason: 'Awaiting stronger signal' };
}

function StageNode({ label, state, isAlt }) {
  const colorMap = {
    active: colors.semantic.long,
    pending: colors.text.disabled,
    invalid: colors.semantic.short,
    done: colors.accent.blue,
    skipped: colors.text.faint,
    notReady: colors.text.disabled,
  };
  const labelColorMap = {
    active: colors.text.primary,
    pending: colors.text.faint,
    invalid: colors.text.primary,
    done: colors.text.primary,
    skipped: colors.text.faint,
    notReady: colors.text.disabled,
  };

  let dotState = 'pending';
  if (state === 'active') dotState = 'active';
  else if (state === 'done') dotState = 'done';
  else if (state === 'invalid') dotState = 'invalid';
  else if (state === 'skipped') dotState = 'skipped';
  else if (state === 'notReady') dotState = 'notReady';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 60, flex: 1 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        backgroundColor: dotState === 'active' ? colorMap.active + '20' : colors.panel,
        border: `1.5px solid ${colorMap[dotState] || colorMap.pending}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colorMap[dotState] || colorMap.pending,
        fontSize: 11, fontWeight: 800,
      }}>
        {dotState === 'done' ? '✓' : dotState === 'invalid' ? '×' : isAlt ? '~' : '•'}
      </div>
      <div style={{ fontSize: 9, color: labelColorMap[dotState] || colors.text.faint, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700, textAlign: 'center' }}>
        {label}
      </div>
    </div>
  );
}

export function TradeLifecycleStepper({ stage, decision }) {
  const stageOrder = ['WATCH', 'PRE_ENTRY', 'CONFIRMATION', 'ENTRY', 'TARGET_1', 'TARGET_2', 'EXIT'];
  let activeIndex = stageOrder.indexOf(stage);
  if (stage === 'NOT_READY') activeIndex = -1;
  if (stage === 'INVALIDATION') activeIndex = stageOrder.indexOf('ENTRY');
  if (stage === 'STOP') activeIndex = stageOrder.indexOf('ENTRY');

  const showAlt = stage === 'INVALIDATION' || stage === 'STOP';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, padding: '8px 0' }}>
      {TRADE_LIFECYCLE_STAGES.map((s, i) => {
        let state = 'pending';
        if (activeIndex === -1) state = 'notReady';
        else if (i < activeIndex) state = 'done';
        else if (i === activeIndex) state = 'active';
        else if (stage === 'INVALIDATION' && s.key === 'ENTRY') state = 'invalid';
        else if (stage === 'STOP' && s.key === 'ENTRY') state = 'invalid';
        else if (showAlt && i > activeIndex) state = 'skipped';
        return (
          <React.Fragment key={s.key}>
            <StageNode label={s.label} state={state} isAlt={showAlt && i > activeIndex} />
            {i < TRADE_LIFECYCLE_STAGES.length - 1 && (
              <div style={{
                flex: '0 0 12px', height: 1, alignSelf: 'flex-start', marginTop: 11,
                backgroundColor: state === 'done' ? colors.accent.blue : colors.text.disabled,
                opacity: state === 'done' ? 1 : 0.3,
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Decision banner showing the current decision state derived from C8 / C9.
 * Pure derivation; uses upstream decision signals when available.
 */
export function DecisionBanner({ decision, reason, stage }) {
  const map = {
    BUY: { color: colors.semantic.long, icon: '●', label: 'BUY' },
    SELL: { color: colors.semantic.short, icon: '●', label: 'SELL' },
    WATCH: { color: colors.semantic.warning, icon: '◐', label: 'WATCH' },
    NOT_READY: { color: colors.text.disabled, icon: '○', label: 'NOT READY' },
  };
  const d = map[decision] || map.NOT_READY;

  return (
    <div style={{
      padding: '14px 18px',
      borderRadius: radius.md,
      backgroundColor: d.color + '12',
      border: `1px solid ${d.color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ color: d.color, fontSize: 22, fontWeight: 900 }}>{d.icon}</div>
        <div>
          <div style={{ color: d.color, fontSize: 18, fontWeight: 900, letterSpacing: 1 }}>{d.label}</div>
          {stage && stage !== 'NOT_READY' && (
            <div style={{ color: colors.text.muted, fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Stage: {stage.replace('_', ' ')}
            </div>
          )}
        </div>
      </div>
      {reason && (
        <div style={{ color: colors.text.muted, fontSize: 11, maxWidth: 320, textAlign: 'right' }}>
          {reason}
        </div>
      )}
    </div>
  );
}

/**
 * Alert lifecycle readiness indicator for a given opportunity.
 * Shows per-stage alert status. Pure presentation.
 */
export function AlertLifecycleGrid({ alertsByStage = {} }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
      {ALERT_LIFECYCLE_STAGES.map((s) => {
        const a = alertsByStage[s.key];
        const status = a?.status || 'DISABLED';
        const ready = status === 'READY' || status === 'TRIGGERED' || status === 'SENT';
        return (
          <div key={s.key} style={{
            padding: 10,
            backgroundColor: ready ? colors.panel : '#05060D',
            border: `1px solid ${ready ? colors.border : colors.border}`,
            borderRadius: radius.md,
            opacity: ready ? 1 : 0.6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ color: colors.text.faint, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</span>
              <StatusDot status={status === 'READY' || status === 'TRIGGERED' || status === 'SENT' || status === 'FAILED' ? status : 'disabled'} />
            </div>
            <div style={{ color: ready ? colors.text.primary : colors.text.disabled, fontSize: 10, fontWeight: 700 }}>
              {status}
            </div>
          </div>
        );
      })}
    </div>
  );
}