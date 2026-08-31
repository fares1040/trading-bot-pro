/**
 * Gamma / GEX Context Layer
 *
 * Optional options-context layer that exposes Gamma/GEX/dealer positioning
 * evidence when actual Gamma/OI/strike data exists.
 *
 * CRITICAL: Do NOT calculate GEX from guessed or unavailable inputs.
 * If gamma data is unavailable, preserve:
 *   gamma = null
 *   gammaAvailability = 'UNAVAILABLE'
 *
 * Current Yahoo Finance provider does NOT expose gamma/GEX data.
 * This module exists as a structured integration point for when a provider
 * that supplies gamma data is connected.
 *
 * Pure function — no network calls, no fabrication, no look-ahead.
 * Missing data remains null.
 */

function n(value) {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

function clamp(value, min = 0, max = 100) {
  const v = Number(value);
  if (v === Infinity) return max;
  if (v === -Infinity) return min;
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function round(value, decimals = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;
}

function nowISO() {
  return new Date().toISOString();
}

function defaultGammaContext(symbol) {
  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    gammaAvailability: 'UNAVAILABLE',
    gamma: null,
    gex: null,
    gammaConcentration: null,
    openInterestConcentration: null,
    strikeDistribution: [],
    keyGammaLevels: [],
    expiryContext: null,
    dealerPositioning: null,
    gammaSqueezeContext: null,
    profile: null,
    directionalTargeting: null,
    confidence: 0,
    reasons: ['Gamma data unavailable from current provider (Yahoo Finance public options chain)'],
    warnings: ['GAMMA_DATA_UNAVAILABLE'],
    flags: [],
    provenance: {
      intelligence: 'GAMMA',
      engine: 'Gamma / GEX Context',
    },
    disclaimer:
      'Gamma/GEX context requires a data provider that exposes gamma and open interest by strike. ' +
      'Current Yahoo Finance provider does not supply this data. ' +
      'No gamma values are fabricated or estimated. ' +
      'This layer is analytical only — not a buy/sell signal.',
  };
}

function buildGammaContext(inputs = {}) {
  const { symbol = null, gammaData = null, optionsContracts = [] } = inputs;

  // If gammaData is explicitly provided, use it.
  // Otherwise, if optionsContracts contain gamma fields, derive context.
  // Otherwise, return unavailable.

  if (!gammaData && (!Array.isArray(optionsContracts) || optionsContracts.length === 0)) {
    return defaultGammaContext(symbol);
  }

  // Check if any contract actually has gamma data
  const hasGammaData = gammaData != null ||
    optionsContracts.some((c) => c.gamma != null || c.gex != null);

  if (!hasGammaData) {
    return defaultGammaContext(symbol);
  }

  // If gammaData is provided directly
  if (gammaData && typeof gammaData === 'object') {
    return {
      symbol: symbol || null,
      timestamp: nowISO(),
      gammaAvailability: gammaData.availability || 'AVAILABLE',
      gamma: n(gammaData.gamma),
      gex: n(gammaData.gex),
      gammaConcentration: gammaData.gammaConcentration || null,
      openInterestConcentration: gammaData.openInterestConcentration || null,
      strikeDistribution: Array.isArray(gammaData.strikeDistribution) ? gammaData.strikeDistribution : [],
      keyGammaLevels: Array.isArray(gammaData.keyGammaLevels) ? gammaData.keyGammaLevels : [],
      expiryContext: gammaData.expiryContext || null,
      dealerPositioning: gammaData.dealerPositioning || null,
      gammaSqueezeContext: gammaData.gammaSqueezeContext || null,
      profile: gammaData.profile || null,
      directionalTargeting: gammaData.directionalTargeting || null,
      confidence: gammaData.confidence != null ? clamp(gammaData.confidence) : 50,
      reasons: gammaData.reasons || ['Gamma data available from provider'],
      warnings: gammaData.warnings || [],
      flags: gammaData.flags || [],
      provenance: {
        intelligence: 'GAMMA',
        engine: 'Gamma / GEX Context',
        provider: gammaData.provider || null,
      },
      disclaimer:
        'Gamma/GEX context is derived from actual provider data — never estimated. ' +
        'This layer is analytical only — not a buy/sell signal.',
    };
  }

  // Derive minimal gamma context from optionsContracts if gamma fields exist
  const contractsWithGamma = optionsContracts.filter((c) => c.gamma != null);
  if (contractsWithGamma.length === 0) {
    return defaultGammaContext(symbol);
  }

  const avgGamma = contractsWithGamma.reduce((s, c) => s + Math.abs(n(c.gamma) || 0), 0) / contractsWithGamma.length;
  const concentrated = contractsWithGamma.length > 0 && contractsWithGamma.length < 5;

  const reasons = [];
  if (avgGamma > 0) reasons.push(`Average gamma exposure ${round(avgGamma)} across ${contractsWithGamma.length} contracts`);
  if (concentrated) reasons.push('Gamma appears concentrated across limited strikes');

  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    gammaAvailability: 'AVAILABLE',
    gamma: round(avgGamma),
    gex: null,
    gammaConcentration: concentrated ? 'CONCENTRATED' : 'DISPERSED',
    openInterestConcentration: null,
    strikeDistribution: [],
    keyGammaLevels: [],
    expiryContext: null,
    dealerPositioning: null,
    gammaSqueezeContext: null,
    profile: concentrated ? 'CONCENTRATED' : 'DISPERSED',
    directionalTargeting: null,
    confidence: 40,
    reasons,
    warnings: ['GAMMA_CONTEXT_LIMITED — derived from contract-level gamma only'],
    flags: concentrated ? ['GAMMA_CONCENTRATED'] : [],
    provenance: {
      intelligence: 'GAMMA',
      engine: 'Gamma / GEX Context',
      derivedFrom: 'optionsContracts',
    },
    disclaimer:
      'Gamma context derived from available contract-level gamma data. ' +
      'Full GEX/strike distribution requires a specialized provider. ' +
      'This layer is analytical only — not a buy/sell signal.',
  };
}

export function getGammaAvailability(optionsContracts = []) {
  if (!Array.isArray(optionsContracts) || optionsContracts.length === 0) return 'UNAVAILABLE';
  return optionsContracts.some((c) => c.gamma != null || c.gex != null) ? 'AVAILABLE' : 'UNAVAILABLE';
}

export {
  buildGammaContext,
  defaultGammaContext,
};
