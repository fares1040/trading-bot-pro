import { NextResponse } from 'next/server';

export async function GET(request) {
  const watchList = ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI'];
  const BOT_TOKEN = '8822034470:AAEBooViT3tdkkQqt2lX86GZBWipYUq0MgA';
  const CHAT_ID = '896028407';

  for (const symbol of watchList) {
    try {
      // 1. جلب السعر اللحظي
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m`);
      const data = await res.json();
      const price = data.chart.result[0].meta.regularMarketPrice;

      // 2. حساب الأهداف "الطماعة"
      const t1 = (price * 1.03).toFixed(2);
      const t2 = (price * 1.05).toFixed(2);
      const t3 = (price * 1.08).toFixed(2);

      // 3. صياغة رسالة الصيد
      const message = `🚨 صيد جديد! سهم ${symbol} يحقق شروط الدخول\n💰 السعر: ${price}\n🎯 الأهداف:\nهدف 1: ${t1}\nهدف 2: ${t2}\nهدف 3: ${t3}`;

      // 4. الإرسال للتلجرام
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(message)}`);
      
    } catch (error) {
      console.error(`Error processing ${symbol}:`, error);
    }
  }

  return NextResponse.json({ status: "Scanner Active & Targets Calculated" });
}
