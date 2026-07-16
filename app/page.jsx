'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState({ entries: [] });

  const runScanner = async () => {
    const res = await fetch('/api/stocks');
    const json = await res.json();
    setData({ entries: json.alerts });
  };

  return (
    <main style={{ backgroundColor: '#000', color: '#D4AF37', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#FFD700' }}>📊 رادار السنايبر الذكي</h1>
      <div style={{ textAlign: 'center', margin: '20px' }}>
        <button style={{ background: '#D4AF37', padding: '15px 30px', fontWeight: 'bold', cursor: 'pointer' }} onClick={runScanner}>بدء مسح السوق التلقائي</button>
      </div>
      <div style={{ maxWidth: '800px', margin: '0 auto', border: '1px solid #D4AF37', padding: '20px' }}>
        <h2 style={{ color: '#FFD700' }}>🚀 الفرص المرصودة:</h2>
        {data.entries.length > 0 ? data.entries.map((s, i) => (
            <p key={i} style={{ color: '#fff', borderBottom: '1px solid #333' }}>{s.symbol}: {s.msg}</p>
        )) : <p>اضغط المسح للبدء...</p>}
      </div>
    </main>
  );
}
