import { NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ذاكرة مؤقتة لتخزين وقت آخر تنبيه لكل سهم لمنع التكرار (Cooldown)
const lastAlertTimes = new Map();
const COOLDOWN_HOURS = 2; // منع تكرار التنبيه لنفس السهم لمدة ساعتين

export async function GET(request) {
    try {
        const apiKey = 'txQ1pePWvQR7McsjPfZWBCYeDgNYNef8';
        const telegramToken = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
        const telegramChatId = '896028407';
        const discordWebhookUrl = 'https://discord.com/api/webhooks/1529947770612486345/gR0Qmu-2KLjdeoCtTUPEAIXp4DafjApO8pXR156OGw0-8xBqZmaasvYve9avxTHMOBAC';
        
        // قوائم الأسهم للقسمين (الاستثمار السيادي + سكالبينج الترند)
        const clusterSymbols = ['VMAR', 'CETX', 'GSIT', 'PRFX', 'BYRN', 'ERNA', 'LNZA', 'HURA', 'KULR', 'ANVS', 'PPSI', 'BJDX'];
        const scalpSymbols = ['TSLA', 'NVDA', 'AAPL', 'AMD', 'META', 'MSFT', 'SPY', 'QQQ'];
        
        const allTargets = [
            ...clusterSymbols.map(sym => ({ symbol: sym, type: '👑 استثمار سيادي وكابوس الحيتان' })),
            ...scalpSymbols.map(sym => ({ symbol: sym, type: '⚡ سكالبينج الترند اللحظي' }))
        ];

        const analysisResults = [];
        const now = Date.now();

        for (const item of allTargets) {
            const { symbol, type } = item;
            try {
                // شرط منع التكرار بناءً على الوقت المحدد
                const lastAlert = lastAlertTimes.get(symbol) || 0;
                const hoursPassed = (now - lastAlert) / (1000 * 60 * 60);

                if (hoursPassed < COOLDOWN_HOURS) {
                    analysisResults.push({ symbol, status: "skipped_cooldown", success: true });
                    continue; // تخطي السهم لعدم مرور الوقت الكافي لتكرار التنبيه
                }

                // محاكاة أو فحص الشروط الفعلية للفرصة
                const isOpportunity = true; // ربطها لاحقاً بتحليل مؤشرات RSI أو الملاقط
                
                if (isOpportunity) {
                    // تحديث وقت آخر تنبيه لهذا السهم
                    lastAlertTimes.set(symbol, now);

                    const alertMessage = `👑 تنبيه رادار القصر الملكي!\n\n🔹 القسم: ${type}\n📈 السهم: ${symbol}\n⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}`;
                    
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
                            text: alertMessage
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
