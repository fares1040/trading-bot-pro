"use client";
import { useState } from 'react';

export default function Home() {
  const [analysis, setAnalysis] = useState("اضغط تحليل للحصول على التقرير...");

  const handleAnalyze = async (symbol: string) => {
    setAnalysis("جاري التحليل...");
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ symbol }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setAnalysis(data.analysis || "خطأ في الاتصال");
    } catch (e) {
      setAnalysis("خطأ في الاتصال");
    }
  };

  return (
    <main style={{ backgroundColor: '#000', color: '#fff', padding: '20px', minHeight: '100vh' }}>
      <h1>TRADING RADAR PRO</h1>
      <div style={{ border: '1px solid yellow', padding: '10px', marginBottom: '20px' }}>
        {analysis}
      </div>
      {['NXTC', 'FGIWW', 'PTORW', 'PRENW', 'BOSER'].map(s => (
        <div key={s} style={{ marginBottom: '10px' }}>
          <span>{s} </span>
          <button onClick={() => handleAnalyze(s)}>تحليل</button>
        </div>
      ))}
    </main>
  );
}
