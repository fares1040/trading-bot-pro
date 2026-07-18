import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1m`);
        const data = await res.json();
        const meta = data.chart.result[0].meta;
        const price = meta.regularMarketPrice;
        const volume = meta.regularMarketVolume || 0;

        // منطق التحليل البسيط
        const t1 = (price * 1.03).toFixed(2);
        const t2 = (price * 1.05).toFixed(2);
        const t3 = (price * 1.08).toFixed(2);
        
        // شرط بسيط: هل مناسب للدخول؟ (فوليوم فوق 100 ألف وسعر السهم أقل من 50 مثلاً)
        const isEntrySuitable = volume > 100000; 

        const analysisText = `الاتجاه: صعودي للسهم ${symbol}
الأهداف: T1:${t1} | T2:${t2} | T3:${t3}
مناسب للدخول: ${isEntrySuitable ? "نعم ✅" : "لا ❌"}`;

        return NextResponse.json({
            symbol: symbol.toUpperCase(),
            currentPrice: price.toFixed(2),
            analysis: analysisText,
            isSuitable: isEntrySuitable // نرسلها للواجهة كقيمة منطقية
        });

    } catch (error) {
        return NextResponse.json({ error: "فشل في جلب البيانات" }, { status: 500 });
    }
}
