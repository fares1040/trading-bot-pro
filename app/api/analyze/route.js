import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  
  if (!symbol) return NextResponse.json({ error: "الرجاء إدخال الرمز" });

  try {
    // جلب البيانات من ياهو فاينانس
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m`);
    const data = await res.json();
    
    // استخراج السعر
    const price = data.chart.result[0].meta.regularMarketPrice;

    // المنطق الخاص بك
    const support = 0.60; 
    const resistance = 0.90;

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice: price,
      analysis: price <= support ? "فرصة دخول" : (price >= resistance ? "فرصة خروج" : "مراقبة"),
      status: price <= support ? "green" : (price >= resistance ? "red" : "yellow")
    });
  } catch (error) {
    return NextResponse.json({ error: "تعذر جلب السعر - تأكد من رمز السهم" }, { status: 500 });
  }
}
