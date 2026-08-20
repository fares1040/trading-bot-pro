const n = (value) => {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
};

export { n };

export function calculateOptionsLiquidity(contract) {
  const volume = n(contract.volume);
  const oi = n(contract.openInterest);
  const spreadPct = n(contract.spreadPct);

  if (volume == null && oi == null && spreadPct == null) {
    return { score: null, strength: 'UNAVAILABLE' };
  }

  let score = 50;

  if (volume != null) {
    if (volume >= 1000) score += 25;
    else if (volume >= 500) score += 15;
    else if (volume >= 100) score += 5;
    else score -= 10;
  }

  if (oi != null) {
    if (oi >= 1000) score += 25;
    else if (oi >= 500) score += 15;
    else if (oi >= 100) score += 5;
    else score -= 10;
  }

  if (spreadPct != null) {
    if (spreadPct <= 5) score += 20;
    else if (spreadPct <= 15) score += 10;
    else if (spreadPct <= 35) score -= 5;
    else score -= 20;
  }

  score = Math.max(0, Math.min(100, score));

  let strength = 'MODERATE';
  if (score >= 80) strength = 'EXCELLENT';
  else if (score >= 65) strength = 'GOOD';
  else if (score >= 50) strength = 'MODERATE';
  else if (score >= 35) strength = 'WEAK';
  else strength = 'WEAK';

  return { score, strength };
}

export function calculateVolumeStrength(contract) {
  const volume = n(contract.volume);
  if (volume == null) return { score: null, strength: 'UNAVAILABLE' };

  let score = 50;
  if (volume >= 1000) score += 30;
  else if (volume >= 500) score += 20;
  else if (volume >= 100) score += 10;
  else if (volume >= 10) score += 0;
  else score -= 20;

  score = Math.max(0, Math.min(100, score));

  let strength = 'MODERATE';
  if (score >= 80) strength = 'VERY_STRONG';
  else if (score >= 65) strength = 'STRONG';
  else if (score >= 50) strength = 'MODERATE';
  else if (score >= 35) strength = 'WEAK';
  else strength = 'WEAK';

  return { score, strength };
}

export function calculateOpenInterestStrength(contract) {
  const oi = n(contract.openInterest);
  if (oi == null) return { score: null, strength: 'UNAVAILABLE', volumeToOIRatio: null };

  const volume = n(contract.volume);
  const ratio = volume != null && oi > 0 ? volume / oi : null;

  let score = 50;
  if (oi >= 1000) score += 30;
  else if (oi >= 500) score += 20;
  else if (oi >= 100) score += 10;
  else if (oi >= 10) score += 0;
  else score -= 20;

  score = Math.max(0, Math.min(100, score));

  let strength = 'MODERATE';
  if (score >= 80) strength = 'VERY_STRONG';
  else if (score >= 65) strength = 'STRONG';
  else if (score >= 50) strength = 'MODERATE';
  else if (score >= 35) strength = 'WEAK';
  else strength = 'WEAK';

  return { score, strength, volumeToOIRatio: ratio };
}

export function calculatePremiumQuality(contract) {
  const premium = n(contract.premium);
  const strike = n(contract.strike);
  const underlying = n(contract.underlying);
  const dte = n(contract.daysToExpiration);

  if (premium == null) return { score: null, quality: 'UNAVAILABLE' };

  let score = 50;

  if (premium <= 0.1) score += 10;
  else if (premium <= 0.5) score += 5;
  else if (premium <= 1) score += 0;
  else score -= 10;

  if (dte != null) {
    if (dte <= 7) score -= 10;
    else if (dte <= 14) score -= 5;
    else if (dte >= 30) score += 5;
  }

  if (underlying != null && strike != null && underlying > 0) {
    const distancePct = Math.abs((strike - underlying) / underlying) * 100;
    if (distancePct <= 2) score += 5;
    else if (distancePct >= 20) score -= 10;
  }

  score = Math.max(0, Math.min(100, score));

  let quality = 'MODERATE';
  if (score >= 80) quality = 'EXCELLENT';
  else if (score >= 65) quality = 'GOOD';
  else if (score >= 50) quality = 'MODERATE';
  else if (score >= 35) quality = 'WEAK';
  else quality = 'WEAK';

  return { score, quality };
}

export function calculateContractQuality(contract) {
  const components = [];

  const liquidity = calculateOptionsLiquidity(contract);
  if (liquidity.score != null) components.push({ score: liquidity.score, weight: 0.35 });

  const volume = calculateVolumeStrength(contract);
  if (volume.score != null) components.push({ score: volume.score, weight: 0.25 });

  const oi = calculateOpenInterestStrength(contract);
  if (oi.score != null) components.push({ score: oi.score, weight: 0.20 });

  const premium = calculatePremiumQuality(contract);
  if (premium.score != null) components.push({ score: premium.score, weight: 0.20 });

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);

  return Math.round(Math.min(100, weightedSum / totalWeight));
}

export function calculateOptionsScore(contract) {
  const contractQuality = calculateContractQuality(contract);
  const liquidity = calculateOptionsLiquidity(contract);
  const premiumQuality = calculatePremiumQuality(contract);
  const volumeStrength = calculateVolumeStrength(contract);

  const components = [];

  if (liquidity.score != null) components.push({ score: liquidity.score, weight: 0.35 });
  if (contractQuality != null) components.push({ score: contractQuality, weight: 0.35 });
  if (premiumQuality.score != null) components.push({ score: premiumQuality.score, weight: 0.20 });
  if (volumeStrength.score != null) components.push({ score: volumeStrength.score, weight: 0.10 });

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);

  return Math.round(Math.min(100, weightedSum / totalWeight));
}

export function classifyOptionsRisk(contract) {
  const flags = [];
  const reasons = [];

  const spreadPct = n(contract.spreadPct);
  const volume = n(contract.volume);
  const oi = n(contract.openInterest);
  const dte = n(contract.daysToExpiration);
  const premium = n(contract.premium);
  const underlying = n(contract.underlying);
  const strike = n(contract.strike);

  if (spreadPct != null && spreadPct > 35) {
    flags.push('WIDE_SPREAD');
    reasons.push('Wide bid/ask spread');
  }

  if (volume != null && volume < 10) {
    flags.push('LOW_VOLUME');
    reasons.push('Very low volume');
  }

  if (oi != null && oi < 10) {
    flags.push('LOW_OPEN_INTEREST');
    reasons.push('Very low open interest');
  }

  if (dte != null && dte <= 7) {
    flags.push('SHORT_DTE');
    reasons.push('Extremely short days to expiration');
  }

  if (underlying != null && strike != null && underlying > 0) {
    const distancePct = Math.abs((strike - underlying) / underlying) * 100;
    if (distancePct >= 20) {
      flags.push('FAR_OTM');
      reasons.push('Far out-of-the-money contract');
    }
  }

  if (premium == null || volume == null || oi == null) {
    flags.push('INCOMPLETE_DATA');
    reasons.push('Incomplete market data');
  }

  let riskLevel = 'LOW';
  if (flags.length >= 3) riskLevel = 'EXTREME';
  else if (flags.length === 2) riskLevel = 'HIGH';
  else if (flags.length === 1) riskLevel = 'MODERATE';

  return { riskLevel, riskFlags: flags, riskReasons: reasons.slice(0, 5) };
}

export function buildOptionsReasons(contract) {
  const reasons = [];

  const liquidity = calculateOptionsLiquidity(contract);
  const volume = calculateVolumeStrength(contract);
  const oi = calculateOpenInterestStrength(contract);
  const premium = calculatePremiumQuality(contract);

  if (liquidity.strength && liquidity.strength !== 'UNAVAILABLE') {
    reasons.push(`Liquidity: ${liquidity.strength}`);
  }

  if (volume.strength && volume.strength !== 'UNAVAILABLE') {
    reasons.push(`Volume: ${volume.strength}`);
  }

  if (oi.strength && oi.strength !== 'UNAVAILABLE') {
    reasons.push(`OI: ${oi.strength}`);
  }

  if (premium.quality && premium.quality !== 'UNAVAILABLE') {
    reasons.push(`Premium: ${premium.quality}`);
  }

  return reasons.slice(0, 4);
}

export function buildOptionsWarnings(contract) {
  const warnings = [];
  const risk = classifyOptionsRisk(contract);

  for (const flag of risk.riskFlags) {
    if (flag === 'WIDE_SPREAD') warnings.push('Wide spread');
    else if (flag === 'LOW_VOLUME') warnings.push('Low volume');
    else if (flag === 'LOW_OPEN_INTEREST') warnings.push('Low open interest');
    else if (flag === 'SHORT_DTE') warnings.push('Short DTE');
    else if (flag === 'FAR_OTM') warnings.push('Far OTM');
    else if (flag === 'INCOMPLETE_DATA') warnings.push('Incomplete data');
  }

  return warnings;
}

export function buildOptionsIntelligence(contract) {
  const liquidity = calculateOptionsLiquidity(contract);
  const volume = calculateVolumeStrength(contract);
  const oi = calculateOpenInterestStrength(contract);
  const premium = calculatePremiumQuality(contract);
  const contractQuality = calculateContractQuality(contract);
  const optionsScore = calculateOptionsScore(contract);
  const risk = classifyOptionsRisk(contract);

  const dataStatus =
    contract.premium != null &&
    contract.volume != null &&
    contract.openInterest != null &&
    contract.bid != null &&
    contract.ask != null
      ? 'complete'
      : 'partial';

  return {
    optionsScore,
    contractQualityScore: contractQuality,
    liquidityScore: liquidity.score,
    liquidityStrength: liquidity.strength,
    volumeScore: volume.score,
    volumeStrength: volume.strength,
    oiScore: oi.score,
    oiStrength: oi.strength,
    volumeToOIRatio: oi.volumeToOIRatio,
    premiumScore: premium.score,
    premiumQuality: premium.quality,
    riskLevel: risk.riskLevel,
    riskFlags: risk.riskFlags,
    riskReasons: risk.riskReasons,
    flowDirection: 'UNAVAILABLE',
    flowConfidence: null,
    flowReason: 'Directional options flow data unavailable from current provider.',
    dataStatus,
  };
}

// ============================================================================
// FLOW INTELLIGENCE (A2.2)
// ============================================================================

export function aggregateContractsByUnderlying(contracts) {
  const map = new Map();
  for (const c of contracts) {
    const key = c.underlying != null ? String(c.underlying) : 'unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  }
  return map;
}

export function calculateCallPutPressure(contracts) {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return {
      callVolume: 0,
      putVolume: 0,
      callOI: 0,
      putOI: 0,
      callPremium: null,
      putPremium: null,
      callVolumeRatio: null,
      putVolumeRatio: null,
      callOIRatio: null,
      putOIRatio: null,
      callPutPressureScore: null,
      callPutPressure: 'UNAVAILABLE',
    };
  }

  let callVolume = 0;
  let putVolume = 0;
  let callOI = 0;
  let putOI = 0;
  let callPremium = 0;
  let putPremium = 0;
  let callCount = 0;
  let putCount = 0;

  for (const c of contracts) {
    const vol = n(c.volume) ?? 0;
    const oi = n(c.openInterest) ?? 0;
    const prem = n(c.premium) ?? 0;

    if (c.optionType === 'CALL') {
      callVolume += vol;
      callOI += oi;
      callPremium += prem;
      callCount++;
    } else if (c.optionType === 'PUT') {
      putVolume += vol;
      putOI += oi;
      putPremium += prem;
      putCount++;
    }
  }

  const totalVolume = callVolume + putVolume;
  const totalOI = callOI + putOI;
  const callVolumeRatio = totalVolume > 0 ? callVolume / totalVolume : null;
  const putVolumeRatio = totalVolume > 0 ? putVolume / totalVolume : null;
  const callOIRatio = totalOI > 0 ? callOI / totalOI : null;
  const putOIRatio = totalOI > 0 ? putOI / totalOI : null;

  let callPutPressureScore = null;
  let callPutPressure = 'UNAVAILABLE';

  if (callVolumeRatio != null && callOIRatio != null) {
    const volumeComponent = callVolumeRatio * 100;
    const oiComponent = callOIRatio * 100;
    callPutPressureScore = Math.round(Math.min(100, volumeComponent * 0.6 + oiComponent * 0.4));

    if (callVolumeRatio >= 0.7 && callOIRatio >= 0.7) callPutPressure = 'CALL_PRESSURE';
    else if (putVolumeRatio >= 0.7 && putOIRatio >= 0.7) callPutPressure = 'PUT_PRESSURE';
    else if (callVolumeRatio >= 0.6 && callOIRatio >= 0.6) callPutPressure = 'CALL_PRESSURE';
    else if (putVolumeRatio >= 0.6 && putOIRatio >= 0.6) callPutPressure = 'PUT_PRESSURE';
    else callPutPressure = 'BALANCED';
  }

  const avgCallPremium = callCount > 0 ? callPremium / callCount : null;
  const avgPutPremium = putCount > 0 ? putPremium / putCount : null;

  return {
    callVolume,
    putVolume,
    callOI,
    putOI,
    callPremium: avgCallPremium,
    putPremium: avgPutPremium,
    callVolumeRatio,
    putVolumeRatio,
    callOIRatio,
    putOIRatio,
    callPutPressureScore,
    callPutPressure,
  };
}

export function calculateVolumeOIActivity(contract) {
  const volume = n(contract.volume);
  const oi = n(contract.openInterest);

  if (volume == null && oi == null) {
    return { volumeToOIRatio: null, activityStrength: 'UNAVAILABLE' };
  }

  const safeVolume = volume ?? 0;
  const safeOI = oi ?? 0;
  const ratio = safeOI > 0 ? safeVolume / safeOI : null;

  let activityStrength = 'NORMAL';
  if (ratio != null) {
    if (ratio >= 5) activityStrength = 'VERY_HIGH';
    else if (ratio >= 2) activityStrength = 'HIGH';
    else if (ratio >= 0.5) activityStrength = 'NORMAL';
    else if (ratio > 0) activityStrength = 'LOW';
    else activityStrength = 'UNAVAILABLE';
  }

  return { volumeToOIRatio: ratio, activityStrength };
}

export function calculatePremiumPressure(contracts) {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return { callPremiumVolume: null, putPremiumVolume: null, premiumPressureScore: null };
  }

  let callPremiumVolume = 0;
  let putPremiumVolume = 0;

  for (const c of contracts) {
    const vol = n(c.volume) ?? 0;
    const prem = n(c.premium) ?? 0;
    const total = vol * prem;

    if (c.optionType === 'CALL') callPremiumVolume += total;
    else if (c.optionType === 'PUT') putPremiumVolume += total;
  }

  const totalPremiumVolume = callPremiumVolume + putPremiumVolume;
  let premiumPressureScore = null;

  if (totalPremiumVolume > 0) {
    const callRatio = callPremiumVolume / totalPremiumVolume;
    premiumPressureScore = Math.round(Math.min(100, callRatio * 100));
  }

  return {
    callPremiumVolume: callPremiumVolume || null,
    putPremiumVolume: putPremiumVolume || null,
    premiumPressureScore,
  };
}

export function classifyFlowDirection(contracts) {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return {
      flowDirection: 'UNAVAILABLE',
      flowConfidence: null,
      flowReason: 'Directional options flow data unavailable from current provider.',
    };
  }

  const hasTradeDirection = contracts.some(
    (c) => c.tradeDirection != null || c.bidSideExecution != null || c.askSideExecution != null
  );

  if (!hasTradeDirection) {
    return {
      flowDirection: 'UNAVAILABLE',
      flowConfidence: null,
      flowReason: 'Directional options flow data unavailable from current provider.',
    };
  }

  return {
    flowDirection: 'UNAVAILABLE',
    flowConfidence: null,
    flowReason: 'Directional options flow data unavailable from current provider.',
  };
}

export function calculateFlowConfidence(contracts) {
  if (!Array.isArray(contracts) || contracts.length === 0) return 0;

  let maxScore = 0;

  for (const c of contracts) {
    let score = 0;
    if (c.premium != null) score += 20;
    if (n(c.volume) != null && n(c.volume) > 0) score += 20;
    if (n(c.openInterest) != null && n(c.openInterest) > 0) score += 20;
    if (c.bid != null && c.ask != null) score += 20;
    if (c.impliedVolatility != null) score += 10;
    if (c.strike != null && c.underlying != null) score += 10;

    maxScore = Math.max(maxScore, score);
  }

  return Math.min(100, maxScore);
}

export function detectFlowDivergence(contract, callPutPressure, flowDirection, activityStrength) {
  if (!contract || callPutPressure.callPutPressure === 'UNAVAILABLE') {
    return { flowDivergence: 'UNAVAILABLE', flowDivergenceReason: null };
  }

  const flags = [];

  if (callPutPressure.callPutPressure === 'CALL_PRESSURE' && activityStrength === 'HIGH') {
    flags.push('ACTIVITY_DIVERGENCE');
  }

  if (callPutPressure.callPutPressure === 'PUT_PRESSURE' && activityStrength === 'HIGH') {
    flags.push('ACTIVITY_DIVERGENCE');
  }

  if (callPutPressure.callVolumeRatio != null && callPutPressure.callVolumeRatio >= 0.7 && callPutPressure.callOIRatio != null && callPutPressure.callOIRatio < 0.4) {
    flags.push('ACTIVITY_DIVERGENCE');
  }

  if (callPutPressure.putVolumeRatio != null && callPutPressure.putVolumeRatio >= 0.7 && callPutPressure.putOIRatio != null && callPutPressure.putOIRatio < 0.4) {
    flags.push('ACTIVITY_DIVERGENCE');
  }

  let flowDivergence = 'NO_DIVERGENCE';
  let flowDivergenceReason = null;

  if (flags.includes('ACTIVITY_DIVERGENCE')) {
    flowDivergence = 'ACTIVITY_DIVERGENCE';
    flowDivergenceReason = 'High volume activity with low open interest suggests new positioning rather than established flow.';
  }

  return { flowDivergence, flowDivergenceReason };
}

export function calculateFlowScore(flowData) {
  const components = [];

  if (flowData.callPutPressureScore != null) components.push({ score: flowData.callPutPressureScore, weight: 0.30 });
  if (flowData.activityStrength && flowData.activityStrength !== 'UNAVAILABLE') {
    const activityScore = flowData.activityStrength === 'VERY_HIGH' ? 90 : flowData.activityStrength === 'HIGH' ? 75 : flowData.activityStrength === 'NORMAL' ? 60 : flowData.activityStrength === 'LOW' ? 40 : 50;
    components.push({ score: activityScore, weight: 0.25 });
  }
  if (flowData.premiumPressureScore != null) components.push({ score: flowData.premiumPressureScore, weight: 0.25 });
  if (flowData.flowConfidence != null) components.push({ score: flowData.flowConfidence, weight: 0.20 });

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);

  return Math.round(Math.min(100, weightedSum / totalWeight));
}

export function classifyFlowRisk(contract, flowData) {
  const flags = [];
  const reasons = [];

  const activity = flowData.activityStrength;
  if (activity === 'VERY_HIGH' || activity === 'HIGH') {
    flags.push('EXTREME_VOLUME_OI');
    reasons.push('Extreme volume to open interest ratio');
  }

  const spreadPct = n(contract.spreadPct);
  if (spreadPct != null && spreadPct > 35 && flowData.callPutPressure !== 'UNAVAILABLE') {
    flags.push('WIDE_SPREAD_ACTIVITY');
    reasons.push('Wide spread during active trading');
  }

  const volume = n(contract.volume);
  const oi = n(contract.openInterest);
  if (volume != null && oi != null && volume >= 1000 && oi < 100) {
    flags.push('LOW_PREMIUM_HIGH_VOLUME');
    reasons.push('High volume with low open interest');
  }

  if (flowData.flowDivergence === 'ACTIVITY_DIVERGENCE') {
    flags.push('CONTRADICTORY_PRESSURE');
    reasons.push('Contradictory volume and open interest signals');
  }

  if (flowData.callPutPressure === 'UNAVAILABLE' && flowData.flowDirection === 'UNAVAILABLE') {
    flags.push('INCOMPLETE_FLOW_DATA');
    reasons.push('Incomplete flow data');
  }

  let flowRiskLevel = 'LOW';
  if (flags.length >= 3) flowRiskLevel = 'EXTREME';
  else if (flags.length === 2) flowRiskLevel = 'HIGH';
  else if (flags.length === 1) flowRiskLevel = 'MODERATE';

  return { flowRiskLevel, flowRiskFlags: flags, flowRiskReasons: reasons.slice(0, 5) };
}

export function buildFlowReasons(contract, flowData) {
  const reasons = [];

  if (flowData.callPutPressure && flowData.callPutPressure !== 'UNAVAILABLE') {
    reasons.push(`Pressure: ${flowData.callPutPressure}`);
  }

  if (flowData.activityStrength && flowData.activityStrength !== 'UNAVAILABLE') {
    reasons.push(`Activity: ${flowData.activityStrength}`);
  }

  if (flowData.premiumPressureScore != null) {
    reasons.push(`Premium pressure: ${flowData.premiumPressureScore}/100`);
  }

  if (flowData.flowConfidence != null) {
    reasons.push(`Data confidence: ${flowData.flowConfidence}/100`);
  }

  return reasons.slice(0, 4);
}

export function buildFlowWarnings(contract, flowData) {
  const warnings = [];
  const risk = classifyFlowRisk(contract, flowData);

  for (const flag of risk.flowRiskFlags) {
    if (flag === 'EXTREME_VOLUME_OI') warnings.push('Extreme volume/OI');
    else if (flag === 'WIDE_SPREAD_ACTIVITY') warnings.push('Wide spread activity');
    else if (flag === 'LOW_PREMIUM_HIGH_VOLUME') warnings.push('Low premium / high volume');
    else if (flag === 'CONTRADICTORY_PRESSURE') warnings.push('Contradictory pressure');
    else if (flag === 'INCOMPLETE_FLOW_DATA') warnings.push('Incomplete flow data');
  }

  return warnings;
}

export function buildOptionsFlowIntelligence(contracts) {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return {
      callVolume: 0,
      putVolume: 0,
      callOI: 0,
      putOI: 0,
      callPremium: null,
      putPremium: null,
      callVolumeRatio: null,
      putVolumeRatio: null,
      callOIRatio: null,
      putOIRatio: null,
      callPutPressureScore: null,
      callPutPressure: 'UNAVAILABLE',
      volumeToOIRatio: null,
      activityStrength: 'UNAVAILABLE',
      premiumPressureScore: null,
      flowDirection: 'UNAVAILABLE',
      flowConfidence: null,
      flowReason: 'Directional options flow data unavailable from current provider.',
      flowScore: null,
      flowDivergence: 'UNAVAILABLE',
      flowDivergenceReason: null,
      flowRiskLevel: 'LOW',
      flowRiskFlags: [],
      flowRiskReasons: [],
      dataStatus: 'unavailable',
    };
  }

  const callPutPressure = calculateCallPutPressure(contracts);
  const premiumPressure = calculatePremiumPressure(contracts);
  const flowDirectionResult = classifyFlowDirection(contracts);
  const flowConfidence = calculateFlowConfidence(contracts);

  const representativeContract = contracts[0];
  const activity = calculateVolumeOIActivity(representativeContract);
  const divergence = detectFlowDivergence(representativeContract, callPutPressure, flowDirectionResult.flowDirection, activity.activityStrength);

  const flowData = {
    ...callPutPressure,
    activityStrength: activity.activityStrength,
    premiumPressureScore: premiumPressure.premiumPressureScore,
    flowConfidence,
    flowDirection: flowDirectionResult.flowDirection,
    flowDivergence: divergence.flowDivergence,
    flowDivergenceReason: divergence.flowDivergenceReason,
  };

  const flowScore = calculateFlowScore(flowData);
  const flowRisk = classifyFlowRisk(representativeContract, flowData);

  const dataStatus =
    representativeContract.premium != null &&
    representativeContract.volume != null &&
    representativeContract.openInterest != null
      ? 'complete'
      : 'partial';

  return {
    callVolume: callPutPressure.callVolume,
    putVolume: callPutPressure.putVolume,
    callOI: callPutPressure.callOI,
    putOI: callPutPressure.putOI,
    callPremium: callPutPressure.callPremium,
    putPremium: callPutPressure.putPremium,
    callVolumeRatio: callPutPressure.callVolumeRatio,
    putVolumeRatio: callPutPressure.putVolumeRatio,
    callOIRatio: callPutPressure.callOIRatio,
    putOIRatio: callPutPressure.putOIRatio,
    callPutPressureScore: callPutPressure.callPutPressureScore,
    callPutPressure: callPutPressure.callPutPressure,
    volumeToOIRatio: activity.volumeToOIRatio,
    activityStrength: activity.activityStrength,
    premiumPressureScore: premiumPressure.premiumPressureScore,
    flowDirection: flowDirectionResult.flowDirection,
    flowConfidence: flowDirectionResult.flowConfidence,
    flowReason: flowDirectionResult.flowReason,
    flowScore,
    flowDivergence: divergence.flowDivergence,
    flowDivergenceReason: divergence.flowDivergenceReason,
    flowRiskLevel: flowRisk.flowRiskLevel,
    flowRiskFlags: flowRisk.flowRiskFlags,
    flowRiskReasons: flowRisk.flowRiskReasons,
    dataStatus,
  };
}

// ============================================================================
// CONTRACT RANKING & QUALITY (A2.3)
// ============================================================================

export function classifyContractQuality(rankScore) {
  if (rankScore == null) return 'UNAVAILABLE';
  const score = n(rankScore);
  if (score == null) return 'UNAVAILABLE';
  if (score >= 85) return 'EXCEPTIONAL';
  if (score >= 70) return 'STRONG';
  if (score >= 55) return 'GOOD';
  if (score >= 40) return 'MODERATE';
  return 'WEAK';
}

export function classifyDteRisk(daysToExpiration) {
  if (daysToExpiration == null) return 'UNAVAILABLE';
  const dte = n(daysToExpiration);
  if (dte == null) return 'UNAVAILABLE';
  if (dte <= 3) return 'EXTREME';
  if (dte <= 7) return 'HIGH';
  if (dte <= 21) return 'MODERATE';
  if (dte <= 45) return 'LOW';
  return 'VERY_LOW';
}

export function classifyIvLevel(impliedVolatility) {
  if (impliedVolatility == null) return 'UNAVAILABLE';
  const iv = n(impliedVolatility);
  if (iv == null) return 'UNAVAILABLE';
  if (iv <= 0.3) return 'LOW';
  if (iv <= 0.6) return 'NORMAL';
  if (iv <= 1.0) return 'HIGH';
  return 'EXTREME';
}

export function classifyStrikeDistance(distancePct) {
  if (distancePct == null) return 'UNAVAILABLE';
  const dist = n(distancePct);
  if (dist == null) return 'UNAVAILABLE';
  if (dist <= 1) return 'ATM';
  if (dist <= 3) return 'NEAR_ATM';
  if (dist <= 7) return 'NEAR_OTM';
  if (dist <= 15) return 'OTM';
  return 'FAR_OTM';
}

export function calculateDteQualityScore(dteRisk) {
  const map = {
    VERY_LOW: 90,
    LOW: 75,
    MODERATE: 60,
    HIGH: 35,
    EXTREME: 15,
    UNAVAILABLE: null,
  };
  return map[dteRisk] ?? null;
}

export function calculateIvRiskScore(ivLevel) {
  const map = {
    LOW: 20,
    NORMAL: 40,
    HIGH: 65,
    EXTREME: 85,
    UNAVAILABLE: null,
  };
  return map[ivLevel] ?? null;
}

export function calculateStrikeQualityScore(strikeClassification) {
  const map = {
    ATM: 90,
    NEAR_ATM: 75,
    NEAR_OTM: 60,
    OTM: 40,
    FAR_OTM: 20,
    UNAVAILABLE: null,
  };
  return map[strikeClassification] ?? null;
}

export function calculateRiskAdjustedOptionsScore(optionsScore, contract, optionsIntelligence, flowIntelligence) {
  const components = [];

  const optionsScoreVal = n(optionsScore);
  if (optionsScoreVal != null) components.push({ score: optionsScoreVal, weight: 0.30 });

  const risk = optionsIntelligence?.riskLevel;
  const riskMap = { LOW: 85, MODERATE: 70, HIGH: 50, EXTREME: 30, UNAVAILABLE: null };
  const riskScore = risk ? riskMap[risk] : null;
  if (riskScore != null) components.push({ score: riskScore, weight: 0.20 });

  const dteRisk = classifyDteRisk(contract.daysToExpiration);
  const dteScore = calculateDteQualityScore(dteRisk);
  if (dteScore != null) components.push({ score: dteScore, weight: 0.15 });

  const ivLevel = classifyIvLevel(contract.impliedVolatility);
  const ivRisk = calculateIvRiskScore(ivLevel);
  if (ivRisk != null) components.push({ score: 100 - ivRisk, weight: 0.15 });

  const strikeClass = classifyStrikeDistance(contract.distancePct);
  const strikeScore = calculateStrikeQualityScore(strikeClass);
  if (strikeScore != null) components.push({ score: strikeScore, weight: 0.10 });

  const spreadPct = n(contract.spreadPct);
  if (spreadPct != null) {
    const spreadScore = spreadPct <= 5 ? 90 : spreadPct <= 15 ? 70 : spreadPct <= 35 ? 50 : 25;
    components.push({ score: spreadScore, weight: 0.10 });
  }

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);

  return Math.round(Math.min(100, weightedSum / totalWeight));
}

export function buildContractWarnings(contract, optionsIntelligence, flowIntelligence) {
  const warnings = [];
  const risk = optionsIntelligence?.riskFlags || [];
  const flowRisk = flowIntelligence?.flowRiskFlags || [];

  for (const flag of risk) {
    if (flag === 'WIDE_SPREAD') warnings.push('Wide spread');
    else if (flag === 'LOW_VOLUME') warnings.push('Low volume');
    else if (flag === 'LOW_OPEN_INTEREST') warnings.push('Low open interest');
    else if (flag === 'SHORT_DTE') warnings.push('Short DTE');
    else if (flag === 'FAR_OTM') warnings.push('Far OTM');
    else if (flag === 'INCOMPLETE_DATA') warnings.push('Incomplete data');
  }

  for (const flag of flowRisk) {
    if (flag === 'EXTREME_VOLUME_OI') warnings.push('Extreme volume/OI');
    else if (flag === 'WIDE_SPREAD_ACTIVITY') warnings.push('Wide spread activity');
    else if (flag === 'LOW_PREMIUM_HIGH_VOLUME') warnings.push('Low premium/high volume');
    else if (flag === 'CONTRADICTORY_PRESSURE') warnings.push('Contradictory pressure');
    else if (flag === 'INCOMPLETE_FLOW_DATA') warnings.push('Incomplete flow data');
  }

  const dte = n(contract.daysToExpiration);
  if (dte != null && dte <= 3) warnings.push('Extreme short DTE');

  const iv = n(contract.impliedVolatility);
  if (iv != null && iv > 1.0) warnings.push('Extreme IV');

  if (optionsIntelligence?.riskLevel === 'EXTREME' || optionsIntelligence?.riskLevel === 'HIGH') {
    warnings.push('High risk contract');
  }

  return warnings;
}

export function buildContractRankingReasons(contract, optionsIntelligence, flowIntelligence, ranking) {
  const reasons = [];

  if (optionsIntelligence?.liquidityStrength && optionsIntelligence.liquidityStrength !== 'UNAVAILABLE') {
    reasons.push(`Strong contract liquidity`);
  }

  if (optionsIntelligence?.oiStrength && optionsIntelligence.oiStrength !== 'UNAVAILABLE') {
    reasons.push(`Healthy open interest`);
  }

  if (flowIntelligence?.activityStrength === 'HIGH' || flowIntelligence?.activityStrength === 'VERY_HIGH') {
    reasons.push(`High volume activity`);
  }

  if (optionsIntelligence?.premiumQuality === 'EXCELLENT' || optionsIntelligence?.premiumQuality === 'GOOD') {
    reasons.push(`Premium within target range`);
  }

  const dte = n(contract.daysToExpiration);
  if (dte != null && dte <= 7) reasons.push(`Short DTE increases risk`);

  const spreadPct = n(contract.spreadPct);
  if (spreadPct != null && spreadPct > 15) reasons.push(`Wide spread reduces execution quality`);

  const dist = n(contract.distancePct);
  if (dist != null && dist >= 20) reasons.push(`Far OTM strike`);

  if (optionsIntelligence?.optionsScore != null && optionsIntelligence.optionsScore >= 75) {
    reasons.push(`Strong options intelligence score`);
  }

  if (ranking?.contractQuality === 'EXCEPTIONAL' || ranking?.contractQuality === 'STRONG') {
    reasons.push(`Top-ranked contract`);
  }

  return reasons.slice(0, 5);
}

export function rankOptionsContracts(contracts) {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return [];
  }

  const ranked = contracts.map((contract) => {
    const optionsIntelligence = buildOptionsIntelligence(contract);
    const flowIntelligence = buildOptionsFlowIntelligence([contract]);

    const components = [];

    const optionsScore = optionsIntelligence.optionsScore;
    if (optionsScore != null) components.push({ score: optionsScore, weight: 0.30 });
    if (optionsIntelligence.contractQualityScore != null) components.push({ score: optionsIntelligence.contractQualityScore, weight: 0.20 });

    if (optionsIntelligence.liquidityScore != null) components.push({ score: optionsIntelligence.liquidityScore, weight: 0.15 });

    if (optionsIntelligence.volumeScore != null) components.push({ score: optionsIntelligence.volumeScore, weight: 0.10 });

    if (optionsIntelligence.oiScore != null) components.push({ score: optionsIntelligence.oiScore, weight: 0.10 });

    if (optionsIntelligence.premiumScore != null) components.push({ score: optionsIntelligence.premiumScore, weight: 0.10 });

    if (flowIntelligence.flowScore != null) components.push({ score: flowIntelligence.flowScore, weight: 0.05 });

    let contractRankScore = null;
    if (components.length > 0) {
      const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
      const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);
      contractRankScore = Math.round(Math.min(100, weightedSum / totalWeight));
    }

    const contractQuality = classifyContractQuality(contractRankScore);
    const riskAdjustedScore = calculateRiskAdjustedOptionsScore(optionsScore, contract, optionsIntelligence, flowIntelligence);
    const riskAdjustedLevel = classifyContractQuality(riskAdjustedScore);

    const dteRisk = classifyDteRisk(contract.daysToExpiration);
    const dteQualityScore = calculateDteQualityScore(dteRisk);

    const ivLevel = classifyIvLevel(contract.impliedVolatility);
    const ivRiskScore = calculateIvRiskScore(ivLevel);

    const strikeClassification = classifyStrikeDistance(contract.distancePct);
    const strikeQualityScore = calculateStrikeQualityScore(strikeClassification);

    const premiumQualityScore = optionsIntelligence.premiumScore;
    const premiumQualityLevel = optionsIntelligence.premiumQuality;

    const warnings = buildContractWarnings(contract, optionsIntelligence, flowIntelligence);
    const reasons = buildContractRankingReasons(contract, optionsIntelligence, flowIntelligence, {
      contractQuality,
      contractRankScore,
      riskAdjustedScore,
      riskAdjustedLevel,
    });

    return {
      contract: contract,
      contractRankScore,
      contractQuality,
      riskAdjustedScore,
      riskAdjustedLevel,
      dteRisk,
      dteQualityScore,
      ivLevel,
      ivRiskScore,
      strikeClassification,
      strikeQualityScore,
      premiumQualityScore,
      premiumQualityLevel,
      contractWarnings: warnings,
      contractReasons: reasons,
      optionsIntelligence,
      flowIntelligence,
    };
  });

  return ranked.sort((a, b) => Number(b.contractRankScore || 0) - Number(a.contractRankScore || 0));
}

export function buildBestContractSummary(contracts, rankingOverride) {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return {
      bestContractSymbol: null,
      bestContractRankScore: null,
      bestContractQuality: null,
      bestContractReasons: [],
      alternativeContracts: [],
      contractCount: 0,
      averageRankScore: null,
      dataStatus: 'unavailable',
    };
  }

  const ranked = rankingOverride || rankOptionsContracts(contracts);
  const best = ranked[0];
  const alternatives = ranked.slice(1, 4);

  const scores = ranked.map(r => r.contractRankScore).filter(s => s != null);
  const averageRankScore = scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;

  const dataStatus =
    contracts.some(c => c.premium != null && c.volume != null && c.openInterest != null)
      ? 'complete'
      : 'partial';

  return {
    bestContractSymbol: contracts[0]?.symbol || null,
    bestContractRankScore: best?.contractRankScore ?? null,
    bestContractQuality: best?.contractQuality ?? null,
    bestContractReasons: best?.contractReasons || [],
    alternativeContracts: alternatives.map(a => ({
      symbol: a.optionsIntelligence?.optionsScore != null ? 'contract' : null,
      contractRankScore: a.contractRankScore,
      contractQuality: a.contractQuality,
      reasons: a.contractReasons,
    })),
    contractCount: contracts.length,
    averageRankScore,
    dataStatus,
  };
}

// ============================================================================
// DECISION ENGINE (A2.5)
// ============================================================================

export function classifyDecisionStatus(decisionScore) {
  if (decisionScore == null) return 'UNAVAILABLE';
  const score = n(decisionScore);
  if (score == null) return 'UNAVAILABLE';
  if (score >= 85) return 'HIGH_QUALITY';
  if (score >= 70) return 'GOOD_QUALITY';
  if (score >= 55) return 'WATCH';
  return 'LOW_QUALITY';
}

export function classifyExecutionQuality(contract) {
  const spreadPct = n(contract.spreadPct);
  const volume = n(contract.volume);
  const oi = n(contract.openInterest);
  const liquidityScore = n(contract.liquidityScore);
  const premium = n(contract.premium);

  if (spreadPct == null && volume == null && oi == null && liquidityScore == null) {
    return 'UNAVAILABLE';
  }

  let score = 50;

  if (spreadPct != null) {
    if (spreadPct <= 5) score += 20;
    else if (spreadPct <= 15) score += 10;
    else if (spreadPct <= 35) score -= 5;
    else score -= 20;
  }

  if (volume != null) {
    if (volume >= 1000) score += 15;
    else if (volume >= 500) score += 10;
    else if (volume >= 100) score += 5;
    else if (volume < 10) score -= 10;
  }

  if (oi != null) {
    if (oi >= 1000) score += 15;
    else if (oi >= 500) score += 10;
    else if (oi >= 100) score += 5;
    else if (oi < 10) score -= 10;
  }

  if (liquidityScore != null) {
    if (liquidityScore >= 80) score += 10;
    else if (liquidityScore >= 60) score += 5;
    else if (liquidityScore < 40) score -= 10;
  }

  if (premium != null && premium > 0 && premium <= 1) {
    score += 5;
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 80) return 'EXCELLENT';
  if (score >= 65) return 'GOOD';
  if (score >= 50) return 'WATCH';
  return 'POOR';
}

export function combineRiskLevels(optionsRisk, flowRisk, dteRisk, ivRisk, contractWarnings) {
  const riskMap = { LOW: 1, MODERATE: 2, HIGH: 3, EXTREME: 4, UNAVAILABLE: 0 };
  const reverseMap = { 1: 'LOW', 2: 'MODERATE', 3: 'HIGH', 4: 'EXTREME', 0: 'UNAVAILABLE' };

  let maxRisk = 0;
  let maxSource = 'UNAVAILABLE';

  const risks = [
    { level: optionsRisk, source: 'options' },
    { level: flowRisk, source: 'flow' },
    { level: dteRisk, source: 'dte' },
    { level: ivRisk, source: 'iv' },
  ];

  for (const r of risks) {
    const val = riskMap[r.level] || 0;
    if (val > maxRisk) {
      maxRisk = val;
      maxSource = r.level;
    }
  }

  const warningCount = Array.isArray(contractWarnings) ? contractWarnings.length : 0;
  if (warningCount >= 3 && maxRisk < 3) {
    maxRisk = 3;
    maxSource = 'HIGH';
  }

  return reverseMap[maxRisk] || 'UNAVAILABLE';
}

export function buildOptionsDecision(contract, context = {}) {
  const optionsIntelligence = context.optionsIntelligence != null ? context.optionsIntelligence : buildOptionsIntelligence(contract);
  const flowIntelligence = context.flowIntelligence != null ? context.flowIntelligence : buildOptionsFlowIntelligence([contract]);
  const ranking = context.ranking != null ? context.ranking : rankOptionsContracts([contract])[0];

  const components = [];

  const contractRankScore = ranking?.contractRankScore;
  if (contractRankScore != null) components.push({ score: contractRankScore, weight: 0.35 });

  const riskAdjustedScore = ranking?.riskAdjustedScore;
  if (riskAdjustedScore != null) components.push({ score: riskAdjustedScore, weight: 0.30 });

  const liquidityScore = optionsIntelligence?.liquidityScore;
  if (liquidityScore != null) components.push({ score: liquidityScore, weight: 0.15 });

  const premiumScore = optionsIntelligence?.premiumScore;
  if (premiumScore != null) components.push({ score: premiumScore, weight: 0.10 });

  const flowScore = flowIntelligence?.flowScore;
  if (flowScore != null) components.push({ score: flowScore, weight: 0.10 });

  let decisionScore = null;
  if (components.length > 0) {
    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);
    decisionScore = Math.round(Math.min(100, weightedSum / totalWeight));
  }

  const decisionStatus = classifyDecisionStatus(decisionScore);
  const executionQuality = classifyExecutionQuality(contract);
  const riskLevel = combineRiskLevels(
    optionsIntelligence?.riskLevel,
    flowIntelligence?.flowRiskLevel,
    ranking?.dteRisk,
    ranking?.ivLevel ? (ranking.ivLevel === 'EXTREME' ? 'EXTREME' : ranking.ivLevel === 'HIGH' ? 'HIGH' : ranking.ivLevel === 'NORMAL' ? 'MODERATE' : 'LOW') : null,
    optionsIntelligence?.riskFlags
  );

  const decisionReasons = [];
  if (contractRankScore != null && contractRankScore >= 70) decisionReasons.push('High contract ranking');
  if (liquidityScore != null && liquidityScore >= 70) decisionReasons.push('Strong liquidity');
  if (contract?.openInterest != null && contract.openInterest >= 500) decisionReasons.push('Healthy open interest');
  if (executionQuality === 'EXCELLENT' || executionQuality === 'GOOD') decisionReasons.push('Good execution quality');
  if (premiumScore != null && premiumScore >= 70) decisionReasons.push('Premium quality is favorable');
  if (flowScore != null && flowScore >= 70) decisionReasons.push('Strong flow data quality');

  const dte = n(contract.daysToExpiration);
  if (dte != null && dte <= 7) decisionReasons.push('Short DTE increases risk');

  const spreadPct = n(contract.spreadPct);
  if (spreadPct != null && spreadPct > 15) decisionReasons.push('Wide spread reduces execution quality');

  const iv = n(contract.impliedVolatility);
  if (iv != null && iv > 1.0) decisionReasons.push('High IV increases risk');

  const dist = n(contract.distancePct);
  if (dist != null && dist >= 20) decisionReasons.push('Far OTM strike increases risk');

  if (flowIntelligence?.flowDirection === 'UNAVAILABLE') decisionReasons.push('Flow data is incomplete');

  const decisionWarnings = [];
  if (dte != null && dte <= 7) decisionWarnings.push('SHORT_DTE');
  if (spreadPct != null && spreadPct > 35) decisionWarnings.push('WIDE_SPREAD');
  if (liquidityScore != null && liquidityScore < 50) decisionWarnings.push('LOW_LIQUIDITY');
  if (contract?.openInterest != null && contract.openInterest < 100) decisionWarnings.push('LOW_OI');
  if (contract?.volume != null && contract.volume < 10) decisionWarnings.push('LOW_VOLUME');
  if (iv != null && iv > 1.0) decisionWarnings.push('HIGH_IV');
  if (dist != null && dist >= 20) decisionWarnings.push('FAR_OTM');
  if (flowIntelligence?.flowDirection === 'UNAVAILABLE') decisionWarnings.push('FLOW_UNAVAILABLE');
  if (optionsIntelligence?.riskLevel === 'EXTREME' || optionsIntelligence?.riskLevel === 'HIGH') decisionWarnings.push('HIGH_CONTRACT_RISK');

  const decisionFlags = [];
  if (contractRankScore != null && contractRankScore >= 85) decisionFlags.push('TOP_RANKED');
  if (decisionStatus === 'HIGH_QUALITY' || decisionStatus === 'GOOD_QUALITY') decisionFlags.push('HIGH_QUALITY');
  if (executionQuality === 'EXCELLENT' || executionQuality === 'GOOD') decisionFlags.push('GOOD_EXECUTION');
  if (riskLevel === 'HIGH' || riskLevel === 'EXTREME') decisionFlags.push('HIGH_RISK');
  if (dte != null && dte <= 7) decisionFlags.push('SHORT_DTE');
  if (spreadPct != null && spreadPct > 35) decisionFlags.push('WIDE_SPREAD');
  if (liquidityScore != null && liquidityScore < 50) decisionFlags.push('LOW_LIQUIDITY');
  if (flowIntelligence?.flowDirection === 'UNAVAILABLE') decisionFlags.push('INCOMPLETE_DATA');

  return {
    decisionScore,
    decisionStatus,
    executionQuality,
    riskLevel,
    decisionReasons: decisionReasons.slice(0, 5),
    decisionWarnings,
    decisionFlags,
  };
}

export function selectRecommendedContract(contracts, rankingOverride) {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return {
      recommendedContract: null,
      recommendedScore: null,
      recommendedQuality: null,
      recommendedReasons: [],
      alternativeContracts: [],
      avoidContracts: [],
      dataStatus: 'unavailable',
    };
  }

  const ranked = rankingOverride || rankOptionsContracts(contracts);
  const decisions = ranked.map(c => ({
    contract: c,
    decision: buildOptionsDecision(c.optionsIntelligence?.optionsScore ? c : c, {
      optionsIntelligence: c.optionsIntelligence,
      flowIntelligence: c.flowIntelligence,
      ranking: c,
    }),
  }));

  decisions.sort((a, b) => Number(b.decision.decisionScore || 0) - Number(a.decision.decisionScore || 0));

  const recommended = decisions[0];
  const alternatives = decisions.slice(1, 4);
  const avoid = decisions.filter(d => d.decision.decisionStatus === 'LOW_QUALITY' || d.decision.riskLevel === 'EXTREME').slice(0, 3);

  const dataStatus =
    contracts.some(c => c.premium != null && c.volume != null && c.openInterest != null)
      ? 'complete'
      : 'partial';

  return {
    recommendedContract: recommended.contract?.contract?.symbol || null,
    recommendedScore: recommended.decision.decisionScore,
    recommendedQuality: recommended.decision.decisionStatus,
    recommendedReasons: recommended.decision.decisionReasons || [],
    alternativeContracts: alternatives.map(a => ({
      contract: a.contract?.contract?.symbol || null,
      decisionScore: a.decision.decisionScore,
      quality: a.decision.decisionStatus,
      risk: a.decision.riskLevel,
      reason: a.decision.decisionReasons?.[0] || null,
    })),
    avoidContracts: avoid.map(a => ({
      contract: a.contract?.contract?.symbol || null,
      reason: a.decision.decisionWarnings?.join(', ') || 'High risk or low quality',
    })),
    dataStatus,
  };
}

export function buildSymbolDecisionSummary(contracts, rankingOverride) {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return {
      decisionScore: null,
      decisionStatus: 'UNAVAILABLE',
      executionQuality: 'UNAVAILABLE',
      riskLevel: 'UNAVAILABLE',
      recommendedContract: null,
      recommendedScore: null,
      recommendedQuality: null,
      recommendedReasons: [],
      alternativeContracts: [],
      avoidContracts: [],
      dataStatus: 'unavailable',
    };
  }

  const ranked = rankingOverride || rankOptionsContracts(contracts);
  const best = ranked[0];
  const bestDecision = buildOptionsDecision(best, {
    optionsIntelligence: best.optionsIntelligence,
    flowIntelligence: best.flowIntelligence,
    ranking: best,
  });

  const selection = selectRecommendedContract(contracts, ranked);

  const scores = ranked.map(r => r.contractRankScore).filter(s => s != null);
  const avgRank = scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;

  const dataStatus =
    contracts.some(c => c.premium != null && c.volume != null && c.openInterest != null)
      ? 'complete'
      : 'partial';

  return {
    decisionScore: bestDecision.decisionScore,
    decisionStatus: bestDecision.decisionStatus,
    executionQuality: bestDecision.executionQuality,
    riskLevel: bestDecision.riskLevel,
    recommendedContract: selection.recommendedContract,
    recommendedScore: selection.recommendedScore,
    recommendedQuality: selection.recommendedQuality,
    recommendedReasons: selection.recommendedReasons,
    alternativeContracts: selection.alternativeContracts,
    avoidContracts: selection.avoidContracts,
    dataStatus,
  };
}

// ============================================================================
// WATCHLIST & MONITORING ENGINE (A2.6)
// ============================================================================

const FRESHNESS_THRESHOLDS = {
  FRESH: 2 * 60 * 1000,
  AGING: 5 * 60 * 1000,
};

export function classifyWatchFreshness(lastUpdated) {
  if (!lastUpdated) return 'UNAVAILABLE';
  const now = Date.now();
  const age = now - new Date(lastUpdated).getTime();
  if (age < FRESHNESS_THRESHOLDS.FRESH) return 'FRESH';
  if (age < FRESHNESS_THRESHOLDS.AGING) return 'AGING';
  return 'STALE';
}

function scoreDelta(prev, curr) {
  if (prev == null || curr == null) return null;
  return Number(curr) - Number(prev);
}

function classifyScoreChange(delta) {
  if (delta == null || !Number.isFinite(delta)) return null;
  if (delta >= 10) return 'IMPROVING';
  if (delta >= 3) return 'SLIGHTLY_IMPROVING';
  if (delta <= -10) return 'DETERIORATING';
  if (delta <= -3) return 'SLIGHTLY_DETERIORATING';
  return 'STABLE';
}

function riskValue(level) {
  const map = { LOW: 1, MODERATE: 2, HIGH: 3, EXTREME: 4, UNAVAILABLE: 0 };
  return map[level] ?? 0;
}

function classifyRiskChange(prev, curr) {
  const prevVal = riskValue(prev);
  const currVal = riskValue(curr);
  if (prevVal === 0 && currVal === 0) return 'RISK_STABLE';
  if (currVal > prevVal) return 'RISK_INCREASED';
  if (currVal < prevVal) return 'RISK_DECREASED';
  return 'RISK_STABLE';
}

function classifyLiquidityChange(prev, curr) {
  if (prev == null || curr == null) return null;
  const prevNum = Number(prev);
  const currNum = Number(curr);
  if (!Number.isFinite(prevNum) || !Number.isFinite(currNum)) return null;
  if (currNum > prevNum + 5) return 'LIQUIDITY_IMPROVED';
  if (currNum < prevNum - 5) return 'LIQUIDITY_DETERIORATED';
  return 'LIQUIDITY_STABLE';
}

function classifyPremiumChange(prev, curr) {
  if (prev == null || curr == null) return null;
  const prevNum = Number(prev);
  const currNum = Number(curr);
  if (!Number.isFinite(prevNum) || !Number.isFinite(currNum) || prevNum === 0) return null;
  const pct = ((currNum - prevNum) / prevNum) * 100;
  if (pct >= 10) return 'PREMIUM_INCREASED';
  if (pct <= -10) return 'PREMIUM_DECREASED';
  return 'PREMIUM_STABLE';
}

function classifyIvChange(prev, curr) {
  if (prev == null || curr == null) return null;
  const prevNum = Number(prev);
  const currNum = Number(curr);
  if (!Number.isFinite(prevNum) || !Number.isFinite(currNum)) return null;
  if (currNum > prevNum * 1.1) return 'IV_INCREASED';
  if (currNum < prevNum * 0.9) return 'IV_DECREASED';
  return 'IV_STABLE';
}

function classifyVolumeChange(prev, curr) {
  if (prev == null || curr == null) return null;
  const prevNum = Number(prev);
  const currNum = Number(curr);
  if (!Number.isFinite(prevNum) || !Number.isFinite(currNum)) return null;
  if (prevNum === 0 && currNum > 0) return 'VOLUME_SURGE';
  if (prevNum > 0 && currNum === 0) return 'VOLUME_DROP';
  if (prevNum > 0) {
    const ratio = currNum / prevNum;
    if (ratio >= 2) return 'VOLUME_SURGE';
    if (ratio <= 0.5) return 'VOLUME_DROP';
  }
  return null;
}

function classifyOiChange(prev, curr) {
  if (prev == null || curr == null) return null;
  const prevNum = Number(prev);
  const currNum = Number(curr);
  if (!Number.isFinite(prevNum) || !Number.isFinite(currNum)) return null;
  if (currNum > prevNum) return 'OI_INCREASED';
  if (currNum < prevNum) return 'OI_DECREASED';
  return null;
}

function isExpired(dte) {
  if (dte == null) return false;
  const num = Number(dte);
  return Number.isFinite(num) && num <= 0;
}

export function classifyDteStatus(dte) {
  if (dte == null) return null;
  const num = Number(dte);
  if (!Number.isFinite(num)) return null;
  if (num <= 0) return 'EXPIRED';
  if (num <= 3) return 'CRITICAL';
  if (num <= 7) return 'HIGH_ATTENTION';
  return null;
}

export function classifyWatchStatus(previous, current) {
  if (!current) return 'UNAVAILABLE';
  if (!previous) return 'NEW';

  if (isExpired(current.daysToExpiration)) return 'EXPIRED';

  const statuses = [];

  const scoreFields = ['decisionScore', 'contractRankScore', 'riskAdjustedScore'];
  for (const field of scoreFields) {
    const delta = scoreDelta(previous[field], current[field]);
    const change = classifyScoreChange(delta);
    if (change && change !== 'STABLE') statuses.push(change);
  }

  const riskChange = classifyRiskChange(previous.decisionRisk, current.decisionRisk);
  if (riskChange && riskChange !== 'RISK_STABLE') statuses.push(riskChange);

  const liqChange = classifyLiquidityChange(previous.liquidityScore, current.liquidityScore);
  if (liqChange && liqChange !== 'LIQUIDITY_STABLE') statuses.push(liqChange);

  const premiumChange = classifyPremiumChange(previous.premium, current.premium);
  if (premiumChange && premiumChange !== 'PREMIUM_STABLE') statuses.push(premiumChange);

  const ivChange = classifyIvChange(previous.impliedVolatility, current.impliedVolatility);
  if (ivChange && ivChange !== 'IV_STABLE') statuses.push(ivChange);

  const volChange = classifyVolumeChange(previous.volume, current.volume);
  if (volChange) statuses.push(volChange);

  const oiChange = classifyOiChange(previous.openInterest, current.openInterest);
  if (oiChange) statuses.push(oiChange);

  if (statuses.length === 0) return 'STABLE';

  const priority = ['DETERIORATING', 'IMPROVING', 'RISK_INCREASED', 'RISK_DECREASED', 'LIQUIDITY_DETERIORATED', 'VOLUME_DROP', 'OI_DECREASED', 'PREMIUM_DECREASED', 'IV_INCREASED', 'SLIGHTLY_DETERIORATING', 'SLIGHTLY_IMPROVING', 'LIQUIDITY_IMPROVED', 'VOLUME_SURGE', 'OI_INCREASED', 'PREMIUM_INCREASED', 'IV_DECREASED'];
  for (const p of priority) {
    if (statuses.includes(p)) return p;
  }

  return 'STABLE';
}

export function buildWatchReasons(previous, current) {
  if (!previous || !current) return [];
  const reasons = [];

  const scoreFields = [
    { key: 'decisionScore', label: 'Decision Score' },
    { key: 'contractRankScore', label: 'Contract ranking' },
  ];
  for (const field of scoreFields) {
    const delta = scoreDelta(previous[field.key], current[field.key]);
    if (delta != null && delta >= 10) reasons.push(`${field.label} improved significantly`);
    else if (delta != null && delta <= -10) reasons.push(`${field.label} deteriorated`);
  }

  const liqChange = classifyLiquidityChange(previous.liquidityScore, current.liquidityScore);
  if (liqChange === 'LIQUIDITY_IMPROVED') reasons.push('Liquidity improved');
  if (liqChange === 'LIQUIDITY_DETERIORATED') reasons.push('Liquidity deteriorated');

  const volChange = classifyVolumeChange(previous.volume, current.volume);
  if (volChange === 'VOLUME_SURGE') reasons.push('Volume increased sharply');
  if (volChange === 'VOLUME_DROP') reasons.push('Volume dropped');

  const oiChange = classifyOiChange(previous.openInterest, current.openInterest);
  if (oiChange === 'OI_INCREASED') reasons.push('Open interest increased');
  if (oiChange === 'OI_DECREASED') reasons.push('Open interest decreased');

  const exPrev = previous.executionQuality;
  const exCurr = current.executionQuality;
  if (exPrev && exCurr && exPrev !== exCurr) {
    if ((exPrev === 'POOR' || exPrev === 'WATCH') && (exCurr === 'GOOD' || exCurr === 'EXCELLENT')) reasons.push('Execution quality improved');
    else if ((exPrev === 'GOOD' || exPrev === 'EXCELLENT') && (exCurr === 'POOR' || exCurr === 'WATCH')) reasons.push('Execution quality deteriorated');
  }

  const riskChange = classifyRiskChange(previous.decisionRisk, current.decisionRisk);
  if (riskChange === 'RISK_INCREASED') reasons.push('Risk increased');
  if (riskChange === 'RISK_DECREASED') reasons.push('Risk decreased');

  const ivChange = classifyIvChange(previous.impliedVolatility, current.impliedVolatility);
  if (ivChange === 'IV_INCREASED') reasons.push('IV increased');
  if (ivChange === 'IV_DECREASED') reasons.push('IV decreased');

  const premiumChange = classifyPremiumChange(previous.premium, current.premium);
  if (premiumChange === 'PREMIUM_INCREASED') reasons.push('Premium increased');
  if (premiumChange === 'PREMIUM_DECREASED') reasons.push('Premium decreased');

  const dte = current.daysToExpiration;
  if (dte != null && Number(dte) <= 7 && Number(dte) > 0) reasons.push('DTE approaching expiration');

  return reasons.slice(0, 5);
}

export function buildWatchWarnings(previous, current) {
  if (!current) return [];
  const warnings = [];

  const riskChange = classifyRiskChange(previous?.decisionRisk, current.decisionRisk);
  if (riskChange === 'RISK_INCREASED') warnings.push('RISK_INCREASED');

  if (current.spreadPct != null && current.spreadPct > 35) warnings.push('WIDE_SPREAD');
  if (current.liquidityScore != null && current.liquidityScore < 50) warnings.push('LOW_LIQUIDITY');

  const dte = current.daysToExpiration;
  if (dte != null) {
    const num = Number(dte);
    if (num <= 0) warnings.push('EXPIRED');
    else if (num <= 7) warnings.push('SHORT_DTE');
  }

  if (current.impliedVolatility != null && current.impliedVolatility > 1.0) warnings.push('EXTREME_IV');

  const volChange = classifyVolumeChange(previous?.volume, current.volume);
  if (volChange === 'VOLUME_DROP') warnings.push('VOLUME_DROP');

  const oiChange = classifyOiChange(previous?.openInterest, current.openInterest);
  if (oiChange === 'OI_DECREASED') warnings.push('OI_DROP');

  if (!current.decisionScore && !current.contractRankScore) warnings.push('INCOMPLETE_DATA');

  return warnings;
}

export function calculateWatchRankScore(current, previous) {
  let score = 50;

  const ds = n(current.decisionScore);
  if (ds != null) score += (ds - 50) * 0.25;

  const crs = n(current.contractRankScore);
  if (crs != null) score += (crs - 50) * 0.15;

  const ex = current.executionQuality;
  if (ex === 'EXCELLENT') score += 15;
  else if (ex === 'GOOD') score += 10;
  else if (ex === 'POOR') score -= 10;

  const risk = current.decisionRisk;
  if (risk === 'LOW') score += 10;
  else if (risk === 'MODERATE') score += 5;
  else if (risk === 'HIGH') score -= 5;
  else if (risk === 'EXTREME') score -= 10;

  const freshness = classifyWatchFreshness(current.lastUpdated);
  if (freshness === 'FRESH') score += 5;
  else if (freshness === 'AGING') score -= 2;
  else if (freshness === 'STALE') score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildWatchListItem(contract, previous = null) {
  const now = new Date().toISOString();
  const current = {
    contract: contract.contract || null,
    underlying: contract.underlying || contract.symbol || null,
    side: contract.side || null,
    strike: contract.strike,
    expiry: contract.expiry,
    daysToExpiration: contract.daysToExpiration,
    premium: contract.premium,
    volume: contract.volume,
    openInterest: contract.openInterest,
    impliedVolatility: contract.impliedVolatility,
    decisionScore: contract.decisionScore,
    decisionStatus: contract.decisionStatus,
    contractRankScore: contract.contractRankScore,
    contractQuality: contract.contractQuality,
    riskAdjustedScore: contract.riskAdjustedScore,
    executionQuality: contract.executionQuality,
    liquidityScore: contract.optionsIntelligence?.liquidityScore ?? contract.liquidityScore,
    optionsFlow: contract.optionsFlow || null,
    optionsIntelligence: contract.optionsIntelligence || null,
    decisionRisk: contract.decisionRisk,
  };

  const watchStatus = classifyWatchStatus(previous, current);
  const watchReasons = buildWatchReasons(previous, current);
  const watchWarnings = buildWatchWarnings(previous, current);
  const watchRankScore = calculateWatchRankScore(current, previous);
  const watchDteStatus = classifyDteStatus(current.daysToExpiration);

  return {
    ...current,
    watchStatus,
    watchReasons,
    watchWarnings,
    watchRankScore,
    watchDteStatus,
    lastUpdated: now,
    dataStatus: current.decisionScore != null || current.contractRankScore != null ? 'complete' : 'partial',
  };
}

// ============================================================================
// OPTIONS STRATEGY INTELLIGENCE (A2.7)
// ============================================================================

export const StrategyType = {
  SINGLE_CALL: 'SINGLE_CALL',
  SINGLE_PUT: 'SINGLE_PUT',
  CALL_SPREAD: 'CALL_SPREAD',
  PUT_SPREAD: 'PUT_SPREAD',
};

const STRATEGY_LABELS = {
  SINGLE_CALL: 'Long Call',
  SINGLE_PUT: 'Long Put',
  CALL_SPREAD: 'Call Spread',
  PUT_SPREAD: 'Put Spread',
};

const STRATEGY_DESCRIPTIONS = {
  SINGLE_CALL: 'Single long call option — directional premium play with defined risk',
  SINGLE_PUT: 'Single long put option — directional premium play with defined risk',
  CALL_SPREAD: 'Buy lower-strike call, sell higher-strike call (same expiry) — defined risk/reward',
  PUT_SPREAD: 'Buy higher-strike put, sell lower-strike put (same expiry) — defined risk/reward',
};

const STRATEGY_RISK_VALUES = { LOW: 1, MODERATE: 2, HIGH: 3, EXTREME: 4, UNAVAILABLE: 0 };

function buildSingleLegCandidate(ranked, strategyType) {
  const contract = ranked?.contract;
  if (!contract) return null;
  if (contract.premium == null || contract.strike == null) return null;

  return {
    strategyType,
    label: STRATEGY_LABELS[strategyType],
    description: STRATEGY_DESCRIPTIONS[strategyType],
    symbol: contract.underlying || contract.symbol || null,
    underlying: n(contract.underlying),
    expiry: contract.expiry || null,
    strike: n(contract.strike),
    legs: [
      {
        contract: contract,
        rank: ranked,
        ratio: 1,
        role: 'LONG',
      },
    ],
  };
}

function buildSpreadCandidate(longRank, shortRank, strategyType) {
  const longContract = longRank?.contract;
  const shortContract = shortRank?.contract;

  if (!longContract || !shortContract) return null;
  if (longContract.premium == null || shortContract.premium == null) return null;
  if (longContract.strike == null || shortContract.strike == null) return null;
  if (longContract.expiry !== shortContract.expiry) return null;
  if (longContract.underlying !== shortContract.underlying) return null;

  return {
    strategyType,
    label: STRATEGY_LABELS[strategyType],
    description: STRATEGY_DESCRIPTIONS[strategyType],
    symbol: longContract.underlying || longContract.symbol || null,
    underlying: n(longContract.underlying),
    expiry: longContract.expiry || null,
    legs: [
      {
        contract: longContract,
        rank: longRank,
        ratio: 1,
        role: 'LONG',
      },
      {
        contract: shortContract,
        rank: shortRank,
        ratio: -1,
        role: 'SHORT',
      },
    ],
  };
}

export function validateStrategy(candidate) {
  const errors = [];

  if (!candidate) {
    return { valid: false, errors: ['candidate is null or undefined'] };
  }
  if (!candidate.strategyType) errors.push('Missing strategyType');
  if (!Array.isArray(candidate.legs) || candidate.legs.length === 0) {
    errors.push('Missing or empty legs');
  }

  const t = candidate.strategyType;

  if (t === 'SINGLE_CALL') {
    if (candidate.legs?.length !== 1) errors.push('SINGLE_CALL requires exactly 1 leg');
    else if (candidate.legs[0].contract?.optionType !== 'CALL') errors.push('SINGLE_CALL leg must be a CALL');
  }
  if (t === 'SINGLE_PUT') {
    if (candidate.legs?.length !== 1) errors.push('SINGLE_PUT requires exactly 1 leg');
    else if (candidate.legs[0].contract?.optionType !== 'PUT') errors.push('SINGLE_PUT leg must be a PUT');
  }
  if (t === 'CALL_SPREAD') {
    if (candidate.legs?.length !== 2) errors.push('CALL_SPREAD requires exactly 2 legs');
    else {
      const [long, short] = candidate.legs;
      if (long.contract?.optionType !== 'CALL' || short.contract?.optionType !== 'CALL') {
        errors.push('CALL_SPREAD legs must both be CALLS');
      }
      const longStrike = n(long.contract?.strike);
      const shortStrike = n(short.contract?.strike);
      if (longStrike != null && shortStrike != null && longStrike >= shortStrike) {
        errors.push('CALL_SPREAD long leg must have lower strike than short leg');
      }
    }
  }
  if (t === 'PUT_SPREAD') {
    if (candidate.legs?.length !== 2) errors.push('PUT_SPREAD requires exactly 2 legs');
    else {
      const [long, short] = candidate.legs;
      if (long.contract?.optionType !== 'PUT' || short.contract?.optionType !== 'PUT') {
        errors.push('PUT_SPREAD legs must both be PUTS');
      }
      const longStrike = n(long.contract?.strike);
      const shortStrike = n(short.contract?.strike);
      if (longStrike != null && shortStrike != null && longStrike <= shortStrike) {
        errors.push('PUT_SPREAD long leg must have higher strike than short leg');
      }
    }
  }

  if (!errors.length && candidate.legs) {
    for (let i = 0; i < candidate.legs.length; i++) {
      const leg = candidate.legs[i];
      const contract = leg?.contract;
      if (!contract) errors.push(`Leg ${i}: missing contract`);
      else {
        if (contract.premium == null) errors.push(`Leg ${i}: missing premium`);
        if (contract.strike == null) errors.push(`Leg ${i}: missing strike`);
        if (contract.optionType == null) errors.push(`Leg ${i}: missing optionType`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function calculateStrategyEconomics(candidate) {
  if (!candidate || !candidate.legs || candidate.legs.length === 0) {
    return { maxLoss: null, maxProfit: null, breakeven: null, netPremium: null, contractCost: null, spreadWidth: null, spreadWidthTotal: null };
  }

  const t = candidate.strategyType;

  if (t === 'SINGLE_CALL' || t === 'SINGLE_PUT') {
    const leg = candidate.legs[0];
    const contract = leg.contract;
    const premium = n(contract.premium);
    const strike = n(contract.strike);
    const contractCost = n(contract.contractCost);

    const maxLoss = contractCost;

    const breakeven =
      t === 'SINGLE_CALL'
        ? strike != null && premium != null
          ? strike + premium
          : null
        : strike != null && premium != null
          ? strike - premium
          : null;

    let maxProfit = null;
    if (t === 'SINGLE_PUT' && strike != null && premium != null) {
      maxProfit = strike - premium;
    }

    return {
      maxLoss,
      maxProfit,
      breakeven,
      netPremium: premium,
      contractCost: contractCost,
      spreadWidth: null,
      spreadWidthTotal: null,
    };
  }

  if (t === 'CALL_SPREAD' || t === 'PUT_SPREAD') {
    const longLeg = candidate.legs[0];
    const shortLeg = candidate.legs[1];
    const longContract = longLeg.contract;
    const shortContract = shortLeg.contract;

    const longPremium = n(longContract.premium);
    const shortPremium = n(shortContract.premium);
    const longStrike = n(longContract.strike);
    const shortStrike = n(shortContract.strike);

    if (longPremium == null || shortPremium == null || longStrike == null || shortStrike == null) {
      return { maxLoss: null, maxProfit: null, breakeven: null, netPremium: null, contractCost: null, spreadWidth: null, spreadWidthTotal: null };
    }

    const netPremiumPerShare = longPremium - shortPremium;
    const netPremiumTotal = netPremiumPerShare * 100;

    const spreadWidthPerShare =
      t === 'CALL_SPREAD'
        ? shortStrike - longStrike
        : longStrike - shortStrike;

    const spreadWidthTotal = spreadWidthPerShare * 100;

    if (netPremiumPerShare > 0) {
      const maxProfit = spreadWidthTotal - netPremiumTotal;
      const maxLoss = netPremiumTotal;
      const breakeven =
        t === 'CALL_SPREAD'
          ? longStrike + netPremiumPerShare
          : longStrike - netPremiumPerShare;

      return {
        maxLoss,
        maxProfit,
        breakeven,
        netPremium: netPremiumPerShare,
        contractCost: netPremiumTotal,
        spreadWidth: spreadWidthPerShare,
        spreadWidthTotal,
      };
    }

    const netCreditTotal = -netPremiumTotal;
    const maxProfit = netCreditTotal;
    const maxLoss = spreadWidthTotal - netCreditTotal;
    const breakeven =
      t === 'CALL_SPREAD'
        ? longStrike + Math.abs(netPremiumPerShare)
        : longStrike - Math.abs(netPremiumPerShare);

    return {
      maxLoss,
      maxProfit,
      breakeven,
      netPremium: netPremiumPerShare,
      contractCost: netPremiumTotal,
      spreadWidth: spreadWidthPerShare,
      spreadWidthTotal,
    };
  }

  return { maxLoss: null, maxProfit: null, breakeven: null, netPremium: null, contractCost: null, spreadWidth: null, spreadWidthTotal: null };
}

export function calculateStrategyQuality(candidate) {
  if (!candidate || !candidate.legs || candidate.legs.length === 0) return null;

  const components = [];

  const rankScores = candidate.legs.map((l) => l.rank?.contractRankScore).filter((s) => s != null);
  if (rankScores.length > 0) {
    const avg = rankScores.reduce((a, b) => a + b, 0) / rankScores.length;
    components.push({ score: avg, weight: 0.35 });
  }

  const riskScores = candidate.legs.map((l) => l.rank?.riskAdjustedScore).filter((s) => s != null);
  if (riskScores.length > 0) {
    const avg = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;
    components.push({ score: avg, weight: 0.25 });
  }

  const liquidityScores = candidate.legs
    .map((l) => l.rank?.ranked?.optionsIntelligence?.liquidityScore ?? l.rank?.optionsIntelligence?.liquidityScore ?? l.intelligence?.liquidityScore)
    .filter((s) => s != null);
  if (liquidityScores.length > 0) {
    const avg = liquidityScores.reduce((a, b) => a + b, 0) / liquidityScores.length;
    components.push({ score: avg, weight: 0.15 });
  }

  const premiumScores = candidate.legs.map((l) => l.rank?.premiumQualityScore).filter((s) => s != null);
  if (premiumScores.length > 0) {
    const avg = premiumScores.reduce((a, b) => a + b, 0) / premiumScores.length;
    components.push({ score: avg, weight: 0.10 });
  }

  const flowScores = candidate.legs
    .map((l) => l.rank?.flowIntelligence?.flowScore)
    .filter((s) => s != null);
  if (flowScores.length > 0) {
    const avg = flowScores.reduce((a, b) => a + b, 0) / flowScores.length;
    components.push({ score: avg, weight: 0.05 });
  }

  if (
    candidate.strategyType === 'CALL_SPREAD' ||
    candidate.strategyType === 'PUT_SPREAD'
  ) {
    const econ = candidate.strategyEconomics;
    if (
      econ.netPremium != null &&
      econ.netPremium > 0 &&
      econ.spreadWidth != null &&
      econ.spreadWidth > 0
    ) {
      const efficiency = Math.min(100, (econ.spreadWidth / econ.netPremium) * 10);
      components.push({ score: efficiency, weight: 0.10 });
    }
  }

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);

  return Math.round(Math.min(100, weightedSum / totalWeight));
}

export function calculateStrategyRisk(candidate) {
  if (!candidate || !candidate.legs || candidate.legs.length === 0) {
    return { riskLevel: 'UNAVAILABLE', riskFlags: [], riskReasons: [] };
  }

  const flags = [];
  const reasons = [];

  const riskLevels = candidate.legs
    .map((l) => l.rank?.optionsIntelligence?.riskLevel)
    .filter((r) => r != null);

  let maxRisk = 'LOW';
  let maxRiskValue = 0;
  for (const level of riskLevels) {
    const val = STRATEGY_RISK_VALUES[level] ?? 0;
    if (val > maxRiskValue) {
      maxRiskValue = val;
      maxRisk = level;
    }
  }

  if (maxRiskValue >= 3) {
    flags.push('HIGH_LEG_RISK');
    reasons.push(`One or more legs classified as ${maxRisk} risk`);
  }

  if (candidate.strategyType === 'CALL_SPREAD' || candidate.strategyType === 'PUT_SPREAD') {
    const shortLeg = candidate.legs.find((l) => l.ratio === -1);
    if (shortLeg) {
      const shortDte = n(shortLeg.contract.daysToExpiration);
      if (shortDte != null && shortDte <= 7) {
        flags.push('SHORT_LEG_SHORT_DTE');
        reasons.push('Short leg has very short DTE');
      }

      const shortVol = n(shortLeg.contract.volume);
      const shortOi = n(shortLeg.contract.openInterest);
      if ((shortVol != null && shortVol < 10) || (shortOi != null && shortOi < 10)) {
        flags.push('SHORT_LEG_LOW_LIQUIDITY');
        reasons.push('Short leg has low volume or open interest');
      }
    }
  }

  const expiries = candidate.legs
    .map((l) => l.contract.expiry)
    .filter((e) => e != null);
  if (expiries.length > 1 && new Set(expiries).size > 1) {
    flags.push('EXPIRY_MISMATCH');
    reasons.push('Legs have different expiries');
  }

  const dtes = candidate.legs
    .map((l) => n(l.contract.daysToExpiration))
    .filter((d) => d != null);
  if (dtes.length > 0) {
    const minDte = Math.min(...dtes);
    const dteRisk = classifyDteRisk(minDte);
    if (dteRisk === 'EXTREME' || dteRisk === 'HIGH') {
      flags.push('SHORT_DTE');
      reasons.push(`Short DTE (${minDte} days) increases risk`);
    }
  }

  const ivLevels = candidate.legs.map((l) => l.rank?.ivLevel).filter((i) => i != null);
  if (ivLevels.includes('EXTREME') || ivLevels.includes('HIGH')) {
    flags.push('HIGH_IV');
    reasons.push('One or more legs have elevated IV');
  }

  const hasMissingData = candidate.legs.some(
    (l) =>
      l.contract.premium == null ||
      l.contract.strike == null ||
      l.contract.volume == null ||
      l.contract.openInterest == null
  );
  if (hasMissingData) {
    flags.push('INCOMPLETE_DATA');
    reasons.push('Some legs have incomplete data');
  }

  let riskLevel = 'LOW';
  if (flags.length >= 3) riskLevel = 'EXTREME';
  else if (flags.length === 2) riskLevel = 'HIGH';
  else if (flags.length === 1) riskLevel = 'MODERATE';

  return { riskLevel, riskFlags: flags, riskReasons: reasons.slice(0, 5) };
}

export function buildStrategyReasons(candidate) {
  if (!candidate || !candidate.legs || candidate.legs.length === 0) return [];

  const reasons = [];

  const label = STRATEGY_LABELS[candidate.strategyType] || candidate.strategyType;
  reasons.push(`Strategy: ${label}`);

  const ranks = candidate.legs
    .map((l) => l.rank?.contractQuality)
    .filter((q) => q != null);
  if (ranks.length > 0) {
    const avgQuality = ranks[0];
    for (let i = 1; i < ranks.length; i++) {
      const vals = { WEAK: 0, MODERATE: 1, GOOD: 2, STRONG: 3, EXCEPTIONAL: 4 };
      if ((vals[ranks[i]] || 0) > (vals[avgQuality] || 0)) {
        reasons.push(`Leg quality: ${ranks[i]} / ${avgQuality}`);
      }
    }
  }

  const liquidityScores = candidate.legs
    .map((l) => l.rank?.optionsIntelligence?.liquidityScore)
    .filter((s) => s != null);
  if (liquidityScores.length > 0) {
    const avgLiq = Math.round(
      liquidityScores.reduce((a, b) => a + b, 0) / liquidityScores.length
    );
    if (avgLiq >= 70) reasons.push('Strong combined liquidity');
    else if (avgLiq < 50) reasons.push('Liquidity concerns across legs');
    else reasons.push(`Moderate liquidity (${avgLiq}/100)`);
  }

  if (
    candidate.strategyType === 'CALL_SPREAD' ||
    candidate.strategyType === 'PUT_SPREAD'
  ) {
    const econ = candidate.strategyEconomics;
    if (econ.spreadWidth != null) {
      reasons.push(`Spread width: $${econ.spreadWidth.toFixed(2)}/share`);
    }
    if (econ.netPremium != null) {
      const premiumLabel = econ.netPremium > 0 ? 'debit' : 'credit';
      reasons.push(`${premiumLabel} spread (net ${Math.abs(econ.netPremium).toFixed(2)}/share)`);
    }
  }

  const dtes = candidate.legs
    .map((l) => n(l.contract.daysToExpiration))
    .filter((d) => d != null);
  if (dtes.length > 0) {
    const minDte = Math.min(...dtes);
    reasons.push(`${minDte} days to expiration`);
  }

  if (candidate.strategyQuality && candidate.strategyQuality !== 'UNAVAILABLE') {
    reasons.push(`Quality: ${candidate.strategyQuality}`);
  }

  return reasons.slice(0, 6);
}

export function buildStrategyWarnings(candidate) {
  if (!candidate) return [];

  const warnings = [];

  const risk = candidate.strategyRiskFlags || [];
  for (const flag of risk) warnings.push(flag);

  if (candidate.strategyType === 'SINGLE_CALL' || candidate.strategyType === 'SINGLE_PUT') {
    warnings.push('THEORETICAL_UNLIMITED_PROFIT');
  }

  if (candidate.strategyType === 'CALL_SPREAD' || candidate.strategyType === 'PUT_SPREAD') {
    warnings.push('ASSIGNMENT_RISK');
  }

  const econ = candidate.strategyEconomics;
  if (econ && econ.maxLoss != null && econ.maxLoss > 500) {
    warnings.push('HIGH_MAX_LOSS');
  }

  return warnings;
}

export function compareStrategies(a, b) {
  const aScore = a?.strategyScore != null ? Number(a.strategyScore) : -1;
  const bScore = b?.strategyScore != null ? Number(b.strategyScore) : -1;
  return bScore - aScore;
}

export function buildStrategyCandidates(rankedContracts) {
  if (!Array.isArray(rankedContracts) || rankedContracts.length === 0) return [];

  let ranked;
  if (rankedContracts[0]?.contract) {
    ranked = rankedContracts;
  } else {
    ranked = rankOptionsContracts(rankedContracts);
  }

  if (!ranked || ranked.length === 0) return [];

  const candidates = [];

  for (const r of ranked) {
    const contract = r?.contract;
    if (!contract) continue;

    const side = contract.optionType;
    if (side === 'CALL') {
      const candidate = buildSingleLegCandidate(r, StrategyType.SINGLE_CALL);
      if (candidate) candidates.push(candidate);
    } else if (side === 'PUT') {
      const candidate = buildSingleLegCandidate(r, StrategyType.SINGLE_PUT);
      if (candidate) candidates.push(candidate);
    }
  }

  const groups = new Map();
  for (const r of ranked) {
    const contract = r.contract;
    if (!contract || !contract.expiry) continue;
    const key = `${contract.underlying || 'unknown'}_${contract.expiry}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  for (const group of groups.values()) {
    const calls = group
      .filter((r) => r.contract?.optionType === 'CALL')
      .sort((a, b) => (n(a.contract.strike) || 0) - (n(b.contract.strike) || 0));

    for (let i = 0; i < calls.length - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 4, calls.length); j++) {
        const candidate = buildSpreadCandidate(calls[i], calls[j], StrategyType.CALL_SPREAD);
        if (candidate) candidates.push(candidate);
      }
    }

    const puts = group
      .filter((r) => r.contract?.optionType === 'PUT')
      .sort((a, b) => (n(b.contract.strike) || 0) - (n(a.contract.strike) || 0));

    for (let i = 0; i < puts.length - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 4, puts.length); j++) {
        const candidate = buildSpreadCandidate(puts[i], puts[j], StrategyType.PUT_SPREAD);
        if (candidate) candidates.push(candidate);
      }
    }
  }

  for (const c of candidates) {
    c.strategyEconomics = calculateStrategyEconomics(c);
    c.strategyScore = calculateStrategyQuality(c);
    c.strategyQuality = classifyContractQuality(c.strategyScore);
    const risk = calculateStrategyRisk(c);
    c.strategyRisk = risk.riskLevel;
    c.strategyRiskFlags = risk.riskFlags;
    c.strategyRiskReasons = risk.riskReasons;
    c.strategyReasons = buildStrategyReasons(c);
    c.strategyWarnings = buildStrategyWarnings(c);
    const validation = validateStrategy(c);
    c.strategyValid = validation.valid;
  }

  return candidates.sort(compareStrategies);
}

export function buildSymbolStrategySummary(rankedContracts) {
  const candidates = buildStrategyCandidates(rankedContracts);

  if (candidates.length === 0) {
    return {
      strategyScore: null,
      strategyType: null,
      strategyQuality: 'UNAVAILABLE',
      strategyRisk: 'UNAVAILABLE',
      strategyCandidates: [],
      bestStrategy: null,
      dataStatus: 'unavailable',
    };
  }

  const best = candidates[0];
  const hasCompleteData = best.legs?.every(
    (l) =>
      l.contract &&
      l.contract.premium != null &&
      l.contract.strike != null &&
      l.contract.volume != null &&
      l.contract.openInterest != null
  );

  return {
    strategyScore: best.strategyScore,
    strategyType: best.strategyType,
    strategyQuality: best.strategyQuality,
    strategyRisk: best.strategyRisk,
    strategyCandidates: candidates.slice(0, 10),
    bestStrategy: best,
    dataStatus: hasCompleteData ? 'complete' : 'partial',
  };
}

// ============================================================================
// OPTIONS STRATEGY DECISION & COMPARISON (A2.8)
// ============================================================================

function calculateLegExecutionScore(contract) {
  if (!contract) return null;

  const spreadPct = n(contract.spreadPct);
  const volume = n(contract.volume);
  const oi = n(contract.openInterest);
  const liquidityScore = n(contract.liquidityScore);
  const premium = n(contract.premium);

  if (spreadPct == null && volume == null && oi == null && liquidityScore == null) {
    return null;
  }

  let score = 50;

  if (spreadPct != null) {
    if (spreadPct <= 5) score += 20;
    else if (spreadPct <= 15) score += 10;
    else if (spreadPct <= 35) score -= 5;
    else score -= 20;
  }

  if (volume != null) {
    if (volume >= 1000) score += 15;
    else if (volume >= 500) score += 10;
    else if (volume >= 100) score += 5;
    else if (volume < 10) score -= 10;
  }

  if (oi != null) {
    if (oi >= 1000) score += 15;
    else if (oi >= 500) score += 10;
    else if (oi >= 100) score += 5;
    else if (oi < 10) score -= 10;
  }

  if (liquidityScore != null) {
    if (liquidityScore >= 80) score += 10;
    else if (liquidityScore >= 60) score += 5;
    else if (liquidityScore < 40) score -= 10;
  }

  if (premium != null && premium > 0 && premium <= 1) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

function calculateStrategyDataQuality(strategy) {
  if (!strategy || !strategy.legs || strategy.legs.length === 0) return null;

  const requiredFields = [
    'premium', 'strike', 'volume', 'openInterest',
    'bid', 'ask', 'daysToExpiration', 'impliedVolatility',
  ];

  let total = 0;
  let available = 0;

  for (const leg of strategy.legs) {
    if (!leg.contract) continue;
    for (const field of requiredFields) {
      total++;
      if (leg.contract[field] != null) available++;
    }
  }

  return total > 0 ? Math.round((available / total) * 100) : null;
}

export function calculateStrategyDecisionScore(strategy) {
  if (!strategy || !strategy.legs || strategy.legs.length === 0) return null;

  const components = [];

  if (strategy.strategyScore != null) {
    components.push({ score: strategy.strategyScore, weight: 0.30 });
  }

  const riskAdjustedScores = strategy.legs
    .map((l) => l.rank?.riskAdjustedScore)
    .filter((s) => s != null);
  if (riskAdjustedScores.length > 0) {
    const avg = riskAdjustedScores.reduce((a, b) => a + b, 0) / riskAdjustedScores.length;
    components.push({ score: avg, weight: 0.25 });
  }

  const execQuality = classifyStrategyExecutionQuality(strategy);
  const execMap = { EXCELLENT: 90, GOOD: 70, WATCH: 50, POOR: 25, UNAVAILABLE: null };
  const execScore = execMap[execQuality];
  if (execScore != null) components.push({ score: execScore, weight: 0.15 });

  const liquidityScores = strategy.legs
    .map((l) => l.rank?.optionsIntelligence?.liquidityScore)
    .filter((s) => s != null);
  if (liquidityScores.length > 0) {
    const avg = liquidityScores.reduce((a, b) => a + b, 0) / liquidityScores.length;
    components.push({ score: avg, weight: 0.10 });
  }

  const econQuality = calculateStrategyEconomicsQuality(strategy);
  if (econQuality != null) components.push({ score: econQuality, weight: 0.10 });

  const dtes = strategy.legs
    .map((l) => n(l.contract?.daysToExpiration))
    .filter((d) => d != null);
  if (dtes.length > 0) {
    const minDte = Math.min(...dtes);
    const dteRisk = classifyDteRisk(minDte);
    const dteScoreMap = { VERY_LOW: 90, LOW: 75, MODERATE: 60, HIGH: 35, EXTREME: 15, UNAVAILABLE: null };
    const dteScore = dteScoreMap[dteRisk];
    if (dteScore != null) components.push({ score: dteScore, weight: 0.05 });
  }

  const dataQualityScore = calculateStrategyDataQuality(strategy);
  if (dataQualityScore != null) {
    components.push({ score: dataQualityScore, weight: 0.05 });
  }

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);

  return Math.round(Math.min(100, weightedSum / totalWeight));
}

export function classifyStrategyDecisionStatus(score) {
  if (score == null) return 'UNAVAILABLE';
  const s = n(score);
  if (s == null) return 'UNAVAILABLE';
  if (s >= 85) return 'HIGH_QUALITY';
  if (s >= 70) return 'GOOD_QUALITY';
  if (s >= 55) return 'WATCH';
  return 'LOW_QUALITY';
}

export function classifyStrategyExecutionQuality(strategy) {
  if (!strategy || !strategy.legs || strategy.legs.length === 0) {
    return 'UNAVAILABLE';
  }

  const scores = [];
  for (const leg of strategy.legs) {
    const score = calculateLegExecutionScore(leg.contract);
    if (score != null) scores.push(score);
  }

  if (scores.length === 0) return 'UNAVAILABLE';

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  if (avg >= 80) return 'EXCELLENT';
  if (avg >= 65) return 'GOOD';
  if (avg >= 50) return 'WATCH';
  return 'POOR';
}

export function combineStrategyRisk(strategy) {
  if (!strategy || !strategy.legs || strategy.legs.length === 0) {
    return 'UNAVAILABLE';
  }

  let maxRiskVal = 0;
  let maxLevel = 'UNAVAILABLE';

  const levels = [
    strategy.strategyRisk,
    ...strategy.legs.map((l) => l.rank?.optionsIntelligence?.riskLevel),
    ...strategy.legs.map((l) => classifyDteRisk(n(l.contract?.daysToExpiration))),
    ...strategy.legs.map((l) => {
      const iv = n(l.contract?.impliedVolatility);
      return iv != null ? classifyIvLevel(iv) : 'UNAVAILABLE';
    }),
  ];

  for (const level of levels) {
    if (!level) continue;
    const val = STRATEGY_RISK_VALUES[level] || 0;
    if (val > maxRiskVal) {
      maxRiskVal = val;
      maxLevel = level;
    }
  }

  const ivLevels = strategy.legs.map((l) => l.rank?.ivLevel).filter((i) => i != null);
  if (ivLevels.includes('EXTREME')) {
    const val = STRATEGY_RISK_VALUES['HIGH'] || 3;
    if (val > maxRiskVal) {
      maxRiskVal = val;
      maxLevel = 'HIGH';
    }
  }

  const liquidityScores = strategy.legs
    .map((l) => l.rank?.optionsIntelligence?.liquidityScore)
    .filter((s) => s != null);
  if (liquidityScores.length > 0) {
    const avgLiq = liquidityScores.reduce((a, b) => a + b, 0) / liquidityScores.length;
    if (avgLiq < 35) {
      const val = STRATEGY_RISK_VALUES['HIGH'] || 3;
      if (val > maxRiskVal) {
        maxRiskVal = val;
        maxLevel = 'HIGH';
      }
    }
  }

  const warningCount = (strategy.strategyRiskFlags || []).length;
  if (warningCount >= 3 && maxRiskVal < STRATEGY_RISK_VALUES['HIGH']) {
    maxRiskVal = STRATEGY_RISK_VALUES['HIGH'];
    maxLevel = 'HIGH';
  }

  const reverseMap = { 0: 'UNAVAILABLE', 1: 'LOW', 2: 'MODERATE', 3: 'HIGH', 4: 'EXTREME' };
  return reverseMap[maxRiskVal] || 'UNAVAILABLE';
}

export function calculateStrategyEconomicsQuality(strategy) {
  if (!strategy || !strategy.legs || strategy.legs.length === 0) return null;

  const econ = strategy.strategyEconomics;
  if (!econ) return null;

  const t = strategy.strategyType;

  if (t === 'SINGLE_CALL') {
    const premium = n(strategy.legs[0].contract.premium);
    if (premium == null || premium <= 0) return null;

    let quality = 50;
    if (premium <= 0.1) quality += 30;
    else if (premium <= 0.25) quality += 15;
    else if (premium <= 0.5) quality += 5;
    else if (premium <= 1.0) quality -= 10;
    else quality -= 25;

    return Math.max(0, Math.min(100, quality));
  }

  if (t === 'SINGLE_PUT') {
    const premium = n(strategy.legs[0].contract.premium);
    const strike = n(strategy.legs[0].contract.strike);
    if (premium == null || premium <= 0 || strike == null) return null;

    const maxProfit = strike - premium;
    const riskRatio = maxProfit / premium;
    return Math.max(0, Math.min(100, riskRatio * 10));
  }

  if (t === 'CALL_SPREAD' || t === 'PUT_SPREAD') {
    const maxLoss = n(econ.maxLoss);
    const maxProfit = n(econ.maxProfit);

    if (maxLoss == null || maxLoss <= 0 || maxProfit == null || maxProfit < 0) {
      return null;
    }

    const rewardRisk = maxProfit / maxLoss;
    return Math.min(100, rewardRisk * 20);
  }

  return null;
}

export function compareStrategyDecisions(a, b) {
  const aScore = a?.strategyDecisionScore != null ? Number(a.strategyDecisionScore) : -1;
  const bScore = b?.strategyDecisionScore != null ? Number(b.strategyDecisionScore) : -1;
  if (bScore !== aScore) return bScore - aScore;

  const aQuality = a?.strategyQuality || '';
  const bQuality = b?.strategyQuality || '';
  const qualityOrder = { EXCEPTIONAL: 5, STRONG: 4, GOOD: 3, MODERATE: 2, WEAK: 1, UNAVAILABLE: 0 };
  const aq = qualityOrder[aQuality] || 0;
  const bq = qualityOrder[bQuality] || 0;
  if (bq !== aq) return bq - aq;

  const aRisk = STRATEGY_RISK_VALUES[a?.combinedRisk] || 0;
  const bRisk = STRATEGY_RISK_VALUES[b?.combinedRisk] || 0;
  if (aRisk !== bRisk) return aRisk - bRisk;

  const execOrder = { EXCELLENT: 4, GOOD: 3, WATCH: 2, POOR: 1, UNAVAILABLE: 0 };
  const ae = execOrder[a?.executionQuality] || 0;
  const be = execOrder[b?.executionQuality] || 0;
  return be - ae;
}

export function selectRecommendedStrategy(strategies) {
  if (!Array.isArray(strategies) || strategies.length === 0) {
    return {
      recommended: null,
      alternatives: [],
      avoid: [],
      dataStatus: 'unavailable',
    };
  }

  const sorted = [...strategies].sort(compareStrategyDecisions);

  const recommended = sorted[0];
  const alternatives = sorted.slice(1, 4).map((s) => ({
    strategyType: s.strategyType,
    symbol: s.symbol,
    strategyScore: s.strategyScore,
    strategyDecisionScore: s.strategyDecisionScore,
    decisionStatus: s.decisionStatus,
    strategyQuality: s.strategyQuality,
    combinedRisk: s.combinedRisk,
    executionQuality: s.executionQuality,
    economicsQuality: s.economicsQuality,
    economics: s.strategyEconomics,
    reasons: s.decisionReasons || [],
    flags: s.decisionFlags || [],
  }));

  const avoid = [];
  for (const s of sorted) {
    if (avoid.length >= 3) break;

    const evidence = [];
    if (s.combinedRisk === 'EXTREME') evidence.push('EXTREME_RISK');
    if (s.combinedRisk === 'HIGH') evidence.push('HIGH_RISK');
    if (s.decisionStatus === 'LOW_QUALITY') evidence.push('LOW_QUALITY');
    if (s.executionQuality === 'POOR') evidence.push('POOR_EXECUTION');

    const riskWarnings = (s.strategyWarnings || []).filter(
      (w) =>
        w.includes('INCOMPLETE_DATA') ||
        w.includes('HIGH_LEG_RISK') ||
        w.includes('HIGH_MAX_LOSS') ||
        w.includes('HIGH_IV')
    );
    for (const w of riskWarnings) evidence.push(w);

    if (evidence.length >= 2) {
      avoid.push({
        strategyType: s.strategyType,
        symbol: s.symbol,
        strategyDecisionScore: s.strategyDecisionScore,
        reasons: evidence,
      });
    }
  }

  const hasCompleteData = sorted.some((s) =>
    s.legs?.every(
      (l) =>
        l.contract &&
        l.contract.premium != null &&
        l.contract.strike != null
    )
  );

  return {
    recommended,
    alternatives,
    avoid,
    dataStatus: hasCompleteData ? 'complete' : 'partial',
  };
}

export function buildStrategyDecisionReasons(strategy) {
  if (!strategy) return [];

  const reasons = [];

  if (strategy.strategyDecisionScore != null) {
    reasons.push(`Decision score: ${strategy.strategyDecisionScore}/100`);
  }

  if (strategy.strategyQuality) {
    reasons.push(`Strategy quality: ${strategy.strategyQuality}`);
  }

  if (strategy.executionQuality && strategy.executionQuality !== 'UNAVAILABLE') {
    reasons.push(`Execution: ${strategy.executionQuality}`);
  }

  if (strategy.economicsQuality != null) {
    if (strategy.economicsQuality >= 80) reasons.push('Favorable economics (reward/risk)');
    else if (strategy.economicsQuality < 50) reasons.push('Unfavorable economics (reward/risk)');
  }

  const econ = strategy.strategyEconomics;
  if (econ) {
    if (
      econ.spreadWidth != null &&
      (strategy.strategyType === 'CALL_SPREAD' || strategy.strategyType === 'PUT_SPREAD')
    ) {
      reasons.push(`Spread width: $${econ.spreadWidth.toFixed(2)}/share`);
    }
    if (econ.maxLoss != null && econ.maxLoss > 0) {
      reasons.push(`Max risk: $${econ.maxLoss.toFixed(2)}`);
    }
  }

  const ranks = strategy.legs
    ?.map((l) => l.rank?.contractQuality)
    .filter((q) => q != null);
  if (ranks && ranks.length > 0) {
    const qualityVals = { WEAK: 0, MODERATE: 1, GOOD: 2, STRONG: 3, EXCEPTIONAL: 4 };
    const allTop = ranks.every((r) => (qualityVals[r] || 0) >= qualityVals['GOOD']);
    if (allTop) reasons.push('All legs top-ranked');
  }

  return reasons.slice(0, 6);
}

export function buildStrategyDecisionWarnings(strategy) {
  if (!strategy) return [];

  const warnings = [...new Set(strategy.strategyWarnings || [])];

  if (strategy.combinedRisk === 'EXTREME' || strategy.combinedRisk === 'HIGH') {
    warnings.push('HIGH_STRATEGY_RISK');
  }

  if (strategy.executionQuality === 'POOR') {
    warnings.push('POOR_EXECUTION_ALL_LEGS');
  }

  if (strategy.decisionStatus === 'LOW_QUALITY') {
    warnings.push('LOW_QUALITY_DECISION');
  }

  const econ = strategy.strategyEconomics;
  if (econ?.maxLoss != null && econ.maxLoss > 500) {
    if (!warnings.includes('HIGH_MAX_LOSS')) warnings.push('HIGH_MAX_LOSS');
  }

  return [...new Set(warnings)];
}

export function buildStrategyDecisionFlags(strategy) {
  if (!strategy) return [];

  const flags = [];

  if (strategy.strategyDecisionScore != null && strategy.strategyDecisionScore >= 85) {
    flags.push('TOP_RANKED');
  }

  if (
    strategy.decisionStatus === 'HIGH_QUALITY' ||
    strategy.decisionStatus === 'GOOD_QUALITY'
  ) {
    flags.push('HIGH_QUALITY');
  }

  if (
    strategy.executionQuality === 'EXCELLENT' ||
    strategy.executionQuality === 'GOOD'
  ) {
    flags.push('GOOD_EXECUTION');
  }

  if (strategy.combinedRisk === 'LOW') {
    flags.push('LOW_RISK');
  }

  if (
    strategy.strategyType === 'CALL_SPREAD' ||
    strategy.strategyType === 'PUT_SPREAD'
  ) {
    flags.push('DEFINED_RISK');
  }

  if (
    strategy.strategyType === 'SINGLE_CALL' ||
    strategy.strategyType === 'SINGLE_PUT'
  ) {
    flags.push('LIMITED_RISK_PREMIUM');
  }

  if (strategy.economicsQuality != null && strategy.economicsQuality >= 70) {
    flags.push('FAVORABLE_ECONOMICS');
  }

  if (
    strategy.decisionStatus === 'LOW_QUALITY' ||
    strategy.combinedRisk === 'EXTREME' ||
    strategy.combinedRisk === 'HIGH'
  ) {
    flags.push('HIGH_RISK');
  }

  return flags;
}

export function enrichStrategyWithDecision(strategy) {
  if (!strategy || !strategy.legs || strategy.legs.length === 0) return strategy;

  const score = calculateStrategyDecisionScore(strategy);
  strategy.strategyDecisionScore = score;
  strategy.decisionStatus = classifyStrategyDecisionStatus(score);
  strategy.classifiedExecutionQuality = classifyStrategyExecutionQuality(strategy);
  strategy.combinedRisk = combineStrategyRisk(strategy);
  strategy.economicsQuality = calculateStrategyEconomicsQuality(strategy);
  strategy.decisionReasons = buildStrategyDecisionReasons(strategy);
  strategy.decisionWarnings = buildStrategyDecisionWarnings(strategy);
  strategy.decisionFlags = buildStrategyDecisionFlags(strategy);

  return strategy;
}

export function buildSymbolStrategyDecisionSummary(rankedContracts) {
  const summary = buildSymbolStrategySummary(rankedContracts);

  if (summary.strategyCandidates && summary.strategyCandidates.length > 0) {
    summary.strategyCandidates = summary.strategyCandidates.map(enrichStrategyWithDecision);
  }
  if (summary.bestStrategy) {
    enrichStrategyWithDecision(summary.bestStrategy);
  }

  const selection = selectRecommendedStrategy(summary.strategyCandidates || []);
  summary.recommendedStrategy = selection.recommended;
  summary.alternativeStrategies = selection.alternatives;
  summary.avoidStrategies = selection.avoid;
  summary.selectionDataStatus = selection.dataStatus;

  if (summary.recommendedStrategy) {
    summary.strategyDecisionScore = summary.recommendedStrategy.strategyDecisionScore;
    summary.decisionStatus = summary.recommendedStrategy.decisionStatus;
    summary.combinedRisk = summary.recommendedStrategy.combinedRisk;
    summary.classifiedExecutionQuality = summary.recommendedStrategy.classifiedExecutionQuality;
  }

  return summary;
}

