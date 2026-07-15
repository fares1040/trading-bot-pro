import { NextResponse } from 'next/server';
// استدعاء النسخة المستقرة مباشرة لتجنب أخطاء الملفات المفقودة
const yahooFinance = require('yahoo-finance2/dist/cjs/yahoo-finance.js').default;

export async function GET() {
  try {
    const query = 'NVDA';
    const quote = await yahooFinance.quote(query);
    
    const priceChange = quote.regularMarketChangePercent;
    
    if (priceChange && priceChange > 2) { 
      const message = `🏆✨ بداية الصفقة ✨🏆

📍 ${query} │ 🟢 │ ⭐ ثقة عالية
💰 السعر الحالي: ${quote.regularMarketPrice}$
📈 التغير اليومي: ${priceChange.toFixed(2)}%
🎯 الأهداف: ${ (quote.regularMarketPrice * 1.03).toFixed(2) } → ${ (quote.regularMarketPrice * 1.05).toFixed(2) }`;

      await fetch(`https://api.telegram.org/bot8822034470:AAgez21V8daSkeFtb9Hq6yTArBUJx0k4YQw/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: 'آيديك_هنا', text: message })
      });

      return NextResponse.json({ status: "Signal Sent", price: quote.regularMarketPrice });
    }

    return NextResponse.json({ status: "No Signal", priceChange });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
