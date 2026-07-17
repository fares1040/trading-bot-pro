import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  
  if (!symbol) return NextResponse.json({ error: "الرجاء إدخال الرمز" });

  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m`);
    const data = await res.json();
    const price = data.chart.result[0].meta.regularMarketPrice;

    // حساب الأهداف ووقف الخسارة بناءً على السعر الحالي
    const stopLoss = (price * 0.90).toFixed(3);   // وقف خسارة 10%
    const target1 = (price * 1.20).toFixed(3);    // هدف أول 20%
    const target2 = (price * 1.40).toFixed(3);    // هدف ثاني 40%
    const target3 = (price * 1.60).toFixed(3);    // هدف ثالث 60%

    const support = 0.60; 
    const resistance = 0.90;

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice: price,
      analysis: price <= support ? "فرصة دخول" : (price >= resistance ? "فرصة خروج" : "مراقبة"),
      status: price <= support ? "green" : (price >= resistance ? "red" : "yellow"),
      plan: { stopLoss, target1, target2, target3 } // الخطة التقنية
    });
  } catch (error) {
    return NextResponse.json({ error: "تعذر جلب السعر" }, { status: 500 });
  }
}
