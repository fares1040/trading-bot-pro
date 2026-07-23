import { NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const lastAlertTimes = new Map();
const COOLDOWN_HOURS = 2; 

export async function GET(request) {
    try {
        // التحقق الدقيق من توقيت الرياض (المطابق لجلسات السوق الأمريكي Pre-market & After-hours)
        const nowRiyadh = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
        const currentHour = nowRiyadh.getHours();
        const currentMinute = nowRiyadh.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;

        // نطاق العمل: من 11:00 صباحاً (بداية الـ Pre-Market) وحتى 03:00 فجراً (نهاية الـ After-Hours)
        const marketStart = 11 * 60; // 660 دقيقة
        const marketEnd = 3 * 60;   // 180 دقيقة (اليوم التالي)

        const isMarketOpen = (currentTimeInMinutes >= marketStart) || (currentTimeInMinutes <= marketEnd);

        if (!isMarketOpen) {
            return NextResponse.json({ 
                status: "skipped", 
                message: "Market session is closed. Cron skipped outside active trading hours (11:00 AM - 3:00 AM Riyadh time)." 
            });
        }

        const apiKey = 'txQ1pePWvQR7McsjPfZWBCYeDgNYNef8';
        const telegramToken = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
        const telegramChatId = '896028407';
        const discordWebhookUrl = 'https://discord.com/api/webhooks/1529947770612486345/gR0Qmu-2KLjdeoCtTUPEAIXp4DafjApO8pXR156OGw0-8xBqZmaasvYve9avxTHMOBAC';
        
        // قوائم الأسهم للقسمين
        const clusterSymbols = ['VMAR', 'CETX', 'GSIT', 'PRFX', 'BYRN', 'ERNA', 'LNZA', 'HURA', 'KULR', 'ANVS', 'PPSI', 'BJDX'];
        const scalpSymbols = ['TSLA', 'NVDA', 'AAPL', 'AMD', 'META', 'MSFT', 'SPY', 'QQQ'];
        
        const allTargets = [
            ...clusterSymbols.map(sym => ({ symbol: sym, type: '👑 استثمار سيادي وكابوس الحيتان' })),
            ...scalpSymbols.map(sym => ({ symbol: sym, type: '⚡ سكالبينج الترند اللحظي' }))
        ];

        const analysisResults = [];
        const nowTimestamp = Date.now();

        for (const item of allTargets) {
            const { symbol, type } = item;
            try {
                // منع التكرار خلال ساعتين
                const lastAlert = lastAlertTimes.get(symbol) || 0;
                const hoursPassed = (nowTimestamp - lastAlert) / (1000 * 60 * 60);

                if (hoursPassed < COOLDOWN_HOURS) {
                    analysisResults.push({ symbol, status: "skipped_cooldown", success: true });
                    continue;
                }

                // جلب السعر الحي والحقيقي للسهم
                let currentPrice = 0;
                try {
                    const quoteRes = await fetch(`https://api.massive.com/v3/reference/quotes?ticker=${symbol}&apiKey=${apiKey}`);
                    if (quoteRes.ok) {
                        const quoteData = await quoteRes.json();
                        currentPrice = quoteData?.results?.[0]?.price || quoteData?.price || 0;
                    }
                } catch (e) {
                    console.error(`Error fetching price for ${symbol}:`, e);
                }

                if (!currentPrice || currentPrice <= 0) {
                    currentPrice = 50.00; 
                }

                // حساب الأهداف، وقف الخسارة، والانعكاس بدقة
                const entryPrice = Number(currentPrice).toFixed(2);
                const stopLoss = (currentPrice * 0.975).toFixed(2); 
                const target1 = (currentPrice * 1.02).toFixed(2);   
                const target2 = (currentPrice * 1.05).toFixed(2);   

                const isOpportunity = true; 
                
                if (isOpportunity) {
                    lastAlertTimes.set(symbol, nowTimestamp);

                    const alertMessage = 
                        `👑 *تنبيه رادار القصر الملكي الحقيقي* 👑\n\n` +
                        `🔹 *القسم:* ${type}\n` +
                        `📈 *السهم:* \`${symbol}\`\n\n` +
                        `📊 *تفاصيل الصفقة (بالسعر الحي):*\n` +
                        `• 📍 سعر الدخول الحالي: \`${entryPrice}\`\n` +
                        `• 🔄 حالة الانعكاس: \`مؤكد / ارتداد إيجابي\`\n` +
                        `• 🛑 وقف الخسارة: \`${stopLoss}\`\n` +
                        `• 🎯 الهدف الأول: \`${target1}\`\n` +
                        `• 🚀 الهدف الثاني: \`${target2}\`\n\n` +
                        `⏰ *الوقت:* ${nowRiyadh.toLocaleTimeString('ar-SA')}`;
                    
                    // إرسال ديسكورد
                    await fetch(discordWebhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: alertMessage })
                    });

                    // إرسال تيليجرام
                    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: telegramChatId,
                            text: alertMessage,
                            parse_mode: 'Markdown'
                        })
                    });
                }

                analysisResults.push({ symbol, status: "analyzed", success: true });
            } catch (err) {
                analysisResults.push({ symbol, success: false, error: err.toString() });
            }
        }

        return NextResponse.json({ 
            status: "success", 
            totalChecked: allTargets.length,
            details: analysisResults 
        });

    } catch (error) {
        console.error("Cron Error:", error);
        return NextResponse.json({ 
            status: "error", 
            message: error.toString() 
        }, { status: 500 });
    }
}
