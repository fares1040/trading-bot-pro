'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [symbols, setSymbols] = useState(['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI']);
  const [newSymbol, setNewSymbol] = useState('');
  const [data, setData] = useState({});

  useEffect(() => {
    const saved = localStorage.getItem('myStocks');
    if (saved) setSymbols(JSON.parse(saved));
  }, []);

  const addSymbol = () => {
    if (newSymbol && !symbols.includes(newSymbol.toUpperCase())) {
      const updated = [...symbols, newSymbol.toUpperCase()];
      setSymbols(updated);
      localStorage.setItem('myStocks', JSON.stringify(updated));
      setNewSymbol('');
    }
  };

  const fetchData = async () => {
    for (const symbol of symbols) {
      try {
        const res = await fetch(`/api/analyze?symbol=${symbol}`);
        const result = await res.json();
        setData(prev => ({ ...prev, [symbol]: result }));
      } catch (e) { console.error(e); }
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [symbols]);

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-4 md:p-6">
      <h1 className="text-center text-2xl font-bold mb-6 text-green-500 tracking-widest border-b border-green-900 pb-4">
        غرفة العمليات - نظام السنايبر المطور
      </h1>
      
      <div className="flex gap-2 mb-8 justify-center">
        <input 
          className="bg-black border border-green-600 p-2 text-green-500 focus:outline-none focus:border-green-400 w-48"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          placeholder="رمز السهم..."
        />
        <button 
          onClick={addSymbol} 
          className="bg-green-900 text-green-500 px-6 py-2 font-bold border border-green-600 hover:bg-green-600 hover:text-black transition-all"
        >
          إضافة
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-green-900 text-green-700">
              <th className="p-3">السهم</th>
              <th className="p-3">السعر</th>
              <th className="p-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {symbols.map(symbol => {
              const isEntry = data[symbol]?.isEntrySuitable;
              return (
                <tr 
                  key={symbol} 
                  className={`border-b border-green-900 transition-colors ${isEntry ? 'bg-red-900/20' : 'hover:bg-green-900/10'}`}
                >
                  <td className={`p-3 font-bold ${isEntry ? 'text-red-400' : 'text-green-500'}`}>{symbol}</td>
                  <td className="p-3 text-white">{data[symbol]?.price ? data[symbol].price.toFixed(2) : '---'}</td>
                  <td className={`p-3 font-bold ${isEntry ? 'text-red-500' : 'text-green-500'}`}>
                    {isEntry ? 'انظر 🎯' : 'مستقر 🟢'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
