# Verify Report: batch-3-borrower-widget

## Status

**PASS — final re-verification complete.**

No blocking issues remain after the quote response contract fix. The implementation is uncommitted on branch `feature/batch-3-borrower-widget`; the user-approved single-PR `size:exception` is recorded in `apply-progress.md`.

## Executive Summary

- ✅ Prior blocker resolved: `EventTimeline` guards non-USDC `Liquidated` proceeds and keeps valid USDC proceeds visible.
- ✅ Prior blocker resolved: quote requests use canonical `requestedPrincipal: { amount, currency }`; non-canonical `requestedAmount` / `requestedCurrency` remain only in absence assertions.
- ✅ Prior blocker resolved: quote responses consume canonical nested `terms` fields from `QuoteResponse`.
- ✅ Required commands pass: `npm test -- --run`, `npm run typecheck`, `npm run build`, `npm run lint`.
- ✅ Existing Batch 2 backend tests remain green: `npm test -- --run tests`.
- ✅ Vite React TypeScript frontend builds successfully through `npm run build` / `vite build --config vite.config.ts`.
- ✅ Wallet boundary uses injected provider only; no private keys, seed phrases, credentials, or `.env` secrets are required.
- ✅ Frontend uses canonical Batch 2 API paths and React components do not directly import backend `src` modules.
- ✅ Liquidation proceeds display remains USDC-focused and guarded in result, preview, and event timeline surfaces.
- ✅ UI broadly follows the project data-product standards and avoids raw JSON dumps.

## Spec Coverage

| Requirement | Coverage | Notes |
|---|---:|---|
| Canonical API Contract Consumption | ✅ Covered | API client centralizes canonical paths. `loadBorrowerContext` uses `GET /loans?scenario=WEB3_BRIDGE` with unfiltered fallback and `GET /events?loanId=...`. Quote request and nested quote response terms match OpenAPI. |
| Borrower Offer And Request Terms | ✅ Covered | Offer screen renders principal, collateral, initial/current LTV, APR, tenor, repayment frequency, thresholds, liquidation currency, originator, funding partner, API status, and next-action guidance. |
| Injected Wallet Connection | ✅ Covered | `web/src/wallet/injectedWallet.ts` accesses only injected `ethereum` provider, requests `eth_requestAccounts`, displays shortened address, and handles unavailable/rejected states safely. |
| Quote And Risk Integration | ✅ Covered | `POST /quotes` uses `requestedPrincipal`; UI renders `quote.terms.*`. Risk assessment displays risk score, AML status, max LTV, hash, and REVIEW/BLOCK copy. |
| Collateral Deposit And Activation Flow | ✅ Covered | Loan activity exposes deposit/activation for `Approved` loans and disables deposit for ineligible statuses. Payload helpers use API-simulated token/amount/tx/vault data. |
| Active Loan State And Receipt Display | ✅ Covered | Active view renders status, outstanding principal/currency, current LTV, due date, collateral, vault/deposit tx, receipt owner/token/soulbound copy, and events. |
| Payment Simulation And Attestation Feedback | ✅ Covered | Payment action calls canonical state/client boundary and displays attestation hash, remaining principal, resulting status, and error preservation. |
| Margin Call And Liquidation View | ✅ Covered | Margin-call alert, top-up fields, liquidation eligibility, USDC proceeds, and distribution rows are covered. Non-USDC payloads are guarded. |
| Loading, Empty, Refresh, And API Error States | ✅ Covered | Loading, empty, retry/error, and action-specific API errors render borrower-readable messages without raw JSON dumps. |
| Accessible And Responsive Data-Product UI | ✅ Covered | Regression tests cover accessible named controls/status region and no raw JSON dumps. CSS uses required palette/radius/spacing and no gradients/blobs. |

## Task Completion Status

| Work Unit / Correction | Status | Notes |
|---|---:|---|
| WU0 baseline/guardrails | ✅ Complete | Baseline evidence recorded in `apply-progress.md`. |
| WU1 tooling/API client/wallet | ✅ Complete | Vite, Vitest projects, API client, and wallet boundary implemented. |
| WU2 borrower state + offer screen | ✅ Complete | Includes canonical quote request/response fixes. |
| WU3 loan activity/lifecycle UI | ✅ Complete | Deposit, activation, payment, margin-call, liquidation, and events implemented. |
| WU4 accessibility/polish/regression | ✅ Complete | Accessibility/status regressions and UI polish included. |
| Fallback from filtered to unfiltered loan load | ✅ Complete | Covered by `borrowerJourney.test.ts`. |
| USDC result/preview/EventTimeline hardening | ✅ Complete | Covered by `LoanActivityScreen.test.tsx` and `EventTimeline.test.tsx`. |
| Quote request payload fix | ✅ Complete | Covered by state/API tests and grep review. |
| Nested QuoteResponse terms fix | ✅ Complete | Covered by `OfferRequestScreen.test.tsx` OpenAPI-shaped fixture and type updates. |

## Test / Validation Commands

### Focused blocker regression

Command:

```text
npm test -- --run web/src/components/EventTimeline.test.tsx web/src/screens/LoanActivityScreen.test.tsx web/src/state/borrowerJourney.test.ts web/src/screens/OfferRequestScreen.test.tsx web/src/api/client.test.ts
```

Output:

```text
Test Files  5 passed (5)
Tests       22 passed (22)
```

### Full suite

Command:

```text
npm test -- --run
```

Output:

```text
Test Files  15 passed (15)
Tests       55 passed (55)
```

### Typecheck

Command:

```text
npm run typecheck
```

Output:

```text
> boveda-demo-api@0.1.0-batch0 typecheck
> npm run typecheck:api && npm run typecheck:web

> boveda-demo-api@0.1.0-batch0 typecheck:api
> tsc --noEmit --pretty false -p tsconfig.json

> boveda-demo-api@0.1.0-batch0 typecheck:web
> tsc --noEmit --pretty false -p web/tsconfig.json
```

### Build / Vite React TS frontend build

Command:

```text
npm run build
```

Output:

```text
> boveda-demo-api@0.1.0-batch0 build
> npm run build:api && npm run build:web

> boveda-demo-api@0.1.0-batch0 build:api
> tsc -p tsconfig.json

> boveda-demo-api@0.1.0-batch0 build:web
> vite build --config vite.config.ts

vite v7.3.3 building client environment for production...
✓ 44 modules transformed.
../dist/web/index.html                   0.41 kB │ gzip:  0.28 kB
../dist/web/assets/index-CQnbJIgr.css    3.65 kB │ gzip:  1.23 kB
../dist/web/assets/index-JLho25mb.js   213.43 kB │ gzip: 66.49 kB
✓ built in 377ms
```

### Lint

Command:

```text
npm run lint
```

Output:

```text
> boveda-demo-api@0.1.0-batch0 lint
> npm run typecheck

> boveda-demo-api@0.1.0-batch0 typecheck
> npm run typecheck:api && npm run typecheck:web

> boveda-demo-api@0.1.0-batch0 typecheck:api
> tsc --noEmit --pretty false -p tsconfig.json

> boveda-demo-api@0.1.0-batch0 typecheck:web
> tsc --noEmit --pretty false -p web/tsconfig.json
```

### Existing Batch 2 backend tests

Command:

```text
npm test -- --run tests
```

Output:

```text
Test Files  8 passed (8)
Tests       26 passed (26)
```

### Canonical quote response probe

Command:

```text
node --import tsx --input-type=module - <<'NODE'
import { buildFastifyApp } from './src/app.ts';
const app = buildFastifyApp();
const payload = { scenario: 'WEB3_BRIDGE', borrowerWallet: '0xA11CE00000000000000000000000000000000001', requestedPrincipal: { amount: '150000', currency: 'USD' }, collateralToken: 'AVAX', collateralValueUsd: '300000' };
const res = await app.inject({ method: 'POST', url: '/quotes', payload });
const body = res.json();
console.log('status', res.statusCode);
console.log('topLevelKeys', Object.keys(body).sort().join(','));
console.log('termsKeys', Object.keys(body.terms ?? {}).sort().join(','));
console.log('topLevelLiquidationCurrency', String(body.liquidationCurrency));
console.log('termsLiquidationCurrency', body.terms?.liquidationCurrency);
await app.close();
NODE
```

Output:

```text
status 200
topLevelKeys requiredCollateralValueUsd,scenario,suggestedPrincipal,terms
termsKeys aprBps,initialLtvBps,liquidationCurrency,liquidationLtvBps,marginCallLtvBps,repaymentFrequency,tenorDays
topLevelLiquidationCurrency undefined
termsLiquidationCurrency USDC
```

Interpretation: the backend returns canonical nested `terms`, and the frontend now types/renders `QuoteResponse.terms.*`.

## Strict TDD Compliance

| Check | Result | Details |
|---|---:|---|
| Strict TDD active | ✅ | `openspec/config.yaml` has `sdd.strict_tdd: true`; `.pi/gentle-ai/support/strict-tdd-verify.md` exists and was read. |
| TDD Evidence reported | ✅ | `apply-progress.md` contains `TDD Cycle Evidence` plus correction/blocker-fix evidence tables. |
| All work units have tests | ✅ | WU1-WU4 and all corrections list concrete test files that exist in the codebase. |
| RED evidence recorded | ✅ | RED failure modes are recorded for initial work units and corrections, including the nested `QuoteResponse.terms` blocker fix. Historical RED states are not rerunnable after implementation, but the files/failure reasons are concrete and plausible. |
| GREEN confirmed | ✅ | Current full suite passes: 15 files / 55 tests. Focused blocker suite passes: 5 files / 22 tests. |
| Triangulation adequate | ✅ | Edge/error coverage includes URL encoding, API errors, wallet absence/rejection/malformed accounts, fallback loading, non-USDC liquidation guards, canonical quote request body, and canonical nested quote response rendering. |
| Safety net for modified files | ✅ | Baseline, targeted safety-net runs, and final full commands are recorded in `apply-progress.md`. |
| Corrections include TDD evidence | ✅ | Fallback, USDC hardening, EventTimeline, quote request, and nested quote response fixes each include RED/GREEN/TRIANGULATE/REFACTOR evidence. |

**TDD Compliance**: PASS.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---:|---:|---|
| Backend/API integration | 26 | 8 | Vitest node |
| Web unit/API/wallet/state | 11 | 3 | Vitest jsdom |
| React integration/regression | 18 | 4 | React Testing Library + Vitest jsdom |
| E2E | 0 | 0 | Not installed |
| **Total** | **55** | **15** | |

### Changed File Coverage

Coverage analysis skipped — no coverage provider dependency/configuration was detected for this project.

### Assertion Quality

| File | Finding |
|---|---|
| `web/src/api/client.test.ts` | Behavioral endpoint/method/error assertions; no tautologies or implementation-detail CSS assertions. |
| `web/src/wallet/injectedWallet.test.ts` | Exercises provider absence, `eth_requestAccounts`, rejection, and malformed accounts. |
| `web/src/state/borrowerJourney.test.ts` | Exercises selection, fallback, error preservation, quote payload, and risk errors. |
| `web/src/screens/OfferRequestScreen.test.tsx` | Exercises visible borrower terms, wallet states, risk copy, canonical nested quote response, and raw JSON avoidance. |
| `web/src/screens/LoanActivityScreen.test.tsx` | Exercises deposit/activation/payment/margin/liquidation behavior and non-USDC guards. |
| `web/src/components/EventTimeline.test.tsx` | Exercises non-USDC guard and valid USDC `Liquidated` event proceeds. |
| `web/src/App.regression.test.tsx` | Exercises accessible controls/status, honest simulation copy, no raw dumps, and wallet/risk display. |

**Assertion quality**: ✅ All reviewed assertions verify observable behavior. No tautologies, ghost loops, type-only-only assertions, smoke-only tests, or CSS implementation-detail assertions found.

### Quality Metrics

- **Linter**: ✅ No errors (`npm run lint` delegates to typecheck and passed).
- **Type Checker**: ✅ No errors (`npm run typecheck` passed for API and web projects).
- **Coverage**: ➖ Not available/configured.

## Wallet / Secret Boundary

- `web/src/wallet/injectedWallet.ts` only reads an injected `ethereum` provider and calls `eth_requestAccounts`.
- No `.env` files, private keys, seed phrases, credentials, or secret manager outputs were read or required during verification.
- Frontend secret-related copy is limited to safe borrower guidance that no private keys or seed phrases are needed.
- Optional API base URL uses browser-safe `import.meta.env.VITE_BOVEDA_API_BASE_URL`; no secret material is required.

## API Boundary

- Canonical endpoint paths are centralized in `web/src/api/client.ts`:
  - `GET /loans`, `GET /loans/{loanId}`
  - `POST /quotes`
  - `POST /risk/wallet`
  - `POST /loans/{loanId}/collateral/deposit`
  - `POST /loans/{loanId}/activate`
  - `POST /loans/{loanId}/payments/attest`
  - `POST /loans/{loanId}/margin-call`
  - `POST /loans/{loanId}/liquidate`
  - `GET /events?loanId=...`
- React components use props/state/client boundaries and do not directly import backend `src` modules.
- Production frontend code has no remaining flattened quote consumer patterns (`quote.initialLtvBps`, `quote.aprBps`, `quote.liquidationCurrency`, etc.).
- `requestedAmount` / `requestedCurrency` appear only in tests asserting their absence from quote payloads.

## Liquidation USDC Guard Findings

✅ Guarded surfaces:

- `web/src/screens/LoanActivityScreen.tsx` guards `lastLiquidation.proceedsCurrency` before rendering result proceeds.
- `web/src/screens/LoanActivityScreen.tsx` guards `loan.liquidationPreview.proceedsCurrency` before rendering preview copy.
- `web/src/components/EventTimeline.tsx` guards `Liquidated` event payload `proceedsCurrency` before rendering event proceeds.
- Tests cover unsupported non-USDC and valid USDC paths for result, preview, and timeline display.

## UI / Project Standards Findings

- CSS token file uses required data-product palette, 8px card radius, 6px controls, and 12/16/24/32 spacing.
- No gradient/blob/purple-blue decorative styling found in `web/src`.
- UI renders borrower-readable cards, metrics, alerts, status pills, event timeline, and action controls; no raw JSON dumps are presented.
- Accessibility regression tests cover named controls and polite status region; disabled/loading states are exposed through buttons.

## Review Workload / PR Boundary

- `tasks.md` forecasted 1,900–3,200 changed lines and recommended chained PRs with `feature-branch-chain`.
- The user approved a single-PR `size:exception`; `apply-progress.md` explicitly records this delivery decision.
- Scope implemented matches WU1-WU4 rather than a narrower chained slice. This is acceptable under the approved exception, but review size risk remains **High**.
- Untracked implementation currently includes the full `web/` frontend and `vite.config.ts`; tracked changes include `package.json`, `package-lock.json`, `vitest.config.ts`, and `openspec/config.yaml`.

## Blockers

None.

## Non-blocking Notes / Risks

- The change is large for review despite the approved size exception; reviewer should treat `package-lock.json` as dependency-generated noise.
- No browser E2E runner is installed; verification relies on Vitest jsdom component/integration tests plus Vite production build.
- npm emitted non-fatal warnings about unsupported `always-auth` config during command runs; all commands still passed.

## Memory

Callable memory tools were not exposed to this verify executor; this report was persisted to OpenSpec only.
