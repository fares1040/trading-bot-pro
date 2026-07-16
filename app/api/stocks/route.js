import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // نستخدم الرابط مباشرة بدلاً من الاعتماد على متغيرات البيئة
    const response = await fetch('https://query1.finance.yahoo.com/v7/finance/quote?symbols=NVDA,AAPL,TSLA,AMD,PLTR');
    const data = await response.json();
    
    const stocks = data.quoteResponse.result.map(s => ({
      symbol: s.symbol,
      price: s.regularMarketPrice.toFixed(2),
      isExplosive: s.regularMarketChangePercent > 2.0
    }));

    // تغيير بسيط: بدلاً من استخدام NEXT_PUBLIC_URL، نستخدم مساراً نسبياً للتنبيه
    // أو نعتمد على استدعاء داخلي بسيط
    const explosiveStock = stocks.find(s => s.isExplosive);
    
    if (explosiveStock) {
      // إرسال الطلب لمسار التليجرام داخلياً
      await fetch('https://trading-bot-pro-sage.vercel.app/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'NEW_TRADE', data: explosiveStock })
      });
    }

    return NextResponse.json({ data: stocks });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
