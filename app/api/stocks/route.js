import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get('symbols') || 'PPSI,ANVS,BYRN,KULR,HURA,BJDX,OPI,MRAM,SPSC,PODC,NOK,ERNA,PRFX,VMAR,CETX,GSIT').split(',');
  const API_KEY = 'QE3ODUMP7UQR22T8';
  let alerts = [];

  for (const symbol of symbols) {
    try {
      const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = await res.json();
      if (!data['Time Series (Daily)']) continue;

      const dailyData = Object.values(data['Time Series (Daily)']);
      const price = parseFloat(dailyData[0]['4. close']);
      const prevPrice = parseFloat(dailyData[1]['4. close']);
      const avgPrice = dailyData.slice(0, 10).reduce((a, b) => a + parseFloat(b['4. close']), 0) / 10;
      const vol = parseFloat(dailyData[0]['5. volume']);
      const avgVol = dailyData.slice(1, 11).reduce((a, b) => a + parseFloat(b['5. volume']), 0) / 10;

      // شرط الدخول (السنايبر): اختراق إيجابي + فوليوم عالي
      if (price > prevPrice * 1.02 && vol > avgVol * 1.5) {
        alerts.push({ symbol, msg: '🚀 فرصة دخول: اختراق بفوليوم' });
      }
      // شرط تنبيه الانعكاس (إدارة المخاطر): هبوط حاد
      else if (price < avgPrice * 0.95) {
        alerts.push({ symbol, msg: '⚠️ تنبيه خطر: انعكاس سعري' });
      }
    } catch (e) { continue; }
  }

  if (alerts.length > 0) {
    await fetch('https://trading-bot-pro-sage.vercel.app/api/telegram', {
      method: 'POST',
      body: JSON.stringify({ type: 'NEW_TRADE', data: alerts[0] })
    });
  }
  return NextResponse.json({ alerts });
}
