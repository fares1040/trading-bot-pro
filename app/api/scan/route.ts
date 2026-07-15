import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // رابط مباشر لجلب بيانات السهم (لا يحتاج مكتبات)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/NVDA?interval=1d&range=1d`;
    const response = await fetch(url);
    const data = await response.json();
    
    // استخراج السعر الحالي والتغير
    const quote = data.chart.result[0].meta;
    const currentPrice = quote.regularMarketPrice;
    const prevClose = quote.chartPreviousClose;
    const priceChange = ((currentPrice - prevClose) / prevClose) * 100;
    
    if (priceChange > 2) { 
      const message = `🏆✨ بداية الصفقة (مباشر) ✨🏆

📍 NVDA │ 🟢 │ ⭐ ثقة عالية
💰 السعر الحالي: ${currentPrice.toFixed(2)}$
📈 التغير اليومي: ${priceChange.toFixed(2)}%
🎯 الأهداف: ${ (currentPrice * 1.03).toFixed(2) } → ${ (currentPrice * 1.05).toFixed(2) }`;

      await fetch(`https://api.telegram.org/bot8822034470:AAgez21V8daSkeFtb9Hq6yTArBUJx0k4YQw/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: '896028407', text: message })
      });

      return NextResponse.json({ status: "Signal Sent", price: currentPrice });
    }

    return NextResponse.json({ status: "No Signal", change: priceChange.toFixed(2) });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
