'use client';
import { useState } from 'react';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [result, setResult] = useState(null);

  const checkStock = async () => {
    try {
      const res = await fetch(`/api/stocks?symbol=${ticker}`);
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error("خطأ في الاتصال:", error);
    }
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#00ff41', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ textAlign: 'center' }}>نظام السنايبر - غرفة العمليات</h1>
      
      <div style={{ padding: '20px', border: '1px solid #333', marginBottom: '20px' }}>
        <input 
          type="text" placeholder="اكتب رمز السهم (مثلاً AAPL)" 
          value={ticker} onChange={(e) => setTicker(e.target.value)}
          style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e1e', color: '#fff' }}
        />
        <button onClick={checkStock} style={{ width: '100%', marginTop: '10px', padding: '10px', backgroundColor: '#00ff41', color: '#000', fontWeight: 'bold' }}>
          تحليل السهم
        </button>
      </div>

      {result && (
        <div style={{ padding: '10px', border: '1px solid #00ff41', color: '#fff' }}>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
