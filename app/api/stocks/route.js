import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // إضافة Headers لمحاكاة متصفح حقيقي وتجنب الحظر
    const response = await fetch('https://query1.finance.yahoo.com/v7/finance/quote?symbols=NVDA,AAPL,TSLA,AMD,PLTR', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    
    if (!data.quoteResponse || !data.quoteResponse.result) {
      return NextResponse.json({ error: "No data found" });
    }

    const stocks = data.quoteResponse.result.map(s => ({
      symbol: s.symbol,
      price: s.regularMarketPrice?.toFixed(2) || 'N/A',
      isExplosive: (s.regularMarketChangePercent || 0) > 2.0
    }));

    return NextResponse.json({ data: stocks });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch data from source" }, { status: 500 });
  }
}
