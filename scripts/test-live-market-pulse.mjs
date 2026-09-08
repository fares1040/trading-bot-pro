#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { buildLiveMarketPulse, PULSE_MODE, PULSE_VERSION } from '../lib/live-market-pulse.js';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('PASS: ' + name); passed++; } catch (error) { console.error('FAIL: ' + name + ' — ' + error.message); failed++; } }
const base = (price, volume, timestamp = '2026-09-08T19:00:00.000Z') => ({ symbol: 'AAPL', price, volume, timestamp, fetchedAt: timestamp, freshness: { status: 'FRESH', isFresh: true }, dataQuality: 'FRESH', source: 'YAHOO_CHART' });
test('exports stable pulse metadata', () => { assert.equal(PULSE_VERSION, '1.0'); assert.equal(PULSE_MODE, 'DERIVED'); });
test('handles insufficient history without fabrication', () => { const pulse = buildLiveMarketPulse(base(101, 1100)); assert.equal(pulse.symbol, 'AAPL'); assert.equal(pulse.price, 101); assert.equal(pulse.priceChangePercent, null); assert.equal(pulse.priceAccelerationPercent, null); assert.equal(pulse.accelerationState, 'INSUFFICIENT_DATA'); assert.equal(pulse.evidence.length, 1); });
test('derives price and volume change from adjacent snapshots', () => { const pulse = buildLiveMarketPulse(base(102, 1200), [base(100, 1000)]); assert.equal(pulse.priceChangePercent, 2); assert.equal(pulse.volumeChangePercent, 20); assert.equal(pulse.direction, 'UP'); });
test('detects simultaneous price and volume acceleration', () => { const pulse = buildLiveMarketPulse(base(103, 1500), [base(101, 1200), base(100, 1000)]); assert.ok(pulse.priceAccelerationPercent > 0); assert.ok(pulse.volumeAccelerationPercent > 0); assert.equal(pulse.accelerationState, 'ACCELERATING'); });
test('does not label price movement as order flow', () => { const pulse = buildLiveMarketPulse(base(103, 1500), [base(101, 1200), base(100, 1000)]); assert.equal(pulse.disclaimer.includes('not independent real-time order-flow'), true); });
test('uses supplied VWAP and spread only when present', () => { const pulse = buildLiveMarketPulse({ ...base(103, 1500), vwap: 100, bid: 102.5, ask: 103.5 }); assert.equal(pulse.vwap, 100); assert.equal(pulse.vwapDistancePercent, 3); assert.ok(pulse.spreadPercent > 0); });
test('clamps derived scores to 0..100', () => { const pulse = buildLiveMarketPulse(base(1000, 10), [base(1, 1)]); for (const key of ['momentumScore', 'accelerationScore', 'volumePressureScore', 'vwapBiasScore', 'pressureScore']) assert.ok(pulse[key] >= 0 && pulse[key] <= 100, `${key} out of range`); });
console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
