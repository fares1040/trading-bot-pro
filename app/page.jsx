'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [stocks, setStocks] = useState([]);

  useEffect(() => {
    fetch('/api/stocks')
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setStocks(data.data);
        }
      });
  }, []);

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Trading Radar</h1>
      <ul>
        {stocks.map((s, index) => (
          <li key={index}>
            {s.symbol}: {s.price} - {s.trend}
          </li>
        ))}
      </ul>
    </main>
  );
}
