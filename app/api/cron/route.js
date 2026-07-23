import { NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const apiKey = 'txQ1pePWvQR7McsjPfZWBCYeDgNYNef8';
        const telegramToken = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
        const telegramChatId = '896028407';
        const discordWebhookUrl = 'https://discord.com/api/webhooks/1529947770612486345/gR0Qmu-2KLjdeoCtTUPEAIXp4DafjApO8pXR156OGw0-8xBqZmaasvYve9avxTHMOBAC';
        
        // 1. جلب الأسهم من المصدر الخارجي
        const stocksApiUrl = `https://api.massive.com/v3/reference/tickers?market=stocks&active=true&limit=10&apiKey=${apiKey}`;
        const stocksRes = await fetch(stocksApiUrl);
        
        if (!stocksRes.ok) {
            throw new Error(`External Stocks API failed with status: ${stocksRes.status}`);
        }

        const stocksData = await stocksRes.json();
        const resultsArray = stocksData.results || stocksData;
        const symbols = resultsArray.map(item => item.ticker || item.symbol).filter(Boolean);

        if (!symbols || symbols.length === 0) {
            return NextResponse.json({ status: "success", message: "No symbols found to analyze." });
        }

        const analysisResults = [];
        
        // 2. فحص الأسهم وإرسال التنبيهات في حال رصد الفرصة
        for (const symbol of symbols) {
            try {
                // محاكاة أو شرط الفحص الحقيقي
                const isOpportunity = true; // يتم ربطها لاحقاً بشروط التحليل الفعلية لديك
                
                if (isOpportunity) {
                    const alertMessage = `👑 تنبيه رادار كابوس الحيتان الملكي!\n\n🔹 تم رصد فرصة على السهم: ${symbol}\n⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}`;
                    
                    // إرسال تنبيه ديبرسود (Discord Webhook)
                    await fetch(discordWebhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: alertMessage })
                    });

                    // إرسال تنبيه تيليجرام (Telegram Bot)
                    const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
                    await fetch(telegramUrl, {
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
            totalAnalyzed: symbols.length,
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
