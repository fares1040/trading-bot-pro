import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  try {
    // سنستخدم مسار Aggregate Bars لأنه الأضمن والأكثر توفراً في الخطط
    const url = `https://api.massive.com/v2/aggs/ticker/${symbol.toUpperCase()}/prev?adjusted=true&apiKey=${process.env.MASSIVE_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    // السعر يكون دائماً في المسار 'results[0].c' (السعر عند الإغلاق)
    const price = data.results?.[0]?.c || "0.00";

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice: price,
      analysis: price > 0 ? "متوفر" : "غير متاح",
      status: price > 0 ? "#00ff41" : "#ff4444"
    });
  } catch (error) {
    return NextResponse.json({ error: "خطأ" }, { status: 500 });
  }
}
