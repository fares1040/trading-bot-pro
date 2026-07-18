import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) return NextResponse.json({ error: "الرجاء تحديد السهم" }, { status: 400 });

  try {
    // الرابط الصحيح لجلب السعر حسب وثائق Massive هو v3/quotes
    const url = `https://api.massive.com/v3/quotes/${symbol.toUpperCase()}?apiKey=${process.env.MASSIVE_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    // بناءً على هيكل بيانات v3/quotes، السعر عادة يكون في المسار التالي:
    const price = data.results?.bid_price || data.results?.ask_price || data.results?.last_trade?.price || "0.00";

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice: price,
      analysis: price > 0 ? "فرصة دخول" : "مراقبة",
      status: price > 0 ? "#00ff41" : "#ff4444"
    });
  } catch (error) {
    return NextResponse.json({ error: "فشل الاتصال" }, { status: 500 });
  }
}
