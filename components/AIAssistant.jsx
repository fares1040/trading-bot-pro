// components/AIAssistant.jsx
'use client';

import React, { useState } from 'react';

export default function SmartManagementHub() {
  const [portfolioSize, setPortfolioSize] = useState(10000);
  const [riskPercent] = useState(2);
  const [entryPrice, setEntryPrice] = useState(15);
  const [stopLossPrice, setStopLossPrice] = useState(14.2);

  const riskAmount = (portfolioSize * (riskPercent / 100)).toFixed(2);
  const riskPerShare = (entryPrice - stopLossPrice).toFixed(2);
  const suggestedShares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;

  const [dcaTotalAmount, setDcaTotalAmount] = useState(3000);
  const amountPerTranche = (dcaTotalAmount / 3).toFixed(2);

  const [isOpenAI, setIsOpenAI] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    { sender: 'ai', text: 'أهلاً بك يا بطل! أنا مساعد سنايبر الذكي. اسألني عن أي سهم أو صفقة (مثلاً: تحليل سهم SERV الآن مع السعر الفعلي).' }
  ]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim() || isLoading) return;

    const userMsg = chatQuery;
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setChatQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg, mode: 'general' })
      });

      const data = await response.json();
      const aiReply = data.reply || data.analysis || 'عذراً، لم أتمكن من جلب التحليل المباشر حالياً.';

      setChatHistory(prev => [...prev, { sender: 'ai', text: aiReply }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { sender: 'ai', text: 'حدث خطأ في الاتصال بخادم التحليل الذكي.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen space-y-6 p-6 bg-[#090A0F] text-slate-100 rounded-2xl border border-slate-800">
      
      {/* لوحة استراتيجية الذكاء الاصطناعي اليومية */}
      <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20">
        <h4 className="text-sm font-black text-indigo-400 flex items-center gap-2 mb-2">
          🤖 توجيهات مستشار سنايبر الـ AI لليوم
        </h4>
        <div className="text-xs text-slate-300 space-y-1">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <span>✔ قطاعات مستهدفة وعالية السيولة:</span> AI Stocks / Semiconductor / Small Caps 🚀
          </div>
          <div className="flex items-center gap-2 text-rose-400 font-semibold">
            <span>❌ قطاعات مستبعدة لضعف الرواج:</span> Biotech (تم الإخراج التلقائي لتفادي جمود رأس المال)
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-black text-purple-400 flex items-center gap-2">
          🧠 أدوات القيادة الذكية وإدارة حجم الصفقات
        </h3>
        <p className="text-xs text-slate-400 mt-1">تنسيق فوري للمخاطر وتخطيط الدفعات الآمنة لحماية صفقات السنتات والأوبشنز.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* حاسبة المخاطر اللحظية */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <h4 className="text-sm font-semibold text-emerald-400 mb-3">📊 حاسبة حجم الصفقة (Position Sizing)</h4>
          <div className="space-y-2 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">حجم المحفظة الإجمالي ($):</label>
              <input type="number" value={portfolioSize} onChange={(e) => setPortfolioSize(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1">سعر الدخول ($):</label>
                <input type="number" value={entryPrice} onChange={(e) => setEntryPrice(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">وقف الخسارة ($):</label>
                <input type="number" value={stopLossPrice} onChange={(e) => setStopLossPrice(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono" />
              </div>
            </div>
            <div className="p-3 rounded bg-slate-950 border border-slate-800 mt-3 font-mono text-cyan-300 text-[11px]">
              <div className="flex justify-between"><span>المبلغ المعرض للمخاطر (2%):</span> <strong className="text-white">${riskAmount}</strong></div>
              <div className="flex justify-between"><span>عدد الأسهم المقترح:</span> <strong className="text-emerald-400">{suggestedShares} سهم</strong></div>
            </div>
          </div>
        </div>

        {/* حاسبة DCA */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-md flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-cyan-400 mb-3">🛡️ حاسبة التجميع وتوزيع السيولة (DCA Planner)</h4>
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">المبلغ المخصص للاستثمار ($):</label>
                <input type="number" value={dcaTotalAmount} onChange={(e) => setDcaTotalAmount(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono" />
              </div>
              <div className="p-3 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px]">
                <div className="flex justify-between"><span>مبلغ الدفعة الواحد (من 3 دفعات):</span> <strong className="text-emerald-400">${amountPerTranche}</strong></div>
              </div>
            </div>
          </div>
          <div className="mt-3 p-2 rounded bg-purple-950/40 border border-purple-500/20 text-[10px] text-purple-300">
            🔔 رادار مسح الارتدادات يبحث لك عن قيعان 52 أسبوع للتجميع الفوري الآمن.
          </div>
        </div>
      </div>

      {/* شات البوت الذكي العائم */}
      <div className="fixed bottom-6 left-6 z-50">
        {!isOpenAI ? (
          <button onClick={() => setIsOpenAI(true)} className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-indigo-600 text-white rounded-full shadow-2xl hover:scale-105 transition-all text-xs font-bold border border-indigo-400/30">
            🤖 اسأل مستشار سنايبر AI
          </button>
        ) : (
          <div className="w-80 h-96 bg-slate-950 border border-indigo-500/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-slate-900 p-3 border-b border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold text-indigo-400">🤖 لوحة محادثة سنايبر AI</span>
              <button onClick={() => setIsOpenAI(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`p-2 rounded-lg max-w-[85%] ${msg.sender === 'user' ? 'bg-indigo-900/40 text-indigo-200 ml-auto' : 'bg-slate-900 text-slate-200'}`}>
                  {msg.text}
                </div>
              ))}
              {isLoading && (
                <div className="p-2 rounded-lg max-w-[85%] bg-slate-900 text-indigo-400 animate-pulse">
                  جاري تحليل الأسعار والسيولة الحية...
                </div>
              )}
            </div>
            <form onSubmit={handleSendMessage} className="p-2 border-t border-slate-800 flex gap-1 bg-slate-900">
              <input type="text" placeholder="اكتب اسم السهم لمعرفة سبب الصيد الفني..." value={chatQuery} onChange={(e) => setChatQuery(e.target.value)} disabled={isLoading} className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white" />
              <button type="submit" disabled={isLoading} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-bold disabled:opacity-50">إرسال</button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}
