import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  try {
    // نستخدم نفس مصدر البيانات (Yahoo Finance) عشان تتطابق النتائج
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1m`);
    const data = await res.json();
    const price = data.chart.result[0].meta.regularMarketPrice;

    // نفس منطق "طماع شوي" عشان تظهر الأهداف في الموقع أيضاً
    const t1 = (price * 1.03).toFixed(2);
    const t2 = (price * 1.05).toFixed(2);
    const t3 = (price * 1.08).toFixed(2);

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice: price.toFixed(2),
      analysis: `🎯 T1:${t1} | T2:${t2} | T3:${t3}`,
      status: "#ffff00"
    });
  } catch (error) {
    return NextResponse.json({ error: "فشل في جلب البيانات" }, { status: 500 });
  }
}
