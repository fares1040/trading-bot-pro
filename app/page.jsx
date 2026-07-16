'use client';
import { useState } from 'react';

export default function Home() {
  const [watchlist, setWatchlist] = useState(['PPSI', 'ANVS', 'BYRN', 'KULR', 'HURA']);
  const [input, setInput] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const addStock = () => {
    if (input && !watchlist.includes(input.toUpperCase())) {
      setWatchlist([...watchlist, input.toUpperCase()]);
      setInput('');
    }
  };

  const runScanner = async () => {
    setLoading(true);
    const res = await fetch(`/api/stocks?symbols=${watchlist.join(',')}`);
    const json = await res.json();
    setAlerts(json.alerts || []);
    setLoading(false);
  };

  return (
    <main style={{ backgroundColor: '#000', color: '#D4AF37', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#FFD700' }}>📊 لوحة تحكم السنايبر الاحترافية</h1>
      
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="أضف سهم..." style={{ padding: '10px', color: '#000', width: '200px' }} />
        <button onClick={addStock} style={{ padding: '10px 20px', background: '#D4AF37', cursor: 'pointer', marginLeft: '10px' }}>إضافة للقائمة</button>
      </div>

      <div style={{ display: 'flex', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ flex: 1, border: '1px solid #D4AF37', padding: '15px' }}>
          <h3>📋 قائمة المتابعة ({watchlist.length})</h3>
          {watchlist.map(s => <div key={s} style={{ padding: '5px', borderBottom: '1px solid #333' }}>{s}</div>)}
        </div>

        <div style={{ flex: 2, border: '1px solid #D4AF37', padding: '15px' }}>
          <button onClick={runScanner} style={{ background: '#FFD700', padding: '10px', width: '100%', cursor: 'pointer' }}>{loading ? 'جاري المسح...' : 'بدء المسح التلقائي'}</button>
          <h3>🚀 الفرص المرصودة:</h3>
          {alerts.map((a, i) => <p key={i} style={{ color: '#fff', background: '#222', padding: '10px' }}>{a.symbol}: {a.msg}</p>)}
        </div>
      </div>
    </main>
  );
}
