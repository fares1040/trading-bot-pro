'use client';
import { useState } from 'react';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [result, setResult] = useState(null);

  const checkStock = async () => {
    const res = await fetch(`/api/stocks?symbol=${ticker}`);
    const data = await res.json();
    setResult(data);
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#00ff41', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ textAlign: 'center' }}>نظام السنايبر - غرفة العمليات</h1>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
        <input 
          type="text" placeholder="اكتب رمز السهم (مثل AAPL)" 
          value={ticker} onChange={(e) => setTicker(e.target.value)}
          style={{ padding: '10px', width: '80%', backgroundColor: '#1e1e1e', color: 'white', border: '1px solid #333' }}
        />
        <button onClick={checkStock} style={{ padding: '10px 20px', backgroundColor: '#00ff41', color: '#121212', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          بحث عن فرصة
        </button>
      </div>
      {result && (
        <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #00ff41' }}>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
