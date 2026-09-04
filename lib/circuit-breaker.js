/**
 * Provider Circuit Breaker — P1-6
 *
 * Reliability layer that prevents request storms against failing providers.
 * Protects Trading Bot Pro from repeatedly hitting unavailable/unresponsive
 * external data sources (Yahoo, Finnhub, FINRA, etc.).
 *
 * States:
 *   CLOSED    — requests pass through normally.
 *   OPEN      — provider is presumed down; calls are fast-failed.
 *   HALF_OPEN — cooldown finished; one limited probe attempt allowed.
 *
 * Per-provider: critical providers (Yahoo, Finnhub) have different thresholds
 * than optional providers (FINRA, Gemini, OpenAI).
 *
 * This module is OBSERVABILITY-ONLY. It does NOT:
 *   - change trading logic, scoring, or thresholds
 *   - guarantee provider availability
 *   - persist across serverless restarts (in-memory per instance)
 *   - fabricate data when provider is unavailable
 *
 * Failure events are recorded via lib/failure-events.js
 * so /api/health can reflect provider health accurately.
 */

const PROVIDER_CRITICALITY = {
  yahoo: 'critical',
  finnhub: 'critical',
  finra: 'optional',
  sec: 'optional',
  supabase: 'optional',
  gemini: 'optional',
  openai: 'optional',
  telegram: 'optional',
  discord: 'optional',
  internal: 'critical',
};

// Failure thresholds per criticality level
// Critical providers need fewer failures to open the circuit (they're core)
const CLOSED_THRESHOLDS = {
  critical: 5,    // after 5 failures -> OPEN
  optional: 3,    // after 3 failures -> OPEN
};

// Cooldown periods (ms) before entering HALF_OPEN
const COOLDOWN_MS = {
  critical: 60 * 1000,   // 60 seconds
  optional: 30 * 1000,   // 30 seconds
};

// Probe limit in HALF_OPEN state — max attempts before re-opening
const PROBE_LIMIT = 1;

// Error types that count as "qualifying failures" for circuit opening
const FAILURE_ERROR_TYPES = [
  'HTTP_FAILURE',
  'PROVIDER_UNAVAILABLE',
  'TIMEOUT',
  'RATE_LIMIT',
];

// Error types that should NOT count toward circuit opening
const EXCLUDED_ERROR_TYPES = [
  'EMPTY_RESPONSE',   // legitimate empty result (e.g., symbol not found)
  'MALFORMED_RESPONSE', // may be transient, not repeated operational failure
];

// Circuit breaker state
const STATE = Object.freeze({
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
});

class CircuitBreaker {
  constructor(options = {}) {
    this.provider = options.provider || 'internal';
    this.criticality = PROVIDER_CRITICALITY[this.provider] || 'optional';
    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.openTime = 0;
    this.halfOpenProbeCount = 0;

    this.failureThreshold = CLOSED_THRESHOLDS[this.criticality] || CLOSED_THRESHOLDS.optional;
    this.cooldown = COOLDOWN_MS[this.criticality] || COOLDOWN_MS.optional;
    this.probeLimit = PROBE_LIMIT;
  }

  /**
   * Record a failed request to the circuit breaker.
   * Only counts certain error types as "qualifying failures".
   */
  recordFailure(errorType) {
    // Exclude error types that shouldn't count toward circuit opening
    if (EXCLUDED_ERROR_TYPES.includes(errorType)) {
      return; // legitimate empty result or malformed response - not repeated operational failure
    }

    if (FAILURE_ERROR_TYPES.includes(errorType)) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      // State transitions
      if (this.state === STATE.CLOSED) {
        if (this.failureCount >= this.failureThreshold) {
          this.state = STATE.OPEN;
          this.openTime = Date.now();
        }
      } else if (this.state === STATE.HALF_OPEN) {
        // Any failure in HALF_OPEN re-opens the circuit
        this.state = STATE.OPEN;
        this.openTime = Date.now();
        this.successCount = 0;
      }
    }
  }

  /**
   * Record a successful request to the circuit breaker.
   */
  recordSuccess() {
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.state === STATE.HALF_OPEN) {
      // If we succeed in the probe, close the circuit
      if (this.successCount >= 1) {
        this.state = STATE.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenProbeCount = 0;
      }
    } else if (this.state === STATE.CLOSED) {
      // Reset failure count on success in CLOSED state
      if (this.failureCount > 0) {
        this.failureCount--;
      }
    }
  }

  /**
   * Attempt a probe call in HALF_OPEN state.
   * Returns true if the probe should be allowed, false if circuit is OPEN.
   */
  shouldAllowProbe() {
    if (this.state !== STATE.HALF_OPEN) {
      return this.state === STATE.CLOSED;
    }

    const timeSinceOpen = Date.now() - this.openTime;
    if (timeSinceOpen < this.cooldown) {
      // Still in cooldown, don't allow probe yet
      return false;
    }

    // Allow at most probeLimit attempts
    if (this.halfOpenProbeCount >= this.probeLimit) {
      return false;
    }

    this.halfOpenProbeCount++;
    return true;
  }

  /**
   * Get current circuit state and metrics.
   */
  getStatus() {
    return {
      provider: this.provider,
      criticality: this.criticality,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      openTime: this.openTime,
      timeSinceOpen: this.state === STATE.OPEN ? Date.now() - this.openTime : 0,
      cooldown: this.cooldown,
      failureThreshold: this.failureThreshold,
      timeUntilCooldownEnds: this.state === STATE.HALF_OPEN
        ? Math.max(0, this.cooldown - (Date.now() - this.openTime))
        : 0,
    };
  }

  /**
   * Force state to a specific value (useful for testing/reset).
   */
  forceState(state) {
    this.state = state;
    this.failureCount = 0;
    this.successCount = 0;
    this.openTime = 0;
    this.halfOpenProbeCount = 0;
  }

  /**
   * Reset the circuit breaker to initial state.
   */
  reset() {
    this.forceState(STATE.CLOSED);
  }
}

// Create per-provider circuit breakers
const circuitBreakers = new Map();

function getCircuitBreaker(provider) {
  if (!circuitBreakers.has(provider)) {
    circuitBreakers.set(provider, new CircuitBreaker({ provider }));
  }
  return circuitBreakers.get(provider);
}

// Export error type constants
export {
  STATE,
  FAILURE_ERROR_TYPES,
  EXCLUDED_ERROR_TYPES,
  CLOSED_THRESHOLDS,
  COOLDOWN_MS,
  PROBE_LIMIT,
  PROVIDER_CRITICALITY,
};

// Export main functions
export { getCircuitBreaker, circuitBreakers, CircuitBreaker };

// Export default for compatibility
export default CircuitBreaker;