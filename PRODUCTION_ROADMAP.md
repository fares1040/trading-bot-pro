# HUNTER AI — Production Roadmap V1

## PHASE 1 — Production Validation
- `/api/health` configuration and policy visibility.
- `/api/production` lightweight live probes for health, indices and a single stock.
- `npm run validate` for repository-level validation.

## PHASE 2 — HIC Candidate Gate
- Added Hunter Intelligence Candidate Gate.
- Checks technical readiness, liquidity, RVOL, Setup Score and available Risk/Reward.
- Defensive market context requires a higher Setup Score.
- HIC does not rewrite Technical Score.

## PHASE 3 — Market Data Throughput
- Existing bounded concurrency retained.
- Finnhub primary with Yahoo fallback.
- Request timeouts retained.
- No fabricated values on provider failure.

## PHASE 4 — Discovery
- `HUNTER_UNIVERSE` remains the preferred universe.
- Yahoo Trending remains discovery fallback only.
- Price, volume and history gates remain explicit.

## PHASE 5 — Institutional Intelligence
- Provider-status layer is integrated.
- Institutional Flow / Dark Pool remain unscored until a real provider is connected.
- No fabricated institutional data.

## PHASE 6 — Hunter Score
- New Hunter Score layer: Setup 55% + Conviction 35% + Market Regime 10%.
- HIC eligibility is enforced before final Hunter ranking.
- Existing Technical Score remains available separately.

## PHASE 7 — Alerts
- Opportunities aggregation feeds alert thresholds.
- Supabase dedupe is used when configured.
- Telegram / Discord delivery remains environment-driven.

## PHASE 8 — UI / Premium / Admin
- Production phase status is visible in dashboard and analytics.
- Free / Premium / Admin feature matrix is available through `/api/access`.
- User-specific authentication remains dependent on Supabase Auth environment configuration.

## Vercel Production
- Existing Next.js/Vercel configuration retained.
- Environment variable template added.
- Final external deployment check must run against the Vercel URL.
