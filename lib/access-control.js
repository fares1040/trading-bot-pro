export const PLAN_FEATURES = Object.freeze({
  free: ['market-radar', 'basic-analysis', 'risk-calculator'],
  premium: ['market-radar', 'basic-analysis', 'risk-calculator', 'hunter-score', 'advanced-radar', 'ai-explanations', 'alerts', 'paper-trading', 'journal'],
  admin: ['market-radar', 'basic-analysis', 'risk-calculator', 'hunter-score', 'advanced-radar', 'ai-explanations', 'alerts', 'paper-trading', 'journal', 'admin-dashboard', 'system-health', 'production-validation'],
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
