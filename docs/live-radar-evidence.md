# Live Radar Evidence Contract

## Purpose

The Live Radar may display optional options-flow and smart-money evidence without changing C7/C8/C9/C10 scoring.

## Rules

- Options flow is provider-derived observation data only.
- Missing options observations remain `null` / `INSUFFICIENT_DATA`.
- Quantitative flow must be fresh before it can support `POSSIBLE` smart-money classification.
- `CONFIRMED` requires explicit provider attribution evidence plus fresh directional observations.
- Price, volume, premium, open interest, contracts, or directional imbalance alone never proves institutional, smart-money, or whale activity.
- No provider or paid market-data service is added by this layer.

## Integration

`lib/live-radar-evidence.js` is intentionally an enrichment boundary. A future provider adapter can supply normalized observations without changing the radar detector or core Hunter scoring engines.
