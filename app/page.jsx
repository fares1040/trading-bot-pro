'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [watchData, setWatchData] = useState([]);
  const [watchlist, setWatchlist] = useState(['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI']);

  useEffect(() => {
    const fetchWatchlist = async () => {
      const data = await Promise.all(watchlist.map(async (s) => {
        const res = await fetch(`/api/analyze?symbol=${s}`);
        const json = await res.json();
        return { ...json, stopLoss: (json.currentPrice * 0.97).toFixed(2) }; // حساب SL ديناميكياً
      }));
      setWatchData(data);
    };
    fetchWatchlist();
  }, [watchlist]);

  return (
    <div style={{ backgroundColor: '#121212', color: '#fff', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ textAlign: 'center', color: '#00ff41' }}>غرفة العمليات - نظام السنايبر</h1>
      
      <table style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: '#888', borderBottom: '2px solid #333' }}>
            <th>السهم</th>
            <th>السعر</th>
            <th>وقف الخسارة (SL)</th>
            <th>القرار/التحليل</th>
            <th>تحكم</th>
          </tr>
        </thead>
        <tbody>
          {watchData.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #222' }}>
              <td>{s.symbol}</td>
              <td>{s.currentPrice}</td>
              <td style={{ color: '#ff4444', fontWeight: 'bold' }}>{s.stopLoss}</td>
              <td title={s.analysis}>{s.analysis?.substring(0, 30)}...</td>
              <td>
                <button onClick={() => setWatchlist(watchlist.filter(item => item !== s.symbol))} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>حذف</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
