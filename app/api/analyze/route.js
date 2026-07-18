import { NextResponse } from 'next/server';

const lastAlerts = {}; 

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    const TELEGRAM_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
    const CHAT_ID = '896028407';

    // فلتر وقت التداول (السوق الأمريكي: 16:30 - 23:00 بتوقيت السعودية)
    const now = new Date();
    const saudiTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Riyadh"}));
    const hours = saudiTime.getHours();
    const minutes = saudiTime.getMinutes();
    const currentTime = hours + minutes / 60;
    const isMarketOpen = currentTime >= 16.5 && currentTime <= 23.0;

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

        // حساب الأهداف (وقف الخسارة المتحرك سيكون مرتبطاً بـ ma20 ديناميكياً)
        const targetPrice = upperBand; 
        const stopLoss = ma20; 

        const isEntrySuitable = (price >= 1 && price <= 50) && Math.abs((price / prevClose) - 1) < 0.05 && price > ma20 && price < upperBand && volume > 100000;
        const isExitSuitable = !isEntrySuitable && (price > upperBand || price < ma20);

        const currentState = isEntrySuitable ? 'ENTRY' : (isExitSuitable ? 'EXIT' : 'NONE');

        // إرسال التنبيه فقط إذا كان السوق مفتوحاً وتغيرت الحالة
        if (isMarketOpen && currentState !== 'NONE' && lastAlerts[symbol] !== currentState) {
            const message = currentState === 'ENTRY' 
                ? `🟢 دخول مناسب لـ ${symbol.toUpperCase()}\nالسعر: ${price.toFixed(2)}\nالهدف: ${targetPrice.toFixed(2)} 🎯\nوقف الخسارة: ${stopLoss.toFixed(2)} 🛑` 
                : `🔴 تنبيه خروج لـ ${symbol.toUpperCase()}\nالسعر: ${price.toFixed(2)}`;
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(message)}`);
            lastAlerts[symbol] = currentState;
        }

        return NextResponse.json({
            symbol: symbol.toUpperCase(),
            currentPrice: price.toFixed(2),
            isEntry: isEntrySuitable,
            marketOpen: isMarketOpen
        });

    } catch (error) {
        return NextResponse.json({ error: "فشل التحليل" }, { status: 500 });
    }
}
