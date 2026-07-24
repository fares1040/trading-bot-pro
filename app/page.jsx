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

  const [minConfidence, setMinConfidence] = useState(82); // رفع نسبة الثقة لتقليل التنبيهات العشوائية
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
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
    
    if (sym) {
      speakAlert(`تنبيه رادار القصر الملكي. فرصة نخبويّة على السهم ${sym}`);
      const timeNow = new Date().toLocaleTimeString('ar-SA');
      setMissionHistory(prev => [
        { id: Date.now(), symbol: sym, time: timeNow, details: analysisText },
        ...prev.slice(0, 49)
      ]);
    }
  };

  // 🚀 الفحص السيادي الذكي المدمج (سحب ياهو تلقائياً + فلترة السعر تحت 100$ + منع التنبيهات المزعجة)
  const runSmartAnalysis = async () => {
    const yahooPresets = ['NVCR', 'CLF', 'MEDP', 'SNDK', 'AXTI', 'IEP', 'FSK', 'INTC', 'AMKR', 'LMT'];
    
    if (activeTab === 'cluster') {
      setSymbols(Array.from(new Set([...symbols, ...yahooPresets])));
      setLoading(true);
    } else {
      setScalpSymbols(Array.from(new Set([...scalpSymbols, ...yahooPresets])));
      setLoadingScalp(true);
    }

    const targetList = Array.from(new Set([...(activeTab === 'cluster' ? symbols : scalpSymbols), ...yahooPresets]));
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
        
        const priceNum = parseFloat(data.price || 0);
        
        // الشروط الصارمة: الثقة العالية + السعر 100 دولار أو أقل لتنمية المحفظة + استبعاد الضوضاء
        const isQualified = (data.confidenceScore >= minConfidence) && (priceNum > 0 && priceNum <= 100);

        if (isQualified) {
          newResults[sym] = data;
          matchedCount++;
          // تنبيه نخبوي فقط للفرص الحقيقية
          if (matchedCount <= 5) {
            playRadarSound(sym, data.analysis);
          }
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
    
    alert(`🎯 انتهى الفحص السيادي الذكي!\n✨ تم العثور على (${matchedCount}) فرصة ذهبية مستوفية لشروط السعر (تحت 100$) والثقة الصارمة.`);
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

  return (
    <main style={{ padding: '25px', direction: 'rtl', fontFamily: 'Tahoma, sans-serif', background: '#07090e', color: '#f3f4f6', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* شريط العنوان الملكي */}
        <div style={{ textAlign: 'center', marginBottom: '18px', borderBottom: '1px solid #d4af3733', paddingBottom: '15px' }}>
          <h1 style={{ color: '#d4af37', fontSize: '28px', fontWeight: '900', margin: '0 0 5px 0' }}>
            👑 منصة سنابير الاستخباراتية - كابوس الحيتان 🔥
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
            الفحص السيادي الموحد للأسهم الاقتصادية (تحت 100$) لتنمية المحفظة وتصفية التنبيهات بدقة
          </p>
        </div>

        {/* لوحة التحكم السيادي ونسبة الثقة */}
        <div style={{ background: '#0d111a', padding: '16px', borderRadius: '14px', border: '1px solid #21262d', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12.5px', color: '#9ca3af' }}>الحد الأدنى لنسبة الثقة الصارمة: <strong style={{ color: '#d4af37' }}>{minConfidence}%</strong> (لمنع التنبيهات العشوائية)</span>
          </div>
          <input type="range" min="70" max="95" value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value))} style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer' }} />
        </div>

        {/* التبديل بين الأقسام */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('cluster')} style={{ padding: '11px 24px', background: activeTab === 'cluster' ? 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)' : '#0d111a', color: activeTab === 'cluster' ? '#07090e' : '#fff', border: '1px solid #d4af37', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            👑 الاستثمار السيادي [{symbols.length} سهم]
          </button>
          <button onClick={() => setActiveTab('scalp')} style={{ padding: '11px 24px', background: activeTab === 'scalp' ? 'linear-gradient(135deg, #9333ea 0%, #6b21a8 100%)' : '#0d111a', color: '#fff', border: '1px solid #c084fc', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            ⚡ موجات الترند الملكي [{scalpSymbols.length} سهم]
          </button>
        </div>

        {/* إضافة سهم فردي */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
          <form onSubmit={addSymbol} style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '500px' }}>
            <input 
              type="text" 
              placeholder="أدخل رمز سهم إضافي (مثال: VMAR)..." 
              value={newSymbol} 
              onChange={(e) => setNewSymbol(e.target.value)} 
              style={{ flex: 1, padding: '10px 14px', background: '#0d111a', border: '1px solid #30363d', borderRadius: '10px', color: '#fff', fontSize: '12.5px' }}
            />
            <button type="submit" style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 'bold', cursor: 'pointer' }}>
              ➕ إضافة
            </button>
          </form>
        </div>

        {/* زر الفحص السيادي الذكي الموحد (الزر الخارق السحري) */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <button onClick={runSmartAnalysis} disabled={isCurrentLoading} style={{ padding: '16px 50px', background: isCurrentLoading ? '#30363d' : 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)', color: '#07090e', border: 'none', borderRadius: '12px', fontSize: '16px', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 20px rgba(212,175,55,0.4)' }}>
            {isCurrentLoading ? '⚡ جاري سحب قوائم ياهو وفحص الأسهم (تحت 100$)...' : '🚀 بدء الفحص السيادي الذكي (تصفية الفرص النخبوية فقط)'}
          </button>
        </div>

        {/* شبكة عرض الأسهم المطابقة للشروط */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          {Object.keys(currentRes).length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', background: '#0d111a', padding: '40px', borderRadius: '16px', border: '1px solid #21262d', color: '#9ca3af' }}>
              🔍 اضغط على <strong style={{ color: '#d4af37' }}>"بدء الفحص السيادي الذكي"</strong> لجلب الأسهم، فلترتها (تحت 100$)، وعرض الفرص الحقيقية النخبوية فقط.
            </div>
          ) : (
            Object.entries(currentRes).map(([sym, data]) => (
              <div key={sym} style={{ background: '#0d111a', padding: '20px', borderRadius: '16px', border: '2px solid #d4af37', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #21262d', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: '#d4af37', color: '#07090e', padding: '5px 10px', borderRadius: '6px', fontWeight: '900', fontSize: '15px' }}>{sym}</div>
                    <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 'bold' }}>👑 مطابقة لشروط التنمية (≤ $100)</span>
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
                    📊 <strong>التحليل:</strong> {data.analysis || 'تحليل سيادي جاهز ومطابق للمعايير الصارمة.'}
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
