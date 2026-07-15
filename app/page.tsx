"use client";
import { useState } from 'react';

export default function Home() {
  const [analysis, setAnalysis] = useState("اختر سهماً للحصول على تحليل تقني لحظي...");
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async (symbol: string) => {
    setLoading(true);
    setAnalysis("جاري تحليل بيانات " + symbol + "...");
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      const data = await res.json();
      setAnalysis(data.analysis || "خطأ في التحليل");
    } catch (e) {
      setAnalysis("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ backgroundColor: '#050505', color: '#E0E0E0', padding: '40px 20px', minHeight: '100vh', fontFamily: "'Segoe UI', sans-serif" }}>
      {/* الهيدر */}
      <header style={{ marginBottom: '40px', borderBottom: '1px solid #222', paddingBottom: '20px' }}>
        <h1 style={{ color: '#FFD700', fontSize: '28px', margin: 0 }}>TRADING RADAR <span style={{ fontWeight: 200, color: '#fff' }}>PRO</span></h1>
        <p style={{ color: '#666', fontSize: '14px' }}>نظام التحليل التقني اللحظي للمؤسسات</p>
      </header>
      
      {/* لوحة التحليل */}
      <div style={{ backgroundColor: '#111', border: '1px solid #222', padding: '25px', borderRadius: '16px', marginBottom: '40px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        <h3 style={{ color: '#FFD700', marginTop: 0, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '2px' }}>المحلل الذكي</h3>
        <p style={{ lineHeight: '1.8', fontSize: '16px' }}>{analysis}</p>
      </div>

      {/* شبكة البطاقات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
        {['PTORW', 'FGIWW', 'NXTC'].map(s => (
          <div key={s} style={{ backgroundColor: '#0D0D0D', border: '1px solid #1A1A1A', padding: '20px', borderRadius: '20px', transition: '0.3s', cursor: 'pointer' }}>
            <h2 style={{ fontSize: '22px', margin: '0 0 15px 0' }}>{s}</h2>
            <button 
              onClick={() => handleAnalyze(s)}
              disabled={loading}
              style={{ width: '100%', padding: '12px', backgroundColor: '#FFD700', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', color: '#000' }}
            >
              {loading ? "جاري..." : "بدء التحليل"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
