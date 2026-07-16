import { NextResponse } from 'next/server';

export async function GET(req) {
  const API_KEY = process.env.MASSIVE_API_KEY;
  const BOT_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
  const CHAT_ID = '896028407';

  try {
    // 1. جلب الـ 20 سهم الأكثر ارتفاعاً (الترند) من Massive
    const gainersRes = await fetch(`https://api.massive.com/v3/stocks/gainers?limit=20&apiKey=${API_KEY}`);
    const gainersData = await gainersRes.json();
    
    // تأكد من هيكلة البيانات حسب استجابة Massive
    const symbols = gainersData.results.map(s => s.ticker);

    let alerts = [];

    // 2. تحليل كل سهم من الـ 20 سهم
    for (const symbol of symbols) {
      const res = await fetch(`https://api.massive.com/v3/stocks/${symbol}/daily?apiKey=${API_KEY}`);
      const data = await res.json();
      
      if (!data || !data.results || data.results.length < 50) continue;

      const latest = data.results[0]; 
      const history = data.results.slice(1, 51); // لاستخراج المتوسطات
      
      const price = latest.c;
      const vol = latest.v;
      const avgVol = history.reduce((a, b) => a + b.v, 0) / 50;
      const sma50 = history.reduce((a, b) => a + b.c, 0) / 50;

      // 3. الفلترة: السعر فوق متوسط 50 يوم + الفوليوم انفجاري
      if (price > sma50 && vol > (avgVol * 1.5)) {
        
        // إرسال التنبيه فوراً
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: CHAT_ID, 
                text: `🔥 رادار السنايبر الآلي:\nسهم ${symbol} يحقق شروط الانفجار!\nالسعر الحالي: $${price}\nالتحليل: ترند صاعد + فوليوم عالي` 
            })
        });
        alerts.push(symbol);
      }
    }
    return NextResponse.json({ scanned: symbols.length, alerts });
  } catch (e) {
    return NextResponse.json({ error: 'System busy, try again later' }, { status: 500 });
  }
}
