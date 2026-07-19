'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [symbols, setSymbols] = useState(['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI']);
  const [newSymbol, setNewSymbol] = useState('');
  const [details, setDetails] = useState({}); // لتخزين بيانات كل سهم عند الضغط

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

  const removeSymbol = (symbolToRemove) => {
    const updated = symbols.filter(s => s !== symbolToRemove);
    setSymbols(updated);
    localStorage.setItem('myStocks', JSON.stringify(updated));
  };

  // وظيفة جلب البيانات عند الضغط على عرض
  const fetchDetails = async (symbol) => {
    try {
      const res = await fetch(`/api/analyze?symbol=${symbol}`);
      const data = await res.json();
      setDetails(prev => ({ ...prev, [symbol]: data }));
    } catch (e) { alert("خطأ في جلب البيانات"); }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6" dir="rtl">
      <h1 className="text-center text-2xl font-bold mb-8">غرفة العمليات - نظام السنايبر</h1>

      <div className="flex gap-2 mb-8 justify-center">
        <input 
          className="bg-white text-black p-2 border border-gray-600"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          placeholder="رمز السهم"
        />
        <button onClick={addSymbol} className="bg-white text-black px-4 py-2 font-bold">إضافة</button>
      </div>

      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="border-b border-gray-600">
            <th className="p-3">السهم</th>
            <th className="p-3">السعر</th>
            <th className="p-3">الحالة</th>
            <th className="p-3">التحليل</th>
            <th className="p-3">تحكم</th>
          </tr>
        </thead>
        <tbody>
          {symbols.map(symbol => (
            <tr key={symbol} className="border-b border-gray-800">
              <td className="p-3 font-bold">{symbol}</td>
              <td className="p-3">{details[symbol]?.price ? details[symbol].price.toFixed(2) : '---'}</td>
              <td className="p-3">{details[symbol] ? (details[symbol].isEntrySuitable ? 'دخول ✅' : 'مستقر 🟢') : '---'}</td>
              <td className="p-3">
                <button onClick={() => fetchDetails(symbol)} className="bg-white text-black px-3 py-1 font-bold">عرض</button>
              </td>
              <td className="p-3">
                <button onClick={() => removeSymbol(symbol)} className="bg-red-600 text-white px-3 py-1 font-bold">حذف</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
