'use client';
import React, { useState, useEffect } from 'react';
import trackRecordService from '../lib/track-record-service.js';

const TrackRecordPage = () => {
  const [records, setRecords] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterOutcome, setFilterOutcome] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Load all records
  useEffect(() => {
    loadTrackRecords();
  }, []);

  const loadTrackRecords = async () => {
    try {
      const data = await trackRecordService.getAllRecords();
      setRecords(data.records);
      
      // Extract unique outcomes
      const uniqueOutcomes = [...new Set(records.map(r => r.outcome))];
      setOutcomes(uniqueOutcomes);
      
      // Extract categories
      const uniqueCategories = [...new Set(
        records.map(r => r.type)
      )].filter(c => c !== 'UNKNOWN');
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Failed to load track records:', error);
    }
  };

  const filteredRecords = records.filter(r => {
    if (filterOutcome !== 'ALL' && r.outcome !== filterOutcome) return false;
    if (filterCategory !== 'ALL' && r.type !== filterCategory) return false;
    return true;
  });

  const metricData = trackRecordService.calculateMetrics();

  return (
    <div className="container">
      <h1>Track Record</h1>
      
      {/* Filters */}
      <div className="track-header">
        <div className="filter-group">
          <label>Outcome:</label>
          <select 
            value={filterOutcome} 
            onChange={(e) => setFilterOutcome(e.target.value)}
          >
            <option value="ALL">All Outcomes</option>
            {outcomes.map(outcome => (
              <option key={outcome} value={outcome}>
                {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Category:</label>
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
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

      {/* Metrics */}
      <div className="metrics-row">
        <div className="metric-card">
          <span>Total Trades</span>
          <span>{metricData.totalTrades}</span>
        </div>
        <div className="metric-card">
          <span>Wins</span>
          <span>{metricData.wins}</span>
        </div>
        <div className="metric-card">
          <span>Losses</span>
          <span>{metricData.losses}</span>
        </div>
        <div className="metric-card">
          <span>Win Rate</span>
          <span>{metricData.winRate}%</span>
        </div>
        <div className="metric-card">
          <span>Profit Factor</span>
          <span>{metricData.profitFactor}</span>
        </div>
        <div className="metric-card">
          <span>Average Return</span>
          <span>{metricData.avgReturn}%</span>
        </div>
      </div>

      {/* Records Table */}
      <div className="records-table">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Type</th>
              <th>Score</th>
              <th>Entry</th>
              <th>Stop</th>
              <th>Target</th>
              <th>Direction</th>
              <th>Outcome</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record, index) => (
              <tr key={record.id}>
                <td>{record.symbol}</td>
                <td>{record.type}</td>
                <td>{record.score}</td>
                <td>{record.entryPrice}</td>
                <td>{record.stopPrice}</td>
                <td>{record.targetPrice}</td>
                <td>{record.direction}</td>
                <td>{record.outcome}</td>
                <td>{new Date(record.timestamp).toLocaleString()}</td>
              </tr>
            ))}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: "center" }}>No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TrackRecordPage;