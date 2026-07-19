import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = "https://trading-bot-pro-fwy4.vercel.app";
  
  try {
    // جلب قائمة الأسهم المحدثة من سيرفرك مباشرة
    const stocksRes = await fetch(`${baseUrl}/api/stocks`);
    const stocksData = await stocksRes.json();
    
    // استخراج رموز الأسهم من البيانات
    const symbols = stocksData.data.map(item => item.ticker);
    
    // تنفيذ عملية التحليل لكل سهم
    for (const s of symbols) {
      await fetch(`${baseUrl}/api/analyze?symbol=${s}`);
    }
    
    return NextResponse.json({ status: "all scanned", count: symbols.length, symbols });
  } catch (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
