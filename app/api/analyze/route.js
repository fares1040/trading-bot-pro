import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  try {
    // نستخدم API عام ومجاني لا يحتاج مكتبات ولا مفاتيح
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1m`);
    const data = await res.json();
    
    const price = data.chart.result[0].meta.regularMarketPrice;

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice: price,
      analysis: price > 0 ? "سعر نشط" : "غير متاح"
    });
  } catch (error) {
    return NextResponse.json({ error: "لا توجد بيانات" }, { status: 500 });
  }
}
