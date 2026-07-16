'use client';

import React, { useState } from 'react';

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
        const foundAlerts = data.alerts || [];
        setStatus('تم المسح! الفرص الموجودة: ' + foundAlerts.length);
        setAlerts(foundAlerts);
      }
    } catch (e) {
      setStatus('حدث خطأ في الاتصال بالسيرفر');
    }
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#000', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: '#ffd700', marginBottom: '30px' }}>🚀 نظام السنايبر للترندات</h1>
        
        <button 
          onClick={runScanner} 
          style={{ 
            padding: '15px 30px', 
            fontSize: '18px', 
            fontWeight: 'bold', 
            cursor: 'pointer', 
            backgroundColor: '#ffd700', 
            color: '#000',
            border: 'none',
            borderRadius: '5px',
            width: '100%',
            marginBottom: '20px'
          }}
        >
          بدء مسح السوق لرصد الانفجارات
        </button>

        <div style={{ padding: '15px', backgroundColor: '#111', borderRadius: '5px', border: '1px solid #333', marginBottom: '25px' }}>
          <strong>الحالة:</strong> <span style={{ color: '#ffd700' }}>{status}</span>
        </div>

        <div style={{ textAlign: 'right' }}>
          <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '10px' }}>قائمة الفرص المرصودة:</h3>
          {alerts.length === 0 ? (
            <p style={{ color: '#888' }}>لا توجد فرص حالياً. اضغط على الزر أعلاه للبدء.</p>
          ) : (
            <ul style={{ listStyleType: 'square', paddingRight: '20px' }}>
              {alerts.map((symbol, index) => (
                <li key={index} style={{ fontSize: '18px', color: '#ffd700', marginBottom: '8px' }}>
                  🔥 تم رصد انفجار في سهم: <strong>{symbol}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
