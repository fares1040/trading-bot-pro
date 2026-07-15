"use client";
import { useState, useEffect } from 'react';

export default function Home() {
  const [analysis, setAnalysis] = useState("اختر سهماً للحصول على تحليل تقني...");
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const stocks = ['PTORW', 'FGIWW', 'NXTC', 'PRENW', 'BOSER'];

  // تحميل المفضلة عند فتح الصفحة
  useEffect(() => {
    const saved = localStorage.getItem('favorites');
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  const toggleFavorite = (symbol: string) => {
    let newFavorites;
    if (favorites.includes(symbol)) {
      newFavorites = favorites.filter(s => s !== symbol);
    } else {
      newFavorites = [...favorites, symbol];
    }
    setFavorites(newFavorites);
    localStorage.setItem('favorites', JSON.stringify(newFavorites));
  };

  const handleAnalyze = async (symbol: string) => {
    setLoading(true);
    setAnalysis("جاري الاتصال بالمحلل الذكي لـ " + symbol + "...");
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      const data = await res.json();
      setAnalysis(data.analysis || "تعذر التحليل");
    } catch (e) {
      setAnalysis("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ backgroundColor: '#050505', color: '#fff', padding: '30px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#FFD700', fontSize: '28px' }}>TRADING RADAR PRO</h1>

      {/* قسم المفضلة */}
      {favorites.length > 0 && (
        <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #333', borderRadius: '12px' }}>
          <h3 style={{ color: '#aaa', fontSize: '14px' }}>المفضلة ⭐</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            {favorites.map(s => <span key={s} style={{ color: '#FFD700', fontWeight: 'bold' }}>{s}</span>)}
          </div>
        </div>
      )}

      {/* منطقة التحليل */}
      <div style={{ backgroundColor: '#111', padding: '20px', borderRadius: '16px', margin: '20px 0', border: '1px solid #222' }}>
        <p style={{ lineHeight: '1.6' }}>{analysis}</p>
      </div>

      {/* شبكة الأسهم */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
        {stocks.map(s => (
          <div key={s} style={{ backgroundColor: '#0D0D0D', border: '1px solid #1A1A1A', padding: '20px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>{s}</h2>
              <button onClick={() => toggleFavorite(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>
                {favorites.includes(s) ? '⭐' : '☆'}
              </button>
            </div>
            <button onClick={() => handleAnalyze(s)} disabled={loading} style={{ width: '100%', padding: '10px', backgroundColor: '#FFD700', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              {loading ? "..." : "تحليل"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
