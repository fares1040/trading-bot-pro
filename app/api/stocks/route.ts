import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  
  // 1. جلب قائمة أكثر الأسهم نشاطاً اليوم (Top Gainers)
  const res = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${apiKey}`);
  const data = await res.json();
  
  // 2. اختيار أول 15 سهم من قائمة الرابحين (الترند)
  const topGainers = data.top_gainers.slice(0, 15);
  
  // 3. تنسيق البيانات للجدول
  const results = topGainers.map((s: any) => ({
    symbol: s.ticker,
    price: s.price,
    change: s.change_percentage
  }));

  return NextResponse.json({ status: "Success", data: results });
}
