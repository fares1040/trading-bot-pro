'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState({ alerts: [] });
  const [input, setInput] = useState("");
  const [myStocks, setMyStocks] = useState([]);

  const loadData = async (symbols) => {
    localStorage.setItem('myStocks', symbols);
    setMyStocks(symbols.split(','));
    const res = await fetch(`/api/stocks?symbols=${symbols}`);
    const json = await res.json();
    setData(json);
  };

  useEffect(() => {
    const saved = localStorage.getItem('myStocks') || 'PPSI,ANVS,BYRN,KULR,HURA';
    loadData(saved);
  }, []);

  return (
    // هنا فرضنا اللون الأسود كخلفية مطلقة
    <main style={{ backgroundColor: '#000000', minHeight: '100vh', padding: '2rem', color: '#D4AF37', fontFamily: 'sans-serif' }}>
      
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#FFD700', borderBottom: '2px solid #D4AF37', paddingBottom: '1rem', marginBottom: '2rem', textAlign: 'center' }}>
        📊 رادار الأسهم الذهبي
      </h1>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem' }}>
        <input 
          style={{ padding: '12px', backgroundColor: '#1a1a1a', border: '1px solid #D4AF37', color: '#FFF', width: '100%', borderRadius: '5px' }}
          value={input} onChange={(e) => setInput(e.target.value)} placeholder="أضف رموز الأسهم (مثال: AAPL,TSLA)" 
        />
        <button 
          style={{ backgroundColor: '#D4AF37', color: '#000', padding: '10px 20px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
          onClick={() => loadData(input)}>حفظ ومتابعة</button>
      </div>

      <div style={{ display: 'grid', gap: '15px' }}>
        {data.alerts.length > 0 ? data.alerts.map((s, i) => (
          <div key={i} style={{ padding: '20px', borderLeft: '5px solid ' + (s.msg.includes('خطر') ? '#FF0000' : '#D4AF37'), backgroundColor: '#0f0f0f', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.5)' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FFD700', display: 'block' }}>{s.symbol}</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: s.msg.includes('خطر') ? '#FF4444' : '#FFF' }}>{s.msg}</span>
          </div>
        )) : <p style={{ color: '#8B7355', fontStyle: 'italic', textAlign: 'center' }}>يتم مراقبة {myStocks.length} أسهم... السوق في حالة انتظار.</p>}
      </div>
    </main>
  );
}
