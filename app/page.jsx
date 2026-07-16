'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState({ watchlist: [], alerts: [] });
  const [input, setInput] = useState("");

  const loadData = (symbols) => {
    fetch(`/api/stocks?symbols=${symbols}`).then(res => res.json()).then(setData);
  };

  return (
    <main className="p-8 max-w-4xl mx-auto bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-blue-400">📊 رادار الأسهم الذكي</h1>
      
      <div className="flex gap-2 mb-8">
        <input 
          className="p-2 rounded bg-gray-800 border border-gray-700 w-full"
          value={input} onChange={(e) => setInput(e.target.value)} placeholder="أضف رمز السهم (مثال: AAPL,TSLA)" 
        />
        <button className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-500" onClick={() => loadData(input)}>تحديث</button>
      </div>

      <section className="mb-10 p-6 bg-gray-800 rounded-xl border border-red-500">
        <h2 className="text-xl font-bold text-red-400 mb-4">🚀 فرص الانفجار (تنبيهات فورية)</h2>
        {data.alerts.length > 0 ? data.alerts.map((s, i) => (
          <div key={i} className="p-3 bg-red-900/30 rounded mb-2 border-l-4 border-red-500">
            ★ {s.symbol} اخترق المقاومة عند {s.price}$ - {s.reason}
          </div>
        )) : <p className="text-gray-400">لا توجد فرص انفجار حالياً.</p>}
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">📋 قائمة المتابعة</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead><tr className="border-b border-gray-700"><th className="p-2">الرمز</th><th className="p-2">السعر الحالي</th></tr></thead>
            <tbody>{data.watchlist.map((s, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-800">
                <td className="p-2 font-mono text-blue-300">{s.symbol}</td>
                <td className="p-2">{s.price}$</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
