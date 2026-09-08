/**
 * Live Radar evidence enrichment.
 *
 * Optional options-flow enrichment only. No provider is fetched here and no
 * missing flow is fabricated. C7/C8/C9/C10 scoring remains untouched.
 */

import { aggregateOptionsFlow } from './options-flow-aggregator.js';
import { classifyOptionsSmartMoney } from './options-smart-money.js';

export const LIVE_RADAR_EVIDENCE_VERSION = '1.0';

export function enrichLiveRadarEntry(entry = {}, options = {}) {
  const observations = Array.isArray(options.optionsFlowObservations)
    ? options.optionsFlowObservations
    : [];
  const attributionEvidence = Array.isArray(options.attributionEvidence)
    ? options.attributionEvidence
    : [];

  if (observations.length === 0) {
    return {
      ...entry,
      optionsFlow: null,
      optionsSmartMoney: {
        version: '1.0',
        classification: 'UNATTRIBUTED',
        evidenceScore: 0,
        direction: 'UNKNOWN',
        pressureScore: 0,
        observationCount: 0,
        attributionEvidenceCount: 0,
        quantitativeFlow: false,
        dataQuality: 'INSUFFICIENT_DATA',
        attribution: [],
        disclaimer: 'Options smart-money classification is evidence-gated. No options-flow observations were supplied.',
      },
    };
  }

  return {
    ...entry,
    optionsFlow: aggregateOptionsFlow(observations),
    optionsSmartMoney: classifyOptionsSmartMoney(observations, { attributionEvidence }),
  };
}
