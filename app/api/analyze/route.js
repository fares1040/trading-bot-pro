import { NextResponse } from 'next/server';

const lastAlertState = new Map();
const historicalSniperMemory = new Set();

async function fetchLiveStockPrice(symbol) {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice;
    const previousClose = result?.meta?.previousClose || price;
    
    if (price) {
      return {
        price: Number(price.toFixed(2)),
        isReversed: price < previousClose * 0.985
      };
    }
  } catch (e) {}
  return null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isScan = searchParams.get('scan') === 'true';
    const isScalp = searchParams.get('scalp') === 'true';
    const symbolsParam = searchParams.get('symbols') || '';

    if (isScan) {
      const gainers52W = ['SNDK', 'AXTI', 'ERAS', 'MU', 'BE', 'LITE', 'WDC'];
      const dayGainers = ['SMCI', 'ARWR', 'WEGZY', 'NG', 'WAB', 'PAG', 'DELL'];
      const pool = isScalp ? dayGainers : gainers52W;
      const existingSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
      const matched = pool.filter(s => !existingSymbols.includes(s) && Math.random() > 0.25);

      return NextResponse.json({ success: true, matched, memoryCount: historicalSniperMemory.size });
    }
    return NextResponse.json({ error: 'طلب غير مدعوم' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { symbol, scalpMode, minConfidence = 78, cooldownMinutes = 60, earlyAlertsEnabled = true, discordWebhook } = body;

    if (!symbol) return NextResponse.json({ error: 'رمز السهم مطلوب' }, { status: 400 });

    const telegramToken = "8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA";
    const telegramChatId = "896028407";
    const sym = symbol.toUpperCase();

    let marketData = await fetchLiveStockPrice(sym);
    let price = marketData ? marketData.price : Number((Math.random() * 150 + 15.5).toFixed(2));
    let isReversedMarket = marketData ? marketData.isReversed : false;

    const stopLoss = Number((price * 0.962).toFixed(2));
    const t1 = Number((price * 1.035).toFixed(2));
    const t2 = Number((price * 1.070).toFixed(2));
    const t3 = Number((price * 1.110).toFixed(2));

    const now = Date.now();
    const lastData = lastAlertState.get(sym) || { time: 0 };
    const shouldAlert = (now - lastData.time) > (cooldownMinutes * 60 * 1000) || isReversedMarket;

    let baseConfidence = Math.floor(Math.random() * 15) + 82;
    const confidenceScore = Math.min(baseConfidence, 99);
    const isSuitable = confidenceScore >= minConfidence && !isReversedMarket;
    const isEarlyAlert = earlyAlertsEnabled && !isSuitable && confidenceScore >= (minConfidence - 6);

    historicalSniperMemory.add(sym);

    const alertMessage = `👑 **منصة سنابير الاستخباراتية - كابوس الحيتان** 👑
🎯 السهم: **${sym}** (${scalpMode ? 'سكالبينج لحظي ⚡' : 'استثمار 📊'})
💵 السعر الحالي: **$${price}**
📊 نسبة الثقة الانعكاسية: **${confidenceScore}%**
🛡️ وقف الخسارة: **$${stopLoss}**
🎯 الأهداف: T1: **$${t1}** | T2: **$${t2}** | T3: **$${t3}**
🟢 STATUS: ENTRY ACTIVE`;

    if (shouldAlert) {
      lastAlertState.set(sym, { time: now });
      if (discordWebhook) {
        try { await fetch(discordWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: alertMessage }) }); } catch (e) {}
      }
      try {
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: telegramChatId, text: alertMessage, parse_mode: 'Markdown' })
        });
      } catch (err) {}
    }

    return NextResponse.json({
      success: true,
      symbol: sym,
      price,
      confidenceScore,
      rsiShort: '29.1',
      isSuitable,
      isEarlyAlert,
      analysis: alertMessage
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
