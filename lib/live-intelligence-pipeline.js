import { buildLiveMarketPulse } from './live-market-pulse.js';
import { detectAcceleration } from './acceleration-radar.js';
import { detectLiveOpportunity } from './live-opportunity-stream.js';
import { aggregateLiveFlow } from './live-flow-aggregator.js';
import { classifySmartMoneyEvidence } from './smart-money-evidence.js';
import { analyzeOptionsFlow } from './options-flow-intelligence.js';

export const LIVE_INTELLIGENCE_VERSION = '1.0';

export function buildLiveIntelligence({ current, history = [], flow = [], optionsFlow = [], attributionEvidence = [] } = {}) {
  const pulse = buildLiveMarketPulse(current, history);
  const acceleration = detectAcceleration(pulse);
  const opportunity = detectLiveOpportunity(pulse);
  const flowPressure = aggregateLiveFlow(flow);
  const smartMoney = classifySmartMoneyEvidence({ observations: flow, attributionEvidence });
  const options = analyzeOptionsFlow(optionsFlow);
  return {
    version: LIVE_INTELLIGENCE_VERSION,
    symbol: current?.symbol ?? null,
    freshness: current?.freshness ?? null,
    pulse,
    acceleration,
    opportunity,
    flowPressure,
    smartMoney,
    options,
    disclaimer: 'Live Intelligence combines provider observations and derived evidence. Missing, stale, delayed, or unattributed data is not converted into certainty.',
  };
}
