'use client';
import { useState } from 'react';

export default function SniperDashboard() {
  const [symbol, setSymbol] = useState('');
  const [scalpMode, setScalpMode] = useState(false);
  
  // ⚙️ إعدادات التحكم المباشرة من الواجهة
  const [minConfidence, setMinConfidence] = useState(70);
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const [discordWebhook, setDiscordWebhook] = useState('');

  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [data, setData] = useState(null);
  const [scanResults, setScanResults] = useState([]);
  const [error, setError] = useState('');

  // فحص سهم فردي عبر POST مع تمرير الإعدادات
  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!symbol) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch('/api/sniper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          scalpMode,
          minConfidence,
          cooldownMinutes,
          discordWebhook
        })
      });
      const result = await res.json();
      if (res.ok) {
        setData(result);
      } else {
        setError(result.error || 'حدث خطأ أثناء الجلب');
      }
    } catch (err) {
      setError('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  // فحص السوق التلقائي
  const handleScan = async () => {
    setScanLoading(true);
    setScanResults([]);
    setError('');

    try {
      const res = await fetch(`/api/sniper?scan=true&scalp=${scalpMode}&minConfidence=${minConfidence}`);
      const result = await res.json();
      if (res.ok) {
        setScanResults(result.matched || []);
      } else {
        setError(result.error || 'فشل الفحص الشامل');
      }
    } catch (err) {
      setError('فشل الاتصال بالخادم للفحص');
    } finally {
      setScanLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* الهيدر وعنوان المنظومة */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-amber-400 tracking-wider flex items-center gap-2">
              🎯 منصتي سنايبر الاحترافية <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full border border-amber-500/30">نسخة طماع 🔥</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">نظام تتبع الحيتان، الرصد اللحظي، وبطاقة الثقة التنبؤية الانعكاسية.</p>
          </div>
          
          <button
            onClick={() => setScalpMode(!scalpMode)}
            className={`px-4 py-2 rounded-xl font-bold transition-all border ${
              scalpMode 
                ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-lg shadow-purple-900/40' 
                : 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-900/40'
            }`}
          >
            {scalpMode ? '⚡ الوضع اللحظي (سكالبينج 15د)' : '🛡️ وضع الاستثمار (كلاستر 4س)'}
          </button>
        </div>

        {/* ⚙️ لوحة التحكم المباشرة في الإعدادات */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            ⚙️ إعدادات التحكم العسكري والتنبيهات:
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">الحد الأدنى لنسبة الثقة (%): {minConfidence}%</label>
              <input
                type="range"
                min="50"
                max="95"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-full accent-amber-500 bg-slate-950 cursor-pointer"
              />
            </div>
            
            <div>
              <label className="text-xs text-slate-400 block mb-1">فترة تبريد التنبيهات (بالدقائق): {cooldownMinutes} دقيقة</label>
              <input
                type="number"
                min="5"
                max="120"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">رابط Discord Webhook (اختياري للإشعارات):</label>
            <input
              type="text"
              placeholder="https://discord.com/api/webhooks/..."
              value={discordWebhook}
              onChange={(e) => setDiscordWebhook(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* نموذج البحث */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <form onSubmit={handleAnalyze} className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder="أدخل رمز السهم (مثال: TSLA, AAPL, NVDA)..."
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 uppercase font-mono"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {loading ? '⏳ جاري التحليل...' : '🔍 فحص عسكري مباشر'}
            </button>
          </form>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
            <span className="text-xs text-slate-400">فحص قائمة الأسهم الذكية تلقائياً:</span>
            <button
              onClick={handleScan}
              disabled={scanLoading}
              className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-semibold px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2"
            >
              {scanLoading ? '📡 جاري البحث في السوق...' : '🚀 مسح السوق التلقائي الآن'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-800 text-rose-300 p-4 rounded-xl text-center">
            ⚠️ {error}
          </div>
        )}

        {scanResults.length > 0 && (
          <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-2xl shadow-xl space-y-3">
            <h3 className="text-emerald-400 font-bold flex items-center gap-2">
              🟢 الأسهم المطابقة لشروط الصيد العسكري ({scanResults.length}) بنسبة ثقة $\ge$ {minConfidence}%
            </h3>
            <div className="flex flex-wrap gap-2">
              {scanResults.map((sym) => (
                <button
                  key={sym}
                  onClick={() => { setSymbol(sym); }}
                  className="bg-slate-950 border border-slate-800 hover:border-emerald-500 text-white font-mono px-4 py-2 rounded-xl transition-all font-bold"
                >
                  {sym} 🔥
                </button>
              ))}
            </div>
          </div>
        )}

        {data && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-mono font-bold text-amber-400 flex items-center gap-3">
                  {data.symbol} 
                  <span className="text-white text-lg bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                    ${data.price}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">مؤشر الزخم RSI: <span className="text-white font-mono">{data.rsi}</span></p>
              </div>

              <div className="bg-slate-950 border border-amber-500/40 px-4 py-2 rounded-xl text-center shadow-inner">
                <span className="text-xs text-slate-400 block">🔮 بطاقة الثقة التنبؤية</span>
                <span className="text-lg font-black text-amber-400">{data.confidenceScore}% 🎯</span>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-3">
              <div>
                <span className="text-xs text-slate-400 block">🎚️ شريط الاختراق والاتجاه:</span>
                <span className="text-sm font-bold text-emerald-300 mt-0.5 block">{data.breakoutTape}</span>
              </div>
              <div className="text-left">
                <span className="text-xs text-slate-400 block">📈 معدل الاختراق والزخم:</span>
                <span className="text-sm font-mono font-bold text-amber-400">{data.momentumRate}%</span>
              </div>
            </div>

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">📋 التقرير العسكري المفصل:</h4>
              <pre className="whitespace-pre-wrap text-slate-200 text-sm font-sans leading-relaxed">
                {data.analysis}
              </pre>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-center">
              <div className={`p-3 rounded-xl border ${data.isSuitable ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                حالة النموذج: {data.isSuitable ? 'مؤكد 🔥' : 'تحت المراقبة ⚠️'}
              </div>
              <div className={`p-3 rounded-xl border ${data.hasWhaleVolume ? 'bg-amber-950/30 border-amber-800/50 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                رادار الحيتان: {data.hasWhaleVolume ? 'نشط 🐋' : 'هادئ 🛡️'}
              </div>
              <div className={`p-3 rounded-xl border ${data.hasFVG ? 'bg-blue-950/30 border-blue-800/50 text-blue-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                فراغات FVG: {data.hasFVG ? 'موجودة 🧲' : 'لا توجد ⚠️'}
              </div>
              <div className={`p-3 rounded-xl border ${!data.isTrapDetected ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-rose-950/30 border-rose-800/50 text-rose-300'}`}>
                فخاخ السوق: {data.isTrapDetected ? 'تحذير فخ ❌' : 'منطقة نظيفة ✅'}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
