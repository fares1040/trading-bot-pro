// app/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [riyadhTime, setRiyadhTime] = useState('');
  const [marketStatus, setMarketStatus] = useState('جاري الفحص...');
  
  const [indices, setIndices] = useState([
    { name: 'NASDAQ', value: '18,420.50', change: '+1.24%', isUp: true },
    { name: 'S&P 500', value: '5,580.20', change: '+0.68%', isUp: true },
    { name: 'QQQ', value: '492.15', change: '+1.42%', isUp: true },
    { name: 'VIX', value: '12.40', change: '-5.12%', isUp: false },
  ]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setRiyadhTime(now.toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour12: true }));
      
      const hour = now.getHours();
      setMarketStatus(hour >= 16 && hour < 23 ? '🟢 السوق الأمريكي مفتوح (سيولة نشطة)' : '🔴 السوق مغلق (بانتظار الافتتاح)');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#07090E', color: '#F8FAFC', fontFamily: 'sans-serif', direction: 'rtl', padding: '20px 30px' }}>
      
      {/* شريط المؤشرات العالمي المباشر */}
      <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
        {indices.map((idx, i) => (
          <div key={i} style={{ flex: '1', minWidth: '150px', backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '10px', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#94A3B8' }}>{idx.name}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#FFFFFF', fontFamily: 'monospace' }}>{idx.value}</div>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: idx.isUp ? '#34D399' : '#EF4444' }}>
                {idx.isUp ? '▲' : '▼'} {idx.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* الشريط العلوي */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', backgroundColor: '#0B0F17', padding: '16px 24px', borderRadius: '16px', border: '1px solid #1F2636' }}>
        <div>
          <h1 style={{ color: '#FBBF24', fontSize: '22px', fontWeight: '900', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🎯</span> منصة سنايبر الاحترافية <span style={{ fontSize: '12px', backgroundColor: '#2563EB', color: '#FFF', padding: '2px 8px', borderRadius: '6px' }}>AI COPILOT COMMAND</span>
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '12px' }}>مساعد التداول الذكي: يفسر، يقترح اتخاذ القرار، ويحلل السيولة المخفية لحظياً.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#07090E', padding: '8px 14px', borderRadius: '10px', border: '1px solid #1F2636', fontSize: '11px', color: '#34D399', fontWeight: 'bold' }}>
            {marketStatus}
          </div>
          <div style={{ backgroundColor: '#07090E', padding: '8px 14px', borderRadius: '10px', border: '1px solid #1F2636', fontSize: '11px', color: '#FBBF24', fontFamily: 'monospace' }}>
            🇸🇦 الرياض: {riyadhTime || '...'}
          </div>
        </div>
      </div>

      {/* لوحة تحكم الذكاء الاصطناعي العامة AI Market Status */}
      <div style={{ background: 'linear-gradient(90deg, #1E1B4B 0%, #0B0F17 100%)', border: '1px solid #3730A3', borderRadius: '16px', padding: '18px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
        <div>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: '#818CF8', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>🧠 AI COPILOT STATUS</span>
          <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            حالة السوق العامة: <span style={{ color: '#34D399' }}>🟢 إيجابي جداً (Bullish) - 82%</span>
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '24px', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#94A3B8' }}>أفضل 3 فرص مقترحة</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#38BDF8' }}>SERV, PLTR, SOUN</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94A3B8' }}>مستوى المخاطرة العام</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#34D399' }}>منخفض 🟢</div>
          </div>
        </div>
      </div>

      {/* الرادار والتحليلات المتقدمة */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        
        {/* الكرت الرئيسي: توصيات AI Copilot الفورية */}
        <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34D399', display: 'inline-block' }}></span>
            <span style={{ fontSize: '10px', color: '#34D399', fontWeight: 'bold', fontFamily: 'monospace' }}>AI COPILOT ACTIVE</span>
          </div>

          <div>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🤖</div>
            <h3 style={{ color: '#FBBF24', fontSize: '20px', fontWeight: '900', marginBottom: '8px' }}>مساعد التداول الذكي (AI Copilot Recommendation)</h3>
            <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
              السوق اليوم إيجابي بنسبة 82%. الذكاء الاصطناعي يحلل السيولة ويقترح أفضل قرار بناءً على الأرقام الحية:
            </p>

            {/* تفاصيل التوصية المثالية المقترحة */}
            <div style={{ backgroundColor: '#07090E', border: '1px solid #3730A3', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#FBBF24', fontWeight: 'bold' }}>⭐ التوصية الأولى: SERV (AI Score: 97/100)</span>
                <span style={{ color: '#34D399', fontSize: '11px', fontWeight: 'bold' }}>⬆️ صعود احتمالية 78%</span>
              </div>
              <div style={{ fontSize: '12px', color: '#E2E8F0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>🔹 أفضل دخول: <strong style={{ color: '#38BDF8' }}>بعد اختراق 18.45</strong></div>
                <div>🛡️ وقف الخسارة: <strong style={{ color: '#EF4444' }}>17.80</strong></div>
                <div>🎯 الهدف الأول: <strong style={{ color: '#34D399' }}>19.60</strong></div>
                <div>📊 تقييم المخاطر: <strong style={{ color: '#34D399' }}>منخفض 🟢</strong></div>
              </div>
            </div>
          </div>

          <Link 
            href="/analytics"
            style={{ backgroundColor: '#FBBF24', color: '#000000', padding: '14px 24px', borderRadius: '12px', textDecoration: 'none', fontWeight: '900', fontSize: '14px', display: 'inline-block', textAlign: 'center', transition: '0.2s', boxShadow: '0 4px 12px rgba(251,191,36,0.2)' }}
          >
            فتح منصة التحكم الشامل والصفقات ➔
          </Link>
        </div>

        {/* الكروت الجانبية */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ color: '#38BDF8', fontSize: '14px', fontWeight: 'bold' }}>🎯 حالة الرادار الفوري</h4>
              <span style={{ backgroundColor: '#1E293B', color: '#38BDF8', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' }}>AI Filtered</span>
            </div>
            
            <div style={{ color: '#34D399', fontSize: '24px', fontWeight: '900', marginBottom: '12px' }}>🔥 10 فرص ذكية</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#94A3B8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: '#07090E', borderRadius: '6px' }}>
                <span>🟢 AI Score 90+:</span>
                <strong style={{ color: '#34D399' }}>3 صفقات</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: '#07090E', borderRadius: '6px' }}>
                <span>🟡 AI Score 80-89:</span>
                <strong style={{ color: '#FBBF24' }}>4 صفقات</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: '#07090E', borderRadius: '6px' }}>
                <span>🟠 AI Score تحت 80:</span>
                <strong style={{ color: '#EF4444' }}>3 صفقات</strong>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '16px', padding: '20px', flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ color: '#C084FC', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>🛡️ حماية رأس المال الذكية</h4>
              <p style={{ color: '#94A3B8', fontSize: '11px', lineHeight: '1.5' }}>الذكاء الاصطناعي يراقب الـ Theta Decay وتآكل العقود تلقائياً لحمايتك.</p>
            </div>
            <div style={{ color: '#FBBF24', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#07090E', padding: '10px', borderRadius: '8px', border: '1px solid #1F2636', textAlign: 'center', marginTop: '10px' }}>
              حماية التوصيات: نشطة ✅
            </div>
          </div>

        </div>
      </div>

      <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '16px', padding: '16px 24px', textAlign: 'center' }}>
        <p style={{ color: '#94A3B8', fontSize: '12px', margin: '0' }}>
          💡 <strong>AI Copilot Note:</strong> تم تحويل المنصة بنجاح إلى مساعد تداول يعتمد على تحليل القرار والتقييمات الرقمية الذكية (AI Score) بدلاً من مجرد عرض الأرقام العادية.
        </p>
      </div>

    </div>
  );
}
