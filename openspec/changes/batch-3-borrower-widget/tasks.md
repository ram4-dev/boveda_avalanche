# Tasks: batch-3-borrower-widget

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,900–3,200 total including `package-lock.json`; each code PR should target ≤700 non-lockfile lines |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 tooling/API client/wallet → PR 2 offer/request UI → PR 3 loan activity/lifecycle UI → PR 4 accessibility/polish/final verification |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Configured 700-line review budget: High risk / likely exceeded by total Batch 3 scope. Chained strategy is required before apply unless the reviewer explicitly accepts a size exception. `package-lock.json` may exceed budget by itself and should be reviewed as dependency-only noise in PR 1.

## Strict TDD Evidence Contract

For every implementation work unit below, record evidence in `openspec/changes/batch-3-borrower-widget/apply-progress.md`:

- **RED:** failing test name, command, and failure reason before production implementation.
- **GREEN:** minimal implementation, command, and passing result.
- **TRIANGULATE:** at least one additional behavior/error/edge test proving the implementation is not hardcoded.
- **REFACTOR:** cleanup performed plus full relevant command results.

Baseline commands for final verification:

```text
npm test -- --run
npm run typecheck
npm run build
npm run lint
```

Targeted commands may use file paths, for example:

```text
npm test -- --run web/src/api/client.test.ts
npm test -- --run web/src/wallet/injectedWallet.test.ts
npm test -- --run web/src/state/borrowerJourney.test.ts
npm test -- --run web/src/screens/OfferRequestScreen.test.tsx
npm test -- --run web/src/screens/LoanActivityScreen.test.tsx
```

## Dependency Order And Work Units

### 0. Baseline and implementation guardrails

- **Paths:** `package.json`, `vitest.config.ts`, `tsconfig.json`, `docs/demo/openapi.yaml`, `openspec/changes/batch-3-borrower-widget/apply-progress.md`.
- **Tasks:**
  - Run and record current baseline: `npm test -- --run`, `npm run typecheck`, `npm run build`, `npm run lint`.
  - Confirm canonical API paths from `docs/demo/openapi.yaml` before writing endpoint tests.
  - Confirm no `.env`, private keys, seed phrases, credentials, or secret files are read or required.
- **Finish:** Baseline evidence exists; no production code changes yet.
- **Rollback:** None.

### 1. PR 1 — Frontend tooling, isolated test setup, API client, wallet boundary

- **Goal:** Add the minimal Vite/React/Vitest-jsdom foundation without breaking existing backend tests.
- **Paths:**
  - `package.json`, `package-lock.json`, `vite.config.ts`, `vitest.config.ts`, `web/index.html`, `web/tsconfig.json`.
  - `web/src/test/setup.ts`.
  - `web/src/api/client.test.ts`, `web/src/api/client.ts`, `web/src/api/errors.ts`, `web/src/api/types.ts`.
  - `web/src/wallet/injectedWallet.test.ts`, `web/src/wallet/injectedWallet.ts`, `web/src/wallet/useInjectedWallet.ts`.
- **RED:**
  - Add failing tests for canonical endpoint methods/paths, `GET /events?loanId=...`, canonical `{ error: { code, message } }` parsing, provider absence, successful `eth_requestAccounts`, rejection, and empty/malformed accounts.
  - Run targeted tests and record failures before implementation.
- **GREEN:**
  - Add React/Vite/jsdom/testing-library dependencies and scripts: `dev:web`, `typecheck:web`, `build:web`; preserve `npm test -- --run`.
  - Configure separate Vitest projects/environments: backend `tests/**/*.test.ts` in `node`; web `web/src/**/*.test.{ts,tsx}` in `jsdom` with `web/src/test/setup.ts`.
  - Implement framework-free `createBovedaApiClient` using only canonical paths: `GET /loans`, `GET /loans/{loanId}`, `POST /quotes`, `POST /risk/wallet`, `POST /loans/{loanId}/collateral/deposit`, `POST /loans/{loanId}/activate`, `POST /loans/{loanId}/payments/attest`, `POST /loans/{loanId}/margin-call`, `POST /loans/{loanId}/liquidate`, `GET /events?loanId=...`.
  - Implement injected wallet boundary with no private-key/secret handling.
- **TRIANGULATE:**
  - Add tests for URL encoding of loan IDs/query params, optional `VITE_BOVEDA_API_BASE_URL`, non-JSON HTTP errors, and provider request failures preserving safe error messages.
- **REFACTOR:**
  - Ensure endpoint strings are centralized in `web/src/api/client.ts`; no React component imports backend `src/` code.
  - Ensure Vite build output cannot wipe backend `dist` (`emptyOutDir: false` or safe equivalent).
- **Verification:** `npm test -- --run`, `npm run typecheck`, `npm run build`, `npm run lint`.
- **Rollback:** Revert listed tooling/client/wallet files and restore `package.json`, `package-lock.json`, `vitest.config.ts`.

### 2. PR 2 — Borrower journey state and offer/request screen

- **Goal:** Render the useful first screen from API-backed state, quote/risk actions, wallet UI, and project visual tokens.
- **Depends on:** Work unit 1.
- **Paths:**
  - `web/src/main.tsx`, `web/src/App.tsx`, `web/src/state/borrowerJourney.test.ts`, `web/src/state/borrowerJourney.ts`, `web/src/state/demoPayloads.ts`.
  - `web/src/screens/OfferRequestScreen.test.tsx`, `web/src/screens/OfferRequestScreen.tsx`.
  - `web/src/components/ActionButton.tsx`, `Alert.tsx`, `KeyValueList.tsx`, `MetricTile.tsx`, `StatusPill.tsx`.
  - `web/src/styles/tokens.css`, `web/src/styles/app.css`.
- **RED:**
  - Add tests that initial load prefers `WEB3_BRIDGE` / `loan-web3-001`, falls back safely, fetches events after selecting a loan, and preserves last confirmed state on load/quote/risk errors.
  - Add component tests for principal/collateral/LTV/APR/tenor/thresholds/originator/funding partner, `USDC` liquidation currency, status-next-action copy, wallet unavailable/connected/rejected states, quote result fields, risk `REVIEW`/`BLOCK` copy, and no raw JSON dumps.
- **GREEN:**
  - Implement reducer/hook with `loadStatus`, selected loan, events, quote, risk, action, and scoped errors.
  - Implement app shell and offer/request screen using API client methods rather than direct fetch in components.
  - Implement CSS tokens exactly from the project UI standard: `#f6f8fb`, `#ffffff`, `#172033`, `#647084`, `#d9e1ec`, `#0f766e`, `#2563eb`, `#dc2626`, `#16a34a`, 8px cards, 6px controls, 12/16/24/32 spacing.
- **TRIANGULATE:**
  - Add tests for empty loan list, retry, loading stability, `Approved` deposit guidance, and disabled guidance for non-eligible statuses.
- **REFACTOR:**
  - Extract only genuinely shared display primitives; avoid UI libraries, decorative gradients/blobs, oversized empty cards, and hover-only actions.
- **Verification:** targeted state/screen tests, then `npm test -- --run`, `npm run typecheck`, `npm run build`, `npm run lint`.
- **Rollback:** Remove offer/state/style files and restore `App.tsx` to the PR 1 shell.

### 3. PR 3 — Loan activity, lifecycle mutations, events, payment, margin call, liquidation

- **Goal:** Complete the borrower journey after offer: collateral deposit/activation, active loan/receipt, payment attestation, margin-call/liquidation, and event evidence.
- **Depends on:** Work unit 2.
- **Paths:**
  - `web/src/screens/LoanActivityScreen.test.tsx`, `web/src/screens/LoanActivityScreen.tsx`.
  - `web/src/components/EventTimeline.tsx` plus any small cards kept in `LoanActivityScreen.tsx` or focused component files.
  - `web/src/state/borrowerJourney.ts`, `web/src/state/demoPayloads.ts`.
- **RED:**
  - Add tests for eligible `Approved` deposit calling `POST /loans/{loanId}/collateral/deposit`, activation calling `POST /loans/{loanId}/activate`, and ineligible statuses not calling deposit.
  - Add tests for active status details, receipt token/owner/soulbound copy, payment request to `POST /loans/{loanId}/payments/attest`, attestation hash/remaining principal/status display, and `InstallmentPaid` event feedback.
  - Add tests for margin-call alert, `POST /loans/{loanId}/margin-call`, liquidation eligibility, `POST /loans/{loanId}/liquidate`, USDC proceeds, and funding partner/originator/borrower distribution rows.
- **GREEN:**
  - Implement mutation handlers through the state boundary: validate eligibility, call canonical client method, keep last confirmed state during loading, refresh `GET /loans/{loanId}` and `GET /events?loanId=...` after success.
  - Implement `LoanActivityScreen` sections: active loan summary, receipt, payment attestation, risk/liquidation, event timeline.
  - Implement transparent demo payload helpers for deposit tx hash/vault, activation receipt input, payment defaults, margin-call reason, and liquidation preview; do not imply production custody/execution.
- **TRIANGULATE:**
  - Add error tests proving mutation failures show borrower-readable API errors near affected controls and do not show unconfirmed attestation/liquidation completion.
  - Add terminal status tests for `Repaid`, `Liquidated`, `Cancelled`, and `Defaulted` guidance.
- **REFACTOR:**
  - Keep lifecycle business rules limited to API eligibility/display guidance; do not duplicate backend state-machine logic beyond status-derived button availability.
- **Verification:** targeted loan activity tests, then `npm test -- --run`, `npm run typecheck`, `npm run build`, `npm run lint`.
- **Rollback:** Remove `LoanActivityScreen`/event UI and revert added mutation handling to the PR 2 state boundary.

### 4. PR 4 — Accessibility, responsive polish, regression, and final evidence

- **Goal:** Make the completed widget reviewer-ready and demo-safe under the configured commands.
- **Depends on:** Work unit 3.
- **Paths:**
  - `web/src/**/*.test.{ts,tsx}`, `web/src/**/*.tsx`, `web/src/styles/*.css`.
  - `openspec/changes/batch-3-borrower-widget/apply-progress.md`.
  - Optional small docs update only if needed: `docs/demo/backend-runbook.md` or `docs/demo/demo-flow.md`.
- **RED:**
  - Add regression tests for accessible names, disabled/loading states, `role="alert"` or associated error messages, `aria-live` success/refresh feedback, keyboard-reachable controls, and responsive/no-horizontal-scroll assumptions where practical in jsdom.
- **GREEN:**
  - Add missing accessibility attributes, focus styles, stable loading/empty/error regions, retry paths, and responsive CSS.
  - Ensure UI copy is honest about API-simulated collateral/liquidation and non-blocking wallet absence.
- **TRIANGULATE:**
  - Add tests preventing raw JSON dumps and generic all-green risk treatment; verify `USDC` is used for liquidation proceeds.
- **REFACTOR:**
  - Remove dead code, collapse oversized components only where it improves reviewability, and ensure all formatting helpers are presentation-only.
- **Verification:**
  - Run and record: `npm test -- --run`, `npm run typecheck`, `npm run build`, `npm run lint`.
  - Manually smoke the local demo with backend and web dev servers: `npm run dev` and `npm run dev:web`; verify offer → wallet unavailable/connected → active receipt/payment → margin/liquidation views against the Batch 2 API.
- **Rollback:** Revert polish-only changes; if docs were updated incorrectly, restore prior docs.

## Apply Gate

Before `sdd-apply`, pause for the delivery decision because the forecast exceeds both the 400-line guard and the configured 700-line review budget. Recommended decision: proceed with a feature-branch chain using the four work units above, with PR 1 allowed to contain dependency/lockfile churn and later PRs kept below the 700-line code-review target.

**Resolved for apply:** single-pr `size:exception` approved by the user. Work units 1-4 were implemented in `feature/batch-3-borrower-widget`; review size risk remains High and is recorded in `apply-progress.md`.
