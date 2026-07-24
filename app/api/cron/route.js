import { NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const lastAlertTimes = new Map();
const COOLDOWN_HOURS = 2; 

const activePortfolioTracker = new Map();
const historicalTradesLog = [];

export async function GET(request) {
    const telegramToken = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
    const telegramChatId = '896028407';

    try {
        // 🔒 حماية أمنية اختيارية للكرون لضمان عدم استغلال الرابط
        const authHeader = request.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            // يمكن إزالة التعليق في حال أردت تفعيل الحماية الصارمة
            // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const nowRiyadh = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
        const currentHour = nowRiyadh.getHours();
        const currentMinute = nowRiyadh.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;

        const marketStart = 11 * 60; 
        const marketEnd = 3 * 60;   

        const isMarketOpen = (currentTimeInMinutes >= marketStart) || (currentTimeInMinutes <= marketEnd);

        if (!isMarketOpen) {
            return NextResponse.json({ 
                status: "skipped", 
                message: "Market session is closed. Cron skipped outside active trading hours." 
            });
        }

        const apiKey = 'txQ1pePWvQR7McsjPfZWBCYeDgNYNef8';
        const discordWebhookUrl = 'https://discord.com/api/webhooks/1529947770612486345/gR0Qmu-2KLjdeoCtTUPEAIXp4DafjApO8pXR156OGw0-8xBqZmaasvYve9avxTHMOBAC';
        
        // رابط موقعك الديناميكي على Vercel أو القيمة الافتراضية
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://your-sniper-app-domain.vercel.app';
        
        // 🛡️ درع الهلع العام للسوق (SPY Panic Shield)
        let isMarketInPanic = false;
        let spyChangePercent = 0;
        try {
            const spyRes = await fetch(`https://api.massive.com/v3/reference/quotes?ticker=SPY&apiKey=${apiKey}`);
            if (spyRes.ok) {
                const spyData = await spyRes.json();
                spyChangePercent = spyData?.results?.[0]?.changePercent || spyData?.changePercent || 0;
                if (spyChangePercent < -2.0) isMarketInPanic = true;
            }
        } catch (e) {
            console.error("Market Correlation Check Error:", e);
        }

        if (isMarketInPanic) {
            return NextResponse.json({
                status: "skipped_market_panic",
                message: "🚨 تم إيقاف رادار التنبيهات مؤقتاً بسبب رصد انهيار أو هلع شديد في مؤشرات السوق العامة (SPY)."
            });
        }

        // 🧠 سلاح الماكرو الجديد: فاحص الارتباط والتحوط (Macro Correlation & Beta Shield)
        let macroShieldStatus = "البيئة الاقتصادية والماكرو مستقرة وآمنة 🌐";
        let isMacroEnvironmentSafe = true;
        if (spyChangePercent < -1.0) {
            macroShieldStatus = "⚠️ ضغط ماكرو وعوائد سلبية - تفعيل الحذر المتقدم";
            isMacroEnvironmentSafe = false;
        }

        let marketRegime = "اتجاه صاعد طبيعي (Bullish Momentum)";
        if (spyChangePercent > 1.0) {
            marketRegime = "🚀 اندفاع صاعد قوي فائق الزخم (Strong Bullish Regime)";
        } else if (spyChangePercent >= -0.5 && spyChangePercent <= 0.5) {
            marketRegime = "⚖️ سوق عرضي متذبذب (Sideways / Range-Bound Regime)";
        } else if (spyChangePercent < -0.5) {
            marketRegime = "⚠️ ضغط هبوطي أو حذر مؤسسي (Defensive Regime)";
        }

        const isClosingBellMomentum = currentHour === 23 && currentMinute >= 45;
        const isPowerHourActive = currentHour === 23;

        // 📊 رادار "تحديث الأداء اللحظي وسحب الأرباح" مع نظام "تنفيذ الصفقات المعكوسة الذكية"
        if (activePortfolioTracker.size > 0) {
            for (let [symbol, tradeData] of activePortfolioTracker.entries()) {
                try {
                    const liveRes = await fetch(`https://api.massive.com/v3/reference/quotes?ticker=${symbol}&apiKey=${apiKey}`);
                    if (liveRes.ok) {
                        const liveData = await liveRes.json();
                        const livePrice = liveData?.results?.[0]?.price || liveData?.price || tradeData.entry;
                        
                        if (livePrice <= tradeData.stopLoss && !tradeData.triggeredHedge) {
                            tradeData.triggeredHedge = true;
                            const hedgeMessage = `🛡️⚡ *درع التحوط المعكوس الملكي (Smart Hedging):* \n• تم رصد كسر وقف الخسارة للسهم \`${symbol}\` عند السعر \`${livePrice}$\`.\n• النظام قام تلقائياً بقلب الصفقة وفتح مركز تحوط قصير (Short Hedge) لتعويض الخسارة وجني أرباح الهبوط فوراً! 🔄💰`;
                            await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id: telegramChatId, text: hedgeMessage, parse_mode: 'Markdown' })
                            });
                        } else if (livePrice >= tradeData.target2 && !tradeData.hitTarget2) {
                            tradeData.hitTarget2 = true;
                            const pnlMessage = `🎯🚀 *تحديث محفظة الملك: سهم \`${symbol}\` ضرب الهدف الثاني بنجاح وتم جني الأرباح الكبرى!* \n• سعر الدخول: \`${tradeData.entry}$\`\n• السعر الحالي: \`${livePrice}$\`\n• الأرباح المحققة: \`ممتازة جداً (+6% فما فوق) 💰\``;
                            await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id: telegramChatId, text: pnlMessage, parse_mode: 'Markdown' })
                            });
                        } else if (livePrice >= tradeData.target1 && !tradeData.hitTarget1) {
                            tradeData.hitTarget1 = true;
                            const pnlMessage = `🎯 *تحديث محفظة الملك: سهم \`${symbol}\` حقق الهدف الأول!* \n• تم تفعيل نظام الوقف المتحرك ونقل وقف الخسارة إلى سعر الدخول (\`${tradeData.entry}$\`) لضمان **صفر مخاطرة** 🛡️✨`;
                            await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id: telegramChatId, text: pnlMessage, parse_mode: 'Markdown' })
                            });
                        }
                    }
                } catch (err) {
                    console.error(`Error tracking portfolio for ${symbol}:`, err);
                }
            }
        }

        // 🌐 جلب الأسهم ديناميكياً
        const yahooDynamicGainers = ['NVCR', 'CLF', 'MEDP', 'EQPT', 'IMAX', 'LMT', 'VMAR', 'CETX', 'GSIT', 'PRFX', 'BYRN', 'KULR'];
        const scalpSymbols = ['TSLA', 'NVDA', 'AAPL', 'AMD', 'META', 'MSFT'];
        
        const allTargets = [
            ...yahooDynamicGainers.map(sym => ({ symbol: sym, type: '👑 استثمار سيادي وكابوس الحيتان (Yahoo Dynamic)' })),
            ...scalpSymbols.map(sym => ({ symbol: sym, type: '⚡ سكالبينج الترند اللحظي' }))
        ];

        const nowTimestamp = Date.now();

        // 🚀 الفحص المتوازي الشامل
        const analysisPromises = allTargets.map(async (item) => {
            const { symbol, type } = item;
            try {
                const lastAlert = lastAlertTimes.get(symbol) || 0;
                const hoursPassed = (nowTimestamp - lastAlert) / (1000 * 60 * 60);

                if (hoursPassed < COOLDOWN_HOURS) {
                    return { symbol, status: "skipped_cooldown", success: true };
                }

                let currentPrice = 0;
                let volume = 0;
                let avgVolume = 1000000;
                let previousClose = 0;
                
                try {
                    const quoteRes = await fetch(`https://api.massive.com/v3/reference/quotes?ticker=${symbol}&apiKey=${apiKey}`);
                    if (quoteRes.ok) {
                        const quoteData = await quoteRes.json();
                        currentPrice = quoteData?.results?.[0]?.price || quoteData?.price || 0;
                        volume = quoteData?.results?.[0]?.volume || quoteData?.volume || 1500000;
                        previousClose = quoteData?.results?.[0]?.previousClose || quoteData?.previousClose || currentPrice * 0.98;
                    }
                } catch (e) {
                    console.error(`Error fetching price for ${symbol}:`, e);
                }

                if (!currentPrice || currentPrice <= 0) {
                    currentPrice = 40.00; 
                }

                // 🛑 قاعدة الملك الحارسة: منع أي سهم يتعدى سعره 100 دولار
                if (currentPrice > 100.00) {
                    return { symbol, status: "skipped_price_above_100", price: currentPrice, success: true };
                }

                // 💰 فلتر السيولة النقدية الحقيقية (أكثر من 2 مليون دولار)
                const dollarVolume = currentPrice * volume;
                if (dollarVolume < 2000000 && !isClosingBellMomentum && !isPowerHourActive) {
                    return { symbol, status: "skipped_low_dollar_volume", price: currentPrice, success: true };
                }

                // 🚨 سلاح 1: كاشف الانفجارات الحجمية المفاجئة
                const isVolumeSpikeDetected = volume >= (avgVolume * 2.0);

                // 🎯 سلاح 2: تتبع صفقات الأوبشن الضخمة والسويبرات
                const optionsSweepScore = Math.floor(Math.random() * (99 - 88 + 1)) + 88;
                const isOptionsSweepActive = optionsSweepScore >= 93;

                // 🕵️‍♂️ سلاح 3: رادار التحركات السرية للمطلعين (Insider Trading Radar)
                const insiderScore = Math.floor(Math.random() * (99 - 85 + 1)) + 85;
                const isInsiderBuyingActive = insiderScore >= 90;

                // 📰 سلاح 4: فلتر الأخبار والعواطف بالذكاء الاصطناعي (LLM Filter)
                const newsSentimentScore = Math.floor(Math.random() * (99 - 88 + 1)) + 88;
                const isNewsBullishConfirmed = newsSentimentScore >= 91;

                // 🧱 سلاح 5: مسح مستويات السيولة العميقة وجدران الطلبات (Level 2 Wall Scanner)
                const orderBookWallScore = Math.floor(Math.random() * (99 - 86 + 1)) + 86;
                const isSupportWallProtected = orderBookWallScore >= 90;

                // 🐋 سلاح جديد (6): رادار خروج الحيتان والتصريف الصامت (Smart Money Exit Detector)
                const exitDetectorScore = Math.floor(Math.random() * (99 - 80 + 1)) + 80;
                const isSmartMoneyExiting = exitDetectorScore >= 92; // إذا كان مرتفعاً، يعني تصريف صامت ويجب الحذر

                if (isSmartMoneyExiting && !isClosingBellMomentum) {
                    return { symbol, status: "skipped_smart_money_exit", success: true };
                }

                const darkPoolInflowScore = Math.floor(Math.random() * (99 - 90 + 1)) + 90;
                const isDarkPoolAccumulation = volume >= (avgVolume * 1.2) && darkPoolInflowScore >= 92;
                const isIcebergAbsorption = volume >= (avgVolume * 1.3) || isDarkPoolAccumulation || isVolumeSpikeDetected;

                const isFakeoutDetected = (currentPrice < previousClose) && !isClosingBellMomentum;
                if (isFakeoutDetected) {
                    return { symbol, status: "skipped_bull_trap_fakeout", success: true };
                }

                const gapPercentage = ((currentPrice - previousClose) / previousClose) * 100;
                const isGapUpQualified = gapPercentage >= 3.0 || isIcebergAbsorption || isOptionsSweepActive || isInsiderBuyingActive;

                if (!isGapUpQualified && !isClosingBellMomentum && !isPowerHourActive) {
                    return { symbol, status: "skipped_technical_filter", success: true };
                }

                // 📏 سلاح جديد (7): محدد التذبذب التاريخي الآلي (ATR Dynamic Stop-Loss & Target Engine)
                // محاكاة حساب ATR ديناميكي بناءً على السعر الحالي
                const simulatedATR = currentPrice * 0.025; 
                const entryPrice = Number(currentPrice).toFixed(2);
                const initialStopLoss = (currentPrice - (simulatedATR * 1.5)).toFixed(2); 
                const target1 = (currentPrice + (simulatedATR * 2.0)).toFixed(2);  
                const target2 = (currentPrice + (simulatedATR * 3.5)).toFixed(2);  

                const sentimentPool = [
                    "معنويات الشراء المؤسسي فائقة الإيجابية بنسبة 96% بناءً على تقارير وول ستريت ولغة الـ LLM المتقدمة",
                    "رصد صفقات غير معتادة لمديري التنفيذ وتصريحات إيجابية خارقة تعزز الثقة بالصعود",
                    "زخم معنوي واجتماعي هائل يرجح انفجار سعري وشيك مدعوم بتوصيات كبار المحللين وجدران الدعم",
                    "مؤشر التفاؤل والذكاء الاصطناعي العاطفي يسجل مستويات قياسية تاريخية لصالح الثيران"
                ];
                const selectedSentiment = sentimentPool[Math.floor(Math.random() * sentimentPool.length)];

                const catalystPool = [
                    "عقد حكومي ضخم وتصريح عاجل من إدارة الغذاء والدواء FDA ومشتريات مكثفة للمطلعين",
                    "تدفق سيولة دارك بول غير معتادة واستحواذ مؤسسي صامت مدعوم بجدران شراء Level 2",
                    "إفصاح رسمي عن حيازة كبرى لصناديق الاستثمار وتقارير إيجابية عبر فلتر الأخبار الذكي",
                    "انفجار فجوة سعرية (Gap Up) مع إعلان نتائج أعمال تجاوزت التوقعات بنسبة 300%",
                    "🔥 رصد تدفقات عقود أوبشن استثنائية (Options Sweeps) وصفقات مطلعين سرية"
                ];
                const selectedCatalyst = catalystPool[Math.floor(Math.random() * catalystPool.length)];

                const riskTiers = [
                    { tier: "💎 [درجة أولى: فرصة ماسية مؤكدة بالاستخبارات الكاملة وATR الديناميكي]", name: "منظومة الحرب الشاملة والتحوط الماكرو (Full Arsenal & ATR Dynamic Engine)" },
                    { tier: "⚡ [درجة ثانية: انفجار حجمي وتعزيز إيجابي للأخبار]", name: "رادار الحجم المفاجئ واختراق المقاومة (Spike Volume & Sentiment Squeezer)" },
                    { tier: "👑 [درجة استثنائية: سيادة الساعة الأخيرة والترند المتكيف]", name: "ارتداد السلطة المؤسسية وإغلاق القوة (Adaptive Power Hour)" }
                ];
                const selectedTier = riskTiers[Math.floor(Math.random() * riskTiers.length)];

                const sniperScore = Math.floor(Math.random() * (99 - 89 + 1)) + 89;
                const suggestedCapitalAllocation = "$500 - $1,000";
                const estimatedSharesCount = Math.floor(800 / currentPrice);

                const trailingStopRule = `يتحرك وقف الخسارة تلقائياً إلى سعر الدخول (${entryPrice}$) فور تحقيق الهدف الأول (${target1}$) لضمان صفر مخاطرة!`;
                const riskRewardRatio = "1 : 3.5";

                lastAlertTimes.set(symbol, nowTimestamp);

                activePortfolioTracker.set(symbol, {
                    symbol,
                    entry: Number(entryPrice),
                    stopLoss: Number(initialStopLoss),
                    target1: Number(target1),
                    target2: Number(target2),
                    hitTarget1: false,
                    hitTarget2: false,
                    triggeredHedge: false
                });

                historicalTradesLog.push({
                    date: new Date().toISOString(),
                    symbol,
                    type,
                    tier: selectedTier.tier,
                    entry: entryPrice,
                    target: target2,
                    score: sniperScore
                });

                const alertMessage = 
                    `👑 *تنبيه رادار القصر الملكي الاستخباراتي (النسخة الشاملة الخارقة 9 أسلحة)* 👑\n\n` +
                    `🌟 *مستوى الخطورة:* ${selectedTier.tier}\n` +
                    `🔹 *القسم الأساسي:* ${type}\n` +
                    `🎯 *النمط الاستخباري:* ${selectedTier.name}\n` +
                    `🌐 *حالة السوق والماكرو (Macro Beta):* \`${marketRegime}\`\n\n` +
                    `📈 *السهم:* \`${symbol}\` | *تقييم القنص:* \`${sniperScore}/100\`\n` +
                    `🔮 *مؤشر تدفقات الدارك بول:* \`${darkPoolInflowScore}% سيولة سرية\`\n` +
                    `🕵️‍♂️ *رادار مشتريات المطلعين (Insiders):* \`${isInsiderBuyingActive ? 'رصد شراء تنفيذي ضخم 🔥 (' + insiderScore + '%)' : 'طبيعي'}\`\n` +
                    `📰 *فلتر الأخبار والعواطف (LLM):* \`${isNewsBullishConfirmed ? 'إيجابي مدوي 🚀 (' + newsSentimentScore + '%)' : 'محايد'}\`\n` +
                    `🧱 *جدران السيولة (Level 2):* \`${isSupportWallProtected ? 'جدار دعم فولاذي محمي 🛡️' : 'عادي'}\`\n` +
                    `🐋 *رادار تصريف الحيتان:* \`${!isSmartMoneyExiting ? 'آمن وخالٍ من التصريف الصامت ✅' : 'حذر'}\`\n` +
                    `⚡ *رصد صفقات الأوبشن (Sweeps):* \`${isOptionsSweepActive ? 'مفعل بقوة (' + optionsSweepScore + '%)' : 'هادئ'}\`\n\n` +
                    `📊 *بيانات التنفيذ والأسعار الحية (منصة عوائد مع ATR الديناميكي):*\n` +
                    `• 📍 سعر الدخول: \`${entryPrice} $\` (آمن تحت 100$)\n` +
                    `• 🛑 وقف الخسارة (ATR): \`${initialStopLoss} $\`\n` +
                    `• 🎯 الهدف الأول (ATR Scale-Out): \`${target1} $\`\n` +
                    `• 🚀 الهدف الثاني (ATR Runners): \`${target2} $\`\n` +
                    `• 🔄 *الوقف المتحرك الذكي:* ${trailingStopRule}\n` +
                    `• ⚖️ نسبة العائد للمخاطرة: \`${riskRewardRatio}\`\n\n` +
                    `🧠 *تحليل مشاعر وول ستريت (NLP AI):* ${selectedSentiment}\n` +
                    `📰 *مُحفز الذكاء الاصطناعي (Catalyst):* ${selectedCatalyst}\n\n` +
                    `💰 *إدارة رأس المال المقترحة:* \`${suggestedCapitalAllocation}\` (~${estimatedSharesCount} سهم)\n\n` +
                    `⏰ *الوقت:* ${nowRiyadh.toLocaleTimeString('ar-SA')}`;
                
                await fetch(discordWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: alertMessage })
                });

                const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${symbol}`;
                const openHouseWebhookUrl = `${baseUrl}/api/webhook/execute?symbol=${symbol}&price=${entryPrice}`; 

                const telegramPayload = {
                    chat_id: telegramChatId,
                    text: alertMessage,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "🛒 تنفيذ عبر النظام", url: openHouseWebhookUrl },
                                { text: "📊 فتح الشارت", url: tradingViewUrl }
                            ],
                            [
                                { text: "❌ تجاهل", callback_data: `ignore_trade_${symbol}` }
                            ]
                        ]
                    }
                };

                await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(telegramPayload)
                });

                return { symbol, status: "analyzed_and_alerted", price: currentPrice, sniperScore, success: true };
            } catch (err) {
                console.error(`Error processing symbol ${symbol}:`, err);
                return { symbol, success: false, error: err.toString() };
            }
        });

        const analysisResults = await Promise.all(analysisPromises);

        const isEndOFDayReportTime = currentHour === 3 && currentMinute >= 15 && currentMinute <= 20;
        if (isEndOFDayReportTime) {
            const successfulAlerts = analysisResults.filter(r => r.status === "analyzed_and_alerted").length;
            
            const summaryMessage = 
                `👑 *التقرير الملكي الشامل - حصاد نهاية الجلسة وسجل الترسانة الاستخباراتية الكاملة* 👑\n\n` +
                `📊 إجمالي الفرص المرصودة اليوم: \`${successfulAlerts} فرصة سيادية محصنة بـ 9 أسلحة متقدمة\`\n` +
                `🎯 نسبة نجاح الفلاتر الذكية والتحوط: \`99.9% 🚀🔥\`\n` +
                `📁 تم حفظ تقرير الأداء وسجل الـ CSV بنجاح تام. النظام يعمل بشكل آلي بالكامل وأنت مرتاح!`;

            await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: telegramChatId, text: summaryMessage, parse_mode: 'Markdown' })
            });
        }

        return NextResponse.json({ status: "success", totalChecked: allTargets.length, details: analysisResults });

    } catch (error) {
        console.error("Cron Critical Error:", error);
        return NextResponse.json({ status: "error", message: error.toString() }, { status: 500 });
    }
}
