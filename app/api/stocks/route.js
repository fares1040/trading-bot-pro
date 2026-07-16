import { NextResponse } from 'next/server';

export async function GET(req) {
  // 1. تعريف المتغيرات
  const API_KEY = process.env.MASSIVE_API_KEY;
  const BOT_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
  const CHAT_ID = '896028407';

  // 2. التحقق من وجود المفتاح
  if (!API_KEY) {
    return NextResponse.json({ error: "غير موجود في متغيرات البيئة الخاص بـ Massive API" }, { status: 500 });
  }

  try {
    // 3. جلب قائمة الـ Gainers
    const gainersRes = await fetch(`https://api.massive.com/v3/stocks/gainers?limit=20&apiKey=${API_KEY}`);
    const gainersData = await gainersRes.json();
    
    if (!gainersData?.results) {
      return NextResponse.json({ alerts: [] });
    }

    const symbols = gainersData.results.map(s => s.ticker);
    let alerts = [];

    // 4. تحليل الأسهم
    for (const symbol of symbols) {
      const res = await fetch(`https://api.massive.com/v3/stocks/${symbol}/daily?apiKey=${API_KEY}`);
      const data = await res.json();
      
      if (!data?.results || data.results.length < 50) continue;

      const latest = data.results[0];
      const history = data.results.slice(1, 51);
      const sma50 = history.reduce((a, b) => a + b.c, 0) / 50;
      const avgVol = history.reduce((a, b) => a + b.v, 0) / 50;

      // شرط السنايبر
      if (latest.c > sma50 && latest.v > (avgVol * 1.5)) {
        alerts.push(symbol);
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: `🚀 فرصة: ${symbol}` })
        });
      }
    }
    return NextResponse.json({ alerts: alerts });
  } catch (e) {
    return NextResponse.json({ alerts: [], error: e.message }, { status: 500 });
  }
}
