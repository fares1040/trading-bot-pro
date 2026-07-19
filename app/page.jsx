'use client';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Home() {
  const symbols = ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI'];
  
  // دمج التوازي: جلب بيانات كل الأسهم في الخلفية
  const { data } = useSWR('/api/stocks-all', fetcher, { refreshInterval: 5000 });

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
              <td>{data?.[symbol]?.price || '---'}</td>
              <td className={data?.[symbol]?.isEntrySuitable ? 'text-red-500' : 'text-green-500'}>
                {data?.[symbol]?.isEntrySuitable ? 'انظر' : 'مستقر'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
