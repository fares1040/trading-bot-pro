"use client";
import { useState, useEffect } from 'react';

export default function Home() {
  const [stocks, setStocks] = useState([
    { symbol: 'NXTC', price: '6.58', color: 'text-green-500' },
    { symbol: 'FGIWW', price: '0.09', color: 'text-red-500' },
    { symbol: 'PTORW', price: '0.684', color: 'text-green-500' },
    { symbol: 'PRENW', price: '0.0159', color: 'text-yellow-500' },
    { symbol: 'BOSER', price: '0.04', color: 'text-green-500' }
  ]);

  // تحديث الأسعار تلقائياً كل 30 ثانية
  useEffect(() => {
    const interval = setInterval(() => {
      setStocks(prev => prev.map(s => ({
        ...s,
        price: (parseFloat(s.price) + (Math.random() - 0.5) * 0.01).toFixed(4)
      })));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="p-8 bg-black min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8 text-yellow-500">TRADING RADAR PRO ⚡</h1>
      
      {stocks.map((stock) => (
        <div key={stock.symbol} className="flex justify-between items-center border-b border-gray-800 py-4">
          <div>
            <p className="font-bold text-xl">{stock.symbol}</p>
            <p className={`${stock.color} font-mono`}>{stock.price} $</p>
          </div>
        </div>
      ))}
    </main>
  );
}
