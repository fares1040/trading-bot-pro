// app/analytics/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('radar');
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riyadhTime, setRiyadhTime] = useState('');
  const [selectedStock, setSelectedStock] = useState(null);

  const getFlexibleExpiryDate = (daysAhead = 45) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setRiyadhTime(now.toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchLiveAnalytics = async () => {
      try {
        const dynamicExpiry = getFlexibleExpiryDate(45);
        
        // بيانات تحليلية متكاملة لـ Trading Copilot (أقل من 100$)
        const allStocks = [
          { 
            ticker: 'SERV', icon: '⚡', sector: 'تكنولوجيا', price: 31.20, ai_score: '97/100', risk: 'منخفض (Low)', momentum: 97, volume: 95, breakout: 99, target_price: '45.00', stop_loss: '28.50',
            option_idea: `عقد Call سترايك 32$ (${dynamicExpiry})`,
            reasons: ['السعر فوق MA50 و MA200', 'حجم التداول Volume +320%', 'اختراق ناجح لمقاومة سابقة', 'مؤشر RSI عند 61 (منطقة زخم صحية)', 'Float منخفض وسيولة ذكية متدفقة'],
            ai_comment: 'السهم ما زال في بداية الترند الصاعد، لم يصل لمرحلة التشبع الشرائي، ولا توجد مقاومات قريبة تعيق الانفجار السعري.',
            indicators: { rsi: 61, ma20: '29.40', ma50: '27.10', atr: '1.85', cluster: 'قوي جداً عند 30.50' }
          },
          { 
            ticker: 'NIO', icon: '🚙', sector: 'سيارات كهربائية', price: 4.75, ai_score: '91/100', risk: 'متوسط (Medium)', momentum: 88, volume: 82, breakout: 85, target_price: '6.50', stop_loss: '4.20',
            option_idea: `عقد Call سترايك 5$ (${dynamicExpiry})`,
            reasons: ['ارتداد قوي من مناطق الطلب', 'Volume عالي نسبياً', 'تقاطع إيجابي لمؤشرات العزم'],
            ai_comment: 'فرصة مضاربية ممتازة على أسهم السنتات مع عائد محتمل مرتفع.',
            indicators: { rsi: 54, ma20: '4.50', ma50: '4.30', atr: '0.35', cluster: 'دعم صلب عند 4.60' }
          },
          { 
            ticker: 'PLTR', icon: '🤖', sector: 'ذكاء اصطناعي', price: 43.25, ai_score: '94/100', risk: 'منخفض (Low)', momentum: 92, volume: 90, breakout: 94, target_price: '52.00', stop_loss: '39.80',
            option_idea: `عقد Call سترايك 45$ (${dynamicExpiry})`,
            reasons: ['دخول مؤسسي ضخم (Whale Flow)', 'استقرار فوق المتوسطات المتحركة', 'اختراق قمة تاريخية جديدة'],
            ai_comment: 'السهم يتداول بسيولة مؤسسية عالية، والزخم يشير لاستمرار الصمود فوق الدعم الرئيسي.',
            indicators: { rsi: 68, ma20: '41.20', ma50: '38.50', atr: '2.10', cluster: 'منطقة سيولة عالية عند 42.00' }
          }
        ].filter(item => item.price < 100);

        setOpportunities(allStocks);
      } catch (err) {
        console.error('Live Sync Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveAnalytics();
  }, []);

  const renderProgressBar = (val, color = '#34D399') => {
    const filled = Math.round(val / 10);
    const empty = 10 - filled;
    return (
      <div style={{ fontFamily: 'monospace', fontSize: '11px', color: color }}>
        {'█'.repeat(filled) + '░'.repeat(empty)} <span style={{ color: '#FFF', fontWeight: 'bold' }}>{val}%</span>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#07090E', color: '#F8FAFC', fontFamily: 'sans-serif', direction: 'rtl', padding: '30px' }}>
      
      {/* الشريط العلوي */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', backgroundColor: '#0B0F17', padding: '16px 24px', borderRadius: '16px', border: '1px solid #1F2636', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ color: '#FBBF24', fontSize: '16px', fontWeight: '900', marginBottom: '4px' }}>⚡ Trading Copilot - منصة سنايبر الاحترافية</h1>
          <p style={{ color: '#94A3B8', fontSize: '11px' }}>مساعد التداول الذكي لاكتشاف الاختراقات والتحليل العميق (أقل من 100$).</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#07090E', padding: '6px 12px', borderRadius: '8px', border: '1px solid #1F2636', fontSize: '11px', color: '#FBBF24', fontFamily: 'monospace' }}>
            🇸🇦 الرياض: {riyadhTime || '...'}
          </div>
          <Link href="/" style={{ backgroundColor: '#FBBF24', color: '#000000', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: '900', fontSize: '11px' }}>
            🏠 العودة للرئيسية
          </Link>
        </div>
      </div>

      {/* أزرار التبويب */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => { setActiveTab('radar'); setSelectedStock(null); }} style={{ backgroundColor: activeTab === 'radar' ? '#FBBF24' : '#0B0F17', color: activeTab === 'radar' ? '#000' : '#FFF', padding: '8px 16px', borderRadius: '8px', border: '1px solid #1F2636', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>🟡 رادار العقود النشطة</button>
        <button onClick={() => { setActiveTab('backtest'); setSelectedStock(null); }} style={{ backgroundColor: activeTab === 'backtest' ? '#FBBF24' : '#0B0F17', color: activeTab === 'backtest' ? '#000' : '#FFF', padding: '8px 16px', borderRadius: '8px', border: '1px solid #1F2636', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>📈 محاكاة التداول (Backtesting)</button>
        <button onClick={() => { setActiveTab('paper'); setSelectedStock(null); }} style={{ backgroundColor: activeTab === 'paper' ? '#FBBF24' : '#0B0F17', color: activeTab === 'paper' ? '#000' : '#FFF', padding: '8px 16px', borderRadius: '8px', border: '1px solid #1F2636', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>🧪 المحاكي الافتراضي (Paper Trading)</button>
      </div>

      {/* تفاصيل السهم الشاملة (Trading Copilot View) */}
      {selectedStock ? (
        <div style={{ backgroundColor: '#0B0F17', border: '1px solid #FBBF24', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 0 20px rgba(251, 191, 36, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1F2636', paddingBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#FBBF24' }}>
                {selectedStock.icon} فحص وتحليل السهم العميق: {selectedStock.ticker} <span style={{ fontSize: '12px', color: '#94A3B8' }}>({selectedStock.sector})</span>
              </h2>
            </div>
            <button onClick={() => setSelectedStock(null)} style={{ backgroundColor: '#EF4444', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>إغلاق الفحص ✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            
            {/* العمود الأول: الأرقام الحيوية وإدارة المخاطر */}
            <div style={{ backgroundColor: '#121824', padding: '16px', borderRadius: '12px', border: '1px solid #1F2636' }}>
              <h3 style={{ fontSize: '13px', color: '#38BDF8', fontWeight: 'bold', marginBottom: '12px' }}>📊 المستويات والأهداف السعرية</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>السعر الحالي:</span> <strong style={{ color: '#34D399' }}>${selectedStock.price}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>الهدف الفني (Target):</span> <strong style={{ color: '#FBBF24' }}>${selectedStock.target_price}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>وقف الخسارة (Stop Loss):</span> <strong style={{ color: '#EF4444' }}>${selectedStock.stop_loss}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>مستوى المخاطرة:</span> <strong style={{ color: selectedStock.risk.includes('منخفض') ? '#34D399' : '#FBBF24' }}>{selectedStock.risk}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>فكرة الأوبشن المقترحة:</span> <strong style={{ color: '#38BDF8' }}>{selectedStock.option_idea}</strong></div>
              </div>
            </div>

            {/* العمود الثاني: المؤشرات الفنية */}
            <div style={{ backgroundColor: '#121824', padding: '16px', borderRadius: '12px', border: '1px solid #1F2636' }}>
              <h3 style={{ fontSize: '13px', color: '#C084FC', fontWeight: 'bold', marginBottom: '12px' }}>📈 مؤشرات الزخم والتقييم</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>تقييم الذكاء الاصطناعي (AI Score):</span> <strong style={{ color: '#FBBF24' }}>{selectedStock.ai_score} ⭐⭐⭐⭐⭐</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>مؤشر القوة النسبية (RSI):</span> <strong style={{ color: '#FFF' }}>{selectedStock.indicators.rsi}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>المتوسط المتحرك (MA20):</span> <strong style={{ color: '#FFF' }}>${selectedStock.indicators.ma20}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>المتوسط المتحرك (MA50):</span> <strong style={{ color: '#FFF' }}>${selectedStock.indicators.ma50}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>مناطق الكلاستر والطلب:</span> <strong style={{ color: '#34D399' }}>{selectedStock.indicators.cluster}</strong></div>
              </div>
            </div>

            {/* العمود الثالث: أسباب الاختيار وتعليق الذكاء الاصطناعي */}
            <div style={{ backgroundColor: '#121824', padding: '16px', borderRadius: '12px', border: '1px solid #1F2636', gridColumn: 'span 1' }}>
              <h3 style={{ fontSize: '13px', color: '#FBBF24', fontWeight: 'bold', marginBottom: '12px' }}>🤖 تحليل وتعليق Trading Copilot</h3>
              <p style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '12px', lineHeight: '1.6' }}>{selectedStock.ai_comment}</p>
              
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#34D399', marginBottom: '6px' }}>✔ لماذا تم اختيار هذا السهم؟</div>
              <ul style={{ margin: '0', paddingRight: '16px', fontSize: '11px', color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {selectedStock.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      ) : null}

      {/* الجدول الرئيسي للرادار */}
      <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '16px', padding: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#FBBF24', marginBottom: '16px' }}>📋 رادار الفرص الحية (أقل من 100 دولار فقط)</h3>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', fontSize: '12px' }}>⏳ جاري تحميل البيانات المباشرة...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'right', fontSize: '11px', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1F2636', color: '#94A3B8' }}>
                  <th style={{ padding: '10px' }}>السهم</th>
                  <th style={{ padding: '10px' }}>الزخم (Momentum)</th>
                  <th style={{ padding: '10px' }}>حجم السيولة (Volume)</th>
                  <th style={{ padding: '10px' }}>جاهزية الاختراق</th>
                  <th style={{ padding: '10px' }}>تقييم الـ AI</th>
                  <th style={{ padding: '10px' }}>السعر الحالي</th>
                  <th style={{ padding: '10px' }}>إجراء الفحص العميق</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #1F2636' }}>
                    <td style={{ padding: '10px', fontWeight: '900', color: '#FBBF24' }}>{item.icon} {item.ticker}</td>
                    <td style={{ padding: '10px' }}>{renderProgressBar(item.momentum, '#38BDF8')}</td>
                    <td style={{ padding: '10px' }}>{renderProgressBar(item.volume, '#C084FC')}</td>
                    <td style={{ padding: '10px' }}>{renderProgressBar(item.breakout, '#34D399')}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ color: '#FBBF24', fontSize: '10px' }}>★★★★★</div>
                      <div style={{ color: '#34D399', fontSize: '9px', fontFamily: 'monospace' }}>AI: {item.ai_score}</div>
                    </td>
                    <td style={{ padding: '10px', color: '#FFF', fontWeight: 'bold' }}>
                      <span style={{ color: '#34D399' }}>مستقر </span>${item.price}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => setSelectedStock(item)} style={{ backgroundColor: '#FBBF24', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: '900' }}>
                        فحص عميق ➔
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
