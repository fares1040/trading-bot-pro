import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { getCircuitBreaker, resetAll, shouldAllowProviderCall } from '../lib/circuit-breaker-manager.js';
import { STATE } from '../lib/circuit-breaker.js';
import { fetchChart } from '../lib/market-engine.js';
import { classifyErrorType, ERROR_TYPES } from '../lib/failure-events.js';

describe('route-reliability', () => {
  beforeEach(() => {
    resetAll();
  });

  describe('circuit breaker gate', () => {
    it('allows provider call when yahoo circuit is CLOSED', () => {
      const cb = getCircuitBreaker('yahoo');
      cb.forceState(STATE.CLOSED);
      assert.strictEqual(cb.shouldAllowProbe(), true);
    });

    it('blocks provider call when yahoo circuit is OPEN', () => {
      const cb = getCircuitBreaker('yahoo');
      cb.forceState(STATE.OPEN);
      assert.strictEqual(cb.shouldAllowProbe(), false);
    });

    it('OPEN yahoo circuit causes gate to reject via shouldAllowProviderCall', () => {
      const status = shouldAllowProviderCall('yahoo');
      // Default state is CLOSED, so should be allowed
      assert.strictEqual(status.allowed, true);
      assert.strictEqual(status.state, STATE.CLOSED);
    });

    it('OPEN yahoo circuit causes gate to block via shouldAllowProviderCall', async () => {
      const cb = getCircuitBreaker('yahoo');
      cb.forceState(STATE.OPEN);
      const status = shouldAllowProviderCall('yahoo');
      assert.strictEqual(status.allowed, false);
      assert.strictEqual(status.state, STATE.OPEN);
    });
  });

  describe('provider timeout classification', () => {
    it('fetchChart timeout is classified as TIMEOUT', async () => {
      const originalFetch = global.fetch;
      global.fetch = async (url, options = {}) => {
        const { signal } = options;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 15000);
          const onAbort = () => {
            clearTimeout(timer);
            reject(new Error('The operation was aborted due to timeout'));
          };
          signal?.addEventListener('abort', onAbort, { once: true });
        });
        return new Response('{}', { status: 200 });
      };

      try {
        const start = Date.now();
        let caught = null;
        try {
          await fetchChart('AAPL', '6mo');
        } catch (e) {
          caught = e;
        }
        const elapsed = Date.now() - start;
        assert.ok(caught != null, 'fetchChart should throw on timeout');
        assert.ok(elapsed < 12000, `fetchChart should timeout within 12s, took ${elapsed}ms`);
        const errorType = classifyErrorType(caught);
        assert.strictEqual(errorType, ERROR_TYPES.TIMEOUT);
      } finally {
        global.fetch = originalFetch;
      }
    }, 20000);

    it('timeout error does not fabricate data', async () => {
      const originalFetch = global.fetch;
      global.fetch = async (url, options = {}) => {
        const { signal } = options;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 15000);
          const onAbort = () => {
            clearTimeout(timer);
            reject(new Error('The operation was aborted due to timeout'));
          };
          signal?.addEventListener('abort', onAbort, { once: true });
        });
        return new Response('{}', { status: 200 });
      };

      try {
        let caught = null;
        try {
          await fetchChart('AAPL', '6mo');
        } catch (e) {
          caught = e;
        }
        assert.ok(caught != null, 'fetchChart should throw on timeout');
        const msg = String(caught?.message || '').toLowerCase();
        assert.ok(
          msg.includes('timeout') || msg.includes('aborted') || msg.includes('fetch failed'),
          `Expected timeout-related error, got: ${caught?.message}`
        );
      } finally {
        global.fetch = originalFetch;
      }
    }, 20000);
  });
});
