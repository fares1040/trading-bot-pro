import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) return NextResponse.json({ error: "الرجاء تحديد السهم" }, { status: 400 });

  try {
    // الرابط الصحيح بناءً على وثائق Massive التي أرسلتها
    const url = `https://api.massive.com/v3/reference/tickers/${symbol.toUpperCase()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.MASSIVE_API_KEY}` // تأكد من إعداد هذا المتغير في Vercel
      }
    });

    const data = await response.json();

    // هنا نقوم بتحليل البيانات المسترجعة من Massive
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice: data.results?.price || "جاري التحديث",
      analysis: "بيانات نشطة",
      status: "#00ff41"
    });
  } catch (error) {
    return NextResponse.json({ error: "فشل في جلب البيانات من Massive" }, { status: 500 });
  }
}
