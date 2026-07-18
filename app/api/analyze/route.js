import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  try {
    // نستخدم الرابط الأكثر عمومية للتأكد من وصول البيانات
    const url = `https://api.massive.com/v3/reference/tickers/${symbol.toUpperCase()}?apiKey=${process.env.MASSIVE_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    // بدلاً من السعر، سنعرض حالة البيانات مباشرة
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      // إذا كان هناك خطأ، سيظهر هنا بدلاً من 0.00
      currentPrice: data.status === "OK" ? "موجودة" : data.status || "خطأ/لا يوجد",
      analysis: data.results ? "تم العثور" : "فارغ",
      status: data.results ? "#00ff41" : "#ff4444"
    });
  } catch (error) {
    return NextResponse.json({ error: "خطأ بالاتصال" }, { status: 500 });
  }
}
