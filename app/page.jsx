'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [newTicker, setNewTicker] = useState('');
  const [result, setResult] = useState(null);
  
  // قائمة الأسهم الثابتة التي طلبت إضافتها
  const [watchlist, setWatchlist] = useState([
    'HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI', 
    'CETX', 'GSIT', 'PRFX', 'VMAR', 'ERNA', 'OLB', 'OCG', 'LNZA', 'PPSI', 'QUCY', 'PLUG'
  ]);
  
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

  const removeFromWatchlist = (symbol) => {
    setWatchlist(watchlist.filter(s => s !== symbol));
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#fff', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ textAlign: 'center', color: '#00ff41' }}>نظام السنايبر - غرفة العمليات</h1>
      
      {/* 1. بحث فردي */}
      <div style={{ border: '1px solid #333', padding: '15px' }}>
        <input onChange={(e) => setTicker(e.target.value)} placeholder="بحث فردي..." style={{ width: '80%', padding: '10px', backgroundColor: '#1e1e1e', color: '#fff' }} />
        <button onClick={async() => {
             const res = await fetch(`/api/analyze?symbol=${ticker}`);
             setResult(await res.json());
        }} style={{ width: '20%', padding: '10px', backgroundColor: '#00ff41', fontWeight: 'bold' }}>تحليل</button>
      </div>

      {/* 2. إضافة وحذف */}
      <div style={{ marginTop: '20px' }}>
        <input value={newTicker} onChange={(e) => setNewTicker(e.target.value)} placeholder="إضافة سهم جديد..." style={{ padding: '10px', width: '70%', backgroundColor: '#1e1e1e', color: '#fff' }} />
        <button onClick={() => { if(newTicker) setWatchlist([...watchlist, newTicker.toUpperCase()]); setNewTicker(''); }} style={{ padding: '10px', width: '28%', backgroundColor: '#00ccff', fontWeight: 'bold' }}>إضافة</button>
      </div>

      <h3 style={{ color: '#00ccff', marginTop: '20px' }}>رادار المتابعة:</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '1px solid #444' }}><th>السهم</th><th>السعر</th><th>القرار</th><th>تحكم</th></tr></thead>
        <tbody>
          {watchData.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #222' }}>
              <td>{s.symbol}</td><td>{s.currentPrice}</td>
              <td style={{ color: s.status }}>{s.analysis}</td>
              <td><button onClick={() => removeFromWatchlist(s.symbol)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>[X]</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
