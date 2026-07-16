'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState({ alerts: [] });
  const loadData = async (symbols) => {
    const res = await fetch(`/api/stocks?symbols=${symbols}`);
    const json = await res.json();
    setData(json);
  };
  
  useEffect(() => { loadData('PPSI,ANVS,BYRN,KULR,HURA,BJDX,OPI,MRAM,SPSC,PODC,NOK,ERNA,PRFX,VMAR,CETX,GSIT'); }, []);

  return (
    <main className="p-8 bg-black min-h-screen text-yellow-500 font-sans">
      <h1 className="text-4xl font-bold text-yellow-500 border-b-2 border-yellow-600 pb-4 mb-8">📊 رادار الأسهم الذهبي</h1>
      <div className="grid gap-4">
        {data.alerts.length > 0 ? data.alerts.map((s, i) => (
          <div key={i} className={`p-6 border-l-4 ${s.msg.includes('خطر') ? 'border-red-600 bg-gray-900' : 'border-yellow-500 bg-gray-900'} rounded shadow-lg`}>
            <span className="text-2xl font-bold text-yellow-400 block mb-2">{s.symbol}</span>
            <span className={`text-lg font-bold ${s.msg.includes('خطر') ? 'text-red-500' : 'text-yellow-100'}`}>{s.msg}</span>
          </div>
        )) : <p className="text-yellow-700 italic">جاري مراقبة السوق... لا توجد تنبيهات حالياً.</p>}
      </div>
    </main>
  );
}
