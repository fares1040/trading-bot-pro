import { NextResponse } from 'next/server';

const lastAlerts = {};

async function handleAnalysis(symbol) {
    const TELEGRAM_TOKEN = '8822034470:AAEBoovIt3tdkkQqt21X86GZBwipYUq6MgA';
    const CHAT_ID = '896028407';

    // فلتر الوقت
    const saudiTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    const hours = saudiTime.getHours();
    const minutes = saudiTime.getMinutes();
    const isMarketOpen = (hours + minutes / 60) >= 16.5 && (hours + minutes / 60) <= 23.0;

    try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=30d`);
        const data = await res.json();
        
        if (!data.chart || !data.chart.result) return null;

        const meta = data.chart.result[0].meta;
        const quotes = data.chart.result[0].indicators.quote[0].close;
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose;
        const volume = meta.regularMarketVolume || 0;

        const ma20 = quotes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const stdDev = Math.sqrt(quotes.slice(-20).map(x => Math.pow(x - ma20, 2)).reduce((a, b) => a + b, 0) / 20);
        const upperBand = ma20 + (2 * stdDev);

        const isEntrySuitable = (price >= 1 && price <= 50 && Math.abs((price / prevClose) - 1) < 0.05 && price > ma20 && price < upperBand);
        const isExitSuitable = isEntrySuitable && (price > upperBand || price < ma20);

        const analysisText = `تحليل ${symbol.toUpperCase()}: السعر الحالي: ${price.toFixed(2)}`;

        const currentState = isEntrySuitable ? 'ENTRY' : (isExitSuitable ? 'EXIT' : 'NONE');

        if (isMarketOpen && currentState !== 'NONE' && lastAlerts[symbol] !== currentState) {
            const message = currentState === 'ENTRY' 
                ? `🚀 سهم جديد: ${symbol.toUpperCase()}\n💰 السعر: ${price.toFixed(2)}\n🎯 الهدف: ${upperBand.toFixed(2)}\n🛑 وقف الخسارة: ${ma20.toFixed(2)}`
                : `🛑 تنبيه خروج: ${symbol.toUpperCase()}\n💰 السعر: ${price.toFixed(2)}`;
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(message)}`);
            lastAlerts[symbol] = currentState;
        }

        return { analysisText, isEntrySuitable, price, upperBand, ma20 };
    } catch (error) {
        return null;
    }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  // إذا أرسلت سهم، يحلل سهم واحد فقط
  if (symbol) {
    const result = await handleAnalysis(symbol);
    return NextResponse.json({ ...result, symbol: symbol.toUpperCase() });
  } else {
    // إذا لم ترسل سهم، يجلب القائمة ويحللها كاملة
    const baseUrl = new URL(request.url).origin;
    const stocksRes = await fetch(`${baseUrl}/api/stocks`);
    const stocksData = await stocksRes.json();
    
    // استخراج الرموز وتحليلها
    const symbols = stocksData.data.map(item => item.ticker);
    for (const s of symbols) {
      await handleAnalysis(s);
    }
    return NextResponse.json({ status: "done", scanned: symbols });
  }
}

export async function POST(request) {
    const body = await request.json();
    await handleAnalysis(body.symbol);
    return NextResponse.json({ status: "received" });
}
