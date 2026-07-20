'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [newTicker, setNewTicker] = useState('');
  const [watchlist, setWatchlist] = useState(['LNZA', 'HURA', 'KULR', 'BYRN', 'BJDX', 'MRAM', 'NOK', 'OPI', 'VMAR']);
  const [watchData, setWatchData] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('myWatchlist');
    if (saved) setWatchlist(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('myWatchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await Promise.all(watchlist.map(async (s) => {
        try {
          const res = await fetch(`/api/analyze?symbol=${s}`);
          return await res.json();
        } catch (err) {
          return { symbol: s, currentPrice: '---', isSuitable: false, analysis: 'Loading...' };
        }
      }));
      setWatchData(data);
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [watchlist]);

  const handleSearch = async () => {
    if (!ticker) return;
    const res = await fetch(`/api/analyze?symbol=${ticker.toUpperCase()}`);
    const data = await res.json();
    alert(data.analysis || "Analysis in progress...");
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#fff', padding: '20px', fontFamily: 'monospace', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', color: '#00ff41', marginBottom: '30px' }}>Sniper System</h1>

      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <input onChange={(e) => setTicker(e.target.value)} placeholder="Search symbol..." style={{ width: '60%', padding: '10px' }} />
        <button onClick={handleSearch} style={{ width: '15%', marginLeft: '1%', padding: '10px', background: '#00ff41', cursor: 'pointer' }}>Search</button>
      </div>

      <div style={{ marginBottom: '30px', textAlign: 'center' }}>
        <input onChange={(e) => setNewTicker(e.target.value)} value={newTicker} placeholder="Add new symbol..." style={{ padding: '10px' }} />
        <button onClick={() => { if (newTicker) setWatchlist([...new Set([...watchlist, newTicker.toUpperCase()])]); setNewTicker(''); }}>Add</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ color: '#888', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '10px' }}>Symbol</th>
            <th style={{ padding: '10px' }}>Price</th>
            <th style={{ padding: '10px' }}>Entry Status</th>
            <th style={{ padding: '10px' }}>Technical Analysis</th>
            <th style={{ padding: '10px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {watchData.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #222', backgroundColor: s.isSuitable ? 'rgba(0, 255, 65, 0.1)' : 'transparent' }}>
              <td style={{ padding: '10px', fontWeight: 'bold' }}>{s.symbol}</td>
              <td style={{ padding: '10px' }}>{s.currentPrice}</td>
              <td style={{ padding: '10px', color: s.isSuitable ? '#00ff41' : '#ff4444', fontWeight: 'bold' }}>
                {s.isSuitable ? "Suitable ✅" : "Wait ⏳"}
              </td>
              <td style={{ padding: '10px' }}>
                <button onClick={() => alert(s.analysis || "No data available")} style={{ color: '#00ff41', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  View
                </button>
              </td>
              <td style={{ padding: '10px' }}>
                <button onClick={() => setWatchlist(watchlist.filter(item => item !== s.symbol))} style={{ color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
