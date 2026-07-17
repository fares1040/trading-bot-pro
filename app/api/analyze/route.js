import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  
  if (!symbol) return NextResponse.json({ error: "الرجاء إدخال الرمز" });

  try {
    const res = await fetch(`https://api.massive.com/v3/reference/tickers?ticker=${symbol}&apiKey=QE3ODUMP7UQR22T8`);
    const data = await res.json();
    
    // استخراج السعر (تأكد أن مسار البيانات هو .price)
    const currentPrice = data.price || 0.78; 
    const support = 0.60; 
    const resistance = 0.90;

    let signal = "مراقبة: السعر في المسار العرضي";
    let statusColor = "#ffd700"; // أصفر

    if (currentPrice <= support) {
      signal = "تحذير: السعر كسر الدعم (خطر)!";
      statusColor = "#ff0000"; // أحمر
    } else if (currentPrice >= resistance) {
      signal = "اختراق ناجح: السعر فوق المقاومة (شراء)!";
      statusColor = "#00ff41"; // أخضر
    }

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice,
      analysis: signal,
      status: statusColor
    });
  } catch (error) {
    return NextResponse.json({ error: "فشل الاتصال بالسوق" }, { status: 500 });
  }
}
