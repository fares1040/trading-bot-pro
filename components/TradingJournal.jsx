'use client';

import React, { useState } from 'react';

export default function AutoPilotJournalAndReports() {
  const [trades, setTrades] = useState([
    { id: 1, ticker: 'PLTR', entry: '$24.50', target: '$27.00', status: '✅ حققت الهدف (+12%)', type: 'سوينغ طويل' },
    { id: 2, ticker: 'AMD', entry: '$132.00', target: '$140.00', status: '⏳ جاري المتابعة', type: 'عقود سنتات' },
  ]);

  const [showFlexCard, setShowFlexCard] = useState(false);

  // دالة ترحيل صفقة جديدة للسجل الآلي
  const addTradeToJournal = (ticker, type) => {
    const newTrade = {
      id: Date.now(),
      ticker: ticker,
      entry: 'السعر الحالي',
      target: 'محدد ديناميكياً',
      status: '⏳ نشط بالطيار الآلي',
      type: type
    };
    setTrades([newTrade, ...trades]);
  };

  return (
    <div className="space-y-8 p-6 bg-[#090A0F] text-slate-100 rounded-2xl border border-slate-800">
      
      {/* رأس القسم */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-emerald-400 flex items-center gap-2">
            🚀 الطيار الآلي، سجل الصفقات وتقارير الصمت الطويل
          </h3>
          <p className="text-xs text-slate-400 mt-1">أتمتة كاملة، تحديث ذاتي للأداء، وبطاقات مشاركة الأرباح الفاخرة.</p>
        </div>
        <button 
          onClick={() => setShowFlexCard(true)}
          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-purple-600 text-white rounded-xl text-xs font-bold shadow-lg hover:opacity-90 transition-all border border-purple-400/30"
        >
          📸 مشاركة الإنجاز (Flex Card)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* مؤشرات الأداء السريع (Win Rate & Stats) */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-md flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-purple-300 mb-3">📊 مؤشر الأداء العام (Win Rate)</h4>
            <div className="text-3xl font-black text-white font-mono mb-1">88.5%</div>
            <p className="text-xs text-emerald-400">📈 نسبة صفقات السوينغ الناجحة هذا الشهر</p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
            🤖 الطيار الآلي مفعل: يتم إرسال تقارير تليجرام فور اختراق المقاومات.
          </div>
        </div>

        {/* تقرير الصمت الطويل (Daily / Weekly Summary) */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 md:col-span-2 backdrop-blur-md">
          <h4 className="text-sm font-semibold text-cyan-300 mb-3">📋 تقرير "الصمت الطويل" (ملخص العودة من الدوام)</h4>
          <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs font-mono text-slate-300">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-500">حالة المحفظة أثناء غيابك:</span> 
              <span className="text-emerald-400">آمنة ومحمية بأوامر (Stop Loss)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-500">الصفقات التي حققت أهدافها:</span> 
              <span className="text-white">سهم PLTR (+12% أهداف محققة)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">تنبيهات تيليجرام المرسلة:</span> 
              <span className="text-purple-300">3 تنبيهات فوليوم واستثمارية</span>
            </div>
          </div>
        </div>

      </div>

      {/* سجل الصفقات ذاتي التحديث */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-semibold text-white">📑 سجل الصفقات الذاتي (Auto-Pilot Journal)</h4>
          <button 
            onClick={() => addTradeToJournal('SOFI', 'سوينغ استثماري')}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-xs border border-slate-700 transition-all"
          >
            + إرحل صفقة تجريبية للسجل
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="pb-2 text-right">السهم</th>
                <th className="pb-2 text-right">نوع الصفقة</th>
                <th className="pb-2 text-right">سعر الدخول</th>
                <th className="pb-2 text-right">الهدف</th>
                <th className="pb-2 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {trades.map(t => (
                <tr key={t.id} className="hover:bg-slate-950/40">
                  <td className="py-2.5 text-right font-bold text-white">{t.ticker}</td>
                  <td className="py-2.5 text-right text-purple-300">{t.type}</td>
                  <td className="py-2.5 text-right">{t.entry}</td>
                  <td className="py-2.5 text-right">{t.target}</td>
                  <td className="py-2.5 text-right text-emerald-400">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* نافذة بطاقة مشاركة الأرباح المنبثقة (Flex Card Modal) */}
      {showFlexCard && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-96 p-6 rounded-2xl bg-gradient-to-b from-purple-950 via-slate-950 to-black border border-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.3)] text-center relative">
            <button 
              onClick={() => setShowFlexCard(false)} 
              className="absolute top-3 left-3 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>

            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-900/40 border border-purple-500/40 text-purple-300 inline-block mb-3">
              🎯 منصة سنايبر | Cyberpunk Edition
            </span>
            <h3 className="text-xl font-black text-white mb-1">تقرير إنجاز صفقة رابحة</h3>
            <p className="text-xs text-emerald-400 mb-6">معدل نجاح الصفقات: 88.5% 🚀</p>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 mb-6 text-right space-y-2 font-mono text-xs">
              <div className="flex justify-between"><span className="text-slate-400">السهم:</span> <strong className="text-white">PLTR</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">العائد المحقق:</span> <strong className="text-emerald-400">+12.4%</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">نوع الصفقة:</span> <strong className="text-purple-300">سوينغ استثماري</strong></div>
            </div>

            <button 
              onClick={() => { alert('تم نسخ بطاقة الإنجاز وجاهزة للمشاركة على تويتر/إكس!'); setShowFlexCard(false); }}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-purple-600 text-white rounded-xl text-xs font-bold shadow-lg"
            >
              📸 نسخ البطاقة للنشر الفوري
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
