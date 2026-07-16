'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState({ alerts: [] });
  const [input, setInput] = useState("");
  const [myStocks, setMyStocks] = useState([]);

  const refreshMarket = async (symbols) => {
    // 1. حفظ القائمة الجديدة
    localStorage.setItem('myStocks', symbols);
    setMyStocks(symbols.split(','));
    
    // 2. تحديث الرادار (إرسال القائمة للـ API)
    try {
      const res = await fetch(`/api/stocks?symbols=${symbols}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("فشل الاتصال بالخادم");
    }
  };

  useEffect(() => {
    // تحميل القائمة المحفوظة عند فتح الصفحة لأول مرة
    const saved = localStorage.getItem('myStocks') || 'PPSI,ANVS,BYRN,KULR,HURA';
    setInput(saved); // وضع الأسهم في الحقل تلقائياً
    refreshMarket(saved);
  }, []);

  return (
    <main style={{ backgroundColor: '#000000', minHeight: '100vh', padding: '20px', color: '#D4AF37' }}>
      <h1 style={{ textAlign: 'center', color: '#FFD700', marginBottom: '20px' }}>📊 رادار الأسهم الذهبي</h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
        <input 
          style={{ padding: '12px', background: '#111', border: '1px solid #D4AF37', color: '#FFF' }}
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="مثال: AAPL,TSLA,PPSI" 
        />
        <button 
          style={{ background: '#D4AF37', color: '#000', padding: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          onClick={() => refreshMarket(input)}>
          تحديث ومراقبة هذه الأسهم
        </button>
      </div>

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <p style={{ color: '#8B7355' }}>يتم مراقبة {myStocks.length} أسهم حالياً.</p>
        
        {data.alerts.length > 0 ? data.alerts.map((s, i) => (
          <div key={i} style={{ padding: '15px', border: '1px solid #D4AF37', marginTop: '10px', background: '#0a0a0a' }}>
            <h2 style={{ color: '#FFD700' }}>{s.symbol}</h2>
            <p style={{ color: s.msg.includes('خطر') ? 'red' : 'white' }}>{s.msg}</p>
          </div>
        )) : <p style={{ color: '#555' }}>السوق هادئ.. لم يتم رصد اختراقات في قائمتك.</p>}
      </div>
    </main>
  );
}
