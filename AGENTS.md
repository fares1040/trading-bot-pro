# TRADING BOT PRO — AGENT RULES V1

## 1. Project Identity

Project: Trading Bot Pro

Repository: trading-bot-pro

This repository is independent from all other projects. Do not mix its files, architecture, instructions, roadmap, credentials, or assumptions with any other project.

Primary principle:

> Understand first → Audit → Report → Propose → Get approval → Modify → Test → Commit.

---

## 2. Golden Rules

1. NEVER modify, delete, rename, or create project files unless the task explicitly requires it.
2. Before making a significant change, inspect the relevant architecture and data flow.
3. Do not perform a broad "fix everything" operation.
4. Preserve existing working functionality unless the requested task specifically changes it.
5. Do not introduce duplicate components, duplicate APIs, or parallel implementations without a documented reason.
6. Do not change framework, build system, deployment configuration, or major dependencies without approval.
7. Do not expose, print, commit, or hard-code secrets, API keys, tokens, passwords, or private credentials.
8. Do not change production behavior merely to make a test pass.
9. Prefer small, reversible changes.
10. If the requested change conflicts with existing architecture, stop and explain the conflict before implementing it.

---

## 3. First-Run / Audit Mode

When entering a new session or when the user asks for an audit:

DO NOT MODIFY FILES.

First inspect:

- package.json
- app/
- components/
- public/
- configuration files
- API/data-fetching code
- environment variable usage
- deployment configuration
- authentication/database integrations if present
- filtering/scoring logic
- error handling
- loading states
- notification logic

Then report:

### A. Architecture
What exists and how the major parts connect.

### B. Data Flow
Trace:

Data Source
→ Market Data
→ Normalization
→ Filters
→ Scoring/Signals
→ UI
→ Alerts/Actions

### C. Problems
Separate findings into:

- CRITICAL
- HIGH
- MEDIUM
- LOW
- IMPROVEMENT

### D. Risk
Identify anything that could:

- break production
- return incorrect market data
- expose credentials
- create stale data
- cause duplicate requests
- create race conditions
- cause UI/runtime failures
- increase API usage unexpectedly

### E. Recommendation
For every proposed fix provide:

- Problem
- Root cause
- Proposed solution
- Files affected
- Risk
- Test plan

Do not implement until approved when the task is an audit.

---

## 4. Development Workflow

For every approved task:

1. Restate the exact objective internally.
2. Inspect the smallest relevant set of files.
3. Identify dependencies and side effects.
4. Make the smallest safe change.
5. Re-check related files.
6. Run the appropriate validation/build/lint/test commands when available.
7. Report exactly what changed.
8. Report any remaining warnings/errors.
9. Never claim a test passed unless it was actually run.

---

## 5. Code Modification Rules

### Preserve behavior

Do not rewrite working code merely for style.

### Prefer existing patterns

If the repository already has a component, utility, hook, API pattern, or data structure that solves the problem, reuse it.

### Avoid unnecessary dependencies

Do not add a package when the current stack can solve the problem safely.

### Type/data safety

Validate external API data before using it in UI or calculations.

### Error handling

Every external request should have an understandable failure path.

### Loading states

Do not leave the UI appearing frozen while an asynchronous operation is running.

### Empty states

If a filter returns no candidates, show a clear empty state rather than throwing an error.

---

## 6. Market / Trading Data Safety

Trading Bot Pro is a decision-support application.

The agent must NOT:

- invent market data
- fabricate prices, volume, RSI, signals, or technical values
- silently substitute one data provider for another
- hide failed API responses
- treat missing data as zero
- label estimated/stale data as real-time data

If market data is unavailable, stale, delayed, incomplete, or uncertain:

1. identify it clearly;
2. preserve the failure state;
3. do not fabricate a value;
4. report the affected feature.

Any change to market-data providers or the data pipeline requires explicit approval.

---

## 7. Filters and Signal Logic

Before changing any trading filter or scoring rule:

1. Find the current implementation.
2. Document the current behavior.
3. Identify inputs and outputs.
4. Check edge cases.
5. Explain how the change affects existing signals.
6. Get approval before changing strategy logic.

Never silently change signal thresholds.

---

## 8. API Rules

For every API integration:

- keep credentials in environment variables;
- never hard-code secrets;
- validate responses;
- handle rate limits;
- handle timeouts;
- handle empty responses;
- avoid unnecessary duplicate requests;
- document provider assumptions;
- do not change providers without approval.

---

## 9. Frontend Rules

The UI should remain:

- responsive
- fast
- readable
- consistent with the existing design system
- usable on mobile and desktop

Do not redesign the entire interface for a small feature request.

For UI changes, preserve existing navigation and important user workflows.

---

## 10. Git Rules

Before risky changes:

- verify the current branch;
- keep changes focused;
- avoid unrelated file changes.

Never rewrite Git history or force-push unless explicitly authorized.

Use descriptive commit messages.

Prefer one logical change per commit.

---

## 11. Deployment Rules

Deployment configuration is production-sensitive.

Do not change:

- Vercel configuration
- environment variables
- build commands
- framework configuration
- routing configuration

unless the task requires it and the impact is explained first.

After a deployment-related change, verify:

1. build;
2. runtime;
3. affected route/page;
4. relevant API behavior.

---

## 12. Security Rules

Never expose:

- API keys
- access tokens
- Supabase secrets
- private credentials
- authentication secrets

If a secret appears in source code or logs:

1. stop;
2. report it;
3. recommend rotation;
4. do not copy it into another file.

---

## 13. Mobile-First Working Rule

The user may operate the project from a phone.

Therefore:

- keep instructions concise and actionable;
- avoid requiring unnecessary local setup;
- prefer browser-accessible workflows where practical;
- never assume the user can inspect a large number of files manually;
- provide exact file paths and exact actions.

---

## 14. Approval Gate

The following changes ALWAYS require explicit user approval before implementation:

- changing trading strategy
- changing scoring logic
- changing market-data providers
- adding paid services
- changing authentication
- changing database schema
- changing deployment architecture
- deleting major functionality
- large refactors
- adding recurring background jobs
- changing production environment variables

---

## 15. Completion Report

After every completed task, report:

### Changed
- files changed
- what changed

### Verified
- tests/build/lint actually run
- result

### Not Changed
- important areas intentionally left untouched

### Risks
- remaining known risks

### Next
- one recommended next step

Keep the report concise.

---

## 16. Roadmap Discipline

Follow the project's approved development roadmap in order.

Do not skip ahead because a later feature appears attractive.

Do not reopen completed repair/audit work unless a new, reproducible issue is discovered.

When a task belongs to a later phase, identify that fact before implementing it.

---

## 17. Agent Behavior

The agent is an engineering assistant, not an autonomous decision maker.

When uncertain:

- do not guess;
- inspect;
- explain the uncertainty;
- ask for approval when the decision affects architecture or trading behavior.

The highest priority is:

1. Protect the project.
2. Preserve correct existing behavior.
3. Protect secrets and production configuration.
4. Make evidence-based changes.
5. Keep changes small and reversible.
6. Follow the user's approved roadmap.

END OF TRADING BOT PRO — AGENT RULES V1
