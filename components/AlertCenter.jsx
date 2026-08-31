'use client';

import React, { useState, useMemo, useEffect } from 'react';

const panel = {
  backgroundColor: '#0B0F17',
  border: '1px solid #1F2636',
  borderRadius: '16px',
};

const severityColors = {
  CRITICAL: '#EF4444',
  HIGH: '#F59E0B',
  MEDIUM: '#FBBF24',
  LOW: '#60A5FA',
  INFO: '#94A3B8',
};

const severityBg = {
  CRITICAL: '#7F1D1D',
  HIGH: '#783412',
  MEDIUM: '#78351F',
  LOW: '#1E3A5F',
  INFO: '#1E293B',
};

const priorityColors = (priority) => {
  if (priority >= 80) return '#EF4444';
  if (priority >= 60) return '#F59E0B';
  if (priority >= 40) return '#FBBF24';
  return '#60A5FA';
};

const SORT_OPTIONS = [
  { value: 'priority', label: 'الأولوية' },
  { value: 'severity', label: 'الشدة' },
  { value: 'score', label: 'النقاط' },
  { value: 'confidence', label: 'الثقة' },
  { value: 'freshness', label: 'الحداثة' },
  { value: 'timestamp', label: 'الوقت' },
  { value: 'symbol', label: 'الرمز' },
];

const FILTERS = {
  ALL: 'ALL',
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  INFO: 'INFO',
  NEW: 'NEW',
  ACTIVE: 'ACTIVE',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
  EXPIRED: 'EXPIRED',
  OPPORTUNITY: 'OPPORTUNITY',
  EARLY_EXPLOSION: 'EARLY_EXPLOSION',
  CATALYST: 'CATALYST',
  OPTIONS: 'OPTIONS',
  INSTITUTIONAL: 'INSTITUTIONAL',
  SWING: 'SWING',
  PENNY: 'PENNY',
  TRADE_PLAN: 'TRADE_PLAN',
  MARKET_REGIME: 'MARKET_REGIME',
  RISK: 'RISK',
  DATA_QUALITY: 'DATA_QUALITY',
  SIGNAL_CONFLICT: 'SIGNAL_CONFLICT',
};

function SeverityBadge({ severity }) {
  const color = severityColors[severity] || '#94A3B8';
  const bg = severityBg[severity] || '#1E293B';
  
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 700,
      color,
      backgroundColor: bg,
      border: `1px solid ${color}40`,
      padding: '2px 8px',
      borderRadius: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    }}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }) {
  const statusColors = {
    NEW: '#34D399',
    ACTIVE: '#22C55E',
    ACKNOWLEDGED: '#A78BFA',
    RESOLVED: '#9CA3AF',
    EXPIRED: '#6B7280',
  };
  const color = statusColors[status] || '#94A3B8';
  
  return (
    <span style={{
      fontSize: 8,
      fontWeight: 600,
      color: '#FFFFFF',
      backgroundColor: color + '1A',
      border: `1px solid ${color}40`,
      padding: '1px 6px',
      borderRadius: 4,
    }}>
      {status}
    </span>
  );
}

function TypeTag({ type }) {
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 600,
      color: '#CBD5E1',
      backgroundColor: '#1E293B',
      border: '1px solid #334155',
      padding: '2px 6px',
      borderRadius: 6,
    }}>
      {type?.replace('_', ' ')}
    </span>
  );
}

function AlertCard({ alert, onAcknowledge }) {
  const [showDetails, setShowDetails] = useState(false);
  
  if (!alert) return null;
  
  const priorityColor = priorityColors(alert.priority);
  
  return (
    <div
      style={{
        ...panel,
        padding: 14,
        marginBottom: 8,
        cursor: 'pointer',
        borderLeft: `3px solid ${severityColors[alert.severity]}`,
      }}
      onClick={() => setShowDetails(!showDetails)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ color: '#F8FAFC', fontFamily: 'monospace', fontSize: 13 }}>
              {alert.symbol}
            </strong>
            <SeverityBadge severity={alert.severity} />
            <StatusBadge status={alert.status} />
            {alert.type && <TypeTag type={alert.type} />}
          </div>
          
          <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 4 }}>
            {alert.title || alert.message}
          </div>
          
          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            {alert.score != null && (
              <span style={{ fontSize: 10, color: '#94A3B8' }}>
                📊 {Math.round(alert.score)}/100
              </span>
            )}
            {alert.confidence != null && (
              <span style={{ fontSize: 10, color: '#94A3B8' }}>
                🎯 ثقة: {Math.round(alert.confidence)}%
              </span>
            )}
            {alert.directionBias && alert.directionBias !== 'UNAVAILABLE' && (
              <span style={{ fontSize: 10, color: priorityColors(alert.priority) }}>
                ↔️ {alert.directionBias}
              </span>
            )}
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: priorityColor, fontFamily: 'monospace' }}>
            #{alert.priority}
          </div>
          <div style={{ fontSize: 9, color: '#94A3B8' }}>
            أولوية
          </div>
        </div>
      </div>
      
      {showDetails && (
        <div style={{ marginTop: 12, padding: 10, backgroundColor: '#07090E', borderRadius: 8, fontSize: 10, color: '#CBD5E1' }}>
          {alert.evidence && alert.evidence.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <strong style={{ color: '#38BDF8' }}>الدليل:</strong>
              <div style={{ marginTop: 2 }}>{alert.evidence.slice(0, 5).join(' • ')}</div>
            </div>
          )}
          
          {alert.risks && alert.risks.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <strong style={{ color: '#F87171' }}>المخاطر:</strong>
              <div style={{ marginTop: 2 }}>
                {alert.risks.slice(0, 3).map((r, i) => (
                  <div key={i} style={{ color: '#F59E0B' }}>
                    [{r.severity}] {r.label}: {r.description}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {alert.warnings && alert.warnings.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <strong style={{ color: '#FBBF24' }}>تحذيرات:</strong>
              <div style={{ marginTop: 2 }}>{alert.warnings.slice(0, 3).join(' • ')}</div>
            </div>
          )}
          
          {alert.provenance && (
            <div style={{ fontSize: 9, color: '#64748B' }}>
              المصدر: {alert.provenance.sources?.join(', ') || 'aggregation'}
            </div>
          )}
          
          {alert.disclaimer && (
            <div style={{ fontSize: 8, color: '#475569', marginTop: 4, fontStyle: 'italic' }}>
              {alert.disclaimer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ summary }) {
  if (!summary) return null;
  
  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#38BDF8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
        ملخص التنبيهات
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#F8FAFC' }}>{summary.total || 0}</div>
          <div style={{ fontSize: 9, color: '#94A3B8' }}>إجمالي</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#34D399' }}>
            {Object.values(summary.bySeverity || {}).reduce((a, b) => a + b, 0) - (summary.bySeverity?.CRITICAL || 0)}
          </div>
          <div style={{ fontSize: 9, color: '#94A3B8' }}>متوسط</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#F59E0B' }}>
            {Object.values(summary.bySeverity || {}).CRITICAL || 0}
          </div>
          <div style={{ fontSize: 9, color: '#94A3B8' }}>حرج</div>
        </div>
      </div>
    </div>
  );
}

export default function AlertCenter({ alertsData, loading }) {
  const [filters, setFilters] = useState({ filter: FILTERS.ALL, sortBy: 'priority', sortDir: 'desc' });
  const [showFilters, setShowFilters] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  
  useEffect(() => {
    if (alertsData?.success) {
      setAlerts(alertsData.alerts || []);
      setSummary(alertsData.summary);
      setError('');
    } else if (alertsData?.error) {
      setError(alertsData.error);
    }
  }, [alertsData]);
  
  const filteredAlerts = useMemo(() => {
    if (loading) return [];
    
    let result = alerts;
    
    if (filters.filter !== FILTERS.ALL) {
      result = result.filter(a => {
        if (filters.filter === 'CRITICAL' || filters.filter === 'HIGH' || filters.filter === 'MEDIUM') {
          return a.severity === filters.filter;
        }
        if (['NEW', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'EXPIRED'].includes(filters.filter)) {
          return a.status === filters.filter;
        }
        if (Object.values(FILTERS).includes(filters.filter)) {
          return a.type === filters.filter;
        }
        return true;
      });
    }
    
    return result;
  }, [alerts, filters, loading]);
  
  const handleFilterChange = (filter) => {
    setFilters(prev => ({ ...prev, filter }));
  };
  
  const handleSortChange = (sortBy) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortDir: prev.sortBy === sortBy && prev.sortDir === 'desc' ? 'asc' : 'desc',
    }));
  };
  
  if (loading) {
    return (
      <div style={{ ...panel, padding: 20, marginBottom: 20 }}>
        <div style={{ color: '#94A3B8', fontSize: 12 }}>⏳ جاري تحميل مركز التنبيهات...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ ...panel, padding: 20, marginBottom: 20, borderColor: '#7F1D1D' }}>
        <div style={{ color: '#FCA5A5', fontSize: 12 }}>⚠️ {error}</div>
      </div>
    );
  }
  
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ ...panel, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ color: '#F8FAFC', fontSize: '16px', fontWeight: 900, margin: 0 }}>
              مركز التنبيهات (D12)
            </h3>
            <p style={{ color: '#94A3B8', fontSize: 10, margin: 4 }}>
              دمج التنبيهات من B1-B6 + C7-C10
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={filters.filter}
              onChange={(e) => handleFilterChange(e.target.value)}
              style={{
                backgroundColor: '#07090E',
                borderColor: '#1F2636',
                color: '#F8FAFC',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {Object.values(FILTERS).map(f => (
                <option key={f} value={f} style={{ backgroundColor: '#0B0F17' }}>
                  {f.replace('_', ' ')}
                </option>
              ))}
            </select>
            
            <select
              value={`${filters.sortBy}:${filters.sortDir}`}
              onChange={(e) => handleSortChange(e.target.value.split(':')[0])}
              style={{
                backgroundColor: '#07090E',
                borderColor: '#1F2636',
                color: '#F8FAFC',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {SORT_OPTIONS.map(s => (
                <option key={s.value} value={s.value} style={{ backgroundColor: '#0B0F17' }}>
                  {s.label} ({filters.sortDir === 'desc' ? '↓' : '↑'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {summary && <SummaryCard summary={summary} />}
      
      <div style={{ display: 'grid', gap: 8 }}>
        {filteredAlerts.length === 0 && alerts.length > 0 ? (
          <div style={{ ...panel, padding: 20, textAlign: 'center' }}>
            <div style={{ color: '#94A3B8', fontSize: 12 }}>لا توجد تنبيهات تطابق الفلاتر الحالية.</div>
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ ...panel, padding: 20, textAlign: 'center' }}>
            <div style={{ color: '#94A3B8', fontSize: 12 }}>لا توجد تنبيهات في الوقت الحالي.</div>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} />
          ))
        )}
      </div>
      
      {alertsData?.limitations && alertsData.limitations.length > 0 && (
        <div style={{ ...panel, padding: 12, marginTop: 16, fontSize: 10, color: '#94A3B8' }}>
          قيود: {alertsData.limitations.join(' • ')}
        </div>
      )}
      
      {alertsData?.disclaimer && (
        <div style={{ ...panel, padding: 10, marginTop: 12, fontSize: 9, color: '#475569', textAlign: 'center' }}>
          {alertsData.disclaimer}
        </div>
      )}
    </div>
  );
}