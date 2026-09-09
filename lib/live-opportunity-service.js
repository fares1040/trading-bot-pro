/**
 * Live Opportunity Service
 *
 * Orchestration layer that combines live market data with optional supplied
 * flow evidence. Flow/smart-money fields remain empty unless evidence is
 * explicitly provided by a source; price/volume never becomes whale evidence.
 */

import { fetchLiveMarketSnapshot } from './live-market-data.js';
import { buildLiveMarketPulse } from './live-market-pulse.js';
import { detectLiveOpportunity } from './live-opportunity-stream.js';
import { detectAcceleration } from './acceleration-radar.js';
import { aggregateLiveFlow } from './live-flow-aggregator.js';
import { classifySmartMoneyEvidence } from './smart-money-evidence.js';

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

function normalizeFlowInput(flowBySymbol, symbol) {
  if (!flowBySymbol || typeof flowBySymbol !== 'object') return { observations: [], attributionEvidence: [] };
  const value = flowBySymbol[symbol];
  if (Array.isArray(value)) return { observations: value, attributionEvidence: [] };
  if (!value || typeof value !== 'object') return { observations: [], attributionEvidence: [] };
  return {
    observations: Array.isArray(value.observations) ? value.observations : [],
    attributionEvidence: Array.isArray(value.attributionEvidence) ? value.attributionEvidence : [],
  };
}

export function enrichLiveOpportunityWithFlow(entry, observations = [], attributionEvidence = []) {
  const flow = aggregateLiveFlow(observations);
  const smartMoney = classifySmartMoneyEvidence({ observations, attributionEvidence });

  return {
    ...entry,
    flow: {
      direction: flow.direction,
      pressureScore: flow.pressureScore,
      confidence: flow.confidence,
      observationCount: flow.observationCount,
      dataQuality: flow.dataQuality,
      disclaimer: flow.disclaimer,
    },
    smartMoney: {
      classification: smartMoney.classification,
      evidenceScore: smartMoney.evidenceScore,
      observationCount: smartMoney.observationCount,
      attributionEvidenceCount: smartMoney.attributionEvidenceCount,
      dataQuality: smartMoney.dataQuality,
      disclaimer: smartMoney.disclaimer,
    },
  };
}

async function processSymbol(symbol, flowInput = {}) {
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
  if (freshnessStatus === 'STALE') status = 'STALE_DATA';
  else if (freshnessStatus === 'UNKNOWN') status = 'INSUFFICIENT_DATA';
  else if (opportunity.eligible) status = 'OPPORTUNITY';
  else if (opportunity.reason === 'INSUFFICIENT_CONFLUENCE') status = 'WATCH';
  else status = 'NO_OPPORTUNITY';

  if (opportunity.reason) evidence.push(`OPPORTUNITY: ${opportunity.reason}`);
  if (acceleration.reason) evidence.push(`ACCELERATION: ${acceleration.reason}`);
  if (opportunity.evidence?.length) for (const e of opportunity.evidence) evidence.push(`${e.type}: ${e.value ?? e.score ?? ''}`);
  if (acceleration.evidence?.length) for (const e of acceleration.evidence) evidence.push(`ACCEL_${e.type}: ${e.value ?? e.score ?? ''}`);

  const baseEntry = {
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

  const enriched = enrichLiveOpportunityWithFlow(
    baseEntry,
    flowInput.observations,
    flowInput.attributionEvidence,
  );

  return {
    ...enriched,
    evidence: [
      ...enriched.evidence,
      `FLOW: ${enriched.flow.direction}`,
      `SMART_MONEY: ${enriched.smartMoney.classification}`,
    ],
  };
}

export async function processLiveOpportunities(rawSymbols, options = {}) {
  const generatedAt = new Date().toISOString();
  const errors = [];
  const data = [];
  const flowBySymbol = options?.flowBySymbol || {};

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
  if (symbols.length > MAX_SYMBOLS) errors.push({ symbol: symbols.slice(MAX_SYMBOLS).join(','), error: `Only ${MAX_SYMBOLS} symbols allowed. Remaining skipped.` });

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
      const entry = await processSymbol(symbol, normalizeFlowInput(flowBySymbol, symbol));
      data.push(entry);
    } catch (error) {
      errors.push({ symbol, error: error?.message || 'Processing failed' });
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
