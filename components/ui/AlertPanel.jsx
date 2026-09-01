'use client';

import React from 'react';
import { colors, radius } from './DesignTokens';
import { AlertBadge } from './Primitives';

/**
 * Alert Center Panel
 *
 * Mini alert feed showing recent high-priority alerts ready for Telegram.
 * Each alert card shows symbol, type, status, priority, and a one-line message.
 * Clicking an alert opens the full alert detail.
 *
 * Data source: Alert Center aggregation (lib/alert-center.js)
 * Alert statuses: READY → TRIGGERED → SENT/FAILED → DISABLED
 * Priority: 1–100 numeric (higher = more urgent)
 */

const panelStyle = {
  backgroundColor: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
};

function AlertMiniCard({ alert }) {
  const priorityColorMap = {
    80: '#EF4444', 60: '#F59E0B', 40: '#FBBF24', 20: '#60A5FA', 0: '#94A3B8',
  };
  let priorityColor = colors.text.secondary;
  Object.keys(priorityColorMap).forEach(threshold => {
    if (alert.priority >= Number(threshold)) priorityColor = priorityColorMap[threshold];
  });

  const statusColors = {
    READY: colors.status.ready,
    TRIGGERED: colors.status.triggered,
    SENT: colors.status.sent,
    FAILED: colors.status.failed,
    DISABLED: colors.status.disabled,
    NEW: colors.status.new,
    ACKNOWLEDGED: colors.status.acknowledged,
    RESOLVED: colors.status.resolved,
    EXPIRED: colors.status.expired,
  };
  const status = statusColors[alert.status] || colors.text.disabled;

  return (
    <div style={{ padding: 10, marginBottom: 6, borderLeft: `2px solid ${priorityColor}`, backgroundColor: '#05060D', borderRadius: radius.md }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <strong style={{ color: colors.text.primary, fontFamily: 'monospace', fontSize: 12 }}>
              {alert.symbol}
            </strong>
            <AlertBadge status={alert.status} />
          </div>
          <div style={{ fontSize: 9, color: colors.text.secondary, lineHeight: 1.4, marginBottom: 2 }}>
            {alert.type.replace('_', ' ')}
          </div>
          <div style={{ fontSize: 9, color: alert.message ? colors.text.primary : colors.text.secondary, lineHeight: 1.4 }}>
            {alert.message}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 40 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: priorityColor, fontFamily: 'monospace' }}>
            #{alert.priority}
          </div>
          <div style={{ fontSize: 9, color: colors.text.faint, marginTop: 2 }}>
            Priority
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertCenterPanel({ alerts = [], loading, onSelectAlert }) {
  const recentAlerts = alerts.slice(0, 5);

  if (loading) return <LoadingState message="Loading alerts…" />;
  if (!recentAlerts.length) return <EmptyState icon="🔔" message="No alerts ready" sub="Market scanning or below priority threshold" />;

  return (
    <div>
      {recentAlerts.map((alert) => (
        <AlertMiniCard
          key={alert.id}
          alert={alert}
          onClick={() => onSelectAlert && onSelectAlert(alert.id)}
        />
      ))}
    </div>
  );
}

import { EmptyState, LoadingState } from './Primitives';