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
    <div style={{ backgroundColor: '#121212', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ textAlign: 'center', color: '#00ff41' }}>نظام السنايبر - غرفة العمليات</h1>
      
      <div style={{ padding: '20px', border: '1px solid #333', marginBottom: '20px' }}>
        <input 
          onChange={(e) => setTicker(e.target.value)} 
          placeholder="أدخل رمز السهم (مثل AAPL)..." 
          style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e1e', color: '#fff', border: '1px solid #555' }}
        />
        <button 
          onClick={checkStock} 
          style={{ width: '100%', marginTop: '10px', padding: '10px', backgroundColor: '#00ff41', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}
        >
          تحليل السهم الحقيقي
        </button>
      </div>

      {result && result.currentPrice && (
        <div style={{ padding: '15px', border: `2px solid ${result.status}`, backgroundColor: '#1e1e1e' }}>
          <h3>نتائج التحليل:</h3>
          <p>السهم: {result.symbol}</p>
          <p>السعر الحالي: {result.currentPrice}</p>
          <p style={{ fontWeight: 'bold' }}>القرار: {result.analysis}</p>
          
          {/* قسم الخطة الذكية */}
          <div style={{ marginTop: '20px', borderTop: '1px solid #444', paddingTop: '10px' }}>
            <h4 style={{ color: '#00ff41' }}>خطة التداول المقترحة:</h4>
            <p style={{ color: '#ff4444' }}>🔴 وقف الخسارة (-10%): {result.plan.stopLoss}</p>
            <p style={{ color: '#00ccff' }}>🎯 الهدف الأول (+20%): {result.plan.target1}</p>
            <p style={{ color: '#00ccff' }}>🎯 الهدف الثاني (+40%): {result.plan.target2}</p>
            <p style={{ color: '#00ccff' }}>🎯 الهدف الثالث (+60%): {result.plan.target3}</p>
          </div>
        </div>
      )}
    </div>
  );
}
