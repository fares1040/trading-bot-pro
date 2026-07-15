import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

export async function GET() {
  try {
    // جلب بيانات السهم (مثال: Nvidia)
    const query = 'NVDA';
    const quote = await yahooFinance.quote(query);
    
    // شرط الانفجار السعري (مثلاً: تغير سعري أكثر من 2% خلال اليوم)
    const priceChange = quote.regularMarketChangePercent;
    
    if (priceChange && priceChange > 2) { 
      // التنسيق الذي طلبته
      const message = `🏆✨ بداية الصفقة ✨🏆

📍 ${query} │ 🟢 │ ⭐ ثقة عالية
💰 السعر الحالي: ${quote.regularMarketPrice}$
📈 التغير اليومي: ${priceChange.toFixed(2)}%
🎯 الأهداف: ${ (quote.regularMarketPrice * 1.03).toFixed(2) } → ${ (quote.regularMarketPrice * 1.05).toFixed(2) }`;

      // إرسال لتليجرام
      await fetch(`https://api.telegram.org/bot8822034470:AAgez21V8daSkeFtb9Hq6yTArBUJx0k4YQw/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: '896028407', text: message })
      });

      return NextResponse.json({ status: "Signal Sent", priceChange });
    }

    return NextResponse.json({ status: "No Signal", priceChange });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
