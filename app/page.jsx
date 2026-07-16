'use client';
import { useState } from 'react';

export default function Home() {
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('جاهز للعمل - بانتظار أمرك');

  const runScanner = async () => {
    setStatus('جاري مسح السوق...');
    try {
      const response = await fetch('/api/stocks');
      const data = await response.json();
      
      if (data.error) {
        setStatus('خطأ: ' + data.error);
      } else {
        setStatus('تم المسح! الفرص الموجودة: ' + (data.alerts ? data.alerts.length : 0));
        setAlerts(data.alerts || []);
      }
    } catch (e) {
      setStatus('حدث خطأ في الاتصال');
    }
  };

  return (
    <main style={{ padding: '20px', backgroundColor: '#000', color: '#fff', minHeight: '100vh' }}>
      <h1>نظام السنايبر للترندات 🚀</h1>
      <button onClick={runScanner} style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#ffd700' }}>
        بدء مسح السوق لرصد الانفجارات
      </button>
      <p>الحالة: {status}</p>
      <ul>
        {alerts.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </main>
  );
}
