export default function Page() {
  return (
    <div style={{
      backgroundColor: '#0a0a0a',
      color: '#ffffff',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', sans-serif",
      textAlign: 'center',
      padding: '20px'
    }}>
      <div style={{
        padding: '40px',
        borderRadius: '20px',
        backgroundColor: '#161616',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        border: '1px solid #333'
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', color: '#00ff9d' }}>
          Trading Bot Pro 🚀
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#a0a0a0', marginBottom: '30px' }}>
          نظام رصد الانفجارات السعرية نشط الآن
        </p>
        <div style={{
          display: 'inline-block',
          padding: '10px 20px',
          borderRadius: '50px',
          backgroundColor: '#00ff9d',
          color: '#000',
          fontWeight: 'bold'
        }}>
          ● جاري الرصد في الوقت الفعلي
        </div>
      </div>
      <p style={{ marginTop: '30px', fontSize: '0.9rem', color: '#555' }}>
        مربوط بنجاح مع Telegram API
      </p>
    </div>
  );
}
