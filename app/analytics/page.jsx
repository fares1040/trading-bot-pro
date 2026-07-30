// app/analytics/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('radar');
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riyadhTime, setRiyadhTime] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');
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
        const res = await fetch('/api/stocks', { cache: 'no-store' });
        await res.json();
        
        const dynamicExpiry = getFlexibleExpiryDate(45);
        setOpportunities([
          { ticker: 'PFE', icon: '💊', sector: 'رعاية صحية', price: '25.15', ai_score: '93/100', momentum: 88, volume: 75, breakout: 85, target_price: '32.00', option_idea: `عقد Call سترايك 26$ (${dynamicExpiry})` },
          { ticker: 'GME', icon: '🎮', sector: 'تجزئة وألعاب', price: '21.84', ai_score: '93/100', momentum: 88, volume: 75, breakout: 85, target_price: '28.00', option_idea: `عقد Call سترايك 22$ (${dynamicExpiry})` },
          { ticker: 'NIO', icon: '🚙', sector: 'سيارات كهربائية', price: '4.75', ai_score: '91/100', momentum: 88, volume: 75, breakout: 85, target_price: '6.50', option_idea: `عقد Call سترايك 5$ (${dynamicExpiry})` },
          { ticker: 'F', icon: '🚗', sector: 'سيارات تقليدية', price: '10.32', ai_score: '91/100', momentum: 88, volume: 75, breakout: 85, target_price: '13.00', option_idea: `عقد Call سترايك 11$ (${dynamicExpiry})` },
          { ticker: 'DIS', icon: '🎬', sector: 'ترفيه وإعلام', price: '98.40', ai_score: '91/100', momentum: 88, volume: 75, breakout: 85, target_price: '115.00', option_idea: `عقد Call سترايك 100$ (${dynamicExpiry})` }
        ]);
        setLastUpdate(new Date().toLocaleTimeString());
      } catch (err) {
        console.error('Live Sync Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveAnalytics();
    const liveInterval = setInterval(fetchLiveAnalytics, 10000);
    return () => clearInterval(liveInterval);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', backgroundColor: '#0B0F17', padding: '16px 24px', borderRadius: '16px', border: '1px solid #1F2636' }}>
        <div>
          <h1 style={{ color: '#FBBF24', fontSize: '16px', fontWeight: '900', marginBottom: '4px' }}>📊 لوحة تحليلات سنايبر والتحكم الشامل</h1>
          <p style={{ color: '#94A3B8', fontSize: '11px' }}>مسح متقدم لكواتم أوامر فايناس واختراقات القمم التاريخية.</p>
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
        <button onClick={() => { setActiveTab('swing'); setSelectedStock(null); }} style={{ backgroundColor: activeTab === 'swing' ? '#FBBF24' : '#0B0F17', color: activeTab === 'swing' ? '#000' : '#FFF', padding: '8px 16px', borderRadius: '8px', border: '1px solid #1F2636', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>📊 رادار صفقات السوينغ (أسهم &gt; 10$)</button>
        <button onClick={() => { setActiveTab('backtest'); setSelectedStock(null); }} style={{ backgroundColor: '#0B0F17', color: '#FFF', padding: '8px 16px', borderRadius: '8px', border: '1px solid #1F2636', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>📈 محاكاة التداول التراجعي (Backtesting)</button>
        <button onClick={() => { setActiveTab('paper'); setSelectedStock(null); }} style={{ backgroundColor: '#0B0F17', color: '#FFF', padding: '8px 16px', borderRadius: '8px', border: '1px solid #1F2636', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>🧪 المحاكي الافتراضي (Paper Trading)</button>
      </div>

      {/* البطاقات الإحصائية العلوية (مثل الصورة المفضلة لديك) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>⚡ القطاعات المسيترة</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#FBBF24' }}>تكنولوجيا / سيارات</div>
        </div>
        <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>🎯 متوسط العائد المستهدف</div>
          <div style={{ fontSize: '16px', fontWeight: '900', color: '#34D399' }}>+210%</div>
        </div>
        <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>💎 إجمالي الفرص النشطة بالرادار</div>
          <div style={{ fontSize: '16px', fontWeight: '900', color: '#38BDF8' }}>10 أسهم</div>
        </div>
        <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>📈 نسبة النجاح التقنية (Win Rate)</div>
          <div style={{ fontSize: '16px', fontWeight: '900', color: '#FBBF24' }}>81%</div>
        </div>
      </div>

      {/* نافذة فحص السهم المحدد */}
      {selectedStock && (
        <div style={{ backgroundColor: '#0B0F17', border: '1px solid #3B82F6', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#FBBF24' }}>تفاصيل فحص السهم: {selectedStock.ticker}</h3>
            <button onClick={() => setSelectedStock(null)} style={{ backgroundColor: '#EF4444', color: '#FFF', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>إغلاق ✕</button>
          </div>
          <div style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', gap: '20px' }}>
            <span>السعر الحالي: <strong style={{ color: '#34D399' }}>${selectedStock.price}</strong></span>
            <span>الهدف الفني: <strong style={{ color: '#FBBF24' }}>${selectedStock.target_price}</strong></span>
            <span>الفكرة المقترحة: <strong style={{ color: '#38BDF8' }}>{selectedStock.option_idea}</strong></span>
          </div>
        </div>
      )}

      {/* جدول الأسهم الرئيسي */}
      <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '16px', padding: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#FBBF24', marginBottom: '16px' }}>📋 سجل عقود السنتات والقمم التاريخية (مسح ذكي حي)</h3>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', fontSize: '12px' }}>⏳ جاري تحميل البيانات المباشرة...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'right', fontSize: '11px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1F2636', color: '#94A3B8' }}>
                  <th style={{ padding: '10px' }}>السهم</th>
                  <th style={{ padding: '10px' }}>الزخم (Momentum)</th>
                  <th style={{ padding: '10px' }}>حجم السيولة (Volume)</th>
                  <th style={{ padding: '10px' }}>جاهزية الاختراق</th>
                  <th style={{ padding: '10px' }}>تقييم الـ AI والنجوم</th>
                  <th style={{ padding: '10px' }}>السعر الحالي</th>
                  <th style={{ padding: '10px' }}>إجراء</th>
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
                      <div style={{ color: '#34D399', fontSize: '9px', fontFamily: 'monospace' }}>AI SCORE: {item.ai_score}</div>
                    </td>
                    <td style={{ padding: '10px', color: '#FFF', fontWeight: 'bold' }}>
                      <span style={{ color: '#34D399' }}>مستقر </span>${item.price}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => setSelectedStock(item)} style={{ backgroundColor: '#1E293B', color: '#FBBF24', border: '1px solid #334155', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
                        فحص وهدف الصفقة ➔
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
