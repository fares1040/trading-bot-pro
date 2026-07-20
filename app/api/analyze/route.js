import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    
    // إعدادات التليجرام
    const TELEGRAM_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
    const CHAT_ID = '896028407';

    if (!symbol) return NextResponse.json({ error: "الرمز مفقود" }, { status: 400 });

    try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=30d`);
        const data = await res.json();
        
        if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
            return NextResponse.json({ error: "لا توجد بيانات" }, { status: 404 });
        }

        const meta = data.chart.result[0].meta;
        const quotes = data.chart.result[0].indicators.quote[0].close;
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose;
        const volume = meta.regularMarketVolume || 0;

        // الحسابات الفنية
        const ma20 = quotes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const stdDev = Math.sqrt(quotes.slice(-20).map(x => Math.pow(x - ma20, 2)).reduce((a, b) => a + b) / 20);
        const upperBand = ma20 + (2 * stdDev);

        // الفلاتر
        const isEntrySuitable = (price >= 1 && price <= 50 && Math.abs((price / prevClose) - 1) < 0.05 && price > ma20 && price < upperBand && (stdDev / ma20) < 0.1 && volume > 100000);

        // النص التفصيلي للواجهة
        const analysisText = `تحليل سهم ${symbol.toUpperCase()}:
السعر: ${price.toFixed(2)} | الفوليوم: ${(volume/1000).toFixed(1)}K
الاتجاه: ${price > ma20 ? "صاعد ✅" : "هابط ❌"}
البولنجر: ${price < upperBand ? "مناسب ✅" : "متشبع شراء ⚠️"}
القرار النهائي: ${isEntrySuitable ? "مناسب للدخول ✅" : "انتظر الفرصة ❌"}`;

        // إرسال التنبيه المختصر للتليجرام فقط عند تحقق الشروط
        if (isEntrySuitable) {
            const message = `🚀 سهم محتمل: ${symbol.toUpperCase()}\nالسعر: ${price.toFixed(2)}`;
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(message)}`);
        }

        return NextResponse.json({ symbol: symbol.toUpperCase(), analysis: analysisText, isSuitable: isEntrySuitable });

    } catch (error) {
        return NextResponse.json({ error: "فشل التحليل" }, { status: 500 });
    }
}
