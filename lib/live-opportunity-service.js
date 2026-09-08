/**
 * Live Opportunity Service
 *
 * Orchestration layer that combines:
 * 1. Live market data fetching (via remote live-market-data.js)
 * 2. Process-local history management (in-memory, not persisted)
 * 3. Market pulse analysis (via remote live-market-pulse.js)
 * 4. Opportunity detection (via remote live-opportunity-stream.js)
 * 5. Acceleration detection (via remote acceleration-radar.js)
 *
 * This module does NOT persist state. History is process-local only.
 * On serverless cold start, history is empty — first call returns INSUFFICIENT_DATA.
 *
 * This module does NOT modify C7/C8/C9/C10 scoring.
 * This module does NOT fabricate data.
 */

import { fetchLiveMarketSnapshot } from './live-market-data.js';
import { buildLiveMarketPulse } from './live-market-pulse.js';
import { detectLiveOpportunity } from './live-opportunity-stream.js';
import { detectAcceleration } from './acceleration-radar.js';

const SYMBOL_RE = /^[A-Z][A-Z0-9.^=-]{0,11}$/;
const MAX_SYMBOLS = 10;
const MAX_HISTORY = 10;

const historyStore = new Map();

function getHistory(symbol) {
  return historyStore.get(symbol) || [];
}

function updateHistory(symbol, snapshot) {
  const key = String(symbol).toUpperCase();
  const existing = historyStore.get(key) || [];
  const updated = [...existing, snapshot].slice(-MAX_HISTORY);
  historyStore.set(key, updated);
  return updated;
}

function clearHistory(symbol) {
  if (symbol == null) {
    historyStore.clear();
  } else {
    historyStore.delete(String(symbol).toUpperCase());
  }
}

function normalizeSymbol(raw) {
  const clean = String(raw || '').trim().toUpperCase();
  return SYMBOL_RE.test(clean) ? clean : null;
}

async function processSymbol(symbol) {
  const evidence = [];

  const snapshot = await fetchLiveMarketSnapshot(symbol);

  const history = updateHistory(symbol, snapshot);
  const priorSnapshots = history.slice(0, -1);

  const pulse = buildLiveMarketPulse(snapshot, priorSnapshots);

  const opportunity = detectLiveOpportunity(pulse);

  const acceleration = detectAcceleration(pulse);

  const freshnessStatus = snapshot.freshness?.status || 'UNKNOWN';
  const dataQuality = snapshot.dataQuality || 'UNKNOWN';

  let status;
  if (freshnessStatus === 'STALE') {
    status = 'STALE_DATA';
  } else if (freshnessStatus === 'UNKNOWN') {
    status = 'INSUFFICIENT_DATA';
  } else if (opportunity.eligible) {
    status = 'OPPORTUNITY';
  } else if (opportunity.reason === 'INSUFFICIENT_CONFLUENCE') {
    status = 'WATCH';
  } else {
    status = 'NO_OPPORTUNITY';
  }

  if (opportunity.reason) evidence.push(`OPPORTUNITY: ${opportunity.reason}`);
  if (acceleration.reason) evidence.push(`ACCELERATION: ${acceleration.reason}`);
  if (opportunity.evidence?.length) {
    for (const e of opportunity.evidence) {
      evidence.push(`${e.type}: ${e.value ?? e.score ?? ''}`);
    }
  }
  if (acceleration.evidence?.length) {
    for (const e of acceleration.evidence) {
      evidence.push(`ACCEL_${e.type}: ${e.value ?? e.score ?? ''}`);
    }
  }

  return {
    symbol,
    status,
    freshness: freshnessStatus,
    dataQuality,
    pulse: {
      direction: pulse.direction,
      pressureScore: pulse.pressureScore,
      momentumScore: pulse.momentumScore,
      accelerationScore: pulse.accelerationScore,
      volumePressureScore: pulse.volumePressureScore,
      vwapBiasScore: pulse.vwapBiasScore,
      priceChangePercent: pulse.priceChangePercent,
      priceAccelerationPercent: pulse.priceAccelerationPercent,
      volumeChangePercent: pulse.volumeChangePercent,
      volumeAccelerationPercent: pulse.volumeAccelerationPercent,
      accelerationState: pulse.accelerationState,
    },
    opportunity: {
      eligible: opportunity.eligible,
      reason: opportunity.reason,
      direction: opportunity.direction,
      pressureScore: opportunity.pressureScore,
      checks: opportunity.checks,
    },
    acceleration: {
      eligible: acceleration.eligible,
      reason: acceleration.reason,
      direction: acceleration.direction,
      accelerationState: acceleration.accelerationState,
      priceAccelerationPercent: acceleration.priceAccelerationPercent,
      volumeAccelerationPercent: acceleration.volumeAccelerationPercent,
      pressureScore: acceleration.pressureScore,
    },
    evidence,
    historySize: history.length,
    disclaimer: pulse.disclaimer,
  };
}

export async function processLiveOpportunities(rawSymbols) {
  const generatedAt = new Date().toISOString();
  const errors = [];
  const data = [];

  const symbols = [];
  for (const raw of (rawSymbols || [])) {
    const clean = normalizeSymbol(raw);
    if (clean) {
      if (!symbols.includes(clean)) symbols.push(clean);
    } else {
      errors.push({ symbol: String(raw || ''), error: 'Invalid symbol format' });
    }
  }

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

export { clearHistory, getHistory, updateHistory };
