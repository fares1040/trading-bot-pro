import { NextResponse } from 'next/server';

export async function GET(req) {
  const API_KEY = 'QE3ODUMP7UQR22T8';
  const BOT_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
  const CHAT_ID = '896028407';
  let alerts = [];

  // 1. نجلب قائمة الـ Top Gainers من Alpha Vantage مباشرة
  const marketRes = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS&apikey=${API_KEY}`);
  const marketData = await marketRes.json();
  
  // نأخذ أول 10 أسهم فقط لضمان سرعة التنفيذ وعدم تجاوز حدود الـ API
  const topStocks = marketData.top_gainers ? marketData.top_gainers.slice(0, 10) : [];

  for (const stock of topStocks) {
    const symbol = stock.ticker;
    try {
      // 2. فحص تفاصيل السهم (فوليوم والسعر)
      const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`);
      const data = await res.json();
      if (!data['Time Series (Daily)']) continue;

      const dailyData = Object.values(data['Time Series (Daily)']);
      const price = parseFloat(dailyData[0]['4. close']);
      const prevPrice = parseFloat(dailyData[1]['4. close']);
      const vol = parseFloat(dailyData[0]['5. volume']);
      const avgVol = dailyData.slice(1, 11).reduce((a, b) => a + parseFloat(b['5. volume']), 0) / 10;

      // 3. تطبيق منطق السنايبر الخاص بك
      if (price > prevPrice * 1.01 && vol > avgVol * 1.2) {
        alerts.push({ symbol, msg: '🚀 فرصة انفجارية مرصودة!' });
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: CHAT_ID, 
                text: `رادار السنايبر: سهم ترند جديد ${symbol}\nالسعر الحالي: ${price}\nحالة الاختراق: مؤكدة` 
            })
        });
      }
    } catch (e) { continue; }
  }
  return NextResponse.json({ alerts });
}
