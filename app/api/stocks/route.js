import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // محاولة الاتصال بـ Yahoo Finance بـ Headers قوية
    const response = await fetch('https://query1.finance.yahoo.com/v7/finance/quote?symbols=NVDA,AAPL,TSLA,AMD,PLTR', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      next: { revalidate: 0 } // لضمان عدم أخذ بيانات قديمة
    });

    if (!response.ok) {
      return NextResponse.json({ error: "API limit or connection error" }, { status: 502 });
    }

    const data = await response.json();
    
    // تأكد من وجود البيانات قبل معالجتها
    const stocks = data.quoteResponse.result.map(s => ({
      symbol: s.symbol,
      price: s.regularMarketPrice ? s.regularMarketPrice.toFixed(2) : '0.00'
    }));

    return NextResponse.json({ data: stocks });
    
  } catch (error) {
    return NextResponse.json({ error: "Server connection failed" }, { status: 500 });
  }
}
