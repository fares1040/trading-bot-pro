import { NextResponse } from 'next/server';

export async function GET(request) {
    const BOT_TOKEN = '8822034470:AAEBoovIt3tdkkQqt2lX86GZBwipYUq6MgA';
    const CHAT_ID = '896028407';
    const MIN_VOLUME = 100000;

    const myWatchList = ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI'];
    
    // استعلام البيانات
    for (const symbol of myWatchList) {
        try {
            const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m`);
            const data = await res.json();
            
            // تحقق من وجود البيانات لتفادي خطأ الـ Build
            if (!data.chart || !data.chart.result || data.chart.result.length === 0) continue;
            
            const meta = data.chart.result[0].meta;
            const price = meta.regularMarketPrice;
            const volume = meta.regularMarketVolume || 0;

            if (volume < MIN_VOLUME) continue;

            const t1 = (price * 1.03).toFixed(2);
            const t2 = (price * 1.05).toFixed(2);
            const t3 = (price * 1.08).toFixed(2);
            const stopLoss = (price * 0.97).toFixed(2);

            const message = `🚀 *سهم جديد: ${symbol}*
💰 السعر: ${price}
📉 *وقف الخسارة (SL): ${stopLoss}*
🎯 *الأهداف:* T1: ${t1} | T2: ${t2} | T3: ${t3}
📊 الفوليوم: ${volume.toLocaleString()}`;

            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(message)}&parse_mode=Markdown`);

        } catch (e) { continue; }
    }
    return NextResponse.json({ status: "done" });
}
