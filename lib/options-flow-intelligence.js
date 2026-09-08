/** Provider-neutral options flow foundation. No live provider is added here. */

export const OPTIONS_FLOW_VERSION = '1.0';
export const OPTIONS_FLOW_MODE = 'DERIVED';

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const clamp = (v) => Math.max(0, Math.min(100, v));
const fresh = (x) => x?.freshness?.status === 'FRESH' && x?.freshness?.isFresh === true;

export function normalizeOptionsFlowObservation(input = {}) {
  const type = String(input.type || 'UNKNOWN').toUpperCase();
  const side = String(input.side || input.direction || 'UNKNOWN').toUpperCase();
  return {
    symbol: input.symbol ?? null,
    contractSymbol: input.contractSymbol ?? null,
    type: ['CALL','PUT'].includes(type) ? type : 'UNKNOWN',
    side: ['BUY','SELL','NEUTRAL'].includes(side) ? side : 'UNKNOWN',
    strike: num(input.strike),
    expiration: input.expiration ?? null,
    premium: num(input.premium),
    volume: num(input.volume),
    openInterest: num(input.openInterest),
    impliedVolatility: num(input.impliedVolatility),
    freshness: input.freshness ?? null,
  };
}

export function analyzeOptionsFlow(observations = []) {
  const normalized = Array.isArray(observations) ? observations.map(normalizeOptionsFlowObservation) : [];
  const usable = normalized.filter((x) => fresh(x) && (x.type === 'CALL' || x.type === 'PUT'));
  let callPremium = 0, putPremium = 0, callVolume = 0, putVolume = 0, callOI = 0, putOI = 0;
  for (const x of usable) {
    const premium = x.premium > 0 ? x.premium : 0;
    const volume = x.volume > 0 ? x.volume : 0;
    const oi = x.openInterest > 0 ? x.openInterest : 0;
    if (x.type === 'CALL') { callPremium += premium; callVolume += volume; callOI += oi; }
    else { putPremium += premium; putVolume += volume; putOI += oi; }
  }
  const premiumTotal = callPremium + putPremium;
  const pressureScore = premiumTotal > 0 ? clamp((callPremium / premiumTotal) * 100) :
    (callVolume + putVolume > 0 ? clamp((callVolume / (callVolume + putVolume)) * 100) : 50);
  const direction = premiumTotal === 0 && callVolume + putVolume === 0 ? 'UNKNOWN' : pressureScore > 55 ? 'CALL' : pressureScore < 45 ? 'PUT' : 'NEUTRAL';
  return {
    version: OPTIONS_FLOW_VERSION, mode: OPTIONS_FLOW_MODE,
    observationCount: usable.length,
    callPremium, putPremium, callVolume, putVolume, callOI, putOI,
    pressureScore, direction,
    dataQuality: usable.length ? 'OBSERVED' : 'INSUFFICIENT_DATA',
    evidence: [
      ...(premiumTotal > 0 ? ['PREMIUM_PRESSURE'] : []),
      ...(callVolume + putVolume > 0 ? ['VOLUME_PRESSURE'] : []),
      ...(callOI + putOI > 0 ? ['OPEN_INTEREST_CONTEXT'] : []),
    ],
    disclaimer: 'Derived options-flow pressure only. It does not identify institutional or whale activity without provider attribution evidence.',
  };
}
