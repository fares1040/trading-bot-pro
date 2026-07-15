'use client';

import { useState } from 'react';

export default function Home() {
  const [analysis, setAnalysis] = useState("بانتظار اختيار سهم...");
  const stocks = ["BOSER", "PRENW", "NXTC", "FGIWW", "PTORW"];

  const handleAnalyze = async (symbol: string) => {
    setAnalysis("جاري التحليل...");
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const data = await response.json();
      setAnalysis(data.analysis || "خطأ في جلب البيانات");
    } catch (error) {
      setAnalysis("حدث خطأ في الاتصال.");
    }
  };

  return (
    <main style={{ padding: '20px', textAlign: 'center', backgroundColor: '#111', color: '#fff', minHeight: '100vh' }}>
      <h1>TRADING RADAR PRO V2</h1>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '30px', flexWrap: 'wrap' }}>
        {stocks.map((stock) => (
          <button key={stock} onClick={() => handleAnalyze(stock)} style={{ padding: '10px 20px', cursor: 'pointer' }}>
            {stock}
          </button>
        ))}
      </div>
      <div style={{ marginTop: '40px', padding: '20px', borderTop: '1px solid #333' }}>
        <p>{analysis}</p>
      </div>
    </main>
  );
}
