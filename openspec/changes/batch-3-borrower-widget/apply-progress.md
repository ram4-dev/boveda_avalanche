# Apply Progress: batch-3-borrower-widget

## Status

Complete. All assigned work units 1-4 were implemented on branch `feature/batch-3-borrower-widget` under the resolved delivery path `single-pr / size:exception` approved by the user.

## Review Workload / PR Boundary

- Delivery decision: user approved a single branch/PR despite the forecast exceeding the configured 700-line review budget.
- Review size risk: **High**.
- Current implementation adds the complete Vite/React borrower widget, frontend test setup, React dependencies, and lockfile updates in one branch.
- `package-lock.json` changed substantially because React/Vite/jsdom/testing-library dependencies were added; treat lockfile as dependency-generated review noise.

## Completed Tasks

- [x] WU0 baseline and guardrails recorded before production UI code.
- [x] WU1 frontend tooling, isolated Vitest jsdom setup, canonical API client, and injected wallet boundary.
- [x] WU2 borrower journey state and offer/request screen.
- [x] WU3 loan activity UI, collateral activation actions, payment attestation feedback, events, margin-call, and liquidation UI.
- [x] WU4 accessibility/status regression, honest API-simulated copy, responsive CSS, and final evidence.

## Files Changed

- `package.json`, `package-lock.json`
- `vitest.config.ts`, `vite.config.ts`
- `web/index.html`, `web/tsconfig.json`
- `web/src/App.tsx`, `web/src/main.tsx`
- `web/src/api/client.ts`, `web/src/api/errors.ts`, `web/src/api/types.ts`, `web/src/api/client.test.ts`
- `web/src/wallet/injectedWallet.ts`, `web/src/wallet/useInjectedWallet.ts`, `web/src/wallet/injectedWallet.test.ts`
- `web/src/state/borrowerJourney.ts`, `web/src/state/demoPayloads.ts`, `web/src/state/borrowerJourney.test.ts`
- `web/src/screens/OfferRequestScreen.tsx`, `web/src/screens/OfferRequestScreen.test.tsx`
- `web/src/screens/LoanActivityScreen.tsx`, `web/src/screens/LoanActivityScreen.test.tsx`
- `web/src/components/ActionButton.tsx`, `Alert.tsx`, `EventTimeline.tsx`, `KeyValueList.tsx`, `MetricTile.tsx`, `StatusPill.tsx`, `format.ts`
- `web/src/styles/tokens.css`, `web/src/styles/app.css`
- `web/src/test/setup.ts`
- `web/src/App.regression.test.tsx`

## TDD Cycle Evidence

| Work Unit | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| WU0 Baseline | Existing suite | Integration | N/A | N/A | ✅ `npm test -- --run` passed 8 files / 26 tests; `typecheck`, `build`, `lint` passed before UI production code | N/A | N/A |
| WU1 Tooling/API client/wallet | `web/src/api/client.test.ts`, `web/src/wallet/injectedWallet.test.ts` | Unit/integration (Vitest jsdom project) | ✅ Backend baseline passed | ✅ `npm test -- --run web/src/api/client.test.ts web/src/wallet/injectedWallet.test.ts` failed: web tests excluded by config / missing production modules | ✅ Implemented Vite/Vitest projects, API client, wallet boundary; targeted tests passed 2 files / 6 tests | ✅ Added URL encoding, canonical API error parsing, non-JSON HTTP error, provider absence, success, rejection, malformed account tests | ✅ Endpoint strings centralized in `client.ts`; no React imports backend `src/`; Vite build output uses `dist/web` with `emptyOutDir: false` |
| WU2 Borrower state + offer screen | `web/src/state/borrowerJourney.test.ts`, `web/src/screens/OfferRequestScreen.test.tsx` | Integration (React Testing Library) + state tests | ✅ WU1 targeted tests passed | ✅ Targeted run failed: missing `borrowerJourney.js` and `OfferRequestScreen.js` | ✅ Implemented journey state, demo payload helpers, shared display components, offer screen, app shell, CSS tokens; targeted tests passed 2 files / 8 tests | ✅ Covered fallback/empty/error state preservation, quote/risk action errors, wallet unavailable/connected/rejected, REVIEW/BLOCK copy, Approved vs Requested guidance | ✅ Extracted small display primitives and formatting helpers; UI uses injected palette/radius/spacing; no raw JSON dumps |
| WU3 Loan activity/lifecycle UI | `web/src/screens/LoanActivityScreen.test.tsx` | Integration (React Testing Library) | ✅ WU2 targeted tests passed | ✅ Targeted run failed: missing `LoanActivityScreen.js` | ✅ Implemented `LoanActivityScreen`, event timeline, payment/margin/liquidation display; targeted tests passed 5 tests | ✅ Covered Approved deposit/activation eligibility, Active receipt/payment, payment errors, MarginCall liquidation USDC distribution, terminal status disabled actions | ✅ Avoided duplicating backend state machine beyond status-derived button availability; event timeline avoids raw payload dumps |
| WU4 Accessibility/polish/regression | `web/src/App.regression.test.tsx` | Integration (React Testing Library) | ✅ Full suite passed after WU3 | ✅ Added readiness status regression; targeted run failed because no `role=status` region named `Borrower data status` existed | ✅ Added polite API readiness status and event timeline cleanup; targeted regression tests passed 4 tests | ✅ Covered keyboard-reachable named controls, non-blocking wallet absence, honest API-simulated copy, USDC liquidation copy, no raw JSON dumps, wallet connection display | ✅ Responsive CSS and focus-visible styles retained; final full test/typecheck/build/lint passed |

## Test Commands Run

- `npm test -- --run && npm run typecheck && npm run build && npm run lint` → baseline passed before implementation (8 backend files / 26 tests).
- `npm test -- --run web/src/api/client.test.ts web/src/wallet/injectedWallet.test.ts` → RED failed because web tests were excluded by current Vitest config.
- `npm install --registry=https://registry.npmjs.org react react-dom` → passed.
- `npm install --save-dev --registry=https://registry.npmjs.org vite @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom` → first attempt failed due latest `@vitejs/plugin-react` peer conflict with Vite; retried with `@vitejs/plugin-react@^5.1.1` and passed.
- `npm test -- --run web/src/api/client.test.ts web/src/wallet/injectedWallet.test.ts` → GREEN passed, 2 files / 6 tests.
- `npm test -- --run web/src/state/borrowerJourney.test.ts web/src/screens/OfferRequestScreen.test.tsx` → RED failed because production modules were missing; later GREEN passed, 2 files / 8 tests.
- `npm test -- --run web/src/screens/LoanActivityScreen.test.tsx` → RED failed because production module was missing; later GREEN passed, 1 file / 5 tests.
- `npm test -- --run web/src/App.regression.test.tsx` → RED failed on missing readiness status region; later GREEN passed, 1 file / 4 tests.
- `npm test -- --run` → final passed, 14 files / 49 tests.
- `npm run typecheck` → final passed.
- `npm run build` → final passed, including `vite build --config vite.config.ts`.
- `npm run lint` → final passed (`npm run typecheck`).

## Final Verification Evidence

```text
npm test -- --run
Test Files  14 passed (14)
Tests       49 passed (49)

npm run typecheck
passed

npm run build
passed

npm run lint
passed
```

## Deviations / Notes

- Delivery deviated from forecasted chained strategy by explicit user-approved `single-pr size:exception`.
- `npm install` initially selected an incompatible latest `@vitejs/plugin-react`; fixed by installing `@vitejs/plugin-react@^5.1.1` compatible with Vite 7.
- The local background smoke attempt using concurrently started API and Vite dev server did not complete within the scripted wait window in this non-interactive tool run. Required verification commands passed, and `vite build` succeeded. The web run command is `npm run dev:web`; API run command remains `npm run dev`.
- No `.env`, private keys, seed phrases, credentials, or secret files were read or required.
- Frontend components use the API client boundary and do not import backend `src/` modules.
- Collateral and liquidation UI copy explicitly says actions are API-simulated until contracts are wired through the backend adapter.
- Liquidation copy and payload helpers use `USDC` for proceeds.

## Fresh Review Correction — Fallback Load And USDC Presentation Guard

### Completed Tasks

- [x] Fixed documented borrower-context fallback: `loadBorrowerContext` now calls filtered `GET /loans?scenario=WEB3_BRIDGE` first, then unfiltered `GET /loans` when the filtered result is empty.
- [x] Fixed USDC presentation hardening: liquidation result and preview displays now guard unsupported currencies instead of silently rendering non-USDC proceeds as valid.

### Files Changed For Correction

- `web/src/state/borrowerJourney.ts`
- `web/src/state/borrowerJourney.test.ts`
- `web/src/screens/LoanActivityScreen.tsx`
- `web/src/screens/LoanActivityScreen.test.tsx`
- `web/src/components/format.ts`
- `openspec/changes/batch-3-borrower-widget/apply-progress.md`

### TDD Cycle Evidence — Fresh Review Correction

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Fallback from filtered to unfiltered loan load | `web/src/state/borrowerJourney.test.ts` | State integration/unit | ✅ `npm test -- --run web/src/state/borrowerJourney.test.ts web/src/screens/LoanActivityScreen.test.tsx` passed 2 files / 9 tests before changes | ✅ Targeted run failed: second `listLoans` call was missing when `WEB3_BRIDGE` returned empty | ✅ Implemented unfiltered fallback; targeted run passed after test expectation matched no-arg unfiltered call | ✅ Existing empty/error-preservation test still covers the fallback path when both filtered and unfiltered lists are empty | ✅ Kept selection logic in `selectPreferredLoan`; no component code changes for loading behavior |
| USDC liquidation display hardening | `web/src/screens/LoanActivityScreen.test.tsx` | React integration | ✅ Same targeted safety net passed 2 files / 9 tests before changes | ✅ Targeted run failed because unsupported `DAI` liquidation result rendered as `154200 DAI` | ✅ Added presentation guard and unsupported-currency message; targeted run passed | ✅ Added preview-currency guard coverage so non-USDC previews do not render `denominated in DAI` copy | ✅ Extracted small presentation helpers in `web/src/components/format.ts` |

### Test Commands Run For Correction

- `npm test -- --run web/src/state/borrowerJourney.test.ts web/src/screens/LoanActivityScreen.test.tsx` → safety net passed, 2 files / 9 tests.
- `npm test -- --run web/src/state/borrowerJourney.test.ts web/src/screens/LoanActivityScreen.test.tsx` → RED failed: missing unfiltered fallback call and unsupported `DAI` liquidation display.
- `npm test -- --run web/src/state/borrowerJourney.test.ts web/src/screens/LoanActivityScreen.test.tsx` → GREEN passed, 2 files / 11 tests.
- `npm test -- --run web/src/state/borrowerJourney.test.ts web/src/screens/LoanActivityScreen.test.tsx` → TRIANGULATE passed, 2 files / 12 tests.
- `npm test -- --run` → passed, 14 files / 52 tests.
- `npm run typecheck` → passed.
- `npm run build` → passed.
- `npm run lint` → passed.

### Verification Evidence — Correction

```text
npm test -- --run
Test Files  14 passed (14)
Tests       52 passed (52)

npm run typecheck
passed

npm run build
passed

npm run lint
passed
```

## Verify Blocker Fix — EventTimeline USDC Liquidated Proceeds Guard

### Completed Tasks

- [x] Added focused RED coverage for `EventTimeline` so a `Liquidated` event with `proceedsCurrency: 'DAI'` is not rendered as valid proceeds.
- [x] Implemented a USDC-only presentation guard in `EventTimeline` using the shared liquidation currency helpers from `web/src/components/format.ts`.
- [x] Added TRIANGULATE coverage proving a valid `Liquidated` event with `proceedsCurrency: 'USDC'` still renders `Proceeds 154200 USDC`.

### Files Changed For Blocker Fix

- `web/src/components/EventTimeline.tsx`
- `web/src/components/EventTimeline.test.tsx`
- `openspec/changes/batch-3-borrower-widget/apply-progress.md`

### TDD Cycle Evidence — Verify Blocker Fix

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| EventTimeline Liquidated proceeds USDC-only guard | `web/src/components/EventTimeline.test.tsx` | React integration | Existing Batch 3 suite was green before this focused blocker fix | ✅ `npm test -- --run web/src/components/EventTimeline.test.tsx` failed: unsupported DAI message was missing and UI rendered `Proceeds 154200 DAI` | ✅ Added EventTimeline guard; targeted test passed, 1 file / 1 test | ✅ Added valid USDC Liquidated event case; targeted test passed, 1 file / 2 tests | ✅ Reused shared `isUsdcCurrency` and `unsupportedLiquidationCurrencyMessage`; full test/typecheck/build/lint passed |

### Test Commands Run For Blocker Fix

- `npm test -- --run web/src/components/EventTimeline.test.tsx` → RED failed: `Unsupported liquidation currency DAI` not found; DOM rendered `Proceeds 154200 DAI`.
- `npm test -- --run web/src/components/EventTimeline.test.tsx` → GREEN passed, 1 file / 1 test.
- `npm test -- --run web/src/components/EventTimeline.test.tsx` → TRIANGULATE passed, 1 file / 2 tests.
- `npm test -- --run` → passed, 15 files / 54 tests.
- `npm run typecheck` → passed.
- `npm run build` → passed.
- `npm run lint` → passed.

### Verification Evidence — Verify Blocker Fix

```text
npm test -- --run
Test Files  15 passed (15)
Tests       54 passed (54)

npm run typecheck
passed

npm run build
passed

npm run lint
passed
```

## Verify Blocker Fix — Canonical Quote Request Payload

### Completed Tasks

- [x] Added focused RED coverage proving `refreshQuote` sends canonical `requestedPrincipal: { amount, currency }` to `POST /quotes`.
- [x] Updated `QuoteRequest` to remove non-canonical `requestedAmount` / `requestedCurrency` and require canonical `requestedPrincipal`.
- [x] Updated `refreshQuote` to build the OpenAPI/backend-compatible quote payload from the selected loan principal.
- [x] Updated API client tests to use the canonical quote request type.

### Files Changed For Blocker Fix

- `web/src/api/types.ts`
- `web/src/api/client.test.ts`
- `web/src/state/borrowerJourney.ts`
- `web/src/state/borrowerJourney.test.ts`
- `openspec/changes/batch-3-borrower-widget/apply-progress.md`

### TDD Cycle Evidence — Quote Request Contract Blocker

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Canonical quote request payload | `web/src/state/borrowerJourney.test.ts`, `web/src/api/client.test.ts` | State/API integration | ✅ `npm test -- --run web/src/api/client.test.ts web/src/state/borrowerJourney.test.ts` passed, 2 files / 8 tests before changes | ✅ `npm test -- --run web/src/state/borrowerJourney.test.ts` failed because `refreshQuote` sent `requestedAmount` / `requestedCurrency` and no `requestedPrincipal` | ✅ Updated `QuoteRequest` and `refreshQuote`; targeted tests passed, 2 files / 8 tests | ✅ Test also asserts old `requestedAmount` and `requestedCurrency` fields are absent; grep confirms no frontend production usage remains | ✅ Kept payload construction localized to `refreshQuote` and type contract localized to `web/src/api/types.ts`; full test/typecheck/build/lint passed |

### Test Commands Run For Blocker Fix

- `npm test -- --run web/src/api/client.test.ts web/src/state/borrowerJourney.test.ts` → safety net passed, 2 files / 8 tests.
- `npm test -- --run web/src/state/borrowerJourney.test.ts` → RED failed: expected `requestedPrincipal` but received `requestedAmount` / `requestedCurrency`.
- `npm test -- --run web/src/state/borrowerJourney.test.ts web/src/api/client.test.ts` → GREEN passed, 2 files / 8 tests.
- `npm run typecheck` → passed after updating test mock typing and canonical `QuoteRequest`.
- `grep "requestedAmount|requestedCurrency|requestedPrincipal" web/src` → only tests mention old keys for absence assertions; production uses only `requestedPrincipal`.
- `npm test -- --run` → passed, 15 files / 54 tests.
- `npm run typecheck` → passed.
- `npm run build` → passed.
- `npm run lint` → passed.

### Verification Evidence — Quote Request Contract Blocker

```text
npm test -- --run
Test Files  15 passed (15)
Tests       54 passed (54)

npm run typecheck
passed

npm run build
passed

npm run lint
passed
```

## Verify Blocker Fix — Canonical Nested QuoteResponse Terms

### Completed Tasks

- [x] Added focused RED coverage using a real backend/OpenAPI-shaped `QuoteResponse` fixture with nested `terms.initialLtvBps`, `terms.marginCallLtvBps`, `terms.liquidationLtvBps`, `terms.aprBps`, `terms.tenorDays`, `terms.repaymentFrequency`, and `terms.liquidationCurrency`.
- [x] Updated `web/src/api/types.ts` so `QuoteResponse` uses the canonical nested `terms` object.
- [x] Updated `OfferRequestScreen` and quote fixtures/state tests to consume `quote.terms.*` instead of flattened quote fields.
- [x] Preserved USDC-focused liquidation currency display for quote terms.

### Files Changed For Blocker Fix

- `web/src/api/types.ts`
- `web/src/screens/OfferRequestScreen.tsx`
- `web/src/screens/OfferRequestScreen.test.tsx`
- `web/src/state/demoPayloads.ts`
- `web/src/state/borrowerJourney.test.ts`
- `openspec/changes/batch-3-borrower-widget/apply-progress.md`

### TDD Cycle Evidence — Quote Response Contract Blocker

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Canonical nested `QuoteResponse.terms` rendering | `web/src/screens/OfferRequestScreen.test.tsx`, `web/src/state/borrowerJourney.test.ts`, `web/src/api/client.test.ts` | React integration + state/API type integration | ✅ `npm test -- --run web/src/screens/OfferRequestScreen.test.tsx` had 4 existing tests passing before the new blocker assertion failed | ✅ `npm test -- --run web/src/screens/OfferRequestScreen.test.tsx` failed: nested OpenAPI quote rendered `NaN% / NaN% / NaN%`, `NaN% APR, undefined days`, and blank liquidation currency because the UI read flattened fields | ✅ Updated `QuoteResponse` to nested `terms`, `OfferRequestScreen` to read `quote.terms.*`, and fixtures/state mocks to canonical shape; targeted tests passed, 3 files / 13 tests | ✅ Existing quote display test now uses `sampleQuote()` with nested terms and asserts LTV/APR/USDC; OpenAPI-shaped fixture test separately covers backend-shaped response without flattened fields | ✅ Grep found no remaining flattened quote consumer patterns; full test/typecheck/build/lint passed |

### Test Commands Run For Blocker Fix

- `npm test -- --run web/src/screens/OfferRequestScreen.test.tsx` → RED failed: expected nested quote terms, but UI rendered `NaN% / NaN% / NaN%`, `NaN% APR, undefined days`, and blank liquidation currency.
- `npm test -- --run web/src/screens/OfferRequestScreen.test.tsx web/src/state/borrowerJourney.test.ts web/src/api/client.test.ts` → GREEN passed, 3 files / 13 tests.
- `npm test -- --run web/src/screens/OfferRequestScreen.test.tsx web/src/state/borrowerJourney.test.ts web/src/api/client.test.ts && npm run typecheck` → TRIANGULATE/REFACTOR passed, 3 files / 13 tests plus typecheck.
- `grep "quote\\.(initialLtvBps|marginCallLtvBps|liquidationLtvBps|aprBps|tenorDays|repaymentFrequency|liquidationCurrency)|QuoteResponse.*initialLtvBps" web/src` → no remaining flattened quote consumer patterns.
- `npm test -- --run` → passed, 15 files / 55 tests.
- `npm run typecheck` → passed.
- `npm run build` → passed.
- `npm run lint` → passed.

### Verification Evidence — Quote Response Contract Blocker

```text
npm test -- --run
Test Files  15 passed (15)
Tests       55 passed (55)

npm run typecheck
passed

npm run build
passed

npm run lint
passed
```

## Remaining Tasks

- SDD verify phase should perform final independent verification and decide whether to commit/push.
- Optional future polish: stronger browser E2E coverage once a browser runner is available.

## Memory

Callable memory tools were not exposed to this apply executor; progress was persisted to this OpenSpec artifact only.
