# Tasks — batch-5-e2e-integration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900–1,400 total; target 180–390 per work unit |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 runtime config/adapter → PR 2 frontend runtime route → PR 3 backend evidence payloads → PR 4 frontend evidence rendering → PR 5 reset/runbook/repeatability |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

## Strict TDD Expectations

Strict TDD is active from `openspec/config.yaml`.

For every work unit:
1. **RED:** add or update the smallest failing test first; record the failing command and assertion.
2. **GREEN:** implement only enough code to pass that test.
3. **TRIANGULATE:** add one materially different scenario or edge case before generalizing.
4. **REFACTOR:** reduce duplication, keep canonical API/state semantics, and rerun targeted tests.

Required final validation for touched areas:
- `npm test -- --run`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- Run `forge build` and `forge test` only if Solidity, deploy scripts, or contract artifacts are changed. Batch 5 tasks should avoid those changes unless explicitly approved.

Secret guardrail for all tasks: do not read, print, commit, or derive `.env` values, private keys, RPC credentials, tokens, seed phrases, wallet secrets, or secret-manager outputs.

## Real Fuji collateral decision

Documentation-only investigation concluded:
- Native AVAX is not compatible with the current `CollateralVault` because deposits use ERC-20 `transferFrom`.
- First real E2E should use **WAVAX on Fuji as collateral**.
- Liquidation proceeds remain **USDC**, matching the canonical API/spec/docs contract.
- BTC.b is stretch-only for Fuji unless token contract and funding path are proven before coding.
- Backend must verify receipt/log/state evidence itself; do not trust frontend wallet prompts or client-provided `txHash` alone.

See `docs/demo/fuji-real-e2e-collateral-verification.md` before implementing the real Fuji adapter.

## Work Units

### 0. Scope-freeze and no-go gate

**Estimate:** 0–20 changed lines  
**Start boundary:** before any implementation work.  
**Finish boundary:** apply has an explicit delivery decision because chained PRs are recommended.  
**Rollback boundary:** remove/defer any task that violates Batch 5 scope before writing code.

- [x] Confirm implementation scope is limited to runtime mode separation, public contract/ABI evidence, origination/payment/liquidation evidence visibility, reset/repeatability, docs, and validation.
- [x] Reject/defer production custody, KYC, fiat rails, accounting automation, oracle/keeper/DEX automation, broad Solidity redesign, unrelated endpoint rewrites, and Batch 6/7/8 scope.
- [x] If live Fuji signing/RPC implementation requires a new dependency or secret-bearing runtime contract, stop and request explicit approval before adding it.
- [x] Preserve canonical API paths from `docs/demo/openapi.yaml`; do not create parallel `/demo/loans`, `/demo/events`, or dashboard schemas. The only approved demo-specific endpoint is the guarded reset route.

**Verification:** reviewer can compare the diff against `openspec/changes/batch-5-e2e-integration/specs/scope-governance/spec.md` and find no out-of-scope expansion.

---

### 1. PR 1 — Backend runtime config, adapter selection, and safe runtime metadata

**Estimate:** 250–390 changed lines  
**Start boundary:** no frontend route/UI changes.  
**Finish boundary:** backend can report demo/Fuji/unavailable runtime state without silent mock fallback.  
**Rollback boundary:** revert new backend config/runtime files and `src/app.ts` composition changes; existing mock API remains usable.

#### 1.1 RED — contract config and ABI validation tests

Touched files:
- New `tests/runtime-config.test.ts` or `src/config/runtime.test.ts`
- Optional fixtures under `tests/fixtures/runtime/`
- Discovery targets: `broadcast/Deploy.s.sol/43113/run-latest.json`, `out/*/*.json`, `openspec/changes/batch-5-e2e-integration/specs/contract-config/spec.md`

Tasks:
- [x] Add failing tests asserting the five broadcast-authoritative Fuji addresses:
  - `LoanRegistry` → `0xb6832e4c43e97d5ad11e99abcb23d9a734a4be14`
  - `CollateralVault` → `0xe550a10f585e5595ae187f08a701bdef890de057`
  - `LoanReceiptNFT` → `0xf88b6e8c107a0a5da6f398734783541cbe12a38c`
  - `PaymentAttestation` → `0xa222a02e828d5480be971b80d4157f2abe1fabda`
  - `LiquidationEngine` → `0x212f6565319caa343c8c39e9b11a447febf2055a`
- [x] Add failing tests for missing ABI, invalid address, and broadcast mismatch returning safe validation errors.
- [x] Assert tests use injected paths/fixtures/public artifacts only; no `.env` or secret material.

Validation command:
- `npm test -- --run tests/runtime-config.test.ts`

#### 1.2 GREEN — public Fuji config and runtime loader

Touched files:
- New `config/fuji-contracts.json`
- New `src/config/fujiContracts.ts`
- New `src/config/runtime.ts` or `src/config/runtimeTypes.ts`

Tasks:
- [x] Commit a secret-free public config with chain ID `43113`, network name `Avalanche Fuji`, explorer base URL, contract names, public addresses, and ABI artifact paths.
- [x] Implement validation for required contract names, hex address shape, broadcast mapping, ABI artifact existence, and `abi` array presence.
- [x] Return safe public runtime metadata and safe validation errors; never log secret-bearing values.

#### 1.3 RED/GREEN — adapter composition and API runtime observability

Touched files:
- `src/app.ts`
- `src/adapters/web3.ts`
- New `src/adapters/web3Unavailable.ts` or equivalent
- New `tests/runtime-composition.test.ts` or add to existing API tests
- Existing route modules if needed only to add response headers: `src/modules/loans/routes.ts`, `src/modules/payments/routes.ts`, `src/modules/dashboard/routes.ts`, `src/modules/events/routes.ts`

Tasks:
- [x] RED: test demo mode selects the existing mock adapter and reports `demo-simulated` evidence.
- [x] RED: test Fuji mode with missing/unavailable prerequisites selects an unavailable adapter and never falls back to mock hashes.
- [x] RED: test `GET /runtime` returns safe public metadata and canonical API responses include `x-boveda-runtime-mode` and `x-boveda-evidence-source` headers.
- [x] GREEN: add runtime composition behind `buildFastifyApp(...)` while preserving dependency injection used by existing tests.
- [x] GREEN: implement unavailable-Fuji adapter responses/errors such as `WEB3_UNAVAILABLE` for write-like operations.
- [x] TRIANGULATE: add an injected fake Fuji adapter test that returns `fuji-live` metadata without adding real signing/RPC scope.
- [x] REFACTOR: centralize runtime/evidence header creation to avoid per-route duplication.

Validation commands:
- `npm test -- --run tests/runtime-config.test.ts tests/runtime-composition.test.ts`
- `npm test -- --run tests/openapi-contract-smoke.test.ts tests/loan-lifecycle.test.ts tests/payment-attestations.test.ts tests/dashboard-events.test.ts`
- `npm run typecheck:api`

---

### 2. PR 2 — Frontend route mode resolver, API base selection, and mismatch handling

**Estimate:** 220–360 changed lines  
**Start boundary:** backend runtime endpoint from PR 1 exists or is faked in tests.  
**Finish boundary:** `/` resolves Fuji mode, `/demo` resolves demo mode, and route/API mode mismatch blocks misleading evidence.  
**Rollback boundary:** revert frontend runtime modules and API-client mode changes; previous single-route UI remains intact.

#### 2.1 RED — route and API-client tests

Touched files:
- New `web/src/runtime/runtimeMode.test.ts`
- `web/src/api/client.test.ts` or existing API-client tests
- `web/src/App.test.tsx` or nearest existing app/screen tests
- Discovery targets: `web/src/App.tsx`, `web/src/api/client.ts`, `web/src/state/borrowerJourney.ts`

Tasks:
- [x] Add failing tests for `resolveRuntimeRoute('/')` → Fuji mode and `resolveRuntimeRoute('/demo')` → demo mode.
- [x] Add failing tests for API base URL priority:
  - Fuji: `VITE_BOVEDA_FUJI_API_BASE_URL`, then legacy `VITE_BOVEDA_API_BASE_URL`, then same-origin.
  - Demo: `VITE_BOVEDA_DEMO_API_BASE_URL`, then legacy `VITE_BOVEDA_API_BASE_URL`, then same-origin.
- [x] Add failing UI/client test for route/API mode mismatch rendering configuration-needed guidance rather than live/demo evidence.

Validation command:
- `npm test -- --run web/src/runtime/runtimeMode.test.ts web/src/api/client.test.ts`

#### 2.2 GREEN — frontend runtime mode and metadata client

Touched files:
- New `web/src/runtime/runtimeMode.ts`
- `web/src/api/client.ts`
- `web/src/App.tsx`
- New or existing `web/src/components/RuntimeModeBanner.tsx`

Tasks:
- [x] Implement pure route resolver and mode labels.
- [x] Extend the API client to fetch `GET /runtime` and select the base URL by route mode.
- [x] Render a visible runtime banner:
  - Fuji healthy: `Fuji live mode — Avalanche Fuji evidence enabled`.
  - Fuji unavailable: `Fuji mode unavailable — live chain evidence pending. Use /demo for deterministic simulated evidence.`
  - Demo: `Demo mode — simulated evidence only; no live Fuji finality.`
- [x] Block misleading evidence when route mode and API runtime mode disagree.

#### 2.3 TRIANGULATE/REFACTOR — navigation and stale-state cases

Touched files:
- `web/src/App.tsx`
- `web/src/state/borrowerJourney.ts` if mode must reset/reload journey state
- Relevant app/screen tests

Tasks:
- [x] Add a navigation/stale-state test proving evidence labels track the current `window.location.pathname`.
- [x] Refactor runtime mode props/context so borrower and dashboard screens consume one source of truth.

Validation commands:
- `npm test -- --run web/src/runtime/runtimeMode.test.ts web/src/api/client.test.ts`
- `npm test -- --run web/src/App.test.tsx web/src/state/borrowerJourney.test.ts`
- `npm run typecheck:web`

---

### 3. PR 3 — Backend evidence metadata on canonical business paths

**Estimate:** 240–380 changed lines  
**Start boundary:** runtime composition from PR 1 is in place.  
**Finish boundary:** canonical API responses/events carry additive evidence metadata while preserving existing fields and paths.  
**Rollback boundary:** revert additive evidence fields/helpers; canonical endpoint behavior remains as before.

#### 3.1 RED — route and lifecycle evidence tests

Touched files:
- `tests/loan-lifecycle.test.ts`
- `tests/payment-attestations.test.ts`
- `tests/dashboard-events.test.ts`
- `tests/openapi-contract-smoke.test.ts` only for additive contract checks if needed

Tasks:
- [x] Add failing tests that activation/origination responses keep canonical `txHash`/`blockNumber` fields and also include evidence source metadata.
- [x] Add failing tests that payment attestation events and dashboard data show compatible loan ID, amount/currency, state, and evidence source.
- [x] Add failing tests that liquidation evidence includes trigger context, outcome, `USDC` proceeds, and source labels.
- [x] Add failing test that unavailable Fuji mode returns safe pending/unavailable evidence or `WEB3_UNAVAILABLE` without fabricated live hashes.

Validation command:
- `npm test -- --run tests/loan-lifecycle.test.ts tests/payment-attestations.test.ts tests/dashboard-events.test.ts`

#### 3.2 GREEN — evidence types, adapters, store, and routes

Touched files:
- `src/adapters/web3.ts`
- `src/adapters/web3Unavailable.ts` or equivalent
- New `src/evidence/evidence.ts` or `src/domain/evidence.ts`
- `src/store/demoStore.ts`
- `src/modules/loans/routes.ts`
- `src/modules/payments/routes.ts`
- `src/modules/dashboard/routes.ts`
- `src/modules/events/routes.ts`

Tasks:
- [x] Add backward-compatible evidence metadata types with `mode`, `source`, `status`, `label`, optional `txHash`, `blockNumber`, `explorerUrl`, and contract references.
- [x] Update mock adapter outputs to label deterministic hashes as `demo-simulated` only.
- [x] Update unavailable-Fuji adapter outputs/errors to label evidence as `fuji-unavailable` and avoid mock fallback.
- [x] Record additive evidence metadata in events/store records used by dashboard and event feed.
- [x] Preserve canonical endpoint paths and canonical state-machine semantics.

#### 3.3 TRIANGULATE/REFACTOR — edge cases and helper cleanup

Tasks:
- [x] Add a second scenario for payment or liquidation where business state succeeds but live evidence is pending/unavailable.
- [x] Refactor repeated evidence construction into a small helper; keep route handlers focused on canonical state transitions.

Validation commands:
- `npm test -- --run tests/loan-lifecycle.test.ts tests/payment-attestations.test.ts tests/dashboard-events.test.ts tests/openapi-contract-smoke.test.ts`
- `npm run typecheck:api`

---

### 4. PR 4 — Frontend evidence labels and source-gated explorer links

**Estimate:** 300–390 changed lines  
**Start boundary:** frontend runtime mode from PR 2 and backend evidence metadata from PR 3 are available or faked in tests.  
**Finish boundary:** borrower and dashboard surfaces visibly distinguish Fuji live, Fuji unavailable/pending, and simulated demo evidence.  
**Rollback boundary:** revert evidence helper/components and their call sites; runtime route banner remains.

#### 4.1 RED — evidence helper and link-integrity tests

Touched files:
- New `web/src/runtime/evidence.test.ts`
- Existing component tests for borrower/dashboard surfaces
- Discovery targets: `web/src/screens/LoanActivityScreen.tsx`, `web/src/components/EventTimeline.tsx`, `web/src/components/AuditTrail.tsx`, `web/src/components/LoanDetailPanel.tsx`, `web/src/screens/InstitutionalDashboardScreen.tsx`

Tasks:
- [x] Add failing tests for `buildFujiExplorerLink('tx'|'address'|'block', value, evidenceSource)` returning links only for `fuji-live` valid evidence.
- [x] Add failing tests proving simulated mock hashes never become explorer links.
- [x] Add failing component tests for labels: `Fuji live evidence`, `Fuji evidence pending/unavailable`, and `Simulated demo evidence`.

Validation command:
- `npm test -- --run web/src/runtime/evidence.test.ts`

#### 4.2 GREEN — evidence helper components and borrower surfaces

Touched files:
- New `web/src/runtime/evidence.ts`
- New `web/src/components/EvidenceBadge.tsx`
- New `web/src/components/ExplorerLink.tsx`
- `web/src/screens/LoanActivityScreen.tsx`
- `web/src/state/borrowerJourney.ts` if evidence fields need typed propagation

Tasks:
- [x] Implement source-gated explorer link helper and explicit evidence labels.
- [x] Render evidence labels for collateral/activation/receipt/payment/liquidation in borrower activity.
- [x] Adjust mode-specific button/copy:
  - Demo: simulated verbs such as `Record simulated collateral deposit`, `Attest simulated payment`, `Simulate liquidation`.
  - Fuji: Fuji-aware copy such as `Record Fuji collateral evidence`, `Attest payment on Fuji`, `Execute Fuji liquidation`.
- [x] Disable or show configuration-needed guidance for unavailable Fuji actions.

#### 4.3 TRIANGULATE/GREEN — dashboard, audit trail, loan detail, and events

Touched files:
- `web/src/components/EventTimeline.tsx`
- `web/src/components/AuditTrail.tsx`
- `web/src/components/LoanDetailPanel.tsx`
- `web/src/screens/InstitutionalDashboardScreen.tsx`
- Relevant tests under `web/src/components/` and `web/src/screens/`

Tasks:
- [x] Render evidence badges and source-gated explorer links for dashboard portfolio, audit trail, event feed, loan detail, payment, and liquidation contexts.
- [x] Ensure liquidation proceeds display currency as `USDC` and distinguish funding partner, originator fee, and borrower remainder when available.
- [x] Add a live-evidence fixture test with explorer links and a demo-evidence fixture test without links.

#### 4.4 REFACTOR — copy consistency and accessibility

Tasks:
- [x] Centralize repeated label/copy constants in `web/src/runtime/evidence.ts` or a nearby module.
- [x] Keep links accessible with explicit labels such as `View Fuji tx`, `View Fuji contract`, and `View Fuji block`.

Validation commands:
- `npm test -- --run web/src/runtime/evidence.test.ts web/src/screens/InstitutionalDashboardScreen.test.tsx web/src/state/borrowerJourney.test.ts`
- `npm run typecheck:web`
- `npm run build:web`

---

### 5. PR 5 — Demo reset endpoint, reset script, runbook, and repeatability evidence

**Estimate:** 220–340 changed lines  
**Start boundary:** evidence labels and canonical demo flow are present.  
**Finish boundary:** demo can run twice consecutively with reset verification and documented checkpoints.  
**Rollback boundary:** remove reset route/script/docs; existing deterministic seed behavior remains.

#### 5.1 RED — guarded reset and repeatability tests

Touched files:
- New `tests/demo-reset.test.ts`
- New `tests/demo-repeatability.test.ts` or focused additions to lifecycle/dashboard tests
- Discovery targets: `src/store/demoStore.ts`, `data/demo/loans.seed.json`, `docs/demo/demo-flow.md`, `docs/demo/backend-runbook.md`

Tasks:
- [x] Add failing test for `POST /demo/reset` resetting deterministic demo state from `data/demo/loans.seed.json`.
- [x] Add failing test proving reset is unavailable or safe 404/403 in Fuji mode and does not mutate live/Fuji artifacts.
- [x] Add failing two-run repeatability test: run origination/payment/liquidation, reset, run again, and assert stale payment/liquidation evidence is not presented as newly generated.

Validation command:
- `npm test -- --run tests/demo-reset.test.ts tests/demo-repeatability.test.ts`

#### 5.2 GREEN — reset controller and script

Touched files:
- `src/store/demoStore.ts`
- `src/app.ts` or new `src/modules/demoReset/routes.ts`
- New `scripts/demo-reset.mjs`
- `package.json`

Tasks:
- [x] Add `DemoStore.reset(...)` or an equivalent reset controller that rebuilds deterministic store state from seed data.
- [x] Register `POST /demo/reset` only when runtime mode is demo and reset is enabled.
- [x] Return safe reset evidence: mode, timestamp, seed source path, loan count, event count, and simulated/demo label.
- [x] Add `npm run demo:reset -- --base-url <demo-api-url>` script behavior.
- [x] Script must verify `GET /runtime` reports demo mode before reset and verify expected starting state after reset.
- [x] Script must not print secret-bearing environment values.

#### 5.3 TRIANGULATE/REFACTOR — runbook and documentation

Touched files:
- New `docs/demo/e2e-runbook.md`
- Optional updates to `docs/demo/backend-runbook.md` or `docs/demo/demo-flow.md`

Tasks:
- [x] Document two consecutive demo runs: open `/demo`, origination evidence checkpoint, payment evidence checkpoint, liquidation checkpoint, dashboard/audit/detail checks, reset, repeat.
- [x] Document Fuji prerequisites as external/operator-supplied placeholders only; do not include secret values.
- [x] Include expected live vs simulated evidence labels and explorer-link rules.
- [x] Add manual recovery notes only as fallback; script failure remains a Batch 5 blocker unless explicitly de-scoped.

Validation commands:
- `npm test -- --run tests/demo-reset.test.ts tests/demo-repeatability.test.ts`
- `npm run demo:reset -- --base-url <demo-api-url>` against a local demo API during manual verification, if the API is running
- `npm run typecheck:api`

---

### 6. Final integration verification and apply-progress evidence

**Estimate:** 20–80 changed lines, plus bug-fix deltas if validation fails  
**Start boundary:** all chained work units are merged/applied in order.  
**Finish boundary:** all required checks pass or blockers are recorded with scope decisions.  
**Rollback boundary:** revert the smallest failing work unit rather than broad follow-up rewrites.

Touched files:
- `openspec/changes/batch-5-e2e-integration/apply-progress.md`
- Later verify phase: `openspec/changes/batch-5-e2e-integration/verify-report.md`
- Chain copies under `.pi-chain-runs/batch-5-sdd-plan/ba0bf12e/sdd-chain/` if this run continues there

Tasks:
- [x] Record RED/GREEN/TRIANGULATE/REFACTOR evidence for each PR/work unit in apply progress.
- [x] Run full validation:
  - `npm test -- --run`
  - `npm run typecheck`
  - `npm run build`
  - `npm run lint`
- [x] If any Solidity, deploy script, or contract artifact changed, also run:
  - `forge build`
  - `forge test`
- [x] Review diff size per PR/work unit and confirm each is under the 400 changed-lines budget where possible.
- [x] Confirm `/demo` remains reliable and honestly labeled even when Fuji prerequisites are missing.
- [x] Confirm `/` never silently falls back to mock evidence.

## Chained Delivery Decision

Because the forecast is above the 400 changed-lines review budget and spans backend config, adapter composition, API metadata, frontend route state, evidence rendering, reset automation, docs, and tests, apply should pause for a delivery decision before coding.

Recommended decision: approve chained implementation with the five PR/work-unit split above. If a single PR is required, treat it as a size exception and require explicit reviewer approval before apply.

## Memory

Engram save-back was requested, but no memory tools are exposed in this subagent runtime. Significant decisions are persisted in this tasks artifact and should be saved by the parent/orchestrator if memory tools are available there.

## skill_resolution

fallback-registry
