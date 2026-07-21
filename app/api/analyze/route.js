import { NextResponse } from 'next/server';

global.lastAlerts = global.lastAlerts || {};

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const scanMode = searchParams.get('scan'); // وضع البحث التلقائي

    const TELEGRAM_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
    const CHAT_ID = '896028407';

    // قائمة أسهم مقترحة للفحص التلقائي بالسوق (تستطيع توسيعها قدر ما تشاء)
    const marketPool = ['AAPL', 'TSLA', 'NVDA', 'AMZN', 'MSFT', 'RDGT', 'RIVN', 'VMAR', 'CETX', 'GSIT', 'PRFX', 'BYRN', 'ERNA', 'HURA', 'KULR', 'ANVS', 'PPSI', 'BJDX', 'MRAM', 'NOK', 'PLUG'];

    if (scanMode === 'true') {
        let matchedSymbols = [];
        for (let sym of marketPool) {
            try {
                const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=30d`);
                const data = await res.json();
                if (!data.chart || !data.chart.result) continue;

                const meta = data.chart.result[0].meta;
                const quotes = data.chart.result[0].indicators.quote[0].close;
                const price = meta.regularMarketPrice;
                const prevClose = meta.chartPreviousClose;
                const volume = meta.regularMarketVolume || 0;

                const ma20 = quotes.slice(-20).reduce((a, b) => a + b, 0) / 20;
                const stdDev = Math.sqrt(quotes.slice(-20).map(x => Math.pow(x - ma20, 2)).reduce((a, b) => a + b) / 20);

                // حساب الـ RSI
                const rsiPeriod = 14;
                let gains = 0, losses = 0;
                for (let i = quotes.length - rsiPeriod; i < quotes.length; i++) {
                    const change = quotes[i] - quotes[i - 1];
                    if (change > 0) gains += change;
                    else losses -= change;
                }
                const rs = (gains / rsiPeriod) / ((losses / rsiPeriod) === 0 ? 1 : (losses / rsiPeriod));
                const rsi = 100 - (100 / (1 + rs));

                // تطبيق شروط الكلاستر الخاصة بك بدقة
                const isMatch = (price >= 1 && price <= 50 && price <= (ma20 - (stdDev * 0.3)) && rsi < 40 && volume > 100000);

                if (isMatch) {
                    matchedSymbols.push(sym);
                }
            } catch (e) {}
        }
        return NextResponse.json({ matched: matchedSymbols });
    }

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
        const lowerBand = ma20 - (2 * stdDev);

        const rsiPeriod = 14;
        let gains = 0, losses = 0;
        for (let i = quotes.length - rsiPeriod; i < quotes.length; i++) {
            const change = quotes[i] - quotes[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        const rs = (gains / rsiPeriod) / ((losses / rsiPeriod) === 0 ? 1 : (losses / rsiPeriod));
        const rsi = 100 - (100 / (1 + rs));

        const isEntrySuitable = (price >= 1 && price <= 50 && price <= (ma20 - (stdDev * 0.3)) && rsi < 40 && volume > 100000);

        const stopLoss = (price * 0.97).toFixed(2);
        const takeProfit1 = (price * 1.04).toFixed(2);
        const takeProfit2 = (price * 1.08).toFixed(2);
        const takeProfit3 = (price * 1.12).toFixed(2);

        const analysisText = `تحليل سهم ${cleanSymbol} (نموذج الارتداد):
السعر: ${price.toFixed(2)} | RSI: ${rsi.toFixed(1)} | الفوليوم: ${(volume/1000).toFixed(1)}K
منطقة الكلاستر: ${price <= lowerBand ? "عند الدعم السفلي ✅" : "قريب من الدعم ⚠️"}
وقف الخسارة: ${stopLoss} (يُرفع لنقطة الدخول بعد الهدف 1)
الهدف 1: ${takeProfit1} | الهدف 2: ${takeProfit2} | الهدف 3: ${takeProfit3}
القرار النهائي: ${isEntrySuitable ? "فرصة ارتداد مناسبة للدخول ✅" : "انتظر اكتمال النموذج ❌"}`;

        if (isEntrySuitable) {
            const now = Date.now();
            const lastAlertTime = global.lastAlerts[cleanSymbol] || 0;
            const cooldownTime = 60 * 60 * 1000; 

            if (now - lastAlertTime > cooldownTime) {
                global.lastAlerts[cleanSymbol] = now; 

                const message = `🎯 فرصة ارتداد كلاستر (عالي الدقة): ${cleanSymbol}\n` +
                                `💰 سعر الدخول: ${price.toFixed(2)}\n` +
                                `📉 مؤشر RSI: ${rsi.toFixed(1)}\n` +
                                `🛑 وقف الخسارة الأولي: ${stopLoss}\n` +
                                `🛡️ قاعدة الحماية: يُرفع الوقف لسعر الدخول فور بلوغ الهدف 1\n` +
                                `🎯 الهدف الأول: ${takeProfit1}\n` +
                                `🎯 الهدف الثاني: ${takeProfit2}\n` +
                                `🎯 الهدف الثالث: ${takeProfit3}\n` +
                                `📊 الفوليوم: ${(volume/1000).toFixed(1)}K`;

                await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(message)}`).catch(() => {});
            }
        }

        return NextResponse.json({ symbol: cleanSymbol, analysis: analysisText, isSuitable: isEntrySuitable });
    } catch (error) {
        return NextResponse.json({ error: "فشل التحليل" }, { status: 500 });
    }
}
