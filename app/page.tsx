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
    const res = await fetch('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    });
    const data = await res.json();
    setAnalysis(data.analysis);
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#0a0a0a', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ color: '#00ff9d', textAlign: 'center' }}>منصة التداول الذكية 🚀</h1>
      
      {analysis && (
        <div style={{ backgroundColor: '#222', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #00ff9d' }}>
          <strong>تحليل Gemini:</strong> <p>{analysis}</p>
          <button onClick={() => setAnalysis('')}>إغلاق</button>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead><tr style={{ borderBottom: '1px solid #333' }}><th>الرمز</th><th>السعر</th><th>التحليل</th></tr></thead>
        <tbody>
          {stocks.map((stock: any) => (
            <tr key={stock.symbol} style={{ borderBottom: '1px solid #222' }}>
              <td style={{ padding: '10px' }}>{stock.symbol}</td>
              <td style={{ padding: '10px' }}>{stock.price} $</td>
              <td style={{ padding: '10px' }}>
                <button onClick={() => analyzeStock(stock.symbol)} style={{ backgroundColor: '#0070f3', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                  {loading ? '...' : 'تحليل AI'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
