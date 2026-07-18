'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [newTicker, setNewTicker] = useState('');
  const [watchlist, setWatchlist] = useState(['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI', 'CETX', 'GSIT', 'PRFX', 'VMAR', 'ERNA', 'OLB', 'OCG', 'LNZA', 'PPSI', 'QUCY', 'PLUG']);
  const [watchData, setWatchData] = useState([]);

  useEffect(() => {
    const fetchWatchlist = async () => {
      const data = await Promise.all(watchlist.map(async (s) => {
        const res = await fetch(`/api/analyze?symbol=${s}`);
        return res.json();
      }));
      setWatchData(data);
    };
    fetchWatchlist();
  }, [watchlist]);

  const handleAnalyze = async () => {
    if (!ticker) return;
    const res = await fetch(`/api/analyze?symbol=${ticker}`);
    const data = await res.json();
    alert(`السهم: ${data.symbol}\nالسعر: ${data.currentPrice}\nالقرار: ${data.analysis}`);
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#fff', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ textAlign: 'center', color: '#00ff41' }}>نظام السنايبر - غرفة العمليات</h1>
      <div style={{ padding: '20px', border: '1px solid #333', marginBottom: '20px' }}>
        <input onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="بحث فردي..." style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e1e', color: '#fff' }} />
        <button onClick={handleAnalyze} style={{ width: '100%', marginTop: '10px', padding: '15px', backgroundColor: '#00ff41', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}>تحليل السهم الفوري</button>
      </div>
      <div style={{ marginTop: '20px' }}>
        <input value={newTicker} onChange={(e) => setNewTicker(e.target.value)} placeholder="إضافة سهم..." style={{ padding: '10px', width: '70%', backgroundColor: '#1e1e1e', color: '#fff' }} />
        <button onClick={() => { if(newTicker) setWatchlist([...watchlist, newTicker.toUpperCase()]); setNewTicker(''); }} style={{ padding: '10px', width: '28%', backgroundColor: '#00ccff' }}>إضافة</button>
      </div>
      <table style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse' }}>
        <thead><tr style={{ color: '#888' }}><th>السهم</th><th>السعر</th><th>القرار</th><th>تحكم</th></tr></thead>
        <tbody>
          {watchData.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #222' }}>
              <td>{s.symbol}</td><td>{s.currentPrice}</td>
              <td style={{ color: s.status }}>{s.analysis}</td>
              <td><button onClick={() => setWatchlist(watchlist.filter(item => item !== s.symbol))} style={{ color: 'red', background: 'none', border: 'none' }}>[X]</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
