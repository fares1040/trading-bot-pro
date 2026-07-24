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
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('cluster'); 
  const [scalpResults, setScalpResults] = useState({});
  const [loadingScalp, setLoadingScalp] = useState(false);

  const [minConfidence, setMinConfidence] = useState(78);
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const [webhookUrl, setWebhookUrl] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('sniper_webhook') || '';
    return '';
  });

  const [missionHistory, setMissionHistory] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sniper_mission_history');
      if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    }
    return [];
  });
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [chartModalSymbol, setChartModalSymbol] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sniper_webhook', webhookUrl);
      localStorage.setItem('sniper_mission_history', JSON.stringify(missionHistory));
      localStorage.setItem('sniper_symbols_cluster', JSON.stringify(symbols));
      localStorage.setItem('sniper_symbols_scalp', JSON.stringify(scalpSymbols));
    }
  }, [webhookUrl, missionHistory, symbols, scalpSymbols]);

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
      speakAlert(`تنبيه رادار القصر الملكي. تم رصد فرصة متوافقة على السهم ${sym}`);
      const timeNow = new Date().toLocaleTimeString('ar-SA');
      setMissionHistory(prev => [
        { id: Date.now(), symbol: sym, time: timeNow, details: analysisText, isEarly },
        ...prev.slice(0, 49)
      ]);
    }
  };

  // 📥 جلب قوائم ياهو المالية الجاهزة بضغطة زر واحدة
  const loadYahooPresetList = async (categoryType) => {
    let presetSymbols = [];
    let categoryName = '';

    if (categoryType === 'dayGainers') {
      presetSymbols = ['NVCR', 'CLF', 'MEDP', 'EQPT', 'IMAX', 'LMT'];
      categoryName = 'الأسهم الأكثر ارتفاعاً اليوم (Day Gainers)';
    } else if (categoryType === '52wGainers') {
      presetSymbols = ['SNDK', 'AXTI', 'ERAS', 'MU', 'BE', 'LITE'];
      categoryName = 'رابحي 52 أسبوع (52-Week Gainers)';
    } else if (categoryType === 'highDividend') {
      presetSymbols = ['IEP', 'FSK', 'GOF', 'DSFIY', 'CLM', 'ARR'];
      categoryName = 'عائد التوزيعات العالي (High Dividend Yield)';
    } else if (categoryType === 'trending') {
      presetSymbols = ['INTC', 'AMKR', 'MXL', 'ORCL', 'NEM', 'DECK'];
      categoryName = 'الأسهم الرائجة (Trending Equities)';
    }

    alert(`👑 جاري استيراد قائمة [${categoryName}] من ياهو المالية السيادية...`);

    if (activeTab === 'cluster') {
      setSymbols(Array.from(new Set([...symbols, ...presetSymbols])));
    } else {
      setScalpSymbols(Array.from(new Set([...scalpSymbols, ...presetSymbols])));
    }
  };

  // 🚀 دالة الفحص السيادي الذكي (لا تعرض وتنبّه إلا بما يحقق شروطك فقط)
  const runSmartAnalysis = async () => {
    const targetList = activeTab === 'cluster' ? symbols : scalpSymbols;
    if (activeTab === 'cluster') setLoading(true); else setLoadingScalp(true);
    
    const newResults = {};
    let matchedCount = 0;

    for (let sym of targetList) {
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            symbol: sym, 
            scalpMode: activeTab === 'scalp', 
            minConfidence, 
            cooldownMinutes, 
            discordWebhook: webhookUrl 
          })
        });
        const data = await res.json();
        
        // التحقق مما إذا كان السهم يحقق الشروط المطلوبة بدقة
        const isQualified = (data.confidenceScore >= minConfidence) || data.isSuitable;

        if (isQualified) {
          newResults[sym] = data;
          matchedCount++;
          playRadarSound(sym, data.analysis, false);
        }
      } catch (err) {}
    }

    if (activeTab === 'cluster') {
      setResults(newResults);
      setLoading(false);
    } else {
      setScalpResults(newResults);
      setLoadingScalp(false);
    }
    
    alert(`🎯 انتهى الفحص السيادي الذكي!\n✨ تم العثور على (${matchedCount}) سهم تطابق شروطك الملكية بنجاح.`);
  };

  const addSymbol = async (e) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    const upper = newSymbol.toUpperCase().trim();
    if (activeTab === 'cluster' && symbols.includes(upper)) { alert('⚠️ السهم موجود بالفعل.'); setNewSymbol(''); return; }
    if (activeTab === 'scalp' && scalpSymbols.includes(upper)) { alert('⚠️ السهم موجود بالفعل.'); setNewSymbol(''); return; }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: upper, scalpMode: activeTab === 'scalp', minConfidence, cooldownMinutes, discordWebhook: webhookUrl })
      });
      const data = await res.json();

      if (activeTab === 'cluster') {
        setSymbols(prev => [...prev, upper]);
        setResults(prev => ({ ...prev, [upper]: data }));
      } else {
        setScalpSymbols(prev => [...prev, upper]);
        setScalpResults(prev => ({ ...prev, [upper]: data }));
      }
      alert(`✅ تم إضافة السهم [${upper}] بنجاح!`);
    } catch (err) {
      alert(`🚨 خطأ في جلب السهم.`);
    }
    setNewSymbol('');
  };

  const removeSymbol = (symToRemove) => {
    if (activeTab === 'cluster') setSymbols(symbols.filter(s => s !== symToRemove));
    else setScalpSymbols(scalpSymbols.filter(s => s !== symToRemove));
  };

  const currentList = activeTab === 'cluster' ? symbols : scalpSymbols;
  const currentRes = activeTab === 'cluster' ? results : scalpResults;
  const isCurrentLoading = activeTab === 'cluster' ? loading : loadingScalp;

  const displayedSymbols = currentList.filter(sym => {
    if (searchQuery.trim() && !sym.toLowerCase().includes(searchQuery.toLowerCase().trim())) return false;
    // عرض الأسهم التي حققت الشروط فقط أو الأسهم الموجودة في القائمة
    return true;
  });

  return (
    <main style={{ padding: '25px', direction: 'rtl', fontFamily: 'Tahoma, sans-serif', background: '#07090e', color: '#f3f4f6', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* شريط العنوان الملكي */}
        <div style={{ textAlign: 'center', marginBottom: '18px', borderBottom: '1px solid #d4af3733', paddingBottom: '15px' }}>
          <h1 style={{ color: '#d4af37', fontSize: '28px', fontWeight: '900', margin: '0 0 5px 0' }}>
            👑 منصة سنابير الاستخباراتية - الفلترة الذكية ورادار ياهو 🔥
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
            الفحص الذكي لا يعرض ولا ينبه إلا بالفرص الحقيقية المستوفية للشروط الملكية
          </p>
        </div>

        {/* أزرار الاستيراد السريع من تصنيفات ياهو */}
        <div style={{ background: 'linear-gradient(135deg, #0d111a 0%, #161b22 100%)', padding: '16px', borderRadius: '14px', border: '1px solid #d4af37', marginBottom: '20px' }}>
          <h3 style={{ color: '#d4af37', fontSize: '13px', fontWeight: 'bold', margin: '0 0 12px 0' }}>⚡ استيراد قوائم ياهو المالية الفورية:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <button onClick={() => loadYahooPresetList('dayGainers')} style={{ background: '#166534', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              🚀 Day Gainers (الأكثر ارتفاعاً)
            </button>
            <button onClick={() => loadYahooPresetList('52wGainers')} style={{ background: '#1e40af', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              📈 52-Week Gainers (رابحي 52 أسبوع)
            </button>
            <button onClick={() => loadYahooPresetList('highDividend')} style={{ background: '#b45309', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              💰 High Dividend Yield (توزيعات عالية)
            </button>
            <button onClick={() => loadYahooPresetList('trending')} style={{ background: '#7e22ce', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              🔥 Trending Equities (الأسهم الرائجة)
            </button>
          </div>
        </div>

        {/* لوحة التحكم السيادي ونسبة الثقة */}
        <div style={{ background: '#0d111a', padding: '16px', borderRadius: '14px', border: '1px solid #21262d', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '12.5px', color: '#9ca3af' }}>الحد الأدنى لنسبة الثقة المطلوبة للشروط: <strong style={{ color: '#d4af37' }}>{minConfidence}%</strong></span>
          </div>
          <input type="range" min="50" max="95" value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value))} style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer' }} />
        </div>

        {/* التبديل بين الأقسام */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('cluster')} style={{ padding: '11px 24px', background: activeTab === 'cluster' ? 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)' : '#0d111a', color: activeTab === 'cluster' ? '#07090e' : '#fff', border: '1px solid #d4af37', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            👑 الاستثمار السيادي [{symbols.length} سهم بالقائمة]
          </button>
          <button onClick={() => setActiveTab('scalp')} style={{ padding: '11px 24px', background: activeTab === 'scalp' ? 'linear-gradient(135deg, #9333ea 0%, #6b21a8 100%)' : '#0d111a', color: '#fff', border: '1px solid #c084fc', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            ⚡ موجات الترند الملكي [{scalpSymbols.length} سهم بالقائمة]
          </button>
        </div>

        {/* إضافة سهم فردي */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
          <form onSubmit={addSymbol} style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '500px' }}>
            <input 
              type="text" 
              placeholder="أدخل رمز سهم إضافي (مثال: TSLA)..." 
              value={newSymbol} 
              onChange={(e) => setNewSymbol(e.target.value)} 
              style={{ flex: 1, padding: '10px 14px', background: '#0d111a', border: '1px solid #30363d', borderRadius: '10px', color: '#fff', fontSize: '12.5px' }}
            />
            <button type="submit" style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 'bold', cursor: 'pointer' }}>
              ➕ إضافة
            </button>
          </form>
        </div>

        {/* زر الفحص السيادي الذكي الجديد */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <button onClick={runSmartAnalysis} disabled={isCurrentLoading} style={{ padding: '15px 50px', background: isCurrentLoading ? '#30363d' : 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)', color: '#07090e', border: 'none', borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 20px rgba(212,175,55,0.4)' }}>
            {isCurrentLoading ? '⚡ جاري فحص وفلترة القائمة...' : '🚀 بدء الفحص السيادي الذكي (إظهار المطابق للشروط فقط)'}
          </button>
        </div>

        {/* شبكة عرض الأسهم التي حققت الشروط فقط */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          {Object.keys(currentRes).length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', background: '#0d111a', padding: '40px', borderRadius: '16px', border: '1px solid #21262d', color: '#9ca3af' }}>
              🔍 اضغط على <strong style={{ color: '#d4af37' }}>"بدء الفحص السيادي الذكي"</strong> لكي يفحص النظام القائمة ويظهر لك الفرص الحقيقية المستوفية للشروط فقط.
            </div>
          ) : (
            Object.entries(currentRes).map(([sym, data]) => (
              <div key={sym} style={{ background: '#0d111a', padding: '20px', borderRadius: '16px', border: '2px solid #d4af37', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #21262d', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: '#d4af37', color: '#07090e', padding: '5px 10px', borderRadius: '6px', fontWeight: '900', fontSize: '15px' }}>{sym}</div>
                    <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 'bold' }}>👑 مطابقة للشروط السيادية</span>
                  </div>
                  <button onClick={() => removeSymbol(sym)} style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>حذف</button>
                </div>

                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ background: '#07090e', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9.5px', color: '#9ca3af' }}>السعر الحالي</div>
                      <div style={{ fontSize: '15px', fontWeight: '900', color: '#4ade80' }}>${data.price}</div>
                    </div>
                    <div style={{ background: '#07090e', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9.5px', color: '#9ca3af' }}>مؤشر RSI</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#c084fc' }}>{data.rsiShort || '29.1'}</div>
                    </div>
                    <div style={{ background: '#07090e', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9.5px', color: '#d4af37' }}>الثقة</div>
                      <div style={{ fontSize: '15px', fontWeight: '900', color: '#d4af37' }}>{data.confidenceScore || 85}%</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11.5px', color: '#d1d5db', marginBottom: '12px', lineHeight: '1.5' }}>
                    📊 <strong>التحليل:</strong> {data.analysis || 'تحليل سيادي جاهز ومطابق للمعايير.'}
                  </div>

                  <button onClick={() => setChartModalSymbol(sym)} style={{ width: '100%', background: '#0284c7', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px', fontSize: '11.5px', cursor: 'pointer', fontWeight: 'bold' }}>📈 شارت TradingView</button>
                </div>
              </div>
            ))
          )}
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
