import { classifyOptionsSmartMoney } from '../lib/options-smart-money.js';

const fresh = { status: 'FRESH', isFresh: true };
const stale = { status: 'STALE', isFresh: false };

const observations = [
  { symbol: 'TEST', type: 'CALL', direction: 'BUY', contracts: 100, freshness: fresh },
  { symbol: 'TEST', type: 'CALL', direction: 'BUY', contracts: 200, freshness: fresh },
  { symbol: 'TEST', type: 'CALL', direction: 'BUY', contracts: 300, freshness: fresh },
];

const mixed = [
  { symbol: 'TEST', type: 'CALL', direction: 'BUY', contracts: 1000, freshness: stale },
  { symbol: 'TEST', type: 'CALL', direction: 'BUY', freshness: fresh },
  { symbol: 'TEST', type: 'CALL', direction: 'BUY', freshness: fresh },
  { symbol: 'TEST', type: 'CALL', direction: 'BUY', freshness: fresh },
];

const possible = classifyOptionsSmartMoney(observations);
if (possible.classification !== 'POSSIBLE' || possible.quantitativeFlow !== true) throw new Error('Fresh quantitative flow should allow POSSIBLE');

const blocked = classifyOptionsSmartMoney(mixed);
if (blocked.quantitativeFlow !== false) throw new Error('Stale quantitative flow must not count');
if (blocked.classification !== 'UNATTRIBUTED') throw new Error('Fresh non-quantitative observations must not create POSSIBLE');

const staleOnly = classifyOptionsSmartMoney([
  { symbol: 'TEST', type: 'CALL', direction: 'BUY', contracts: 1000, freshness: stale },
  { symbol: 'TEST', type: 'CALL', direction: 'BUY', freshness: fresh },
  { symbol: 'TEST', type: 'CALL', direction: 'BUY', freshness: fresh },
  { symbol: 'TEST', type: 'CALL', direction: 'BUY', freshness: fresh },
]);
if (staleOnly.classification !== 'UNATTRIBUTED') throw new Error('Stale quantitative flow must not create POSSIBLE');
if (staleOnly.quantitativeFlow !== false) throw new Error('quantitativeFlow must be freshness-gated');

console.log('PASS: options smart-money freshness gate');
