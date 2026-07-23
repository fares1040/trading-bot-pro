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
  const [minConfidence, setMinConfidence] = useState(70);
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const [filterOnlySuitable, setFilterOnlySuitable] = useState(false);
  const [activeRadarFilter, setActiveRadarFilter] = useState('all'); 
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [timer, setTimer] = useState(300);

  // التنبيهات الاستباقية وحاسبة المظلة (Parachute Trailing Stop)
  const [earlyAlertsEnabled, setEarlyAlertsEnabled] = useState(true);
  const [parachuteActive, setParachuteActive] = useState(true);

  // سجل إحصائيات الأداء الذكي وتاريخ التنبيهات
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

  // حالة فتح نافذة شارت TradingView المتقدم لكل سهم
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

  const sendWebhookAlert = async (sym, analysisText, isEarly = false) => {
    if (!webhookUrl.trim()) return;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: isEarly ? `⏳ **إنذار استباقي مبكر لكابوس الحيتان** 🎯\nاقتراب هدف على السهم: **${sym}**\n\n\`\`\`${analysisText}\`\`\`` : `🚨 **تنبيه عسكري فوري للمنصة** 🎯\nرصد هدف على السهم: **${sym}**\n\n\`\`\`${analysisText}\`\`\`` })
      });
    } catch (e) {}
  };

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
      speakAlert(isEarly ? `تنبيه استباقي. السهم ${sym} يقترب بشدة من منطقة الهدف` : `تنبيه رادار كابوس الحيتان. تم رصد فرصة ذهبية على السهم ${sym}`);
      sendWebhookAlert(sym, analysisText, isEarly);
      
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
        newResults[sym] = { error: "فشل الاتصال بمحرك التحليل الاستخباراتي" };
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
        newResults[sym] = { error: "فشل الاتصال بالرادار اللحظي" };
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
        playRadarSound(data.matched[0], "مسح راداري استثماري موسع لكابوس الحيتان");
        alert(`🎯 رادار السوق الحي اصطاد ${data.matched.length} سهم قيادي ونشط بنسبة ثقة مطابقة!`);
        runAnalysis();
      } else {
        alert('لا توجد أسهم جديدة مطابقة لشروط نسبة الثقة حالياً من السوق.');
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
        playRadarSound(data.matched[0], "مسح راداري للسكالبينج من السوق الحي");
        alert(`⚡ رادار السكالبينج سحب ${data.matched.length} سهم ترند فجائي من السوق الحي!`);
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
      type: activeTab === 'cluster' ? 'استثمار (كلاستر وكابوس الحيتان)' : 'سكالبينج (ترند لحظي)',
      stopLoss: (p * 0.97).toFixed(2),
      targets: {
        t1: (p * 1.025).toFixed(2),
        t2: (p * 1.050).toFixed(2),
        t3: (p * 1.080).toFixed(2)
      },
      status: 'نشطة'
    };
    setActiveTrades(prev => [newTrade, ...prev]);
    alert(`🎯 تم فتح الصفقة بنجاح على [${sym}] بسعر [${p}]!\n🪂 تم تفعيل حاسبة المظلة الآلية والأهداف التدريجية.`);
  };

  const closeActiveTrade = (tradeId) => {
    setActiveTrades(prev => prev.filter(t => t.id !== tradeId));
    alert('✅ تم إغلاق الصفقة بنجاح وترحيلها لسجل الأداء.');
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
    alert('📋 تم نسخ تفاصيل التحليل بنجاح!');
  };

  const copyAllIntelBriefing = () => {
    const activeList = activeTab === 'cluster' ? symbols : scalpSymbols;
    const activeRes = activeTab === 'cluster' ? results : scalpResults;
    const suitableSymbols = activeList.filter(sym => activeRes[sym] && (activeRes[sym].isSuitable || activeRes[sym].isEarlyAlert));
    
    if (suitableSymbols.length === 0) {
      alert('⚠️ لا توجد فرص أو تنبيهات استباقية مطابقة لنسخ تقريرها!');
      return;
    }

    let report = `🎯 **تقرير العمليات والذكاء الاصطناعي لكابوس الحيتان (${activeTab === 'cluster' ? 'استثمار 4 ساعات' : 'سكالبينج لحظي'})** 📊\n\n`;
    suitableSymbols.forEach((sym, index) => {
      report += `[الهدف #${index + 1}] - الرمز: ${sym}\n${activeRes[sym].analysis}\n-------------------\n\n`;
    });

    navigator.clipboard.writeText(report);
    alert('📋 تم نسخ التقرير الشامل بنجاح!');
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
    if (activeRadarFilter === 'dark_pools' && (!data || !data.darkPoolActivity)) return false;

    return true;
  });

  const totalAnalyzed = Object.keys(currentRes).length;
  const suitableCount = Object.values(currentRes).filter(r => r?.isSuitable || r?.isEarlyAlert).length;
  const successRate = totalAnalyzed > 0 ? ((suitableCount / totalAnalyzed) * 100).toFixed(1) : '0.0';
  const marketMomentumScore = totalAnalyzed > 0 ? Math.round((suitableCount / totalAnalyzed) * 100) : 0;
  const totalRecordedTrades = tradeStats.wins + tradeStats.losses;
  const winRatePercent = totalRecordedTrades > 0 ? Math.round((tradeStats.wins / totalRecordedTrades) * 100) : 0;

  return (
    <main style={{ padding: '25px', direction: 'rtl', fontFamily: 'Tahoma, sans-serif', background: '#030712', color: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* العنوان الرئيسي */}
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <h1 style={{ color: '#facc15', fontSize: '26px', fontWeight: '900', margin: '0 0 5px 0' }}>
            🎯 منصتي سنايبر الاحترافية (نسخة كابوس الحيتان الاستخباراتية 🔥)
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            رادار مصائد السيولة (Stop Hunting)، الأوامر المخفية (Iceberg)، الثقوب السوداء، حاسبة المظلة وشارت TradingView
          </p>
        </div>

        {/* لوحة التحكم المباشرة */}
        <div style={{ background: '#0f172a', padding: '18px', borderRadius: '14px', border: '1px solid #f59e0b', marginBottom: '20px' }}>
          <h3 style={{ color: '#facc15', fontSize: '13px', fontWeight: 'bold', margin: '0 0 12px 0' }}>
            ⚙️ لوحة التحكم العسكري المباشر:
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '11.5px', color: '#cbd5e1', display: 'block', marginBottom: '5px' }}>
                الحد الأدنى لنسبة الثقة الانعكاسية: <strong style={{ color: '#facc15' }}>{minConfidence}%</strong>
              </label>
              <input
                type="range"
                min="50"
                max="95"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', color: '#cbd5e1', display: 'block', marginBottom: '5px' }}>
                فترة تبريد التنبيهات (بالدقائق): <strong style={{ color: '#38bdf8' }}>{cooldownMinutes} د</strong>
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                style={{ width: '100%', padding: '6px 10px', background: '#030712', border: '1px solid #475569', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', color: '#cbd5e1', display: 'block', marginBottom: '5px' }}>
                رابط Discord / Webhook URL:
              </label>
              <input
                type="text"
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: '#030712', border: '1px solid #475569', borderRadius: '6px', color: '#fff', fontSize: '11.5px' }}
              />
            </div>
          </div>
        </div>

        {/* التبديل بين الأقسام */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => { setActiveTab('cluster'); setFilterOnlySuitable(false); }}
            style={{ padding: '10px 22px', background: activeTab === 'cluster' ? '#d97706' : '#0f172a', color: '#fff', border: '1px solid #f59e0b', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            📊 الكلاستر وكابوس الحيتان [{symbols.length} سهم]
          </button>
          <button 
            onClick={() => { setActiveTab('scalp'); setFilterOnlySuitable(false); }}
            style={{ padding: '10px 22px', background: activeTab === 'scalp' ? '#9333ea' : '#0f172a', color: '#fff', border: '1px solid #c084fc', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ⚡ موجات الترند اللحظي (سكالبينج) [{scalpSymbols.length} سهم]
          </button>
        </div>

        {/* شريط الأزرار العلوية المتقدمة */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '12px 18px', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setShowHistoryModal(true)} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              📜 سجل العمليات والأداء ({missionHistory.length})
            </button>
            <button onClick={() => setShowTradesModal(true)} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              🎯 صفقاتي المفتوحة والمظلة ({activeTrades.length})
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e293b', padding: '4px 8px', borderRadius: '8px', border: '1px solid #475569' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>نتائج الصفقات:</span>
              <button onClick={() => recordTradeOutcome('wins')} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>✅ {tradeStats.wins}</button>
              <button onClick={() => recordTradeOutcome('losses')} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>❌ {tradeStats.losses}</button>
              <span style={{ fontSize: '11px', color: '#facc15', fontWeight: 'bold' }}>({winRatePercent}%)</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ color: '#94a3b8' }}>زخم السوق:</span>
            <span style={{ color: marketMomentumScore >= 30 ? '#22c55e' : '#38bdf8', fontWeight: 'bold' }}>
              {marketMomentumScore >= 30 ? 'سيولة عالية متفجرة 🔥' : 'هدوء استباقي ومراقبة 🛡️'}
            </span>
            <span style={{ background: '#1e293b', padding: '2px 8px', borderRadius: '6px', color: '#fff', fontWeight: '900' }}>{marketMomentumScore}%</span>
          </div>
        </div>

        {/* شريط فلاتر الرادارات العسكرية المتقدمة (كابوس الحيتان) */}
        <div style={{ background: '#0f172a', padding: '12px 18px', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#facc15', fontWeight: 'bold' }}>🎯 فلاتر كابوس الحيتان:</span>
            <button onClick={() => setActiveRadarFilter('all')} style={{ background: activeRadarFilter === 'all' ? '#d97706' : '#1e293b', color: '#fff', border: '1px solid #475569', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>الكل</button>
            <button onClick={() => setActiveRadarFilter('whales')} style={{ background: activeRadarFilter === 'whales' ? '#16a34a' : '#1e293b', color: '#fff', border: '1px solid #475569', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>🐋 رادار الحيتان</button>
            <button onClick={() => setActiveRadarFilter('traps')} style={{ background: activeRadarFilter === 'traps' ? '#dc2626' : '#1e293b', color: '#fff', border: '1px solid #475569', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>🛑 كاشف الفخاخ (Stop Hunt)</button>
            <button onClick={() => setActiveRadarFilter('stealth')} style={{ background: activeRadarFilter === 'stealth' ? '#0d9488' : '#1e293b', color: '#fff', border: '1px solid #475569', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>🧊 التراكم الخفي (Iceberg)</button>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setParachuteActive(!parachuteActive)} style={{ background: parachuteActive ? '#16a34a' : '#1e293b', color: '#fff', border: '1px solid #475569', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
              {parachuteActive ? '🪂 حاسبة المظلة: مفعلة' : '🪂 حاسبة المظلة: معطلة'}
            </button>
            <button onClick={() => setFilterOnlySuitable(!filterOnlySuitable)} style={{ background: filterOnlySuitable ? '#16a34a' : '#1e293b', color: '#fff', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
              {filterOnlySuitable ? `✅ الفرص المكتملة` : '📊 عرض الكل'}
            </button>
            <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ background: autoRefresh ? '#7c3aed' : '#1e293b', color: '#fff', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
              {autoRefresh ? `⚡ رادار آلي (${Math.floor(timer/60)}:${timer%60 < 10 ? '0':''}${timer%60})` : '⚡ فحص آلي'}
            </button>
          </div>
        </div>

        {/* لوحات المؤشرات */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>نسبة قبول الصفقات</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#38bdf8' }}>{successRate}%</div>
          </div>
          <div style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #065f46', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>الفرص والإنذارات المطابقة ✅</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#4ade80' }}>{suitableCount} فرصة</div>
          </div>
          <div style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>الأسهم المفحوصة</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#facc15' }}>{totalAnalyzed} / {currentList.length}</div>
          </div>
          <div style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>إجمالي الأسهم بالمراقبة</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#c084fc' }}>{currentList.length} سهم</div>
          </div>
        </div>

        {/* إضافة سهم، رادار السوق الحي، ونسخ التقرير */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '25px', flexWrap: 'wrap', alignItems: 'center' }}>
          <form onSubmit={addSymbol} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="أدخل رمز السهم (مثال: TSLA)" 
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#fff', outline: 'none', fontSize: '13px', width: '180px' }}
            />
            <button type="submit" style={{ padding: '10px 16px', background: activeTab === 'cluster' ? '#d97706' : '#9333ea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>إضافة</button>
          </form>

          {activeTab === 'cluster' ? (
            <button onClick={scanMarketForCluster} disabled={scanning} style={{ padding: '10px 16px', background: scanning ? '#475569' : '#059669', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              {scanning ? '🔄 جاري جلب السوق الحي...' : '🐋 سحب الأسهم الرابحة وكابوس الحيتان'}
            </button>
          ) : (
            <button onClick={scanMarketForScalp} disabled={scanning} style={{ padding: '10px 16px', background: scanning ? '#475569' : '#9333ea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              {scanning ? '🔄 جاري جلب السوق الحي...' : '⚡ سحب سكالبينج من السوق الحي'}
            </button>
          )}

          <button onClick={copyAllIntelBriefing} style={{ padding: '10px 16px', background: '#0369a1', color: '#fff', border: '1px solid #38bdf8', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            📑 نسخ التقرير الشامل لكابوس الحيتان
          </button>
        </div>

        {/* زر الفحص الرئيسي */}
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <button 
            onClick={activeTab === 'cluster' ? runAnalysis : runScalpAnalysis} 
            disabled={isCurrentLoading}
            style={{ padding: '14px 45px', background: isCurrentLoading ? '#475569' : (activeTab === 'cluster' ? '#d97706' : '#9333ea'), color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
          >
            {isCurrentLoading ? '⚡ جاري فحص رادارات كابوس الحيتان وألاعيبهم...' : (activeTab === 'cluster' ? '🚀 بدء التحليل الاستخباراتي العميق (كابوس الحيتان والمصائد)' : '⚡ بدء الفحص السريع لموجات الترند')}
          </button>
        </div>

        {/* شبكة عرض الأسهم */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '22px' }}>
          {displayedSymbols.map((sym) => {
            const data = currentRes[sym];
            const isMatched = data?.isSuitable && data?.confidenceScore >= minConfidence;
            const isEarly = data?.isEarlyAlert && !isMatched;

            return (
              <div key={sym} style={{ background: '#0f172a', padding: '20px', borderRadius: '16px', border: isMatched ? '2px solid #22c55e' : isEarly ? '2px solid #f59e0b' : '1px solid #1e293b', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, color: '#facc15', fontSize: '20px', fontWeight: '800' }}>{sym}</h3>
                    {isMatched && <span style={{ background: '#064e3b', color: '#4ade80', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>هدف مؤكد 🔥</span>}
                    {isEarly && <span style={{ background: '#451a03', color: '#f59e0b', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>إنذار استباقي ⏳</span>}
                  </div>
                  <button onClick={() => removeSymbol(sym)} style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>حذف</button>
                </div>

                {data ? (
                  <div>
                    <div style={{ background: '#030712', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b', marginBottom: '12px' }}>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12px', color: '#e2e8f0', margin: 0, lineHeight: '1.5' }}>
                        {data.analysis || data.error}
                      </pre>
                    </div>

                    {isMatched || isEarly ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setChartModalSymbol(sym)} style={{ flex: 1, background: '#0284c7', color: '#fff', border: 'none', padding: '8px', textAlign: 'center', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>📈 شارت TradingView</button>
                          <button onClick={() => copyToClipboard(data.analysis)} style={{ flex: 1, background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>📋 نسخ التقرير</button>
                        </div>
                        <button onClick={() => enterTrade(sym, data.price)} style={{ width: '100%', background: isMatched ? '#16a34a' : '#d97706', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', cursor: 'pointer', fontWeight: '900' }}>
                          🎯 أنا دخلت الصفقة (تفعيل حاسبة المظلة)
                        </button>
                      </div>
                    ) : (
                      <div style={{ background: '#451a03', color: '#fdba74', padding: '8px', textAlign: 'center', borderRadius: '8px', fontSize: '11.5px', fontWeight: 'bold' }}>
                        قيد المراقبة الاستباقية - لم يبلغ شرط نسبة الثقة ({minConfidence}%) ❌
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', margin: '30px 0' }}>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>في انتظار فحص رادار كابوس الحيتان...</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* نافذة شارت TradingView المتقدم المدمج */}
        {chartModalSymbol && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
            <div style={{ background: '#0f172a', padding: '20px', borderRadius: '16px', border: '1px solid #f59e0b', width: '95%', maxWidth: '1000px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#facc15', fontSize: '18px' }}>📈 الرسم البياني المتقدم (TradingView) - السهم: {chartModalSymbol}</h3>
                <button onClick={() => setChartModalSymbol(null)} style={{ background: '#7f1d1d', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>إغلاق ✕</button>
              </div>
              <div style={{ flex: 1, width: '100%', background: '#000', borderRadius: '10px', overflow: 'hidden' }}>
                <iframe
                  src={`https://s.tradingview.com/widgetembed/?symbol=${chartModalSymbol}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=exchange&withdateranges=1&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=ar&utm_source=&utm_medium=widget&utm_campaign=chart&utm_term=${chartModalSymbol}`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="TradingView Chart"
                />
              </div>
            </div>
          </div>
        )}

        {/* نافذة صفقاتي المفتوحة والمظلة */}
        {showTradesModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: '#0f172a', padding: '25px', borderRadius: '16px', border: '1px solid #16a34a', width: '90%', maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#4ade80', fontSize: '18px' }}>🎯 صفقاتي المفتوحة (حاسبة المظلة وتأمين الأرباح الآلي)</h3>
                <button onClick={() => setShowTradesModal(false)} style={{ background: '#7f1d1d', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>إغلاق</button>
              </div>
              {activeTrades.length === 0 ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>لا توجد صفقات مسجلة حالياً.</p>
              ) : (
                activeTrades.map((t) => (
                  <div key={t.id} style={{ background: '#030712', padding: '14px', borderRadius: '10px', border: '1px solid #1e293b', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ color: '#facc15', fontSize: '15px', fontWeight: 'bold', marginBottom: '4px' }}>
                        🎯 الرمز: {t.symbol} <span style={{ color: '#38bdf8', fontSize: '11px' }}>({t.type})</span>
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '12.5px', lineHeight: '1.5' }}>
                        سعر الدخول: <strong style={{ color: '#4ade80' }}>{t.entryPrice}</strong> | وقف الخسارة المظلي: <strong style={{ color: '#ef4444' }}>{t.stopLoss}</strong><br/>
                        🎯 أهداف الخروج: الهدف 1: {t.targets.t1} | الهدف 2: {t.targets.t2} | الهدف 3: {t.targets.t3}
                      </div>
                    </div>
                    <button onClick={() => closeActiveTrade(t.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      إغلاق وتسيير الصفقة 🛑
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* نافذة سجل العمليات */}
        {showHistoryModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: '#0f172a', padding: '25px', borderRadius: '16px', border: '1px solid #f59e0b', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#facc15', fontSize: '18px' }}>📜 سجل العمليات الحربية لكابوس الحيتان</h3>
                <button onClick={() => setShowHistoryModal(false)} style={{ background: '#7f1d1d', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>إغلاق</button>
              </div>
              {missionHistory.length === 0 ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>لا توجد عمليات مسجلة حتى الآن.</p>
              ) : (
                missionHistory.map((item) => (
                  <div key={item.id} style={{ background: '#030712', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#facc15', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>
                      <span>🎯 الهدف: {item.symbol} {item.isEarly ? '(إنذار استباقي ⏳)' : ''}</span>
                      <span style={{ color: '#94a3b8', fontSize: '11px' }}>{item.time}</span>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '11.5px', color: '#cbd5e1', margin: 0 }}>
                      {item.details}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
