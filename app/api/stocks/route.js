import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  // يستقبل الأسهم من الرابط، وإذا لم توجد يستخدم القائمة الافتراضية
  const symbols = searchParams.get('symbols') ? searchParams.get('symbols').split(',') : ['PPSI', 'ANVS', 'BYRN'];
  
  const API_KEY = 'QE3ODUMP7UQR22T8';
  const BOT_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
  const CHAT_ID = '896028407';
  let alerts = [];

  for (const symbol of symbols) {
    try {
      const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`);
      const data = await res.json();
      if (!data['Time Series (Daily)']) continue;

      const dailyData = Object.values(data['Time Series (Daily)']);
      const price = parseFloat(dailyData[0]['4. close']);
      const prevPrice = parseFloat(dailyData[1]['4. close']);
      const vol = parseFloat(dailyData[0]['5. volume']);
      const avgVol = dailyData.slice(1, 11).reduce((a, b) => a + parseFloat(b['5. volume']), 0) / 10;

      if (price > prevPrice * 1.02 && vol > avgVol * 1.5) {
        alerts.push({ symbol, msg: '🚀 اختراق بفوليوم' });
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: `رادار السنايبر: فرصة في ${symbol} بسعر ${price}` })
        });
      }
    } catch (e) { continue; }
  }
  return NextResponse.json({ alerts });
}
