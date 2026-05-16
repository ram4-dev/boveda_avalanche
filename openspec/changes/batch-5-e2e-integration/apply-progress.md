# Apply Progress — batch-5-e2e-integration

## Work Unit 1 — Backend runtime config, adapter selection, and safe runtime metadata

**Status:** complete  
**Scope:** PR/WU1 only; no frontend route/UI work, reset/runbook, live Fuji signer, or business evidence payload expansion.

### RED
- Added `tests/runtime-config.test.ts` for broadcast-authoritative Fuji address mapping, ABI artifact validation, invalid address handling, missing ABI artifact handling, and broadcast mismatch errors.
- Added `tests/runtime-composition.test.ts` for demo runtime metadata/headers, Fuji-unavailable adapter behavior, and injected fake Fuji adapter metadata.
- Initial run after installing dependencies failed as expected because `src/config/runtime.js` and `src/config/fujiContracts.js` did not exist:
  - `npm test -- --run tests/runtime-config.test.ts tests/runtime-composition.test.ts`
  - Result: failed suites for missing runtime/config modules.

### GREEN
- Added `config/fuji-contracts.json` with public Avalanche Fuji addresses and ABI artifact paths only.
- Added `src/config/fujiContracts.ts` with broadcast-authoritative validation, ABI artifact existence/shape checks, address validation, and safe error strings.
- Added `src/config/runtime.ts` with demo/Fuji runtime metadata, prerequisites, and public `/runtime` response shaping.
- Extended `src/adapters/web3.ts` with evidence source metadata and `createUnavailableWeb3Adapter` / `Web3UnavailableError`.
- Updated `src/app.ts` to compose runtime-aware adapters, expose `GET /runtime`, and attach `x-boveda-runtime-mode` / `x-boveda-evidence-source` headers.
- Updated loan/payment routes to return safe `WEB3_UNAVAILABLE` errors instead of unhandled 500s when Fuji prerequisites are missing.
- Targeted WU1 tests passed:
  - `npm test -- --run tests/runtime-config.test.ts tests/runtime-composition.test.ts`
  - Result: 2 files / 5 tests passed.

### TRIANGULATE
- Added an injected fake Fuji adapter scenario proving `fuji-live` observability can be exercised without real signing/RPC dependencies.
- Added unsafe config scenario covering three distinct failure modes in one fixture: invalid address, missing ABI, and broadcast mismatch.

### REFACTOR
- Centralized runtime metadata in `src/config/runtime.ts`.
- Centralized Fuji public contract validation in `src/config/fujiContracts.ts`.
- Kept headers in one Fastify `onSend` hook rather than duplicating route-level header logic.

### Review Fixes
- Fresh review found a blocker: `loadRuntimeConfig` existed but normal `src/index.ts` startup still built the app with default demo runtime only.
- Fixed by adding `parseRuntimeMode` and wiring `src/index.ts` to pass `loadRuntimeConfig({ mode: parseRuntimeMode(process.env.BOVEDA_RUNTIME_MODE) })` into `buildFastifyApp`.
- Added tests proving explicit Fuji runtime loading resolves the public contract config and keeps evidence `fuji-unavailable` until live prerequisites exist.
- Fresh review also noted missing 503 coverage for payment/liquidation; added focused Fuji-unavailable tests for payment attestation and liquidation paths.

### Validation
- `npm test -- --run tests/runtime-config.test.ts tests/runtime-composition.test.ts` — passed, 2 files / 8 tests after review fixes.
- `npm test -- --run tests/openapi-contract-smoke.test.ts tests/loan-lifecycle.test.ts tests/payment-attestations.test.ts tests/dashboard-events.test.ts` — passed.
- `npm test -- --run` — passed, 29 files / 106 tests.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run lint` — passed.

### Notes
- `npm install --registry=https://registry.npmjs.org` was run because the fresh worktree had no `node_modules`; it produced no lockfile changes.
- Solidity/deploy scripts/contract artifacts were not changed, so `forge build` / `forge test` were not required for WU1.
- Live Fuji signing/RPC remains deliberately out of WU1; Fuji mode without injected/live prerequisites returns `WEB3_UNAVAILABLE` and never falls back to mock hashes.

## Work Unit 2 — Frontend route mode resolver, API base selection, and mismatch handling

**Status:** complete  
**Scope:** Frontend route/runtime mode only; no evidence rendering/link helpers, backend evidence payload expansion, or reset/runbook work.

### RED
- Added `web/src/runtime/runtimeMode.test.ts` for `/` -> Fuji mode, `/demo` -> demo mode, and operator labels.
- Extended `web/src/api/client.test.ts` for mode-specific API base URL priority and `GET /runtime`.
- Extended `web/src/App.regression.test.tsx` for route-mode banner and route/API mismatch alert.
- Initial targeted run failed as expected because runtime route helpers, mode-specific base URL resolution, `client.getRuntime`, and the App banner/mismatch handling did not exist:
  - `npm test -- --run web/src/runtime/runtimeMode.test.ts web/src/api/client.test.ts web/src/App.regression.test.tsx`

### GREEN
- Added `web/src/runtime/runtimeMode.ts` with route resolver, labels, runtime metadata guard, and mismatch message.
- Added `RuntimeModeBanner` and wired `App` to resolve route mode from `window.location.pathname`, instantiate the API client with that mode, fetch `GET /runtime`, and display clear Fuji/demo runtime copy.
- Updated API client base URL resolution priority:
  - Fuji: `VITE_BOVEDA_FUJI_API_BASE_URL`, fallback `VITE_BOVEDA_API_BASE_URL`, fallback same-origin.
  - Demo: `VITE_BOVEDA_DEMO_API_BASE_URL`, fallback `VITE_BOVEDA_API_BASE_URL`, fallback same-origin.
- Added `getRuntime()` to the frontend client and runtime metadata types.

### TRIANGULATE
- Added `/demo` mismatch coverage: route expects demo mode while API reports Fuji mode, rendering configuration-needed guidance instead of silently presenting evidence as correct.

### REFACTOR
- Kept route mode as a small pure module under `web/src/runtime/`.
- Centralized runtime banner copy in `RuntimeModeBanner` instead of spreading conditional text across screens.

### Review Fixes
- Fresh review found a medium stale-route risk because route mode was memoized once from `window.location.pathname`; fixed by tracking pathname state and listening for `popstate`.
- Fresh review noted optimistic Fuji-live copy before `/runtime` resolved; fixed by adding explicit verifying labels when runtime metadata is not loaded yet.
- Added direct unit coverage for `runtimeModeMismatch` and App regression coverage for navigation-driven mode changes.

### Validation
- `npm test -- --run web/src/runtime/runtimeMode.test.ts web/src/api/client.test.ts web/src/App.regression.test.tsx` — passed, 3 files / 17 tests.
- `npm test -- --run` — passed, 30 files / 112 tests.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run lint` — passed.

## Work Unit 3 — Backend evidence metadata on canonical business paths

**Status:** complete  
**Scope:** Backend-only additive evidence metadata for activation/payment/liquidation responses and canonical events; no frontend evidence UI, reset endpoint/script, live Fuji signing/RPC, or Solidity changes.

### RED
- Updated `tests/loan-lifecycle.test.ts` to require additive activation response fields `txHash`/`blockNumber` plus `activationEvidence.contracts`.
- Updated `tests/dashboard-events.test.ts` to require liquidation trigger context (`fromStatus`, `outcome`) and USDC distribution details in recent events.
- Red run failed as expected:
  - `npm test -- --run tests/loan-lifecycle.test.ts tests/payment-attestations.test.ts tests/dashboard-events.test.ts`
  - Failures showed missing activation `txHash`/`blockNumber` aliases and missing liquidation trigger metadata.

### GREEN
- Updated `src/modules/loans/routes.ts`:
  - Activation response now includes additive `txHash` and `blockNumber` while preserving existing `activationTxHash`/`activationBlockNumber`.
  - Liquidation event/response payloads now include trigger context (`fromStatus`, `outcome: 'LIQUIDATED'`) alongside USDC proceeds/distribution and evidence.
- Updated `src/modules/payments/routes.ts` and `src/modules/loans/routes.ts` to use centralized loan-evidence creation with vault contract references.

### TRIANGULATE
- Added `tests/payment-attestations.test.ts` scenario with an injected adapter that succeeds while marked `fuji-unavailable`, proving business state can advance with `fuji-unavailable` evidence metadata (pending/unavailable labeling) instead of fabricated live mode.

### REFACTOR
- Extended `src/domain/evidence.ts` with shared helpers:
  - `buildVaultContractReference(...)`
  - `buildLoanEvidenceMetadata(...)`
- Replaced per-route contract reference assembly with the shared helper.

### Validation
- `npm test -- --run tests/loan-lifecycle.test.ts tests/payment-attestations.test.ts tests/dashboard-events.test.ts` — passed (3 files, 13 tests).
- `npm test -- --run tests/loan-lifecycle.test.ts tests/payment-attestations.test.ts tests/dashboard-events.test.ts tests/openapi-contract-smoke.test.ts` — passed (4 files, 16 tests).
- `npm run typecheck:api` — passed.

## Work Unit 4 — Frontend evidence labels and source-gated explorer links

**Status:** complete  
**Scope:** Frontend evidence helpers/components/types/surfaces/tests only; no reset endpoint/script, live Fuji signer/RPC, or Solidity changes.

### RED
- Added `web/src/runtime/evidence.test.ts` first with failing coverage for source-gated `buildFujiExplorerLink(...)`, simulated/unavailable no-link behavior, and canonical label/a11y constants.
- Added/updated UI tests for borrower and dashboard surfaces:
  - `web/src/screens/LoanActivityScreen.test.tsx`
  - `web/src/components/EventTimeline.test.tsx`
  - `web/src/components/AuditTrail.test.tsx`
  - `web/src/components/LoanDetailPanel.test.tsx`
  - `web/src/screens/InstitutionalDashboardScreen.test.tsx`

### GREEN
- Added `web/src/runtime/evidence.ts` (central labels + a11y copy + source-gated explorer-link builder).
- Added shared components:
  - `web/src/components/EvidenceBadge.tsx`
  - `web/src/components/ExplorerLink.tsx`
- Wired evidence labels and source-gated links into borrower/dashboard surfaces:
  - `LoanActivityScreen` (collateral, activation, receipt, payment, liquidation labels + mode-aware button copy + Fuji-unavailable guidance)
  - `EventTimeline` (labels and gated tx/address/block links)
  - `AuditTrail` (labels and gated tx/block links)
  - `LoanDetailPanel` (labels and gated collateral/payment links)
- Tiny type alignment in `web/src/api/types.ts` for additive evidence metadata.

### TRIANGULATE
- Added live-evidence fixtures with visible Fuji links and demo/unavailable fixtures with no links.
- Added explicit Fuji unavailable label coverage (`Fuji evidence pending/unavailable`) and simulated label coverage (`Simulated demo evidence`).

### REFACTOR
- Centralized evidence badge copy and link a11y labels in `web/src/runtime/evidence.ts`.
- Reused `EvidenceBadge` / `ExplorerLink` across borrower + dashboard surfaces to reduce duplicate label/link logic.

### Review Fixes
- Fresh review found a blocker: explorer links only checked for non-empty values, so malformed tx/address strings could become Fuji links.
- Fixed by validating tx hashes as `0x` + 64 hex chars, addresses as `0x` + 40 hex chars, and block numbers as safe non-negative integers before building links.
- Fresh review also noted `LoanDetailPanel` liquidation evidence derived from USDC currency instead of event evidence metadata; fixed by deriving liquidation evidence from the latest `LiquidationExecuted` event and rendering gated tx/block links.

### Validation
- `npm test -- --run web/src/runtime/evidence.test.ts web/src/screens/LoanActivityScreen.test.tsx web/src/components/EventTimeline.test.tsx web/src/components/AuditTrail.test.tsx web/src/components/LoanDetailPanel.test.tsx web/src/screens/InstitutionalDashboardScreen.test.tsx` — passed (6 files, 19 tests).
- `npm run typecheck:web` — passed.
- `npm run build:web` — passed.

## Work Unit 5 — Demo reset endpoint, script, runbook, and repeatability evidence

**Status:** complete  
**Scope:** Demo reset/repeatability backend tests + route + store + script + docs only; no frontend evidence expansion, no live Fuji signer/RPC, no Solidity changes.

### RED
- Added failing tests:
  - `tests/demo-reset.test.ts`
  - `tests/demo-repeatability.test.ts`
- Initial red run:
  - `npm test -- --run tests/demo-reset.test.ts tests/demo-repeatability.test.ts`
  - Failed with `POST /demo/reset` returning 404 because the route did not exist.

### GREEN
- Added `DemoStore.reset(seed)` to rebuild deterministic state from seed and clear in-memory payment attestation cache.
- Added guarded `POST /demo/reset` in `src/app.ts` only when `runtime.mode === 'demo' && runtime.resetEnabled`.
- Added safe reset response evidence payload:
  - `mode`, `resetAt`, `seedSourcePath`, `loanCount`, `eventCount`, `evidenceSource`, `label`.
- Exported seed source constants in `src/store/seedLoader.ts` and wired reset metadata to `data/demo/loans.seed.json`.
- Added `scripts/demo-reset.mjs` and `npm run demo:reset` script:
  - verifies `GET /runtime` is demo mode,
  - calls `POST /demo/reset`,
  - verifies baseline loan/event state after reset.

### TRIANGULATE
- Repeatability test runs payment + margin-call + liquidation twice with a reset in between.
- Asserts stale run-1 `InstallmentPaid`/`Liquidated` evidence is not carried into run-2 history.

### REFACTOR
- Kept reset response construction in a small helper (`buildDemoResetResponse`) inside `src/app.ts`.
- Added dedicated runbook: `docs/demo/e2e-runbook.md` with two-run procedure, label/link rules, and reset recovery.

### Local E2E Fixes
- Added Vite dev proxy entries for `/runtime` and `/demo/reset` so the web app can exercise the API same-origin during local browser testing while preserving `/demo` as a frontend route.
- Fixed `scripts/demo-reset.mjs` to avoid sending `content-type: application/json` for empty-body reset requests and to verify baseline seed events without stale payment/liquidation evidence.

### Validation
- `npm test -- --run tests/demo-reset.test.ts tests/demo-repeatability.test.ts` — passed (2 files, 3 tests).
- `npm run typecheck:api` — passed.
- `npm run demo:reset -- --base-url http://127.0.0.1:5175` — passed against local Vite/API stack.

## Work Unit 6 — Final integration verification and apply-progress evidence

**Status:** complete  
**Scope:** Validation/reporting only; no Solidity, deploy scripts, contract artifacts, live signer/RPC, or scope expansion.

### Verification
- `npm test -- --run` — passed (34 files, 126 tests).
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run lint` — passed.

### Review
- Fresh final audit found no blockers for junk files, secrets, out-of-scope Solidity/live signer changes, canonical API path breakage, reset route scope, or test consistency.
- Review workload risk remains high because the full Batch 5 branch contains WU1-WU5 plus docs/tests/config; keep chained review expectations visible when preparing the PR.

### Notes
- Solidity/deploy scripts/contract artifacts were not changed in Batch 5 WU3-WU5, so `forge build` / `forge test` were not required.
- `/demo` remains deterministic and honestly labeled; `/`/Fuji mode does not silently fall back to mock evidence.
