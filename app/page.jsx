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
    <div className="min-h-screen bg-black text-green-500 font-mono p-4">
      <h1 className="text-center text-xl mb-6 border-b border-green-900 pb-2">غرفة العمليات - نظام السنايبر المطور</h1>

      {/* منطقة البحث والإضافة */}
      <div className="flex flex-col gap-2 mb-6 max-w-2xl mx-auto">
        <input 
          className="bg-black border border-green-700 p-2 text-white w-full"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          placeholder="ابحث عن سهم"
        />
        <button onClick={addSymbol} className="bg-green-700 text-black font-bold p-2 hover:bg-green-500">
          إضافة
        </button>
      </div>

      {/* الجدول الاحترافي */}
      <table className="w-full text-left border-collapse border border-green-900">
        <thead>
          <tr className="border-b border-green-900 text-green-600">
            <th className="p-3">السهم</th>
            <th className="p-3">السعر</th>
            <th className="p-3">حالة الدخول</th>
            <th className="p-3">التحليل الفني</th>
          </tr>
        </thead>
        <tbody>
          {symbols.map(symbol => (
            <tr key={symbol} className="border-b border-green-900 hover:bg-green-900/20">
              <td className="p-3 font-bold">{symbol}</td>
              <td className="p-3">{data[symbol]?.price ? data[symbol].price.toFixed(2) : '---'}</td>
              <td className={`p-3 font-bold ${data[symbol]?.isEntrySuitable ? 'text-red-500' : 'text-green-500'}`}>
                {data[symbol]?.isEntrySuitable ? 'انظر ❌' : 'مستقر ✅'}
              </td>
              <td className="p-3 text-green-700">عرض ❌</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
