'use client';
import { useState } from 'react';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [result, setResult] = useState(null);

  const checkStock = async () => {
    if (!ticker) return;
    const res = await fetch(`/api/analyze?symbol=${ticker}`);
    const data = await res.json();
    setResult(data);
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#00ff41', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ textAlign: 'center' }}>نظام السنايبر - غرفة العمليات</h1>
      <div style={{ padding: '20px', border: '1px solid #333', marginBottom: '20px' }}>
        <select onChange={(e) => setTicker(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e1e', color: '#fff' }}>
          <option value="">اختر سهماً من قائمة المراقبة...</option>
          <option value="AAPL">AAPL</option>
          <option value="TSLA">TSLA</option>
          <option value="A">A</option>
        </select>
        <button onClick={checkStock} style={{ width: '100%', marginTop: '10px', padding: '10px', backgroundColor: '#00ff41', color: '#000', fontWeight: 'bold' }}>تحليل السهم</button>
      </div>
      {result && (
        <div style={{ padding: '15px', border: `2px solid ${result.status}`, color: '#fff' }}>
          <h3>نتائج التحليل:</h3>
          <p>السهم: {result.symbol}</p>
          <p>السعر الحالي: {result.currentPrice}</p>
          <p style={{ fontWeight: 'bold' }}>القرار: {result.analysis}</p>
        </div>
      )}
    </div>
  );
}
