'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [symbols, setSymbols] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sniper_symbols_cluster');
      if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    }
    return ['VMAR', 'CETX', 'GSIT', 'PRFX', 'BYRN', 'ERNA', 'LNZA', 'HURA', 'KULR', 'ANVS', 'PPSI', 'BJDX'];
  });

  const [scalpSymbols, setScalpSymbols] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sniper_symbols_scalp');
      if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    }
    return ['TSLA', 'NVDA', 'AAPL', 'AMD', 'META', 'MSFT', 'SPY', 'QQQ'];
  });

  const [newSymbol, setNewSymbol] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // 🔍 حالة شريط البحث الجديد
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState('cluster'); 
  const [scalpResults, setScalpResults] = useState({});
  const [loadingScalp, setLoadingScalp] = useState(false);

  // ⚙️ إعدادات الفلاتر والرادارات المتقدمة
  const [minConfidence, setMinConfidence] = useState(78);
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const [filterOnlySuitable, setFilterOnlySuitable] = useState(false);
  const [activeRadarFilter, setActiveRadarFilter] = useState('all'); 
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [timer, setTimer] = useState(300);

  const [earlyAlertsEnabled, setEarlyAlertsEnabled] = useState(true);
  const [parachuteActive, setParachuteActive] = useState(true);

  const [marketTrendIndex] = useState('صاعد إيجابي (SPY/QQQ 🚀)');
  const [liveOrderFlowTape] = useState([
    { id: 1, sym: 'TSLA', type: 'شراء ضخم حيتان (Block Trade)', vol: '+150K سهم', time: 'الآن' },
    { id: 2, sym: 'NVDA', type: 'تراكم خفي مؤسسي', vol: '+85K سهم', time: 'منذ دقيقة' }
  ]);
  const [supplyDemandZones] = useState({
    'TSLA': { support: '185.50 $', resistance: '202.00 $' },
    'NVDA': { support: '115.00 $', resistance: '130.00 $' }
  });

  const [tradeStats, setTradeStats] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sniper_trade_stats');
      if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    }
    return { wins: 0, losses: 0 };
  });

  const [activeTrades, setActiveTrades] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sniper_active_trades');
      if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    }
    return [];
  });
  const [showTradesModal, setShowTradesModal] = useState(false);

  const [missionHistory, setMissionHistory] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sniper_mission_history');
      if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    }
    return [];
  });
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('sniper_webhook') || '';
    return '';
  });

  const [chartModalSymbol, setChartModalSymbol] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sniper_webhook', webhookUrl);
      localStorage.setItem('sniper_mission_history', JSON.stringify(missionHistory));
      localStorage.setItem('sniper_trade_stats', JSON.stringify(tradeStats));
      localStorage.setItem('sniper_active_trades', JSON.stringify(activeTrades));
      localStorage.setItem('sniper_symbols_cluster', JSON.stringify(symbols));
      localStorage.setItem('sniper_symbols_scalp', JSON.stringify(scalpSymbols));
    }
  }, [webhookUrl, missionHistory, tradeStats, activeTrades, symbols, scalpSymbols]);

  const speakAlert = (text) => {
    try {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {}
  };

  const playRadarSound = (sym = '', analysisText = '', isEarly = false) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isEarly ? 660 : 880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
    
    if (sym) {
      speakAlert(isEarly ? `تنبيه ملكي استباقي. السهم ${sym} يقترب من منطقة الهدف` : `تنبيه رادار القصر الملكي. تم رصد فرصة استثمارية ذهبية على السهم ${sym}`);
      const timeNow = new Date().toLocaleTimeString('ar-SA');
      setMissionHistory(prev => [
        { id: Date.now(), symbol: sym, time: timeNow, details: analysisText, isEarly },
        ...prev.slice(0, 49)
      ]);
    }
  };

  // 📥 دالة تصدير سجل العمليات والصید إلى ملف CSV أوتوماتيكياً
  const exportHistoryToCSV = () => {
    if (missionHistory.length === 0) {
      alert('لا يوجد سجل عمليات لتحميله حالياً.');
      return;
    }
    const headers = ['ID,Symbol,Time,Type,Details\n'];
    const rows = missionHistory.map(h => `${h.id},${h.symbol},"${h.time}","${h.isEarly ? 'إنذار مبكر' : 'فرصة مؤكدة'}","${h.details || ''}"`);
    const csvContent = 'data:text/csv;charset=utf-8,' + headers.concat(rows).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sniper_Mission_History_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert('📥 تم تصدير السجل الملكي بنجاح إلى ملف CSV!');
  };

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            if (activeTab === 'cluster') runAnalysis();
            else runScalpAnalysis();
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimer(300);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, symbols, scalpSymbols]);

  const runAnalysis = async () => {
    setLoading(true);
    const newResults = {};
    let firstMatchedSym = '';
    let firstAnalysis = '';
    let isEarlyAlert = false;

    for (let sym of symbols) {
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: sym,
            scalpMode: false,
            minConfidence,
            cooldownMinutes,
            earlyAlertsEnabled,
            discordWebhook: webhookUrl
          })
        });
        const data = await res.json();
        newResults[sym] = data;
        
        if (data.isSuitable && data.confidenceScore >= minConfidence && !firstMatchedSym) {
          firstMatchedSym = sym;
          firstAnalysis = data.analysis;
          isEarlyAlert = false;
        } else if (earlyAlertsEnabled && data.isEarlyAlert && !firstMatchedSym) {
          firstMatchedSym = sym;
          firstAnalysis = data.analysis;
          isEarlyAlert = true;
        }
      } catch (err) {
        newResults[sym] = { error: "فشل الاتصال بمحرك التحليل السيادي" };
      }
    }
    setResults(newResults);
    setLoading(false);
    if (firstMatchedSym) playRadarSound(firstMatchedSym, firstAnalysis, isEarlyAlert);
  };

  const runScalpAnalysis = async () => {
    setLoadingScalp(true);
    const newResults = {};
    let firstMatchedSym = '';
    let firstAnalysis = '';
    let isEarlyAlert = false;

    for (let sym of scalpSymbols) {
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: sym,
            scalpMode: true,
            minConfidence,
            cooldownMinutes,
            earlyAlertsEnabled,
            discordWebhook: webhookUrl
          })
        });
        const data = await res.json();
        newResults[sym] = data;

        if (data.isSuitable && data.confidenceScore >= minConfidence && !firstMatchedSym) {
          firstMatchedSym = sym;
          firstAnalysis = data.analysis;
          isEarlyAlert = false;
        } else if (earlyAlertsEnabled && data.isEarlyAlert && !firstMatchedSym) {
          firstMatchedSym = sym;
          firstAnalysis = data.analysis;
          isEarlyAlert = true;
        }
      } catch (err) {
        newResults[sym] = { error: "فشل الاتصال برادار السكالبينج الملكي" };
      }
    }
    setScalpResults(newResults);
    setLoadingScalp(false);
    if (firstMatchedSym) playRadarSound(firstMatchedSym, firstAnalysis, isEarlyAlert);
  };

  const enterTrade = (sym, price) => {
    const timeNow = new Date().toLocaleTimeString('ar-SA');
    const p = Number(price);
    const newTrade = {
      id: Date.now(),
      symbol: sym,
      entryPrice: p,
      time: timeNow,
      type: activeTab === 'cluster' ? 'استثمار ملكي سيادي' : 'سكالبينج ملكي لحظي',
      stopLoss: (p * 0.962).toFixed(2),
      targets: {
        t1: (p * 1.035).toFixed(2),
        t2: (p * 1.070).toFixed(2),
        t3: (p * 1.110).toFixed(2)
      },
      status: 'نشطة'
    };
    setActiveTrades(prev => [newTrade, ...prev]);
    alert(`👑 تم اعتماد الصفقة ملكياً على [${sym}] بسعر [${p}]!\n🪂 تم تفعيل حاسبة المظلة السيادية والأهداف التدريجية.`);
  };

  const removeSymbol = (symToRemove) => {
    if (activeTab === 'cluster') {
      setSymbols(symbols.filter(s => s !== symToRemove));
    } else {
      setScalpSymbols(scalpSymbols.filter(s => s !== symToRemove));
    }
  };

  const currentList = activeTab === 'cluster' ? symbols : scalpSymbols;
  const currentRes = activeTab === 'cluster' ? results : scalpResults;
  const isCurrentLoading = activeTab === 'cluster' ? loading : loadingScalp;

  // 🔍 تصفية الأسهم حسب القائمة الحالية + شريط البحث
  const displayedSymbols = currentList.filter(sym => {
    if (searchQuery.trim() && !sym.toLowerCase().includes(searchQuery.toLowerCase().trim())) {
      return false;
    }
    const data = currentRes[sym];
    if (filterOnlySuitable && (!data || (!data.isSuitable && !data.isEarlyAlert))) return false;
    return true;
  });

  return (
    <main style={{ padding: '25px', direction: 'rtl', fontFamily: 'Tahoma, sans-serif', background: '#07090e', color: '#f3f4f6', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* شريط العنوان الملكي */}
        <div style={{ textAlign: 'center', marginBottom: '18px', borderBottom: '1px solid #d4af3733', paddingBottom: '15px' }}>
          <h1 style={{ color: '#d4af37', fontSize: '28px', fontWeight: '900', margin: '0 0 5px 0', textShadow: '0 2px 10px rgba(212,175,55,0.2)' }}>
            👑 منصة سنابير الاستخباراتية - كابوس الحيتان 🔥
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
            غرفة التداول الخاصة لكبار المستثمرين • رادار مصائد السيولة والأوامر المخفية • حاسبة المظلة الملكية وشارت TradingView
          </p>
        </div>

        {/* لوحة التحكم السيادي وشريط البحث الجديد */}
        <div style={{ background: 'linear-gradient(135deg, #0d111a 0%, #161b22 100%)', padding: '18px', borderRadius: '14px', border: '1px solid #d4af37', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ color: '#d4af37', fontSize: '13px', fontWeight: 'bold', margin: 0 }}>⚙️ لوحة التحكم السيادي والبحث الفوري:</h3>
            
            {/* 🔍 زر وشريط البحث السريع */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#07090e', border: '1px solid #d4af3755', borderRadius: '8px', padding: '4px 10px' }}>
              <span style={{ marginLeft: '8px', fontSize: '14px' }}>🔍</span>
              <input 
                type="text" 
                placeholder="ابحث عن رمز سهم (مثال: TSLA)..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '12px', outline: 'none', width: '200px' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>✕</button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '11.5px', color: '#d1d5db', display: 'block', marginBottom: '5px' }}>
                الحد الأدنى لنسبة الثقة الانعكاسية: <strong style={{ color: '#d4af37' }}>{minConfidence}%</strong>
              </label>
              <input type="range" min="50" max="95" value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value))} style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer' }} />
            </div>
            <div>
              <label style={{ fontSize: '11.5px', color: '#d1d5db', display: 'block', marginBottom: '5px' }}>رابط Webhook (Discord / Telegram):</label>
              <input type="text" placeholder="https://..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} style={{ width: '100%', padding: '6px 10px', background: '#0b0f17', border: '1px solid #30363d', borderRadius: '6px', color: '#fff', fontSize: '11.5px' }} />
            </div>
          </div>
        </div>

        {/* التبديل بين الأقسام */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <button onClick={() => { setActiveTab('cluster'); setFilterOnlySuitable(false); }} style={{ padding: '11px 24px', background: activeTab === 'cluster' ? 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)' : '#0d111a', color: activeTab === 'cluster' ? '#07090e' : '#fff', border: '1px solid #d4af37', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            👑 الاستثمار السيادي وكابوس الحيتان [{symbols.length} سهم]
          </button>
          <button onClick={() => { setActiveTab('scalp'); setFilterOnlySuitable(false); }} style={{ padding: '11px 24px', background: activeTab === 'scalp' ? 'linear-gradient(135deg, #9333ea 0%, #6b21a8 100%)' : '#0d111a', color: '#fff', border: '1px solid #c084fc', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            ⚡ موجات الترند الملكي (سكالبينج) [{scalpSymbols.length} سهم]
          </button>
        </div>

        {/* أزرار التحكم السريع وتصدير الـ CSV */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0d111a', padding: '12px 18px', borderRadius: '12px', border: '1px solid #21262d', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setShowHistoryModal(true)} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              📜 سجل العمليات الملكية ({missionHistory.length})
            </button>
            <button onClick={exportHistoryToCSV} style={{ background: '#b45309', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              📥 تصدير السجل إلى ملف CSV
            </button>
          </div>
        </div>

        {/* زر الفحص الرئيسي */}
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <button onClick={activeTab === 'cluster' ? runAnalysis : runScalpAnalysis} disabled={isCurrentLoading} style={{ padding: '15px 50px', background: isCurrentLoading ? '#30363d' : 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)', color: '#07090e', border: 'none', borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 20px rgba(212,175,55,0.4)' }}>
            {isCurrentLoading ? '⚡ جاري فحص رادارات القصر الملكي...' : (activeTab === 'cluster' ? '🚀 بدء التحليل السيادي العميق (كابوس الحيتان والمصائد)' : '⚡ بدء الفحص السريع لموجات الترند الملكي')}
          </button>
        </div>

        {/* شبكة عرض الأسهم */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '22px' }}>
          {displayedSymbols.map((sym) => {
            const data = currentRes[sym];
            const isMatched = data?.isSuitable && data?.confidenceScore >= minConfidence;
            const isEarly = data?.isEarlyAlert && !isMatched;

            return (
              <div key={sym} style={{ background: '#0d111a', padding: '22px', borderRadius: '18px', border: isMatched ? '2px solid #d4af37' : '1px solid #21262d', position: 'relative', boxShadow: '0 8px 25px rgba(0,0,0,0.6)' }}>
                
                {/* رأس البطاقة */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #21262d', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)', color: '#07090e', padding: '6px 12px', borderRadius: '8px', fontWeight: '900', fontSize: '16px' }}>{sym}</div>
                    <div>
                      <div style={{ color: '#d4af37', fontSize: '13px', fontWeight: 'bold' }}>{isEarly ? '⏳ إنذار استباقي مبكر الملكي' : isMatched ? '👑 فرصة صيد حقيقية ومؤكدة بدقة ملكية' : '🛡️ قيد المراقبة الاستباقية'}</div>
                      <div style={{ color: '#9ca3af', fontSize: '10.5px' }}>نظام الاستخبارات الذكي لرصد تحركات الحيتان</div>
                    </div>
                  </div>
                  <button onClick={() => removeSymbol(sym)} style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>حذف</button>
                </div>

                {data ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                      <div style={{ background: '#07090e', padding: '10px', borderRadius: '10px', border: '1px solid #1f2937', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>السعر الحالي</div>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: '#4ade80' }}>${data.price}</div>
                      </div>
                      <div style={{ background: '#07090e', padding: '10px', borderRadius: '10px', border: '1px solid #1f2937', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>مؤشر RSI</div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#c084fc' }}>{data.rsiShort || '29.1'}</div>
                      </div>
                      <div style={{ background: '#07090e', padding: '10px', borderRadius: '10px', border: '1px solid #d4af3733', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#d4af37' }}>نسبة الثقة</div>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: '#d4af37' }}>{data.confidenceScore || 85}%</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setChartModalSymbol(sym)} style={{ flex: 1, background: '#0284c7', color: '#fff', border: 'none', padding: '9px', borderRadius: '8px', fontSize: '11.5px', cursor: 'pointer', fontWeight: 'bold' }}>📈 شارت TradingView</button>
                      <button onClick={() => enterTrade(sym, data.price)} style={{ flex: 2, background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '12px', cursor: 'pointer', fontWeight: '900' }}>
                        👑 اعتماد الصفقة الملكية
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', margin: '30px 0', color: '#484f58', fontSize: '12px' }}>في انتظار فحص رادار القصر الملكي...</div>
                )}
              </div>
            );
          })}
        </div>

        {/* نافذة شارت TradingView */}
        {chartModalSymbol && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
            <div style={{ background: '#0d111a', padding: '20px', borderRadius: '16px', border: '1px solid #d4af37', width: '95%', maxWidth: '1000px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #21262d', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#d4af37', fontSize: '18px' }}>📈 الرسم البياني السيادي (TradingView) - السهم: {chartModalSymbol}</h3>
                <button onClick={() => setChartModalSymbol(null)} style={{ background: '#7f1d1d', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>إغلاق ✕</button>
              </div>
              <div style={{ flex: 1, width: '100%', background: '#000', borderRadius: '10px', overflow: 'hidden' }}>
                <iframe src={`https://s.tradingview.com/widgetembed/?symbol=${chartModalSymbol}&interval=D&theme=dark&locale=ar`} style={{ width: '100%', height: '100%', border: 'none' }} title="TradingView" />
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
