import { NextResponse } from 'next/server';

// ذاكرة مؤقتة لتخزين وقت آخر تنبيه لكل سهم (منع التكرار / Spam Prevention)
// تبقى مخزنة طالما السيرفر يعمل
global.lastAlerts = global.lastAlerts || {};

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    
    // إعدادات التليجرام الخاصة بك
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

        // شروط الدخول الخاصة بك
        const isEntrySuitable = (price >= 1 && price <= 50 && Math.abs((price / prevClose) - 1) < 0.05 && price > ma20 && price < upperBand && (stdDev / ma20) < 0.1 && volume > 100000);

        // حساب الأهداف الديناميكية ووقف الخسارة بناءً على السعر الحالي
        const stopLoss = (price * 0.975).toFixed(2);     // وقف الخسارة تحت السعر بـ 2.5%
        const takeProfit1 = (price * 1.04).toFixed(2);  // الهدف الأول 4%
        const takeProfit2 = (price * 1.08).toFixed(2);  // الهدف الثاني 8%

        // النص التفصيلي الذي يظهر عند الضغط على "عرض" في الموقع
        const analysisText = `تحليل سهم ${symbol.toUpperCase()}:
السعر: ${price.toFixed(2)} | الفوليوم: ${(volume/1000).toFixed(1)}K
الاتجاه: ${price > ma20 ? "صاعد ✅" : "هابط ❌"}
البولنجر: ${price < upperBand ? "مناسب ✅" : "متشبع شراء ⚠️"}
وقف الخسارة: ${stopLoss} | الهدف 1: ${takeProfit1}
القرار النهائي: ${isEntrySuitable ? "مناسب للدخول ✅" : "انتظر الفرصة ❌"}`;

        // نظام منع التكرار وإرسال التنبيه الديناميكي للتيليجرام
        if (isEntrySuitable) {
            const now = Date.now();
            const lastAlertTime = global.lastAlerts[symbol.toUpperCase()] || 0;
            const cooldownTime = 30 * 60 * 1000; // السماح بتنبيه جديد لنفس السهم كل 30 دقيقة فقط

            if (now - lastAlertTime > cooldownTime) {
                global.lastAlerts[symbol.toUpperCase()] = now; // تحديث وقت آخر تنبيه

                const message = `🚀 فرصة سهم محتمل: ${symbol.toUpperCase()}\n` +
                                `💰 سعر الدخول: ${price.toFixed(2)}\n` +
                                `🛑 وقف الخسارة: ${stopLoss}\n` +
                                `🎯 الهدف الأول: ${takeProfit1}\n` +
                                `🎯 الهدف الثاني: ${takeProfit2}\n` +
                                `📊 الفوليوم: ${(volume/1000).toFixed(1)}K`;

                await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(message)}`);
            }
        }

        return NextResponse.json({ 
            symbol: symbol.toUpperCase(), 
            analysis: analysisText, 
            isSuitable: isEntrySuitable,
            stopLoss,
            takeProfit1,
            takeProfit2
        });

    } catch (error) {
        return NextResponse.json({ error: "فشل التحليل" }, { status: 500 });
    }
}
