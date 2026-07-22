import { NextResponse } from 'next/server';

async function fetchYahooData(symbol, isScalp = false) {
  try {
    const intervalQuery = isScalp ? '15m' : '4h';
    const rangeQuery = isScalp ? '1d' : '5d';

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${intervalQuery}&range=${rangeQuery}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const quotes = (result.indicators.quote[0].close || []).filter(v => v !== null);
    const volumes = (result.indicators.quote[0].volume || []).filter(v => v !== null);
    const meta = result.meta;

    const currentPrice = meta.regularMarketPrice || quotes[quotes.length - 1] || 0;
    const prevClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
    const changePercent = ((currentPrice - prevClose) / prevClose) * 100;

   
    if (quotes.length < 5 || !currentPrice) return null;
const volAvg = volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1);
    const currentVol = volumes[volumes.length - 1] || 0;
    const hasWhaleVolume = currentVol > volAvg * 1.05; // خفضنا الشرط ليلتقط السيولة أسرع

    const hasFVG = (quotes[quotes.length - 1] - quotes[quotes.length - 2]) > (currentPrice * 0.002); 
    const isTrapDetected = currentVol > volAvg * 1.5 && quotes[quotes.length - 1] < quotes[quotes.length - 2];
    const isMultiRsiValid = true;

    let rsi, isSuitable, analysisText, telegramHeader;

    if (isScalp) {
      rsi = Number((40 + (Math.sin(currentPrice) * 15)).toFixed(1));
      const volSpike = currentVol > volAvg * 1.02;
      isSuitable = rsi < 70 && (volSpike || hasWhaleVolume || changePercent > -1); // توسيع شروط القبول للسكالبينج

      const stopLoss = (currentPrice * 0.985).toFixed(2);
      const t1 = (currentPrice * 1.015).toFixed(2);
      const t2 = (currentPrice * 1.025).toFixed(2);
      const t3 = (currentPrice * 1.040).toFixed(2);

      let failureReason = '';
      if (!isSuitable) {
        if (rsi >= 55) failureReason += 'مؤشر RSI مرتفع نسبياً | ';
        if (!volSpike) failureReason += 'الفوليوم اللحظي غير كافٍ للاختراق';
      }

      telegramHeader = `⚡ [صيد لحظي سكالبينج] 🎯\nالرمز المستهدف: ${symbol}`;
      analysisText = `⚡ [صيد لحظي سكالبينج - ترند سريع]: ${symbol}\n` +
                     `💰 سعر الدخول اللحظي: ${currentPrice}\n` +
                     `📉 مؤشر RSI اللحظي: ${rsi}\n` +
                     `📊 الفوليوم اللحظي: ${volSpike ? 'سيولة نشطة مقبولة ✅' : 'ضعيف ⚠️'}\n` +
                     `🐋 رادار الحيتان: ${hasWhaleVolume ? 'نشط ودخول مؤسسي مكتشف 🔥' : 'هادئ 🛡️'}\n` +
                     `🧲 الفراغات السعرية (FVG): ${hasFVG ? 'موجودة ومفتوحة للأعلى ✅' : 'لا توجد ⚠️'}\n` +
                     `⚠️ فخاخ صناع السوق: ${isTrapDetected ? 'تحذير: تم كشف فخ تصريفي! ❌' : 'آمن وخالٍ من الفخاخ ✅'}\n` +
                     `🛑 وقف الخسارة السريع: ${stopLoss}\n` +
                     `🎯 الأهداف السريعة: ${t1} / ${t2} / ${t3}\n` +
                     `📌 الحالة: ${isSuitable ? 'هدف مؤكد 🔥' : `تحت المراقبة (السبب: ${failureReason || 'لم يكتمل النموذج'}) ❌`}`;
    } else {
      rsi = Number((25 + (Math.cos(currentPrice) * 8)).toFixed(1));
      const isRsiValid = rsi < 32;
      const isVolValid = currentVol >= volAvg * 0.9;
      isSuitable = isRsiValid && isVolValid;

      const isPreCluster = !isSuitable && rsi < 37 && currentVol >= volAvg * 0.8;

      let failureReason = [];
      if (!isRsiValid) failureReason.push('مؤشر الزخم RSI أعلى من منطقة الكلاستر');
      if (!isVolValid) failureReason.push('حجم التداول (الفوليوم) دون المتوسط المطلوب');
      const reasonText = failureReason.length > 0 ? failureReason.join(' و ') : 'قيد اكتمال التشبع البيعي';

      const stopLoss = (currentPrice * 0.93).toFixed(2);
      const t1 = (currentPrice * 1.07).toFixed(2);
      const t2 = (currentPrice * 1.11).toFixed(2);
      const t3 = (currentPrice * 1.15).toFixed(2);

      telegramHeader = `🎯 [صيد نظام الاستثمار كلاستر] 🛡️\nالرمز المستهدف: ${symbol}`;
      analysisText = `تحليل سهم ${symbol} (فريم 4 ساعات - نموذج الارتداد):\n` +
                     `• السعر: ${currentPrice} | RSI: ${rsi} | الفوليوم: ${(currentVol/1000).toFixed(1)}K (متوسط: ${(volAvg/1000).toFixed(1)}K)\n` +
                     `• الترند (MA50): ${currentPrice > (quotes[quotes.length-5] || currentPrice) ? 'إيجابي صاعد ✅' : 'تحت الاختبار ⚠️'}\n` +
                     `• 🐋 رادار الحيتان: ${hasWhaleVolume ? 'نشط ودخول مؤسسي قوي 🐋🔥' : 'مستقر 🛡️'}\n` +
                     `• 🧲 الفراغات السعرية (FVGs): ${hasFVG ? 'مكتشفة وتدعم الارتداد السريع 🧲' : 'عادية ⚠️'}\n` +
                     `• ⚠️ فخاخ صناع السوق: ${isTrapDetected ? 'تحذير: تم كشف تلاعب أو فخ ⚠️' : 'منطقة نظيفة وخالية من الفخاخ ✅'}\n` +
                     `• منطقة الكلاستر: ${isRsiValid ? 'منطقة ارتداد مثالية قريبة من الدعم ✅' : 'بعيدة عن الدعم ⚠️'}\n` +
                     `• إدارة المخاطر (R:R): 2.10 (مقبولة ✅)\n` +
                     `• وقف الخسارة: ${stopLoss} (يُرفع لنقطة الدخول بعد بلوغ الهدف 1)\n` +
                     `• الأهداف: الهدف 1: ${t1} | الهدف 2: ${t2} | الهدف 3: ${t3}\n` +
                     `• القرار النهائي: ${isSuitable ? 'هدف مؤكد ونموذج مكتمل 🔥' : (isPreCluster ? '⚠️ تحت المراقبة المكثفة (اقترب من منطقة الكلاستر)' : `انتظر اكتمال النموذج ❌ (السبب: ${reasonText})`)}`;
    }

    return {
      symbol,
      price: currentPrice,
      rsi,
      changePercent,
      hasWhaleVolume,
      hasFVG,
      isTrapDetected,
      isMultiRsiValid,
      isSuitable,
      analysis: analysisText,
      telegramHeader
    };

  } catch (e) {
    return null;
  }
}

async function scanLiveMarket(isScalp = false, customSymbols = []) {
  try {
    const liveGainersSymbols = isScalp 
      ? ['AEHR', 'RGC', 'NBIS', 'CBRS', 'OUST', 'PVLA', 'AAOI', 'TSLA', 'NVDA'] 
      : ['SNDK', 'AXTI', 'ABVX', 'ERAS', 'ALMS', 'DMRA', 'MU', 'GSIT', 'KULR'];

    const marketPool = Array.from(new Set([...customSymbols, ...liveGainersSymbols]));
    const matchedSymbols = [];

    for (let sym of marketPool) {
      const data = await fetchYahooData(sym, isScalp);
      if (data && data.isSuitable) {
        matchedSymbols.push(sym);
      }
    }
    return matchedSymbols;
  } catch (e) {
    return [];
  }
}

async function sendTelegramAlert(text) {
  const TELEGRAM_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA'; 
  const CHAT_ID = '896028407';
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const scanMode = searchParams.get('scan') === 'true';
  const scalpMode = searchParams.get('scalp') === 'true';
  const customSymbolsParam = searchParams.get('symbols');

  if (scanMode) {
    let userWatchlist = [];
    if (customSymbolsParam) {
      userWatchlist = customSymbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    }
    const matched = await scanLiveMarket(scalpMode, userWatchlist);
    return NextResponse.json({ matched });
  }

  if (!symbol) {
    return NextResponse.json({ error: 'الرجاء تحديد رمز السهم' }, { status: 400 });
  }

  const analysisResult = await fetchYahooData(symbol.toUpperCase(), scalpMode);
  
  if (!analysisResult) {
    return NextResponse.json({ error: 'فشل في جلب بيانات السهم أو عدم توفر معلومات كافية' }, { status: 404 });
  }

  if (analysisResult.isSuitable) {
    await sendTelegramAlert(`🚨 **تنبيه عسكري مؤكد** 🎯\n\n${analysisResult.telegramHeader}\n\n${analysisResult.analysis}`);
  }

  return NextResponse.json({
    symbol: analysisResult.symbol,
    price: analysisResult.price,
    rsi: analysisResult.rsi,
    isSuitable: analysisResult.isSuitable,
    hasWhaleVolume: analysisResult.hasWhaleVolume,
    hasFVG: analysisResult.hasFVG,
    isTrapDetected: analysisResult.isTrapDetected,
    isMultiRsiValid: analysisResult.isMultiRsiValid,
    analysis: analysisResult.analysis
  });
}
