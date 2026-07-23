import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://trading-bot-pro-fw4.vercel.app';

        // 1. جلب قائمة الأسهم بذكاء
        const stocksRes = await fetch(`${baseUrl}/api/stocks`, { cache: 'no-store' });
        if (!stocksRes.ok) throw new Error(`Stocks API failed: ${stocksRes.status}`);

        const stocksData = await stocksRes.json();
        const symbols = stocksData?.data?.map(item => item.ticker) || [];

        if (symbols.length === 0) {
            return NextResponse.json({ status: "success", message: "No symbols found to analyze." });
        }

        // 2. تنفيذ التحليلات بشكل متزامن وسريع (لتفادي قيود الوقت في Vercel)
        const analysisPromises = symbols.map(async (symbol) => {
            try {
                const res = await fetch(`${baseUrl}/api/analyze?symbol=${symbol}`, { cache: 'no-store' });
                return { symbol, success: res.ok };
            } catch (err) {
                return { symbol, success: false, error: err.toString() };
            }
        });

        const results = await Promise.all(analysisPromises);

        return NextResponse.json({ 
            status: "success", 
            totalAnalyzed: symbols.length,
            details: results 
        });

    } catch (error) {
        return NextResponse.json({ 
            status: "error", 
            message: error.toString() 
        }, { status: 500 });
    }
}
