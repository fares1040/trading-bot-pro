import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) return NextResponse.json({ error: "الرجاء تحديد السهم" }, { status: 400 });

  try {
    const url = `https://api.massive.com/v3/reference/tickers/${symbol.toUpperCase()}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${process.env.MASSIVE_API_KEY}` }
    });

    const data = await response.json();
    
    // التعديل هنا: لنعتمد على هيكل البيانات الذي يرسله Massive
    // إذا كنت لا تعرف المسار، فالموقع يرسل data.results
    const price = data.results?.price || "غير متاح"; 
    const status = data.status || "بيانات نشطة";

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice: price,
      analysis: status
    });
  } catch (error) {
    return NextResponse.json({ error: "فشل الاتصال" }, { status: 500 });
  }
}
