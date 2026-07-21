'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [symbols, setSymbols] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sniper_symbols');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return [
      'VMAR', 'CETX', 'GSIT', 'PRFX', 'BYRN', 'ERNA', 
      'LNZA', 'HURA', 'KULR', 'ANVS', 'PPSI', 'BJDX', 
      'MRAM', 'NOK', 'SPSC', 'PODC', 'OPI', 'TOVX', 
      'NIO', 'LOT', 'OLB', 'OCG', 'QUCY', 'PLUG'
    ];
  });

  const [newSymbol, setNewSymbol] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    localStorage.setItem('sniper_symbols', JSON.stringify(symbols));
  }, [symbols]);

  // فحص الأسهم المضافة
  const runAnalysis = async () => {
    setLoading(true);
    const newResults = {};
    for (let sym of symbols) {
      try {
        const res = await fetch(`/api/analyze?symbol=${sym}`);
        const data = await res.json();
        newResults[sym] = data;
      } catch (err) {
        newResults[sym] = { error: "فشل الاتصال" };
      }
    }
    setResults(newResults);
    setLoading(false);
  };

  // البحث التلقائي عن الأسهم المطابقة للشروط في السوق
  const scanMarketForMatches = async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/analyze?scan=true`);
      const data = await res.json();
      if (data.matched && data.matched.length > 0) {
        const merged = Array.from(new Set([...symbols, ...data.matched]));
        setSymbols(merged);
        alert(`تم العثور وإضافة ${data.matched.length} سهم مطابق لشروط الكلاستر بنجاح! 🎯`);
      } else {
        alert('لم يتم العثور على أسهم تطابق الشروط بدقة في هذه اللحظة.');
      }
    } catch (e) {
      alert('حدث خطأ أثناء البحث التلقائي.');
    }
    setScanning(false);
  };

  const addSymbol = (e) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    const upper = newSymbol.toUpperCase().trim();
    if (!symbols.includes(upper)) setSymbols([...symbols, upper]);
    setNewSymbol('');
  };

  const removeSymbol = (symToRemove) => {
    setSymbols(symbols.filter(s => s !== symToRemove));
  };

  return (
    <main style={{ padding: '20px', direction: 'rtl', fontFamily: 'Tahoma, sans-serif', background: '#0f172a', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', color: '#38bdf8', marginBottom: '25px' }}>🎯 نظام السنايبر المطور - فريم 4 ساعات</h1>
      
      {/* الأزرار وأدوات البحث */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <form onSubmit={addSymbol} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="أدخل رمز السهم" 
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            style={{ padding: '10px', borderRadius: '5px', border: '1px solid #475569', background: '#1e293b', color: '#fff' }}
          />
          <button type="submit" style={{ padding: '10px 15px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>إضافة</button>
        </form>

        <button 
          onClick={scanMarketForMatches} 
          disabled={scanning}
          style={{ padding: '10px 20px', background: scanning ? '#64748b' : '#9333ea', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {scanning ? '🔄 جاري الفحص بالشروط...' : '🎯 بحث تلقائي (مطابق لشروطنا)'}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <button 
          onClick={runAnalysis} 
          disabled={loading}
          style={{ padding: '12px 30px', background: loading ? '#64748b' : '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'جاري فحص القائمة...' : '🚀 فحص وتحليل الأسهم الحالية'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {symbols.map((sym) => {
          const data = results[sym];
          return (
            <div key={sym} style={{ background: '#1e293b', padding: '18px', borderRadius: '12px', border: '1px solid #334155', position: 'relative', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
                <h3 style={{ margin: 0, color: '#facc15', fontSize: '18px' }}>{sym}</h3>
                <button onClick={() => removeSymbol(sym)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px' }}>حذف</button>
              </div>

              {data ? (
                <div>
                  <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b', marginBottom: '12px' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12.5px', color: '#e2e8f0', margin: 0, lineHeight: '1.6' }}>
                      {data.analysis || data.error}
                    </pre>
                  </div>

                  {data.isSuitable ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ background: '#14532d', color: '#4ade80', padding: '8px', textAlign: 'center', borderRadius: '6px', fontSize: '12.5px', fontWeight: 'bold', border: '1px solid #166534' }}>
                        🎯 مطابق لشروط السنايبر ومرسل للتيليجرام ✅
                      </div>
                      <a 
                        href={`https://www.tradingview.com/chart/?symbol=${sym}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ display: 'block', background: '#0284c7', color: '#fff', padding: '8px', textAlign: 'center', borderRadius: '6px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}
                      >
                        📈 فتح الشارت على TradingView
                      </a>
                    </div>
                  ) : (
                    <div style={{ background: '#451a03', color: '#fdba74', padding: '6px', textAlign: 'center', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #7c2d12' }}>
                      انتظر اكتمال النموذج أو عدم مطابقة الشروط ❌
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', margin: '20px 0' }}>في انتظار الفحص والتحديث...</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
