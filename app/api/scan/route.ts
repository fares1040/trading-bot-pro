import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // قائمة الأسهم المراد فحصها
    const symbols = ['PTORW', 'FGIWW', 'NXTC', 'PRENW', 'BOSER'];
    let results = [];

    for (const symbol of symbols) {
      // رابط بيانات Yahoo المباشر (لا يحتاج مكتبات)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.chart.result) {
        const meta = data.chart.result[0].meta;
        results.push({
          symbol: symbol,
          price: meta.regularMarketPrice.toFixed(2),
          trend: meta.regularMarketPrice > meta.chartPreviousClose ? 'up' : 'down'
        });
      }
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
