'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState("جاري التحميل...");

  useEffect(() => {
    fetch('/api/stocks')
      .then(res => res.json())
      .then(json => setData(JSON.stringify(json, null, 2)))
      .catch(err => setData("خطأ: " + err));
  }, []);

  return (
    <pre>{data}</pre>
  );
}
