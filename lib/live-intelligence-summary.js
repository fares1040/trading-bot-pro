/**
 * Live Intelligence Summary
 *
 * Pure aggregation for the live cockpit. It summarizes already-derived
 * evidence without changing Hunter scoring, thresholds, or market data.
 */

export const LIVE_INTELLIGENCE_SUMMARY_VERSION = '1.0';

function count(data, predicate) {
  return data.reduce((total, entry) => total + (predicate(entry) ? 1 : 0), 0);
}

export function buildLiveIntelligenceSummary(data = []) {
  const entries = Array.isArray(data) ? data : [];

  const fresh = count(entries, (entry) => entry?.freshness === 'FRESH');
  const stale = count(entries, (entry) => entry?.freshness === 'STALE');
  const errors = count(entries, (entry) => entry?.status === 'ERROR' || entry?.dataQuality === 'ERROR');
  const opportunities = count(entries, (entry) => entry?.status === 'OPPORTUNITY' || entry?.opportunity?.eligible === true);
  const watches = count(entries, (entry) => entry?.status === 'WATCH');
  const ignition = count(entries, (entry) => entry?.earlyExplosion?.state === 'IGNITION');
  const preparing = count(entries, (entry) => entry?.earlyExplosion?.state === 'PREPARING');
  const flowObserved = count(entries, (entry) => Number(entry?.flow?.observationCount) > 0);
  const smartMoneyPossible = count(entries, (entry) => entry?.smartMoney?.classification === 'POSSIBLE');
  const smartMoneyConfirmed = count(entries, (entry) => entry?.smartMoney?.classification === 'CONFIRMED');

  return {
    version: LIVE_INTELLIGENCE_SUMMARY_VERSION,
    total: entries.length,
    fresh,
    stale,
    errors,
    freshRatio: entries.length ? Number(((fresh / entries.length) * 100).toFixed(1)) : 0,
    opportunities,
    watches,
    ignition,
    preparing,
    flowObserved,
    smartMoneyPossible,
    smartMoneyConfirmed,
    disclaimer: 'Summary is derived from supplied live evidence. It does not prove institutional activity or guarantee exchange-level real-time data.',
  };
}
