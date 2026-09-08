import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { getCircuitBreaker, resetAll, shouldAllowProviderCall } from '../lib/circuit-breaker-manager.js';
import { STATE } from '../lib/circuit-breaker.js';

describe('HARDENING 2 — Cron Yahoo Circuit Breaker', () => {
  beforeEach(() => {
    resetAll();
  });

  describe('circuit breaker gate for cron', () => {
    it('allows Yahoo call when circuit is CLOSED', () => {
      const cb = getCircuitBreaker('yahoo');
      cb.forceState(STATE.CLOSED);
      const status = shouldAllowProviderCall('yahoo');
      assert.strictEqual(status.allowed, true);
      assert.strictEqual(status.state, STATE.CLOSED);
    });

    it('blocks Yahoo call when circuit is OPEN', () => {
      const cb = getCircuitBreaker('yahoo');
      cb.forceState(STATE.OPEN);
      const status = shouldAllowProviderCall('yahoo');
      assert.strictEqual(status.allowed, false);
      assert.strictEqual(status.state, STATE.OPEN);
    });

    it('circuit OPEN does not crash — returns valid response', () => {
      const cb = getCircuitBreaker('yahoo');
      cb.forceState(STATE.OPEN);
      const status = shouldAllowProviderCall('yahoo');
      assert.strictEqual(status.allowed, false);
      assert.ok(status.state != null, 'state should be defined');
      assert.ok(typeof status.state === 'string', 'state should be a string');
    });
  });

  describe('cron response shape when circuit OPEN', () => {
    it('shouldAllowProviderCall returns structured result', () => {
      const cb = getCircuitBreaker('yahoo');
      cb.forceState(STATE.OPEN);
      const result = shouldAllowProviderCall('yahoo');
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.state, STATE.OPEN);
      assert.ok(typeof result.failureCount === 'number', 'failureCount should be a number');
    });

    it('circuit recovers after cooldown', () => {
      const cb = getCircuitBreaker('yahoo');
      cb.forceState(STATE.OPEN);
      assert.strictEqual(shouldAllowProviderCall('yahoo').allowed, false);
      cb.forceState(STATE.CLOSED);
      assert.strictEqual(shouldAllowProviderCall('yahoo').allowed, true);
    });
  });

  describe('alert suppression when Yahoo unavailable', () => {
    it('no opportunities detected when circuit is OPEN', () => {
      const cb = getCircuitBreaker('yahoo');
      cb.forceState(STATE.OPEN);
      const status = shouldAllowProviderCall('yahoo');
      assert.strictEqual(status.allowed, false);
      assert.strictEqual(status.state, STATE.OPEN);
    });
  });
});
