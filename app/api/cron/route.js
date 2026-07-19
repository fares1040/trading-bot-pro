import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // نستخدم الرابط مباشرة إذا كان موجوداً، أو نعطي رابطاً افتراضياً
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://trading-bot-pro-fwy4.vercel.app';
    
    // جلب البيانات مع إضافة خطوة للتحقق من الاستجابة
    const stocksRes = await fetch(`${baseUrl}/api/stocks`);
    if (!stocksRes.ok) throw new Error(`Stocks API failed: ${stocksRes.status}`);
    
    const stocksData = await stocksRes.json();
    const symbols = stocksData.data.map(item => item.ticker);

    // تنفيذ المهام
    for (const s of symbols) {
      await fetch(`${baseUrl}/api/analyze?symbol=${s}`);
    }

    return NextResponse.json({ status: "success", count: symbols.length });
  } catch (error) {
    // نرجع تفاصيل الخطأ عشان نعرف وين المشكلة بالضبط
    return NextResponse.json({ status: "error", message: error.toString() }, { status: 500 });
  }
}
