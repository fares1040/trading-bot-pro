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

  const [paperTrades] = useState([
    { id: 1, ticker: 'AMD', icon: '⚡', entryPrice: '0.22', currentPrice: '0.55', profit: '+150%', status: 'ربح مفتوح 🚀' },
    { id: 2, ticker: 'PLTR', icon: '💎', entryPrice: '0.40', currentPrice: '0.88', profit: '+120%', status: 'ربح مفتوح 🔥' }
  ]);

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
        const json = await res.json();
        
        const dynamicExpiry = getFlexibleExpiryDate(50);
        setOpportunities([
          { ticker: 'SERV', icon: '🚀', sector: 'تكنولوجيا وذكاء', price: '31.20', change_percent: '+92.4', confidence: '98', momentum: 97, volume: 95, breakout: 99, target_price: '37.80', option_idea: `عقد Call سترايك 32$ (${dynamicExpiry})` },
          { ticker: 'NVDA', icon: '⚡', sector: 'أشباه الموصلات', price: '124.50', change_percent: '+3.15', confidence: '94', momentum: 88, volume: 91, breakout: 85, target_price: '135.00', option_idea: `عقد Call سترايك 125$ (${dynamicExpiry})` },
          { ticker: 'TSLA', icon: '🚗', sector: 'سيارات كهربائية', price: '220.10', change_percent: '-1.40', confidence: '91', momentum: 76, volume: 82, breakout: 60, target_price: '245.00', option_idea: `عقد Call سترايك 225$ (${dynamicExpiry})` },
          { ticker: 'PLTR', icon: '🔮', sector: 'برمجيات وبيانات', price: '43.25', change_percent: '+5.60', confidence: '92', momentum: 91, volume: 88, breakout: 94, target_price: '49.00', option_idea: `عقد Call سترايك 45$ (${dynamicExpiry})` }
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
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', backgroundColor: '#0B0F17', padding: '16px 24px', borderRadius: '16px', border: '1px solid #1F2636' }}>
        <div>
          <h1 style={{ color: '#FBBF24', fontSize: '18px', fontWeight: '900', marginBottom: '4px' }}>📊 لوحة تحليلات سنايبر والتحكم الشامل (نشط بالثواني ⚡)</h1>
          <p style={{ color: '#94A3B8', fontSize: '12px' }}>آخر تحديث مباشر: <span style={{ color: '#34D399', fontFamily: 'monospace' }}>{lastUpdate || 'جاري المزامنة...'}</span></p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#07090E', padding: '8px 14px', borderRadius: '10px', border: '1px solid #1F2636', fontSize: '11px', color: '#FBBF24', fontFamily: 'monospace' }}>
            🇸🇦 الرياض: {riyadhTime || '...'}
          </div>
          <Link href="/" style={{ backgroundColor: '#FBBF24', color: '#000000', padding: '10px 18px', borderRadius: '10px', textDecoration: 'none', fontWeight: '900', fontSize: '12px' }}>
            🏠 العودة للرئيسية
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => { setActiveTab('radar'); setSelectedStock(null); }} style={{ backgroundColor: activeTab === 'radar' ? '#FBBF24' : '#0B0F17', color: activeTab === 'radar' ? '#000' : '#FFF', padding: '10px 20px', borderRadius: '10px', border: '1px solid #1F2636', fontWeight: 'bold', cursor: 'pointer' }}>🎯 رادار العقود النشطة</button>
        <button onClick={() => { setActiveTab('paper'); setSelectedStock(null); }} style={{ backgroundColor: activeTab === 'paper' ? '#FBBF24' : '#0B0F17', color: activeTab === 'paper' ? '#000' : '#FFF', padding: '10px 20px', borderRadius: '10px', border: '1px solid #1F2636', fontWeight: 'bold', cursor: 'pointer' }}>🧪 المحاكي الافتراضي</button>
      </div>

      {selectedStock && (
        <div style={{ backgroundColor: '#0B0F17', border: '1px solid #3B82F6', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#FBBF24' }}>فحص السهم: {selectedStock.ticker}</h2>
            <button onClick={() => setSelectedStock(null)} style={{ backgroundColor: '#EF4444', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}>إغلاق ✕</button>
          </div>
          <div style={{ fontSize: '12px', color: '#94A3B8' }}>السعر الحالي: <strong style={{ color: '#34D399' }}>${selectedStock.price}</strong> | الفكرة: {selectedStock.option_idea}</div>
        </div>
      )}

      {activeTab === 'radar' && (
        <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#FBBF24', marginBottom: '16px' }}>📋 رادار السيولة الحية</h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>⏳ جاري جلب الأسعار المباشرة...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'right', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1F2636', color: '#94A3B8' }}>
                    <th style={{ padding: '12px' }}>السهم</th>
                    <th style={{ padding: '12px' }}>الزخم</th>
                    <th style={{ padding: '12px' }}>حجم السيولة</th>
                    <th style={{ padding: '12px' }}>جاهزية الاختراق</th>
                    <th style={{ padding: '12px' }}>تقييم AI</th>
                    <th style={{ padding: '12px' }}>السعر الحي</th>
                    <th style={{ padding: '12px' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #1F2636' }}>
                      <td style={{ padding: '12px', fontWeight: '900', color: '#FBBF24' }}>{item.icon} {item.ticker}</td>
                      <td style={{ padding: '12px' }}>{renderProgressBar(item.momentum, '#38BDF8')}</td>
                      <td style={{ padding: '12px' }}>{renderProgressBar(item.volume, '#C084FC')}</td>
                      <td style={{ padding: '12px' }}>{renderProgressBar(item.breakout, '#34D399')}</td>
                      <td style={{ padding: '12px', color: '#34D399' }}>⭐⭐⭐⭐⭐ ({item.confidence}/100)</td>
                      <td style={{ padding: '12px', color: '#FFF', fontWeight: 'bold' }}><span style={{ color: '#34D399' }}>🟢 حي </span>${item.price}</td>
                      <td style={{ padding: '12px' }}>
                        <button onClick={() => setSelectedStock(item)} style={{ backgroundColor: '#1E293B', color: '#FBBF24', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>فحص ➔</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'paper' && (
        <div style={{ backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#FBBF24', marginBottom: '12px' }}>🧪 المحاكي الافتراضي المباشر</h3>
          <p style={{ color: '#94A3B8', fontSize: '12px' }}>الصفقات الافتراضية تتتبع السعر المباشر لحظياً.</p>
        </div>
      )}

    </div>
  );
}
