import { getInstitutionalProviderStatus } from './institutional-provider.js';

const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : 0));

const daysBetween = (a, b) => {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
};

export const HIC_THRESHOLDS = Object.freeze({
  minSetupScore: 65,
  preferredSetupScore: 75,
  minRelativeVolume: 1.0,
  minRiskReward: 1.25,
  strongRiskReward: 2,
  defensiveSetupScore: 75,
});

export function classifyMarketRegime(indices = []) {
  const by = Object.fromEntries(indices.map((item) => [item.symbol, item]));
  const vix = Number(by['^VIX']?.value);
  const vixChange = Number(by['^VIX']?.change);
  const spxChange = Number(by['^GSPC']?.change);
  const qqqChange = Number(by.QQQ?.change);
  let score = 50;
  const reasons = [];

  if (Number.isFinite(vix)) {
    if (vix < 16) { score += 18; reasons.push('تقلب منخفض نسبيًا'); }
    else if (vix < 22) { score += 5; reasons.push('تقلب ضمن نطاق متوازن'); }
    else if (vix < 30) { score -= 15; reasons.push('التقلب مرتفع'); }
    else { score -= 28; reasons.push('التقلب حاد'); }
  }
  if (Number.isFinite(spxChange)) reasons.push(`S&P ${spxChange >= 0 ? '+' : ''}${spxChange.toFixed(2)}%`), score += clamp(spxChange * 8, -16, 16);
  if (Number.isFinite(qqqChange)) reasons.push(`QQQ ${qqqChange >= 0 ? '+' : ''}${qqqChange.toFixed(2)}%`), score += clamp(qqqChange * 6, -12, 12);

  const regimeScore = Math.round(clamp(score));
  let label = 'متوازن';
  let risk = 'NORMAL';
  if (regimeScore >= 68) { label = 'Risk-On'; risk = 'FAVORABLE'; }
  else if (regimeScore <= 38) { label = 'Risk-Off'; risk = 'DEFENSIVE'; }

  if (Number.isFinite(vixChange) && vixChange > 8) {
    reasons.push('VIX يرتفع بسرعة — خفّض المخاطرة');
    risk = risk === 'FAVORABLE' ? 'NORMAL' : 'DEFENSIVE';
  }

  return {
    label,
    risk,
    score: regimeScore,
    vix: Number.isFinite(vix) ? Number(vix.toFixed(2)) : null,
    reasons,
    disclaimer: 'قراءة سياق للسوق وليست توقعًا لحركة المؤشرات.',
  };
}

export function evaluateHICCandidate(stock = {}, regime = {}) {
  const setup = Number(stock.setupScore);
  const price = Number(stock.price);
  const avgVolume = Number(stock.averageVolume20);
  const rvol = Number(stock.relativeVolume);
  const rr = Number(stock.riskReward);
  const technicalReady = stock.technicalReady === true;
  const reasons = [];
  const blockers = [];

  if (!technicalReady) blockers.push('بيانات فنية غير مكتملة');
  if (!Number.isFinite(price) || price <= 0) blockers.push('السعر غير صالح');
  if (!Number.isFinite(avgVolume) || avgVolume < 100000) blockers.push('السيولة التاريخية أقل من الحد الأدنى');
  if (!Number.isFinite(rvol) || rvol < HIC_THRESHOLDS.minRelativeVolume) blockers.push(`RVOL أقل من ${HIC_THRESHOLDS.minRelativeVolume}x`);

  const minimumSetup = regime?.risk === 'DEFENSIVE' ? HIC_THRESHOLDS.defensiveSetupScore : HIC_THRESHOLDS.minSetupScore;
  if (!Number.isFinite(setup) || setup < minimumSetup) blockers.push(`Setup Score أقل من ${minimumSetup}`);
  if (Number.isFinite(rr) && rr < HIC_THRESHOLDS.minRiskReward) blockers.push(`R/R أقل من ${HIC_THRESHOLDS.minRiskReward}`);

  if (!Number.isFinite(rr)) reasons.push('R/R غير متاح؛ لا يتم افتراض قيمة');
  else if (rr >= HIC_THRESHOLDS.strongRiskReward) reasons.push(`R/R ${rr.toFixed(2)}`);
  if (Number.isFinite(rvol) && rvol >= 1.5) reasons.push(`RVOL ${rvol.toFixed(2)}x`);
  if (Number.isFinite(setup) && setup >= HIC_THRESHOLDS.preferredSetupScore) reasons.push(`Setup Score ${Math.round(setup)}`);
  if (regime?.risk === 'DEFENSIVE') reasons.push('السوق في وضع دفاعي');

  return { eligible: blockers.length === 0, minimumSetup, reasons: reasons.slice(0, 4), blockers: blockers.slice(0, 5) };
}

export function deriveConviction(stock = {}, regime = {}) {
  let score = 0;
  const reasons = [];
  const setup = Number(stock.setupScore);
  const rvol = Number(stock.relativeVolume);
  const rr = Number(stock.riskReward);
  const rsi = Number(stock.rsi);
  const resistance = Number(stock.resistanceDistancePercent);
  const momentum = Number(stock.momentumPercent);

  if (Number.isFinite(setup)) score += setup * 0.45;
  if (Number.isFinite(rvol)) {
    score += clamp(35 + rvol * 18, 35, 100) * 0.15;
    if (rvol >= 1.5) reasons.push(`RVOL ${rvol.toFixed(2)}x`);
  }
  if (Number.isFinite(rr)) {
    score += clamp(rr * 28, 20, 100) * 0.15;
    if (rr >= 2) reasons.push(`R/R ${rr.toFixed(2)}`);
  }
  if (Number.isFinite(rsi) && rsi >= 45 && rsi <= 68) {
    score += 85 * 0.1;
    reasons.push(`RSI ${rsi.toFixed(1)} ضمن نطاق مريح`);
  } else score += 45 * 0.1;

  if (Number.isFinite(resistance)) {
    const room = clamp(resistance * 25, 10, 100);
    score += room * 0.05;
    if (resistance >= 2) reasons.push(`مساحة مقاومة ${resistance.toFixed(1)}%`);
  }
  if (regime?.risk === 'DEFENSIVE') { score -= 10; reasons.push('سياق السوق دفاعي'); }
  else if (regime?.risk === 'FAVORABLE') score += 5;
  if (Number.isFinite(momentum) && momentum > 0) reasons.push(`Momentum +${momentum.toFixed(1)}%`);

  const conviction = Math.round(clamp(score));
  const tier = conviction >= 82 ? 'A' : conviction >= 72 ? 'B' : conviction >= 62 ? 'C' : 'D';
  return {
    score: conviction,
    tier,
    reasons: reasons.slice(0, 4),
    action: tier === 'A' ? 'مرشح للمراجعة الآن' : tier === 'B' ? 'مراقبة قريبة' : tier === 'C' ? 'انتظار تأكيد' : 'لا تطارد الحركة',
  };
}

export function calculateHunterScore({ setupScore, convictionScore, regimeScore, hicEligible, institutionalAvailable = false, institutionalScore = null }) {
  const setup = Number(setupScore);
  const conviction = Number(convictionScore);
  const regime = Number(regimeScore);
  let score = (Number.isFinite(setup) ? setup * 0.55 : 0) + (Number.isFinite(conviction) ? conviction * 0.35 : 0) + (Number.isFinite(regime) ? regime * 0.1 : 0);

  if (institutionalAvailable && Number.isFinite(Number(institutionalScore))) {
    score = score * 0.9 + Number(institutionalScore) * 0.1;
  }
  if (!hicEligible) score = Math.min(score, 64);

  const finalScore = Math.round(clamp(score));
  const tier = finalScore >= 85 ? 'A' : finalScore >= 75 ? 'B' : finalScore >= 65 ? 'C' : 'D';
  return { score: finalScore, tier, eligible: hicEligible };
}

export function getInstitutionalIntelligenceStatus() {
  const status = getInstitutionalProviderStatus();

  return {
    available: status.available,
    score: status.score,
    provider: status.provider,
    confidence: status.confidence,
    note:
      status.available === false
        ? 'Institutional Flow غير محسوب حتى يتم ربط مزود فعلي. لا يتم اختلاق بيانات مؤسسية.'
        : 'Institutional Flow متاح من مزود موثوق.',
    reason: status.reason || null,
    capabilities: status.capabilities || null,
  };
}

/**
 * Summarize a raw fetchOptionsChain() result into explicit Hunter options
 * intelligence states. This is purely informational — it never feeds scoring.
 *
 * Explicit states:
 *   - available: Yahoo returned a usable chain
 *   - unavailable: symbol invalid / no chain / empty chain (NOT treated as negative)
 *   - error: malformed response / HTTP error / Yahoo error
 *   - timeout: Yahoo request exceeded the provider timeout
 *
 * Missing/unavailable options data simply remains unavailable; it is never
 * substituted with a fabricated value or counted against the candidate.
 *
 * @param {Object|null} optionsResult - output of fetchOptionsChain()
 * @returns {Object} normalized options intelligence
 */
export function summarizeOptionsIntelligence(optionsResult) {
  if (!optionsResult) {
    return {
      available: false,
      state: 'unavailable',
      source: null,
      reason: 'no-options-request',
      summary: null,
      errors: [],
    };
  }

  const {
    available,
    source,
    reason,
    errors,
    underlyingPrice,
    expiry,
    count,
    contracts,
  } = optionsResult;

  let state = 'unavailable';
  if (available) {
    state = 'available';
  } else if (reason) {
    if (reason.startsWith('yahoo-options-request-failed')) {
      state = /timeout/i.test(reason) ? 'timeout' : 'error';
    } else if (
      reason === 'yahoo-options-empty-response' ||
      reason === 'yahoo-options-invalid-json'
    ) {
      state = 'error';
    } else {
      state = 'unavailable';
    }
  }

  let summary = null;
  if (available && Array.isArray(contracts) && contracts.length > 0) {
    const calls = contracts.filter((c) => c.optionType === 'CALL').length;
    const puts = contracts.filter((c) => c.optionType === 'PUT').length;
    const topLiquid = [...contracts]
      .sort((a, b) => (b.liquidityScore || 0) - (a.liquidityScore || 0))
      .slice(0, 5)
      .map((c) => ({
        contractSymbol: c.contractSymbol,
        optionType: c.optionType,
        strike: c.strike,
        expiry: c.expiry,
        premium: c.premium,
        impliedVolatility: c.impliedVolatility,
        volume: c.volume,
        openInterest: c.openInterest,
        liquidityScore: c.liquidityScore,
      }));

    summary = {
      underlyingPrice,
      expiry,
      count,
      calls,
      puts,
      topLiquid,
    };
  }

  return {
    available: Boolean(available),
    state,
    source: available ? source : null,
    reason: reason || null,
    summary,
    errors: Array.isArray(errors) ? errors : [],
  };
}

/**
 * Attach options intelligence to an already-scored Hunter opportunity WITHOUT
 * touching any scoring field. Returns a new object; the original opportunity's
 * hunterScore, hic, conviction, institutionalIntelligence, etc. are preserved
 * exactly.
 *
 * @param {Object} opportunity - scored Hunter opportunity
 * @param {Object|null} optionsResult - output of fetchOptionsChain()
 * @returns {Object}
 */
export function attachOptionsIntelligence(opportunity, optionsResult) {
  return {
    ...opportunity,
    optionsIntelligence: summarizeOptionsIntelligence(optionsResult),
  };
}

/**
 * Compute an INDEPENDENT Options Intelligence Signal from a real, normalized
 * options chain (output of fetchOptionsChain()).
 *
 * This signal is purely analytical and NEVER feeds Hunter Score, HIC,
 * Technical Score, Risk Engine, Market Regime, or Institutional Score.
 *
 * Design (deterministic + explainable):
 *  - Sentiment is derived from the call/put volume ratio and call/put
 *    open-interest ratio. Volume is weighted 0.6 (timely activity) and OI 0.4
 *    (positioning). Ratio of 1.0 => neutral (score 50). Ratio > 1 leans
 *    bullish, < 1 leans bearish. The mapping saturates at combined ratio 2
 *    (score 100) and 0.5 (score 0) so extreme dominance is captured.
 *  - Confidence (0-100) reflects data reliability: average contract liquidity,
 *    total activity, number of usable contracts, and IV coverage.
 *  - Bias label: bullish (score >= 58), bearish (score <= 42), neutral, or
 *    insufficient-data when real data cannot support a read.
 *
 * Data-safety rules:
 *  - Missing fields are treated as unknown/neutral, never negative.
 *  - If there is insufficient real activity (no volume/OI, one-sided data, or
 *    below a minimal activity floor) we return available:false, score:null,
 *    bias:'insufficient-data' with an explicit reason. We never fabricate.
 *
 * @param {Object|null} optionsResult - output of fetchOptionsChain()
 * @returns {Object} optionsSignal
 */
export function computeOptionsSignal(optionsResult) {
  const insufficient = (reason) => ({
    available: false,
    score: null,
    bias: 'insufficient-data',
    confidence: 0,
    factors: null,
    reason,
    source: optionsResult?.source || null,
  });

  if (!optionsResult || optionsResult.available !== true || !Array.isArray(optionsResult.contracts)) {
    return insufficient(optionsResult?.reason || 'no-options-data');
  }

  const contracts = optionsResult.contracts;
  if (contracts.length === 0) {
    return insufficient('no-contracts');
  }

  let callVol = 0;
  let putVol = 0;
  let callOI = 0;
  let putOI = 0;
  let liquiditySum = 0;
  let ivSum = 0;
  let ivCount = 0;
  let usable = 0;
  let expiryDate = null;

  for (const c of contracts) {
    const isCall = c.optionType === 'CALL';
    const vol = Number(c.volume) || 0;
    const oi = Number(c.openInterest) || 0;
    if (isCall) {
      callVol += vol;
      callOI += oi;
    } else {
      putVol += vol;
      putOI += oi;
    }
    const liq = Number(c.liquidityScore);
    if (Number.isFinite(liq)) liquiditySum += liq;
    const iv = c.impliedVolatility;
    if (iv != null && Number.isFinite(Number(iv))) {
      ivSum += Number(iv);
      ivCount++;
    }
    if (vol > 0 || oi > 0) usable++;
    if (!expiryDate && c.expiry) expiryDate = c.expiry;
  }

  const totalVol = callVol + putVol;
  const totalOI = callOI + putOI;

  // ---- Sufficiency gates (never fabricate a direction) ----
  if (totalVol === 0 && totalOI === 0) return insufficient('no-volume-or-oi');
  if (totalVol < 100 && totalOI < 100) return insufficient('insufficient-activity');
  const hasCall = callVol > 0 || callOI > 0;
  const hasPut = putVol > 0 || putOI > 0;
  if (!hasCall || !hasPut) return insufficient('one-sided-options-data');

  // ---- Combined call/put ratio (volume-weighted, OI as secondary) ----
  const volRatio = callVol > 0 && putVol > 0 ? callVol / putVol : null;
  const oiRatio = callOI > 0 && putOI > 0 ? callOI / putOI : null;
  let combined;
  if (volRatio != null && oiRatio != null) combined = volRatio * 0.6 + oiRatio * 0.4;
  else if (volRatio != null) combined = volRatio;
  else if (oiRatio != null) combined = oiRatio;
  else return insufficient('cannot-compute-ratio');

  // Sentiment: ratio 1 => 50; saturates at 2 (100) and 0.5 (0).
  const sentimentScore = Math.round(clamp(50 + (combined - 1) * 50, 0, 100));

  // ---- Confidence (data reliability) ----
  const avgLiquidity = liquiditySum / contracts.length;
  const activityFactor = Math.min(100, totalVol / 200);
  const contractFactor = Math.min(100, usable * 8);
  const ivFactor = contracts.length > 0 ? (ivCount / contracts.length) * 100 : 0;
  const confidence = Math.round(
    clamp(avgLiquidity * 0.3 + activityFactor * 0.3 + contractFactor * 0.2 + ivFactor * 0.2, 0, 100)
  );

  let bias = 'neutral';
  if (sentimentScore >= 58) bias = 'bullish';
  else if (sentimentScore <= 42) bias = 'bearish';

  const avgIV = ivCount > 0 ? Number((ivSum / ivCount).toFixed(4)) : null;

  const factors = {
    callVolume: callVol,
    putVolume: putVol,
    callPutRatio: volRatio != null ? Number(volRatio.toFixed(3)) : null,
    callOpenInterest: callOI,
    putOpenInterest: putOI,
    openInterest: totalOI,
    oiRatio: oiRatio != null ? Number(oiRatio.toFixed(3)) : null,
    impliedVolatility: avgIV,
    liquidity: Math.round(avgLiquidity),
    expiry: expiryDate,
    daysToExpiry:
      expiryDate != null ? daysBetween(new Date(), new Date(`${expiryDate}T00:00:00`)) : null,
  };

  return {
    available: true,
    score: sentimentScore,
    bias,
    confidence,
    factors,
    reason: `Options sentiment ${bias} (call/put vol ratio ${factors.callPutRatio ?? 'n/a'}, OI ratio ${factors.oiRatio ?? 'n/a'}).`,
    source: optionsResult.source || 'Yahoo Finance options chain',
  };
}

/**
 * Attach the independent options signal to an already-scored Hunter
 * opportunity WITHOUT touching any scoring field. Returns a new object; the
 * original opportunity's hunterScore, hic, conviction, institutionalIntelligence,
 * and optionsIntelligence are preserved exactly.
 *
 * @param {Object} opportunity - scored Hunter opportunity (may already have optionsIntelligence)
 * @param {Object|null} optionsResult - output of fetchOptionsChain()
 * @returns {Object}
 */
export function attachOptionsSignal(opportunity, optionsResult) {
  return {
    ...opportunity,
    optionsSignal: computeOptionsSignal(optionsResult),
  };
}

export function buildRiskPlan({ capital, riskPercent, entry, stop, target }) {
  const c = Number(capital), rp = Number(riskPercent), e = Number(entry), s = Number(stop), t = Number(target);
  if (![c, rp, e, s, t].every(Number.isFinite) || c <= 0 || rp <= 0 || e <= 0 || s <= 0 || t <= 0 || s >= e) {
    return { valid: false, error: 'بيانات إدارة المخاطر غير صالحة.' };
  }
  const riskAmount = c * (rp / 100);
  const riskPerShare = e - s;
  const shares = Math.floor(riskAmount / riskPerShare);
  const positionValue = shares * e;
  const rewardPerShare = Math.max(0, t - e);
  const rr = rewardPerShare / riskPerShare;
  return {
    valid: true,
    riskAmount: Number(riskAmount.toFixed(2)),
    riskPerShare: Number(riskPerShare.toFixed(2)),
    shares,
    positionValue: Number(positionValue.toFixed(2)),
    positionPercent: Number(((positionValue / c) * 100).toFixed(2)),
    rewardPerShare: Number(rewardPerShare.toFixed(2)),
    riskReward: Number(rr.toFixed(2)),
    note: rr >= 2 ? 'نسبة العائد إلى المخاطرة مناسبة للمراجعة.' : 'نسبة العائد إلى المخاطرة منخفضة؛ لا ترفع المخاطرة لتعويضها.',
  };
}
