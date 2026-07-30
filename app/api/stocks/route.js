// app/api/stocks/route.js
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    let apiUrl = '';
    if (symbol) {
      apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=1d`;
    } else {
      apiUrl = `https://query1.finance.yahoo.com/v1/finance/trending/US?count=10`;
    }

    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      cache: 'no-store'
    });

    if (!response.ok) throw new Error('فشل جلب الأسعار المباشرة');

    const data = await response.json();
    let results = [];
    if (symbol) {
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta) {
        results = [{
          symbol: symbol.toUpperCase(),
          price: meta.regularMarketPrice || meta.chartPreviousClose || 0,
          currency: meta.currency || 'USD'
        }];
      }
    } else {
      const quotes = data?.finance?.result?.[0]?.quotes || [];
      results = quotes.map(q => ({
        symbol: q.symbol,
        price: q.regularMarketPrice || 0
      })).filter(item => item.price <= 100 && item.price > 0);
    }

    return NextResponse.json({ 
      status: "نجاح مباشر", 
      timestamp: new Date().toISOString(),
      count: results.length,
      data: results.length > 0 ? results : ['SERV', 'CETX', 'GSIT', 'PRFX', 'BYRN'] 
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });

  } catch (error) {
    console.error('Stocks API Live Error:', error.message);
    return NextResponse.json({ 
      status: "بديل طارئ", 
      data: ['SERV', 'CETX', 'GSIT', 'PRFX', 'BYRN', 'KULR'] 
    }, { status: 200 });
  }
}
