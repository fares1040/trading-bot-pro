import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    try {
        // نستخدم مدى 30 يوم للحصول على بيانات كافية لحساب المتوسطات
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=30d`);
        const data = await res.json();
        const meta = data.chart.result[0].meta;
        const quotes = data.chart.result[0].indicators.quote[0].close;
        
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose;
        const volume = meta.regularMarketVolume || 0;

        // 1. الحسابات الفنية
        const ma20 = quotes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const stdDev = Math.sqrt(quotes.slice(-20).map(x => Math.pow(x - ma20, 2)).reduce((a, b) => a + b) / 20);
        const upperBand = ma20 + (2 * stdDev);

        // 2. الفلاتر
        const isGoodPrice = price >= 1 && price <= 50;
        const isLowGap = Math.abs((price / prevClose) - 1) < 0.05;
        const isAboveMA = price > ma20;
        const isNotOverbought = price < upperBand;
        const isHighVolume = volume > 100000;

        // 3. القرار النهائي
        const isEntrySuitable = isGoodPrice && isLowGap && isAboveMA && isNotOverbought && isHighVolume;

        const analysisText = `تحليل السهم ${symbol.toUpperCase()}:
- السعر: ${price.toFixed(2)} | الفوليوم: ${(volume/1000).toFixed(1)}K
- الاتجاه: ${isAboveMA ? "صاعد (فوق المتوسط)" : "هابط (تحت المتوسط)"}
- الفجوة السعرية: ${isLowGap ? "طبيعية ✅" : "عالية ⚠️"}
- حالة التشبع: ${isNotOverbought ? "غير متشبع شراء ✅" : "متشبع ⚠️"}
- النتيجة النهائية: ${isEntrySuitable ? "مناسب للدخول ✅" : "لا ينصح به حالياً ❌"}`;

        return NextResponse.json({
            symbol: symbol.toUpperCase(),
            currentPrice: price.toFixed(2),
            analysis: analysisText,
            isSuitable: isEntrySuitable
        });

    } catch (error) {
        return NextResponse.json({ error: "فشل التحليل" }, { status: 500 });
    }
}
