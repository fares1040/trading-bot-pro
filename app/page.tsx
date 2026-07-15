'use client';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [stocks, setStocks] = useState([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [symbol, setSymbol] = useState('');

  useEffect(() => {
    // جلب بيانات الرادار (Top Gainers)
    fetch('/api/stocks')
      .then(res => res.json())
      .then(data => setStocks(data.data));

    // استرجاع القائمة المحفوظة
    const saved = localStorage.getItem('myWatchlist');
    if (saved) setWatchlist(JSON.parse(saved));
  }, []);

  const addToWatchlist = () => {
    if (symbol && !watchlist.includes(symbol)) {
      const newList = [...watchlist, symbol.toUpperCase()];
      setWatchlist(newList);
      localStorage.setItem('myWatchlist', JSON.stringify(newList));
      setSymbol('');
    }
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#0a0a0a', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ color: '#00ff9d', textAlign: 'center' }}>منصة التداول الذكية 🚀</h1>
      
      {/* خانة إضافة الأسهم */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <input 
          value={symbol} onChange={(e) => setSymbol(e.target.value)}
          placeholder="أضف سهم لقائمتك (مثال: NVDA)"
          style={{ padding: '10px', borderRadius: '5px', color: '#000', width: '200px' }}
        />
        <button onClick={addToWatchlist} style={{ marginLeft: '10px', padding: '10px 20px', backgroundColor: '#00ff9d', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
          إضافة
        </button>
      </div>

      {/* عرض القائمة */}
      <div style={{ marginBottom: '40px' }}>
        <h3>قائمتي الخاصة ({watchlist.length})</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          {watchlist.map(s => <span key={s} style={{ backgroundColor: '#333', padding: '5px 15px', borderRadius: '20px' }}>{s}</span>)}
        </div>
      </div>

      {/* الرادار */}
      <h3>أسهم الرادار (Top Gainers)</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#161616' }}>
        <thead><tr style={{ borderBottom: '1px solid #333' }}><th style={{ padding: '15px' }}>الرمز</th><th style={{ padding: '15px' }}>السعر</th><th style={{ padding: '15px' }}>التغير</th></tr></thead>
        <tbody>
          {stocks.map((stock: any) => (
            <tr key={stock.symbol} style={{ borderBottom: '1px solid #222' }}>
              <td style={{ padding: '15px', textAlign: 'center' }}>{stock.symbol}</td>
              <td style={{ padding: '15px', textAlign: 'center' }}>{stock.price} $</td>
              <td style={{ padding: '15px', textAlign: 'center', color: '#00ff9d' }}>{stock.change}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
