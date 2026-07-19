'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState({});
  const symbols = ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI'];

  const fetchData = async () => {
    // جلب البيانات لكل سهم
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
    const interval = setInterval(fetchData, 10000); // تحديث كل 10 ثواني
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 bg-black text-green-500 font-mono">
      <h1 className="text-center text-xl mb-4">غرفة العمليات - نظام السنايبر المطور</h1>
      <table className="w-full text-left">
        <thead>
          <tr><th>السهم</th><th>السعر</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          {symbols.map(symbol => (
            <tr key={symbol}>
              <td>{symbol}</td>
              <td>{data[symbol]?.price ? data[symbol].price.toFixed(2) : '---'}</td>
              <td className={data[symbol]?.isEntrySuitable ? 'text-red-500' : 'text-green-500'}>
                {data[symbol]?.isEntrySuitable ? 'انظر' : 'مستقر'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
