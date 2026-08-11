// components/TradingToolsHub.jsx
'use client';
import React, { useState, useEffect } from 'react';

export default function TradingToolsHub() {
  const [symbol, setSymbol] = useState('');
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [telegramStatus, setTelegramStatus] = useState('');
  
  const [riyadhTime, setRiyadhTime] = useState('');
  const [usTime, setUsTime] = useState('');

  // حالات محرك الاختبار العكسي (Backtesting مع المؤشرات المتقدمة)
  const [backtestTicker, setBacktestTicker] = useState('SOFI');
  const [backtestStrategy, setBacktestStrategy] = useState('bollinger_squeeze'); 
  const [backtestResults, setBacktestResults] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  // حالات مؤشر القوة النسبية الحي (RSI Scanner Widget State)
  const [rsiScannerData, setRsiScannerData] = useState([]);
  const [rsiFilter, setRsiFilter] = useState('all'); // all, oversold, overbought

  // حالات الخريطة الحرارية للقطاعات
  // لا يوجد مزود قطاعات/تدفق مؤسسي فعلي في V4 حالياً؛ لذلك لا نعرض بيانات مصطنعة.
  const sectorData = [];

  // 🗄️ مدير المحفظة الذكي مع الحفظ الدائم (Persistent Storage / Database Ready)
  const [portfolio, setPortfolio] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedPortfolio = localStorage.getItem('sniper_portfolio_db_v2');
      if (savedPortfolio) {
        try {
          return JSON.parse(savedPortfolio);
        } catch (e) {
          console.error("Error loading portfolio from storage", e);
        }
      }
    }
    return [];
  });

  const [portTicker, setPortTicker] = useState('');
  const [portType, setPortType] = useState('سهم');
  const [portQty, setPortQty] = useState('');
  const [portEntry, setPortEntry] = useState('');

  // حفظ التغييرات تلقائياً في التخزين الدائم
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sniper_portfolio_db_v2', JSON.stringify(portfolio));
    }
  }, [portfolio]);

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      setRiyadhTime(now.toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour12: true }));
      setUsTime(now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: true }));
    };
    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadScanner = async () => {
      try {
        const res = await fetch('/api/stocks', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || cancelled) return;

        const rows = (json.data || [])
          .filter((item) => Number.isFinite(Number(item.rsi)))
          .sort((a, b) => Number(b.setupScore || 0) - Number(a.setupScore || 0))
          .slice(0, 20)
          .map((item) => ({
            ticker: item.symbol,
            rsi: Number(item.rsi),
            price: Number.isFinite(Number(item.price)) ? `$${Number(item.price).toFixed(2)}` : '—',
            status:
              Number(item.rsi) < 30
                ? 'تشبع بيعي (Oversold 🟢)'
                : Number(item.rsi) > 70
                  ? 'تشبع شرائي (Overbought 🔴)'
                  : 'RSI ضمن النطاق',
          }));

        setRsiScannerData(rows);
      } catch (error) {
        console.error('RSI scanner load failed', error);
      }
    };

    loadScanner();
    const interval = setInterval(loadScanner, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!portfolio.length) return;

    let cancelled = false;

    const refreshPortfolioPrices = async () => {
      const updated = await Promise.all(
        portfolio.map(async (item) => {
          try {
            const res = await fetch(
              `/api/market-data?symbol=${encodeURIComponent(item.ticker)}`,
              { cache: 'no-store' }
            );
            const json = await res.json();
            const current = Number(json?.data?.[0]?.price);
            return Number.isFinite(current) ? { ...item, current } : item;
          } catch {
            return item;
          }
        })
      );

      if (!cancelled) setPortfolio(updated);
    };

    refreshPortfolioPrices();
    const interval = setInterval(refreshPortfolioPrices, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [portfolio.length]);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!symbol) return;
    setLoading(true);
    setMarketData(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, mode: 'general' }),
      });
      const data = await res.json();
      setMarketData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runBacktest = async () => {
    const ticker = backtestTicker.trim().toUpperCase();
    if (!ticker) return;

    setBacktestLoading(true);
    setBacktestResults(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'backtest',
          symbol: ticker,
          strategy: backtestStrategy,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'تعذر تشغيل الاختبار التاريخي');
      }

      setBacktestResults({
        ticker: data.ticker,
        strategyName: data.strategyName,
        totalTrades: data.totalTrades,
        winRate: data.winRate,
        profitFactor:
          data.profitFactor == null ? 'غير متاح' : data.profitFactor,
        recommendation:
          data.totalTrades > 0
            ? data.winRate >= 60
              ? 'نتيجة تاريخية إيجابية ضمن شروط الاختبار'
              : 'النتيجة التاريخية ضعيفة وتحتاج فلترة إضافية'
            : 'لم تظهر صفقات مطابقة للشروط في الفترة المتاحة',
      });
    } catch (e) {
      setBacktestResults({
        error: e?.message || 'تعذر تشغيل الاختبار التاريخي',
      });
    } finally {
      setBacktestLoading(false);
    }
  };

  const addPosition = (e) => {
    e.preventDefault();
    if (!portTicker || !portQty || !portEntry) return;
    const newItem = {
      id: Date.now(),
      ticker: portTicker.toUpperCase(),
      type: portType,
      qty: Number(portQty),
      entry: Number(portEntry),
      current: null
    };
    setPortfolio([...portfolio, newItem]);
    setPortTicker('');
    setPortQty('');
    setPortEntry('');
  };

  const deletePosition = (id) => {
    setPortfolio(portfolio.filter(item => item.id !== id));
  };

  const sendToSocials = async (title, itemsText) => {
    let msg = `🎯 *${title}* 🎯\n\n${itemsText}\n⏰ *الرياض:* ${riyadhTime}`;

    await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });

    await fetch('/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg }),
    });
  };

  const scanCentOptions = async () => {
    setActionLoading('cents');
    setTelegramStatus('⏳ جاري مسح عقود الـCents الحقيقية...');
    try {
      const res = await fetch('/api/options-radar', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Options provider unavailable');
      const rows = (data.data || []).slice(0, 8);
      if (!rows.length) throw new Error('لا توجد عقود Cents حقيقية متاحة حالياً.');
      const itemsText = rows.map(item =>
        `📌 *${item.symbol}* | ${item.side} ${item.contract}\n💰 Premium: $${item.premium} | Contract: $${item.contractCost}\n📅 ${item.expiry} | Strike: $${item.strike}\n📊 Vol: ${item.volume} | OI: ${item.openInterest} | Score: ${item.score}\n------------------`
      ).join('\n');
      await sendToSocials('⚡ HUNTER — Options Cents Radar', itemsText);
      setTelegramStatus('✅ تم بث عقود الـCents الحقيقية إلى Telegram وDiscord.');
    } catch (err) {
      setTelegramStatus(`⚠️ ${err?.message || 'لا توجد بيانات Options متاحة.'}`);
    } finally {
      setActionLoading('');
      setTimeout(() => setTelegramStatus(''), 5000);
    }
  };


  const scanDarkPoolUnder100 = async () => {
    setActionLoading('darkpool');
    setTelegramStatus('⏳ جاري مسح الصفقات الكبيرة للأسهم (أقل من $100 فقط)...');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'darkpool_under_100' }),
      });
      const data = await res.json();
      let itemsText = '';
      const filteredItems = (data.items || []).filter(i => Number(i.avgPrice) < 100);

      if (!filteredItems.length) {
        throw new Error('لا توجد بيانات Dark Pool حقيقية متاحة من مزود البيانات الحالي.');
      }

      filteredItems.forEach(item => {
        itemsText += `📌 *${item.ticker}* | بلوك: ${item.blockVolume}\n💵 السعر: $${item.avgPrice} (تحت $100)\n🎯 التوجه: ${item.sentiment}\n------------------\n`;
      });

      await sendToSocials('🌐 رادار سيولة المؤسسات (للأسهم تحت $100)', itemsText);
      setTelegramStatus('✅ تم بث تقرير الدارك بول (تحت $100) للمنصتين بنجاح!');
    } catch (err) {
      setTelegramStatus('❌ حدث خطأ.');
    } finally {
      setActionLoading('');
      setTimeout(() => setTelegramStatus(''), 5000);
    }
  };

  const scanGaps = async () => {
    setActionLoading('gaps');
    setTelegramStatus('⏳ جاري رصد الفجوات الصاروخية (تحت $100)...');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'gaps' }),
      });
      const data = await res.json();
      let itemsText = '';
      data.items.forEach(item => {
        itemsText += `📌 *${item.ticker}* | ${item.gapType}\n📊 التغير: ${item.change} | السعر: ${item.price}\n⚡ الإشارة: ${item.signal}\n------------------\n`;
      });

      await sendToSocials('رادار الفجوات الصاروخية (تحت $100)', itemsText);
      setTelegramStatus('✅ تم بث تقرير الفجوات الصاروخية للمصادر بنجاح!');
    } catch (err) {
      setTelegramStatus('❌ حدث خطأ.');
    } finally {
      setActionLoading('');
      setTimeout(() => setTelegramStatus(''), 5000);
    }
  };

  const scanReversals = async () => {
    setActionLoading('reversal');
    setTelegramStatus('⏳ جاري فحص مناطق التشبع للأسهم الخفيفة...');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'reversal' }),
      });
      const data = await res.json();
      let itemsText = '';
      data.items.forEach(item => {
        itemsText += `📌 *${item.ticker}* | ${item.rsi} | السعر: ${item.price}\n🎯 الحالة: ${item.status}\n------------------\n`;
      });

      await sendToSocials('رادار الانعكاسات والتشبع (تحت $100)', itemsText);
      setTelegramStatus('✅ تم بث تقرير الانعكاسات لتليجرام وديسكورد بنجاح!');
    } catch (err) {
      setTelegramStatus('❌ حدث خطأ.');
    } finally {
      setActionLoading('');
      setTimeout(() => setTelegramStatus(''), 5000);
    }
  };

  const triggerAutoPilot = async () => {
    setActionLoading('autopilot');
    setTelegramStatus('🤖 جاري تشغيل الطيار الآلي للأسهم (أقل من $100)...');
    try {
      const res = await fetch('/api/cron');
      const data = await res.json();
      if (data.success) {
        setTelegramStatus('🚀 تم تشغيل الطيار الآلي وبث التقرير الشامل (تحت $100) للمنصتين بنجاح!');
      } else {
        setTelegramStatus('❌ حدث خطأ أثناء تشغيل الأتمتة.');
      }
    } catch (err) {
      setTelegramStatus('❌ حدث خطأ في الاتصال.');
    } finally {
      setActionLoading('');
      setTimeout(() => setTelegramStatus(''), 6000);
    }
  };

  // تصفية بيانات مؤشر RSI الحي بناءً على الفلتر المختار
  const filteredRsiData = rsiScannerData.filter(item => {
    if (rsiFilter === 'oversold') return item.rsi < 30;
    if (rsiFilter === 'overbought') return item.rsi > 70;
    return true;
  });

  return (
    <div style={{ background: 'linear-gradient(135deg, #0d111a 0%, #161b22 100%)', padding: '15px', borderRadius: '16px', border: '1px solid #30363d', marginTop: '15px', color: '#fff', direction: 'rtl', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: '100%', boxSizing: 'border-box' }}>
      
      {/* رأس الحاوية مع الساعة المتجاوبة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #21262d', paddingBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '16px' }}>⚡ مركز القيادة والرادارات (مخصص للأسهم أقل من 100$)</h3>
        
        <div style={{ display: 'flex', gap: '10px', background: '#07090e', padding: '6px 12px', borderRadius: '10px', border: '1px solid #30363d', fontSize: '11px' }}>
          <div>🇸🇦 الرياض: <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{riyadhTime || '...'}</span></div>
          <div style={{ color: '#4b5563' }}>|</div>
          <div>🇺🇸 أمريكا: <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{usTime || '...'}</span></div>
        </div>
      </div>

      {/* حقل البحث */}
      <form onSubmit={handleAnalyze} style={{ display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
        <input 
          type="text" 
          value={symbol} 
          onChange={(e) => setSymbol(e.target.value)} 
          placeholder="أدخل رمز سهم (أقل من $100)..." 
          style={{ background: '#07090e', color: '#fff', border: '1px solid #30363d', padding: '12px 14px', borderRadius: '10px', flex: 1, minWidth: '180px', outline: 'none', fontSize: '13px', WebkitAppearance: 'none' }}
        />
        <button type="submit" style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)', color: '#0d111a', border: 'none', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', minHeight: '44px' }}>
          {loading ? 'جاري...' : 'فحص السهم'}
        </button>
      </form>

      {telegramStatus && (
        <div style={{ background: '#064e3b', color: '#34d399', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', marginBottom: '15px', fontWeight: 'bold', border: '1px solid #059669' }}>
          {telegramStatus}
        </div>
      )}

      {/* أزرار الرادارات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={scanCentOptions} 
          disabled={actionLoading === 'cents'}
          style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', minHeight: '48px', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}
        >
          {actionLoading === 'cents' ? '⏳ جاري الإرسال...' : '🎯 رادار عقود السنتات (تحت $100)'}
        </button>

        <button 
          onClick={scanDarkPoolUnder100} 
          disabled={actionLoading === 'darkpool'}
          style={{ background: '#1f2937', color: '#38bdf8', border: '1px solid #374151', padding: '14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', minHeight: '48px' }}
        >
          {actionLoading === 'darkpool' ? '⏳ جاري الرصد...' : '🌐 سيولة المؤسسات (تحت $100)'}
        </button>

        <button 
          onClick={scanGaps} 
          disabled={actionLoading === 'gaps'}
          style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', minHeight: '48px', boxShadow: '0 4px 12px rgba(217,119,6,0.3)' }}
        >
          {actionLoading === 'gaps' ? '⏳ جاري الفحص...' : '🚀 رادار الفجوات (تحت $100)'}
        </button>

        <button 
          onClick={scanReversals} 
          disabled={actionLoading === 'reversal'}
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', minHeight: '48px', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}
        >
          {actionLoading === 'reversal' ? '⏳ جاري الفحص...' : '🔄 رادار الانعكاسات (RSI)'}
        </button>

        <button 
          onClick={triggerAutoPilot} 
          disabled={actionLoading === 'autopilot'}
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', minHeight: '48px', boxShadow: '0 4px 12px rgba(124,58,237,0.4)', gridColumn: '1 / -1' }}
        >
          {actionLoading === 'autopilot' ? '🤖 الطيار الآلي يعمل...' : '⚡ تشغيل الطيار الآلي الشامل (للأسهم تحت $100)'}
        </button>
      </div>

      {/* 📊 مؤشر القوة النسبية الحي (RSI Scanner Widget) */}
      <div style={{ background: '#07090e', padding: '15px', borderRadius: '12px', border: '1px solid #30363d', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '14px' }}>
            📊 مؤشر القوة النسبية الحي (RSI Scanner Widget)
          </h4>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              onClick={() => setRsiFilter('all')} 
              style={{ background: rsiFilter === 'all' ? '#38bdf8' : '#111827', color: rsiFilter === 'all' ? '#0d111a' : '#fff', border: '1px solid #374151', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              الكل
            </button>
            <button 
              onClick={() => setRsiFilter('oversold')} 
              style={{ background: rsiFilter === 'oversold' ? '#059669' : '#111827', color: rsiFilter === 'oversold' ? '#fff' : '#4ade80', border: '1px solid #059669', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              تشبع بيعي (&lt;30 🟢)
            </button>
            <button 
              onClick={() => setRsiFilter('overbought')} 
              style={{ background: rsiFilter === 'overbought' ? '#dc2626' : '#111827', color: rsiFilter === 'overbought' ? '#fff' : '#f87171', border: '1px solid #dc2626', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              تشبع شرائي (&gt;70 🔴)
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginTop: '10px' }}>
          {filteredRsiData.map((item, idx) => {
            const isOversold = item.rsi < 30;
            return (
              <div key={idx} style={{ 
                background: '#111827', 
                border: `1px solid ${isOversold ? '#059669' : '#dc2626'}`, 
                padding: '10px 12px', 
                borderRadius: '8px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#38bdf8', fontSize: '13px' }}>{item.ticker} <span style={{ color: '#9ca3af', fontSize: '11px' }}>({item.price})</span></div>
                  <div style={{ fontSize: '10px', color: isOversold ? '#4ade80' : '#f87171', marginTop: '2px', fontWeight: 'bold' }}>{item.status}</div>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', background: isOversold ? '#064e3b' : '#7f1d1d', padding: '4px 8px', borderRadius: '6px' }}>
                  {item.rsi}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🗺️ الخريطة الحرارية */}
      <div style={{ background: '#07090e', padding: '15px', borderRadius: '12px', border: '1px solid #30363d', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8', fontSize: '14px' }}>
          🗺️ الخريطة الحرارية لتدفق السيولة (Sector Rotation)
        </h4>
        <div style={{ marginTop: '10px', color: '#94A3B8', fontSize: '11px', padding: '12px', background: '#111827', borderRadius: '8px' }}>
          {sectorData.length ? sectorData.map((sec, idx) => (
            <div key={idx} style={{ 
              background: sec.status === 'bullish' ? '#064e3b33' : sec.status === 'explosive' ? '#7c3aed33' : '#7f1d1d33', 
              border: `1px solid ${sec.status === 'bullish' ? '#059669' : sec.status === 'explosive' ? '#8b5cf6' : '#dc2626'}`,
              padding: '10px', 
              borderRadius: '8px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{sec.name}</span>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: sec.change.startsWith('+') ? '#4ade80' : '#f87171' }}>{sec.change}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#cbd5e1' }}>{sec.flow}</div>
            </div>
          )) : 'بيانات القطاعات وتدفق السيولة المؤسسية غير متاحة حالياً من مزود فعلي، لذلك تم إخفاء الأرقام بدلاً من اختلاقها.'}
        </div>
      </div>

      {/* 💼 مُدير المحفظة الذكي (مع الحفظ الدائم) */}
      <div style={{ background: '#07090e', padding: '15px', borderRadius: '12px', border: '1px solid #30363d', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#f59e0b', fontSize: '14px' }}>
          💼 مُدير المحفظة الذكي (محفوظ بشكل دائم 🗄️)
        </h4>
        <form onSubmit={addPosition} style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', marginTop: '10px' }}>
          <input 
            type="text" 
            value={portTicker} 
            onChange={(e) => setPortTicker(e.target.value)} 
            placeholder="الرمز (مثل SOFI)" 
            style={{ background: '#111827', color: '#fff', border: '1px solid #374151', padding: '10px', borderRadius: '8px', flex: 1, minWidth: '100px', outline: 'none', fontSize: '12px', WebkitAppearance: 'none' }}
          />
          <select 
            value={portType} 
            onChange={(e) => setPortType(e.target.value)}
            style={{ background: '#111827', color: '#fff', border: '1px solid #374151', padding: '10px', borderRadius: '8px', fontSize: '12px', outline: 'none', minHeight: '40px' }}
          >
            <option value="سهم">سهم</option>
            <option value="عقد خيار">خيار</option>
          </select>
          <input 
            type="number" 
            value={portQty} 
            onChange={(e) => setPortQty(e.target.value)} 
            placeholder="الكمية" 
            style={{ background: '#111827', color: '#fff', border: '1px solid #374151', padding: '10px', borderRadius: '8px', width: '80px', outline: 'none', fontSize: '12px', WebkitAppearance: 'none' }}
          />
          <input 
            type="number" 
            step="0.01"
            value={portEntry} 
            onChange={(e) => setPortEntry(e.target.value)} 
            placeholder="السعر" 
            style={{ background: '#111827', color: '#fff', border: '1px solid #374151', padding: '10px', borderRadius: '8px', width: '80px', outline: 'none', fontSize: '12px', WebkitAppearance: 'none' }}
          />
          <button type="submit" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#0d111a', border: 'none', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', minHeight: '40px', width: '100%' }}>
            ➕ إضافة صفقة وحفظها
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {portfolio.map((item) => {
            const hasCurrent = Number.isFinite(Number(item.current));
            const pnl = hasCurrent
              ? ((item.current - item.entry) * item.qty).toFixed(2)
              : null;
            const isProfit = pnl != null && Number(pnl) >= 0;
            return (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', padding: '10px 12px', borderRadius: '8px', border: '1px solid #374151', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#38bdf8', fontSize: '13px' }}>{item.ticker}</span>
                  <span style={{ background: '#1f2937', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', color: '#9ca3af' }}>{item.type}</span>
                  <span style={{ fontSize: '11px', color: '#d1d5db' }}>الكمية: {item.qty}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>دخول: ${item.entry.toFixed(2)}</span>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: pnl == null ? '#94a3b8' : isProfit ? '#4ade80' : '#f87171' }}>
                    {pnl == null ? 'السعر الحالي غير متاح' : `${isProfit ? '+' : ''}$${pnl}`}
                  </span>
                  <button onClick={() => deletePosition(item.id)} style={{ background: '#7f1d1d', color: '#f87171', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', minHeight: '28px' }}>
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ⚡ محرك الاختبار العكسي المتقدم بالمؤشرات الفنية */}
      <div style={{ background: '#07090e', padding: '15px', borderRadius: '12px', border: '1px solid #30363d' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#10b981', fontSize: '14px' }}>
          ⚡ محرك الاختبار العكسي بالمؤشرات المتقدمة (MACD & Squeeze)
        </h4>
        
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            value={backtestTicker} 
            onChange={(e) => setBacktestTicker(e.target.value.toUpperCase())}
            placeholder="SOFI"
            style={{ background: '#111827', color: '#38bdf8', border: '1px solid #374151', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', width: '100px', outline: 'none', fontWeight: 'bold', WebkitAppearance: 'none' }}
          />
          
          <select 
            value={backtestStrategy} 
            onChange={(e) => setBacktestStrategy(e.target.value)}
            style={{ background: '#111827', color: '#fff', border: '1px solid #374151', padding: '10px', borderRadius: '8px', fontSize: '12px', flex: 1, minWidth: '150px', outline: 'none', minHeight: '40px' }}
          >
            <option value="bollinger_squeeze">Bollinger Squeeze Breakout 🚀</option>
            <option value="macd_hist">MACD Histogram Momentum 📊</option>
            <option value="sma_cross">تقاطع متوسط 20 (SMA Cross)</option>
          </select>

          <button 
            onClick={runBacktest}
            disabled={backtestLoading}
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', minHeight: '40px' }}
          >
            {backtestLoading ? '🔄 جاري...' : '🚀 تشغيل'}
          </button>
        </div>

        {backtestResults && (
          <div style={{ background: '#111827', padding: '12px', borderRadius: '10px', border: '1px solid #374151', fontSize: '12px', marginTop: '10px' }}>
            <div style={{ marginBottom: '8px', color: '#38bdf8', fontWeight: 'bold' }}>
              الاستراتيجية: {backtestResults.strategyName} ({backtestResults.ticker})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
              <div>الصفقات: <strong style={{ color: '#fff' }}>{backtestResults.totalTrades}</strong></div>
              <div>النجاح: <strong style={{ color: '#4ade80' }}>%{backtestResults.winRate}</strong></div>
              <div>الربحية: <strong style={{ color: '#a78bfa' }}>{backtestResults.profitFactor}</strong></div>
            </div>
            <div style={{ textAlign: 'center', background: '#064e3b', color: '#34d399', padding: '8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', border: '1px solid #059669' }}>
              {backtestResults.recommendation}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
