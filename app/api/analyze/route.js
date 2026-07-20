import { NextResponse } from 'next/server';

const lastAlerts = {};

async function handleAnalysis(symbol) {
  const TELEGRAM_TOKEN = '8822034470:AAEBoovIt3tdkkQqt21X86GZBwipYUq6MgA';
  const CHAT_ID = '896028407';

  
const isMarketOpen = true;

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
    // حساب RSI
    let gains = 0, losses = 0;
    for (let i = quotes.length - 14; i < quotes.length; i++) {
        let diff = quotes[i] - quotes[i-1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let rs = (gains / 14) / (losses / 14);
    let rsi = 100 - (100 / (1 + rs));


const isEntrySuitable = (price >= 1 && price <= 50 && Math.abs((price / prevClose) - 1) < 0.05 && price > ma20 && price < upperBand && volume >= 10000 && rsi < 70) ? 'ENTRY' : 'NONE';

    const analysisText = `تحليل ${symbol.toUpperCase()}: السعر الحالي: ${price.toFixed(2)}`;
    const currentState = isEntrySuitable ? 'ENTRY' : 'NONE';

    if (isMarketOpen && currentState === 'ENTRY' && lastAlerts[symbol] !== currentState) {
const message = `🚀 سهم محتمل: ${symbol.toUpperCase()}\nالسعر: ${price.toFixed(2)}\nRSI: ${rsi.toFixed(2)}\nVolume: ${volume}`;
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
  const result = await handleAnalysis(symbol);

  return NextResponse.json({ ...result, symbol: symbol.toUpperCase() }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
    },
  });
}

export async function POST(request) {
  const body = await request.json();
  await handleAnalysis(body.symbol);
  return NextResponse.json({ status: "received" });
}

