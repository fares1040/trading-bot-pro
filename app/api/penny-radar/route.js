import { NextResponse } from 'next/server';
import { calculateSupportProximity, calculateResistanceProximity, classifyBreakoutProximity, calculateStructureScore, generateEntryTargetZones, calculateDollarVolume, classifyDollarVolume, calculateVolumeQuality, calculatePennyLiquidityScore, getLiquidityWarning, getLiquidityFlags, calculateLiquidityRisk, calculateVolatilityRisk, calculateResistanceRisk, calculateStructureRisk, calculateVolumeTrapRisk, calculateMomentumRisk, calculatePennyRiskScore, classifyPennyRisk, getPennyRiskLabel, getPennyRiskFlags, buildRiskReasons } from '@/lib/penny-intelligence';
import { buildSecIntelligence } from '@/lib/sec-filings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_PRICE = 5;
const MIN_PRICE = 0.10;
const MIN_AVG_VOLUME = 100000;
const MIN_RVOL = 1.0;

const n = (value) => {
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
};

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();

  return /^[A-Z][A-Z0-9.-]{0,7}$/.test(symbol)
    ? symbol
    : null;
}

export async function GET(request) {
  try {
    const origin =
      new URL(request.url).origin;

    const response = await fetch(
      `${origin}/api/stocks`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      }
    );

    const payload =
      await response
        .json()
        .catch(() => ({}));

    if (
      !response.ok ||
      payload?.status !== 'success'
    ) {
      throw new Error(
        payload?.error ||
          'تعذر قراءة مصدر الأسهم الرئيسي'
      );
    }

    const source =
      Array.isArray(payload?.data)
        ? payload.data
        : [];

    const data = source
      .filter((item) => {
        const price =
          n(item.price);

        const avgVolume =
          n(item.averageVolume20);

        const rvol =
          n(item.relativeVolume);

        return (
          cleanSymbol(item.symbol) &&
          price != null &&
          price >= MIN_PRICE &&
          price <= MAX_PRICE &&
          avgVolume != null &&
          avgVolume >= MIN_AVG_VOLUME &&
          rvol != null &&
          rvol >= MIN_RVOL &&
          item.technicalReady === true
        );
      })
      .map((item) => {
        const score =
          calculatePennyScore(item);

        const reasons =
          buildPennyReasons(item);

        const price = n(item.price);
        const dollarVolume = calculateDollarVolume(price, n(item.volume));
        const volumeQuality = calculateVolumeQuality({
          volume: n(item.volume),
          averageVolume20: n(item.averageVolume20),
          relativeVolume: n(item.relativeVolume),
        });

        const liquidityFlags = getLiquidityFlags({
          relativeVolume: n(item.relativeVolume),
          dollarVolume,
          volumeQualityScore: volumeQuality.score,
        });

        const resistanceDistance =
          item.resistance20 != null && price != null && price > 0
            ? ((item.resistance20 - price) / price) * 100
            : null;

        const breakoutProximity =
          classifyBreakoutProximity(price, item.resistance20, item.breakoutScore);

        const liquidityRisk = calculateLiquidityRisk({
          dollarVolume,
          volumeQualityScore: volumeQuality.score,
          liquidityScore: calculatePennyLiquidityScore({
            liquidityScore: item.liquidityScore,
            dollarVolume,
            volumeQualityScore: volumeQuality.score,
          }),
          liquidityWarning: getLiquidityWarning(dollarVolume),
          liquidityFlags,
        });

        const volatilityRisk = calculateVolatilityRisk({
          price,
          atr: item.atr,
          changePercent: item.changePercent,
        });

        const resistanceRisk = calculateResistanceRisk({
          resistanceDistancePercent: resistanceDistance,
          resistanceProximity: calculateResistanceProximity(price, item.resistance20),
        });

        const structureScore = calculateStructureScore({
          price,
          support: item.support20,
          resistance: item.resistance20,
          breakoutScore: item.breakoutScore,
          clusterScore: item.clusterScore,
        });

        const structureRisk = calculateStructureRisk({
          structureScore,
          breakoutScore: item.breakoutScore,
          clusterScore: item.clusterScore,
        });

        const volumeTrapRisk = calculateVolumeTrapRisk({
          relativeVolume: n(item.relativeVolume),
          dollarVolume,
          volumeQualityScore: volumeQuality.score,
          liquidityFlags,
        });

        const momentumRisk = calculateMomentumRisk({
          rsi: item.rsi,
          changePercent: item.changePercent,
          breakoutProximity,
        });

        const riskComponents = {
          liquidityRisk,
          volatilityRisk,
          resistanceRisk,
          structureRisk,
          volumeTrapRisk,
          momentumRisk,
        };

        return {
          kind: 'PENNY',

          symbol:
            cleanSymbol(item.symbol),

          quoteType:
            item.quoteType ?? null,

          exchange:
            item.exchange ?? null,

          price:
            n(item.price),

          previousClose:
            n(item.previousClose),

          change:
            n(item.change),

          changePercent:
            n(item.changePercent),

          volume:
            n(item.volume) ?? 0,

          averageVolume20:
            n(item.averageVolume20),

          relativeVolume:
            n(item.relativeVolume),

          rsi:
            n(item.rsi),

          sma20:
            n(item.sma20),

          sma50:
            n(item.sma50),

          setupScore:
            n(item.setupScore),

          technicalScore:
            n(item.technicalScore),

          breakoutScore:
            n(item.breakoutScore),

          trendScore:
            n(item.trendScore),

          momentumScore:
            n(item.momentumScore),

          opportunityScore:
            score,

          action:
            score >= 85
              ? 'مراقبة تأكيد الاختراق والحجم'
              : score >= 75
                ? 'مراقبة'
                : 'انتظار',

          thesis:
            score >= 85
              ? 'إشارة فنية قوية ضمن رادار الأسهم منخفضة السعر'
              : 'مرشح منخفض السعر يحتاج تأكيدًا إضافيًا',

          reasons,

          riskLabel:
            'HIGH RISK / SPECULATIVE',

          atr:
            item.atr ?? null,

          vwapStatus:
            'unavailable',

          support20:
            n(item.support20),

          resistance20:
            n(item.resistance20),

          clusterScore:
            n(item.clusterScore),

          squeezeScore:
            n(item.squeezeScore),

          supportDistancePercent:
            item.support20 != null && price != null && price > 0
              ? ((price - item.support20) / price) * 100
              : null,

          resistanceDistancePercent:
            item.resistance20 != null && price != null && price > 0
              ? ((item.resistance20 - price) / price) * 100
              : null,

          supportProximity:
            calculateSupportProximity(price, item.support20),

          resistanceProximity:
            calculateResistanceProximity(price, item.resistance20),

          breakoutProximity:
            classifyBreakoutProximity(price, item.resistance20, item.breakoutScore),

          structureScore:
            calculateStructureScore({
              price,
              support: item.support20,
              resistance: item.resistance20,
              breakoutScore: item.breakoutScore,
              clusterScore: item.clusterScore,
            }),

          ...generateEntryTargetZones(price, item.support20, item.resistance20, item.atr),

          liquidityScore:
            calculatePennyLiquidityScore({
              liquidityScore: item.liquidityScore,
              dollarVolume,
              volumeQualityScore: volumeQuality.score,
            }),

          dollarVolume,

          dollarVolumeClass:
            classifyDollarVolume(dollarVolume),

          volumeQualityScore:
            volumeQuality.score,

          volumeQuality:
            volumeQuality.quality,

          liquidityWarning:
            getLiquidityWarning(dollarVolume),

          liquidityFlags:
            getLiquidityFlags({
              relativeVolume: n(item.relativeVolume),
              dollarVolume,
              volumeQualityScore: volumeQuality.score,
            }),

          liquidityRisk:
            calculateLiquidityRisk({
              dollarVolume,
              volumeQualityScore: volumeQuality.score,
              liquidityScore: calculatePennyLiquidityScore({
                liquidityScore: item.liquidityScore,
                dollarVolume,
                volumeQualityScore: volumeQuality.score,
              }),
              liquidityWarning: getLiquidityWarning(dollarVolume),
              liquidityFlags: getLiquidityFlags({
                relativeVolume: n(item.relativeVolume),
                dollarVolume,
                volumeQualityScore: volumeQuality.score,
              }),
            }),

          volatilityRisk:
            calculateVolatilityRisk({
              price,
              atr: item.atr,
              changePercent: item.changePercent,
            }),

          resistanceRisk:
            calculateResistanceRisk({
              resistanceDistancePercent:
                item.resistance20 != null && price != null && price > 0
                  ? ((item.resistance20 - price) / price) * 100
                  : null,
              resistanceProximity: calculateResistanceProximity(price, item.resistance20),
            }),

          structureRisk:
            calculateStructureRisk({
              structureScore: calculateStructureScore({
                price,
                support: item.support20,
                resistance: item.resistance20,
                breakoutScore: item.breakoutScore,
                clusterScore: item.clusterScore,
              }),
              breakoutScore: item.breakoutScore,
              clusterScore: item.clusterScore,
            }),

          volumeTrapRisk:
            calculateVolumeTrapRisk({
              relativeVolume: n(item.relativeVolume),
              dollarVolume,
              volumeQualityScore: volumeQuality.score,
              liquidityFlags: getLiquidityFlags({
                relativeVolume: n(item.relativeVolume),
                dollarVolume,
                volumeQualityScore: volumeQuality.score,
              }),
            }),

          momentumRisk:
            calculateMomentumRisk({
              rsi: item.rsi,
              changePercent: item.changePercent,
              breakoutProximity: classifyBreakoutProximity(price, item.resistance20, item.breakoutScore),
            }),

          riskScore:
            calculatePennyRiskScore(riskComponents),

          riskLevel:
            classifyPennyRisk(
              calculatePennyRiskScore(riskComponents)
            ),

          riskLabel:
            getPennyRiskLabel(
              classifyPennyRisk(
                calculatePennyRiskScore(riskComponents)
              )
            ),

          riskFlags:
            getPennyRiskFlags({
              ...riskComponents,
              liquidityFlags,
            }),

          riskReasons:
            buildRiskReasons({
              ...riskComponents,
              dollarVolume,
              liquidityFlags,
              atr: item.atr,
              price,
              resistanceDistancePercent: resistanceDistance,
              rsi: item.rsi,
              changePercent: item.changePercent,
              breakoutProximity,
            }),

          dataAvailability: {
            price: true,
            volume: true,
            technicals: true,
            options: false,
            darkPool: false,
            institutionalFlow: false,
          },

          source:
            payload?.source ||
            'Hunter Stocks API',
        };
      })
      .sort(
        (a, b) =>
          Number(
            b.opportunityScore || 0
          ) -
          Number(
            a.opportunityScore || 0
          )
      )
      .slice(0, 30);

    const defaultSecIntelligence = {
      secRiskScore: null,
      secRiskLevel: 'unavailable',
      secRiskFlags: [],
      secRiskReasons: ['SEC data unavailable'],
      dilutionRisk: 'unavailable',
      dilutionReason: null,
      offeringRisk: 'unavailable',
      offeringType: null,
      offeringDate: null,
      offeringReason: null,
      warrantRisk: 'unavailable',
      convertibleRisk: 'unavailable',
      warrantReasons: [],
      reverseSplitRisk: 'unavailable',
      reverseSplitDetected: false,
      reverseSplitDate: null,
      reverseSplitRatio: null,
      latestRelevantFilings: [],
      secDataStatus: 'unavailable',
    };

    const secPromises = data.map(item => buildSecIntelligence(item.symbol, fetch, 5000));
    const secResults = await Promise.allSettled(secPromises);

    const dataWithSec = data.map((item, index) => ({
      ...item,
      secIntelligence: secResults[index].status === 'fulfilled' ? secResults[index].value : defaultSecIntelligence,
    }));

    return NextResponse.json(
      {
        success: true,

        timestamp:
          new Date().toISOString(),

        count:
          dataWithSec.length,

        data: dataWithSec,

        criteria: {
          price:
            `$${MIN_PRICE} - $${MAX_PRICE}`,

          minimumAverageVolume20:
            MIN_AVG_VOLUME,

          minimumRelativeVolume:
            MIN_RVOL,

          technicalReady:
            true,
        },

        dataAvailability: {
          price: true,
          volume: true,
          technicals: true,
          options: false,
          darkPool: false,
          institutionalFlow: false,
        },

        note:
          'Penny Radar يعتمد فقط على بيانات الأسهم الفنية الحقيقية من /api/stocks. لا يتم اختلاق تدفقات أو Options أو Dark Pool.',

      },
      {
        headers: {
          'Cache-Control':
            'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error(
      'Penny Radar error:',
      error?.message ||
        error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          'تعذر قراءة رادار الأسهم منخفضة السعر حالياً.',

        data: [],

        dataAvailability: {
          price: false,
          volume: false,
          technicals: false,
          options: false,
          darkPool: false,
          institutionalFlow: false,
        },
      },
      {
        status: 503,
      }
    );
  }
}
