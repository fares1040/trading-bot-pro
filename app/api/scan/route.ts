import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

// إعداد المكتبة لتعمل في بيئة Vercel (إلغاء التخزين المؤقت للملفات)
yahooFinance.setGlobalConfig({
  queue: { cache: false }
});

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
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
