import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  
  try {
    const res = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${apiKey}`);
    const data = await res.json();
    
    // إضافة حماية: إذا لم توجد بيانات top_gainers، نرجع قائمة فارغة بدلاً من التعطل
    const topGainers = data?.top_gainers || [];
    
    const results = topGainers.slice(0, 15).map((s: any) => ({
      symbol: s.ticker,
      price: s.price,
      change: s.change_percentage
    }));

    return NextResponse.json({ status: "Success", data: results });
    
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ status: "Error", data: [] });
  }
}
