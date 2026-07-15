"use client";
import { useState } from 'react';

export default function Home() {
  const [analysis, setAnalysis] = useState("اختر سهماً للبدء في التحليل الفني...");

  const stocks = [
    { symbol: 'NXTC', price: '6.58' },
    { symbol: 'FGIWW', price: '0.09' },
    { symbol: 'PTORW', price: '0.684' },
    { symbol: 'PRENW', price: '0.0159' },
    { symbol: 'BOSER', price: '0.04' }
  ];

  return (
    <main style={{ padding: '20px', backgroundColor: '#000', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#FFD700', fontSize: '24px' }}>⚡ TRADING RADAR PRO</h1>
      
      <div style={{ border: '1px solid #FFD700', padding: '15px', marginTop: '20px', borderRadius: '8px' }}>
        <p style={{ color: '#FFD700', fontWeight: 'bold' }}>(Gemini) المحلل الذكي</p>
        <p>{analysis}</p>
      </div>

      <div style={{ marginTop: '30px' }}>
        {stocks.map((stock) => (
          <div key={stock.symbol} style={{ borderBottom: '1px solid #333', padding: '15px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '18px', margin: 0 }}>{stock.symbol}</p>
              <p style={{ color: '#aaa', margin: 0 }}>$ {stock.price}</p>
            </div>
            <button 
              onClick={() => setAnalysis(`تحليل ${stock.symbol}: جارٍ الاتصال بالمحلل...`)}
              style={{ backgroundColor: '#FFD700', color: '#000', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}
            >
              تحليل تقني
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
