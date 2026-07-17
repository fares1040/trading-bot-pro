import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || "AAPL";

  try {
    // جلب السعر من المنصة الحقيقية
    const res = await fetch(`https://api.massive.com/v3/reference/tickers?ticker=${symbol}&apiKey=txQ1pePWvQR7McsjPfZWBCYeDgNYNef8`);
    const data = await res.json();
    
    // استخراج السعر (تأكد من مسار البيانات في ملفك)
    const currentPrice = data.results && data.results.length > 0 ? data.results[0].price : 0.78; 

    const watchList = {
      "AAPL": { support: 0.75, resistance: 0.85 },
      "TSLA": { support: 0.65, resistance: 0.95 },
      "A":    { support: 0.60, resistance: 0.90 }
    };

    const levels = watchList[symbol.toUpperCase()] || { support: 0.50, resistance: 1.0 };
    
    let signal = "مراقبة (السعر في المنتصف)";
    let statusColor = "yellow";

    if (currentPrice <= levels.support) {
      signal = "فرصة دخول قوية: السعر عند منطقة الدعم";
      statusColor = "green";
    } else if (currentPrice >= levels.resistance) {
      signal = "فرصة خروج: السعر عند منطقة المقاومة";
      statusColor = "red";
    }

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice,
      analysis: signal,
      status: statusColor
    });
    
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الاتصال بالسيرفر" }, { status: 500 });
  }
}
