import { enrichLiveRadarEntry } from '../lib/live-radar-evidence.js';

const base = { symbol: 'NVDA', status: 'WATCH' };
const empty = enrichLiveRadarEntry(base);
if (empty.symbol !== 'NVDA') throw new Error('entry must be preserved');
if (empty.optionsFlow !== null) throw new Error('missing options flow must remain null');
if (empty.optionsSmartMoney.classification !== 'UNATTRIBUTED') throw new Error('missing attribution must stay unattributed');

const fresh = { status: 'FRESH', isFresh: true };
const observations = [
  { symbol: 'NVDA', type: 'CALL', direction: 'BUY', contracts: 100, freshness: fresh },
  { symbol: 'NVDA', type: 'CALL', direction: 'BUY', contracts: 200, freshness: fresh },
  { symbol: 'NVDA', type: 'CALL', direction: 'BUY', contracts: 300, freshness: fresh },
];
const enriched = enrichLiveRadarEntry(base, { optionsFlowObservations: observations });
if (enriched.optionsFlow.observationCount !== 3) throw new Error('options flow must be aggregated');
if (enriched.optionsSmartMoney.classification !== 'POSSIBLE') throw new Error('strong quantitative flow should be POSSIBLE');

const confirmed = enrichLiveRadarEntry(base, {
  optionsFlowObservations: observations,
  attributionEvidence: [{ source: 'provider', reason: 'explicit attribution' }],
});
if (confirmed.optionsSmartMoney.classification !== 'CONFIRMED') throw new Error('explicit provider evidence should confirm');

console.log('PASS: live radar evidence enrichment');
