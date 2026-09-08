/**
 * Live Opportunity Stream
 *
 * Detects short-term opportunities from live market pulse data.
 * This is a scoring/classification layer — NOT a trading signal generator.
 *
 * Opportunities are detected when:
 * - Price momentum aligns with volume pressure
 * - RSI is in a favorable zone
 * - Freshness is FRESH (not stale)
 *
 * Each opportunity includes a status, score, and evidence trail.
 */

function n(v) {
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}

/**
 * @typedef {Object} OpportunityResult
 * @property {string} symbol
 * @property {string} status - 'OPPORTUNITY' | 'WATCH' | 'NO_OPPORTUNITY' | 'INSUFFICIENT_DATA' | 'STALE_DATA' | 'ERROR'
 * @property {string|null} direction - 'LONG' | 'SHORT' | 'NEUTRAL' | null
 * @property {number|null} score - 0-100 opportunity score
 * @property {string} quality - 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE'
 * @property {string[]} evidence
 * @property {string[]} warnings
 * @property {string} disclaimer
 */

const DISCLAIMER = 'Live opportunity detection is derived from polled market data. Not a trading recommendation.';

/**
 * Detect an opportunity from a pulse result.
 * @param {Object} pulse - PulseResult from live-market-pulse.js
 * @returns {OpportunityResult}
 */
export function detectLiveOpportunity(pulse) {
  const evidence = [];
  const warnings = [];

  if (!pulse || typeof pulse !== 'object') {
    return {
      symbol: pulse?.symbol || 'UNKNOWN',
      status: 'ERROR', direction: null, score: null,
      quality: 'UNAVAILABLE', evidence: ['No pulse data'],
      warnings: [], disclaimer: DISCLAIMER,
    };
  }

  const { symbol, direction, pressure, momentumScore, volumePressure, rsiShift, status: pulseStatus } = pulse;

  // Propagate pulse errors
  if (pulseStatus === 'ERROR') {
    return {
      symbol, status: 'ERROR', direction: null, score: null,
      quality: 'UNAVAILABLE', evidence: pulse.evidence || ['Pulse error'],
      warnings: [], disclaimer: DISCLAIMER,
    };
  }

  if (pulseStatus === 'STALE_DATA') {
    return {
      symbol, status: 'STALE_DATA', direction: null, score: null,
      quality: 'UNAVAILABLE', evidence: ['Stale market data'],
      warnings: ['Data delayed >48h'], disclaimer: DISCLAIMER,
    };
  }

  if (pulseStatus === 'INSUFFICIENT_DATA') {
    return {
      symbol, status: 'INSUFFICIENT_DATA', direction: null, score: null,
      quality: 'UNAVAILABLE', evidence: ['Insufficient data for analysis'],
      warnings: [], disclaimer: DISCLAIMER,
    };
  }

  // Score opportunity
  const components = [];
  if (momentumScore != null) components.push({ name: 'momentum', value: momentumScore, weight: 0.40 });
  if (volumePressure != null) components.push({ name: 'volume', value: volumePressure, weight: 0.35 });
  if (rsiShift != null) {
    const rsiComponent = Math.round(50 + rsiShift * 5);
    components.push({ name: 'rsiShift', value: Math.max(0, Math.min(100, rsiComponent)), weight: 0.25 });
  }

  if (components.length === 0) {
    return {
      symbol, status: 'INSUFFICIENT_DATA', direction: null, score: null,
      quality: 'UNAVAILABLE', evidence: ['No scorable components'],
      warnings: [], disclaimer: DISCLAIMER,
    };
  }

  const totalWeight = components.reduce((a, c) => a + c.weight, 0);
  const score = Math.round(
    components.reduce((a, c) => a + c.value * c.weight, 0) / totalWeight
  );

  // Build evidence
  for (const c of components) {
    evidence.push(`${c.name}: ${c.value}`);
  }

  // Determine status
  let status;
  if (score >= 70) status = 'OPPORTUNITY';
  else if (score >= 50) status = 'WATCH';
  else status = 'NO_OPPORTUNITY';

  // Quality
  let quality;
  if (score >= 80) quality = 'HIGH';
  else if (score >= 60) quality = 'MEDIUM';
  else if (score >= 40) quality = 'LOW';
  else quality = 'UNAVAILABLE';

  // Warnings
  if (pressure != null && pressure >= 80) {
    warnings.push('Extreme pressure — may indicate overextension');
  }
  if (direction === 'BULLISH' && rsiShift != null && rsiShift > 5) {
    warnings.push('Rapid RSI increase — momentum may be exhausted');
  }

  return {
    symbol,
    status,
    direction: direction === 'BULLISH' ? 'LONG' : direction === 'BEARISH' ? 'SHORT' : 'NEUTRAL',
    score,
    quality,
    evidence,
    warnings,
    disclaimer: DISCLAIMER,
  };
}
