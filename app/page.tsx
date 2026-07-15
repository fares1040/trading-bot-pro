"use client";
import { useState } from 'react';

export default function Home() {
  const [analysis, setAnalysis] = useState("اختر سهماً للبدء في التحليل الفني...");
  const [loading, setLoading] = useState(false);

  const stocks = [
    { symbol: 'NXTC', price: '6.58' },
    { symbol: 'FGIWW', price: '0.09' },
    { symbol: 'PTORW', price: '0.684' },
    { symbol: 'PRENW', price: '0.0159' },
    { symbol: 'BOSER', price: '0.04' }
  ];

  const handleAnalyze = async (symbol: string) => {
    setLoading(true);
    setAnalysis("جاري الاتصال بـ Gemini للتحليل...");
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      const data = await response.json();
      setAnalysis(data.analysis || "تعذر الحصول على التحليل.");
    } catch (error) {
      setAnalysis("خطأ في الاتصال، تأكد من إعدادات المفتاح.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: '20px', backgroundColor: '#000', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#FFD700', fontSize: '24px', marginBottom: '20px' }}>⚡ TRADING RADAR PRO</h1>
      
      <div style={{ border: '1px solid #FFD700', padding: '15px', marginBottom: '30px', borderRadius: '8px' }}>
        <p style={{ color: '#FFD700', fontWeight: 'bold' }}>(Gemini) المحلل الذكي</p>
        <p style={{ marginTop: '10px', lineHeight: '1.6' }}>{loading ? "..." : analysis}</p>
      </div>

      <div>
        {stocks.map((stock) => (
          <div key={stock.symbol} style={{ borderBottom: '1px solid #333', padding: '15px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '18px', margin: 0 }}>{stock.symbol}</p>
              <p style={{ color: '#aaa', margin: 0 }}>$ {stock.price}</p>
            </div>
            <button 
              onClick={() => handleAnalyze(stock.symbol)}
              style={{ backgroundColor: '#FFD700', color: '#000', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              تحليل تقني
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
