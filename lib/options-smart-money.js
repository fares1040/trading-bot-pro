/**
 * Options Smart Money evidence gate.
 *
 * Combines options-flow pressure with explicit provider attribution only.
 * Size, premium, OI, or directional imbalance alone never becomes a whale claim.
 */

import { aggregateOptionsFlow } from './options-flow-aggregator.js';

export const OPTIONS_SMART_MONEY_VERSION = '1.0';

export function classifyOptionsSmartMoney(observations = [], options = {}) {
  const aggregate = aggregateOptionsFlow(observations, options);
  const explicit = Array.isArray(options.attributionEvidence) ? options.attributionEvidence.filter(Boolean) : [];
  const freshCount = aggregate.observationCount;

  let classification = 'UNATTRIBUTED';
  if (explicit.length > 0 && freshCount > 0 && aggregate.direction !== 'UNKNOWN') classification = 'CONFIRMED';
  else if (freshCount >= 3 && aggregate.pressureScore >= 65) classification = 'POSSIBLE';

  const score = Math.min(
    100,
    (aggregate.pressureScore || 0) * 0.5 +
      Math.min(30, freshCount * 6) +
      (explicit.length > 0 ? 20 : 0),
  );

  return {
    version: OPTIONS_SMART_MONEY_VERSION,
    classification,
    evidenceScore: Math.round(score),
    direction: aggregate.direction,
    pressureScore: aggregate.pressureScore,
    observationCount: freshCount,
    attributionEvidenceCount: explicit.length,
    dataQuality: aggregate.dataQuality,
    attribution: explicit,
    disclaimer: 'Options smart-money classification is evidence-gated. Flow size, premium, open interest, or directional pressure alone does not prove institutional or whale activity.',
  };
}
