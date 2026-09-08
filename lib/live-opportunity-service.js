/**
 * Live Opportunity Service
 *
 * Orchestration layer that combines:
 * 1. Live market data fetching
 * 2. Process-local history management
 * 3. Market pulse analysis
 * 4. Opportunity detection
 * 5. Acceleration detection
 *
 * This module does NOT persist state. History is process-local only.
 * On serverless cold start, history is empty — first call returns INSUFFICIENT_DATA.
 *
 * This module does NOT modify C7/C8/C9/C10 scoring.
 * This module does NOT fabricate data.
 */

import {
  fetchLiveSnapshot,
  updateHistory,
  getHistory,
  hasEnoughHistory,
} from './live-market-data.js';

import {
  buildLiveMarketPulse,
  buildLiveMarketPulseWithHistory,
} from './live-market-pulse.js';

import { detectLiveOpportunity } from './live-opportunity-stream.js';
import { detectAcceleration } from './acceleration-radar.js';

const SYMBOL_RE = /^[A-Z][A-Z0-9.^=-]{0,11}$/;
const MAX_SYMBOLS = 10;

/**
 * @typedef {Object} LiveOpportunityEntry
 * @property {string} symbol
 * @property {string} status
 * @property {string} freshness
 * @property {Object} pulse
 * @property {Object} opportunity
 * @property {Object} acceleration
 * @property {string[]} evidence
 */

/**
 * @typedef {Object} LiveOpportunityResult
 * @property {boolean} success
 * @property {string} source
 * @property {string} mode
 * @property {string} generatedAt
 * @property {LiveOpportunityEntry[]} data
 * @property {Object[]} errors
 * @property {string} disclaimer
 */

/**
 * Normalize and validate a symbol string.
 * @param {string} raw
 * @returns {string|null} normalized uppercase symbol or null if invalid
 */
function normalizeSymbol(raw) {
  const clean = String(raw || '').trim().toUpperCase();
  return SYMBOL_RE.test(clean) ? clean : null;
}

/**
 * Process a single symbol through the live opportunity pipeline.
 * @param {string} symbol - validated uppercase symbol
 * @returns {Promise<LiveOpportunityEntry>}
 */
async function processSymbol(symbol) {
  const evidence = [];

  // 1. Fetch live snapshot
  const snapshot = await fetchLiveSnapshot(symbol);

  // 2. Update process-local history
  const { count, entries: history } = updateHistory(symbol, snapshot);

  // 3. Build pulse
  const pulse = count >= 2
    ? buildLiveMarketPulseWithHistory(snapshot, history.slice(0, -1))
    : buildLiveMarketPulse(snapshot);

  // 4. Detect opportunity
  const opportunity = detectLiveOpportunity(pulse);

  // 5. Detect acceleration
  const acceleration = detectAcceleration(symbol, history);

  // 6. Aggregate evidence
  if (snapshot.error) evidence.push(`Data: ${snapshot.error}`);
  if (pulse.evidence) evidence.push(...pulse.evidence.map(e => `Pulse: ${e}`));
  if (opportunity.evidence) evidence.push(...opportunity.evidence.map(e => `Opportunity: ${e}`));
  if (acceleration.evidence) evidence.push(...acceleration.evidence.map(e => `Accel: ${e}`));

  // 7. Determine overall status and freshness
  let status = opportunity.status;
  let freshness = pulse.freshness || 'FRESH';

  if (snapshot.error) {
    status = 'ERROR';
    freshness = 'INSUFFICIENT';
  } else if (snapshot.stale) {
    freshness = 'STALE';
  } else if (count < 3) {
    freshness = 'INSUFFICIENT';
  }

  return {
    symbol,
    status,
    freshness,
    pulse: {
      direction: pulse.direction,
      pressure: pulse.pressure,
      momentumScore: pulse.momentumScore,
      volumePressure: pulse.volumePressure,
      rsiShift: pulse.rsiShift,
    },
    opportunity: {
      status: opportunity.status,
      direction: opportunity.direction,
      score: opportunity.score,
      quality: opportunity.quality,
      warnings: opportunity.warnings,
    },
    acceleration: {
      status: acceleration.status,
      priceAcceleration: acceleration.priceAcceleration,
      volumeAcceleration: acceleration.volumeAcceleration,
      direction: acceleration.direction,
      historySize: acceleration.historySize,
    },
    evidence,
  };
}

/**
 * Process multiple symbols through the live opportunity pipeline.
 * @param {string[]} rawSymbols
 * @returns {Promise<LiveOpportunityResult>}
 */
export async function processLiveOpportunities(rawSymbols) {
  const generatedAt = new Date().toISOString();
  const errors = [];
  const data = [];

  // Validate and normalize symbols
  const symbols = [];
  for (const raw of (rawSymbols || [])) {
    const clean = normalizeSymbol(raw);
    if (clean) {
      if (!symbols.includes(clean)) symbols.push(clean);
    } else {
      errors.push({ symbol: String(raw || ''), error: 'Invalid symbol format' });
    }
  }

  // Limit
  const limited = symbols.slice(0, MAX_SYMBOLS);
  if (symbols.length > MAX_SYMBOLS) {
    errors.push({
      symbol: symbols.slice(MAX_SYMBOLS).join(','),
      error: `Only ${MAX_SYMBOLS} symbols allowed. Remaining skipped.`,
    });
  }

  if (limited.length === 0) {
    return {
      success: true,
      source: 'yahoo',
      mode: 'live',
      generatedAt,
      data: [],
      errors,
      disclaimer: 'Live opportunity radar is derived from polled Yahoo data. Not a trading recommendation. Yahoo market data may be delayed.',
    };
  }

  // Process each symbol (sequential to avoid Yahoo rate limits)
  for (const symbol of limited) {
    try {
      const entry = await processSymbol(symbol);
      data.push(entry);
    } catch (error) {
      errors.push({
        symbol,
        error: error?.message || 'Processing failed',
      });
    }
  }

  return {
    success: true,
    source: 'yahoo',
    mode: 'live',
    generatedAt,
    data,
    errors,
    disclaimer: 'Live opportunity radar is derived from polled Yahoo data. Not a trading recommendation. Yahoo market data may be delayed.',
  };
}
