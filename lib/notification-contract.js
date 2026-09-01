/**
 * Telegram-Ready Notification Contract
 *
 * Pure contract layer that defines the structure and lifecycle of alerts
 * ready for Telegram transport. This is NOT a sender - it only defines
 * the data structure and state transitions.
 *
 * Data Source: Aggregated from C7 Opportunity Ranking, C8 Trade Plan Engine,
 *              C9 AI Explanation, and B1-B6 intelligence managers
 *
 * Alert Lifecycle (Telegram-ready):
 *   READY → TRIGGERED → SENT → DISABLED
 *   READY → TRIGGERED → FAILED → DISABLED
 *
 * Each alert represents a trade opportunity at a specific lifecycle stage
 * and contains all necessary data for Telegram formatting.
 */

import { 
  n, 
  clamp, 
  round, 
  nowISO,
  DIRECTION,
  TIMEFRAME,
  PLAN_SIGNAL_THRESHOLDS,
  TRADE_PLAN_QUALITY_THRESHOLDS
} from './trade-plan-engine.js';

export const NOTIFICATION_STATUSES = Object.freeze({
  READY: 'READY',
  TRIGGERED: 'TRIGGERED',
  SENT: 'SENT',
  FAILED: 'FAILED',
  DISABLED: 'DISABLED',
});

export const TRADE_LIFECYCLE_STAGES = Object.freeze({
  PRE_ENTRY: 'PRE_ENTRY',
  CONFIRMATION: 'CONFIRMATION',
  ENTRY: 'ENTRY',
  TARGET_1: 'TARGET_1',
  TARGET_2: 'TARGET_2',
  STOP: 'STOP',
  INVALIDATION: 'INVALIDATION',
  EXIT: 'EXIT',
});

/**
 * Create a notification-ready alert from trade plan and opportunity data
 * @param {Object} tradePlan - Output from C8 Trade Plan Engine
 * @param {Object} opportunity - Output from C7 Opportunity Ranking
 * @param {Object} regimeData - Output from C10 Market Regime Engine
 * @param {string} lifecycleStage - Current trade lifecycle stage
 * @returns {Object} Notification-ready alert contract
 */
export function createNotificationAlert(
  tradePlan = {},
  opportunity = {},
  regimeData = {},
  lifecycleStage = 'PRE_ENTRY'
) {
  // Validate lifecycle stage
  if (!Object.values(TRADE_LIFECYCLE_STAGES).includes(lifecycleStage)) {
    throw new Error(`Invalid lifecycle stage: ${lifecycleStage}`);
  }

  // Extract core data with null safety
  const symbol = tradePlan.symbol || opportunity.symbol || null;
  if (!symbol) return null;

  const direction = tradePlan.direction || opportunity.directionBias || DIRECTION.UNAVAILABLE;
  const timestamp = nowISO();

  // Extract prices and levels
  const entryPrice = n(tradePlan.entryPrice) ?? n(opportunity.price) ?? null;
  const stopLoss = n(tradePlan.stopLoss) ?? null;
  const target1 = n(tradePlan.target1) ?? null;
  const target2 = n(tradePlan.target2) ?? null;
  const invalidation = n(tradePlan.invalidation) ?? null;

  // Calculate risk/reward if possible
  let riskReward = null;
  if (entryPrice != null && stopLoss != null && target1 != null) {
    if (direction === DIRECTION.LONG) {
      const risk = entryPrice - stopLoss;
      const reward = target1 - entryPrice;
      if (risk > 0) riskReward = round(reward / risk, 2);
    } else if (direction === DIRECTION.SHORT) {
      const risk = stopLoss - entryPrice;
      const reward = entryPrice - target1;
      if (risk > 0) riskReward = round(reward / risk, 2);
    }
  }

  // Build alert reason based on lifecycle stage and available data
  const reason = buildAlertReason(lifecycleStage, tradePlan, opportunity, regimeData);

  // Extract supporting evidence
  const evidence = buildAlertEvidence(tradePlan, opportunity);

  // Extract risks and warnings
  const risks = (tradePlan.risks || []).map(r => ({
    label: r.label,
    severity: r.severity,
    description: r.description || r.label
  }));

  const warnings = tradePlan.warnings || [];

  // Build the notification contract
  const alert = {
    id: `${symbol}-${lifecycleStage}-${timestamp}`,
    ticker: symbol,
    direction,
    price: entryPrice,
    timestamp,
    setup: tradePlan.setup || opportunity.setup || null,
    confidence: tradePlan.confidence ?? opportunity.confidence ?? null,
    entry: entryPrice,
    stop: stopLoss,
    targets: {
      t1: target1,
      t2: target2
    },
    invalidation,
    riskReward,
    reason,
    status: NOTIFICATION_STATUSES.READY, // Start as READY
    lifecycleStage,
    evidence,
    risks,
    warnings,
    dataAvailability: {
      opportunityRanking: !!opportunity.available,
      tradePlan: !!tradePlan.available,
      swingIntelligence: true, // Simplified - would come from data
      institutionalRadar: true,
      catalystIntelligence: true,
      pennyIntelligence: true,
      optionsIntelligence: true,
      earlyExplosion: true,
      marketRegime: !!regimeData.available
    },
    // Metadata for UI/display
    metadata: {
      opportunityScore: n(opportunity.opportunityScore) ?? n(opportunity.setupScore) ?? null,
      planScore: n(tradePlan.planScore) ?? null,
      planQuality: tradePlan.planQuality || 'UNAVAILABLE',
      planSignal: tradePlan.planSignal || 'UNAVAILABLE',
      regime: regimeData.regime || 'UNAVAILABLE',
      regimeScore: n(regimeData.regimeScore) ?? null,
    }
  };

  return alert;
}

/**
 * Transition an alert to the next status in the Telegram lifecycle
 * @param {Object} alert - Notification alert contract
 * @param {string} newStatus - Target status (must be valid transition)
 * @returns {Object} Updated alert contract
 */
export function transitionAlertStatus(alert, newStatus) {
  if (!alert) return null;

  // Validate status transition
  const validTransitions = {
    [NOTIFICATION_STATUSES.READY]: [NOTIFICATION_STATUSES.TRIGGERED, NOTIFICATION_STATUSES.DISABLED],
    [NOTIFICATION_STATUSES.TRIGGERED]: [NOTIFICATION_STATUSES.SENT, NOTIFICATION_STATUSES.FAILED, NOTIFICATION_STATUSES.DISABLED],
    [NOTIFICATION_STATUSES.SENT]: [NOTIFICATION_STATUSES.DISABLED],
    [NOTIFICATION_STATUSES.FAILED]: [NOTIFICATION_STATUSES.DISABLED],
    [NOTIFICATION_STATUSES.DISABLED]: [] // Terminal state
  };

  const currentStatus = alert.status;
  const validNextStatuses = validTransitions[currentStatus] || [];

  if (!validNextStatuses.includes(newStatus)) {
    throw new Error(`Invalid status transition: ${currentStatus} → ${newStatus}`);
  }

  // Return updated alert
  return {
    ...alert,
    status: newStatus,
    timestamp: newStatus === NOTIFICATION_STATUSES.SENT || newStatus === NOTIFICATION_STATUSES.FAILED 
              ? nowISO() 
              : alert.timestamp
  };
}

/**
 * Check if an alert is ready to be sent (in TRIGGERED state)
 * @param {Object} alert - Notification alert contract
 * @returns {boolean} True if alert is TRIGGERED
 */
export function isAlertReadyToSend(alert) {
  return alert && alert.status === NOTIFICATION_STATUSES.TRIGGERED;
}

/**
 * Check if an alert has been sent or failed (terminal states for sending)
 * @param {Object} alert - Notification alert contract
 * @returns {boolean} True if alert is SENT or FAILED
 */
export function isAlertSentOrFailed(alert) {
  return alert && 
         (alert.status === NOTIFICATION_STATUSES.SENT || 
          alert.status === NOTIFICATION_STATUSES.FAILED);
}

/**
 * Build alert reason based on lifecycle stage and available data
 */
function buildAlertReason(lifecycleStage, tradePlan, opportunity, regimeData) {
  const parts = [];

  // Add lifecycle context
  parts.push(`Stage: ${lifecycleStage.replace('_', ' ')}`);

  // Add direction if available
  if (tradePlan.direction && tradePlan.direction !== DIRECTION.UNAVAILABLE) {
    parts.push(`Direction: ${tradePlan.direction}`);
  }

  // Add quality/signal if available
  if (tradePlan.planQuality && tradePlan.planQuality !== 'UNAVAILABLE') {
    parts.push(`Quality: ${tradePlan.planQuality}`);
  }
  
  if (tradePlan.planSignal && tradePlan.planSignal !== 'UNAVAILABLE') {
    parts.push(`Signal: ${tradePlan.planSignal}`);
  }
  
  // Add opportunity score if available
  const oppScore = n(opportunity.opportunityScore) ?? n(opportunity.setupScore);
  if (oppScore != null) {
    parts.push(`Opportunity Score: ${oppScore}/100`);
  }
  
  // Add plan score if available
  const planScore = n(tradePlan.planScore);
  if (planScore != null) {
    parts.push(`Plan Score: ${planScore}/100`);
  }
  
  // Add risk/reward if available
  const riskReward = n(tradePlan.riskReward);
  if (riskReward != null) {
    parts.push(`Risk/Reward: ${riskReward}`);
  }
  
  // Add confidence if available
  const confidence = tradePlan.confidence ?? opportunity.confidence;
  if (confidence != null) {
    parts.push(`Confidence: ${confidence}%`);
  }
  
  // Add regime if available
  if (regimeData.regime && regimeData.regime !== 'UNAVAILABLE') {
    parts.push(`Regime: ${regimeData.regime}`);
  }
  
  if (regimeData.regimeScore != null) {
    parts.push(`Regime Score: ${regimeData.regimeScore}/100`);
  }
  
  // Add stage-specific details
  switch (lifecycleStage) {
    case 'PRE_ENTRY':
      parts.push('Awaiting entry confirmation');
      break;
    case 'CONFIRMATION':
      parts.push('Setup confirmed, preparing for entry');
      break;
    case 'ENTRY':
      parts.push('Entry triggered');
      break;
    case 'TARGET_1':
      parts.push('First target reached');
      break;
    case 'TARGET_2':
      parts.push('Second target reached');
      break;
    case 'STOP':
      parts.push('Stop loss triggered');
      break;
    case 'INVALIDATION':
      parts.push('Setup invalidated');
      break;
    case 'EXIT':
      parts.push('Trade completed');
      break;
  }
  
  return parts.filter(p => p).join(' • ');
}

/**
 * Build alert evidence from trade plan and opportunity data
 */
function buildAlertEvidence(tradePlan, opportunity) {
  const evidence = [];
  
  // Add supporting evidence from trade plan
  if (tradePlan.supportingEvidence && Array.isArray(tradePlan.supportingEvidence)) {
    tradePlan.supportingEvidence.forEach(ev => {
      if (ev.label && ev.score != null) {
        evidence.push(`${ev.label}: ${ev.score}${ev.weight !== null ? ` (weight: ${ev.weight})` : ''}`);
      }
    });
  }
  
  // Add data completeness if available
  if (tradePlan.dataCompleteness != null) {
    evidence.push(`Data Completeness: ${tradePlan.dataCompleteness}%`);
  }
  
  if (opportunity.dataCompleteness != null) {
    evidence.push(`Opportunity Data Completeness: ${opportunity.dataCompleteness}%`);
  }
  
  // Add horizon evidence if available
  if (opportunity.horizonEvidence) {
    const { horizon, horizonScore } = opportunity.horizonEvidence;
    if (horizon) {
      evidence.push(`Horizon: ${horizon}${horizonScore != null ? ` (${horizonScore}/100)` : ''}`);
    }
  }
  
  return evidence;
}

export default {
  createNotificationAlert,
  transitionAlertStatus,
  isAlertReadyToSend,
  isAlertSentOrFailed,
  NOTIFICATION_STATUSES,
  TRADE_LIFECYCLE_STAGES
};