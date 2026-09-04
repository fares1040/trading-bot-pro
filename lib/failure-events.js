/**
 * Production Failure Event Tracker — P1-4
 *
 * In-memory structured failure event store with:
 *   - classification by route / provider / error type / severity
 *   - dedupe + cooldown to prevent alert storms
 *   - summary helpers used by /api/health and /api/production
 *
 * This is observability only. It does NOT:
 *   - send external notifications (none configured, none fabricated)
 *   - change any trading logic, scoring, or thresholds
 *   - persist events across restarts (acceptable for single-process visibility)
 *
 * If a real notification channel (Telegram/Discord/Slack/webhook) is later
 * added for failure alerts, this module is the single place to wire it.
 *
 * SECURITY:
 *   - Never log API keys, Authorization headers, or secrets.
 *   - Sanitize all messages before storing/returning.
 *   - Strip stack traces from external output (kept in-process only).
 */

const SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO',
});

const ERROR_TYPES = Object.freeze({
  HTTP_FAILURE: 'HTTP_FAILURE',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
  AUTH_FAILURE: 'AUTH_FAILURE',
  RATE_LIMIT: 'RATE_LIMIT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN: 'UNKNOWN',
});

const PROVIDERS = Object.freeze({
  YAHOO: 'yahoo',
  FINNHUB: 'finnhub',
  FINRA: 'finra',
  SEC: 'sec',
  SUPABASE: 'supabase',
  GEMINI: 'gemini',
  OPENAI: 'openai',
  TELEGRAM: 'telegram',
  DISCORD: 'discord',
  INTERNAL: 'internal',
});

const PROVIDER_CRITICALITY = Object.freeze({
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
});

const MAX_EVENTS = 200;
const COOLDOWN_MS = 5 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

const SECRET_PATTERNS = [
  /(?:api[_-]?key|token|secret|password|authorization|bearer)\s*[:=]\s*["']?[A-Za-z0-9_\-\.=]{8,}/gi,
  /Bearer\s+[A-Za-z0-9_\-\.=]{8,}/gi,
];

function sanitize(value, maxLen = 200) {
  if (value == null) return null;
  let s = typeof value === 'string' ? value : String(value);
  for (const pattern of SECRET_PATTERNS) {
    s = s.replace(pattern, '[REDACTED]');
  }
  s = s.replace(/[\r\n]+/g, ' ').trim();
  if (s.length > maxLen) s = `${s.slice(0, maxLen - 3)}...`;
  return s;
}

function classifyErrorType(errorOrMessage) {
  const raw = typeof errorOrMessage === 'string'
    ? errorOrMessage
    : (errorOrMessage?.message || errorOrMessage?.name || '');
  const m = String(raw).toLowerCase();
  if (m.includes('timeout') || m.includes('aborted') || m.includes('timed out')) return ERROR_TYPES.TIMEOUT;
  if (m.includes('auth') || m.includes('401') || m.includes('403') || m.includes('unauthorized') || m.includes('forbidden')) return ERROR_TYPES.AUTH_FAILURE;
  if (m.includes('429') || m.includes('rate limit') || m.includes('too many')) return ERROR_TYPES.RATE_LIMIT;
  if (m.includes('empty') || m.includes('no data') || m.includes('no market data') || m.includes('incomplete')) return ERROR_TYPES.EMPTY_RESPONSE;
  if (m.includes('malformed') || m.includes('invalid json') || m.includes('parse')) return ERROR_TYPES.MALFORMED_RESPONSE;
  if (m.includes('http') || /\b[5-9]\d{2}\b/.test(m) || /\b4\d{2}\b/.test(m)) return ERROR_TYPES.HTTP_FAILURE;
  if (m.includes('unavailable') || m.includes('econnrefused') || m.includes('enotfound') || m.includes('network') || m.includes('fetch failed')) return ERROR_TYPES.PROVIDER_UNAVAILABLE;
  if (m.includes('provider') && m.includes('not')) return ERROR_TYPES.PROVIDER_UNAVAILABLE;
  return ERROR_TYPES.INTERNAL_ERROR;
}

function severityForProvider(provider, errorType) {
  const criticality = PROVIDER_CRITICALITY[provider] || 'critical';
  if (errorType === ERROR_TYPES.AUTH_FAILURE && provider === PROVIDERS.FINRA) return SEVERITY.MEDIUM;
  if (errorType === ERROR_TYPES.RATE_LIMIT) return SEVERITY.MEDIUM;
  if (errorType === ERROR_TYPES.TIMEOUT) return SEVERITY.MEDIUM;
  if (errorType === ERROR_TYPES.EMPTY_RESPONSE) return SEVERITY.MEDIUM;
  if (errorType === ERROR_TYPES.MALFORMED_RESPONSE) return SEVERITY.HIGH;
  if (errorType === ERROR_TYPES.AUTH_FAILURE && criticality === 'optional') return SEVERITY.LOW;
  if (errorType === ERROR_TYPES.INTERNAL_ERROR) return SEVERITY.HIGH;
  if (criticality === 'critical') return SEVERITY.CRITICAL;
  return SEVERITY.MEDIUM;
}

const events = [];
let dedupeIndex = new Map();

function buildKey(route, provider, errorType) {
  return `${route || 'unknown'}|${provider || 'unknown'}|${errorType || 'unknown'}`;
}

function record({
  route = 'unknown',
  provider = PROVIDERS.INTERNAL,
  errorType = null,
  severity = null,
  message = null,
  status = null,
  error = null,
  symbol = null,
  optional = null,
} = {}) {
  try {
    const type = errorType || classifyErrorType(error || message);
    const sev = severity || severityForProvider(provider, type);
    const isOptional = optional != null ? Boolean(optional) : (PROVIDER_CRITICALITY[provider] === 'optional');

    const safeMessage = sanitize(message || (error && (error.message || error.name)) || 'unspecified failure');
    const safeStatus = Number.isFinite(status) ? status : null;

    const key = buildKey(route, provider, type);
    const now = Date.now();
    const last = dedupeIndex.get(key);
    if (last && now - last.lastSeen < COOLDOWN_MS) {
      last.count = (last.count || 1) + 1;
      last.lastSeen = now;
      return { deduplicated: true, key };
    }

    const event = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(now).toISOString(),
      route: String(route).slice(0, 120),
      provider: String(provider).slice(0, 60),
      errorType: type,
      severity: sev,
      optional: isOptional,
      message: safeMessage,
      status: safeStatus,
      symbol: symbol ? String(symbol).toUpperCase().slice(0, 12) : null,
    };

    if (dedupeIndex.size > 500) {
      for (const [k, v] of dedupeIndex) {
        if (now - v.lastSeen > WINDOW_MS) dedupeIndex.delete(k);
      }
    }
    dedupeIndex.set(key, { count: 1, firstSeen: now, lastSeen: now });

    events.push(event);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);

    return { deduplicated: false, event };
  } catch {
    return { deduplicated: true, key: null };
  }
}

function list({ since, severity, provider, route, limit = 50 } = {}) {
  const cutoff = since ? new Date(since).getTime() : 0;
  const result = [];
  for (let i = events.length - 1; i >= 0 && result.length < limit; i -= 1) {
    const e = events[i];
    if (cutoff && new Date(e.timestamp).getTime() < cutoff) continue;
    if (severity && e.severity !== severity) continue;
    if (provider && e.provider !== provider) continue;
    if (route && e.route !== route) continue;
    result.push(e);
  }
  return result;
}

function summarize({ windowMs = WINDOW_MS } = {}) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const counts = {
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    byProvider: {},
    byErrorType: {},
    byRoute: {},
  };
  const dedupCounts = new Map();
  for (const e of events) {
    const t = new Date(e.timestamp).getTime();
    if (t < cutoff) continue;
    counts.total += 1;
    if (e.severity === SEVERITY.CRITICAL) counts.critical += 1;
    else if (e.severity === SEVERITY.HIGH) counts.high += 1;
    else if (e.severity === SEVERITY.MEDIUM) counts.medium += 1;
    else if (e.severity === SEVERITY.LOW) counts.low += 1;
    else counts.info += 1;
    counts.byProvider[e.provider] = (counts.byProvider[e.provider] || 0) + 1;
    counts.byErrorType[e.errorType] = (counts.byErrorType[e.errorType] || 0) + 1;
    counts.byRoute[e.route] = (counts.byRoute[e.route] || 0) + 1;
    const k = `${e.route}|${e.provider}|${e.errorType}`;
    dedupCounts.set(k, (dedupCounts.get(k) || 0) + 1);
  }
  const distinctKeys = dedupCounts.size;
  const criticalActive = counts.critical > 0;
  const highActive = counts.high > 0;
  const mediumActive = counts.medium > 0;
  let status = 'healthy';
  if (criticalActive) status = 'unavailable';
  else if (highActive) status = 'degraded';
  else if (mediumActive) status = 'degraded';
  return {
    windowMs,
    counts,
    distinctFailures: distinctKeys,
    status,
  };
}

function clear() {
  events.length = 0;
  dedupeIndex.clear();
}

function lastCritical({ windowMs = WINDOW_MS, ignoreOptional = true } = {}) {
  const now = Date.now();
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (now - new Date(e.timestamp).getTime() > windowMs) continue;
    if (ignoreOptional && e.optional) continue;
    if (e.severity === SEVERITY.CRITICAL || e.severity === SEVERITY.HIGH) return e;
  }
  return null;
}

/**
 * Wrap a fetch call and record a failure event when it fails.
 *
 * Usage:
 *   const res = await fetchWithFailure(
 *     { url: 'https://...', route: 'market-data', provider: PROVIDERS.FINNHUB },
 *     { cache: 'no-store' }
 *   );
 *
 * On success, returns the original Response.
 * On failure (network error, timeout, non-2xx), records a structured
 * failure event and re-throws the original error so callers can fall back.
 */
async function fetchWithFailure({ url, route = 'unknown', provider = PROVIDERS.INTERNAL, symbol = null, optional = null }, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      record({
        route,
        provider,
        errorType: ERROR_TYPES.HTTP_FAILURE,
        message: `HTTP ${response.status} ${response.statusText}`,
        status: response.status,
        symbol,
        optional,
      });
    }
    return response;
  } catch (error) {
    record({
      route,
      provider,
      error,
      symbol,
      optional,
    });
    throw error;
  }
}

/**
 * Wrap a promise that may throw or return null/undefined.
 * Records a failure event when the promise rejects or returns a falsy value.
 */
async function wrapPromise({ promise, route = 'unknown', provider = PROVIDERS.INTERNAL, symbol = null, optional = null, expectData = true }) {
  try {
    const value = await promise;
    if (expectData && (value === null || value === undefined)) {
      record({
        route,
        provider,
        errorType: ERROR_TYPES.EMPTY_RESPONSE,
        message: 'Provider returned null/undefined response',
        symbol,
        optional,
      });
    }
    return value;
  } catch (error) {
    record({
      route,
      provider,
      error,
      symbol,
      optional,
    });
    throw error;
  }
}

/**
 * Record a non-network failure (e.g. malformed response, validation error).
 */
function recordFailure({ route, provider, errorType, message, severity, symbol, optional, status }) {
  return record({
    route,
    provider,
    errorType,
    message,
    severity,
    symbol,
    optional,
    status,
  });
}

function healthStatus() {
  return summarize();
}

export {
  SEVERITY,
  ERROR_TYPES,
  PROVIDERS,
  PROVIDER_CRITICALITY,
  MAX_EVENTS,
  COOLDOWN_MS,
  WINDOW_MS,
  sanitize,
  classifyErrorType,
  severityForProvider,
  record,
  list,
  summarize,
  clear,
  lastCritical,
  healthStatus,
};

export default {
  SEVERITY,
  ERROR_TYPES,
  PROVIDERS,
  record,
  list,
  summarize,
  clear,
  lastCritical,
  healthStatus,
};
