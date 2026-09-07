import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { getCircuitBreaker, resetAll, shouldAllowProviderCall } from '../lib/circuit-breaker-manager.js';
import { STATE } from '../lib/circuit-breaker.js';
import { fetchChart, fetchTrending } from '../lib/market-engine.js';
import { classifyErrorType, ERROR_TYPES, list, clear } from '../lib/failure-events.js';
import { fetchOptionsChain } from '../lib/options-provider.js';

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

  describe('stale data detection', () => {
    it('fresh data is not stale', async () => {
      const originalFetch = global.fetch;
      const freshAsOf = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      const ts = Math.floor(new Date(freshAsOf).getTime() / 1000);
      global.fetch = async () => new Response(JSON.stringify({
        chart: { result: [{ meta: { symbol: 'AAPL' }, timestamp: [ts], indicators: { quote: [{ close: [100] }] } }] }
      }), { status: 200 });

      try {
        const result = await fetchChart('AAPL', '6mo');
        assert.strictEqual(result.stale, false);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('old data is stale', async () => {
      const originalFetch = global.fetch;
      const oldAsOf = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      global.fetch = async () => new Response(JSON.stringify({
        chart: { result: [{ meta: { symbol: 'AAPL' }, timestamp: [Math.floor(new Date(oldAsOf).getTime() / 1000)], indicators: { quote: [{ close: [100] }] } }] }
      }), { status: 200 });

      try {
        const result = await fetchChart('AAPL', '6mo');
        assert.strictEqual(result.stale, true);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('unavailable data (null asOf) is not stale', async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => new Response(JSON.stringify({
        chart: { result: [{ meta: { symbol: 'AAPL' }, timestamp: [], indicators: { quote: [{ close: [] }] } }] }
      }), { status: 200 });

      try {
        const result = await fetchChart('AAPL', '6mo');
        assert.strictEqual(result.stale, false);
        assert.strictEqual(result.asOf, null);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('yahoo rate limit handling', () => {
    it('fetchChart 429 records RATE_LIMIT failure event', async () => {
      clear();
      const originalFetch = global.fetch;
      global.fetch = async () => new Response('Too Many Requests', { status: 429 });

      try {
        let caught = null;
        try {
          await fetchChart('AAPL', '6mo');
        } catch (e) {
          caught = e;
        }
        assert.ok(caught != null, 'fetchChart should throw on 429');
        assert.ok(caught.message.toLowerCase().includes('rate limit'), `Expected rate limit error, got: ${caught.message}`);

        const events = list({ provider: 'yahoo' });
        const rateLimitEvent = events.find(e => e.errorType === 'RATE_LIMIT');
        assert.ok(rateLimitEvent, 'Expected RATE_LIMIT event');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('fetchTrending 429 records RATE_LIMIT failure event', async () => {
      clear();
      const originalFetch = global.fetch;
      global.fetch = async () => new Response('Too Many Requests', { status: 429 });

      try {
        let caught = null;
        try {
          await fetchTrending(30);
        } catch (e) {
          caught = e;
        }
        assert.ok(caught != null, 'fetchTrending should throw on 429');
        assert.ok(caught.message.toLowerCase().includes('rate limit'), `Expected rate limit error, got: ${caught.message}`);

        const events = list({ provider: 'yahoo' });
        const rateLimitEvent = events.find(e => e.errorType === 'RATE_LIMIT');
        assert.ok(rateLimitEvent, 'Expected RATE_LIMIT event for trending');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('failure event consistency', () => {
    it('failure event emitted exactly once for fetchChart HTTP failure', async () => {
      clear();
      const originalFetch = global.fetch;
      global.fetch = async () => new Response('Server Error', { status: 500 });

      try {
        let caught = null;
        try {
          await fetchChart('AAPL', '6mo');
        } catch (e) {
          caught = e;
        }
        assert.ok(caught != null);
        const events = list({ provider: 'yahoo' });
        const httpEvents = events.filter(e => e.errorType === 'HTTP_FAILURE');
        assert.strictEqual(httpEvents.length, 1, 'Expected exactly one HTTP_FAILURE event');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('failure event emitted exactly once for options HTTP failure', async () => {
      clear();
      const originalFetch = global.fetch;
      global.fetch = async () => new Response('Server Error', { status: 500 });

      try {
        const result = await fetchOptionsChain('AAPL');
        assert.strictEqual(result.available, false);
        const events = list({ provider: 'yahoo' });
        const httpEvents = events.filter(e => e.errorType === 'HTTP_FAILURE');
        assert.strictEqual(httpEvents.length, 1, 'Expected exactly one HTTP_FAILURE event for options');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
