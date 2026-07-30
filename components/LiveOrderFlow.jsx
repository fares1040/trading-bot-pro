'use client';

import React, { useState, useEffect } from 'react';

export default function LiveOrderFlow() {
  const [whaleAlerts, setWhaleAlerts] = useState([
    { id: 1, ticker: 'PLTR', type: 'شراء هجومي (Aggressive Call)', contract: 'Call $35 - عُقود سنتات', volume: '12,450 عقد', sentiment: '🔥 تدفق سيولة ضخم' },
    { id: 2, ticker: 'AMD', type: 'شراء دفاعي (Hedge Put)', contract: 'Put $120', volume: '8,300 عقد', sentiment: '🛡️ تمركز مؤسسي' },
    { id: 3, ticker: 'SOFI', type: 'صيد حيتان (Block Trade)', contract: 'Call $15 - دبل مستهدف', volume: '15,120 عقد', sentiment: '🚀 انفجار مرتقب' }
  ]);

  const [blockTrades, setBlockTrades] = useState([
    { time: '09:32:15', ticker: 'AMD', size: '50,000 سهم', price: '$134.50', type: 'شراء مباشر (Ask Side)' },
    { time: '09:31:40', ticker: 'PLTR', size: '120,000 سهم', price: '$24.80', type: 'صفقة كبرى (Dark Pool)' },
    { time: '09:30:10', ticker: 'SOFI', size: '85,000 سهم', price: '$9.45', type: 'شراء مؤسسي صامت' }
  ]);

  // محاكاة وصول صفقات حية جديدة كل فترة لتبدو المنصة وكأنها شريط وول ستريت الحي
  useEffect(() => {
    const interval = setInterval(() => {
      const tickers = ['AAPL', 'NVDA', 'TSLA', 'F', 'NIO', 'RIVN'];
      const randomTicker = tickers[Math.floor(Math.random() * tickers.length)];
      const randomSize = Math.floor(Math.random() * 90 + 10) + ',000 سهم';
      const randomPrice = (Math.random() * 50 + 10).toFixed(2);
      
      const newTrade = {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        ticker: randomTicker,
        size: randomSize,
        price: `$${randomPrice}`,
        type: Math.random() > 0.5 ? '🔥 شراء هجومي (Block Trade)' : '⚡ دخول سيولة ذكية'
      };

      setBlockTrades(prev => [newTrade, ...prev.slice(0, 4)]);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      
      {/* رأس القسم */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
            🐋 رادار "صيد الحيتان" وتدفق السيولة الحية
          </h3>
          <p className="text-xs text-slate-400 mt-1">تتبع الصفقات الضخمة وعقود السنتات الهجومية لحظة بلحظة</p>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 animate-pulse">
          ● مباشر (Live Matrix)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* صندوق رادار الحيتان وعقود السنتات */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <h4 className="text-sm font-semibold text-purple-300 mb-4 flex items-center gap-2">
            ⚡ عقود الأوبشن الاستثنائية (صيد الحيتان)
          </h4>
          <div className="space-y-3">
            {whaleAlerts.map(alert => (
              <div key={alert.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-purple-500/40 transition-all">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white text-sm">{alert.ticker}</span>
                  <span className="text-xs text-purple-400 font-mono">{alert.sentiment}</span>
                </div>
                <div className="text-xs text-slate-300 mb-1">{alert.contract}</div>
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>الحجم: <strong className="text-emerald-400">{alert.volume}</strong></span>
                  <span className="text-cyan-400">{alert.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* صندوق خريطة تدفق السيولة الحية (Block Trades Ticker) */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <h4 className="text-sm font-semibold text-cyan-300 mb-4 flex items-center gap-2">
            📊 شريط الصفقات الكبرى (Wall Street Flow)
          </h4>
          <div className="space-y-2 font-mono text-xs">
            {blockTrades.map((trade, index) => (
              <div key={index} className="p-2.5 rounded bg-slate-950/80 border border-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{trade.time}</span>
                  <span className="text-white font-bold px-1.5 py-0.5 rounded bg-slate-800">{trade.ticker}</span>
                </div>
                <div className="text-emerald-400">{trade.size} @ {trade.price}</div>
                <div className="text-purple-300 text-[10px]">{trade.type}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
