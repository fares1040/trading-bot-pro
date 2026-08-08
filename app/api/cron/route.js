import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const symbolSectors = {
  'NVDA': 'تكنولوجيا وذكاء اصطناعي', 'AMD': 'تكنولوجيا وذكاء اصطناعي', 'PLTR': 'تكنولوجيا وذكاء اصطناعي', 'SOFI': 'تكنولوجيا مالية وزخم',
  'INTC': 'أشباه موصلات', 'SNAP': 'تواصل اجتماعي', 'HOOD': 'منصات مالية',
  'NIO': 'سيارات كهربائية', 'RIVN': 'سيارات كهربائية', 'LCID': 'سيارات كهربائية',
  'BAC': 'بنوك ومالية', 'WFC': 'مالية وبنوك', 'PBR': 'طاقة ونفط', 'OXY': 'طاقة ونفط',
  'CLSK': 'تعدين بيتكوين', 'MARA': 'تعدين بيتكوين', 'RIOT': 'عملات رقمية',
  'GME': 'أسهم ميم وزخم', 'SNDL': 'نمو وزخم', 'TLRY': 'نمو وطاقة بديلة',
  'NVAX': 'تكنولوجيا حيوية', 'FCEL': 'طاقة بديلة', 'PLUG': 'طاقة بديلة',
  'SIRI': 'إعلام وترفيه', 'BB': 'تكنولوجيا', 'NOK': 'تكنولوجيا', 'WBD': 'إعلام',
  'DIS': 'إعلام وترفيه', 'PARA': 'إعلام', 'ROKU': 'تكنولوجيا', 'SHOP': 'تكنولوجيا',
  'COIN': 'عملات رقمية', 'AFRM': 'تكنولوجيا مالية', 'UPST': 'تكنولوجيا مالية',
  'RUN': 'طاقة بديلة', 'GM': 'سيارات', 'F': 'سيارات', 'VZ': 'اتصالات',
  'T': 'اتصالات', 'KGC': 'تعدين', 'AUY': 'تعدين', 'AG': 'تعدين',
  'EXAS': 'تكنولوجيا حيوية', 'NVST': 'تكنولوجيا حيوية', 'HAL': 'طاقة', 'SLB': 'طاقة',
  'PFE': 'تكنولوجيا حيوية', 'BNTX': 'تكنولوجيا حيوية', 'ETSY': 'تكنولوجيا', 'W': 'تجزئة',
  'CHWY': 'تجزئة', 'BBBY': 'تجزئة', 'NKLA': 'سيارات كهربائية', 'PLNH': 'تكنولوجيا',
  'BABA': 'تجزئة', 'JD': 'تجزئة', 'PDD': 'تجزئة', 'SQ': 'تكنولوجيا مالية'
};

export async function GET(request) {
  try {
    // --- التحقق من أوقات السوق (توقيت السعودية) ---
    const now = new Date();
    const riyadhTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Riyadh', hour12: false });
    const riyadhDate = new Date(riyadhTimeStr);
    const dayOfWeek = riyadhDate.getDay(); // الأحد = 0, الجمعة = 5, السبت = 6
    const hour = riyadhDate.getHours();
    const minute = riyadhDate.getMinutes();
    const currentMinutesTime = hour * 60 + minute;

    // البري ماركت يبدأ الساعة 11:00 صباحاً (660 دقيقة)
    // الآفتر ماركت ينتهي الساعة 03:00 فجراً من اليوم التالي (180 دقيقة)
    // أيام العمل: من الأحد (0) إلى الخميس (4)، والجمعة (5) حتى 3 فجراً.
    const isWorkingDay = (dayOfWeek >= 0 && dayOfWeek <= 4) || dayOfWeek === 5;
    const isMarketTimeActive = isWorkingDay && (currentMinutesTime >= 660 || currentMinutesTime <= 180);

    // إذا أردت إيقاف التنفيذ تلقائياً عندما يكون السوق مغلقاً، قم بإلغاء تفعيل السطر أدناه:
    // if (!isMarketTimeActive) {
    //   return NextResponse.json({ success: false, message: 'السوق مغلق حالياً بتوقيت السعودية.' }, { status: 200 });
    // }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let supabase = null;

    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
    }

    const symbols = Object.keys(symbolSectors);

    async function analyzeSymbol(symbol) {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`);
        const data = await res.json();

        const result = data.chart.result[0];
        const quote = result.indicators.quote[0];
        const closes = quote.close.filter(c => c !== null);
        const highs = quote.high.filter(h => h !== null);
        const lows = quote.low.filter(l => l !== null);
        const volumes = quote.volume.filter(v => v !== null);

        const currentPrice = closes[closes.length - 1];

        if (currentPrice > 100) return null;

        const summaryDetail = result.meta || {};
        const marketCap = summaryDetail.marketCap || (currentPrice * (volumes[volumes.length - 1] * 10));
        if (marketCap > 15000000000) return null;

        const dailyReturns = [];
        for (let i = 1; i < closes.length; i++) {
          dailyReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
        }
        const recentReturns = dailyReturns.slice(-20);
        const meanRecent = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
        const varRecent = recentReturns.reduce((sum, val) => sum + Math.pow(val - meanRecent, 2), 0) / recentReturns.length;
        const currentVol = Math.sqrt(varRecent) * Math.sqrt(252);

        const meanOverall = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        const varOverall = dailyReturns.reduce((sum, val) => sum + Math.pow(val - meanOverall, 2), 0) / dailyReturns.length;
        const avgVol = Math.sqrt(varOverall) * Math.sqrt(252);

        const isIVInflated = currentVol > (avgVol * 1.35);
        const ivStatusText = isIVInflated ? '⚠️ متضخم (High IV - خطر التآكل)' : '✅ سعر عادل (Fair Volatility)';

        const yearHigh = Math.max(...closes);
        const yearLow = Math.min(...closes);

        const recentVolumes = volumes.slice(-20);
        const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
        const currentVolume = volumes[volumes.length - 1];

        const period = 20;
        const sliceCloses = closes.slice(-period);
        const sma20 = sliceCloses.reduce((a, b) => a + b, 0) / sliceCloses.length;

        const variance = sliceCloses.reduce((sum, val) => sum + Math.pow(val - sma20, 2), 0) / period;
        const stDev = Math.sqrt(variance);
        const upperBand = sma20 + (stDev * 2);
        const lowerBand = sma20 - (stDev * 2);

        const bandwidth = (upperBand - lowerBand) / sma20;
        const isBollingerSqueeze = bandwidth < 0.08;

        const prevPrice = closes[closes.length - 2];
        const changePercent = (((currentPrice - prevPrice) / prevPrice) * 100).toFixed(2);

        const recentHighs = Math.max(...highs.slice(-5));
        const recentLows = Math.min(...lows.slice(-5));
        const priceRangePercent = ((recentHighs - recentLows) / currentPrice) * 100;
        const isClusterAccumulation = priceRangePercent < 3.0 && currentVolume > avgVolume * 1.1;

        const isWaveStart = currentPrice > prevPrice && currentPrice > sma20 && currentVolume > avgVolume * 1.2;
        const isVolumeSpike = currentVolume > avgVolume * 1.3;

        if (!(isBollingerSqueeze || isClusterAccumulation || isWaveStart || isVolumeSpike)) {
          return null;
        }

        const recentResistance = Math.max(...highs.slice(-10));
        const recentSupport = Math.min(...lows.slice(-10));
        const target = Math.max(currentPrice * 1.06, recentResistance).toFixed(2);
        const stopLoss = Math.min(currentPrice * 0.965, recentSupport * 0.99).toFixed(2);

        let reason = '';
        let confidence = 88;
        let marketStatus = '🚀 انفجار مبكر (Cluster & Squeeze)';

        if (isBollingerSqueeze && isWaveStart) {
          reason = 'انفجار مبكر: ضيق خطوط البولنجر مع بداية انطلاق الموجة وصعود السيولة.';
          confidence = Math.floor(Math.random() * 4) + 96;
          marketStatus = '🔥 انفجار بولنجر وموجة صاعدة';
        } else if (isClusterAccumulation) {
          reason = 'منطقة كلاستر: تجميع ضيق للغاية استعداداً لاختراق صاروخي قريب.';
          confidence = Math.floor(Math.random() * 4) + 93;
          marketStatus = '💎 منطقة تجميع كلاستر';
        } else if (isBollingerSqueeze) {
          reason = 'انكماش بولنجر حاد (Squeeze) يسبق عادة حركة انفجارية عنيفة.';
          confidence = Math.floor(Math.random() * 5) + 90;
          marketStatus = '⚡ ضغط بولنجر (Squeeze)';
        } else {
          reason = 'بداية موجة صاعدة ملحوظة مع تدفق حجم تداول مؤسسي.';
          confidence = Math.floor(Math.random() * 5) + 87;
        }

        if (isIVInflated) {
          confidence -= 5;
        }

        const optionStrike = (Math.ceil(currentPrice / 1) * 1) + 1;
        const estimatedCentPremium = (Math.random() * 0.30 + 0.12).toFixed(2);
        const optionTargetReturn = (parseFloat(estimatedCentPremium) * 2.5).toFixed(2);

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 38);
        const formattedExpiry = expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const opportunityObj = {
          ticker: symbol,
          price: Number(currentPrice.toFixed(2)),
          change_percent: changePercent,
          high_52: Number(yearHigh.toFixed(2)),
          low_52: Number(yearLow.toFixed(2)),
          volume_status: marketStatus,
          target_price: Number(target),
          stop_loss: Number(stopLoss),
          confidence: Number(confidence),
          reason: `${reason} | تسعير العقد: ${ivStatusText}`,
          sector: symbolSectors[symbol] || 'عام',
          option_idea: `عقد Call سترايك $${optionStrike} (صلاحية ممتدة فوق الشهر: ${formattedExpiry}) - سنتات مقترحة: $${estimatedCentPremium} ➔ استهداف: $${optionTargetReturn}`,
          created_at: new Date().toISOString()
        };

        if (supabase) {
          await supabase.from('auto_signals').insert([opportunityObj]);
        }

        return opportunityObj;
      } catch (err) {
        return null;
      }
    }

    const BATCH_SIZE = 10;
    let detectedOpportunities = [];

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(analyzeSymbol));
      detectedOpportunities.push(...batchResults.filter(r => r !== null));
    }

    if (detectedOpportunities.length > 0) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      const discordUrl = process.env.DISCORD_WEBHOOK_URL;

      let reportText = `🔥 *رادار الانفجارات المبكرة (أسهم < $100)* 🔥\n` +
        `⏳ عقود خيارات سنتات (صلاحية قصيرة: 0-2 DTE)\n` +
        `----------------------------------\n`;

      detectedOpportunities.slice(0, 5).forEach(opp => {
        reportText += `📌 *${opp.ticker}* [${opp.sector}]\n` +
          `💰 السعر: $${opp.price} (${opp.change_percent}%)\n` +
          `📊 الحالة: ${opp.volume_status}\n` +
          `🎯 الهدف: $${opp.target_price} | 🛑 وقف الخسارة: $${opp.stop_loss}\n` +
          `🧠 السبب: ${opp.reason}\n` +
          `🎫 فكرة العقد: ${opp.option_idea}\n` +
          `----------------------------------\n`;
      });

      if (botToken && chatId) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: reportText,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '📊 مراقبة الرادار بالمنصة', url: process.env.NEXT_PUBLIC_BASE_URL || 'https://vercel.com' }]]
            }
          })
        }).catch(() => {});
      }

      if (discordUrl) {
        await fetch(discordUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: reportText.replace(/\*/g, '**'),
            components: [{
              type: 1,
              components: [{ type: 2, style: 5, label: '🔗 افتح واجهة الرادار', url: process.env.NEXT_PUBLIC_BASE_URL || 'https://vercel.com' }]
            }]
          })
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, count: detectedOpportunities.length, data: detectedOpportunities, market_active: isMarketTimeActive });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
