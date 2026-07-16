import { NextResponse } from 'next/server';

export async function GET(req) {
  const API_KEY = process.env.MASSIVE_API_KEY;
  const BOT_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
  const CHAT_ID = '896028407';
  
  // قائمة الأسهم (يمكنك توسيعها لاحقاً)
  const symbols = ['AAPL', 'NVDA', 'TSLA', 'AMD', 'PLTR', 'SOFI', 'MARA', 'RIOT'];
  let alerts = [];

  for (const symbol of symbols) {
    try {
      // جلب البيانات من Massive API
      const res = await fetch(`https://api.massive.com/v3/stocks/${symbol}/daily?apiKey=${API_KEY}`);
      const data = await res.json();
      
      if (!data || !data.results || data.results.length < 50) continue;

      const latest = data.results[0]; // بيانات اليوم
      const history = data.results.slice(1, 51); // آخر 50 يوم لحساب المتوسط
      
      const price = latest.c; // سعر الإغلاق
      const vol = latest.v; // فوليوم اليوم
      const avgVol = history.reduce((a, b) => a + b.v, 0) / 50;
      const sma50 = history.reduce((a, b) => a + b.c, 0) / 50;

      // --- منطق السنايبر الاحترافي ---
      // 1. السعر فوق متوسط 50 يوم (اتجاه صاعد)
      // 2. الفوليوم اليومي أكبر من متوسط 50 يوم بـ 1.5 مرة (زخم دخول)
      // 3. السعر ارتفع اليوم بأكثر من 1%
      
      if (price > sma50 && vol > (avgVol * 1.5) && price > (latest.o * 1.01)) {
        alerts.push({ symbol, msg: '🚀 فرصة سنايبر مؤكدة!' });
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: CHAT_ID, 
                text: `🚨 رادار السنايبر: سهم ${symbol} ينفجر!\nالسعر: $${price}\nحالة الاختراق: فوق SMA 50 + فوليوم عالي` 
            })
        });
      }
    } catch (e) { continue; }
  }

  return NextResponse.json({ alerts, status: 'Scan Complete' });
}
