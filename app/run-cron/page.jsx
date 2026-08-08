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
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult('حدث خطأ: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#07090E', color: '#FFF', minHeight: '100vh', direction: 'rtl', fontFamily: 'sans-serif' }}>
      <h1>🛠️ لوحة اختبار الـ Cron يدوياً</h1>
      <p>اضغط على الزر أدناه لاختبار مسار الـ API ورؤية النتيجة:</p>
      <button 
        onClick={runTest}
        disabled={loading}
        style={{ padding: '12px 24px', backgroundColor: '#FBBF24', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
      >
        {loading ? 'جاري التنفيذ...' : 'تشغيل الفحص الآن'}
      </button>
      <pre style={{ background: '#0B0F17', padding: '20px', borderRadius: '8px', marginTop: '20px', border: '1px solid #1F2636', whiteSpace: 'pre-wrap' }}>
        {result}
      </pre>
    </div>
  );
}
