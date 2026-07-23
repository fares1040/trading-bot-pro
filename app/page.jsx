'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function SniperDashboard() {
  const [symbol, setSymbol] = useState('SNDK');
  const [scalpMode, setScalpMode] = useState(false);
  const [minConfidence, setMinConfidence] = useState(85);
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [earlyAlertsEnabled, setEarlyAlertsEnabled] = useState(true);
  const [discordWebhook, setDiscordWebhook] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const scanIntervalRef = useRef(null);
  const audioRef = useRef(null);

  // تشغيل صوت التنبيه عند رصد فرصة ملكية
  const playAlertSound = () => {
    try {
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.log("Audio play blocked:", e));
      }
    } catch (err) {}
  };

  const handleAnalyze = async (targetSymbol = symbol) => {
    if (!targetSymbol) return;
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: targetSymbol,
          scalpMode,
          minConfidence,
          cooldownMinutes,
          earlyAlertsEnabled,
          discordWebhook
        })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        const timeStr = new Date().toLocaleTimeString('ar-SA');
        setLogs(prev => [`[${timeStr}] فحص السهم ${data.symbol}: ثقة ${data.confidenceScore}% (${data.isSuitable ? 'صيدة ملكية 🔥' : 'مراقبة 🛡️'})`, ...prev.slice(0, 19)]);
        
        if (data.isSuitable || data.isReversedMarket) {
          playAlertSound();
        }
      }
    } catch (error) {
      console.error("Analysis Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // الرادار الآلي الشامل لسحب الأسهم وفحصها تباعاً
  useEffect(() => {
    if (isAutoScanning) {
      scanIntervalRef.current = setInterval(async () => {
        try {
          const currentSymbols = result ? [result.symbol] : [];
          const scanRes = await fetch(`/api/analyze?scan=true&scalp=${scalpMode}&symbols=${currentSymbols.join(',')}`);
          const scanData = await scanRes.json();
          
          if (scanData.success && scanData.matched && scanData.matched.length > 0) {
            const nextSymbol = scanData.matched[Math.floor(Math.random() * scanData.matched.length)];
            setSymbol(nextSymbol);
            await handleAnalyze(nextSymbol);
          }
        } catch (e) {
          console.error("Auto scan error:", e);
        }
      }, 15000); // الفحص كل 15 ثانية
    } else {
      clearInterval(scanIntervalRef.current);
    }
    return () => clearInterval(scanIntervalRef.current);
  }, [isAutoScanning, scalpMode, result]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0b0e', color: '#e2e8f0', fontFamily: 'Tahoma, sans-serif', padding: '20px', direction: 'rtl' }}>
      {عنصر صوت التنبيه المخفي}
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />

      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* الهيدر الرئيسي */}
        <div style={{ background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)', padding: '20px', borderRadius: '16px', border: '1px solid #374151', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#f59e0b', fontWeight: 'bold' }}>⚡ منصة سنايبر الاستخباراتية (كابوس الحيتان) 🎯</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>نظام الرصد الذكي والصيد السيادي للأسواق المالية بدقة متناهية</p>
          </div>
          <button 
            onClick={() => setIsAutoScanning(!isAutoScanning)}
            style={{ padding: '12px 24px', background: isAutoScanning ? '#ef4444' : '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            {isAutoScanning ? '⏹️ إيقاف الرادار الآلي' : '🚀 تشغيل الرادار الآلي المستمر'}
          </button>
        </div>

        {/* لوحة التحكم والإعدادات */}
        <div style={{ background: '#111b22', padding: '18px', borderRadius: '14px', border: '1px solid #d4af37', marginBottom: '20px' }}>
          <h3 style={{ color: '#d4af37', fontSize: '13px', fontWeight: 'bold', margin: '0 0 12px 0' }}>⚙️ لوحة التحكم السيادي الملكي (المبد المفحون > 85%)</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>رمز السهم المستهدف:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={symbol} 
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="مثال: SNDK, AAPL"
                  style={{ flex: 1, padding: '10px', background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff', fontWeight: 'bold' }}
                />
                <button 
                  onClick={() => handleAnalyze(symbol)} 
                  disabled={loading}
                  style={{ padding: '10px 20px', background: '#d4af37', color: '#111', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {loading ? 'جاري الفحص...' : 'فحص فوري 🎯'}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>رابط ديسكورد (Webhook):</label>
              <input 
                type="text" 
                value={discordWebhook} 
                onChange={(e) => setDiscordWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                style={{ width: '100%', padding: '10px', background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginTop: '15px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #1f2937', paddingTop: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input type="checkbox" checked={scalpMode} onChange={(e) => setScalpMode(e.target.checked)} style={{ width: '16px', height: '16px' }} />
              وضع السكالبينج اللحظي ⚡
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input type="checkbox" checked={earlyAlertsEnabled} onChange={(e) => setEarlyAlertsEnabled(e.target.checked)} style={{ width: '16px', height: '16px' }} />
              تفعيل التنبيهات الاستباقية المبكرة ⏳
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span>الحد الأدنى للثقة:</span>
              <input 
                type="number" 
                value={minConfidence} 
                onChange={(e) => setMinConfidence(Number(e.target.value))} 
                style={{ width: '60px', padding: '4px', background: '#1f2937', border: '1px solid #374151', color: '#fff', textAlign: 'center', borderRadius: '6px' }}
              />
              <span>%</span>
            </div>
          </div>
        </div>

        {/* نتيجة التحليل والتقرير */}
        {result && (
          <div style={{ background: '#111b22', padding: '20px', borderRadius: '14px', border: '1px solid #374151', marginBottom: '20px', boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}>
            <h3 style={{ color: '#10b981', margin: '0 0 15px 0', fontSize: '16px' }}>📊 تقرير الصيد السيادي للسهم: {result.symbol}</h3>
            <pre style={{ background: '#0a0b0e', padding: '15px', borderRadius: '10px', color: '#38bdf8', whiteSpace: 'pre-wrap', fontFamily: 'Tahoma, sans-serif', fontSize: '13px', lineHeight: '1.6', border: '1px solid #1f2937', margin: 0 }}>
              {result.analysis}
            </pre>
          </div>
        )}

        {/* سجل العمليات الحية */}
        <div style={{ background: '#111b22', padding: '15px', borderRadius: '14px', border: '1px solid #374151' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#9ca3af' }}>📜 سجل الرصد والعمليات الحية في الخلفية:</h4>
          <div style={{ background: '#0a0b0e', padding: '10px', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto', fontSize: '12px', color: '#94a3b8', border: '1px solid #1f2937' }}>
            {logs.length === 0 ? <div>الرجل الآلي في انتظار التشغيل...</div> : logs.map((log, index) => (
              <div key={index} style={{ marginBottom: '4px', borderBottom: '1px solid #111', paddingBottom: '2px' }}>{log}</div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
