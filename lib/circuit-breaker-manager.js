/**
 * Provider Circuit Breaker Manager — P1-6 Integration
 *
 * Bridges the CircuitBreaker module with existing infrastructure:
 *   - Per-provider circuit breakers
 *   - Integration with lib/failure-events.js for event recording
 *   - Health endpoint exposure via /api/health
 *   - Utility functions for provider call sites
 *
 * This module does NOT change trading logic, scoring, or thresholds.
 * It ONLY provides reliability/observability around provider calls.
 */

import CircuitBreaker from './circuit-breaker.js';
import {
  PROVIDER_CRITICALITY,
  PROVIDERS,
  ERROR_TYPES,
  classifyErrorType,
  severityForProvider,
  record,
  healthStatus,
} from './failure-events.js';

const circuitBreakers = new Map();

/**
 * Get (or create) a per-provider CircuitBreaker instance.
 * Circuit breakers are keyed by provider name and persist for the
 * runtime instance's lifetime (in-memory, serverless-compatible).
 */
function getCircuitBreaker(provider) {
  if (!circuitBreakers.has(provider)) {
    circuitBreakers.set(provider, new CircuitBreaker({ provider }));
  }
  return circuitBreakers.get(provider);
}

/**
 * Classify an error into a failure type that counts toward circuit opening.
 * Maps to lib/failure-events.js classifyErrorType for consistency.
 */
function classifyProviderError(errorOrMessage, provider) {
  const type = classifyErrorType(errorOrMessage);
  // Map to circuit breaker failure types
  if (
    type === ERROR_TYPES.HTTP_FAILURE ||
    type === ERROR_TYPES.PROVIDER_UNAVAILABLE ||
    type === ERROR_TYPES.TIMEOUT ||
    type === ERROR_TYPES.RATE_LIMIT
  ) {
    return type;
  }
  // These types should NOT count toward circuit opening
  return null;
}

/**
 * Record a failure to both the circuit breaker and failure-events.
 * Called when a provider call fails with an operational error.
 *
 * @param {string} provider - Provider name (e.g. 'yahoo', 'finnhub', 'finra')
 * @param {string|Error} error - Error object or message string
 * @param {string} route - Route/context name (e.g. 'market-data', 'finra-data')
 * @param {string|null} symbol - Optional symbol associated with the call
 * @param {boolean} [optional=false] - Whether this is an optional provider
 */
function recordProviderFailure(provider, error, route, symbol, optional = false) {
  const cb = getCircuitBreaker(provider);

  // Determine error type for circuit breaker
  const errorType = classifyProviderError(error, provider);
  if (errorType) {
    cb.recordFailure(errorType);
  }

  // Record failure event for observability
  const providerCriticality = optional
    ? 'optional'
    : PROVIDER_CRITICALITY[provider] || 'critical';

  record({
    route,
    provider,
    errorType,
    message: error?.message || String(error),
    severity: severityForProvider(provider, errorType || 'UNKNOWN'),
    symbol,
    optional: providerCriticality === 'optional',
  });
}

/**
 * Record a success to both the circuit breaker and failure-events.
 * Called when a provider call succeeds.
 *
 * @param {string} provider - Provider name
 * @param {string} route - Route/context name
 * @param {string|null} symbol - Optional symbol
 */
function recordProviderSuccess(provider, route, symbol) {
  const cb = getCircuitBreaker(provider);
  cb.recordSuccess();

  record({
    route,
    provider,
    errorType: null,
    message: 'Provider request successful',
    severity: 'INFO',
    symbol,
    optional: PROVIDER_CRITICALITY[provider] === 'optional',
  });
}

/**
 * Check if a provider call should be allowed (circuit breaker check).
 * Call this before making a provider API call.
 * If it returns false, the call should be fast-failed and a fallback used.
 *
 * @param {string} provider - Provider name
 * @returns {Object} { allowed: boolean, status: string }
 */
function shouldAllowProviderCall(provider) {
  const cb = getCircuitBreaker(provider);
  const status = cb.getStatus();
  return {
    allowed: cb.shouldAllowProbe(),
    state: status.state,
    criticality: status.criticality,
    failureCount: status.failureCount,
  };
}

/**
 * Get health status for all providers, including circuit breaker state.
 * This is merged into /api/health response.
 *
 * @returns {Object} Provider circuit breaker health summary
 */
function getProviderHealth() {
  const health = {};

  for (const provider of [...circuitBreakers.keys()]) {
    const cb = circuitBreakers.get(provider);
    const status = cb.getStatus();
    health[provider] = {
      state: status.state,
      criticality: status.criticality,
      failureCount: status.failureCount,
      timeSinceOpen: status.timeSinceOpen,
      timeUntilCooldownEnds: status.timeUntilCooldownEnds,
    };
  }

  return health;
}

/**
 * Reset all circuit breakers (useful for testing or recovery).
 */
function resetAll() {
  for (const cb of circuitBreakers.values()) {
    cb.reset();
  }
}

// Export all functions and classes
export {
  CircuitBreaker,
  getCircuitBreaker,
  circuitBreakers,
  classifyProviderError,
  recordProviderFailure,
  recordProviderSuccess,
  shouldAllowProviderCall,
  getProviderHealth,
  resetAll,
  PROVIDER_CRITICALITY,
};

// Export default for convenience
export default {
  getCircuitBreaker,
  recordProviderFailure,
  recordProviderSuccess,
  shouldAllowProviderCall,
  getProviderHealth,
  resetAll,
};