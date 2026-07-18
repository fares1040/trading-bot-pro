import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  try {
    // نستخدم الـ Header لإرسال المفتاح (هذا هو الأسلوب الصحيح)
    const response = await fetch(`https://api.massive.com/v3/reference/tickers/${symbol.toUpperCase()}`, {
      headers: {
        'Authorization': `Bearer ${process.env.MASSIVE_API_KEY}`
      }
    });

    const data = await response.json();
    
    // إذا كان هناك خطأ، سنعرفه من خلال رسالة الموقع نفسه
    if (!response.ok) {
        return NextResponse.json({ error: data.message || "فشل الوصول" }, { status: 500 });
    }

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice: data.results?.price || "0.00",
      analysis: "تم الاتصال"
    });
  } catch (error) {
    return NextResponse.json({ error: "خطأ برمجي" }, { status: 500 });
  }
}
