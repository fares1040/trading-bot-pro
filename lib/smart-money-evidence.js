/**
 * Smart Money Evidence classifier.
 *
 * Attribution is evidence-gated: price/volume pressure alone can never become
 * a smart-money or whale claim. A provider must explicitly supply attribution
 * evidence before CONFIRMED is possible.
 */

export const SMART_MONEY_EVIDENCE_VERSION = '1.0';

const clamp = (value) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

function hasFreshEvidence(item) {
  return item?.freshness?.status === 'FRESH' && item?.freshness?.isFresh === true;
}

export function classifySmartMoneyEvidence(input = {}) {
  const observations = Array.isArray(input.observations) ? input.observations.filter(Boolean) : [];
  const explicit = Array.isArray(input.attributionEvidence) ? input.attributionEvidence.filter(Boolean) : [];
  const freshObservations = observations.filter(hasFreshEvidence);
  const directional = freshObservations.filter((item) => item.direction === 'BUY' || item.direction === 'SELL');
  const notional = directional.reduce((sum, item) => {
    const value = Number(item.notional);
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);

  let classification = 'UNATTRIBUTED';
  if (explicit.length > 0 && freshObservations.length > 0) classification = 'CONFIRMED';
  else if (freshObservations.length >= 3 && notional > 0) classification = 'POSSIBLE';

  const evidenceScore = clamp(
    (freshObservations.length >= 3 ? 30 : freshObservations.length * 10) +
    (notional > 0 ? 20 : 0) +
    (explicit.length > 0 ? 50 : 0),
  );

  return {
    version: SMART_MONEY_EVIDENCE_VERSION,
    classification,
    evidenceScore,
    observationCount: freshObservations.length,
    attributionEvidenceCount: explicit.length,
    directionalObservationCount: directional.length,
    notionalObserved: notional,
    attribution: explicit.length > 0 ? explicit : [],
    dataQuality: freshObservations.length === 0 ? 'INSUFFICIENT_DATA' : 'OBSERVED',
    disclaimer: 'Possible/confirmed classification depends on supplied provider evidence; market movement, volume, or notional alone does not prove smart-money, institutional, or whale activity.',
  };
}
