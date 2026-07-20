import { NextResponse } from 'next/server';

// ذاكرة مؤقتة لمنع التكرار
global.lastAlerts = global.lastAlerts || {};

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    
    const TELEGRAM_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
    const CHAT_ID = '896028407';

    if (!symbol) return NextResponse.json({ error: "الرمز مفقود" }, { status: 400 });

    const cleanSymbol = symbol.toUpperCase().trim();

    try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}?interval=1d&range=30d`);
        const data = await res.json();
        
        if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
            return NextResponse.json({ error: "لا توجد بيانات" }, { status: 404 });
        }

        const meta = data.chart.result[0].meta;
        const quotes = data.chart.result[0].indicators.quote[0].close;
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose;
        const volume = meta.regularMarketVolume || 0;

        const ma20 = quotes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const stdDev = Math.sqrt(quotes.slice(-20).map(x => Math.pow(x - ma20, 2)).reduce((a, b) => a + b) / 20);
        const upperBand = ma20 + (2 * stdDev);

        const isEntrySuitable = (price >= 1 && price <= 50 && Math.abs((price / prevClose) - 1) < 0.05 && price > ma20 && price < upperBand && (stdDev / ma20) < 0.1 && volume > 100000);

        // حساب وقف الخسارة و 3 أهداف ديناميكية بدقة
        const stopLoss = (price * 0.975).toFixed(2);     // وقف الخسارة المبدئي (-2.5%)
        const takeProfit1 = (price * 1.035).toFixed(2); // الهدف الأول (+3.5%) -> وعند الوصول له يتحرك الوقف لنقطة الدخول
        const takeProfit2 = (price * 1.07).toFixed(2);  // الهدف الثاني (+7%)
        const takeProfit3 = (price * 1.11).toFixed(2);  // الهدف الثالث (+11%)

        const analysisText = `تحليل سهم ${cleanSymbol}:
السعر: ${price.toFixed(2)} | الفوليوم: ${(volume/1000).toFixed(1)}K
الاتجاه: ${price > ma20 ? "صاعد ✅" : "هابط ❌"}
البولنجر: ${price < upperBand ? "مناسب ✅" : "متشبع شراء ⚠️"}
وقف الخسارة: ${stopLoss} (يُرفع لنقطة الدخول بعد الهدف 1)
الهدف 1: ${takeProfit1} | الهدف 2: ${takeProfit2} | الهدف 3: ${takeProfit3}
القرار النهائي: ${isEntrySuitable ? "مناسب للدخول ✅" : "انتظر الفرصة ❌"}`;

        // إرسال التنبيه للتيليجرام مع الحماية من التكرار لمدة ساعة
        if (isEntrySuitable) {
            const now = Date.now();
            const lastAlertTime = global.lastAlerts[cleanSymbol] || 0;
            const cooldownTime = 60 * 60 * 1000; 

            if (now - lastAlertTime > cooldownTime) {
                global.lastAlerts[cleanSymbol] = now; 

                const message = `🚀 فرصة سهم محتمل (إدارة متقدمة): ${cleanSymbol}\n` +
                                `💰 سعر الدخول: ${price.toFixed(2)}\n` +
                                `🛑 وقف الخسارة الأولي: ${stopLoss}\n` +
                                `🛡️ قاعدة الحماية: يُرفع الوقف لسعر الدخول فور بلوغ الهدف 1\n` +
                                `🎯 الهدف الأول: ${takeProfit1}\n` +
                                `🎯 الهدف الثاني: ${takeProfit2}\n` +
                                `🎯 الهدف الثالث: ${takeProfit3}\n` +
                                `📊 الفوليوم: ${(volume/1000).toFixed(1)}K`;

                await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(message)}`).catch(() => {});
            }
        }

        return NextResponse.json({ 
            symbol: cleanSymbol, 
            analysis: analysisText, 
            isSuitable: isEntrySuitable,
            stopLoss,
            takeProfit1,
            takeProfit2,
            takeProfit3
        });

    } catch (error) {
        return NextResponse.json({ error: "فشل التحليل" }, { status: 500 });
    }
}
