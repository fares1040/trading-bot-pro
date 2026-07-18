import { NextResponse } from 'next/server';

export async function GET(request) {
  const BOT_TOKEN = '8822034470:AAEBooViT3tdkkQqt2lX86GZBWipYUq0MgA';
  const CHAT_ID = '896028407';
  const MIN_VOLUME = 100000;

  // 1. قائمتك الثابتة + أسهم ترند من ياهو (Most Active)
  // هذا الرابط يعطيك الأسهم الأكثر نشاطاً حالياً كبيانات منظمة
  const resTrending = await fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=most_actives&count=5');
  const dataTrending = await resTrending.json();
  const trendingSymbols = dataTrending.finance.result[0].quotes.map(q => q.symbol);
  
  const myWatchList = ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI'];
  const fullList = [...new Set([...myWatchList, ...trendingSymbols])];

  // 2. فحص القائمة المدمجة
  for (const symbol of fullList) {
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m`);
      const data = await res.json();
      const meta = data.chart.result[0].meta;
      const price = meta.regularMarketPrice;
      const volume = meta.regularMarketVolume || 0;

      if (volume < MIN_VOLUME) continue;

      const t1 = (price * 1.03).toFixed(2);
      const t2 = (price * 1.05).toFixed(2);
      const t3 = (price * 1.08).toFixed(2);
      const stopLoss = (price * 0.98).toFixed(2);

      const message = `🚨 صيد ذكي: ${symbol}\n💰 السعر: ${price}\n📊 الفوليوم: ${volume.toLocaleString()}\n🎯 الأهداف: ${t1} | ${t2} | ${t3}\n🛑 وقف الخسارة: ${stopLoss}`;

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(message)}`);
      
    } catch (error) {
      continue; // إذا سهم واحد فشل، كمل الباقي ولا توقف
    }
  }

  return NextResponse.json({ status: "Scanner Active", processedCount: fullList.length });
}
