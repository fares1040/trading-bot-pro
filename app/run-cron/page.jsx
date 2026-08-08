'use client';
import { useState } from 'react';

export default function RunCronPage() {
  const [result, setResult] = useState('اضغط الزر لبدء تشغيل الفحص يدوياً');
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    setResult('جاري الفحص...');
    try {
      const res = await fetch('/api/cron');
      // قراءة الاستجابة كنص ثم تحويلها لضمان التعامل الصحيح مع الترميز
      const text = await res.text();
      const data = JSON.parse(text);
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult('حدث خطأ أثناء الاتصال بالرادار: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#07090E', color: '#FFF', minHeight: '100vh', direction: 'rtl', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#FBBF24' }}>🛠️ لوحة تحكم الرادار اليدوية</h1>
      <p>هذه اللوحة تتيح لك تشغيل فحص السوق يدوياً في أي وقت:</p>
      
      <button 
        onClick={runTest}
        disabled={loading}
        style={{ 
          padding: '12px 24px', 
          backgroundColor: loading ? '#666' : '#FBBF24', 
          color: '#000', 
          border: 'none', 
          borderRadius: '8px', 
          fontWeight: 'bold', 
          cursor: loading ? 'not-allowed' : 'pointer', 
          marginTop: '10px',
          fontSize: '16px'
        }}
      >
        {loading ? 'جاري الفحص، يرجى الانتظار...' : 'تشغيل فحص السوق الآن'}
      </button>

      <div style={{ marginTop: '30px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>سجل النتائج:</h2>
        <pre style={{ 
          background: '#0B0F17', 
          padding: '20px', 
          borderRadius: '8px', 
          border: '1px solid #1F2636', 
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          fontSize: '14px',
          lineHeight: '1.6'
        }}>
          {result}
        </pre>
      </div>
    </div>
  );
}
