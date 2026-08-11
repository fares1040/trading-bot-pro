const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : 0));

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
  return {
    available: false,
    score: null,
    provider: null,
    confidence: null,
    note: 'Institutional Flow غير محسوب حتى يتم ربط مزود فعلي. لا يتم اختلاق بيانات مؤسسية.',
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
