'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [symbols, setSymbols] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sniper_symbols');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return [
      'VMAR', 'CETX', 'GSIT', 'PRFX', 'BYRN', 'ERNA', 
      'LNZA', 'HURA', 'KULR', 'ANVS', 'PPSI', 'BJDX', 
      'MRAM', 'NOK', 'SPSC', 'PODC', 'OPI', 'TOVX', 
      'NIO', 'LOT', 'OLB', 'OCG', 'QUCY', 'PLUG'
    ];
  });

  const [newSymbol, setNewSymbol] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [loadingSymbol, setLoadingSymbol] = useState(null);

  const [filterOnlySuitable, setFilterOnlySuitable] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [timer, setTimer] = useState(300);
  const [capitalInputs, setCapitalInputs] = useState({});

  // صوت تنبيه رادار عسكري عند اصطياد فرصة
  const playRadarSound = () => {
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
  };

  useEffect(() => {
    localStorage.setItem('sniper_symbols', JSON.stringify(symbols));
  }, [symbols]);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            runAnalysis();
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimer(300);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, symbols]);

  const runAnalysis = async () => {
    setLoading(true);
    const newResults = {};
    let foundNewMatch = false;
    for (let sym of symbols) {
      try {
        const res = await fetch(`/api/analyze?symbol=${sym}`);
        const data = await res.json();
        newResults[sym] = data;
        if (data.isSuitable) foundNewMatch = true;
      } catch (err) {
        newResults[sym] = { error: "فشل الاتصال" };
      }
    }
    setResults(newResults);
    setLoading(false);
    if (foundNewMatch) playRadarSound();
  };

  const analyzeSingleSymbol = async (sym) => {
    setLoadingSymbol(sym);
    try {
      const res = await fetch(`/api/analyze?symbol=${sym}`);
      const data = await res.json();
      setResults(prev => ({ ...prev, [sym]: data }));
      if (data.isSuitable) playRadarSound();
    } catch (err) {
      setResults(prev => ({ ...prev, [sym]: { error: "فشل الاتصال" } }));
    }
    setLoadingSymbol(null);
  };

  const scanMarketForMatches = async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/analyze?scan=true`);
      const data = await res.json();
      if (data.matched && data.matched.length > 0) {
        const merged = Array.from(new Set([...symbols, ...data.matched]));
        setSymbols(merged);
        playRadarSound();
        alert(`🎯 رادار السنايبر اصطاد ورصد ${data.matched.length} سهم جديد مطابقة للشروط!`);
        runAnalysis();
      } else {
        alert('الرادار مسح السوق، لا توجد أسهم مطابقة بنسبة 100% حالياً.');
      }
    } catch (e) {
      alert('حدث خطأ أثناء فحص الرادار.');
    }
    setScanning(false);
  };

  const addSymbol = (e) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    const upper = newSymbol.toUpperCase().trim();
    if (!symbols.includes(upper)) setSymbols([...symbols, upper]);
    setNewSymbol('');
  };

  const removeSymbol = (symToRemove) => {
    setSymbols(symbols.filter(s => s !== symToRemove));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('📋 تم نسخ بيانات التوصية للذاكرة بنجاح!');
  };

  const displayedSymbols = symbols.filter(sym => {
    if (!filterOnlySuitable) return true;
    return results[sym] && results[sym].isSuitable;
  });

  // حسابات إحصائيات الأداء السريعة
  const totalAnalyzed = Object.keys(results).length;
  const suitableCount = Object.values(results).filter(r => r?.isSuitable).length;
  const successRate = totalAnalyzed > 0 ? ((suitableCount / totalAnalyzed) * 100).toFixed(1) : '0.0';
  const marketSentiment = suitableCount > 3 ? "سوق إيجابي مشتعل بالفرص 🚀" : suitableCount > 0 ? "سوق حذر وفرص قنص انتقائية 🎯" : "رادار بانتظار رصد السيولة 🔍";

  return (
    <main style={{ padding: '25px', direction: 'rtl', fontFamily: 'Tahoma, sans-serif', background: '#030712', color: '#f8fafc', minHeight: '100vh' }}>
      
      {/* خلفية تفاعلية نيون */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', background: 'radial-gradient(circle at 50% 0%, rgba(14, 165, 233, 0.08) 0%, transparent 60%)', zIndex: 0 }}></div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* العنوان */}
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <h1 style={{ color: '#38bdf8', fontSize: '32px', fontWeight: '900', margin: '0 0 8px 0', textShadow: '0 0 20px rgba(56, 189, 248, 0.4)' }}>
            🎯 نظام السنايبر العسكري الذكي
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>منصة القيادة والتحكم الآلي لتحليل وفحص أسهم السوق على فريم 4 ساعات</p>
        </div>

        {/* شريط القيادة العلوي */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a 100%, #1e1b4b 0%)', border: '1px solid #312e81', borderRadius: '14px', padding: '18px 22px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '12px', height: '12px', background: suitableCount > 0 ? '#22c55e' : '#eab308', borderRadius: '50%', display: 'inline-block', boxShadow: suitableCount > 0 ? '0 0 10px #22c55e' : '0 0 10px #eab308' }}></span>
            <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: 'bold' }}>حالة الرادار:</span>
            <span style={{ background: '#030712', padding: '6px 14px', borderRadius: '8px', color: '#38bdf8', fontSize: '13px', fontWeight: 'bold', border: '1px solid #1e293b' }}>
              📊 {marketSentiment} ({suitableCount} هدف جاهز)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setFilterOnlySuitable(!filterOnlySuitable)}
              style={{ padding: '9px 16px', background: filterOnlySuitable ? '#16a34a' : '#1e293b', color: '#fff', border: filterOnlySuitable ? 'none' : '1px solid #475569', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: '0.2s' }}
            >
              {filterOnlySuitable ? '✅ عرض الفرص المطابقة فقط' : '👁️ عرض كافة القائمة'}
            </button>

            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{ padding: '9px 16px', background: autoRefresh ? '#dc2626' : '#1e293b', color: '#fff', border: autoRefresh ? 'none' : '1px solid #475569', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
            >
              {autoRefresh ? `⚡ رادار تلقائي يعمل (${Math.floor(timer/60)}:${timer%60 < 10 ? '0':''}${timer%60})` : '⏱️ تشغيل الرادار التلقائي'}
            </button>
          </div>
        </div>

        {/* 📊 شريط إحصائيات الأداء السريع (Analytics Dashboard) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '15px', textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '5px' }}>إجمالي الأسهم تحت المراقبة</div>
            <div style={{ color: '#38bdf8', fontSize: '20px', fontWeight: '900' }}>{symbols.length} سهم</div>
          </div>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '15px', textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '5px' }}>الأسهم التي تم فحصها</div>
            <div style={{ color: '#facc15', fontSize: '20px', fontWeight: '900' }}>{totalAnalyzed} / {symbols.length}</div>
          </div>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '15px', textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '5px' }}>الفرص الذهبية المطابقة ✅</div>
            <div style={{ color: '#4ade80', fontSize: '20px', fontWeight: '900' }}>{suitableCount} فرص</div>
          </div>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '15px', textAlign: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '5px' }}>نسبة الكفاءة والقبول الحالية</div>
            <div style={{ color: '#c084fc', fontSize: '20px', fontWeight: '900' }}>{successRate}%</div>
          </div>
        </div>

        {/* بانل التنبيهات والربط العسكري */}
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '14px', padding: '16px 20px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ fontSize: '24px' }}>🛡️</div>
          <div>
            <div style={{ color: '#818cf8', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>غرفة العمليات متصلة بقناة تيليجرام</div>
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>النظام يراقب الفوليوم والزخم ومناطق الكلاستر تلقائياً، ويرسل تنبيهات فورية عند بلوغ الهدف الأول لرفع وقف الخسارة.</div>
          </div>
        </div>
        
        {/* أدوات الإضافة والمسح الشامل */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <form onSubmit={addSymbol} style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="أدخل رمز السهم الجديد (مثال: TSLA)" 
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              style={{ padding: '11px 16px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#fff', outline: 'none', fontSize: '14px' }}
            />
            <button type="submit" style={{ padding: '11px 20px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>إضافة للسلطة</button>
          </form>

          <button 
            onClick={scanMarketForMatches} 
            disabled={scanning}
            style={{ padding: '11px 24px', background: scanning ? '#475569' : '#9333ea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 0 15px rgba(147, 51, 234, 0.4)' }}
          >
            {scanning ? '🔄 جاري مسح السوق بالرادار...' : '🎯 رادار صيد الأسهم المتوافقة'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <button 
            onClick={runAnalysis} 
            disabled={loading}
            style={{ padding: '14px 40px', background: loading ? '#475569' : '#16a34a', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 20px rgba(22, 163, 74, 0.4)', transition: '0.2s' }}
          >
            {loading ? '⚡ جاري معالجة وفحص القائمة...' : '🚀 بدء الفحص الشامل للقائمة الحالية'}
          </button>
        </div>

        {/* شبكة البطاقات (Grid Cards) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '22px' }}>
          {displayedSymbols.map((sym) => {
            const data = results[sym];
            const isMatched = data?.isSuitable;
            const isItemLoading = loadingSymbol === sym;

            return (
              <div 
                key={sym} 
                style={{ 
                  background: '#0f172a', 
                  padding: '22px', 
                  borderRadius: '16px', 
                  border: isMatched ? '2px solid #22c55e' : '1px solid #1e293b', 
                  position: 'relative', 
                  boxShadow: isMatched ? '0 0 25px rgba(34, 197, 94, 0.25)' : '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* رأس الكارد */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, color: '#facc15', fontSize: '22px', fontWeight: '800', letterSpacing: '0.5px' }}>{sym}</h3>
                    {isMatched && <span style={{ background: '#064e3b', color: '#4ade80', fontSize: '11px', padding: '3px 10px', borderRadius: '6px', fontWeight: 'bold', border: '1px solid #059669' }}>هدف مؤكد 🔥</span>}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => analyzeSingleSymbol(sym)} 
                      disabled={isItemLoading}
                      style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '13px' }}
                      title="فحص سريع لهذا السهم"
                    >
                      {isItemLoading ? '⏳' : '🔄'}
                    </button>
                    <button onClick={() => removeSymbol(sym)} style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>حذف</button>
                  </div>
                </div>

                {data ? (
                  <div>
                    <div style={{ background: '#030712', padding: '14px', borderRadius: '10px', border: '1px solid #1e293b', marginBottom: '14px' }}>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12.5px', color: '#e2e8f0', margin: 0, lineHeight: '1.6' }}>
                        {data.analysis || data.error}
                      </pre>
                    </div>

                    {/* حاسبة رأس المال الفورية */}
                    <div style={{ background: '#030712', padding: '12px', borderRadius: '10px', marginBottom: '14px', border: '1px solid #1e293b' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>حاسبة إدارة المخاطر ورأس المال ($):</label>
                      <input 
                        type="number" 
                        placeholder="أدخل مبلغ الاستثمار (مثال: 5000)" 
                        value={capitalInputs[sym] || ''}
                        onChange={(e) => setCapitalInputs({ ...capitalInputs, [sym]: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                      />
                      {capitalInputs[sym] > 0 && data.analysis && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#38bdf8', fontWeight: 'bold' }}>
                          💡 عدد الأسهم المقدرة: {Math.floor(capitalInputs[sym] / (parseFloat(data.analysis.match(/السعر: ([\d.]+)/)?.[1]) || 1))} سهم
                        </div>
                      )}
                    </div>

                    {isMatched ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ background: '#064e3b', color: '#4ade80', padding: '10px', textAlign: 'center', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #059669', boxShadow: '0 0 10px rgba(74, 222, 128, 0.2)' }}>
                          🎯 فرصة مطابقة بالكامل وأُرسلت للتيليجرام ✅
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <a 
                            href={`https://www.tradingview.com/chart/?symbol=${sym}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ flex: 1, display: 'block', background: '#0284c7', color: '#fff', padding: '9px', textAlign: 'center', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}
                          >
                            📈 الشارت التفاعلي
                          </a>
                          <button 
                            onClick={() => copyToClipboard(data.analysis)}
                            style={{ flex: 1, background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            📋 نسخ التوصية
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#451a03', color: '#fdba74', padding: '8px', textAlign: 'center', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #7c2d12' }}>
                        قيد المراقبة - النموذج لم يكتمل بالكامل ❌
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', margin: '35px 0' }}>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 8px 0' }}>في انتظار فحص الرادار...</p>
                    <div style={{ fontSize: '12px', color: '#38bdf8' }}>اضغط زر التحديث 🔄 للفحص الفوري</div>
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
