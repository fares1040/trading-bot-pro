'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState({ watchlist: [], alerts: [] });
  const [input, setInput] = useState("");

  const loadData = (symbols) => {
    fetch(`/api/stocks?symbols=${symbols}`).then(res => res.json()).then(setData);
  };

  useEffect(() => { loadData('PPSI,ANVS,BYRN,KULR,HURA,BJDX,OPI,MRAM,SPSC,PODC,NOK,ERNA,PRFX,VMAR,CETX,GSIT'); }, []);

  return (
    <main style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h1>📊 رادار الأسهم</h1>
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="أضف سهم (مثال: AAPL)" />
      <button onClick={() => loadData(input)}>تحديث/إضافة</button>

      <section>
        <h2>🚀 أسهم الانفجار</h2>
        {data.alerts.length > 0 ? data.alerts.map((s, i) => <div key={i} style={{color: 'red'}}>★ {s.symbol} انفجر عند {s.price}$</div>) : <p>لا يوجد حالياً.</p>}
      </section>

      <section>
        <h2>📋 قائمة المتابعة</h2>
        <table border="1" style={{width: '100%'}}>
          <thead><tr><th>الرمز</th><th>السعر</th></tr></thead>
          <tbody>{data.watchlist.map((s, i) => <tr key={i}><td>{s.symbol}</td><td>{s.price}</td></tr>)}</tbody>
        </table>
      </section>
    </main>
  );
}
