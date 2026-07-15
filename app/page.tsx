"use client";
import { useState } from 'react';

export default function Home() {
  const [analysis, setAnalysis] = useState("اضغط تحليل للحصول على التقرير...");
  const [loading, setLoading] = useState(false);

  const stocks = ['PTORW', 'FGIWW', 'NXTC'];

  const handleAnalyze = async (symbol: string) => {
    setLoading(true);
    setAnalysis("جاري التحليل لـ " + symbol + "...");
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      const data = await res.json();
      setAnalysis(data.analysis || "خطأ في التحليل");
    } catch (e) {
      setAnalysis("خطأ في الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ backgroundColor: '#0A0A0A', color: '#fff', padding: '20px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#FFD700', marginBottom: '20px' }}>⚡ TRADING RADAR PRO</h1>
      
      {/* منطقة عرض التحليل */}
      <div style={{ border: '1px solid #FFD700', padding: '15px', borderRadius: '10px', marginBottom: '20px', minHeight: '100px' }}>
        {analysis}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
        {stocks.map(s => (
          <div key={s} style={{ border: '1px solid #333', padding: '15px', borderRadius: '10px', backgroundColor: '#161616', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 10px 0' }}>{s}</h2>
            <button 
              onClick={() => handleAnalyze(s)}
              disabled={loading}
              style={{ width: '100%', padding: '10px', backgroundColor: '#FFD700', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {loading ? "جاري..." : "تحليل"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
