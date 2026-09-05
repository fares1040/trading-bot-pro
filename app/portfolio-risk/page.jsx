'use client';

import { useEffect, useState } from 'react';

export default function PortfolioRisk() {
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prices, setPrices] = useState({});

  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('sniper_portfolio_db_v2');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setPortfolio(parsed);
            }
          }
        }
        setLoading(false);
      } catch (err) {
        setError('Failed to load portfolio');
        setLoading(false);
      }
    };
    loadPortfolio();
  }, []);

  useEffect(() => {
    if (portfolio.length === 0) {
      setLoading(false);
      return;
    }
    const fetchPrices = async () => {
      const priceMap = {};
      try {
        // Fetch prices sequentially to avoid too many concurrent requests
        for (const item of portfolio) {
          if (!item.ticker) continue;
          try {
            const res = await fetch(`/api/market-data?symbol=${encodeURIComponent(item.ticker)}`, {
              cache: 'no-store',
            });
            if (!res.ok) {
              console.warn(`Failed to fetch price for ${item.ticker}`);
              continue;
            }
            const data = await res.json();
            if (data?.data?.[0]?.price != null) {
              priceMap[item.ticker] = Number(data.data[0].price);
            }
          } catch (e) {
            console.warn(`Error fetching price for ${item.ticker}:`, e);
          }
        }
        setPrices(priceMap);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch prices');
        setLoading(false);
      }
    };
    fetchPrices();
  }, [portfolio]);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>Loading portfolio...</div>;
  }
  if (error) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#f87171' }}>Error: {error}</div>;
  }

  if (portfolio.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
        No portfolio data. Add positions via the Paper Trading Desk.
      </div>
    );
  }

  // Compute aggregates
  let totalInvested = 0;
  let totalCurrent = 0;
  let totalUnrealizedPL = 0;
  const rows = portfolio.map((item) => {
    const qty = Number(item.qty) || 0;
    const entry = Number(item.entry) || 0;
    const current = prices[item.ticker] ?? null;
    const invested = qty * entry;
    const currentValue = current != null ? qty * current : null;
    const unrealized = current != null ? qty * (current - entry) : null;
    totalInvested += invested;
    if (currentValue != null) totalCurrent += currentValue;
    if (unrealized != null) totalUnrealizedPL += unrealized;
    return (
      <tr key={item.id} style={{ borderBottom: '1px solid #374151' }}>
        <td style={{ padding: '8px', color: '#fff' }}>{item.ticker}</td>
        <td style={{ padding: '8px', color: '#9ca3af' }}>{qty}</td>
        <td style={{ padding: '8px', color: '#9ca3af' }}>{entry.toFixed(2)}</td>
        <td style={{ padding: '8px', color: current != null ? '#fff' : '#9ca3af' }}>
          {current != null ? current.toFixed(2) : '—'}
        </td>
        <td style={{ padding: '8px', color: unrealized != null ? (unrealized >= 0 ? '#34d399' : '#f87171') : '#9ca3af' }}>
          {unrealized != null ? (unrealized >= 0 ? `+${unrealized.toFixed(2)}` : unrealized.toFixed(2)) : '—'}
        </td>
      </tr>
    );
  });

  return (
    <div style={{ background: '#0d111a', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Portfolio Risk View</h1>
      <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px', color: '#9ca3af', fontSize: '12px' }}>Ticker</th>
              <th style={{ textAlign: 'left', padding: '8px', color: '#9ca3af', fontSize: '12px' }}>Qty</th>
              <th style={{ textAlign: 'left', padding: '8px', color: '#9ca3af', fontSize: '12px' }}>Entry Price</th>
              <th style={{ textAlign: 'left', padding: '8px', color: '#9ca3af', fontSize: '12px' }}>Current Price</th>
              <th style={{ textAlign: 'left', padding: '8px', color: '#9ca3af', fontSize: '12px' }}>Unrealized P&L</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #374151' }}>
              <td style={{ padding: '8px', fontWeight: 'bold', color: '#fff' }}>TOTAL</td>
              <td style={{ padding: '8px', color: '#9ca3af' }}>{portfolio.reduce((sum, p) => sum + (Number(p.qty) || 0), 0)}</td>
              <td style={{ padding: '8px', color: '#9ca3af' }}>{totalInvested.toFixed(2)}</td>
              <td style={{ padding: '8px', color: totalCurrent !== null ? '#fff' : '#9ca3af' }}>
                {totalCurrent !== null ? totalCurrent.toFixed(2) : '—'}
              </td>
              <td style={{ padding: '8px', color: totalUnrealizedPL !== null ? (totalUnrealizedPL >= 0 ? '#34d399' : '#f87171') : '#9ca3af' }}>
                {totalUnrealizedPL !== null ? (totalUnrealizedPL >= 0 ? `+${totalUnrealizedPL.toFixed(2)}` : totalUnrealizedPL.toFixed(2)) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ background: '#111827', padding: '16px', borderRadius: '8px', border: '1px solid #374151' }}>
        <h2 style={{ marginTop: '0', marginBottom: '12px', fontSize: '20px' }}>Aggregated Metrics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>Total Invested</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>${totalInvested.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>Total Current Value</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: totalCurrent !== null ? '#fff' : '#9ca3af' }}>
              {totalCurrent !== null ? totalCurrent.toFixed(2) : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>Unrealized P&L</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: totalUnrealizedPL !== null ? (totalUnrealizedPL >= 0 ? '#34d399' : '#f87171') : '#9ca3af' }}>
              {totalUnrealizedPL !== null ? (totalUnrealizedPL >= 0 ? `+${totalUnrealizedPL.toFixed(2)}` : totalUnrealizedPL.toFixed(2)) : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>Positions</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>{portfolio.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}