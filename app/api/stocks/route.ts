import { NextResponse } from 'next/server';

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  const watchlist = ['NVDA', 'AAPL', 'TSLA', 'AMD', 'MSFT'];

  try {
    for (const ticker of watchlist) {
      const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${apiKey}`);
      const data = await response.json();
      
      if (!data['Time Series (Daily)']) continue;

      const timeSeries = data['Time Series (Daily)'];
      const dates = Object.keys(timeSeries);
      const last20Days = dates.slice(0, 20).map(date => timeSeries[date]);
      
      const current = last20Days[0];
      const lastClose = parseFloat(current['4. close']);
      const lastVol = parseFloat(current['5. volume']);
      
      const avgVol = last20Days.reduce((sum, day) => sum + parseFloat(day['5. volume']), 0) / 20;
      const high20 = Math.max(...last20Days.map(day => parseFloat(day['2. high'])));
      const low20 = Math.min(...last20Days.map(day => parseFloat(day['3. low']))); // وقف الخسارة

      // 1. تنبيه الاختراق القوي
      if (lastVol > (avgVol * 2) && lastClose >= high20) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chat_id: chatId, 
            text: `🚀 *فرصة اختراق في ${ticker}*\nالسعر: ${lastClose}$\nحجم التداول: عالي جداً\nوقف الخسارة المقترح: ${low20.toFixed(2)}$\nرابط الشارت: https://www.tradingview.com/chart/?symbol=${ticker}` 
          })
        });
      }
      
      // 2. تنبيه وقف الخسارة (إذا كسر السعر أقل سعر في آخر 20 يوم)
      if (lastClose <= low20) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chat_id: chatId, 
            text: `⚠️ *تنبيه وقف خسارة في ${ticker}*\nالسعر الحالي ${lastClose}$ كسر مستوى الدعم عند ${low20}$!` 
          })
        });
      }
    }

    return NextResponse.json({ status: "Scanner Finished" });
  } catch (error) {
    return NextResponse.json({ error: "Scanner Failed" }, { status: 500 });
  }
}
