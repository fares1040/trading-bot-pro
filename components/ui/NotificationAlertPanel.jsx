'use client';

import React from 'react';
import { colors, radius, formatPrice } from './DesignTokens';
import { Tag, StatusDot, Button, SmallTag, LevelRow, EmptyState, LoadingState } from './Primitives';
import { NOTIFICATION_STATUSES } from '@/lib/notification-contract';

const panelStyle = {
  backgroundColor: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
};

const statusColorMap = {
  READY: colors.status.ready,
  TRIGGERED: colors.status.triggered,
  SENT: colors.status.sent,
  FAILED: colors.status.failed,
  DISABLED: colors.status.disabled,
};

const stageLabelMap = {
  PRE_ENTRY: 'Pre-Entry',
  CONFIRMATION: 'Confirmation',
  ENTRY: 'Entry',
  TARGET_1: 'Target 1',
  TARGET_2: 'Target 2',
  STOP: 'Stop',
  INVALIDATION: 'Invalidation',
  EXIT: 'Exit',
};

const stageColorMap = {
  PRE_ENTRY: '#38BDF8',
  CONFIRMATION: '#A78BFA',
  ENTRY: '#34D399',
  TARGET_1: '#22C55E',
  TARGET_2: '#16A34A',
  STOP: '#EF4444',
  INVALIDATION: '#F87171',
  EXIT: '#60A5FA',
};

function NotificationAlertCard({ alert, onStatusChange }) {
  const statusColor = statusColorMap[alert.status] || colors.text.disabled;
  const stageColor = stageColorMap[alert.lifecycleStage] || colors.text.disabled;
  const directionColorMap = {
    LONG: colors.semantic.long,
    SHORT: colors.semantic.short,
    NEUTRAL: colors.semantic.warning,
    UNAVAILABLE: colors.text.disabled,
  };
  const directionColor = directionColorMap[alert.direction] || colors.text.disabled;

  return (
    <div style={{
      ...panelStyle,
      padding: 12,
      marginBottom: 8,
      backgroundColor: alert.status === NOTIFICATION_STATUSES.DISABLED ? '#05060D' : colors.panel,
      opacity: alert.status === NOTIFICATION_STATUSES.DISABLED ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
        <div>
          <strong style={{ color: colors.text.primary, fontFamily: 'monospace', fontSize: 13 }}>{alert.ticker}</strong>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
            <Tag value={stageLabelMap[alert.lifecycleStage] || alert.lifecycleStage} colorMap={stageColorMap} size="sm" />
            {alert.direction !== 'UNAVAILABLE' && (
              <Tag value={alert.direction} colorMap={directionColorMap} size="sm" />
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusDot status={alert.status.toLowerCase()} />
          <Tag value={alert.status} colorMap={statusColorMap} size="sm" />
        </div>
      </div>

      {alert.reason && (
        <div style={{ fontSize: 10, color: colors.text.secondary, lineHeight: 1.4, marginBottom: 8 }}>
          {alert.reason}
        </div>
      )}

      <div className="alert-levels-grid">
        <LevelRow label="Entry" value={alert.entry ? formatPrice(alert.entry) : null} />
        <LevelRow label="Stop" value={alert.stop ? formatPrice(alert.stop) : null} />
        <LevelRow label="T1" value={alert.targets?.t1 ? formatPrice(alert.targets.t1) : null} />
        <LevelRow label="T2" value={alert.targets?.t2 ? formatPrice(alert.targets.t2) : null} />
        {alert.riskReward != null && (
          <LevelRow
            label="R/R"
            value={alert.riskReward}
            fallback="—"
            mono={true}
          />
        )}
        {alert.confidence != null && (
          <LevelRow
            label="Confidence"
            value={`${alert.confidence}%`}
            fallback="—"
            mono={true}
          />
        )}
      </div>
      <style>{`
        .alert-levels-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 8px;
        }
        @media (max-width: 480px) {
          .alert-levels-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {alert.evidence && alert.evidence.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: colors.text.faint, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Evidence
          </div>
          <div style={{ fontSize: 9, color: colors.text.secondary, lineHeight: 1.4 }}>
            {alert.evidence.slice(0, 3).map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        </div>
      )}

      {alert.risks && alert.risks.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: colors.text.faint, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Risks
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {alert.risks.slice(0, 3).map((r, i) => (
              <SmallTag 
                key={i} 
                value={r.label} 
                color={r.severity === 'HIGH' ? colors.semantic.danger : r.severity === 'MEDIUM' ? colors.semantic.warning : colors.text.disabled} 
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
        {alert.status === NOTIFICATION_STATUSES.READY && onStatusChange && (
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => onStatusChange(alert, NOTIFICATION_STATUSES.TRIGGERED)}
          >
            Trigger
          </Button>
        )}
        {alert.status === NOTIFICATION_STATUSES.TRIGGERED && onStatusChange && (
          <>
            <Button 
              variant="accent" 
              size="sm" 
              onClick={() => onStatusChange(alert, NOTIFICATION_STATUSES.SENT)}
            >
              Send
            </Button>
            <Button 
              variant="danger" 
              size="sm" 
              onClick={() => onStatusChange(alert, NOTIFICATION_STATUSES.FAILED)}
            >
              Fail
            </Button>
          </>
        )}
        {alert.status === NOTIFICATION_STATUSES.SENT && onStatusChange && (
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => onStatusChange(alert, NOTIFICATION_STATUSES.DISABLED)}
          >
            Disable
          </Button>
        )}
        {alert.status === NOTIFICATION_STATUSES.FAILED && onStatusChange && (
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => onStatusChange(alert, NOTIFICATION_STATUSES.DISABLED)}
          >
            Disable
          </Button>
        )}
      </div>
    </div>
  );
}

export function NotificationAlertPanel({ alerts = [], loading, onStatusChange, onDisableAll, emptyMessage = 'No notification alerts ready' }) {
  if (loading) return <LoadingState message="Loading alerts…" />;
  if (!alerts || !alerts.length) {
    return <EmptyState icon="🔔" message={emptyMessage} sub="Alerts ready for Telegram notifications will appear here" />;
  }

  return (
    <div>
      {alerts.map((alert) => (
        <NotificationAlertCard
          key={alert.id}
          alert={alert}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}

export function NotificationStatusFilter({ activeFilter, onFilterChange }) {
  const filters = [
    { value: 'all', label: 'All Alerts' },
    { value: NOTIFICATION_STATUSES.READY, label: 'Ready' },
    { value: NOTIFICATION_STATUSES.TRIGGERED, label: 'Triggered' },
    { value: NOTIFICATION_STATUSES.SENT, label: 'Sent' },
    { value: NOTIFICATION_STATUSES.FAILED, label: 'Failed' },
    { value: NOTIFICATION_STATUSES.DISABLED, label: 'Disabled' },
  ];

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
      {filters.map((f) => {
        const isActive = activeFilter === f.value;
        return (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: radius.md,
              border: isActive ? `1px solid ${colors.accent.blue}` : `1px solid ${colors.border}`,
              backgroundColor: isActive ? '#0B0F17' : colors.panel,
              color: isActive ? colors.accent.blue : colors.text.faint,
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

export function NotificationLifecycleIndicator({ alertsByStage = {} }) {
  const stages = [
    'PRE_ENTRY', 'CONFIRMATION', 'ENTRY', 
    'TARGET_1', 'TARGET_2', 'STOP', 
    'INVALIDATION', 'EXIT'
  ];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      {stages.map((stage) => {
        const alert = alertsByStage[stage];
        const status = alert?.status || 'DISABLED';
        const color = statusColorMap[status] || colors.text.disabled;
        return (
          <div key={stage} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            backgroundColor: '#05060D',
            borderRadius: radius.sm,
            border: `1px solid ${color}40`,
          }}>
            <StatusDot status={status.toLowerCase()} size={6} />
            <span style={{ fontSize: 8, color: colors.text.faint, fontWeight: 700 }}>
              {stageLabelMap[stage] || stage}
            </span>
            <span style={{ fontSize: 9, color, fontWeight: 700 }}>
              {status}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default NotificationAlertPanel;