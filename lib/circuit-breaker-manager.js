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

function getCircuitBreaker(provider) {
  if (!circuitBreakers.has(provider)) {
    circuitBreakers.set(provider, new CircuitBreaker({ provider }));
  }
  return circuitBreakers.get(provider);
}

function classifyProviderError(errorOrMessage, provider) {
  const type = classifyErrorType(errorOrMessage);
  if (
    type === ERROR_TYPES.HTTP_FAILURE ||
    type === ERROR_TYPES.PROVIDER_UNAVAILABLE ||
    type === ERROR_TYPES.TIMEOUT ||
    type === ERROR_TYPES.RATE_LIMIT
  ) {
    return type;
  }
  return null;
}

function recordProviderFailure(provider, error, route, symbol, optional = false) {
  const cb = getCircuitBreaker(provider);
  const errorType = classifyProviderError(error, provider);
  if (errorType) cb.recordFailure(errorType);

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

function resetAll() {
  for (const cb of circuitBreakers.values()) cb.reset();
}

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

export default {
  getCircuitBreaker,
  recordProviderFailure,
  recordProviderSuccess,
  shouldAllowProviderCall,
  getProviderHealth,
  resetAll,
};