'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [stocks, setStocks] = useState([]);

  useEffect(() => {
    fetch('/api/stocks')
      .then(res => res.json())
      .then(data => setStocks(data.data));
  }, []);

  return (
    <main style={{ padding: '40px', backgroundColor: '#111', color: '#fff', minHeight: '100vh' }}>
      <h1>TRADING RADAR PRO V2</h1>
      <div style={{ marginTop: '20px' }}>
        {stocks.map((stock: any) => (
          <div key={stock.symbol} style={{ padding: '10px', border: '1px solid #444', marginBottom: '10px' }}>
            {stock.symbol} - السعر: {stock.price} - الاتجاه: {stock.trend}
          </div>
        ))}
      </div>
    </main>
  );
}
