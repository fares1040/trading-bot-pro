'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState({ watchlist: [], alerts: [] });
  const [input, setInput] = useState("");
  const defaultSymbols = 'PPSI,ANVS,BYRN,KULR,HURA,BJDX,OPI,MRAM,SPSC,PODC,NOK,ERNA,PRFX,VMAR,CETX,GSIT';

  const loadData = async (symbols) => {
    localStorage.setItem('myStocks', symbols);
    const res = await fetch(`/api/stocks?symbols=${symbols}`);
    const json = await res.json();
    setData(json);
  };

  useEffect(() => {
    const saved = localStorage.getItem('myStocks') || defaultSymbols;
    loadData(saved);
  }, []);

  return (
    <main className="p-8 max-w-4xl mx-auto bg-black text-yellow-500 min-h-screen font-sans">
      <h1 className="text-4xl font-bold mb-8 text-center text-yellow-600 border-b-2 border-yellow-700 pb-4">
        📊 رادار الأسهم الذهبي
      </h1>
      
      <div className="flex gap-2 mb-10">
        <input 
          className="p-3 rounded bg-gray-900 border border-yellow-700 text-yellow-100 w-full focus:outline-none focus:border-yellow-500"
          value={input} onChange={(e) => setInput(e.target.value)} placeholder="أضف رموز الأسهم (مثال: AAPL,TSLA)" 
        />
        <button className="bg-yellow-600 text-black px-6 py-2 rounded font-bold hover:bg-yellow-500 transition" onClick={() => loadData(input)}>تحديث</button>
      </div>

      <section className="mb-10 p-6 bg-gray-900 rounded-xl border border-yellow-600 shadow-[0_0_15px_rgba(202,138,4,0.3)]">
        <h2 className="text-xl font-bold text-yellow-400 mb-4 uppercase tracking-widest">🚀 فرص الانفجار الذهبية</h2>
        {data.alerts.length > 0 ? data.alerts.map((s, i) => (
          <div key={i} className="p-4 bg-black rounded mb-2 border-l-4 border-yellow-500 font-bold text-yellow-100">
            ★ {s.symbol} اخترق المقاومة عند {s.price}$ - {s.reason}
          </div>
        )) : <p className="text-yellow-800">لا توجد فرص انفجار حالياً.</p>}
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4 text-yellow-600 border-l-4 border-yellow-600 pl-3">📋 قائمة المتابعة</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-yellow-800 text-yellow-700">
                <th className="p-3">الرمز</th>
                <th className="p-3">السعر الحالي</th>
              </tr>
            </thead>
            <tbody>{data.watchlist.map((s, i) => (
              <tr key={i} className="border-b border-gray-900 hover:bg-yellow-950/20">
                <td className="p-3 font-mono text-yellow-300 font-bold">{s.symbol}</td>
                <td className="p-3 text-yellow-100">{s.price}$</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
