'use client';
import React, { useState, useEffect } from 'react';
import trackRecordService from '@/lib/track-record-service.js';
import { colors, panelStyle } from '@/components/ui/DesignTokens';

const pageStyle = {
  backgroundColor: colors.bg,
  color: colors.text.primary,
  fontFamily: 'sans-serif',
  direction: 'rtl',
  minHeight: '100vh',
  padding: '20px 30px',
};

const headerStyle = {
  ...panelStyle,
  padding: '16px 24px',
  marginBottom: '20px',
};

const filterGroupStyle = {
  display: 'flex',
  gap: '12px',
  marginBottom: '16px',
  flexWrap: 'wrap',
  alignItems: 'center',
};

const labelStyle = {
  fontSize: '11px',
  fontWeight: 700,
  color: colors.text.muted,
  marginBottom: '4px',
  display: 'block',
};

const selectStyle = {
  padding: '6px 10px',
  borderRadius: '6px',
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.panel,
  color: colors.text.primary,
  fontSize: '12px',
  outline: 'none',
};

const metricsRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '12px',
  marginBottom: '20px',
};

const metricCardStyle = {
  ...panelStyle,
  padding: '14px 16px',
  textAlign: 'center',
};

const tableContainerStyle = {
  ...panelStyle,
  padding: '16px',
  overflowX: 'auto',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '12px',
};

const thStyle = {
  color: colors.text.muted,
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  padding: '8px 10px',
  textAlign: 'right',
  borderBottom: `1px solid ${colors.border}`,
};

const tdStyle = {
  padding: '8px 10px',
  borderBottom: `1px solid ${colors.border}`,
  color: colors.text.secondary,
};

const emptyRowStyle = {
  ...tdStyle,
  textAlign: 'center',
  color: colors.text.muted,
};

const TrackRecordPage = () => {
  const [records, setRecords] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterOutcome, setFilterOutcome] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');

  useEffect(() => {
    loadTrackRecords();
  }, []);

  const loadTrackRecords = async () => {
    try {
      const data = trackRecordService.getAllRecords();
      setRecords(data || []);

      const uniqueOutcomes = [...new Set((data || []).map(r => r.outcome))];
      setOutcomes(uniqueOutcomes);

      const uniqueCategories = [...new Set(
        (data || []).map(r => r.type)
      )].filter(c => c !== 'UNKNOWN');
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Failed to load track records:', error);
      setRecords([]);
    }
  };

  const filteredRecords = records.filter(r => {
    if (filterOutcome !== 'ALL' && r.outcome !== filterOutcome) return false;
    if (filterCategory !== 'ALL' && r.type !== filterCategory) return false;
    return true;
  });

  const metricData = trackRecordService.calculateMetrics();

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={{
          color: colors.accent.gold,
          fontSize: '20px',
          fontWeight: 900,
          margin: 0,
          marginBottom: '8px',
        }}>
          📋 Track Record
        </h1>
        <p style={{
          color: colors.text.muted,
          fontSize: '11px',
          margin: 0,
        }}>
          سجل صفقاتك التاريخية مع إحصائيات الأداء.
        </p>
      </div>

      <div style={filterGroupStyle}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={labelStyle}>Outcome</label>
          <select
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
            style={selectStyle}
          >
            <option value="ALL">All Outcomes</option>
            {outcomes.map(outcome => (
              <option key={outcome} value={outcome}>
                {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={labelStyle}>Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={selectStyle}
          >
            <option value="ALL">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={metricsRowStyle}>
        <div style={metricCardStyle}>
          <div style={{ fontSize: '10px', color: colors.text.muted, marginBottom: '4px' }}>Total Trades</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: colors.text.primary }}>{metricData.totalTrades}</div>
        </div>
        <div style={metricCardStyle}>
          <div style={{ fontSize: '10px', color: colors.text.muted, marginBottom: '4px' }}>Wins</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: colors.semantic.success }}>{metricData.wins}</div>
        </div>
        <div style={metricCardStyle}>
          <div style={{ fontSize: '10px', color: colors.text.muted, marginBottom: '4px' }}>Losses</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: colors.semantic.danger }}>{metricData.losses}</div>
        </div>
        <div style={metricCardStyle}>
          <div style={{ fontSize: '10px', color: colors.text.muted, marginBottom: '4px' }}>Win Rate</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: colors.accent.blue }}>{metricData.winRate}%</div>
        </div>
        <div style={metricCardStyle}>
          <div style={{ fontSize: '10px', color: colors.text.muted, marginBottom: '4px' }}>Profit Factor</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: colors.accent.violet }}>{metricData.profitFactor}</div>
        </div>
        <div style={metricCardStyle}>
          <div style={{ fontSize: '10px', color: colors.text.muted, marginBottom: '4px' }}>Average Return</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: colors.accent.pink }}>{metricData.avgReturn}%</div>
        </div>
      </div>

      <div style={tableContainerStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'right' }}>Timestamp</th>
              <th style={thStyle}>Outcome</th>
              <th style={thStyle}>Direction</th>
              <th style={thStyle}>Target</th>
              <th style={thStyle}>Stop</th>
              <th style={thStyle}>Entry</th>
              <th style={thStyle}>Score</th>
              <th style={thStyle}>Type</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Symbol</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map(record => (
              <tr key={record.id}>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{new Date(record.timestamp).toLocaleString()}</td>
                <td style={tdStyle}>{record.outcome}</td>
                <td style={tdStyle}>{record.direction}</td>
                <td style={tdStyle}>{record.targetPrice}</td>
                <td style={tdStyle}>{record.stopPrice}</td>
                <td style={tdStyle}>{record.entryPrice}</td>
                <td style={tdStyle}>{record.score}</td>
                <td style={tdStyle}>{record.type}</td>
                <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700 }}>{record.symbol}</td>
              </tr>
            ))}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan="9" style={emptyRowStyle}>
                  لا توجد سجلات متاحة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TrackRecordPage;
