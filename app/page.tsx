'use client';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [stocks, setStocks] = useState([]);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/stocks').then(res => res.json()).then(data => setStocks(data.data));
  }, []);

  const analyzeStock = async (symbol: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (e) {
      setAnalysis("خطأ في الاتصال بالمحلل");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#0a0a0a', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center' }}>منصة التداول الذكية 🚀</h1>
      {analysis && (
        <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #00ff9d', marginBottom: '20px' }}>
          <strong>تحليل AI:</strong> <p>{analysis}</p>
          <button onClick={() => setAnalysis('')}>إغلاق</button>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {stocks.map((s: any) => (
            <tr key={s.symbol} style={{ borderBottom: '1px solid #333' }}>
              <td style={{ padding: '10px' }}>{s.symbol}</td>
              <td style={{ padding: '10px' }}>{s.price} $</td>
              <td style={{ padding: '10px' }}>
                <button onClick={() => analyzeStock(s.symbol)} style={{ backgroundColor: '#0070f3', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                  {loading ? '...' : 'تحليل'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
