"use client";
import { useState } from 'react';

export default function Home() {
  const [analysis, setAnalysis] = useState("اختر سهماً للبدء في التحليل الفني...");

  const stocks = [
    { symbol: 'NXTC', price: '6.58', color: 'text-green-500' },
    { symbol: 'FGIWW', price: '0.09', color: 'text-red-500' },
    { symbol: 'PTORW', price: '0.684', color: 'text-green-500' },
    { symbol: 'PRENW', price: '0.0159', color: 'text-yellow-500' },
    { symbol: 'BOSER', price: '0.04', color: 'text-green-500' }
  ];

  const analyzeStock = async (symbol: string) => {
    setAnalysis("جاري التحليل لـ " + symbol + "...");
    setTimeout(() => {
      setAnalysis(`تحليل ${symbol}: السهم في اتجاه إيجابي بناءً على مؤشرات السيولة.`);
    }, 1000);
  };

  return (
    <main className="p-8 bg-black min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8 text-yellow-500">TRADING RADAR PRO ⚡</h1>
      
      <div className="border border-yellow-500 p-4 mb-8 rounded">
        <p className="text-yellow-500 font-bold mb-2">(Gemini) المحلل الذكي</p>
        <p>{analysis}</p>
      </div>

      {stocks.map((stock) => (
        <div key={stock.symbol} className="flex justify-between items-center border-b border-gray-800 py-4">
          <div>
            <p className="font-bold text-xl">{stock.symbol}</p>
            <p className={`${stock.color} font-mono`}>{stock.price} $</p>
          </div>
          <button 
            onClick={() => analyzeStock(stock.symbol)}
            className="bg-yellow-500 text-black px-4 py-2 rounded font-bold hover:bg-yellow-400 transition"
          >
            تحليل تقني
          </button>
        </div>
      ))}
    </main>
  );
}
