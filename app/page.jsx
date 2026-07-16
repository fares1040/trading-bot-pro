'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState({ watchlist: [], entries: [], risks: [] });
  const [input, setInput] = useState("");

  const loadData = async (symbols) => {
    localStorage.setItem('myStocks', symbols);
    const res = await fetch(`/api/stocks?symbols=${symbols}`);
    const json = await res.json();
    // نفترض أن الـ API يرجع البيانات مقسمة (أو سنقوم بفلترتها هنا)
    setData({
        watchlist: symbols.split(','),
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
        <input style={{ flex: 1, padding: '12px', background: '#111', border: '1px solid #D4AF37', color: '#fff' }} value={input} onChange={(e) => setInput(e.target.value)} />
        <button style={{ background: '#D4AF37', padding: '10px 20px', fontWeight: 'bold' }} onClick={() => loadData(input)}>تحديث</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* العمود الأول: الأسهم المراقبة */}
        <div style={{ border: '1px solid #333', padding: '15px', background: '#0a0a0a' }}>
            <h2 style={{ color: '#D4AF37', borderBottom: '1px solid #333' }}>📋 قائمة المتابعة</h2>
            {data.watchlist.map(s => <p key={s} style={{ color: '#888' }}>{s}</p>)}
        </div>
        {/* العمود الثاني: فرص الدخول */}
        <div style={{ border: '1px solid #D4AF37', padding: '15px', background: '#0a0a0a' }}>
            <h2 style={{ color: '#FFD700', borderBottom: '1px solid #D4AF37' }}>🚀 فرص الدخول (سنايبر)</h2>
            {data.entries.map((s, i) => <p key={i} style={{ color: '#fff' }}>{s.symbol}: {s.msg}</p>)}
        </div>
        {/* العمود الثالث: تنبيهات الخطر */}
        <div style={{ border: '1px solid #FF0000', padding: '15px', background: '#0a0a0a' }}>
            <h2 style={{ color: '#FF0000', borderBottom: '1px solid #333' }}>⚠️ مراقبة الخطر</h2>
            {data.risks.map((s, i) => <p key={i} style={{ color: '#FF4444' }}>{s.symbol}: {s.msg}</p>)}
        </div>
      </div>
    </main>
  );
}
