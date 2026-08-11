# Trading Bot Pro — V4

- توحيد الحسابات الفنية في `lib/market-engine.js`.
- إزالة `yahoo-finance2` من مسار market-data.
- إزالة fallback والأرقام الثابتة من Stocks/Analytics.
- توحيد Yahoo Finance chart data كمصدر فني.
- توحيد Technical Score بين Stocks / Analyze / Swing.
- Backtest فعلي على بيانات Yahoo التاريخية المتاحة للمسار.
- Analytics V4 ديناميكية بالكامل.
- Options / Dark Pool / Institutional Flow لا تظهر كبيانات حقيقية ما لم يتوفر مزود فعلي.


## V4.1 — HUNTER Intelligence Upgrade

- Added `lib/hunter-intelligence.js` for market-regime context, conviction overlay, and capital-defense calculations.
- Added `/api/hunter` as a decision-support aggregation layer over the existing `/api/stocks` and `/api/indices` data.
- Added `/api/health` for safe operational/configuration visibility without exposing secrets.
- Added Hunter Intelligence tab to Analytics.
- Added production-safe Paper Trading Desk using real market prices and local simulated execution only.
- Added Capital Defense Engine for position sizing and risk/reward planning.
- Removed simulated whale/block-trade generation from `LiveOrderFlow`; it now shows a clearly labeled technical-volume proxy.
- Upgraded general AI chat so it can answer non-symbol educational questions when `GEMINI_API_KEY` is configured.
- Upgraded the journal UI to use the existing Supabase contract when available and local fallback when it is not.
- Existing technical scoring, filters, Yahoo behavior, and Phase 2.3 provider logic remain unchanged.
- No options, dark-pool, or institutional-flow data is fabricated.


## V5 — Production Pipeline Integration

- Added Production Validation phase with `/api/health` and `/api/production`.
- Added HIC Candidate Gate to Hunter Intelligence.
- Preserved bounded market-data concurrency and provider fallback policy.
- Added explicit Institutional Intelligence provider status without fabricated data.
- Added Hunter Score above the existing technical layer.
- Preserved Alerts pipeline and dedupe behavior.
- Added Free / Premium / Admin feature-gating metadata and `/api/access`.
- Added production roadmap and validation script.
- No secret values are bundled.
