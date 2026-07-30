// app/api/swing/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export async function GET() {
  try {
    // قائمة أسهم السوينق المستهدفة (تحت 100$)
    const symbolSectors = {
      'AMD': 'تكنولوجيا وذكاء اصطناعي', 'PLTR': 'تكنولوجيا وذكاء اصطناعي', 'SOFI': '핀테크 وزخم', 
      'INTC': 'أشباه موصلات', 'SNAP': 'تواصل اجتماعي', 'HOOD': 'منصات مالية', 
      'NIO': 'سيارات كهربائية', 'RIVN': 'سيارات كهربائية', 'LCID': 'سيارات كهربائية',
      'BAC': 'بنوك ومالية', 'WFC': 'مالية وبنوك', 'PBR': 'طاقة ونفط', 'OXY': 'طاقة ونفط', 
      'CLSK': 'تعدين بيتكوين', 'MARA': 'تعدين بيتكوين', 'RIOT': 'عملات رقمية',
      'GME': 'أسهم ميم وزخم', 'SNDL': 'نمو وزخم', 'TLRY': 'نمو وطاقة بديلة'
    };

    const symbols = Object.keys(symbolSectors);
    let swingOpportunities = [];

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

        // 🛑 الشرط الأساسي: السعر تحت 100 دولار
        if (currentPrice >= 100) continue;

        const prevPrice = closes[closes.length - 2];
        const changePercent = (((currentPrice - prevPrice) / prevPrice) * 100).toFixed(2);
        const currentVolume = volumes[volumes.length - 1];
        
        // حساب المتوسطات والدعوم لإيجاد الكلاستر والبولنجر
        const period = 20;
        const sliceCloses = closes.slice(-period);
        const sma20 = sliceCloses.reduce((a, b) => a + b, 0) / sliceCloses.length;
        const variance = sliceCloses.reduce((sum, val) => sum + Math.pow(val - sma20, 2), 0) / period;
        const stDev = Math.sqrt(variance);
        
        const upperBand = sma20 + (stDev * 2);
        const lowerBand = sma20 - (stDev * 2);
        const bandwidth = (upperBand - lowerBand) / sma20;

        // 1. شرط ضغط البولنجر للسوينق
        const isBollingerSqueeze = bandwidth < 0.09;

        // 2. شرط منطقة الكلاستر (تجميع ضيق آخر 5 أيام)
        const recentHighs5 = Math.max(...highs.slice(-5));
        const recentLows5 = Math.min(...lows.slice(-5));
        const isCluster = ((recentHighs5 - recentLows5) / currentPrice) * 100 < 3.5;

        // 3. محاكاة اختراق منطقة الجاما (مستوى نفسي مدور + سيولة عالية)
        const nextRoundNumber = Math.ceil(currentPrice / 5) * 5; 
        const distanceToGammaWall = ((nextRoundNumber - currentPrice) / currentPrice) * 100;
        const avgVolume20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const isGammaBreakout = distanceToGammaWall < 1.5 && currentVolume > avgVolume20 * 1.25;

        // التحقق من انطباق شروط السوينق
        if (isBollingerSqueeze || isCluster || isGammaBreakout) {
          
          // 🎯 حساب الأهداف الديناميكية ووقف الخسارة المتحرك
          const structuralSupport = Math.min(...lows.slice(-15));
          const structuralResistance = Math.max(...highs.slice(-15));

          // وقف الخسارة الديناميكي (تحت الدعم الهيكلي بـ 1%)
          const dynamicStopLoss = (structuralSupport * 0.99).toFixed(2);
          
          // الهدف الأول (تأمين أرباح السوينق عند المقاومة القريبة)
          const target1 = Math.max(currentPrice * 1.05, structuralResistance).toFixed(2);
          
          // الهدف الثاني السوينقي الممتد (امتداد الانفجار السعري 12%)
          const target2 = (currentPrice * 1.12).toFixed(2);

          let strategyType = '🎯 سوينق: تجميع كلاستر';
          let confidence = 90;

          if (isGammaBreakout) {
            strategyType = '🔥 سوينق: اختراق جدار الجاما';
            confidence = 95;
          } else if (isBollingerSqueeze) {
            strategyType = '⚡ سوينق: انفجار بولنجر قادم';
            confidence = 92;
          }

          // فكرة العقد الممتد (أكثر من 38 يوم لتفادي الثيتا)
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 42); 
          const formattedExpiry = expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

          const swingObj = {
            ticker: symbol,
            price: Number(currentPrice.toFixed(2)),
            change_percent: changePercent,
            strategy: strategyType,
            target_1: Number(target1),
            target_2: Number(target2),
            trailing_stop: Number(dynamicStopLoss),
            confidence: confidence,
            sector: symbolSectors[symbol] || 'عام',
            option_hint: `Call Strike $${Math.ceil(currentPrice) + 1} | صلاحية: ${formattedExpiry} (>40 يوم)`,
            created_at: new Date().toISOString()
          };

          swingOpportunities.push(swingObj);

          // حفظ الإشارة في جدول السوينق بـ Supabase لو رغبت
          if (supabase) {
            await supabase.from('swing_signals').insert([swingObj]).catch(()=>{});
          }
        }
      } catch (e) {}
    }

    // ترتيب الفرص حسب الأعلى ثقة
    swingOpportunities.sort((a, b) => b.confidence - a.confidence);

    // 🚀 إرسال التنبيهات الفورية إلى تليجرام وديسكورد تلقائياً
    if (swingOpportunities.length > 0) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      const discordUrl = process.env.DISCORD_WEBHOOK_URL;

      let reportText = `👑 *قناص السوينقات النشط (أسهم < $100)* 👑\n` +
        `⏳ عقود خيارات مرنة وصلاحيات ممتدة\n` +
        `----------------------------------\n`;

      swingOpportunities.slice(0, 4).forEach(opp => {
        reportText += `📌 *${opp.ticker}* [${opp.sector}]\n` +
          `💰 السعر: $${opp.price} (${opp.change_percent}%)\n` +
          `📊 الاستراتيجية: ${opp.strategy}\n` +
          `🎯 هدف 1: $${opp.target_1} | 🚀 هدف 2 ممتد: $${opp.target_2}\n` +
          `🛑 وقف متحرك: $${opp.trailing_stop} (يندفع لأعلى مع الصعود)\n` +
          `🎫 مقترح العقد: ${opp.option_hint}\n` +
          `----------------------------------\n`;
      });

      // إرسال تليجرام تلقائي
      if (botToken && chatId) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: reportText,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '📊 مراقبة رادار السوينق بالمنصة', url: process.env.NEXT_PUBLIC_BASE_URL || 'https://vercel.com' }]]
            }
          })
        }).catch(()=>{});
      }

      // إرسال ديسكورد تلقائي
      if (discordUrl) {
        await fetch(discordUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: reportText.replace(/\*/g, '**'),
            components: [{
              type: 1,
              components: [{ type: 2, style: 5, label: '🔗 افتح واجهة السنايبر', url: process.env.NEXT_PUBLIC_BASE_URL || 'https://vercel.com' }]
            }]
          })
        }).catch(()=>{});
      }
    }

    return NextResponse.json({ success: true, count: swingOpportunities.length, data: swingOpportunities });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
