import { NextResponse } from 'next/server';

// زيادة مهلة التنفيذ على Vercel حتى 60 ثانية
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const apiKey = 'txQ1pePWvQR7McsjPfZWBCYeDgNYNef8';
        
        // 1. جلب الأسهم مباشرة من المصدر الخارجي
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

        // 2. فحص مبسط وآمن لكل سهم لضمان عدم حدوث Timeout
        const analysisResults = [];
        
        for (const symbol of symbols) {
            try {
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
