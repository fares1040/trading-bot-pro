import { NextResponse } from 'next/server';

global.lastAlerts = global.lastAlerts || {};
let cachedMarketPool = [];
let lastFetchTime = 0;

async function getDynamicMarketPool() {
    const now = Date.now();
    // تحديث قائمة الأسهم النشطة كل 30 دقيقة لضمان عدم حدوث حظر (Rate Limit) وحماية السيرفر
    if (cachedMarketPool.length > 0 && (now - lastFetchTime < 30 * 60 * 1000)) {
        return cachedMarketPool;
    }

    try {
        // جلب الأسهم الأكثر نشاطاً وحركة في السوق حالياً كمصدر أساسي للترند
        const res = await fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=true&scrIds=most_actives');
        const data = await res.json();
        const quotes = data?.finance?.result?.[0]?.quotes || [];
        
        let symbols = quotes.map(q => q.symbol).filter(sym => typeof sym === 'string' && !sym.includes('=') && !sym.includes('-'));
        
        // لو جاب قائمة صالحة نعتمدها، وإلا نرجع لقائمة أساسية قوية كاحتياط
        if (symbols.length > 0) {
            cachedMarketPool = Array.from(new Set(symbols)).slice(0, 30); // أخذ أول 30 سهم الأكثر نشاطاً لضمان السرعة والأمان
        } else {
            cachedMarketPool = ['AAPL', 'TSLA', 'NVDA', 'AMZN', 'MSFT', 'AMD', 'META', 'GOOGL', 'CETX', 'GSIT', 'PRFX', 'HURA', 'KULR', 'PPSI'];
        }
        
        lastFetchTime = now;
    } catch (e) {
        if (cachedMarketPool.length === 0) {
            cachedMarketPool = ['AAPL', 'TSLA', 'NVDA', 'AMZN', 'MSFT', 'AMD', 'CETX', 'GSIT', 'PRFX', 'HURA', 'KULR'];
        }
    }

    return cachedMarketPool;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const scanMode = searchParams.get('scan');

    const TELEGRAM_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
    const CHAT_ID = '896028407';

    if (scanMode === 'true') {
        let matchedSymbols = [];
        const marketPool = await getDynamicMarketPool();

        for (let sym of marketPool) {
            try {
                const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=60d`);
                const data = await res.json();
                if (!data.chart || !data.chart.result) continue;

                const meta = data.chart.result[0].meta;
                const quotes = data.chart.result[0].indicators.quote[0].close;
                const volumes = data.chart.result[0].indicators.quote[0].volume;
                const price = meta.regularMarketPrice;
                const volume = meta.regularMarketVolume || 0;

                if (!quotes || quotes.length < 50) continue;

                const ma20 = quotes.slice(-20).reduce((a, b) => a + b, 0) / 20;
                const ma50 = quotes.slice(-50).reduce((a, b) => a + b, 0) / 50; 
                const avgVolume20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20; 
                
                const stdDev = Math.sqrt(quotes.slice(-20).map(x => Math.pow(x - ma20, 2)).reduce((a, b) => a + b) / 20);

                const rsiPeriod = 14;
                let gains = 0, losses = 0;
                for (let i = quotes.length - rsiPeriod; i < quotes.length; i++) {
                    const change = quotes[i] - quotes[i - 1];
                    if (change > 0) gains += change;
                    else losses -= change;
                }
                const rs = (gains / rsiPeriod) / ((losses / rsiPeriod) === 0 ? 1 : (losses / rsiPeriod));
                const rsi = 100 - (100 / (1 + rs));

                const isTrendPositive = price >= ma50; 
                const isVolumeStrong = volume >= (avgVolume20 * 1.5); 
                const isMatch = (price >= 1 && price <= 100 && price <= (ma20 - (stdDev * 0.3)) && rsi < 40 && isTrendPositive && isVolumeStrong);

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
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}?interval=1d&range=60d`);
        const data = await res.json();
        
        if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
            return NextResponse.json({ error: "لا توجد بيانات" }, { status: 404 });
        }

        const meta = data.chart.result[0].meta;
        const quotes = data.chart.result[0].indicators.quote[0].close;
        const volumes = data.chart.result[0].indicators.quote[0].volume;
        const price = meta.regularMarketPrice;
        const volume = meta.regularMarketVolume || 0;

        const ma20 = quotes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const ma50 = quotes.slice(-50).reduce((a, b) => a + b, 0) / 50;
        const avgVolume20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        
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

        const isTrendPositive = price >= ma50;
        const isVolumeStrong = volume >= (avgVolume20 * 1.5);
        const isEntrySuitable = (price >= 1 && price <= 100 && price <= (ma20 - (stdDev * 0.3)) && rsi < 40 && isTrendPositive && isVolumeStrong);

        const stopLoss = (price * 0.97).toFixed(2);
        const takeProfit1 = (price * 1.04).toFixed(2);
        const takeProfit2 = (price * 1.08).toFixed(2);
        const takeProfit3 = (price * 1.12).toFixed(2);

        const analysisText = `تحليل سهم ${cleanSymbol} (نموذج الارتداد):
السعر: ${price.toFixed(2)} | RSI: ${rsi.toFixed(1)} | الفوليوم: ${(volume/1000).toFixed(1)}K
الترند (MA50): ${isTrendPositive ? "إيجابي صاعد ✅" : "تحت المتوسط ⚠️"}
الفوليوم: ${isVolumeStrong ? "عالي وقوي 🚀" : "متوسط/ضعيف ⚠️"}
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

                const message = `🎯 فرصة ارتداد كلاستر (ديناميكي ومفلتر): ${cleanSymbol}\n` +
                                `💰 سعر الدخول: ${price.toFixed(2)}\n` +
                                `📉 مؤشر RSI: ${rsi.toFixed(1)}\n` +
                                `📈 الترند والفوليوم: مطابق للشروط بنجاح ✅\n` +
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
