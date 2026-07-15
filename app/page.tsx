"use client";
import { useState, useEffect } from 'react';

export default function Home() {
  const [stocks, setStocks] = useState([
    { symbol: 'NXTC', price: 'Loading...' },
    { symbol: 'FGIWW', price: 'Loading...' },
    { symbol: 'PTORW', price: 'Loading...' }
  ]);

  // دالة لجلب السعر المباشر (سنربطها لاحقاً بـ API حقيقي)
  useEffect(() => {
    const fetchPrices = async () => {
      // هنا يمكنك ربط API مثل Yahoo Finance
      const updatedStocks = stocks.map(s => ({
        ...s,
        price: (Math.random() * 10).toFixed(2) + " $" // محاكاة للسعر المباشر
      }));
      setStocks(updatedStocks);
    };

    const interval = setInterval(fetchPrices, 5000); // تحديث كل 5 ثواني
    fetchPrices();
    return () => clearInterval(interval);
  }, []);

  return (
    <main style={{ backgroundColor: '#0A0A0A', color: '#fff', padding: '20px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#FFD700', marginBottom: '20px' }}>⚡ TRADING RADAR PRO</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
        {stocks.map(stock => (
          <div key={stock.symbol} style={{ border: '1px solid #333', padding: '15px', borderRadius: '10px', backgroundColor: '#161616' }}>
            <h2 style={{ fontSize: '20px', margin: '0 0 10px 0' }}>{stock.symbol}</h2>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#00FF00' }}>{stock.price}</p>
            <button style={{ width: '100%', padding: '8px', marginTop: '10px', backgroundColor: '#FFD700', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
              تحليل
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
