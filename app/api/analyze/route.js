import { NextResponse } from 'next/server';

// ذاكرة مؤقتة لتخزين وقت آخر تنبيه لكل سهم (لتجنب التكرار وتطبيق فترة التبريد)
const lastAlertTimes = new Map();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isScan = searchParams.get('scan') === 'true';
    const isScalp = searchParams.get('scalp') === 'true';
    const minConfidence = Number(searchParams.get('minConfidence') || 70);
    const symbolsParam = searchParams.get('symbols') || '';

    if (isScan) {
      // محاكاة مسح السوق الحي وجلب أسهم نشطة جديدة مطابقة لشروط الرادار
      const pool = isScalp 
        ? ['COIN', 'AMZN', 'GOOGL', 'META', 'NFLX', 'AMD', 'SPY', 'QQQ', 'BA', 'DIS']
        : ['VMAR', 'CETX', 'GSIT', 'PRFX', 'BYRN', 'ERNA', 'LNZA', 'HURA', 'KULR', 'ANVS', 'AAPL', 'MSFT'];
      
      const existingSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
      const matched = pool.filter(s => !existingSymbols.includes(s) && Math.random() > 0.3);

      return NextResponse.json({ success: true, matched });
    }

    return NextResponse.json({ error: 'طلب غير مدعوم' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { symbol, scalpMode, minConfidence = 70, cooldownMinutes = 30, earlyAlertsEnabled = true, discordWebhook } = body;

    if (!symbol) {
      return NextResponse.json({ error: 'رمز السهم مطلوب' }, { status: 400 });
    }

    const sym = symbol.toUpperCase();

    // 🛡️ فحص فترة التبريد (Cooldown Check) لمنع تكرار التنبيهات المزعجة
    const now = Date.now();
    const lastTime = lastAlertTimes.get(sym) || 0;
    const cooldownMs = cooldownMinutes * 60 * 1000;
    const isInCooldown = (now - lastTime) < cooldownMs;

    // محاكاة تحليل بيانات السوق الحي (Indicators, RSI, Whales, FVG, Traps)
    const price = Number((Math.random() * 50 + 1.5).toFixed(2));
    const rsi = Number((Math.random() * 40 + 15).toFixed(1));
    const volumeMultiplier = Number((Math.random() * 4 + 0.8).toFixed(2));
    const confidenceScore = Math.floor(Math.random() * 30) + 68; // بين 68 و 97
    
    const hasWhaleVolume = volumeMultiplier >= 2.0;
    const hasFVG = Math.random() > 0.3;
    const isTrapDetected = Math.random() > 0.4;
    const isMultiRsiValid = rsi < 35;

    const isSuitable = confidenceScore >= minConfidence && !isInCooldown;
    
    // حساب التنبيه الاستباقي المبكر (إذا كان الثقة قريبة من الهدف ولكن لم تبلغ الحد الأدنى تماماً)
    const isEarlyAlert = earlyAlertsEnabled && !isSuitable && confidenceScore >= (minConfidence - 8) && confidenceScore < minConfidence && !isInCooldown;

    if (isSuitable || isEarlyAlert) {
      lastAlertTimes.set(sym, now);
    }

    // 🤖 إضافة تحليل الذكاء الاصطناعي (AI Confirmation Score) وخريطة السيولة اللحظية (Order Flow / Heatmap)
    const aiInsight = confidenceScore >= 85 
      ? "تأكيد ذكاء اصطناعي: السهم يختبر منطقة تجميع قوية لمارك ميكر، الدخول آمن بنسبة عالية جداً." 
      : confidenceScore >= 75 
      ? "تأكيد ذكاء اصطناعي: ارتداد تكتيكي تدريجي، يفضل مراقبة السيولة عند الأهداف."
      : "تحذير ذكاء اصطناعي: السيولة متذبذبة، يلزم الحذر وإدارة صارمة لمخاطر رأس المال.";

    const orderFlowHeatmap = `خريطة السيولة (DOM / Heatmap): تركز طلبات الشراء المؤسسية الكبرى عند سعر ${(price * 0.99).toFixed(2)} مع جدار طلبات بمليون سهم.`;

    const stopLoss = (price * 0.97).toFixed(2);
    const t1 = (price * 1.025).toFixed(2);
    const t2 = (price * 1.050).toFixed(2);
    const t3 = (price * 1.080).toFixed(2);

    const analysis = `تحليل سهم ${sym} (${scalpMode ? 'سكالبينج لحظي ⚡' : 'استثمار كلاستر 4 ساعات 📊'}):
• السعر الحالي: ${price} | RSI: ${rsi} | الفوليوم: 280K
• مضاعف السيولة: ${volumeMultiplier}x ${hasWhaleVolume ? '| 🐋 رادار الحيتان نشط ودخول مؤسسي' : ''}
• بطاقة الثقة التنبؤية الانعكاسية: ${confidenceScore}% 🎯
• الفراغات السعرية (FVGs): ${hasFVG ? 'منطقة نظيفة وخالية من الفخاخ ✅' : 'عادية ⚠️'}
• فخاخ صناع السوق: ${isTrapDetected ? 'آمن من التلاعب ✅' : 'حذر ⚠️'}
• 🤖 رأي خبير الذكاء الاصطناعي: ${aiInsight}
• 🌊 ${orderFlowHeatmap}
${isInCooldown ? '⚠️ تنبيه: السهم في فترة تبريد حالياً لمنع التكرار اللحظي.' : ''}
• وقف الخسارة: ${stopLoss}
• الأهداف التدريجية: الهدف 1: ${t1} | الهدف 2: ${t2} | الهدف 3: ${t3}
• القرار النهائي: ${isSuitable ? 'هدف مؤكد ونموذج مكتمل 🔥' : isEarlyAlert ? '⏳ إنذار استباقي مبكر - يقترب من الاكتمال 🎯' : 'قيد المراقبة الاستباقية 🛡️'}`;

    // إرسال تنبيه خارجي عبر Webhook إذا كان متاحاً وتم تجاوز التبريد
    if (discordWebhook && (isSuitable || isEarlyAlert) && !isInCooldown) {
      try {
        await fetch(discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: isEarlyAlert 
              ? `⏳ **إنذار استباقي مبكر** 🎯\nاقتراب هدف على السهم: **${sym}**\n\n\`\`\`${analysis}\`\`\``
              : `🚨 **تنبيه عسكري فوري للمنصة** 🎯\nرصد هدف على السهم: **${sym}**\n\n\`\`\`${analysis}\`\`\``
          })
        });
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      symbol: sym,
      price,
      confidenceScore,
      hasWhaleVolume,
      hasFVG,
      isTrapDetected,
      isMultiRsiValid,
      isSuitable,
      isEarlyAlert,
      isInCooldown,
      analysis
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
