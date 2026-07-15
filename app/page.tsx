'use client';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [stocks, setStocks] = useState([]);

  useEffect(() => {
    fetch('/api/stocks')
      .then(res => res.json())
      .then(data => setStocks(data.data));
  }, []);

  return (
    <div style={{ padding: '40px', backgroundColor: '#0a0a0a', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#00ff9d', textAlign: 'center' }}>لوحة تحكم التداول 🚀</h1>
      <table style={{ width: '100%', marginTop: '30px', borderCollapse: 'collapse', backgroundColor: '#161616' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333' }}>
            <th style={{ padding: '15px' }}>الرمز</th>
            <th style={{ padding: '15px' }}>السعر</th>
            <th style={{ padding: '15px' }}>التغير</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock: any) => (
            <tr key={stock.symbol} style={{ borderBottom: '1px solid #222' }}>
              <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>{stock.symbol}</td>
              <td style={{ padding: '15px', textAlign: 'center' }}>{stock.price} $</td>
              <td style={{ padding: '15px', textAlign: 'center', color: stock.change.includes('-') ? '#ff4d4d' : '#00ff9d' }}>{stock.change}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
