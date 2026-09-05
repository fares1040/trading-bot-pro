/**
 * Live Connectivity Health Check — P2-6
 *
 * Pure helper functions that classify per-endpoint connectivity status
 * by combining circuit-breaker state with failure-event history.
 *
 * Reuses:
 *   - lib/circuit-breaker.js (CircuitBreaker states: CLOSED/OPEN/HALF_OPEN)
 *   - lib/failure-events.js (summarize, list, PROVIDERS, ERROR_TYPES)
 *   - lib/circuit-breaker-manager.js (getCircuitBreaker, shouldAllowProviderCall)
 *
 * Does NOT:
 *   - fabricate data, timestamps, or provider status
 *   - probe external providers directly (only internal API endpoints + circuit state)
 *   - change scoring logic, RR<1 policy, or trading decisions
 *
 * Endpoint health classification:
 *   CONNECTED    — circuit CLOSED, no critical failures in window
 *   DEGRADED     — circuit CLOSED but recent non-critical failures, OR HALF_OPEN
 *   UNAVAILABLE  — circuit OPEN, or critical failure in window
 *   UNCHECKED    — no data available (e.g., in SSR or before first probe)
 */

import {
  STATE,
  getCircuitBreaker,
} from './circuit-breaker.js';
import {
  summarize,
  list,
  PROVIDERS,
  ERROR_TYPES,
  SEVERITY,
} from './failure-events.js';

const HEALTH_STATUS = Object.freeze({
  CONNECTED: 'CONNECTED',
  DEGRADED: 'DEGRADED',
  UNAVAILABLE: 'UNAVAILABLE',
  UNCHECKED: 'UNCHECKED',
});

// Internal API endpoints mapped to their primary provider
const ENDPOINT_PROVIDERS = Object.freeze({
  '/api/health': 'internal',
  '/api/stocks': 'yahoo',
  '/api/market-data': 'yahoo',
  '/api/market-regime': 'internal',
  '/api/opportunity-ranking': 'internal',
  '/api/trade-plan': 'internal',
  '/api/ai-explanation': 'openai',
  '/api/options-radar': 'yahoo',
  '/api/command-center': 'internal',
  '/api/alert-center': 'internal',
  '/api/hunter': 'internal',
  '/api/swing-horizon': 'internal',
});

const HEALTH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Classify a single endpoint's connectivity status from circuit breaker
 * state and recent failure events.
 *
 * @param {string} endpoint - API endpoint path (e.g. '/api/health')
 * @param {string} providerOverride - Optional provider override
 * @returns {Object} { endpoint, provider, status, circuitState, latency, lastChecked, failures }
 */
function classifyEndpointHealth(endpoint, providerOverride) {
  const provider = providerOverride || ENDPOINT_PROVIDERS[endpoint] || 'internal';
  const cb = getCircuitBreaker(provider);
  const cbStatus = cb.getStatus();
  const summary = summarize({ windowMs: HEALTH_WINDOW_MS });
  const recentEvents = list({
    route: endpoint.replace('/api/', ''),
    limit: 20,
  });

  let status = HEALTH_STATUS.UNCHECKED;
  let criticalFailures = [];

  // If circuit is OPEN, the endpoint is UNAVAILABLE
  if (cbStatus.state === STATE.OPEN) {
    status = HEALTH_STATUS.UNAVAILABLE;
  } else if (cbStatus.state === STATE.HALF_OPEN) {
    status = HEALTH_STATUS.DEGRADED;
  } else {
    // Circuit is CLOSED — check recent failure events
    criticalFailures = recentEvents.filter(
      (e) => e.severity === SEVERITY.CRITICAL || e.severity === SEVERITY.HIGH
    );
    const nonCriticalFailures = recentEvents.filter(
      (e) => e.severity === SEVERITY.MEDIUM || e.severity === SEVERITY.LOW
    );

    if (criticalFailures.length > 0) {
      status = HEALTH_STATUS.UNAVAILABLE;
    } else if (nonCriticalFailures.length > 0 || cbStatus.failureCount > 0) {
      status = HEALTH_STATUS.DEGRADED;
    } else {
      status = HEALTH_STATUS.CONNECTED;
    }
  }

  return {
    endpoint,
    provider,
    status,
    circuitState: cbStatus.state,
    failureCount: cbStatus.failureCount,
    severity: criticalSeverity(criticalFailures),
    lastFailure: recentEvents.length > 0 && recentEvents[0].timestamp
      ? recentEvents[0].timestamp
      : null,
    lastChecked: new Date().toISOString(),
  };
}

function criticalSeverity(events) {
  if (events.length === 0) return null;
  const hasCritical = events.some((e) => e.severity === SEVERITY.CRITICAL);
  if (hasCritical) return SEVERITY.CRITICAL;
  return events[0].severity;
}

/**
 * Build a complete connectivity health report for all tracked endpoints.
 *
 * @param {Array} [endpoints] - Optional list of endpoints to check.
 *   Defaults to the built-in ENDPOINT_PROVIDERS list.
 * @returns {Object} Health report with per-endpoint status, aggregate status, and metadata
 */
function buildConnectivityHealth(endpoints) {
  const endpointList = endpoints || Object.keys(ENDPOINT_PROVIDERS);
  const results = endpointList.map((ep) => classifyEndpointHealth(ep));

  const statuses = results.map((r) => r.status);
  const hasUnavailable = statuses.includes(HEALTH_STATUS.UNAVAILABLE);
  const hasDegraded = statuses.includes(HEALTH_STATUS.DEGRADED);
  const hasUnchecked = statuses.includes(HEALTH_STATUS.UNCHECKED);

  let aggregate = HEALTH_STATUS.CONNECTED;
  if (hasUnavailable) {
    aggregate = HEALTH_STATUS.UNAVAILABLE;
  } else if (hasDegraded) {
    aggregate = HEALTH_STATUS.DEGRADED;
  } else if (hasUnchecked && !hasDegraded && !hasUnavailable) {
    aggregate = HEALTH_STATUS.UNCHECKED;
  }

  const byStatus = {
    CONNECTED: results.filter((r) => r.status === HEALTH_STATUS.CONNECTED).length,
    DEGRADED: results.filter((r) => r.status === HEALTH_STATUS.DEGRADED).length,
    UNAVAILABLE: results.filter((r) => r.status === HEALTH_STATUS.UNAVAILABLE).length,
    UNCHECKED: results.filter((r) => r.status === HEALTH_STATUS.UNCHECKED).length,
  };

  return {
    success: true,
    timestamp: new Date().toISOString(),
    status: aggregate,
    endpoints: results,
    summary: byStatus,
    totalEndpoints: results.length,
    healthy: aggregate === HEALTH_STATUS.CONNECTED,
    degraded: aggregate === HEALTH_STATUS.DEGRADED ||
      byStatus.DEGRADED > 0 || byStatus.UNAVAILABLE > 0,
    unavailable: byStatus.UNAVAILABLE > 0,
    disclaimer: 'Connectivity health is based on circuit-breaker state and recent failure events. Endpoints are probed on-demand. No external connectivity is fabricated.',
  };
}

/**
 * Probe a single endpoint with a real HTTP request (server-side only).
 * Returns actual latency and HTTP status — does NOT fabricate results.
 *
 * @param {string} endpoint - API path (e.g. '/api/health')
 * @param {string} origin - Base origin URL
 * @param {number} timeoutMs - Request timeout in milliseconds
 * @returns {Promise<Object>} Probe result with actual data
 */
async function probeEndpoint(endpoint, origin, timeoutMs = 10000) {
  const startTime = Date.now();
  let status = HEALTH_STATUS.CONNECTED;
  let httpStatus = null;
  let latency = null;
  let error = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${origin}${endpoint}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    latency = Date.now() - startTime;
    httpStatus = response.status;

    if (!response.ok) {
      if (response.status >= 500) {
        status = HEALTH_STATUS.UNAVAILABLE;
      } else if (response.status >= 400) {
        status = HEALTH_STATUS.DEGRADED;
      } else {
        status = HEALTH_STATUS.CONNECTED;
      }
    }
  } catch (err) {
    latency = Date.now() - startTime;
    if (err?.name === 'AbortError' || err?.message?.includes('timeout')) {
      status = HEALTH_STATUS.UNAVAILABLE;
      error = 'TIMEOUT';
    } else {
      status = HEALTH_STATUS.UNAVAILABLE;
      error = 'FETCH_FAILED';
    }
  }

  return {
    endpoint,
    status,
    httpStatus,
    latency: latency != null ? Math.round(latency) : null,
    timestamp: new Date().toISOString(),
    error,
  };
}

/**
 * Probe multiple endpoints and merge results with circuit-breaker state.
 *
 * @param {Array} endpoints - Array of { endpoint, origin } objects
 * @param {number} timeoutMs - Per-endpoint timeout
 * @returns {Promise<Object>} Combined probe + circuit-breaker health report
 */
async function probeAllEndpoints(endpoints, timeoutMs = 10000) {
  const probeResults = await Promise.all(
    endpoints.map(async ({ endpoint, origin }) => {
      const probe = await probeEndpoint(endpoint, origin, timeoutMs);
      const circuit = classifyEndpointHealth(endpoint);
      return {
        endpoint: probe.endpoint,
        status: combineStatus(probe.status, circuit.status),
        provider: circuit.provider,
        circuitState: circuit.circuitState,
        failureCount: circuit.failureCount,
        latency: probe.latency,
        httpStatus: probe.httpStatus,
        lastChecked: probe.timestamp,
        lastFailure: circuit.lastFailure,
        error: probe.error,
      };
    })
  );

  const statuses = probeResults.map((r) => r.status);
  let aggregate = HEALTH_STATUS.CONNECTED;
  if (statuses.includes(HEALTH_STATUS.UNAVAILABLE)) {
    aggregate = HEALTH_STATUS.UNAVAILABLE;
  } else if (statuses.includes(HEALTH_STATUS.DEGRADED) || statuses.includes(HEALTH_STATUS.UNCHECKED)) {
    aggregate = HEALTH_STATUS.DEGRADED;
  }

  const byStatus = {
    CONNECTED: probeResults.filter((r) => r.status === HEALTH_STATUS.CONNECTED).length,
    DEGRADED: probeResults.filter((r) => r.status === HEALTH_STATUS.DEGRADED).length,
    UNAVAILABLE: probeResults.filter((r) => r.status === HEALTH_STATUS.UNAVAILABLE).length,
    UNCHECKED: probeResults.filter((r) => r.status === HEALTH_STATUS.UNCHECKED).length,
  };

  return {
    success: true,
    timestamp: new Date().toISOString(),
    status: aggregate,
    endpoints: probeResults,
    summary: byStatus,
    totalEndpoints: probeResults.length,
    healthy: aggregate === HEALTH_STATUS.CONNECTED,
    degraded: aggregate === HEALTH_STATUS.DEGRADED || byStatus.DEGRADED > 0 || byStatus.UNAVAILABLE > 0,
    unavailable: byStatus.UNAVAILABLE > 0,
    disclaimer: 'Live connectivity health combines real HTTP probe results with circuit-breaker state. No status is fabricated.',
  };
}

function combineStatus(probeStatus, circuitStatus) {
  const order = {
    [HEALTH_STATUS.UNAVAILABLE]: 0,
    [HEALTH_STATUS.DEGRADED]: 1,
    [HEALTH_STATUS.UNCHECKED]: 2,
    [HEALTH_STATUS.CONNECTED]: 3,
  };
  const probeRank = order[probeStatus] ?? 3;
  const circuitRank = order[circuitStatus] ?? 3;
  const worstRank = Math.min(probeRank, circuitRank);

  const reverse = {};
  Object.entries(order).forEach(([k, v]) => { reverse[v] = k; });
  return reverse[worstRank] || HEALTH_STATUS.CONNECTED;
}

export {
  HEALTH_STATUS,
  ENDPOINT_PROVIDERS,
  HEALTH_WINDOW_MS,
  classifyEndpointHealth,
  buildConnectivityHealth,
  probeEndpoint,
  probeAllEndpoints,
  combineStatus,
};

export default {
  HEALTH_STATUS,
  ENDPOINT_PROVIDERS,
  HEALTH_WINDOW_MS,
  classifyEndpointHealth,
  buildConnectivityHealth,
  probeEndpoint,
  probeAllEndpoints,
  combineStatus,
};
