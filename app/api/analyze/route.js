import yahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  try {
    // جلب بيانات السهم مباشرة بدون الحاجة لمفتاح API
    const quote = await yahooFinance.quote(symbol.toUpperCase());
    
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice: quote.regularMarketPrice,
      analysis: quote.regularMarketChangePercent > 0 ? "صعود" : "هبوط",
      status: quote.regularMarketChangePercent > 0 ? "#00ff41" : "#ff4444"
    });
  } catch (error) {
    return NextResponse.json({ error: "فشل في جلب البيانات" }, { status: 500 });
  }
}
