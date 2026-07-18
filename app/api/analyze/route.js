import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1m`);
        const data = await res.json();
        const meta = data.chart.result[0].meta;
        const price = meta.regularMarketPrice;
        const volume = meta.regularMarketVolume || 0;

        // الشروط المحددة: فوليوم فوق 100 ألف، وسعر بين 1 و 50
        const isEntrySuitable = volume > 100000 && price >= 1 && price <= 50; 

        const analysisText = `السهم: ${symbol.toUpperCase()}
السعر الحالي: ${price.toFixed(2)}
الفوليوم: ${volume.toLocaleString()}
الحالة: ${isEntrySuitable ? "مناسب للدخول ✅" : "انتظر السيولة أو تحقق من السعر ⏳"}`;

        return NextResponse.json({
            symbol: symbol.toUpperCase(),
            currentPrice: price.toFixed(2),
            analysis: analysisText,
            isSuitable: isEntrySuitable
        });
    } catch (error) {
        return NextResponse.json({ error: "فشل" }, { status: 500 });
    }
}
