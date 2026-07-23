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

  // التنبيهات الاستباقية وحاسبة المظلة الملكية
  const [earlyAlertsEnabled, setEarlyAlertsEnabled] = useState(true);
  const [parachuteActive, setParachuteActive] = useState(true);

  // سجل إحصائيات الأداء الملكي وتاريخ التنبيهات
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
        body: JSON.stringify({ content: isEarly ? `⏳ **إنذار استباقي مبكر - القصر الملكي** 👑\nاقتراب هدف سيادي على السهم: **${sym}**\n\n\`\`\`${analysisText}\`\`\`` : `🚨 **تنبيه سيادي فوري للمنصة** 👑\nرصد فرصة ملكية على السهم: **${sym}**\n\n\`\`\`${analysisText}\`\`\`` })
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
      speakAlert(isEarly ? `تنبيه ملكي استباقي. السهم ${sym} يقترب من منطقة الهدف` : `تنبيه رادار القصر الملكي. تم رصد فرصة استثمارية ذهبية على السهم ${sym}`);
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
        alert(`👑 رادار القصر اصطاد ${data.matched.length} سهم قيادي ونشط بنسبة ثقة مطابقة!`);
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
        alert(`⚡ رادار السكالبينج الملكي سحب ${data.matched.length} سهم ترند فجائي!`);
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
      stopLoss: (p * 0.97).toFixed(2),
      targets: {
        t1: (p * 1.025).toFixed(2),
        t2: (p * 1.050).toFixed(2),
        t3: (p * 1.080).toFixed(2)
      },
      status: 'نشطة'
    };
    setActiveTrades(prev => [newTrade, ...prev]);
    alert(`👑 تم اعتماد الصفقة ملكياً على [${sym}] بسعر [${p}]!\n🪂 تم تفعيل حاسبة المظلة السيادية والأهداف التدريجية.`);
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

  const copyAllIntelBriefing = () => {
    const activeList = activeTab === 'cluster' ? symbols : scalpSymbols;
    const activeRes = activeTab === 'cluster' ? results : scalpResults;
    const suitableSymbols = activeList.filter(sym => activeRes[sym] && (activeRes[sym].isSuitable || activeRes[sym].isEarlyAlert));
    
    if (suitableSymbols.length === 0) {
      alert('⚠️ لا توجد فرص أو تنبيهات مطابقة لنسخ تقريرها الملكي!');
      return;
    }

    let report = `👑 **تقرير الصفقات والذكاء السيادي لكابوس الحيتان (${activeTab === 'cluster' ? 'استثمار سيادي' : 'سكالبينج ملكي'})** 📊\n\n`;
    suitableSymbols.forEach((sym, index) => {
      report += `[الهدف الملكي #${index + 1}] - الرمز: ${sym}\n${activeRes[sym].analysis}\n-------------------\n\n`;
    });

    navigator.clipboard.writeText(report);
    alert('📋 تم نسخ التقرير الملكي الشامل بنجاح!');
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
    <main style={{ padding: '25px', direction: 'rtl', fontFamily: 'Tahoma, sans-serif', background: '#07090e', color: '#f3f4f6', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* العنوان الرئيسي الملكي */}
        <div style={{ textAlign: 'center', marginBottom: '18px', borderBottom: '1px solid #d4af3733', paddingBottom: '15px' }}>
          <h1 style={{ color: '#d4af37', fontSize: '28px', fontWeight: '900', margin: '0 0 5px 0', textShadow: '0 2px 10px rgba(212,175,55,0.2)' }}>
            👑 منصتي سنايبر الملكية السيادية (نسخة كابوس الحيتان الفاخرة 🔥)
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
            غرفة التداول الخاصة لكبار المستثمرين • رادار مصائد السيولة والأوامر المخفية • حاسبة المظلة الملكية وشارت TradingView
          </p>
        </div>

        {/* لوحة التحكم الملكية المباشرة */}
        <div style={{ background: 'linear-gradient(135deg, #0d111a 0%, #161b22 100%)', padding: '18px', borderRadius: '14px', border: '1px solid #d4af37', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          <h3 style={{ color: '#d4af37', fontSize: '13px', fontWeight: 'bold', margin: '0 0 12px 0' }}>
            ⚙️ لوحة التحكم السيادي الملكي:
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '11.5px', color: '#d1d5db', display: 'block', marginBottom: '5px' }}>
                الحد الأدنى لنسبة الثقة الانعكاسية: <strong style={{ color: '#d4af37' }}>{minConfidence}%</strong>
              </label>
              <input
                type="range"
                min="50"
                max="95"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', color: '#d1d5db', display: 'block', marginBottom: '5px' }}>
                فترة تبريد التنبيهات (بالدقائق): <strong style={{ color: '#38bdf8' }}>{cooldownMinutes} د</strong>
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                style={{ width: '100%', padding: '6px 10px', background: '#0b0f17', border: '1px solid #30363d', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', color: '#d1d5db', display: 'block', marginBottom: '5px' }}>
                رابط Discord / Webhook URL:
              </label>
              <input
                type="text"
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: '#0b0f17', border: '1px solid #30363d', borderRadius: '6px', color: '#fff', fontSize: '11.5px' }}
              />
            </div>
          </div>
        </div>

        {/* التبديل بين الأقسام الملكية */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => { setActiveTab('cluster'); setFilterOnlySuitable(false); }}
            style={{ padding: '11px 24px', background: activeTab === 'cluster' ? 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)' : '#0d111a', color: activeTab === 'cluster' ? '#07090e' : '#fff', border: '1px solid #d4af37', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', boxShadow: activeTab === 'cluster' ? '0 0 15px rgba(212,175,55,0.3)' : 'none' }}
          >
            👑 الاستثمار السيادي وكابوس الحيتان [{symbols.length} سهم]
          </button>
          <button 
            onClick={() => { setActiveTab('scalp'); setFilterOnlySuitable(false); }}
            style={{ padding: '11px 24px', background: activeTab === 'scalp' ? 'linear-gradient(135deg, #9333ea 0%, #6b21a8 100%)' : '#0d111a', color: '#fff', border: '1px solid #c084fc', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', boxShadow: activeTab === 'scalp' ? '0 0 15px rgba(147,51,234,0.3)' : 'none' }}
          >
            ⚡ موجات الترند الملكي (سكالبينج) [{scalpSymbols.length} سهم]
          </button>
        </div>

        {/* شريط الأزرار العلوية المتقدمة */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0d111a', padding: '12px 18px', borderRadius: '12px', border: '1px solid #21262d', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setShowHistoryModal(true)} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              📜 سجل العمليات الملكية ({missionHistory.length})
            </button>
            <button onClick={() => setShowTradesModal(true)} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              🎯 صفقاتي ومظلة الحماية ({activeTrades.length})
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#161b22', padding: '4px 8px', borderRadius: '8px', border: '1px solid #30363d' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>نتائج الصفقات:</span>
              <button onClick={() => recordTradeOutcome('wins')} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>✅ {tradeStats.wins}</button>
              <button onClick={() => recordTradeOutcome('losses')} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>❌ {tradeStats.losses}</button>
              <span style={{ fontSize: '11px', color: '#d4af37', fontWeight: 'bold' }}>({winRatePercent}%)</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ color: '#9ca3af' }}>زخم القصر:</span>
            <span style={{ color: marketMomentumScore >= 30 ? '#22c55e' : '#38bdf8', fontWeight: 'bold' }}>
              {marketMomentumScore >= 30 ? 'سيولة ملكية متفجرة 🔥' : 'هدوء سيادي ومراقبة 🛡️'}
            </span>
            <span style={{ background: '#161b22', padding: '2px 8px', borderRadius: '6px', color: '#d4af37', fontWeight: '900' }}>{marketMomentumScore}%</span>
          </div>
        </div>

        {/* شريط فلاتر الرادارات الملكية المتقدمة */}
        <div style={{ background: '#0d111a', padding: '12px 18px', borderRadius: '12px', border: '1px solid #21262d', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#d4af37', fontWeight: 'bold' }}>👑 فلاتر كابوس الحيتان السيادية:</span>
            <button onClick={() => setActiveRadarFilter('all')} style={{ background: activeRadarFilter === 'all' ? '#d4af37' : '#161b22', color: activeRadarFilter === 'all' ? '#07090e' : '#fff', border: '1px solid #30363d', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>الكل</button>
            <button onClick={() => setActiveRadarFilter('whales')} style={{ background: activeRadarFilter === 'whales' ? '#16a34a' : '#161b22', color: '#fff', border: '1px solid #30363d', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>🐋 رادار الحيتان</button>
            <button onClick={() => setActiveRadarFilter('traps')} style={{ background: activeRadarFilter === 'traps' ? '#dc2626' : '#161b22', color: '#fff', border: '1px solid #30363d', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>🛑 كاشف الفخاخ</button>
            <button onClick={() => setActiveRadarFilter('stealth')} style={{ background: activeRadarFilter === 'stealth' ? '#0d9488' : '#161b22', color: '#fff', border: '1px solid #30363d', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>🧊 التراكم الخفي</button>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setParachuteActive(!parachuteActive)} style={{ background: parachuteActive ? '#16a34a' : '#161b22', color: '#fff', border: '1px solid #30363d', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
              {parachuteActive ? '🪂 مظلة الحماية: مفعلة' : '🪂 مظلة الحماية: معطلة'}
            </button>
            <button onClick={() => setFilterOnlySuitable(!filterOnlySuitable)} style={{ background: filterOnlySuitable ? '#16a34a' : '#161b22', color: '#fff', border: '1px solid #30363d', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
              {filterOnlySuitable ? `✅ الفرص الملكية` : '📊 عرض الكل'}
            </button>
            <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ background: autoRefresh ? '#7c3aed' : '#161b22', color: '#fff', border: '1px solid #30363d', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
              {autoRefresh ? `⚡ رادار آلي (${Math.floor(timer/60)}:${timer%60 < 10 ? '0':''}${timer%60})` : '⚡ فحص آلي'}
            </button>
          </div>
        </div>

        {/* لوحات المؤشرات الملكية */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div style={{ background: '#0d111a', padding: '15px', borderRadius: '12px', border: '1px solid #21262d', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '5px' }}>نسبة قبول الصفقات</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#38bdf8' }}>{successRate}%</div>
          </div>
          <div style={{ background: '#0d111a', padding: '15px', borderRadius: '12px', border: '1px solid #065f46', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '5px' }}>الفرص والإنذارات المطابقة ✅</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#4ade80' }}>{suitableCount} فرصة</div>
          </div>
          <div style={{ background: '#0d111a', padding: '15px', borderRadius: '12px', border: '1px solid #21262d', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '5px' }}>الأسهم المفحوصة</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#d4af37' }}>{totalAnalyzed} / {currentList.length}</div>
          </div>
          <div style={{ background: '#0d111a', padding: '15px', borderRadius: '12px', border: '1px solid #21262d', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '5px' }}>إجمالي الأسهم بالمراقبة</div>
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
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #30363d', background: '#0d111a', color: '#fff', outline: 'none', fontSize: '13px', width: '180px' }}
            />
            <button type="submit" style={{ padding: '10px 16px', background: '#d4af37', color: '#07090e', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>إضافة</button>
          </form>

          {activeTab === 'cluster' ? (
            <button onClick={scanMarketForCluster} disabled={scanning} style={{ padding: '10px 16px', background: scanning ? '#30363d' : '#059669', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              {scanning ? '🔄 جاري جلب السوق الحي...' : '👑 سحب الأسهم السيادية وكابوس الحيتان'}
            </button>
          ) : (
            <button onClick={scanMarketForScalp} disabled={scanning} style={{ padding: '10px 16px', background: scanning ? '#30363d' : '#9333ea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              {scanning ? '🔄 جاري جلب السوق الحي...' : '⚡ سحب سكالبينج سيادي'}
            </button>
          )}

          <button onClick={copyAllIntelBriefing} style={{ padding: '10px 16px', background: '#0369a1', color: '#fff', border: '1px solid #38bdf8', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            📑 نسخ التقرير الملكي الشامل
          </button>
        </div>

        {/* زر الفحص الرئيسي السيادي */}
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <button 
            onClick={activeTab === 'cluster' ? runAnalysis : runScalpAnalysis} 
            disabled={isCurrentLoading}
            style={{ padding: '15px 50px', background: isCurrentLoading ? '#30363d' : 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)', color: '#07090e', border: 'none', borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 20px rgba(212,175,55,0.4)' }}
          >
            {isCurrentLoading ? '⚡ جاري فحص رادارات القصر الملكي...' : (activeTab === 'cluster' ? '🚀 بدء التحليل السيادي العميق (كابوس الحيتان والمصائد)' : '⚡ بدء الفحص السريع لموجات الترند الملكي')}
          </button>
        </div>

        {/* شبكة عرض الأسهم الملكية */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '22px' }}>
          {displayedSymbols.map((sym) => {
            const data = currentRes[sym];
            const isMatched = data?.isSuitable && data?.confidenceScore >= minConfidence;
            const isEarly = data?.isEarlyAlert && !isMatched;

            return (
              <div key={sym} style={{ background: '#0d111a', padding: '20px', borderRadius: '16px', border: isMatched ? '2px solid #22c55e' : isEarly ? '2px solid #d4af37' : '1px solid #21262d', position: 'relative', boxShadow: isMatched ? '0 0 15px rgba(34,197,94,0.15)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #21262d', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, color: '#d4af37', fontSize: '20px', fontWeight: '800' }}>{sym}</h3>
                    {isMatched && <span style={{ background: '#064e3b', color: '#4ade80', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>هدف سيادي 🔥</span>}
                    {isEarly && <span style={{ background: '#451a03', color: '#d4af37', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>إنذار ملكي ⏳</span>}
                  </div>
                  <button onClick={() => removeSymbol(sym)} style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>حذف</button>
                </div>

                {data ? (
                  <div>
                    <div style={{ background: '#07090e', padding: '12px', borderRadius: '10px', border: '1px solid #21262d', marginBottom: '12px' }}>
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
                        <button onClick={() => enterTrade(sym, data.price)} style={{ width: '100%', background: isMatched ? '#16a34a' : '#d4af37', color: isMatched ? '#fff' : '#07090e', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', cursor: 'pointer', fontWeight: '900' }}>
                          👑 اعتماد الصفقة الملكية (تفعيل مظلة الحماية)
                        </button>
                      </div>
                    ) : (
                      <div style={{ background: '#161b22', color: '#9ca3af', padding: '8px', textAlign: 'center', borderRadius: '8px', fontSize: '11.5px', fontWeight: 'bold' }}>
                        قيد المراقبة السيادية - لم يبلغ شرط الثقة ({minConfidence}%) ❌
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', margin: '30px 0' }}>
                    <p style={{ color: '#484f58', fontSize: '12px', margin: 0 }}>في انتظار فحص رادار القصر الملكي...</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* نافذة شارت TradingView المتقدم المدمج */}
        {chartModalSymbol && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
            <div style={{ background: '#0d111a', padding: '20px', borderRadius: '16px', border: '1px solid #d4af37', width: '95%', maxWidth: '1000px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #21262d', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#d4af37', fontSize: '18px' }}>📈 الرسم البياني السيادي (TradingView) - السهم: {chartModalSymbol}</h3>
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

        {/* نافذة صفقاتي ومظلة الحماية الملكية */}
        {showTradesModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: '#0d111a', padding: '25px', borderRadius: '16px', border: '1px solid #d4af37', width: '90%', maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #21262d', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#d4af37', fontSize: '18px' }}>👑 صفقاتي النشطة ومظلة الحماية السيادية</h3>
                <button onClick={() => setShowTradesModal(false)} style={{ background: '#7f1d1d', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>إغلاق</button>
              </div>
              {activeTrades.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>لا توجد صفقات ملكية مسجلة حالياً.</p>
              ) : (
                activeTrades.map((t) => (
                  <div key={t.id} style={{ background: '#07090e', padding: '14px', borderRadius: '10px', border: '1px solid #21262d', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ color: '#d4af37', fontSize: '15px', fontWeight: 'bold', marginBottom: '4px' }}>
                        👑 الرمز: {t.symbol} <span style={{ color: '#38bdf8', fontSize: '11px' }}>({t.type})</span>
                      </div>
                      <div style={{ color: '#d1d5db', fontSize: '12.5px', lineHeight: '1.5' }}>
                        سعر الدخول: <strong style={{ color: '#4ade80' }}>{t.entryPrice}</strong> | وقف الخسارة المظلي: <strong style={{ color: '#ef4444' }}>{t.stopLoss}</strong><br/>
                        🎯 أهداف الخروج الملكية: الهدف 1: {t.targets.t1} | الهدف 2: {t.targets.t2} | الهدف 3: {t.targets.t3}
                      </div>
                    </div>
                    <button onClick={() => closeActiveTrade(t.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      إغلاق وتدوين الأرباح 🛑
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* نافذة سجل العمليات الملكية */}
        {showHistoryModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: '#0d111a', padding: '25px', borderRadius: '16px', border: '1px solid #d4af37', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #21262d', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#d4af37', fontSize: '18px' }}>📜 سجل العمليات السيادية لكابوس الحيتان</h3>
                <button onClick={() => setShowHistoryModal(false)} style={{ background: '#7f1d1d', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>إغلاق</button>
              </div>
              {missionHistory.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>لا توجد عمليات مسجلة حتى الآن.</p>
              ) : (
                missionHistory.map((item) => (
                  <div key={item.id} style={{ background: '#07090e', padding: '12px', borderRadius: '8px', border: '1px solid #21262d', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d4af37', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>
                      <span>👑 الهدف: {item.symbol} {item.isEarly ? '(إنذار ملكي استباقي ⏳)' : ''}</span>
                      <span style={{ color: '#9ca3af', fontSize: '11px' }}>{item.time}</span>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '11.5px', color: '#d1d5db', margin: 0 }}>
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
