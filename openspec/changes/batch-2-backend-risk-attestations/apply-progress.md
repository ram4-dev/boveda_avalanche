# Apply Progress: batch-2-backend-risk-attestations

## Status

PR 1 / Work Units 1-2 completed on branch `feature/batch-2-pr1-scaffold-read-api`.

PR 2 / Work Units 3-4 completed on branch `feature/batch-2-pr2-quotes-lifecycle`.

PR 3 / Work Units 5-6 completed on branch `feature/batch-2-pr3-payments-liquidation`.

Resolved delivery path: `auto-chain / feature-branch-chain`. PR 3 intentionally stops before Work Units 7-8.

## Completed Tasks

- [x] Delivery gate recorded: chained work-unit delivery approved before apply.
- [x] Work Unit 1 RED: wrote initial Vitest/Fastify health test before production app code.
- [x] Work Unit 1 GREEN: implemented Fastify scaffold, process entrypoint, and `GET /health`.
- [x] Work Unit 1 TRIANGULATE: added readiness/content-type assertion.
- [x] Work Unit 1 REFACTOR: kept `buildFastifyApp(deps)` dependency boundary for later adapters/store injection.
- [x] Work Unit 2 RED: wrote seeded loan read/event tests before loan/event routes existed.
- [x] Work Unit 2 GREEN: implemented seed loader, in-memory store, canonical seed events, `GET /loans`, `GET /loans/{loanId}`, and `GET /events`.
- [x] Work Unit 2 TRIANGULATE: added not-found and invalid-filter tests.
- [x] Work Unit 2 REFACTOR: centralized canonical enum values and store event/loan list helpers.

## Files Changed

- `.gitignore`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vitest.config.ts`
- `tests/health.test.ts`
- `tests/seed-read-api.test.ts`
- `src/app.ts`
- `src/index.ts`
- `src/api/errors.ts`
- `src/api/schemas.ts`
- `src/domain/types.ts`
- `src/modules/events/routes.ts`
- `src/modules/health/routes.ts`
- `src/modules/loans/routes.ts`
- `src/store/demoStore.ts`
- `src/store/seedEvents.ts`
- `src/store/seedLoader.ts`
- `openspec/changes/batch-2-backend-risk-attestations/tasks.md`
- `openspec/changes/batch-2-backend-risk-attestations/apply-progress.md`

## TDD Cycle Evidence

| Work Unit | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| WU1 Tooling scaffold + health | `tests/health.test.ts` | Integration (Fastify inject) | N/A (new scaffold) | ✅ `npm test -- --run tests/health.test.ts` failed: missing `../src/app.js` | ✅ health route passed with canonical `{ ok, service, version }` | ✅ added route readiness and JSON content-type assertion; 2 tests passed | ✅ `buildFastifyApp(deps)` boundary preserved; targeted tests, typecheck, build, lint passed |
| WU2 Seed loader/store/read APIs | `tests/seed-read-api.test.ts` | Integration (Fastify inject) | ✅ WU1 health tests passed before WU2 production changes | ✅ `npm test -- --run tests/seed-read-api.test.ts` failed: `GET /loans` returned 404 | ✅ seeded loans, filter, detail, and canonical seed events passed | ✅ added missing-loan 404 plus invalid scenario/status filter tests; 3 tests passed | ✅ enum validation and read/event helpers centralized; full tests/typecheck/build/lint passed |

## Test Commands Run

- `npm install` → failed because npm attempted private Fury registry (`403 Forbidden` for `@types/node`).
- `npm install --registry=https://registry.npmjs.org` → passed; generated `package-lock.json`.
- `npm test -- --run tests/health.test.ts` → RED failed with missing `../src/app.js`.
- `npm test -- --run tests/health.test.ts` → GREEN passed, 1 test.
- `npm test -- --run tests/health.test.ts && npm run typecheck && npm run build && npm run lint` → passed after WU1 triangulation/refactor, 2 tests.
- `npm test -- --run tests/seed-read-api.test.ts` → RED failed with `GET /loans` 404.
- `npm test -- --run tests/seed-read-api.test.ts` → GREEN passed, 1 test.
- `npm test -- --run tests/seed-read-api.test.ts` → TRIANGULATE passed, 3 tests.
- `npm test -- --run` → passed, 2 files / 5 tests.
- `npm run typecheck` → passed.
- `npm run build` → passed.
- `npm run lint` → passed (`tsc --noEmit --pretty false`).

## Verification Evidence

Final verification for this slice:

```text
npm test -- --run
Test Files  2 passed (2)
Tests       5 passed (5)

npm run typecheck
passed

npm run build
passed

npm run lint
passed
```

## Deviations From Design

- `npm install` required explicit `--registry=https://registry.npmjs.org` because the local npm config tried a private Fury registry and returned 403. No secrets were read or printed.
- `npm run lint` is currently a TypeScript static check (`tsc --noEmit --pretty false`) to keep PR 1 lightweight. A dedicated ESLint setup can be added in a later hardening slice if desired.
- The app root is repo root as designed. Build output is ignored via `.gitignore`.

## Workload / PR Boundary

- PR boundary: `feature/batch-2-pr1-scaffold-read-api` contains only PR 1 / Work Units 1-2.
- Implemented reviewable source/test/config lines excluding generated `package-lock.json`: approximately 661 lines before this progress file.
- Generated `package-lock.json`: 2,787 lines and should be treated as generated lockfile size exception for PR 1.
- Work Units 3-8 were not implemented.

## Remaining Tasks

- PR 2 / Work Unit 3: deterministic quotes and Wavy Node risk mock.
- PR 2 / Work Unit 4: loan creation and core lifecycle through activation.
- PR 3 / Work Unit 5: payment attestation hashing and idempotency.
- PR 3 / Work Unit 6: margin call, liquidation, and web3 failure safety.
- PR 4 / Work Unit 7: dashboard aggregation and event filtering refresh path.
- PR 4 / Work Unit 8: OpenAPI contract smoke, docs, and final hardening.

## PR 2 / Work Units 3-4 Update

### Completed Tasks

- [x] Work Unit 3 RED: wrote quote and Wavy wallet risk API tests before `/quotes`, `/risk/wallet`, Wavy adapter, quote engine, risk engine, and hashing utilities existed.
- [x] Work Unit 3 GREEN: implemented deterministic scenario quote calculation, canonical JSON/SHA-256 hashing, Wavy Node mock adapter, risk storage, and quote/risk routes.
- [x] Work Unit 3 TRIANGULATE: added SME cap-by-collateral quote coverage and injected Wavy review-list coverage.
- [x] Work Unit 3 REFACTOR: kept route handlers thin and moved deterministic logic to pure domain utilities/adapters.
- [x] Work Unit 4 RED: wrote loan creation and lifecycle integration tests before mutation routes existed.
- [x] Work Unit 4 GREEN: implemented loan creation, accepted-risk validation, approve, collateral deposit, activation through mock web3, and event recording.
- [x] Work Unit 4 TRIANGULATE: added invalid transition preservation and terminal-state safety tests for `Repaid`, `Liquidated`, and `Cancelled` loans.
- [x] Work Unit 4 REFACTOR: centralized state-transition checks, deterministic IDs/hashes, mock adapter boundary, and store mutation helpers. Route-level validation still performs prepare/adapter/commit sequencing for this slice.

### Files Changed In PR 2

- `openspec/changes/batch-2-backend-risk-attestations/tasks.md`
- `openspec/changes/batch-2-backend-risk-attestations/apply-progress.md`
- `tests/quotes-risk.test.ts`
- `tests/loan-lifecycle.test.ts`
- `src/config/demoConfig.ts`
- `src/domain/money.ts`
- `src/domain/canonicalJson.ts`
- `src/domain/hashing.ts`
- `src/domain/quoteEngine.ts`
- `src/domain/riskEngine.ts`
- `src/domain/stateMachine.ts`
- `src/adapters/wavyNode.ts`
- `src/adapters/web3.ts`
- `src/modules/quotes/routes.ts`
- `src/modules/risk/routes.ts`
- `src/modules/loans/routes.ts`
- `src/store/demoStore.ts`
- `src/app.ts`
- `src/domain/types.ts`
- `src/api/errors.ts`

### TDD Cycle Evidence — PR 2

| Work Unit | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| WU3 Quotes + Wavy risk mock | `tests/quotes-risk.test.ts` | Integration (Fastify inject) | ✅ `npm test -- --run tests/health.test.ts tests/seed-read-api.test.ts` passed: 2 files / 5 tests | ✅ `npm test -- --run tests/quotes-risk.test.ts` failed: missing `../src/adapters/wavyNode.js` | ✅ `npm test -- --run tests/quotes-risk.test.ts` passed: 4 tests after quote/risk modules and routes | ✅ SME collateral cap and Wavy review-list scenarios passed in same focused test file | ✅ route handlers remained thin; pure utilities extracted; PR1 tests + WU3 tests and `npm run typecheck` passed |
| WU4 Loan creation + activation lifecycle | `tests/loan-lifecycle.test.ts` | Integration (Fastify inject) | ✅ WU3 + PR1 tests passed before lifecycle production changes | ✅ `npm test -- --run tests/loan-lifecycle.test.ts` failed: lifecycle routes returned 404 | ✅ `npm test -- --run tests/loan-lifecycle.test.ts` passed: 4 tests after mutation routes/store/web3 adapter | ✅ invalid transition preservation plus terminal `Repaid`/`Liquidated`/`Cancelled` safety covered | ✅ state machine and mock web3 boundaries extracted; lifecycle + seed/read + quote/risk tests and `npm run typecheck` passed |

### Test Commands Run For PR 2

- `npm test -- --run tests/health.test.ts tests/seed-read-api.test.ts` → passed, 2 files / 5 tests (safety net).
- `npm test -- --run tests/quotes-risk.test.ts` → RED failed with missing `../src/adapters/wavyNode.js`.
- `npm test -- --run tests/quotes-risk.test.ts` → GREEN/TRIANGULATE passed, 4 tests.
- `npm test -- --run tests/quotes-risk.test.ts tests/health.test.ts tests/seed-read-api.test.ts && npm run typecheck` → passed.
- `npm test -- --run tests/loan-lifecycle.test.ts` → RED failed with lifecycle routes returning 404.
- `npm test -- --run tests/loan-lifecycle.test.ts` → GREEN/TRIANGULATE passed, 4 tests.
- `npm test -- --run tests/loan-lifecycle.test.ts tests/seed-read-api.test.ts tests/quotes-risk.test.ts && npm run typecheck` → passed.
- `npm test -- --run` → passed, 4 files / 13 tests.
- `npm run typecheck` → passed.
- `npm run build` → passed.
- `npm run lint` → passed (`tsc --noEmit --pretty false`).

### Verification Evidence — PR 2

```text
npm test -- --run
Test Files  4 passed (4)
Tests       13 passed (13)

npm run typecheck
passed

npm run build
passed

npm run lint
passed
```

### Deviations From Design — PR 2

- `DemoStore` exposes explicit `createLoan`, `replaceLoan`, and `appendEvent` helpers rather than a single named `mutateLoan` API. The route flow still follows the designed safety sequence: validate, prepare next state/events, call adapter where required, then commit only on success.
- `POST /loans` derives liquidation preview from principal with zero fees for this slice; richer liquidation math remains in Work Unit 6.
- `POST /loans/{loanId}/activate` always emits `ReceiptIssued` after successful mock activation because the mock adapter always returns receipt data.

### Workload / PR Boundary — PR 2

- PR boundary: `feature/batch-2-pr2-quotes-lifecycle` contains only PR 2 / Work Units 3-4 on top of committed PR 1 (`79afb76`).
- Work Units 5-8 were not implemented.
- Reviewable PR 2 source/test changes are roughly ~1,000 lines excluding this progress update; this exceeds the original 700-line preference, but remains within the user-approved chained PR delivery path for the assigned PR 2 scope.

### Remaining Tasks After PR 2

- PR 3 / Work Unit 5: payment attestation hashing and idempotency.
- PR 3 / Work Unit 6: margin call, liquidation, and web3 failure safety.
- PR 4 / Work Unit 7: dashboard aggregation and event filtering refresh path.
- PR 4 / Work Unit 8: OpenAPI contract smoke, docs, and final hardening.

## Fresh Review Blocker Fix — PR 2 Missing POST Bodies

### Completed Tasks

- [x] RED: added focused Fastify inject coverage for missing request bodies on PR2 POST endpoints that were returning runtime 500s.
- [x] GREEN: guarded unknown/undefined request bodies before property access and returned canonical `INVALID_REQUEST` validation errors.
- [x] TRIANGULATE: added empty JSON body coverage, including `POST /loans/{loanId}/approve` requiring canonical `approvedBy` instead of silently approving.
- [x] REFACTOR: centralized reusable request-body validation helpers in `src/api/errors.ts` and kept scope limited to PR2 endpoints; Work Units 5-8 were not implemented.

### Files Changed For Blocker Fix

- `tests/quotes-risk.test.ts`
- `tests/loan-lifecycle.test.ts`
- `src/api/errors.ts`
- `src/modules/quotes/routes.ts`
- `src/modules/risk/routes.ts`
- `src/modules/loans/routes.ts`
- `openspec/changes/batch-2-backend-risk-attestations/apply-progress.md`

### TDD Cycle Evidence — Fresh Review Blocker

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR2 missing POST body validation blocker | `tests/quotes-risk.test.ts`, `tests/loan-lifecycle.test.ts` | Integration (Fastify inject) | ✅ `npm test -- --run tests/quotes-risk.test.ts tests/loan-lifecycle.test.ts` passed before blocker changes: 2 files / 8 tests | ✅ Focused tests failed with 500 for missing bodies on `/quotes` and `/loans`; triangulation later failed with 200 for empty approve body | ✅ Missing-body cases returned 400 canonical `INVALID_REQUEST` after body guards | ✅ Empty-body cases covered `/quotes`, `/risk/wallet`, `/loans/{loanId}/approve`, and `/loans/{loanId}/collateral/deposit`; approve now requires canonical `approvedBy` | ✅ Reusable helpers `hasJsonObjectBody` and `sendInvalidRequestBody` extracted; focused and full verification stayed green |

### Test Commands Run For Blocker Fix

- `npm test -- --run tests/quotes-risk.test.ts tests/loan-lifecycle.test.ts` → safety net passed, 2 files / 8 tests.
- `npm test -- --run tests/quotes-risk.test.ts tests/loan-lifecycle.test.ts` → RED failed: missing body assertions received `500` instead of `400`.
- `npm test -- --run tests/quotes-risk.test.ts tests/loan-lifecycle.test.ts` → TRIANGULATE RED failed: empty approve body returned `200` instead of `400`.
- `npm test -- --run tests/quotes-risk.test.ts tests/loan-lifecycle.test.ts` → GREEN passed, 2 files / 10 tests.
- `npm test -- --run` → passed, 4 files / 15 tests.
- `npm run typecheck` → passed.
- `npm run build` → passed.
- `npm run lint` → passed (`tsc --noEmit --pretty false`).

### Verification Evidence — Blocker Fix

```text
npm test -- --run
Test Files  4 passed (4)
Tests       15 passed (15)

npm run typecheck
passed

npm run build
passed

npm run lint
passed
```

### Deviations / Scope Control — Blocker Fix

- No Work Units 5-8 endpoints or behavior were implemented.
- The fix only changes PR2 endpoint validation behavior for request-body safety.
- `POST /loans/{loanId}/approve` now rejects an empty JSON body because `approvedBy` is required by the canonical OpenAPI `ApproveLoanRequest` schema.
- Missing-body validation consistently returns `400` with `{ error: { code: 'INVALID_REQUEST', message: 'Request body must be a JSON object' } }`.

### Workload / PR Boundary — Blocker Fix

- PR boundary remains `feature/batch-2-pr2-quotes-lifecycle`.
- This is a blocker-only patch on top of PR2 / Work Units 3-4.
- Remaining tasks are unchanged: PR3 Work Units 5-6 and PR4 Work Units 7-8.

## Memory

Callable Engram memory tools were not exposed to this delegated executor, so apply progress was persisted to OpenSpec only.

## PR 3 / Work Units 5-6 Update

### Completed Tasks

- [x] Work Unit 5 RED: wrote payment attestation integration tests before `/loans/{loanId}/payments/attest`, payment hashing domain code, payment store records, and web3 payment registration existed.
- [x] Work Unit 5 GREEN: implemented canonical payment payload serialization, SHA-256 attestation hashes, mock web3 payment registration, outstanding-principal updates, idempotent retry detection, and `InstallmentPaid` events.
- [x] Work Unit 5 TRIANGULATE: covered final payment to `Repaid`, partial payment preserving `MarginCall`, changed-evidence hash differences, currency mismatch rejection, and terminal-loan rejection without mutation.
- [x] Work Unit 5 REFACTOR: kept canonical payload/hash logic in `src/domain/paymentAttestations.ts`, decimal helpers in `src/domain/money.ts`, and idempotency before principal/event mutation.
- [x] Work Unit 6 RED: wrote margin-call/liquidation/failure integration tests before `/margin-call`, `/liquidate`, and web3 liquidation behavior existed.
- [x] Work Unit 6 GREEN: implemented margin-call threshold validation, liquidation eligibility checks, USDC-only liquidation, mock web3 liquidation outcomes, `Liquidated` events, and adapter failure preservation.
- [x] Work Unit 6 TRIANGULATE: covered below-threshold rejection, Active-loan liquidation rejection, successful MarginCall -> Liquidated, non-USDC rejection, double liquidation rejection, and injected web3 failure.
- [x] Work Unit 6 REFACTOR: centralized payment routes in a dedicated module, added adapter outcome methods, and reused existing API error helpers while limiting scope to PR3 endpoints.

### Files Changed In PR 3

- `openspec/changes/batch-2-backend-risk-attestations/tasks.md`
- `openspec/changes/batch-2-backend-risk-attestations/apply-progress.md`
- `tests/payment-attestations.test.ts`
- `tests/liquidation-web3-failure.test.ts`
- `src/domain/paymentAttestations.ts`
- `src/domain/money.ts`
- `src/modules/payments/routes.ts`
- `src/modules/loans/routes.ts`
- `src/adapters/web3.ts`
- `src/store/demoStore.ts`
- `src/app.ts`
- `src/api/errors.ts`

### TDD Cycle Evidence — PR 3

| Work Unit | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| WU5 Payment attestation hashing and idempotency | `tests/payment-attestations.test.ts` | Integration (Fastify inject) | ✅ `npm test -- --run tests/loan-lifecycle.test.ts tests/seed-read-api.test.ts && npm run typecheck` passed: 2 files / 8 tests plus typecheck | ✅ `npm test -- --run tests/payment-attestations.test.ts` failed: canonical payment endpoint returned 404 | ✅ `npm test -- --run tests/payment-attestations.test.ts` passed: 3 tests after payment route/domain/store/web3 registration implementation | ✅ partial payment + idempotent retry, final repayment, MarginCall partial preservation, hash-difference, currency mismatch, and terminal rejection all covered | ✅ focused payment + lifecycle tests passed and `npm run typecheck` passed after extracting payload/hash and decimal helpers |
| WU6 Margin call, liquidation, and web3 failure safety | `tests/liquidation-web3-failure.test.ts` | Integration (Fastify inject) | ✅ `npm test -- --run tests/payment-attestations.test.ts tests/loan-lifecycle.test.ts && npm run typecheck` passed after WU5 | ✅ `npm test -- --run tests/liquidation-web3-failure.test.ts` failed: margin-call/liquidate endpoints returned 404 | ✅ `npm test -- --run tests/liquidation-web3-failure.test.ts` passed: 3 tests after margin-call/liquidation routes and adapter method | ✅ below-threshold, Active-loan liquidation, successful liquidation, non-USDC, double liquidation, and injected adapter failure paths covered | ✅ PR3 focused tests plus lifecycle tests and `npm run typecheck` passed after web3 outcome/error handling cleanup |

### Test Commands Run For PR 3

- `npm test -- --run tests/loan-lifecycle.test.ts tests/seed-read-api.test.ts && npm run typecheck` → safety net passed, 2 files / 8 tests plus typecheck.
- `npm test -- --run tests/payment-attestations.test.ts` → RED failed with endpoint 404.
- `npm test -- --run tests/payment-attestations.test.ts` → GREEN/TRIANGULATE passed, 3 tests.
- `npm test -- --run tests/payment-attestations.test.ts tests/loan-lifecycle.test.ts && npm run typecheck` → first typecheck exposed a `PaymentAttestation.status` narrowing issue; fixed during GREEN cleanup.
- `npm test -- --run tests/payment-attestations.test.ts tests/loan-lifecycle.test.ts && npm run typecheck` → passed, 2 files / 8 tests plus typecheck.
- `npm test -- --run tests/liquidation-web3-failure.test.ts` → RED failed with margin-call/liquidate endpoints 404.
- `npm test -- --run tests/liquidation-web3-failure.test.ts` → GREEN/TRIANGULATE passed, 3 tests.
- `npm test -- --run tests/liquidation-web3-failure.test.ts tests/payment-attestations.test.ts tests/loan-lifecycle.test.ts && npm run typecheck` → passed, 3 files / 11 tests plus typecheck.

### Verification Evidence — PR 3

```text
npm test -- --run tests/payment-attestations.test.ts
Test Files  1 passed (1)
Tests       3 passed (3)

npm test -- --run tests/liquidation-web3-failure.test.ts
Test Files  1 passed (1)
Tests       3 passed (3)

npm test -- --run
Test Files  6 passed (6)
Tests       21 passed (21)

npm run typecheck
passed

npm run build
passed

npm run lint
passed
```

### Deviations From Design — PR 3

- `DemoStore` continues the PR2 explicit helper style (`replaceLoan`, `appendEvent`, `savePaymentAttestation`, `findPaymentAttestation`) instead of introducing a new generic `mutateLoan` abstraction mid-slice.
- Payment and liquidation web3 adapter failures are modeled as thrown exceptions from the injected adapter in tests; the default mock adapter remains deterministic and successful.
- Dashboard aggregation and OpenAPI smoke/docs were intentionally not implemented; they remain PR4 / Work Units 7-8.

### Workload / PR Boundary — PR 3

- PR boundary: `feature/batch-2-pr3-payments-liquidation` contains only PR 3 / Work Units 5-6 on top of committed PR 2 (`f3f9004`).
- Work Units 7-8 were not implemented.
- Reviewable PR3 source/test changes are focused on payment attestations, margin calls, liquidation, web3 adapter methods, and OpenSpec progress/tasks.

### Remaining Tasks After PR 3

- PR 4 / Work Unit 7: dashboard aggregation and event filtering refresh path.
- PR 4 / Work Unit 8: OpenAPI contract smoke, docs, and final hardening.
