import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 1. جلب قائمة الأسهم الأكثر نشاطاً (الترند) من Yahoo Finance
    const trendingResponse = await fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=true&scrIds=most_active&count=10');
    const trendingData = await trendingResponse.json();
    const symbols = trendingData.finance.result[0].quotes.map((q: any) => q.symbol);
    
    let signalsSent = 0;

    // 2. فحص كل سهم ترند تم جلبه
    for (const symbol of symbols) {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.chart.result) continue;

      const quote = data.chart.result[0].meta;
      const currentPrice = quote.regularMarketPrice;
      const prevClose = quote.chartPreviousClose;
      const priceChange = ((currentPrice - prevClose) / prevClose) * 100;

      // 3. التنبيه إذا كان التغير أكثر من 2% (الانفجار السعري)
      if (priceChange > 2) {
        const message = `🏆✨ انفجار سعري في سهم ترند! ✨🏆

📍 السهم: ${symbol}
💰 السعر: ${currentPrice.toFixed(2)}$
📈 التغير اليومي: ${priceChange.toFixed(2)}%
🎯 الأهداف: ${(currentPrice * 1.03).toFixed(2)} → ${(currentPrice * 1.05).toFixed(2)}`;

        // أرسل التنبيه لتليجرام
        await fetch(`https://api.telegram.org/bot8822034470:AAgez21V8daSkeFtb9Hq6yTArBUJx0k4YQw/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: '896028407', text: message })
        });
        signalsSent++;
      }
    }

    return NextResponse.json({ status: "Scan complete", count: signalsSent });
  } catch (error) {
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
