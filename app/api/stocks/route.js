import { NextResponse } from 'next/server';

export async function GET(req) {
  const API_KEY = process.env.MASSIVE_API_KEY;
  const BOT_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
  const CHAT_ID = '896028407';

  try {
    // 1. جلب قائمة الـ 20 سهم الأكثر ارتفاعاً (الترند) من Massive
    const gainersRes = await fetch(`https://api.massive.com/v3/stocks/gainers?limit=20&apiKey=${API_KEY}`);
    const gainersData = await gainersRes.json();
    
    if (!gainersData || !gainersData.results) {
      return NextResponse.json({ error: 'تعذر جلب البيانات من المنصة' }, { status: 500 });
    }

    const symbols = gainersData.results.map(s => s.ticker);
    let alerts = [];

    // 2. تحليل كل سهم
    for (const symbol of symbols) {
      const res = await fetch(`https://api.massive.com/v3/stocks/${symbol}/daily?apiKey=${API_KEY}`);
      const data = await res.json();
      
      if (!data.results || data.results.length < 50) continue;

      const latest = data.results[0]; 
      const history = data.results.slice(1, 51);
      
      const price = latest.c;
      const vol = latest.v;
      const avgVol = history.reduce((a, b) => a + b.v, 0) / 50;
      const sma50 = history.reduce((a, b) => a + b.c, 0) / 50;

      // 3. فلترة السنايبر
      if (price > sma50 && vol > (avgVol * 1.5)) {
        alerts.push(symbol);
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: CHAT_ID, 
                text: `🚀 رادار السنايبر الآلي:\nالسهم: ${symbol}\nالسعر: $${price}\nالحالة: انفجار فوليوم + اتجاه صاعد` 
            })
        });
      }
    }
    return NextResponse.json({ scanned: symbols.length, alerts });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
