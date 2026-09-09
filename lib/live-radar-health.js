/** Live Radar health contract: freshness, source availability and degradation state. */

export const LIVE_RADAR_HEALTH_VERSION = '1.0';

export function buildLiveRadarHealth(entries = []) {
  const rows = Array.isArray(entries) ? entries.filter(Boolean) : [];
  const fresh = rows.filter((x) => x?.freshness?.status === 'FRESH' && x?.freshness?.isFresh === true).length;
  const stale = rows.filter((x) => x?.freshness?.status === 'STALE' || x?.freshness?.isFresh === false).length;
  const errors = rows.filter((x) => x?.status === 'ERROR' || x?.error).length;
  const total = rows.length;
  const state = total === 0 ? 'NO_DATA' : errors > 0 && fresh === 0 ? 'DEGRADED' : stale > 0 && fresh === 0 ? 'STALE' : 'HEALTHY';
  return {
    version: LIVE_RADAR_HEALTH_VERSION,
    state,
    total,
    fresh,
    stale,
    errors,
    freshRatio: total ? Math.round((fresh / total) * 100) / 100 : 0,
    disclaimer: 'Health reflects supplied observations only; healthy status does not guarantee exchange-level real-time data.',
  };
}
