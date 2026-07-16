import { NextResponse } from 'next/server';

export async function GET(req) {
  const API_KEY = process.env.MASSIVE_API_KEY;
  const BOT_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
  const CHAT_ID = '896028407';

  try {
    // جلب قائمة الـ 20 سهم الأكثر ارتفاعاً (الترند)
    const gainersRes = await fetch(`https://api.massive.com/v3/stocks/gainers?limit=20&apiKey=${API_KEY}`);
    const gainersData = await gainersRes.json();
    
    if (!gainersData?.results) throw new Error("تعذر جلب بيانات الترند");

    const symbols = gainersData.results.map(s => s.ticker);
    let alerts = [];

    for (const symbol of symbols) {
      const res = await fetch(`https://api.massive.com/v3/stocks/${symbol}/daily?apiKey=${API_KEY}`);
      const data = await res.json();
      
      if (!data.results || data.results.length < 50) continue;

      const latest = data.results[0];
      const history = data.results.slice(1, 51);
      const sma50 = history.reduce((a, b) => a + b.c, 0) / 50;
      const avgVol = history.reduce((a, b) => a + b.v, 0) / 50;

      // شرط الانفجار: السعر فوق SMA 50 والفوليوم أكثر من المتوسط بـ 1.5 مرة
      if (latest.c > sma50 && latest.v > (avgVol * 1.5)) {
        alerts.push(symbol);
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: CHAT_ID, 
                text: `🚀 رادار السنايبر الآلي اكتشف: ${symbol}\nالسعر: $${latest.c}\nالحالة: انفجار فوليوم` 
            })
        });
      }
    }
    return NextResponse.json({ alerts });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
