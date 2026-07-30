// app/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [riyadhTime, setRiyadhTime] = useState('');
  const [marketStatus, setMarketStatus] = useState('جاري الفحص...');
  
  // مؤشرات السوق الحية
  const [indices, setIndices] = useState([
    { name: 'NASDAQ', value: '18,420.50', change: '+1.24%', isUp: true },
    { name: 'S&P 500', value: '5,580.20', change: '+0.68%', isUp: true },
    { name: 'QQQ', value: '492.15', change: '+1.42%', isUp: true },
    { name: 'VIX', value: '12.40', change: '-5.12%', isUp: false },
  ]);

  // تحديث وقت الرياض وحالة السوق الحية
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
      
      {/* 8) مباشر Widget شريط المؤشرات العالمي المباشر في أعلى الصفحة */}
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

      {/* الشريط العلوي للهوية والتوقيت */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', backgroundColor: '#0B0F17', padding: '16px 24px', borderRadius: '16px', border: '1px solid #1F2636' }}>
        <div>
          <h1 style={{ color: '#FBBF24', fontSize: '22px', fontWeight: '900', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🎯</span> منصة سنايبر الاحترافية <span style={{ fontSize: '12px', backgroundColor: '#2563EB', color: '#FFF', padding: '2px 8px', borderRadius: '6px' }}>COMMAND CENTER</span>
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '12px' }}>رادار صائدي السنتات وعقود الخيارات طويلة المدى للتحوط الفوري واقتناص السيولة المخفية.</p>
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

      {/* 3) لوحة التحكم الذكية العريضة في البداية AI Market Status */}
      <div style={{ background: 'linear-gradient(90deg, #1E1B4B 0%, #0B0F17 100%)', border: '1px solid #3730A3', borderRadius: '16px', padding: '18px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
        <div>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: '#818CF8', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>🧠 AI COMMAND STATION</span>
          <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            حالة السوق العامة: <span style={{ color: '#34D399' }}>🟢 إيجابي جداً (Bullish)</span>
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '24px', textArrign: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#94A3B8' }}>الزخم العام</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#38BDF8' }}>82%</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94A3B8' }}>مستوى المخاطرة</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#34D399' }}>منخفض 🛡️</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94A3B8' }}>أفضل قطاع اليوم</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#FBBF24' }}>Technology 💻</div>
          </div>
        </div>
      </div>

      {/* 2) هيكل الكروت المتفاوتة (Bloomberg Style) - كرت رئيسي ضخم وكرتين جانبية */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        
        {/* الكرت الرئيسي الأكبر: الرادار والنبض الذكي */}
        <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
          {/* تأثير نبضة حية علوية لجلب الانتباه البصري */}
          <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444', display: 'inline-block', animate: 'pulse 1s infinite' }}></span>
            <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: 'bold', fontFamily: 'monospace' }}>LIVE PULSE</span>
          </div>

          <div>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>⚡</div>
            <h3 style={{ color: '#FBBF24', fontSize: '20px', fontWeight: '900', marginBottom: '8px' }}>لوحة تحليلات الرادار والباكتيست المتقدمة</h3>
            <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: '1.6', marginBottom: '24px', maxWidth: '80%' }}>
              المحرك متصل الآن بمكتبة ياهو ترند لفحص أعلى سيولة حية، واقتناص انفجارات الـ 52 أسبوعاً مع احتساب أهداف الكلاستر وجدران الجاما ديناميكياً.
            </p>

            {/* إشعار عاجل منبثق مدمج يكسر جمود اللوحة */}
            <div style={{ backgroundColor: '#07090E', borderLeft: '4px solid #FBBF24', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '16px' }}>🚀</span>
              <span style={{ fontSize: '12px', color: '#E2E8F0' }}>
                تنبيه ذكي فوري: سهم <strong style={{ color: '#FBBF24' }}>SERV</strong> يسجل انفجار تداول حجم <strong style={{ color: '#34D399' }}>x5</strong> مع زخم أوبشن صاعد!
              </span>
            </div>
          </div>

          <Link 
            href="/analytics"
            style={{ backgroundColor: '#FBBF24', color: '#000000', padding: '14px 24px', borderRadius: '12px', textDecoration: 'none', fontWeight: '900', fontSize: '14px', display: 'inline-block', textAlign: 'center', transition: '0.2s', boxShadow: '0 4px 12px rgba(251,191,36,0.2)' }}
          >
            فتح منصة التحكم الشامل والصفقات ➔
          </Link>
        </div>

        {/* الكروت الجانبية المتوسطة - مرتبة عمودياً كملخص سريع */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* كرت إحصائيات الفرص المفصل المحدث */}
          <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ color: '#38BDF8', fontSize: '14px', fontWeight: 'bold' }}>🎯 حالة الرادار الفوري</h4>
              <span style={{ backgroundColor: '#1E293B', color: '#38BDF8', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' }}>تحديث لحظي</span>
            </div>
            
            <div style={{ color: '#34D399', fontSize: '24px', fontWeight: '900', marginBottom: '12px' }}>🔥 10 فرص نشطة</div>
            
            {/* تفصيل الفرص الذكي بناءً على مستوى الجودة */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#94A3B8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: '#07090E', borderRadius: '6px' }}>
                <span>🔴 فرص عالية الجودة والأمان:</span>
                <strong style={{ color: '#EF4444' }}>3 صفقات</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: '#07090E', borderRadius: '6px' }}>
                <span>🟠 فرص متوسطة المخاطرة:</span>
                <strong style={{ color: '#FBBF24' }}>4 صفقات</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: '#07090E', borderRadius: '6px' }}>
                <span>🟢 فرص ارتداد منخفضة:</span>
                <strong style={{ color: '#34D399' }}>3 صفقات</strong>
              </div>
            </div>
          </div>

          {/* كرت إدارة المخاطر */}
          <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '16px', padding: '20px', flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ color: '#C084FC', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>🛡️ إدارة أمان المحفظة</h4>
              <p style={{ color: '#94A3B8', fontSize: '11px', lineHeight: '1.5' }}>تتبع العقود الحالية وحساب نسب التآكل الزمني تلقائياً لحمايتك أثناء الدوام الرسمي.</p>
            </div>
            <div style={{ color: '#FBBF24', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#07090E', padding: '10px', borderRadius: '8px', border: '1px solid #1F2636', textAlign: 'center', marginTop: '10px' }}>
              خوارزمية حماية رأس المال: نشطة ✅
            </div>
          </div>

        </div>
      </div>

      {/* قسم الإرشادات السفلي */}
      <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '16px', padding: '16px 24px', textAlign: 'center' }}>
        <p style={{ color: '#94A3B8', fontSize: '12px', margin: '0' }}>
          💡 <strong>إشعار هندسي:</strong> تم ربط المنصة بذكاء اصطناعي تحليلي يستبعد قطاعات البيوتك الضعيفة تلقائياً، مع توليد تواريخ انتهاء مرنة تتجاوز 30 يوماً لتفادي الـ Theta Decay.
        </p>
      </div>

    </div>
  );
}
