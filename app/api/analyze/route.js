import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    // بيانات التليجرام
    const TELEGRAM_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
    const CHAT_ID = '896028407';

    try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=30d`);
        const data = await res.json();
        const meta = data.chart.result[0].meta;
        const quotes = data.chart.result[0].indicators.quote[0].close;
        
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose;
        const volume = meta.regularMarketVolume || 0;

        // الحسابات الفنية (كما هي في كودك)
        const ma20 = quotes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const stdDev = Math.sqrt(quotes.slice(-20).map(x => Math.pow(x - ma20, 2)).reduce((a, b) => a + b) / 20);
        const upperBand = ma20 + (2 * stdDev);

        // الفلاتر الستة (كما هي في كودك)
        const isGoodPrice = price >= 1 && price <= 50;
        const isLowGap = Math.abs((price / prevClose) - 1) < 0.05;
        const isAboveMA = price > ma20;
        const isNotOverbought = price < upperBand;
        const isNotTooVolatile = (stdDev / ma20) < 0.1;
        const isHighVolume = volume > 100000;

        // النتيجة النهائية
        const isEntrySuitable = isGoodPrice && isLowGap && isAboveMA && isNotOverbought && isNotTooVolatile && isHighVolume;
        const isExitSuitable = !isEntrySuitable && (price > upperBand || price < ma20);

        const analysisText = `تحليل سهم ${symbol.toUpperCase()}:
السعر: ${price.toFixed(2)} | الفوليوم: ${(volume/1000).toFixed(1)}K
الاتجاه: ${isAboveMA ? "صاعد ✅" : "هابط ❌"}
الفجوة: ${isLowGap ? "طبيعية ✅" : "كبيرة ⚠️"}
البولنجر: ${isNotOverbought ? "مناسب ✅" : "متشبع شراء ⚠️"}
التذبذب: ${isNotTooVolatile ? "مستقر ✅" : "عالي ⚠️"}
القرار النهائي: ${isEntrySuitable ? "مناسب للدخول ✅" : (isExitSuitable ? "تنبيه خروج 🔴" : "انتظر الفرصة ❌")}`;

        // إرسال التنبيه للتليجرام
        if (isEntrySuitable) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(`🟢 دخول مناسب لـ ${symbol.toUpperCase()}\nالسعر: ${price.toFixed(2)}`)}`);
        } else if (isExitSuitable) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(`🔴 تنبيه خروج لـ ${symbol.toUpperCase()}\nالسعر: ${price.toFixed(2)}`)}`);
        }

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
