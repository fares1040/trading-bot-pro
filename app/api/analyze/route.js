import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=30d`);
        const data = await res.json();
        const meta = data.chart.result[0].meta;
        const quotes = data.chart.result[0].indicators.quote[0].close;
        
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose;
        const volume = meta.regularMarketVolume || 0;

        // الحسابات الفنية
        const ma20 = quotes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const stdDev = Math.sqrt(quotes.slice(-20).map(x => Math.pow(x - ma20, 2)).reduce((a, b) => a + b) / 20);
        const upperBand = ma20 + (2 * stdDev);

        // الفلاتر اللي طلبتها
        const isGoodPrice = price >= 1 && price <= 50; // المدى السعري
        const isLowGap = Math.abs((price / prevClose) - 1) < 0.05; // فلتر الفجوة (أقل من 5%)
        const isAboveMA = price > ma20; // المتوسط المتحرك
        const isNotOverbought = price < upperBand; // بولنجر
        const isNotTooVolatile = (stdDev / ma20) < 0.1; // فلتر التذبذب
        const isHighVolume = volume > 100000;

        // النتيجة النهائية
        const isEntrySuitable = isGoodPrice && isLowGap && isAboveMA && isNotOverbought && isNotTooVolatile && isHighVolume;

        const analysisText = `تحليل سهم ${symbol.toUpperCase()}:
السعر: ${price.toFixed(2)} | الفوليوم: ${(volume/1000).toFixed(1)}K
الاتجاه: ${isAboveMA ? "صاعد ✅" : "هابط ❌"}
الفجوة: ${isLowGap ? "طبيعية ✅" : "كبيرة ⚠️"}
البولنجر: ${isNotOverbought ? "مناسب ✅" : "متشبع شراء ⚠️"}
التذبذب: ${isNotTooVolatile ? "مستقر ✅" : "عالي ⚠️"}
القرار النهائي: ${isEntrySuitable ? "مناسب للدخول ✅" : "انتظر الفرصة ❌"}`;

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
