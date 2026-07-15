'use client'; // ضروري جداً ليعمل الموقع كواجهة تفاعلية

import { useState } from 'react';

export default function Home() {
  const [analysis, setAnalysis] = useState("");
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
      setAnalysis(data.analysis);
    } catch (error) {
      setAnalysis("حدث خطأ أثناء الاتصال.");
    }
  };

  return (
    <main style={{ padding: '20px', textAlign: 'center', backgroundColor: '#111', color: '#fff', minHeight: '100vh' }}>
      <h1>TRADING RADAR PRO V2</h1>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '30px', flexWrap: 'wrap' }}>
        {stocks.map((stock) => (
          <div key={stock} style={{ border: '1px solid #444', padding: '15px', borderRadius: '8px' }}>
            <h2 style={{ color: '#ffd700' }}>{stock}</h2>
            <button 
              onClick={() => handleAnalyze(stock)}
              style={{ backgroundColor: '#ffd700', padding: '10px', borderRadius: '5px', cursor: 'pointer', border: 'none' }}
            >
              تحليل
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '40px', padding: '20px', borderTop: '1px solid #333' }}>
        <h3>نتائج التحليل:</h3>
        <p style={{ maxWidth: '600px', margin: '0 auto' }}>{analysis}</p>
      </div>
    </main>
  );
}
