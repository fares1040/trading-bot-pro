/**
 * Provider Circuit Breaker Manager — P1-6 Integration
 *
 * Bridges the CircuitBreaker module with existing infrastructure:
 *   - Per-provider circuit breakers
 *   - Provider request concurrency protection
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
  ERROR_TYPES,
  classifyErrorType,
  severityForProvider,
  record,
} from './failure-events.js';

const circuitBreakers = new Map();

// Prevent discovery endpoints from creating a provider request storm.
// Yahoo is the main high-fan-out provider in /api/stocks.
const MAX_IN_FLIGHT = Object.freeze({
  yahoo: 6,
  finnhub: 4,
  finra: 3,
  sec: 3,
  supabase: 6,
  gemini: 2,
  openai: 2,
  telegram: 2,
  discord: 2,
  internal: 8,
});

const DEFAULT_MAX_IN_FLIGHT = 4;
const LEASE_TIMEOUT_MS = 15_000;
const inFlight = new Map();
const leases = new Map();
let nextLeaseId = 1;

function getCircuitBreaker(provider) {
  if (!circuitBreakers.has(provider)) {
    circuitBreakers.set(provider, new CircuitBreaker({ provider }));
  }
  return circuitBreakers.get(provider);
}

function getMaxInFlight(provider) {
  return MAX_IN_FLIGHT[provider] || DEFAULT_MAX_IN_FLIGHT;
}

function reserveProviderSlot(provider) {
  const current = inFlight.get(provider) || 0;
  if (current >= getMaxInFlight(provider)) {
    return null;
  }

  const leaseId = `${provider}:${nextLeaseId++}`;
  inFlight.set(provider, current + 1);

  const timer = setTimeout(() => {
    releaseProviderSlot(leaseId);
  }, LEASE_TIMEOUT_MS);

  leases.set(leaseId, { provider, timer });
  return leaseId;
}

function releaseProviderSlot(leaseId) {
  const lease = leases.get(leaseId);
  if (!lease) return;

  clearTimeout(lease.timer);
  leases.delete(leaseId);

  const current = inFlight.get(lease.provider) || 0;
  if (current <= 1) inFlight.delete(lease.provider);
  else inFlight.set(lease.provider, current - 1);
}

function classifyProviderError(errorOrMessage) {
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

function isConcurrencyRejection(error) {
  return String(error?.message || error || '').includes('provider concurrency limit');
}

function recordProviderFailure(provider, error, route, symbol, optional = false) {
  const leaseId = error?.providerLeaseId;
  if (leaseId) releaseProviderSlot(leaseId);

  const cb = getCircuitBreaker(provider);
  const errorType = classifyProviderError(error);

  // A concurrency rejection is local back-pressure, not provider failure.
  if (!isConcurrencyRejection(error) && errorType) {
    cb.recordFailure(errorType);
  }

  const providerCriticality = optional
    ? 'optional'
    : PROVIDER_CRITICALITY[provider] || 'critical';

  record({
    route,
    provider,
    errorType: isConcurrencyRejection(error) ? null : errorType,
    message: error?.message || String(error),
    severity: isConcurrencyRejection(error) ? 'INFO' : severityForProvider(provider, errorType || 'UNKNOWN'),
    symbol,
    optional: providerCriticality === 'optional',
  });
}

function recordProviderSuccess(provider, route, symbol, leaseId = null) {
  if (leaseId) releaseProviderSlot(leaseId);
  else if (symbol) {
    // Release the oldest outstanding lease for this provider when callers
    // use the legacy three-argument success signature.
    const prefix = `${provider}:`;
    const outstanding = [...leases.keys()].find((id) => id.startsWith(prefix));
    if (outstanding) releaseProviderSlot(outstanding);
  }

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

  if (!cb.shouldAllowProbe()) {
    return {
      allowed: false,
      state: status.state,
      criticality: status.criticality,
      failureCount: status.failureCount,
      reason: 'circuit-breaker',
    };
  }

  const leaseId = reserveProviderSlot(provider);
  if (!leaseId) {
    return {
      allowed: false,
      state: status.state,
      criticality: status.criticality,
      failureCount: status.failureCount,
      reason: 'concurrency-limit',
    };
  }

  return {
    allowed: true,
    state: status.state,
    criticality: status.criticality,
    failureCount: status.failureCount,
    reason: 'allowed',
    leaseId,
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
      inFlight: inFlight.get(provider) || 0,
      maxInFlight: getMaxInFlight(provider),
    };
  }
  return health;
}

function resetAll() {
  for (const cb of circuitBreakers.values()) cb.reset();
  for (const leaseId of [...leases.keys()]) releaseProviderSlot(leaseId);
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