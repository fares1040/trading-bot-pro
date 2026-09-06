/**
 * Production Readiness Probe
 *
 * Provides the probe() function used by /api/production to measure
 * actual endpoint health. Production readiness probes bypass shared
 * circuit breakers to avoid false negatives from prior user-traffic
 * failures.
 *
 * This module does NOT change trading logic, scoring, or thresholds.
 */

import { shouldAllowProviderCall, recordProviderFailure, recordProviderSuccess } from './circuit-breaker-manager.js';
import { record } from './failure-events.js';

export const TIMEOUT_MS = 10000;

/**
 * Probe a URL and report actual endpoint health.
 *
 * @param {string} url - Target URL
 * @param {string} route - Route name for observability
 * @param {string} provider - Provider name for circuit breaker / failure events
 * @param {string|null} symbol - Optional symbol
 * @param {boolean} [bypassCircuitBreaker=false] - When true, skip the shared
 *   circuit breaker check. This is intended for production-readiness probes
 *   that must measure actual endpoint health regardless of prior failures.
 * @returns {Object} Probe result
 */
export async function probe(url, route, provider, symbol = null, bypassCircuitBreaker = false) {
  const started = Date.now();

  if (!bypassCircuitBreaker && !shouldAllowProviderCall(provider).allowed) {
    const circuitStatus = shouldAllowProviderCall(provider);
    return {
      ok: false,
      status: null,
      latencyMs: Date.now() - started,
      error: `Circuit breaker OPEN for provider: ${provider}`,
      circuitBlocked: true,
      bypassed: false,
    };
  }

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const latencyMs = Date.now() - started;
    const json = await response.json().catch(() => ({}));

    const ok = response.ok && json?.success !== false;

    if (ok) {
      recordProviderSuccess(provider, route, symbol);
    } else {
      recordProviderFailure(
        provider,
        `HTTP ${response.status}`,
        route,
        symbol,
        provider === 'finra'
      );
      record({
        route,
        provider,
        errorType: 'HTTP_FAILURE',
        message: `HTTP ${response.status}`,
        status: response.status,
        symbol,
        optional: provider !== 'yahoo' && provider !== 'internal',
      });
    }

    return {
      ok,
      status: response.status,
      latencyMs,
      error: ok ? null : (json?.error || `HTTP ${response.status}`),
      circuitBlocked: false,
      bypassed: bypassCircuitBreaker,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const errorMsg = error?.message || 'probe failed';

    recordProviderFailure(provider, errorMsg, route, symbol, provider === 'finra');
    record({
      route,
      provider,
      error,
      symbol,
      optional: provider !== 'yahoo' && provider !== 'internal',
    });

    return {
      ok: false,
      status: null,
      latencyMs,
      error: errorMsg,
      circuitBlocked: false,
      bypassed: bypassCircuitBreaker,
    };
  }
}
