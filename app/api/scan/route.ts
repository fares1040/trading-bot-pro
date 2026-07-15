import { NextResponse } from 'next/server';

export async function GET() {
  // قائمة أسهم الترند الحالية (يمكنك تعديلها وإضافة ما تشاء)
  const trendingStocks = ['NVDA', 'TSLA', 'AAPL', 'AMD', 'MSFT'];

  try {
    let signalsSent = 0;

    for (const symbol of trendingStocks) {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      const response = await fetch(url);
      const data = await response.json();
      
      const quote = data.chart.result[0].meta;
      const currentPrice = quote.regularMarketPrice;
      const prevClose = quote.chartPreviousClose;
      const priceChange = ((currentPrice - prevClose) / prevClose) * 100;

      // شرط الانفجار السعري
      if (priceChange > 2) {
        const message = `🏆✨ انفجار سعري! ✨🏆

📍 ${symbol} │ 🟢 │ ⭐ ثقة عالية
💰 السعر الحالي: ${currentPrice.toFixed(2)}$
📈 التغير اليومي: ${priceChange.toFixed(2)}%
🎯 الأهداف: ${(currentPrice * 1.03).toFixed(2)} → ${(currentPrice * 1.05).toFixed(2)}`;

        await fetch(`https://api.telegram.org/bot8822034470:AAgez21V8daSkeFtb9Hq6yTArBUJx0k4YQw/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: 'آيديك_هنا', text: message })
        });
        signalsSent++;
      }
    }

    return NextResponse.json({ status: "Scan complete", signalsSent });
  } catch (error) {
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
