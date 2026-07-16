import { NextResponse } from 'next/server';

export async function GET(req) {
  // المحرك الذكي: يمكنك إضافة أي عدد من الأسهم هنا
  const marketList = ['AAPL', 'ERNA', 'PPSI', 'ANVS', 'BYRN', 'LCID', 'NVDA', 'AMD', 'RHI', 'TGHL'];
  const API_KEY = 'QE3ODUMP7UQR22T8';
  const BOT_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
  const CHAT_ID = '896028407';
  let alerts = [];

  for (const symbol of marketList) {
    try {
      const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`);
      const data = await res.json();
      if (!data['Time Series (Daily)']) continue;

      const dailyData = Object.values(data['Time Series (Daily)']);
      const price = parseFloat(dailyData[0]['4. close']);
      const prevPrice = parseFloat(dailyData[1]['4. close']);
      const vol = parseFloat(dailyData[0]['5. volume']);
      const avgVol = dailyData.slice(1, 11).reduce((a, b) => a + parseFloat(b['5. volume']), 0) / 10;

      // منطق الاختراق (سنايبر)
      if (price > prevPrice * 1.02 && vol > avgVol * 1.5) {
        alerts.push({ symbol, msg: '🚀 فرصة دخول: اختراق بفوليوم' });
        // تنبيه تليجرام تلقائي
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: `رادار السنايبر: فرصة في ${symbol}\nالسعر: ${price}` })
        });
      }
    } catch (e) { continue; }
  }
  return NextResponse.json({ alerts });
}
