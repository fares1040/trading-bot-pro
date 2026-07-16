'use client';
import { useState } from 'react';

export default function Home() {
  const [watchlist, setWatchlist] = useState(['PPSI', 'ANVS', 'BYRN', 'KULR', 'HURA', 'NVDA', 'AMD']);
  const [input, setInput] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('جاهز للعمل - بانتظار أمرك');

  const addStock = () => {
    if (input && !watchlist.includes(input.toUpperCase())) {
      setWatchlist([...watchlist, input.toUpperCase()]);
      setInput('');
      setStatus(`تمت إضافة ${input.toUpperCase()} للقائمة`);
    }
  };

  const removeStock = (symbol) => {
    setWatchlist(watchlist.filter(s => s !== symbol));
  };

  const runScanner = async () => {
    setStatus('🔍 جاري مسح الانفجارات في السوق...');
    setAlerts([]);
    
    try {
      const res = await fetch(`/api/stocks?symbols=${watchlist.join(',')}`);
      const json = await res.json();
      
      if (json.alerts && json.alerts.length > 0) {
        setAlerts(json.alerts);
        setStatus(`✅ تم العثور على ${json.alerts.length} فرص قوية!`);
      } else {
        setStatus('⚠️ اكتمل المسح: لا توجد فرص تحقق شروط الانفجار حالياً.');
      }
    } catch (err) {
      setStatus('❌ خطأ في الاتصال بالرادار، حاول مجدداً.');
    }
  };

  return (
    <main style={{ backgroundColor: '#000', color: '#D4AF37', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ textAlign: 'center', color: '#FFD700', textTransform: 'uppercase' }}>🚀 نظام السنايبر للترندات</h1>
      
      <div style={{ textAlign: 'center', margin: '20px' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="أضف سهم ترند جديد..." style={{ padding: '10px', color: '#000', width: '250px' }} />
        <button onClick={addStock} style={{ padding: '10px 20px', background: '#D4AF37', border: 'none', cursor: 'pointer', marginLeft: '10px', fontWeight: 'bold' }}>إضافة للمتابعة</button>
      </div>

      <div style={{ textAlign: 'center', margin: '15px', color: '#fff', border: '1px solid #D4AF37', padding: '10px' }}>
        الحالة: <strong>{status}</strong>
      </div>

      <div style={{ display: 'flex', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ flex: 1, border: '1px solid #D4AF37', padding: '15px' }}>
          <h3>📋 قائمة المتابعة ({watchlist.length})</h3>
          {watchlist.map(s => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px', borderBottom: '1px solid #333' }}>
              {s} <button onClick={() => removeStock(s)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
            </div>
          ))}
        </div>

        <div style={{ flex: 2, border: '1px solid #D4AF37', padding: '15px' }}>
          <button onClick={runScanner} style={{ background: '#FFD700', padding: '15px', width: '100%', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px' }}>بدء مسح السوق لرصد الانفجارات</button>
          <div style={{ marginTop: '20px' }}>
            {alerts.map((a, i) => <p key={i} style={{ color: '#fff', background: '#222', padding: '10px', borderLeft: '4px solid #FFD700' }}>{a.symbol}: {a.msg}</p>)}
          </div>
        </div>
      </div>
    </main>
  );
}
