'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState({ entries: [] });
  const [loading, setLoading] = useState(false);

  const runScanner = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stocks');
      const json = await res.json();
      setData({ entries: json.alerts || [] });
    } catch (e) {
      console.error("خطأ في المسح:", e);
    }
    setLoading(false);
  };

  // هذا السطر سيجعل المسح يبدأ تلقائياً عند فتح الموقع
  useEffect(() => {
    runScanner();
  }, []);

  return (
    <main style={{ backgroundColor: '#000', color: '#D4AF37', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#FFD700' }}>📊 رادار السنايبر الذكي</h1>
      
      <div style={{ textAlign: 'center', margin: '20px' }}>
        <button 
          style={{ background: '#D4AF37', padding: '15px 30px', fontWeight: 'bold', cursor: 'pointer', border: 'none' }} 
          onClick={runScanner}
          disabled={loading}
        >
          {loading ? 'جاري المسح...' : 'إعادة مسح السوق'}
        </button>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', border: '1px solid #D4AF37', padding: '20px', borderRadius: '8px' }}>
        <h2 style={{ color: '#FFD700' }}>🚀 الفرص المرصودة:</h2>
        {loading ? <p>جاري البحث في الأسهم...</p> : 
         data.entries.length > 0 ? data.entries.map((s, i) => (
            <p key={i} style={{ color: '#fff', borderBottom: '1px solid #333', padding: '10px' }}>{s.symbol}: {s.msg}</p>
        )) : <p>لا توجد فرص في الوقت الحالي.</p>}
      </div>
    </main>
  );
}
