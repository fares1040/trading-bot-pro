'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [newTicker, setNewTicker] = useState('');
  const [watchData, setWatchData] = useState([]);
  const [watchlist, setWatchlist] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('myWatchlist');
      return saved ? JSON.parse(saved) : ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI'];
    }
    return ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI'];
  });

  useEffect(() => {
    localStorage.setItem('myWatchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    const fetchWatchlist = async () => {
      const data = await Promise.all(watchlist.map(async (s) => {
        try {
          const res = await fetch(`/api/analyze?symbol=${s}`);
          const json = await res.json();
          return json;
        } catch { return { symbol: s, currentPrice: '---', isSuitable: false, analysis: 'خطأ' }; }
      }));
      setWatchData(data);
    };
    fetchWatchlist();
  }, [watchlist]);

  const handleSearch = async () => {
    if(!ticker) return;
    const res = await fetch(`/api/analyze?symbol=${ticker.toUpperCase()}`);
    const data = await res.json();
    alert(data.analysis);
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#fff', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ textAlign: 'center', color: '#00ff41' }}>غرفة العمليات - نظام السنايبر المطور</h1>
      
      {/* خانات البحث والإضافة */}
      <div style={{ marginBottom: '20px' }}>
        <input onChange={(e) => setTicker(e.target.value)} placeholder="بحث عن سهم..." style={{ width: '80%', padding: '10px', color: '#000' }} />
        <button onClick={handleSearch} style={{ width: '19%', marginLeft: '1%', padding: '10px', background: '#00ff41', cursor: 'pointer', fontWeight: 'bold' }}>بحث</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input onChange={(e) => setNewTicker(e.target.value)} value={newTicker} placeholder="إضافة سهم للقائمة..." style={{ padding: '10px', width: '80%', color: '#000' }} />
        <button onClick={() => { if(newTicker) { setWatchlist([...new Set([...watchlist, newTicker.toUpperCase()])]); setNewTicker(''); } }} style={{ padding: '10px', width: '19%', marginLeft: '1%', cursor: 'pointer', background: '#00ff41' }}>إضافة</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: '#888', borderBottom: '2px solid #333' }}>
            <th>السهم</th><th>السعر</th><th>حالة الدخول</th><th>التحليل الفني</th><th>تحكم</th>
          </tr>
        </thead>
        <tbody>
          {watchData.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #222' }}>
              <td>{s.symbol}</td>
              <td>{s.currentPrice}</td>
              <td style={{ color: s.isSuitable ? "#00ff41" : "#ff4444" }}>{s.isSuitable ? "مناسب ✅" : "انتظر ⏳"}</td>
              <td><button onClick={() => alert(s.analysis)} style={{ color: '#00ff41', background: 'none', border: 'none', cursor: 'pointer' }}>عرض</button></td>
              <td><button onClick={() => setWatchlist(watchlist.filter(item => item !== s.symbol))} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>حذف</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
