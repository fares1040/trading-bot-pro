import { NextResponse } from 'next/server';

global.lastAlerts = global.lastAlerts || {};
global.activeTrades = global.activeTrades || {};
let cachedMarketPool = [];
let lastFetchTime = 0;

async function getDynamicMarketPool(customList = []) {
    const now = Date.now();
    let dynamicSymbols = [];

    if (cachedMarketPool.length > 0 && (now - lastFetchTime < 30 * 60 * 1000)) {
        dynamicSymbols = cachedMarketPool;
    } else {
        try {
            const res = await fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=true&scrIds=most_actives');
            const data = await res.json();
            const quotes = data?.finance?.result?.[0]?.quotes || [];
            
            let symbols = quotes.map(q => q.symbol).filter(sym => typeof sym === 'string' && !sym.includes('=') && !sym.includes('-'));
            
            if (symbols.length > 0) {
                cachedMarketPool = Array.from(new Set(symbols)).slice(0, 30);
            } else {
                cachedMarketPool = ['AAPL', 'TSLA', 'NVDA', 'AMZN', 'MSFT', 'AMD', 'CETX', 'GSIT', 'PRFX', 'HURA', 'KULR'];
            }
            
            lastFetchTime = now;
            dynamicSymbols = cachedMarketPool;
        } catch (e) {
            dynamicSymbols = cachedMarketPool.length > 0 ? cachedMarketPool : ['AAPL', 'TSLA', 'NVDA', 'AMZN', 'MSFT', 'CETX', 'GSIT', 'PRFX'];
        }
    }

    const combinedPool = Array.from(new Set([...customList, ...dynamicSymbols]));
    return combinedPool;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const scanMode = searchParams.get('scan');
    const customSymbolsParam = searchParams.get('symbols');

    const TELEGRAM_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
    const CHAT_ID = '896028407';

    if (scanMode === 'true') {
        let matchedSymbols = [];
        let userWatchlist = [];
        if (customSymbolsParam) {
            userWatchlist = customSymbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        }

        const marketPool = await getDynamicMarketPool(userWatchlist);

        for (let sym of marketPool) {
            try {
                const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=60m&range=60d`);
                const data = await res.json();
                if (!data.chart || !data.chart.result) continue;

                const meta = data.chart.result[0].meta;
                const quotes = data.chart.result[0].indicators.quote[0].close.filter(v => v != null);
                const volumes = data.chart.result[0].indicators.quote[0].volume.filter(v => v != null);
                const price = meta.regularMarketPrice;
                const volume = volumes[volumes.length - 1] || 0;

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
                const isMomentumValid = rsi < 45; 
                
                const stopLoss = price * 0.97;
                const takeProfit1 = price * 1.04;
                const risk = price - stopLoss;
                const reward = takeProfit1 - price;
                const riskRewardRatio = reward / (risk === 0 ? 1 : risk);
                const isRiskRewardValid = riskRewardRatio >= 1.5;

                const isMatch = (price >= 1 && price <= 100 && price <= (ma20 - (stdDev * 0.3)) && isMomentumValid && isTrendPositive && isVolumeStrong && isRiskRewardValid);

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
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}?interval=60m&range=60d`);
        const data = await res.json();
        
        if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
            return NextResponse.json({ error: "لا توجد بيانات" }, { status: 404 });
        }

        const meta = data.chart.result[0].meta;
        const quotes = data.chart.result[0].indicators.quote[0].close.filter(v => v != null);
        const volumes = data.chart.result[0].indicators.quote[0].volume.filter(v => v != null);
        const price = meta.regularMarketPrice;
        const volume = volumes[volumes.length - 1] || 0;

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
        const isMomentumValid = rsi < 45;

        const stopLossVal = price * 0.97;
        const takeProfit1Val = price * 1.04;
        const takeProfit2Val = price * 1.08;
        const takeProfit3Val = price * 1.12;

        const risk = price - stopLossVal;
        const reward = takeProfit1Val - price;
        const riskRewardRatio = reward / (risk === 0 ? 1 : risk);
        const isRiskRewardValid = riskRewardRatio >= 1.5;

        const stopLoss = stopLossVal.toFixed(2);
        const takeProfit1 = takeProfit1Val.toFixed(2);
        const takeProfit2 = takeProfit2Val.toFixed(2);
        const takeProfit3 = takeProfit3Val.toFixed(2);

        const isEntrySuitable = (price >= 1 && price <= 100 && price <= (ma20 - (stdDev * 0.3)) && isMomentumValid && isTrendPositive && isVolumeStrong && isRiskRewardValid);

        if (global.activeTrades[cleanSymbol]) {
            const trade = global.activeTrades[cleanSymbol];
            if (!trade.tp1Hit && price >= trade.tp1) {
                trade.tp1Hit = true;
                const updateMsg = `🎯 تحديث صفقة سنايبر (${cleanSymbol})\n` +
                                  `✅ السعر اخترق الهدف الأول بنجاح وسجل: ${price.toFixed(2)}\n` +
                                  `🛡️ الإجراء المطلوب: ارفع وقف الخسارة إلى نقطة الدخول (${trade.entryPrice}) لتأمين الصفقة!`;
                await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(updateMsg)}`).catch(() => {});
            } else if (trade.tp1Hit && !trade.tp2Hit && price >= trade.tp2) {
                trade.tp2Hit = true;
                const updateMsg = `🎯🎯 تحديث صفقة سنايبر (${cleanSymbol})\n` +
                                  `🚀 السعر وصل للهدف الثاني بنجاح وسجل: ${price.toFixed(2)}`;
                await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(updateMsg)}`).catch(() => {});
            } else if (price <= trade.sl) {
                delete global.activeTrades[cleanSymbol];
            }
        }

        const analysisText = `تحليل سهم ${cleanSymbol} (فريم 4 ساعات - نموذج الارتداد):
السعر: ${price.toFixed(2)} | RSI (الزخم): ${rsi.toFixed(1)} | الفوليوم: ${(volume/1000).toFixed(1)}K (متوسط 20: ${(avgVolume20/1000).toFixed(1)}K)
الترند (MA50): ${isTrendPositive ? "إيجابي صاعد ✅" : "تحت المتوسط ⚠️"}
الفوليوم (MA Volume): ${isVolumeStrong ? "عالي وقوي 🚀" : "متوسط/ضعيف ⚠️"}
منطقة الكلاستر: ${price <= lowerBand ? "عند الدعم السفلي ✅" : "قريب من الدعم ⚠️"}
إدارة المخاطر (R:R): ${riskRewardRatio.toFixed(2)} (${isRiskRewardValid ? "مقبولة ✅" : "غير مجزية ⚠️"})
وقف الخسارة: ${stopLoss} (يُرفع لنقطة الدخول بعد الهدف 1)
الهدف 1: ${takeProfit1} | الهدف 2: ${takeProfit2} | الهدف 3: ${takeProfit3}
القرار النهائي: ${isEntrySuitable ? "فرصة ارتداد مناسبة للدخول ✅" : "انتظر اكتمال النموذج ❌"}`;

        if (isEntrySuitable) {
            const now = Date.now();
            const lastAlertTime = global.lastAlerts[cleanSymbol] || 0;
            const cooldownTime = 60 * 60 * 1000; 

            if (now - lastAlertTime > cooldownTime) {
                global.lastAlerts[cleanSymbol] = now; 

                global.activeTrades[cleanSymbol] = {
                    entryPrice: price.toFixed(2),
                    tp1: Number(takeProfit1),
                    tp2: Number(takeProfit2),
                    sl: Number(stopLoss),
                    tp1Hit: false,
                    tp2Hit: false
                };

                const message = `🎯 فرصة ارتداد كلاستر (فريم 4 ساعات): ${cleanSymbol}\n` +
                                `💰 سعر الدخول: ${price.toFixed(2)}\n` +
                                `📉 مؤشر RSI والزخم: ${rsi.toFixed(1)}\n` +
                                `📈 الترند والفوليوم (MA Vol): مطابق للشروط بنجاح ✅\n` +
                                `⚖️ نسبة العائد للمخاطرة (R:R): ${riskRewardRatio.toFixed(2)}\n` +
                                `🛑 وقف الخسارة الأولي: ${stopLoss}\n` +
                                `🛡️ قاعدة الحماية: يُرفع الوقف لسعر الدخول فور بلوغ الهدف 1\n` +
                                `🎯 الهدف الأول: ${takeProfit1}\n` +
                                `🎯 الهدف الثاني: ${takeProfit2}\n` +
                                `🎯 الهدف الثالث: ${takeProfit3}`;

                await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(message)}`).catch(() => {});
            }
        }

        return NextResponse.json({ symbol: cleanSymbol, analysis: analysisText, isSuitable: isEntrySuitable });
    } catch (error) {
        return NextResponse.json({ error: "فشل التحليل" }, { status: 500 });
    }
}
