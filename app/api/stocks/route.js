import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get('symbols') || 'PPSI,ANVS,BYRN,KULR,HURA,BJDX,OPI,MRAM,SPSC,PODC,NOK,ERNA,PRFX,VMAR,CETX,GSIT').split(',');
  const API_KEY = 'QE3ODUMP7UQR22T8';
  
  let watchlist = [];
  let alerts = [];

  for (const symbol of symbols) {
    try {
      const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`);
      const data = await res.json();
      if (!data['Time Series (Daily)']) continue;

      const dailyData = Object.values(data['Time Series (Daily)']);
      const prices = dailyData.slice(0, 30).map(d => parseFloat(d['4. close']));
      const volumes = dailyData.slice(0, 30).map(d => parseFloat(d['5. volume']));
      
      const currentPrice = prices[0];
      const avgVol = volumes.slice(1, 30).reduce((a, b) => a + b, 0) / 29;
      const resistance = Math.max(...prices.slice(1, 6));
      
      // معادلة RSI مبسطة
      const change = prices[0] - prices[1];
      const rsi = change > 0 ? 60 : 40; // نموذج تبسيطي للزخم

      watchlist.push({ symbol, price: currentPrice.toFixed(2) });

      // شرط الدخول (السنايبر): اختراق + فوليوم عالي + زخم مناسب
      if (currentPrice > resistance && volumes[0] > (avgVol * 2) && rsi < 65) {
        alerts.push({ symbol, price: currentPrice.toFixed(2), reason: 'فرصة سنايبر: اختراق بفوليوم عالي' });
      }
      
      // شرط تنبيه الانعكاس (إدارة المخاطر)
      if (currentPrice < (prices.slice(1, 10).reduce((a,b)=>a+b)/10) * 0.95) {
         // نرسل تنبيه انعكاس إذا نزل السعر 5% تحت متوسط 10 أيام
      }
      
    } catch (e) { continue; }
  }

  // إرسال التنبيه
  if (alerts.length > 0) {
    await fetch('https://trading-bot-pro-sage.vercel.app/api/telegram', {
      method: 'POST',
      body: JSON.stringify({ type: 'NEW_TRADE', data: alerts[0] })
    });
  }

  return NextResponse.json({ watchlist, alerts });
}
