'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState({ watchlist: [], entries: [], risks: [] });
  const [input, setInput] = useState("");

  const loadData = async (symbolsString) => {
    localStorage.setItem('myStocks', symbolsString);
    const symbolsArray = symbolsString.split(',').map(s => s.trim());
    const res = await fetch(`/api/stocks?symbols=${symbolsString}`);
    const json = await res.json();
    
    setData({
        watchlist: symbolsArray,
        entries: json.alerts.filter(a => !a.msg.includes('خطر')),
        risks: json.alerts.filter(a => a.msg.includes('خطر'))
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('myStocks') || 'PPSI,ANVS,BYRN';
    setInput(saved);
    loadData(saved);
  }, []);

  return (
    <main style={{ backgroundColor: '#000', minHeight: '100vh', padding: '20px', color: '#D4AF37', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#FFD700', marginBottom: '30px', fontSize: '2.5rem' }}>📊 لوحة تحكم السنايبر</h1>
      
      <div style={{ display: 'flex', gap: '10px', maxWidth: '600px', margin: '0 auto 30px' }}>
        <input style={{ flex: 1, padding: '12px', background: '#111', border: '1px solid #D4AF37', color: '#fff', borderRadius: '4px' }} 
               value={input} onChange={(e) => setInput(e.target.value)} placeholder="أدخل الأسهم (مثال: AAPL,TSLA,PPSI)" />
        <button style={{ background: '#D4AF37', color: '#000', padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', border: 'none', borderRadius: '4px' }} 
                onClick={() => loadData(input)}>تحديث الرادار</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div style={{ border: '1px solid #333', padding: '15px', background: '#0a0a0a', borderRadius: '8px' }}>
            <h2 style={{ color: '#D4AF37', borderBottom: '1px solid #333', paddingBottom: '10px' }}>📋 قائمة المتابعة</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {data.watchlist.map(s => <span key={s} style={{ background: '#222', padding: '5px 10px', borderRadius: '4px' }}>{s}</span>)}
            </div>
        </div>
        <div style={{ border: '1px solid #D4AF37', padding: '15px', background: '#0a0a0a', borderRadius: '8px' }}>
            <h2 style={{ color: '#FFD700', borderBottom: '1px solid #D4AF37', paddingBottom: '10px' }}>🚀 فرص الدخول</h2>
            {data.entries.length > 0 ? data.entries.map((s, i) => <p key={i} style={{ color: '#fff' }}>{s.symbol}: {s.msg}</p>) : <p style={{ color: '#444' }}>لا توجد فرص حالياً</p>}
        </div>
        <div style={{ border: '1px solid #FF0000', padding: '15px', background: '#0a0a0a', borderRadius: '8px' }}>
            <h2 style={{ color: '#FF0000', borderBottom: '1px solid #333', paddingBottom: '10px' }}>⚠️ مراقبة الخطر</h2>
            {data.risks.length > 0 ? data.risks.map((s, i) => <p key={i} style={{ color: '#FF4444' }}>{s.symbol}: {s.msg}</p>) : <p style={{ color: '#444' }}>السوق مستقر</p>}
        </div>
      </div>
    </main>
  );
}
