'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [stocks, setStocks] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/stocks')
      .then(res => res.json())
      .then(data => setStocks(data.data));
  }, []);

  return (
    <main style={{ padding: '40px', backgroundColor: '#111', color: '#fff' }}>
      <h1>TRADING RADAR PRO V2</h1>
      {stocks.map((s, i) => (
        <div key={i} style={{ border: '1px solid #444', padding: '10px', margin: '5px' }}>
          {s.symbol}: {s.price} ({s.trend})
        </div>
      ))}
    </main>
  );
}
