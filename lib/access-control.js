export const PLAN_FEATURES = Object.freeze({
  free: ['market-radar', 'basic-analysis', 'risk-calculator'],
  premium: ['market-radar', 'basic-analysis', 'risk-calculator', 'hunter-score', 'advanced-radar', 'ai-explanations', 'alerts', 'paper-trading', 'journal'],
  admin: ['market-radar', 'basic-analysis', 'risk-calculator', 'hunter-score', 'advanced-radar', 'ai-explanations', 'alerts', 'paper-trading', 'journal', 'admin-dashboard', 'system-health', 'production-validation'],
});

export const DASHBOARD_PROVIDERS = Object.freeze({
  internal: 'internal',
  yahoo: 'yahoo',
  finnhub: 'finnhub',
  finra: 'finra',
  openai: 'openai',
  gemini: 'gemini',
  telegram: 'telegram',
  discord: 'discord',
  supabase: 'supabase',
});

export function normalizePlan(value) {
  const plan = String(value || '').trim().toLowerCase();
  return ['free', 'premium', 'admin'].includes(plan) ? plan : 'free';
}

export function getDefaultPlan() {
  return normalizePlan(process.env.HUNTER_DEFAULT_PLAN || 'free');
}

export function getPlanFeatures(plan = getDefaultPlan()) {
  const normalized = normalizePlan(plan);
  return { plan: normalized, features: PLAN_FEATURES[normalized] };
}

/**
 * Dashboard read-access gate.
 *
 * Read-only dashboard APIs (Command Center, Opportunity Ranking, Trade Plan,
 * Market Regime, Alert Center) are invoked client-side without a cron secret.
 * When CRON_SECRET is set for scheduled jobs, this function allows browser
 * requests that carry NEXT_PUBLIC_DASHBOARD_READ_TOKEN.
 *
 * Security: NEXT_PUBLIC_DASHBOARD_READ_TOKEN is intentionally low-privilege —
 * it only grants read access to the dashboard data API. It never grants write,
 * admin, or cron-trigger privileges. The full CRON_SECRET remains server-side
 * and is not exposed to the browser.
 *
 * @returns {{cronSecret: string|null, readToken: string|null, readTokenConfigured: boolean}}
 */
export function getDashboardAccess() {
  const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || null;
  const readToken = process.env.NEXT_PUBLIC_DASHBOARD_READ_TOKEN || null;

  return {
    cronSecret,
    readToken,
    readTokenConfigured: Boolean(readToken && readToken.length > 0),
  };
}

/**
 * Determine whether a dashboard API request should be allowed.
 *
 * Allowed when:
 *  - No CRON_SECRET is configured (open access, dev/default), OR
 *  - Authorization header matches the cron secret (scheduled/cron access), OR
 *  - Authorization header matches the read token (browser dashboard access).
 *
 * @param {Object} request - NextRequest
 * @returns {{allowed: boolean, reason: string|null}}
 */
export function checkDashboardAccess(request) {
  const { cronSecret, readToken, readTokenConfigured } = getDashboardAccess();

  if (!cronSecret) {
    return { allowed: true, reason: null };
  }

  const auth = request.headers.get('authorization');

  if (auth === `Bearer ${cronSecret}`) {
    return { allowed: true, reason: null };
  }

  if (readTokenConfigured && auth === `Bearer ${readToken}`) {
    return { allowed: true, reason: null };
  }

  return { allowed: false, reason: 'Unauthorized' };
}
