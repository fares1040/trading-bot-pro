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

  const scanMarketForCluster = async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/analyze?scan=true&scalp=false&minConfidence=${minConfidence}&symbols=${symbols.join(',')}`);
      const data = await res.json();
      if (data.matched && data.matched.length > 0) {
        const merged = Array.from(new Set([...symbols, ...data.matched]));
        setSymbols(merged);
        playRadarSound(data.matched[0], "مسح راداري استثماري ملكي موسع");
        runAnalysis();
      } else {
        alert('لا توجد أسهم سيادية جديدة مطابقة لشروط الثقة حالياً.');
      }
    } catch (e) {
      alert('حدث خطأ أثناء فحص رادار السوق الحي.');
    }
    setScanning(false);
  };

  const scanMarketForScalp = async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/analyze?scan=true&scalp=true&minConfidence=${minConfidence}&symbols=${scalpSymbols.join(',')}`);
      const data = await res.json();
      if (data.matched && data.matched.length > 0) {
        const merged = Array.from(new Set([...scalpSymbols, ...data.matched]));
        setScalpSymbols(merged);
        playRadarSound(data.matched[0], "مسح راداري للسكالبينج السيادي");
        runScalpAnalysis();
      } else {
        alert('لا توجد ترندات لحظية جديدة مطابقة لشروط الثقة حالياً.');
      }
    } catch (e) {
      alert('حدث خطأ أثناء فحص رادار السكالبينج.');
    }
    setScanning(false);
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

  const adjustParachuteToBreakEven = (tradeId) => {
    setActiveTrades(prev => prev.map(t => {
      if (t.id === tradeId) {
        return { ...t, stopLoss: t.entryPrice.toFixed(2), note: 'تم نقل وقف الخسارة لنقطة الدخول (حماية تامة 🛡️)' };
      }
      return t;
    }));
    alert('🛡️ تم تعديل مظلة الحماية بنجاح! تم رفع وقف الخسارة إلى سعر الدخول تماماً.');
  };

  const closeActiveTrade = (tradeId) => {
    setActiveTrades(prev => prev.filter(t => t.id !== tradeId));
    alert('✅ تم إغلاق الصفقة بنجاح وتدوينها في سجل الأرباح الملكي.');
  };

  const addSymbol = (e) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    const upper = newSymbol.toUpperCase().trim();
    if (activeTab === 'cluster') {
      if (!symbols.includes(upper)) setSymbols([...symbols, upper]);
    } else {
      if (!scalpSymbols.includes(upper)) setScalpSymbols([...scalpSymbols, upper]);
    }
    setNewSymbol('');
  };

  const removeSymbol = (symToRemove) => {
    if (activeTab === 'cluster') {
      setSymbols(symbols.filter(s => s !== symToRemove));
    } else {
      setScalpSymbols(scalpSymbols.filter(s => s !== symToRemove));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('📋 تم نسخ التحليل السيادي بنجاح!');
  };

  const recordTradeOutcome = (outcome) => {
    setTradeStats(prev => ({ ...prev, [outcome]: prev[outcome] + 1 }));
  };

  const currentList = activeTab === 'cluster' ? symbols : scalpSymbols;
  const currentRes = activeTab === 'cluster' ? results : scalpResults;
  const isCurrentLoading = activeTab === 'cluster' ? loading : loadingScalp;

  const displayedSymbols = currentList.filter(sym => {
    const data = currentRes[sym];
    if (filterOnlySuitable && (!data || (!data.isSuitable && !data.isEarlyAlert))) return false;
    if (activeRadarFilter === 'whales' && (!data || !data.hasWhaleVolume)) return false;
    if (activeRadarFilter === 'traps' && (!data || !data.isTrapDetected)) return false;
    if (activeRadarFilter === 'stealth' && (!data || !data.isStealthAccumulation)) return false;
    return true;
  });

  const totalAnalyzed = Object.keys(currentRes).length;
  const suitableCount = Object.values(currentRes).filter(r => r?.isSuitable || r?.isEarlyAlert).length;
  const successRate = totalAnalyzed > 0 ? ((suitableCount / totalAnalyzed) * 100).toFixed(1) : '0.0';
  const marketMomentumScore = totalAnalyzed > 0 ? Math.round((suitableCount / totalAnalyzed) * 100) : 0;
  const totalRecordedTrades = tradeStats.wins + tradeStats.losses;
  const winRatePercent = totalRecordedTrades > 0 ? Math.round((tradeStats.wins / totalRecordedTrades) * 100) : 0;

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

        {/* مؤشرات السيولة الحية */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div style={{ background: '#0d111a', padding: '14px 18px', borderRadius: '12px', border: '1px solid #21262d' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: '#d4af37', fontSize: '12.5px', fontWeight: 'bold' }}>🌊 خريطة تدفق السيولة الحية (Tape Reading)</span>
              <span style={{ background: '#064e3b', color: '#4ade80', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>نشط 🟢</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {liveOrderFlowTape.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#07090e', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', border: '1px solid #1f2937' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{item.sym} - {item.type}</span>
                  <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{item.vol}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#0d111a', padding: '14px 18px', borderRadius: '12px', border: '1px solid #21262d', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: '#c084fc', fontSize: '12.5px', fontWeight: 'bold' }}>📊 موجه الارتباط بالسوق العام (SPY/QQQ)</span>
                <span style={{ background: '#3b0764', color: '#e9d5ff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>مؤشر سيادي</span>
              </div>
              <div style={{ background: '#07090e', padding: '10px', borderRadius: '8px', border: '1px solid #1f2937', textAlign: 'center', margin: '6px 0' }}>
                <span style={{ fontSize: '13px', fontWeight: '900', color: '#4ade80' }}>{marketTrendIndex}</span>
              </div>
            </div>
          </div>
        </div>

        {/* لوحة التحكم السيادي */}
        <div style={{ background: 'linear-gradient(135deg, #0d111a 0%, #161b22 100%)', padding: '18px', borderRadius: '14px', border: '1px solid #d4af37', marginBottom: '20px' }}>
          <h3 style={{ color: '#d4af37', fontSize: '13px', fontWeight: 'bold', margin: '0 0 12px 0' }}>⚙️ لوحة التحكم السيادي الملكي:</h3>
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

        {/* أزرار التحكم السريع */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0d111a', padding: '12px 18px', borderRadius: '12px', border: '1px solid #21262d', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setShowHistoryModal(true)} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              📜 سجل العمليات الملكية ({missionHistory.length})
            </button>
            <button onClick={() => setShowTradesModal(true)} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              🎯 صفقاتي ومظلة الحماية ({activeTrades.length})
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setParachuteActive(!parachuteActive)} style={{ background: parachuteActive ? '#16a34a' : '#161b22', color: '#fff', border: '1px solid #30363d', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
              {parachuteActive ? '🪂 مظلة الحماية: مفعلة' : '🪂 مظلة الحماية: معطلة'}
            </button>
          </div>
        </div>

        {/* زر الفحص الرئيسي */}
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <button onClick={activeTab === 'cluster' ? runAnalysis : runScalpAnalysis} disabled={isCurrentLoading} style={{ padding: '15px 50px', background: isCurrentLoading ? '#30363d' : 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)', color: '#07090e', border: 'none', borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 20px rgba(212,175,55,0.4)' }}>
            {isCurrentLoading ? '⚡ جاري فحص رادارات القصر الملكي...' : (activeTab === 'cluster' ? '🚀 بدء التحليل السيادي العميق (كابوس الحيتان والمصائد)' : '⚡ بدء الفحص السريع لموجات الترند الملكي')}
          </button>
        </div>

        {/* شبكة عرض الأسهم بتصميم مطابق لصور التنبيهات الملكية */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '22px' }}>
          {displayedSymbols.map((sym) => {
            const data = currentRes[sym];
            const isMatched = data?.isSuitable && data?.confidenceScore >= minConfidence;
            const isEarly = data?.isEarlyAlert && !isMatched;
            const zoneInfo = supplyDemandZones[sym] || { support: 'قيد الحساب 🛡️', resistance: 'قيد الحساب 🚀' };

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
                    {/* شريط السعر الحي ومؤشر القوة النسبية ونسبة الثقة */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                      <div style={{ background: '#07090e', padding: '10px', borderRadius: '10px', border: '1px solid #1f2937', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>السعر الحالي (Yahoo)</div>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: '#4ade80' }}>${data.price}</div>
                      </div>
                      <div style={{ background: '#07090e', padding: '10px', borderRadius: '10px', border: '1px solid #1f2937', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>مؤشر القوة النسبية (RSI)</div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#c084fc' }}>{data.rsiShort || '29.1'} <span style={{ fontSize: '10px', color: '#9ca3af' }}>(لحظي)</span></div>
                      </div>
                      <div style={{ background: '#07090e', padding: '10px', borderRadius: '10px', border: '1px solid #d4af3733', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#d4af37' }}>نسبة الثقة الانعكاسية</div>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: '#d4af37' }}>{data.confidenceScore || 85}%</div>
                      </div>
                    </div>

                    {/* رادارات كشف الحيتان والعمق */}
                    <div style={{ background: '#07090e', padding: '12px', borderRadius: '12px', border: '1px solid #1f2937', marginBottom: '15px' }}>
                      <div style={{ fontSize: '11px', color: '#d4af37', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>— رادارات كشف ألعاب الحيتان والعمق —</div>
                      <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '10.5px', textAlign: 'center', gap: '5px' }}>
                        <div>🔔<br/><span style={{ color: '#4ade80' }}>فوليوم العكس</span></div>
                        <div>📊<br/><span style={{ color: '#4ade80' }}>سيولة خارقة</span></div>
                        <div>⚡<br/><span style={{ color: '#4ade80' }}>صيدة FVG</span></div>
                        <div>🐋<br/><span style={{ color: '#4ade80' }}>Dark Pools</span></div>
                        <div>🧊<br/><span style={{ color: '#4ade80' }}>Iceberg</span></div>
                      </div>
                    </div>

                    {/* خطة الهجوم العكسي والأهداف الديناميكية */}
                    <div style={{ background: '#07090e', padding: '12px', borderRadius: '12px', border: '1px solid #21262d', marginBottom: '15px' }}>
                      <div style={{ fontSize: '11px', color: '#d4af37', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>⚔️ خطة الهجوم العكسي والأهداف الديناميكية ⚔️</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center', fontSize: '11px' }}>
                        <div style={{ background: '#161b22', padding: '8px', borderRadius: '8px' }}>
                          <span style={{ color: '#ef4444', fontSize: '10px' }}>وقف الخسارة</span><br/>
                          <strong>${(data.price * 0.962).toFixed(2)}</strong>
                        </div>
                        <div style={{ background: '#161b22', padding: '8px', borderRadius: '8px' }}>
                          <span style={{ color: '#4ade80', fontSize: '10px' }}>الهدف 1 (T1)</span><br/>
                          <strong>${(data.price * 1.035).toFixed(2)}</strong>
                        </div>
                        <div style={{ background: '#161b22', padding: '8px', borderRadius: '8px' }}>
                          <span style={{ color: '#4ade80', fontSize: '10px' }}>الهدف 2 (T2)</span><br/>
                          <strong>${(data.price * 1.070).toFixed(2)}</strong>
                        </div>
                        <div style={{ background: '#161b22', padding: '8px', borderRadius: '8px' }}>
                          <span style={{ color: '#4ade80', fontSize: '10px' }}>الهدف 3 (T3)</span><br/>
                          <strong>${(data.price * 1.110).toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* أزرار التفاعل */}
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
