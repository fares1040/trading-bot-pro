const n = (value) => {
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
};

export function calculateATR(highs, lows, closes, period = 14) {
  const safeHighs = (Array.isArray(highs) ? highs : []).map(Number).filter(Number.isFinite);
  const safeLows = (Array.isArray(lows) ? lows : []).map(Number).filter(Number.isFinite);
  const safeCloses = (Array.isArray(closes) ? closes : []).map(Number).filter(Number.isFinite);

  const len = Math.min(safeHighs.length, safeLows.length, safeCloses.length);
  if (len < period + 1) return null;

  const tr = [];
  for (let i = 1; i < len; i++) {
    const high = safeHighs[i];
    const low = safeLows[i];
    const prevClose = safeCloses[i - 1];
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(prevClose)) continue;
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }

  if (tr.length < period) return null;

  const start = tr.slice(0, period).reduce((sum, value) => sum + value, 0);
  let atr = start / period;

  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
  }

  return Number.isFinite(atr) ? atr : null;
}

export function scorePennySetup(setupScore) {
  return Math.max(0, Math.min(100, n(setupScore) ?? 0));
}

export function scorePennyRvol(relativeVolume) {
  const rvol = n(relativeVolume);
  return rvol == null ? 0 : Math.min(100, rvol * 40);
}

export function scorePennyRsi(rsi) {
  const value = n(rsi);
  if (value == null) return 0;
  if (value >= 45 && value <= 72) return 100;
  if (value >= 35 && value <= 78) return 70;
  return 30;
}

export function calculatePennyScore(item) {
  const setup = scorePennySetup(item.setupScore);
  const rvolScore = scorePennyRvol(item.relativeVolume);
  const rsiScore = scorePennyRsi(item.rsi);
  return Math.round(Math.min(100, setup * 0.65 + rvolScore * 0.20 + rsiScore * 0.15));
}

export function calculateSupportProximity(price, support) {
  const p = n(price);
  const s = n(support);
  if (p == null || s == null || p <= 0 || s <= 0) return null;
  const distancePercent = ((p - s) / p) * 100;
  if (distancePercent <= 2) return 'very-near';
  if (distancePercent <= 5) return 'near';
  return 'far';
}

export function calculateResistanceProximity(price, resistance) {
  const p = n(price);
  const r = n(resistance);
  if (p == null || r == null || p <= 0 || r <= 0) return null;
  const distancePercent = ((r - p) / p) * 100;
  if (distancePercent <= 2) return 'very-near';
  if (distancePercent <= 5) return 'near';
  return 'far';
}

export function classifyBreakoutProximity(price, resistance, breakoutScore) {
  if (price == null || resistance == null || breakoutScore == null) return 'unavailable';
  const p = n(price);
  const r = n(resistance);
  const bs = n(breakoutScore);
  if (p == null || r == null || bs == null || p <= 0 || r <= 0) return 'unavailable';
  const distancePercent = ((r - p) / p) * 100;
  if (distancePercent <= 0) return 'breakout';
  if (distancePercent <= 1 && bs >= 88) return 'breakout';
  if (distancePercent <= 2 && bs >= 75) return 'near-breakout';
  if (bs >= 60) return 'watch';
  return 'unavailable';
}

export function calculateStructureScore({ price, support, resistance, breakoutScore, clusterScore }) {
  const supportProx = calculateSupportProximity(price, support);
  const resistanceProx = calculateResistanceProximity(price, resistance);
  const bs = n(breakoutScore);
  const cs = n(clusterScore);

  const supportScore = supportProx === 'very-near' ? 60 : supportProx === 'near' ? 80 : supportProx === 'far' ? 70 : 50;
  const resistanceScore = resistanceProx === 'very-near' ? 40 : resistanceProx === 'near' ? 60 : resistanceProx === 'far' ? 80 : 50;
  const breakoutComponent = bs != null ? bs : 50;
  const clusterComponent = cs != null ? cs : 50;

  return Math.round(Math.min(100, supportScore * 0.25 + resistanceScore * 0.25 + breakoutComponent * 0.25 + clusterComponent * 0.25));
}

export function generateEntryTargetZones(price, support, resistance, atr) {
  const p = n(price);
  const s = n(support);
  const r = n(resistance);
  const a = n(atr);

  if (p == null || p <= 0) return { entryZone: null, targetZone: null };

  const entryZone = s != null && s > 0 ? `$${s.toFixed(2)} - $${(s * 1.02).toFixed(2)}` : null;
  const targetZone = r != null && r > 0 ? `$${r.toFixed(2)}` : null;

  return { entryZone, targetZone };
}

export function calculateDollarVolume(price, volume) {
  if (price == null || volume == null) return null;
  const p = n(price);
  const v = n(volume);
  if (p == null || v == null || p <= 0 || v <= 0) return null;
  const result = p * v;
  return Number.isFinite(result) ? result : null;
}

export function classifyDollarVolume(dollarVolume) {
  if (dollarVolume == null) return 'unavailable';
  const dv = n(dollarVolume);
  if (dv == null) return 'unavailable';
  if (dv >= 5_000_000) return 'strong';
  if (dv >= 1_000_000) return 'healthy';
  if (dv >= 500_000) return 'low';
  return 'very-low';
}

export function calculateVolumeQuality({ volume, averageVolume20, relativeVolume }) {
  if (volume == null || averageVolume20 == null || relativeVolume == null) return { score: null, quality: 'unavailable' };

  const vol = n(volume);
  const avg = n(averageVolume20);
  const rvol = n(relativeVolume);

  if (vol == null || avg == null || rvol == null) return { score: null, quality: 'unavailable' };

  let score = 50;
  if (rvol >= 2.0) score += 30;
  else if (rvol >= 1.5) score += 20;
  else if (rvol >= 1.0) score += 10;
  else score -= 20;

  if (vol > avg) score += 10;
  else if (vol < avg * 0.5) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let quality = 'moderate';
  if (score >= 85) quality = 'excellent';
  else if (score >= 70) quality = 'good';
  else if (score >= 50) quality = 'moderate';
  else if (score >= 25) quality = 'weak';
  else quality = 'weak';

  return { score, quality };
}

export function calculatePennyLiquidityScore({ liquidityScore, dollarVolume, volumeQualityScore }) {
  if (liquidityScore != null && liquidityScore > 0) return Math.round(Math.min(100, n(liquidityScore)));

  const dv = dollarVolume != null ? n(dollarVolume) : null;
  const vqs = volumeQualityScore != null ? n(volumeQualityScore) : null;
  const fallback = dv == null && vqs == null ? null : Math.round(Math.min(100, (vqs ?? 50) * 0.6 + (dv != null ? 40 : 0)));

  return fallback ?? 50;
}

export function getLiquidityWarning(dollarVolume) {
  if (dollarVolume == null) return 'unavailable';
  const dv = n(dollarVolume);
  if (dv == null) return 'unavailable';
  if (dv < 250_000) return 'very-low-liquidity';
  if (dv < 500_000) return 'low-liquidity';
  if (dv < 1_000_000) return 'watch';
  return 'healthy';
}

export function getLiquidityFlags({ relativeVolume, dollarVolume, volumeQualityScore }) {
  const flags = [];
  const rvol = relativeVolume != null ? n(relativeVolume) : null;
  const dv = dollarVolume != null ? n(dollarVolume) : null;
  const vqs = volumeQualityScore != null ? n(volumeQualityScore) : null;

  if (dv != null && dv < 500_000) flags.push('LOW_DOLLAR_VOLUME');
  if (rvol != null && rvol < 1.0) flags.push('WEAK_VOLUME');
  if (vqs != null && vqs < 50) flags.push('LOW_LIQUIDITY');
  if (rvol != null && rvol >= 1.5 && dv != null && dv < 1_000_000) flags.push('HIGH_RVOL_LOW_LIQUIDITY');

  return flags;
}

export function buildPennyReasons(item) {
  const reasons = [];
  if (n(item.setupScore) != null) reasons.push(`Technical ${Math.round(n(item.setupScore))}/100`);
  if (n(item.relativeVolume) != null) reasons.push(`RVOL ${Number(item.relativeVolume).toFixed(2)}x`);
  if (n(item.rsi) != null) reasons.push(`RSI ${Number(item.rsi).toFixed(1)}`);
  if (n(item.averageVolume20) != null) reasons.push(`Avg Vol 20 ${Math.round(n(item.averageVolume20)).toLocaleString()}`);
  return reasons.slice(0, 4);
}

export function calculateLiquidityRisk({ dollarVolume, volumeQualityScore, liquidityScore, liquidityWarning, liquidityFlags }) {
  const dv = n(dollarVolume);
  const vqs = n(volumeQualityScore);
  const ls = n(liquidityScore);

  let risk = 30;

  if (dv != null) {
    if (dv < 250_000) risk += 40;
    else if (dv < 500_000) risk += 30;
    else if (dv < 1_000_000) risk += 15;
    else risk -= 10;
  }

  if (vqs != null) {
    if (vqs < 40) risk += 20;
    else if (vqs < 60) risk += 10;
    else if (vqs >= 80) risk -= 5;
  }

  if (ls != null && ls < 55) risk += 10;

  const flags = Array.isArray(liquidityFlags) ? liquidityFlags : [];
  if (flags.includes('HIGH_RVOL_LOW_LIQUIDITY')) risk += 15;
  if (flags.includes('LOW_DOLLAR_VOLUME')) risk += 10;

  if (liquidityWarning === 'very-low-liquidity') risk += 10;
  else if (liquidityWarning === 'low-liquidity') risk += 5;
  else if (liquidityWarning === 'healthy') risk -= 5;

  return Math.max(0, Math.min(100, risk));
}

export function calculateVolatilityRisk({ price, atr, changePercent }) {
  const p = n(price);
  const a = n(atr);
  const cp = n(changePercent);

  if (p == null || p <= 0 || a == null || a <= 0) return null;

  let risk = 30;

  const atrPercent = (a / p) * 100;
  if (atrPercent >= 10) risk += 35;
  else if (atrPercent >= 7) risk += 25;
  else if (atrPercent >= 5) risk += 15;
  else if (atrPercent >= 3) risk += 5;

  if (cp != null) {
    const absChange = Math.abs(cp);
    if (absChange >= 30) risk += 25;
    else if (absChange >= 20) risk += 15;
    else if (absChange >= 10) risk += 5;
  }

  return Math.max(0, Math.min(100, risk));
}

export function calculateResistanceRisk({ resistanceDistancePercent, resistanceProximity }) {
  if (resistanceDistancePercent == null && resistanceProximity == null) return null;

  const prox = resistanceProximity;
  if (prox === 'very-near') return 80;
  if (prox === 'near') return 50;
  if (prox === 'far') return 20;

  const dist = n(resistanceDistancePercent);
  if (dist == null) return null;

  if (dist <= 2) return 80;
  if (dist <= 5) return 50;
  if (dist <= 10) return 30;
  return 15;
}

export function calculateStructureRisk({ structureScore, breakoutScore, clusterScore }) {
  const ss = n(structureScore);
  const bs = n(breakoutScore);
  const cs = n(clusterScore);

  if (ss == null && bs == null && cs == null) return null;

  let risk = 40;

  if (ss != null) {
    if (ss >= 75) risk -= 15;
    else if (ss >= 60) risk -= 5;
    else if (ss < 40) risk += 20;
  }

  if (bs != null) {
    if (bs >= 80) risk -= 10;
    else if (bs < 50) risk += 15;
  }

  if (cs != null) {
    if (cs >= 75) risk -= 5;
    else if (cs < 40) risk += 10;
  }

  return Math.max(0, Math.min(100, risk));
}

export function calculateVolumeTrapRisk({ relativeVolume, dollarVolume, volumeQualityScore, liquidityFlags }) {
  const rvol = n(relativeVolume);
  const dv = n(dollarVolume);
  const vqs = n(volumeQualityScore);

  if (rvol == null && dv == null && vqs == null) return null;

  let risk = 20;

  if (rvol != null && dv != null) {
    if (rvol >= 1.5 && dv < 1_000_000) risk += 35;
    if (rvol >= 2.0 && dv < 500_000) risk += 20;
  }

  if (vqs != null && vqs < 50) risk += 15;

  const flags = Array.isArray(liquidityFlags) ? liquidityFlags : [];
  if (flags.includes('HIGH_RVOL_LOW_LIQUIDITY')) risk += 15;
  if (flags.includes('WEAK_VOLUME')) risk += 10;

  return Math.max(0, Math.min(100, risk));
}

export function calculateMomentumRisk({ rsi, changePercent, breakoutProximity }) {
  const rsiVal = n(rsi);
  const cp = n(changePercent);
  const bp = breakoutProximity;

  if (rsiVal == null && cp == null && bp == null) return null;

  let risk = 25;

  if (rsiVal != null) {
    if (rsiVal >= 80) risk += 30;
    else if (rsiVal >= 75) risk += 20;
    else if (rsiVal <= 20) risk += 15;
    else if (rsiVal <= 25) risk += 10;
  }

  if (cp != null) {
    const absChange = Math.abs(cp);
    if (absChange >= 40) risk += 25;
    else if (absChange >= 25) risk += 15;
    else if (absChange >= 15) risk += 5;
  }

  if (bp === 'breakout' || bp === 'near-breakout') risk += 5;

  return Math.max(0, Math.min(100, risk));
}

export function calculatePennyRiskScore({
  liquidityRisk,
  volatilityRisk,
  resistanceRisk,
  structureRisk,
  volumeTrapRisk,
  momentumRisk,
}) {
  const components = [
    { key: 'liquidityRisk', value: n(liquidityRisk), weight: 0.25 },
    { key: 'volatilityRisk', value: n(volatilityRisk), weight: 0.20 },
    { key: 'resistanceRisk', value: n(resistanceRisk), weight: 0.15 },
    { key: 'structureRisk', value: n(structureRisk), weight: 0.15 },
    { key: 'volumeTrapRisk', value: n(volumeTrapRisk), weight: 0.15 },
    { key: 'momentumRisk', value: n(momentumRisk), weight: 0.10 },
  ];

  const available = components.filter((c) => c.value != null);

  if (available.length === 0) return null;

  let totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  let weightedSum = available.reduce((sum, c) => sum + c.value * c.weight, 0);

  const score = Math.round(weightedSum / totalWeight);

  return Math.max(0, Math.min(100, score));
}

export function classifyPennyRisk(riskScore) {
  if (riskScore == null) return 'unavailable';
  const score = n(riskScore);
  if (score == null) return 'unavailable';
  if (score <= 39) return 'low';
  if (score <= 59) return 'moderate';
  if (score <= 79) return 'high';
  return 'extreme';
}

export function getPennyRiskLabel(riskLevel) {
  const map = {
    low: 'LOW RISK',
    moderate: 'MODERATE RISK',
    high: 'HIGH RISK',
    extreme: 'EXTREME RISK',
    unavailable: 'RISK UNAVAILABLE',
  };
  return map[riskLevel] || 'RISK UNAVAILABLE';
}

export function getPennyRiskFlags({
  liquidityRisk,
  volatilityRisk,
  resistanceRisk,
  structureRisk,
  volumeTrapRisk,
  momentumRisk,
  liquidityFlags,
}) {
  const flags = [];
  const lr = n(liquidityRisk);
  const vr = n(volatilityRisk);
  const rr = n(resistanceRisk);
  const sr = n(structureRisk);
  const vtr = n(volumeTrapRisk);
  const mr = n(momentumRisk);

  if (lr != null && lr >= 60) flags.push('LOW_LIQUIDITY_RISK');
  if (vr != null && vr >= 60) flags.push('HIGH_VOLATILITY');
  if (rr != null && rr >= 60) flags.push('NEAR_RESISTANCE');
  if (sr != null && sr >= 60) flags.push('WEAK_STRUCTURE');
  if (vtr != null && vtr >= 50) flags.push('VOLUME_TRAP');
  if (mr != null && mr >= 60) flags.push('EXTENDED_MOMENTUM');

  const liqFlags = Array.isArray(liquidityFlags) ? liquidityFlags : [];
  if (liqFlags.includes('HIGH_RVOL_LOW_LIQUIDITY')) flags.push('VOLUME_TRAP');

  return flags;
}

export function buildRiskReasons({
  liquidityRisk,
  volatilityRisk,
  resistanceRisk,
  structureRisk,
  volumeTrapRisk,
  momentumRisk,
  dollarVolume,
  liquidityFlags,
  atr,
  price,
  resistanceDistancePercent,
  rsi,
  changePercent,
  breakoutProximity,
}) {
  const reasons = [];
  const dv = n(dollarVolume);
  const liqFlags = Array.isArray(liquidityFlags) ? liquidityFlags : [];

  if (liqFlags.includes('HIGH_RVOL_LOW_LIQUIDITY')) reasons.push('High RVOL with weak liquidity');
  else if (liqFlags.includes('LOW_DOLLAR_VOLUME') || (dv != null && dv < 500_000)) reasons.push('Low dollar volume');
  else if (liquidityRisk != null && liquidityRisk >= 60) reasons.push('Low liquidity risk');

  const a = n(atr);
  const p = n(price);
  if (a != null && p != null && p > 0) {
    const atrPercent = (a / p) * 100;
    if (atrPercent >= 8) reasons.push('High ATR relative to price');
  }

  const dist = n(resistanceDistancePercent);
  if (dist != null && dist <= 3) reasons.push('Price near resistance');

  if (structureRisk != null && structureRisk >= 60) reasons.push('Weak technical structure');
  else if (structureRisk != null && structureRisk >= 50) reasons.push('Moderate technical structure');

  const cp = n(changePercent);
  if (cp != null && Math.abs(cp) >= 25) reasons.push('Extreme daily move');

  const rsiVal = n(rsi);
  if (rsiVal != null && rsiVal >= 80) reasons.push('Momentum appears extended');
  else if (rsiVal != null && rsiVal <= 20) reasons.push('Oversold momentum');

  if (breakoutProximity === 'near-breakout') reasons.push('Approaching breakout level');

  return reasons.slice(0, 5);
}
