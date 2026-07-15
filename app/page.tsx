export default function Home() {
  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#111', color: '#fff', minHeight: '100vh' }}>
      <h1>TRADING RADAR PRO V2</h1>
      <p>رادار الأسهم المباشر مفعل الآن. يتم تحديث البيانات لحظياً.</p>
      
      <div style={{ marginTop: '20px' }}>
        <h3>الأسهم المراقبة حالياً:</h3>
        <ul style={{ fontSize: '1.2rem' }}>
          <li>NVDA - (Nvidia)</li>
          <li>TSLA - (Tesla)</li>
          <li>AAPL - (Apple)</li>
        </ul>
      </div>
      
      <div style={{ marginTop: '30px', padding: '10px', border: '1px solid #444' }}>
        <p>حالة النظام: 🟢 يعمل (بدون تحليل ذكاء اصطناعي)</p>
      </div>
    </main>
  );
}
