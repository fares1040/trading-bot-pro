'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [symbols, setSymbols] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sniper_symbols_cluster');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return [
      'VMAR', 'CETX', 'GSIT', 'PRFX', 'BYRN', 'ERNA', 
      'LNZA', 'HURA', 'KULR', 'ANVS', 'PPSI', 'BJDX'
    ];
  });

  const [scalpSymbols, setScalpSymbols] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sniper_symbols_scalp');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
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

  const [filterOnlySuitable, setFilterOnlySuitable] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [timer, setTimer] = useState(300);
  const [capitalInputs, setCapitalInputs] = useState({});

  const [missionHistory, setMissionHistory] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedHist = localStorage.getItem('sniper_mission_history');
      if (savedHist) {
        try { return JSON.parse(savedHist); } catch (e) {}
      }
    }
    return [];
  });
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('sniper_webhook') || '';
    return '';
  });
  const [showWebhookSettings, setShowWebhookSettings] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sniper_webhook', webhookUrl);
    }
  }, [webhookUrl]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sniper_mission_history', JSON.stringify(missionHistory));
    }
  }, [missionHistory]);

  useEffect(() => {
    localStorage.setItem('sniper_symbols_cluster', JSON.stringify(symbols));
  }, [symbols]);

  useEffect(() => {
    localStorage.setItem('sniper_symbols_scalp', JSON.stringify(scalpSymbols));
  }, [scalpSymbols]);

  const sendWebhookAlert = async (sym, analysisText) => {
    if (!webhookUrl.trim()) return;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🚨 **تنبيه عسكري فوري** 🎯\nتم رصد هدف على السهم: **${sym}**\n\n\`\`\`${analysisText}\`\`\``
        })
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

  const playRadarSound = (sym = '', analysisText = '') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
    
    if (sym) {
      speakAlert(`تنبيه رادار السنايبر. تم رصد هدف على السهم ${sym}`);
      sendWebhookAlert(sym, analysisText);
      
      const timeNow = new Date().toLocaleTimeString('ar-SA');
      setMissionHistory(prev => [
        { id: Date.now(), symbol: sym, time: timeNow, details: analysisText },
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
    for (let sym of symbols) {
      try {
        const res = await fetch(`/api/analyze?symbol=${sym}`);
        const data = await res.json();
        newResults[sym] = data;
        if (data.isSuitable && !firstMatchedSym) {
          firstMatchedSym = sym;
          firstAnalysis = data.analysis;
        }
      } catch (err) {
        newResults[sym] = { error: "فشل الاتصال" };
      }
    }
    setResults(newResults);
    setLoading(false);
    if (firstMatchedSym) playRadarSound(firstMatchedSym, firstAnalysis);
  };

  const runScalpAnalysis = async () => {
    setLoadingScalp(true);
    const newResults = {};
    let firstMatchedSym = '';
    let firstAnalysis = '';
    for (let sym of scalpSymbols) {
      try {
        const res = await fetch(`/api/analyze?symbol=${sym}&scalp=true`);
        const data = await res.json();
        newResults[sym] = data;
        if (data.isSuitable && !firstMatchedSym) {
          firstMatchedSym = sym;
          firstAnalysis = data.analysis;
        }
      } catch (err) {
        newResults[sym] = { error: "فشل الاتصال" };
      }
    }
    setScalpResults(newResults);
    setLoadingScalp(false);
    if (firstMatchedSym) playRadarSound(firstMatchedSym, firstAnalysis);
  };

  // رادار الصيد للاستثمار (4 ساعات)
  const scanMarketForCluster = async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/analyze?scan=true&symbols=${symbols.join(',')}`);
      const data = await res.json();
      if (data.matched && data.matched.length > 0) {
        const merged = Array.from(new Set([...symbols, ...data.matched]));
        setSymbols(merged);
        playRadarSound(data.matched[0], "مسح راداري استثماري");
        alert(`🎯 رادار الكلاستر اصطاد ${data.matched.length} سهم جديد!`);
        runAnalysis();
      } else {
        alert('لا توجد أسهم استثمارية جديدة مطابقة حالياً.');
      }
    } catch (e) {
      alert('حدث خطأ أثناء فحص الرادار الاستثماري.');
    }
    setScanning(false);
  };

  // رادار الصيد للسكالبينج (ترندات لحظية)
  const scanMarketForScalp = async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/analyze?scan=true&scalp=true&symbols=${scalpSymbols.join(',')}`);
      const data = await res.json();
      if (data.matched && data.matched.length > 0) {
        const merged = Array.from(new Set([...scalpSymbols, ...data.matched]));
        setScalpSymbols(merged);
        playRadarSound(data.matched[0], "مسح راداري للسكالبينج");
        alert(`⚡ رادار السكالبينج اصطاد ${data.matched.length} سهم ترند لحظي جديد!`);
        runScalpAnalysis();
      } else {
        alert('لا توجد ترندات لحظية جديدة مطابقة حالياً.');
      }
    } catch (e) {
      alert('حدث خطأ أثناء فحص رادار السكالبينج.');
    }
    setScanning(false);
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
    alert('📋 تم نسخ بيانات التوصية بنجاح!');
  };

  const copyAllIntelBriefing = () => {
    const activeList = activeTab === 'cluster' ? symbols : scalpSymbols;
    const activeRes = activeTab === 'cluster' ? results : scalpResults;
    const suitableSymbols = activeList.filter(sym => activeRes[sym] && activeRes[sym].isSuitable);
    
    if (suitableSymbols.length === 0) {
      alert('⚠️ لا توجد فرص مطابقة لنسخ تقريرها!');
      return;
    }

    let report = `🎯 **تقرير العمليات (${activeTab === 'cluster' ? 'استثمار 4 ساعات' : 'سكالبينج لحظي'})** 📊\n\n`;
    suitableSymbols.forEach((sym, index) => {
      report += `[الهدف #${index + 1}] - الرمز: ${sym}\n${activeRes[sym].analysis}\n-------------------\n\n`;
    });

    navigator.clipboard.writeText(report);
    alert('📋 تم نسخ التقرير الشامل بنجاح!');
  };

  const currentList = activeTab === 'cluster' ? symbols : scalpSymbols;
  const currentRes = activeTab === 'cluster' ? results : scalpResults;
  const isCurrentLoading = activeTab === 'cluster' ? loading : loadingScalp;

  const displayedSymbols = currentList.filter(sym => {
    if (!filterOnlySuitable) return true;
    return currentRes[sym] && currentRes[sym].isSuitable;
  });

  const totalAnalyzed = Object.keys(currentRes).length;
  const suitableCount = Object.values(currentRes).filter(r => r?.isSuitable).length;
  const successRate = totalAnalyzed > 0 ? ((suitableCount / totalAnalyzed) * 100).toFixed(1) : '0.0';

  return (
    <main style={{ padding: '25px', direction: 'rtl', fontFamily: 'Tahoma, sans-serif', background: '#030712', color: '#f8fafc', minHeight: '100vh', position: 'relative' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ color: activeTab === 'cluster' ? '#38bdf8' : '#c084fc', fontSize: '32px', fontWeight: '900', margin: '0 0 8px 0' }}>
            {activeTab === 'cluster' ? '🎯 نظام السنايبر العسكري (الكلاستر - 4 ساعات)' : '⚡ رادار موجات الترند اللحظي (السكالبينج)'}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            {activeTab === 'cluster' ? 'منصة الاستثمار والارتداد على فريم 4 ساعات' : 'منصة المضاربة السريعة واقتناص الفوليوم اللحظي'}
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
          <button 
            onClick={() => { setActiveTab('cluster'); setFilterOnlySuitable(false); }}
            style={{ padding: '12px 25px', background: activeTab === 'cluster' ? '#0284c7' : '#0f172a', color: '#fff', border: '1px solid #38bdf8', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🛡️ نظام الكلاستر والاستثمار [{symbols.length} سهم]
          </button>
          <button 
            onClick={() => { setActiveTab('scalp'); setFilterOnlySuitable(false); }}
            style={{ padding: '12px 25px', background: activeTab === 'scalp' ? '#9333ea' : '#0f172a', color: '#fff', border: '1px solid #c084fc', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ⚡ رادار موجات الترند اللحظي [{scalpSymbols.length} سهم]
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <form onSubmit={addSymbol} style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder={activeTab === 'cluster' ? "أدخل سهم للاستثمار" : "أدخل سهم للسكالبينج"}
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              style={{ padding: '11px 16px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#fff', outline: 'none', fontSize: '14px' }}
            />
            <button type="submit" style={{ padding: '11px 20px', background: activeTab === 'cluster' ? '#0284c7' : '#9333ea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>إضافة للقائمة</button>
          </form>

          {/* زر صيد الأسهم المتوافقة يظهر الآن في القائمتين بشكل مستقل */}
          {activeTab === 'cluster' ? (
            <button 
              onClick={scanMarketForCluster} 
              disabled={scanning}
              style={{ padding: '11px 24px', background: scanning ? '#475569' : '#059669', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            >
              {scanning ? '🔄 جاري المسح...' : '🎯 رادار صيد الكلاستر والاستثمار'}
            </button>
          ) : (
            <button 
              onClick={scanMarketForScalp} 
              disabled={scanning}
              style={{ padding: '11px 24px', background: scanning ? '#475569' : '#9333ea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            >
              {scanning ? '🔄 جاري المسح...' : '⚡ رادار صيد ترندات السكالبينج'}
            </button>
          )}

          <button 
            onClick={copyAllIntelBriefing}
            style={{ padding: '11px 24px', background: '#0369a1', color: '#fff', border: '1px solid #38bdf8', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
          >
            📑 نسخ التقرير الشامل
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <button 
            onClick={activeTab === 'cluster' ? runAnalysis : runScalpAnalysis} 
            disabled={isCurrentLoading}
            style={{ padding: '14px 40px', background: isCurrentLoading ? '#475569' : (activeTab === 'cluster' ? '#16a34a' : '#9333ea'), color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', cursor: 'pointer', fontWeight: '900' }}
          >
            {isCurrentLoading ? '⚡ جاري المعالجة...' : (activeTab === 'cluster' ? '🚀 بدء الفحص الشامل للاستثمار (4 ساعات)' : '⚡ بدء الفحص السريع لموجات الترند (سكالبينج)')}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '22px' }}>
          {displayedSymbols.map((sym) => {
            const data = currentRes[sym];
            const isMatched = data?.isSuitable;

            return (
              <div 
                key={sym} 
                style={{ 
                  background: '#0f172a', 
                  padding: '22px', 
                  borderRadius: '16px', 
                  border: isMatched ? '2px solid #22c55e' : '1px solid #1e293b', 
                  position: 'relative' 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, color: '#facc15', fontSize: '22px', fontWeight: '800' }}>{sym}</h3>
                    {isMatched && <span style={{ background: '#064e3b', color: '#4ade80', fontSize: '11px', padding: '3px 10px', borderRadius: '6px', fontWeight: 'bold' }}>هدف مؤكد 🔥</span>}
                  </div>
                  <button onClick={() => removeSymbol(sym)} style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>حذف</button>
                </div>

                {data ? (
                  <div>
                    <div style={{ background: '#030712', padding: '14px', borderRadius: '10px', border: '1px solid #1e293b', marginBottom: '14px' }}>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12.5px', color: '#e2e8f0', margin: 0, lineHeight: '1.6' }}>
                        {data.analysis || data.error}
                      </pre>
                    </div>

                    {isMatched ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a 
                          href={`https://www.tradingview.com/chart/?symbol=${sym}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ flex: 1, display: 'block', background: '#0284c7', color: '#fff', padding: '9px', textAlign: 'center', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}
                        >
                          📈 الشارت
                        </a>
                        <button 
                          onClick={() => copyToClipboard(data.analysis)}
                          style={{ flex: 1, background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          📋 نسخ
                        </button>
                      </div>
                    ) : (
                      <div style={{ background: '#451a03', color: '#fdba74', padding: '8px', textAlign: 'center', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                        قيد المراقبة - النموذج لم يكتمل ❌
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', margin: '35px 0' }}>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 8px 0' }}>في انتظار فحص الرادار...</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </main>
  );
}
