'use client';
export default function Home() {
  const testConnection = async () => {
    try {
      const res = await fetch('/api/stocks');
      const data = await res.json();
      alert('النتيجة: ' + JSON.stringify(data));
    } catch (error) {
      alert('خطأ في الاتصال: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>نظام السنايبر</h1>
      <button onClick={testConnection} style={{ padding: '10px 20px', cursor: 'pointer' }}>
        Test Connection
      </button>
    </div>
  );
}
