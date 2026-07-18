import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    
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

        const ma20 = quotes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const stdDev = Math.sqrt(quotes.slice(-20).map(x => Math.pow(x - ma20, 2)).reduce((a, b) => a + b) / 20);
        const upperBand = ma20 + (2 * stdDev);
        
        // شروط الدخول
        const isEntry = (price >= 1 && price <= 50) && 
                        Math.abs((price / prevClose) - 1) < 0.05 && 
                        price > ma20 && 
                        price < upperBand && 
                        volume > 100000;

        // شروط الخروج (مثلاً: إذا تجاوز السعر البولنجر أو كسر المتوسط)
        const isExit = price > upperBand || price < ma20;

        // إرسال التنبيهات
        if (isEntry) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(`🟢 دخول مناسب لـ ${symbol.toUpperCase()}\nالسعر: ${price.toFixed(2)}`)}`);
        } else if (isExit) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(`🔴 تنبيه خروج/جني أرباح لـ ${symbol.toUpperCase()}\nالسعر: ${price.toFixed(2)}\nالسبب: السعر خارج نطاق البولنجر أو كسر المتوسط`)}` );
        }

        return NextResponse.json({
            symbol: symbol.toUpperCase(),
            currentPrice: price.toFixed(2),
            isEntry: isEntry,
            isExit: isExit
        });

    } catch (error) {
        return NextResponse.json({ error: "فشل التحليل" }, { status: 500 });
    }
}
