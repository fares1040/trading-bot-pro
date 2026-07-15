'use client';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [stocks, setStocks] = useState([]);
  const [analysis, setAnalysis] = useState('اختر سهماً للبدء في التحليل التقني...');
  const [loading, setLoading] = useState(false);

  // جلب الأسهم عند تحميل الصفحة
  useEffect(() => {
    fetch('/api/stocks')
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setStocks(data.data);
        }
      });
  }, []);

  const runAnalysis = async (symbol: string) => {
    setLoading(true);
    setAnalysis('جاري التحليل واستخراج النقاط الفنية... ⏳');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();
      setAnalysis(data.analysis || "لم يتم العثور على تحليل.");
    } catch {
      setAnalysis("خطأ في الاتصال بالمحلل. تأكد من إعدادات API Key.");
    }
    setLoading(false);
  };

  // دالة تحديد الفرص (تغير > 3% وسعر > 1)
  const isExplosive = (change: string, price: string) => parseFloat(change) > 3 && parseFloat(price) > 1;

  return (
    <div style={{ backgroundColor: '#050505', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'Arial' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#ffcc00', letterSpacing: '2px' }}>TRADING RADAR PRO ⚡</h1>
      </header>

      <div style={{ backgroundColor: '#111', border: '1px solid #ffcc00', padding: '20px', borderRadius: '15px', marginBottom: '30px', minHeight: '100px' }}>
        <h3 style={{ color: '#ffcc00', marginTop: 0 }}>المحلل الذكي (Gemini)</h3>
        <p style={{ whiteSpace: 'pre-line' }}>{analysis}</p>
      </div>

      <div style={{ display: 'grid', gap: '15px' }}>
        {stocks.map((s: any) => (
          <div key={s.symbol} style={{ 
            backgroundColor: isExplosive(s.change, s.price) ? '#1a1600' : '#0d0d0d',
            border: isExplosive(s.change, s.price) ? '1px solid #ffcc00' : '1px solid #222',
            padding: '15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
          }}>
            <div>
              <h2 style={{ margin: 0 }}>{s.symbol}</h2>
              <span style={{ color: '#aaa' }}>{s.price} $</span>
            </div>
            <button 
              onClick={() => runAnalysis(s.symbol)}
              style={{ backgroundColor: '#ffcc00', border: 'none', padding: '10px 20px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {loading ? '...' : 'تحليل تقني'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
