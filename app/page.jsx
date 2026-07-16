'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [watchlist, setWatchlist] = useState(['PPSI', 'ANVS', 'BYRN', 'KULR', 'HURA']);
  const [input, setInput] = useState('');
  const [alerts, setAlerts] = useState([]);

  const addStock = () => {
    if (input && !watchlist.includes(input.toUpperCase())) {
      setWatchlist([...watchlist, input.toUpperCase()]);
      setInput('');
    }
  };

  const runScanner = async () => {
    // نرسل القائمة المحدثة للمسح
    const res = await fetch(`/api/stocks?symbols=${watchlist.join(',')}`);
    const json = await res.json();
    setAlerts(json.alerts || []);
  };

  return (
    <main style={{ backgroundColor: '#000', color: '#D4AF37', minHeight: '100vh', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', color: '#FFD700' }}>📊 لوحة تحكم السنايبر</h1>
      
      {/* قسم البحث والإضافة */}
      <div style={{ textAlign: 'center', margin: '20px' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="أضف سهم للقائمة..." style={{ padding: '10px', color: '#000' }} />
        <button onClick={addStock} style={{ padding: '10px 20px', background: '#D4AF37', border: 'none', cursor: 'pointer', marginLeft: '10px' }}>إضافة</button>
      </div>

      <div style={{ display: 'flex', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
        {/* قسم المتابعة */}
        <div style={{ flex: 1, border: '1px solid #D4AF37', padding: '15px' }}>
          <h3>📋 قائمة المتابعة</h3>
          {watchlist.map(s => <span key={s} style={{ display: 'block', padding: '5px' }}>{s}</span>)}
        </div>

        {/* قسم الفرص */}
        <div style={{ flex: 2, border: '1px solid #D4AF37', padding: '15px' }}>
          <h3>🚀 الفرص المرصودة</h3>
          <button onClick={runScanner} style={{ background: '#FFD700', padding: '5px' }}>مسح القائمة الحالية</button>
          {alerts.map((a, i) => <p key={i} style={{ color: '#fff' }}>{a.symbol}: {a.msg}</p>)}
        </div>
      </div>
    </main>
  );
}
