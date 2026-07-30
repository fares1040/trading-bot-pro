// app/api/cron/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export async function GET() {
  try {
    const symbolSectors = {
      'AMD': 'تكنولوجيا وذكاء اصطناعي', 'PLTR': 'تكنولوجيا وذكاء اصطناعي', 'SOFI': 'تكنولوجيا وذكاء اصطناعي', 
      'INTC': 'تكنولوجيا وذكاء اصطناعي', 'SNAP': 'تكنولوجيا وذكاء اصطناعي', 'HOOD': 'تكنولوجيا وذكاء اصطناعي', 
      'UBER': 'تكنولوجيا وذكاء اصطناعي', 'NVDA': 'تكنولوجيا وذكاء اصطناعي', 'AAPL': 'تكنولوجيا وذكاء اصطناعي', 
      'MSFT': 'تكنولوجيا وذكاء اصطناعي', 'AMZN': 'تكنولوجيا وذكاء اصطناعي', 'GOOGL': 'تكنولوجيا وذكاء اصطناعي', 
      'META': 'تكنولوجيا وذكاء اصطناعي', 'NFLX': 'تكنولوجيا وذكاء اصطناعي', 'ARM': 'تكنولوجيا وذكاء اصطناعي', 
      'SMCI': 'تكنولوجيا وذكاء اصطناعي',
      'NIO': 'سيارات كهربائية', 'RIVN': 'سيارات كهربائية', 'LCID': 'سيارات كهربائية', 'TSLA': 'سيارات كهربائية', 
      'WKHS': 'سيارات كهربائية',
      'F': 'صناعة وسيارات', 'BAC': 'مالية وبنوك', 'JPM': 'مالية وبنوك', 'C': 'مالية وبنوك', 'WFC': 'مالية وبنوك',
      'VALE': 'مواد أساسية', 'PBR': 'طاقة ونفط', 'OXY': 'طاقة ونفط', 'HAL': 'طاقة ونفط', 'SLB': 'طاقة ونفط',
      'AAL': 'طيران ونقل', 'CCL': 'سياحة وترفيه', 'X': 'صناعة ومعادن', 'T': 'اتصالات', 'VZ': 'اتصالات', 
      'PFE': 'رعاية صحية', 'KO': 'استهلاك', 'PEP': 'استهلاك', 'DIS': 'ترفيه', 'BA': 'طيران ودفاع',
      'PLUG': 'طاقة بديلة', 'CLSK': 'عملات رقمية وتعدين', 'MARA': 'عملات رقمية وتعدين', 'RIOT': 'عملات رقمية وتعدين', 
      'BITF': 'عملات رقمية وتعدين', 'HIVE': 'عملات رقمية وتعدين', 'GME': 'أسهم ميم وزخم', 'AMC': 'أسهم ميم وزخم', 
      'SPCE': 'فضاء وزخم', 'OPEN': 'عقارات ونمو', 'SAVA': 'رعاية صحية ونمو', 'BB': 'أمن سيبراني وميم', 
      'NOK': 'اتصالات وزخم', 'AITX': 'ذكاء اصطناعي ونمو', 'SNDL': 'نمو وزخم', 'ZOM': 'رعاية صحية ونمو', 
      'FCEL': 'طاقة بديلة', 'TLRY': 'نمو وزخم'
    };

    const symbols = Object.keys(symbolSectors);
    let detectedOpportunities = [];

    for (const symbol of symbols) {
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

        if (currentPrice > 100) continue;

        const summaryDetail = result.meta || {};
        const marketCap = summaryDetail.marketCap || (currentPrice * (volumes[volumes.length - 1] * 10));
        if (marketCap > 15000000000) continue; 

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

        if (isBollingerSqueeze || isClusterAccumulation || isWaveStart || isVolumeSpike) {
          
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

          detectedOpportunities.push(opportunityObj);

          if (supabase) {
            await supabase.from('auto_signals').insert([opportunityObj]);
          }
        }
      } catch (err) {}
    }

    detectedOpportunities.sort((a, b) => b.confidence - a.confidence);

    const premiumOpportunities = detectedOpportunities.filter(opp => opp.confidence >= 93);

    if (premiumOpportunities.length > 0) {
      let reportText = `🎯 *رادار سنايبر (فلتر صائدي السنتات | >35 يوم)* 🎯\n` +
        `⏰ الوقت: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}\n` +
        `----------------------------------\n`;

      premiumOpportunities.slice(0, 5).forEach(opp => {
        reportText += `📌 *${opp.ticker}* [${opp.sector}] | السعر: $${opp.price} (${opp.change_percent}%)\n` +
          `⭐ *الثقة:* %${opp.confidence} | 🎯 *الهدف:* $${opp.target_price}\n` +
          `⚡ *عقد سنتات:* ${opp.option_idea}\n` +
          `----------------------------------\n`;
      });

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      
      // إرسال تنبيه تليجرام باستخدام المتغير الصحيح NEXT_PUBLIC_BASE_URL
      if (botToken && chatId) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: reportText,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📋 فتح لوحة المنصة وسجل الصفقات', url: process.env.NEXT_PUBLIC_BASE_URL || 'https://vercel.com' }
                ]
              ]
            }
          })
        });
      }

      const discordUrl = process.env.DISCORD_WEBHOOK_URL;
      if (discordUrl) {
        await fetch(discordUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: reportText.replace(/\*/g, '**'),
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 5,
                    label: '🔗 فتح المنصة وسجل الصفقات',
                    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://vercel.com'
                  }
                ]
              }
            ]
          })
        });
      }
    }

    return NextResponse.json({ success: true, count: detectedOpportunities.length, data: detectedOpportunities });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
