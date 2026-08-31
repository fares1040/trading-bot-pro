import { NextResponse } from 'next/server';
import { buildAlertCenter, ALERT_TYPES, PRIORITY_ORDER, ALERT_STATUSES } from '@/lib/alert-center';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseFilters(searchParams) {
  const filters = {};
  
  const symbolsParam = searchParams.get('symbols');
  if (symbolsParam) {
    filters.symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
  }
  
  const severityParam = searchParams.get('severity');
  if (severityParam && PRIORITY_ORDER.includes(severityParam.toUpperCase())) {
    filters.severity = severityParam.toUpperCase();
  }
  
  const typeParam = searchParams.get('type');
  if (typeParam) {
    const types = typeParam.split(',').map(t => t.trim().toUpperCase()).filter(t => t);
    filters.type = types.length === 1 ? types[0] : types;
  }
  
  const statusParam = searchParams.get('status');
  if (statusParam && Object.values(ALERT_STATUSES).includes(statusParam.toUpperCase())) {
    filters.status = statusParam.toUpperCase();
  }
  
  const sourceParam = searchParams.get('source');
  if (sourceParam) {
    filters.source = sourceParam.trim();
  }
  
  return filters;
}

function parseSorting(searchParams) {
  const sortBy = searchParams.get('sortBy') || 'priority';
  const sortDir = searchParams.get('sortDir') || 'desc';
  return { sortBy, sortDir };
}

async function fetchIntelligenceData(origin) {
  const controllers = [
    { key: 'swingIntelligence', url: '/api/swing-intelligence' },
    { key: 'earlyExplosion', url: '/api/early-explosion' },
    { key: 'catalystIntelligence', url: '/api/catalyst-intelligence' },
    { key: 'optionsIntelligence', url: '/api/options-intelligence' },
    { key: 'institutionalRadar', url: '/api/institutional-intelligence' },
    { key: 'pennyIntelligence', url: '/api/penny-radar' },
    { key: 'opportunityRanking', url: '/api/opportunity-ranking' },
    { key: 'tradePlan', url: '/api/trade-plan' },
    { key: 'marketRegime', url: '/api/market-regime' },
  ];
  
  const results = {};
  
  await Promise.allSettled(
    controllers.map(async (ctrl) => {
      try {
        const response = await fetch(`${origin}${ctrl.url}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success) {
          results[ctrl.key] = json.data || json.opportunities || json.symbol || json;
        }
      } catch {
        // Silently fail - missing data will remain null
      }
    })
  );
  
  return results;
}

function aggregateInputsFromSources(sources) {
  const inputs = [];
  const symbols = new Set();
  
  function extractSymbols(data) {
    if (!data) return;
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item?.symbol) symbols.add(item.symbol);
      }
    } else if (typeof data === 'object') {
      if (data.symbol) symbols.add(data.symbol);
      if (data.symbols) {
        for (const s of data.symbols) if (s) symbols.add(s);
      }
    }
  }
  
  extractSymbols(sources.swingIntelligence);
  extractSymbols(sources.earlyExplosion);
  extractSymbols(sources.catalystIntelligence);
  extractSymbols(sources.opportunityRanking);
  extractSymbols(sources.tradePlan);
  extractSymbols(sources.pennyIntelligence);
  extractSymbols(sources.optionsIntelligence);
  extractSymbols(sources.institutionalRadar);
  
  const marketRegime = sources.marketRegime;
  if (marketRegime?.symbol) symbols.add(marketRegime.symbol);
  
  for (const symbol of symbols) {
    const symbolSources = {};
    
    const b4 = sources.swingIntelligence;
    if (b4) {
      if (Array.isArray(b4)) {
        const item = b4.find(i => i?.symbol === symbol);
        if (item) symbolSources.swingIntelligence = item;
      } else if (typeof b4 === 'object') {
        symbolSources.swingIntelligence = b4;
      }
    }
    
    const b5 = sources.earlyExplosion;
    if (b5) {
      if (Array.isArray(b5)) {
        const item = b5.find(i => i?.symbol === symbol);
        if (item) symbolSources.earlyExplosion = item;
      } else if (typeof b5 === 'object') {
        symbolSources.earlyExplosion = b5;
      }
    }
    
    const b6 = sources.catalystIntelligence;
    if (b6) {
      if (Array.isArray(b6)) {
        const item = b6.find(i => i?.symbol === symbol);
        if (item) symbolSources.catalystIntelligence = item;
      } else if (typeof b6 === 'object') {
        symbolSources.catalystIntelligence = b6;
      }
    }
    
    const b1 = sources.pennyIntelligence;
    if (b1) {
      if (Array.isArray(b1)) {
        const item = b1.find(i => i?.symbol === symbol);
        if (item) symbolSources.pennyIntelligence = item;
      } else if (typeof b1 === 'object') {
        symbolSources.pennyIntelligence = b1;
      }
    }
    
    const b2 = sources.optionsIntelligence;
    if (b2) {
      if (Array.isArray(b2)) {
        const item = b2.find(i => i?.symbol === symbol);
        if (item) symbolSources.optionsIntelligence = item;
      } else if (typeof b2 === 'object' && b2.symbol !== symbol) {
        // Options data might be consolidated
      }
    }
    
    const b3 = sources.institutionalRadar;
    if (b3) {
      if (Array.isArray(b3)) {
        const item = b3.find(i => i?.symbol === symbol);
        if (item) symbolSources.institutionalRadar = item;
      } else if (typeof b3 === 'object') {
        symbolSources.institutionalRadar = b3;
      }
    }
    
    const c7 = sources.opportunityRanking;
    if (c7) {
      if (Array.isArray(c7)) {
        const item = c7.find(i => i?.symbol === symbol);
        if (item) {
          symbolSources.opportunityRanking = item;
        }
      } else if (c7.symbol === symbol) {
        symbolSources.opportunityRanking = c7;
      }
    }
    
    const c8 = sources.tradePlan;
    if (c8) {
      if (Array.isArray(c8)) {
        const item = c8.find(i => i?.symbol === symbol);
        if (item) {
          symbolSources.tradePlan = item;
        }
      } else if (c8.symbol === symbol) {
        symbolSources.tradePlan = c8;
      }
    }
    
    const hasAnySource = Object.keys(symbolSources).length > 0;
    if (hasAnySource) {
      inputs.push({
        symbol,
        sources: symbolSources,
      });
    }
  }
  
  return inputs;
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  const filters = parseFilters(searchParams);
  const sorting = parseSorting(searchParams);
  const limit = parseInt(searchParams.get('limit') || '100', 10) || 100;
  
  try {
    const origin = url.origin;
    const sources = await fetchIntelligenceData(origin);
    const inputs = aggregateInputsFromSources(sources);
    
    const result = buildAlertCenter({
      inputs,
      limit,
      filters,
      sortBy: sorting.sortBy,
      sortDir: sorting.sortDir,
    });
    
    const response = {
      success: true,
      timestamp: result.timestamp,
      count: result.count,
      alerts: result.alerts,
      top: result.top,
      summary: result.summary,
      filters: {
        symbols: filters.symbols || null,
        severity: filters.severity || null,
        type: filters.type || null,
        status: filters.status || null,
        sort: `${sorting.sortBy}:${sorting.sortDir}`,
        limit,
      },
      dataAvailability: result.dataAvailability,
      qualityBreakdown: result.qualityBreakdown,
      limitations: result.limitations,
      disclaimer: result.disclaimer,
      errors: [],
    };
    
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to build alert center',
      timestamp: new Date().toISOString(),
      alerts: [],
      count: 0,
      disclaimer: 'An error occurred while aggregating alerts.',
    }, { status: 500 });
  }
}

export { ALERT_TYPES, PRIORITY_ORDER, ALERT_STATUSES };