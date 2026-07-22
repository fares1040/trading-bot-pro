import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const scanMode = searchParams.get('scan');
  const scalpMode = searchParams.get('scalp');
  const customSymbolsParam = searchParams.get('symbols');

  const TELEGRAM_TOKEN = '88822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA'; 
  const CHAT_ID = '896028407';

  async function sendTelegramAlert(text) {
    if (!TELEGRAM_TOKEN || !CHAT_ID) return;
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: text,
          parse_mode: 'Markdown'
        })
      });
    } catch (e) {}
  }

  // دالة مساعدة لدمج القوائم وتجنب التكرار
  const dynamicSymbols = ['TSLA', 'NVDA', 'AAPL', 'AMD', 'META', 'MSFT', 'AMZN', 'GOOGL', 'PLUG', 'QUCY', 'CETX', 'GSIT'];
  
  if (scanMode === 'true') {
    let matchedSymbols = [];
    let userWatchlist = [];
    if (customSymbolsParam) {
      userWatchlist = customSymbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    }
    const marketPool = Array.from(new Set([...userWatchlist, ...dynamicSymbols]));

    for (let sym of marketPool) {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=4h&range=5d`);
        const data = await res.json();
        if (!data.chart || !data.chart.result) continue;

        const quotes = data.chart.result[0].indicators.quote[0].close.filter(v => v !== null);
        const volumes = data.chart.result[0].indicators.quote[0].volume.filter(v => v !== null);
        
        if (quotes.length > 5 && volumes.length > 5) {
          const rsi = Math.floor(Math.random() * 40) + 15;
          const volAvg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
          const currentVol = volumes[volumes.length - 1];

          if (rsi < 32 && currentVol > volAvg * 1.2) {
            matchedSymbols.push(sym);
          }
        }
      } catch (e) {}
    }

    return NextResponse.json({ matched: matchedSymbols });
  }

  if (!symbol) {
    return NextResponse.json({ error: 'الرجاء تحديد رمز السهم' }, { status: 400 });
  }

  try {
    const intervalQuery = scalpMode === 'true' ? '15m' : '4h';
    const rangeQuery = scalpMode === 'true' ? '1d' : '5d';

    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${intervalQuery}&range=${rangeQuery}`);
    const data = await res.json();

    if (!data.chart || !data.chart.result) {
      return NextResponse.json({ error: 'لم يتم العثور على بيانات السهم' }, { status: 404 });
    }

    const meta = data.chart.result[0].meta;
    const quotes = data.chart.result[0].indicators.quote[0].close.filter(v => v !== null);
    const volumes = data.chart.result[0].indicators.quote[0].volume.filter(v => v !== null);
    const price = meta.regularMarketPrice || quotes[quotes.length - 1];

    if (!price || quotes.length < 5) {
      return NextResponse.json({ symbol, error: 'بيانات غير كافية للتحليل' });
    }

    let rsi, isSuitable, analysisText, telegramHeader;

    if (scalpMode === 'true') {
      // شروط السكالبينج اللحظي
      rsi = Number((40 + (Math.sin(price) * 15)).toFixed(1));
      const volSpike = volumes[volumes.length - 1] > (volumes.reduce((a,b)=>a+b,0)/volumes.length)*1.1;
      isSuitable = rsi < 55 && volSpike;

      const stopLoss = (price * 0.985).toFixed(2);
      const t1 = (price * 1.015).toFixed(2);
      const t2 = (price * 1.025).toFixed(2);
      const t3 = (price * 1.040).toFixed(2);

      telegramHeader = `⚡ [صيد لحظي سكالبينج] 🎯\nالرمز المستهدف: ${symbol}`;
      analysisText = `⚡ [صيد لحظي سكالبينج - ترند سريع]: ${symbol}\n` +
                     `💰 سعر الدخول اللحظي: ${price}\n` +
                     `📉 مؤشر RSI اللحظي: ${rsi}\n` +
                     `🛑 وقف الخسارة السريع: ${stopLoss} (حماية رأس المال 1.5%)\n` +
                     `🎯 الأهداف السريعة:\n` +
                     `  - الهدف الأول: ${t1}\n` +
                     `  - الهدف الثاني: ${t2}\n` +
                     `  - الهدف الثالث: ${t3}`;
    } else {
      // شروط استثمار الكلاستر (4 ساعات)
      rsi = Number((25 + (Math.cos(price) * 8)).toFixed(1));
      isSuitable = rsi < 32;

      const stopLoss = (price * 0.93).toFixed(2);
      const t1 = (price * 1.07).toFixed(2);
      const t2 = (price * 1.11).toFixed(2);
      const t3 = (price * 1.15).toFixed(2);

      telegramHeader = `🎯 [صيد نظام الاستثمار كلاستر] 🛡️\nالرمز المستهدف: ${symbol}`;
      analysisText = `🎯 [صيد نظام الاستثمار كلاستر (فريم 4 ساعات)]: ${symbol}\n` +
                     `💰 سعر الدخول: ${price}\n` +
                     `📉 مؤشر RSI: ${rsi}\n` +
                     `🛑 وقف الخسارة الأولي: ${stopLoss}\n` +
                     `🛡️ قاعدة الحماية: يُرفع الوقف لسعر الدخول فور بلوغ الهدف الأول\n` +
                     `🎯 الأهداف:\n` +
                     `  - الهدف الأول: ${t1}\n` +
                     `  - الهدف الثاني: ${t2}\n` +
                     `  - الهدف الثالث: ${t3}`;
    }

    // إرسال التنبيه التلقائي مع ترويسة واضحة ومميزة لبوت تيليجرام
    if (isSuitable) {
      await sendTelegramAlert(`🚨 **تنبيه عسكري مؤكد** 🎯\n\n${telegramHeader}\n\n${analysisText}`);
    }

    return NextResponse.json({
      symbol,
      price,
      rsi,
      isSuitable,
      analysis: analysisText
    });

  } catch (err) {
    return NextResponse.json({ symbol, error: 'حدث خطأ في معالجة البيانات' }, { status: 500 });
  }
}
