'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [newTicker, setNewTicker] = useState('');
// السطر 7 (اجعله يحتوي على القائمة الجديدة):
const [watchlist, setWatchlist] = useState(['LNZA', 'HURA', 'KULR', 'BYRN', 'BJDX', 'MRAM', 'NOK', 'OPI', 'VMAR', 'CETX', 'GSIT', 'PRFX', 'ERNA', 'ANVS', 'PPSI', 'TOVX', 'NIO', 'LOT', 'OLB', 'OCG', 'QUCY', 'PLUG']);

// احذف السطر 8 نهائياً!

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
        } catch { return { symbol: s, currentPrice: '---', isSuitable: false, analysis: 'السوق مغلق أو لا توجد بيانات حالياً' }; }
      }));
      setWatchData(data);
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [watchlist]);

  const handleSearch = async () => {
    if(!ticker) return;
    const res = await fetch(`/api/analyze?symbol=${ticker.toUpperCase()}`);
    const data = await res.json();
    alert(data.analysis || "السوق مغلق حالياً - لا يوجد تحليل متاح");
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#fff', padding: '20px', fontFamily: 'monospace', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', color: '#00ff41', marginBottom: '30px' }}>غرفة العمليات - نظام السنايبر المطور</h1>
      
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <input onChange={(e) => setTicker(e.target.value)} placeholder="بحث عن سهم..." style={{ width: '60%', padding: '10px', color: '#000' }} />
        <button onClick={handleSearch} style={{ width: '15%', marginLeft: '1%', padding: '10px', background: '#00ff41', cursor: 'pointer', fontWeight: 'bold' }}>بحث</button>
      </div>

      <div style={{ marginBottom: '30px', textAlign: 'center' }}>
        <input onChange={(e) => setNewTicker(e.target.value)} value={newTicker} placeholder="إضافة سهم للقائمة..." style={{ padding: '10px', width: '60%', color: '#000' }} />
        <button onClick={() => { if(newTicker) { setWatchlist([...new Set([...watchlist, newTicker.toUpperCase()])]); setNewTicker(''); } }} style={{ padding: '10px', width: '15%', marginLeft: '1%', cursor: 'pointer', background: '#00ff41' }}>إضافة</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ color: '#888', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '10px' }}>السهم</th>
            <th style={{ padding: '10px' }}>السعر</th>
            <th style={{ padding: '10px' }}>حالة الدخول</th>
            <th style={{ padding: '10px' }}>التحليل الفني</th>
            <th style={{ padding: '10px' }}>تحكم</th>
          </tr>
        </thead>
        <tbody>
          {watchData.map((s, i) => (
            <tr 
              key={i} 
              style={{ 
                borderBottom: '1px solid #222',
                backgroundColor: s.isSuitable ? 'rgba(0, 255, 65, 0.1)' : 'transparent',
                transition: 'background-color 0.5s ease'
              }}
            >
              <td style={{ padding: '10px', fontWeight: 'bold' }}>{s.symbol}</td>
              <td style={{ padding: '10px' }}>{s.currentPrice}</td>
              <td style={{ color: s.isSuitable ? "#00ff41" : "#ff4444", fontWeight: 'bold', padding: '10px' }}>
                {s.isSuitable ? "مناسب ✅" : "انتظر ⏳"}
              </td>
              <td style={{ padding: '10px' }}>
                <button 
                  onClick={() => alert(s.analysis || "السوق مغلق حالياً - لا يوجد تحليل")} 
                  style={{ color: '#00ff41', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  عرض
                </button>
              </td>
              <td style={{ padding: '10px' }}>
                <button onClick={() => setWatchlist(watchlist.filter(item => item !== s.symbol))} style={{ color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer' }}>حذف</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
