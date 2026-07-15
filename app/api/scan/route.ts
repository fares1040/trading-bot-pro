import { NextResponse } from 'next/server';
const yahooFinance = require('yahoo-finance2').default;

export async function GET() {
  try {
    // 1. جلب قائمة الأسهم الأكثر نشاطاً (الترند) من السوق
    const trending = await yahooFinance.trendingSymbols('US');
    const symbols = trending.quotes.map((q: any) => q.symbol).slice(0, 10); // نأخذ أول 10 أسهم

    let signalsSent = 0;

    // 2. فحص كل سهم في القائمة
    for (const symbol of symbols) {
      const quote = await yahooFinance.quote(symbol);
      const priceChange = quote.regularMarketChangePercent;

      // 3. التحقق من شرط الانفجار السعري (> 2%)
      if (priceChange && priceChange > 2) {
        const message = `🏆✨ انفجار سعري في سهم ترند! ✨🏆

📍 السهم: ${symbol}
💰 السعر: ${quote.regularMarketPrice}$
📈 التغير اليومي: ${priceChange.toFixed(2)}%
🎯 الأهداف: ${(quote.regularMarketPrice * 1.03).toFixed(2)} → ${(quote.regularMarketPrice * 1.05).toFixed(2)}`;

        await fetch(`https://api.telegram.org/bot8822034470:AAgez21V8daSkeFtb9Hq6yTArBUJx0k4YQw/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: 'آيديك_هنا', text: message })
        });
        signalsSent++;
      }
    }

    return NextResponse.json({ status: "Scan complete", checked: symbols, signalsSent });
  } catch (error) {
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
