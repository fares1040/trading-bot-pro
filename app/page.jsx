'use client';
import { useState } from 'react';

export default function Home() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stocks');
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: 'حدث خطأ في الاتصال' });
    }
    setLoading(false);
  };

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>نظام رادار الأسهم 🚀</h1>
      <button onClick={fetchStocks} disabled={loading}>
        {loading ? 'جاري المسح...' : 'بدء مسح السوق'}
      </button>
      <pre style={{ marginTop: '20px', background: '#f4f4f4', padding: '15px' }}>
        {JSON.stringify(result, null, 2)}
      </pre>
    </main>
  );
}
