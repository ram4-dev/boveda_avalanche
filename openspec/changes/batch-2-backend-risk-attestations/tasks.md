# Tasks: Batch 2 Backend Risk Attestations

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2,000-3,000 total including `package-lock.json`; 1,400-2,100 excluding generated lockfile |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 scaffold/health/seed reads → PR 2 quotes/risk/loan lifecycle → PR 3 web3/payment/liquidation → PR 4 dashboard/events/contract smoke/docs |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

**700-line review budget assessment:** the full Batch 2 backend almost certainly exceeds 700 changed lines. Use chained PRs. Keep each PR under ~700 reviewable changed lines excluding generated `package-lock.json`; treat the lockfile as a generated-size exception in PR 1 if needed.

## Strict TDD Evidence Protocol

For every work unit below, record evidence in `openspec/changes/batch-2-backend-risk-attestations/apply-progress.md` before moving on:

- **RED:** add or update the focused test first; run the targeted command; capture the failing assertion or compile error.
- **GREEN:** implement the smallest production change; rerun the targeted command; capture passing output.
- **TRIANGULATE:** add at least one adjacent/edge scenario for the same behavior; confirm it fails before the fix when practical, then pass.
- **REFACTOR:** clean names/boundaries without behavior changes; rerun relevant tests plus `npm run typecheck` for code-bearing slices.

Planned commands after scaffold exists:

```bash
npm test -- --run
npm run typecheck
npm run build
npm run lint
```

Use targeted Vitest file commands during RED/GREEN, for example `npm test -- --run tests/health.test.ts`.

## Dependency-Ordered Work Units

### 0. Delivery gate before apply

- [x] Confirm chained-PR delivery strategy with the reviewer before implementation because forecast exceeds the 700-line budget.
  - Files/artifacts: `openspec/changes/batch-2-backend-risk-attestations/tasks.md`, future `apply-progress.md`.
  - Finish: approved chain strategy or explicit size exception is recorded.
  - Verification: no code changes start before approval.
  - Rollback: no-op; remain at planning phase.

### PR 1 / Work Unit 1 — Tooling scaffold and health route

- [x] RED: create initial Vitest/Fastify test infrastructure and a failing health test.
  - Files: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `tests/health.test.ts`.
  - Test command: `npm test -- --run tests/health.test.ts`.
  - Expected RED: missing `src/app.ts`/route or failing `HealthResponse` fields.
- [x] GREEN: implement minimal app/entrypoint and health route.
  - Files: `src/app.ts`, `src/index.ts`, `src/modules/health/routes.ts`.
  - Finish: `GET /health` returns `ok`, `service`, and `version` per `docs/demo/openapi.yaml`.
- [x] TRIANGULATE: add a second assertion for content type/status stability and Fastify readiness.
- [x] REFACTOR: keep `buildFastifyApp(deps)` boundary ready for injected store/adapters.
  - Verification: `npm test -- --run tests/health.test.ts`, `npm run typecheck`, `npm run build`, `npm run lint`.
  - Rollback boundary: remove scaffold files from this unit only.

### PR 1 / Work Unit 2 — Seed loader, in-memory store, seed events, read APIs

- [x] RED: add tests for seeded loan reads and seed-derived events.
  - Files: `tests/seed-read-api.test.ts`.
  - Target behavior: `GET /loans` includes `loan-web3-001` and `loan-sme-001`; `GET /loans?scenario=WEB3_BRIDGE&status=Active` filters; `GET /loans/loan-web3-001` works; `GET /events` contains canonical seed events.
  - Test command: `npm test -- --run tests/seed-read-api.test.ts`.
- [x] GREEN: implement domain types, seed loading, store, seed events, and read routes.
  - Files: `src/domain/types.ts`, `src/store/seedLoader.ts`, `src/store/demoStore.ts`, `src/store/seedEvents.ts`, `src/modules/loans/routes.ts`, `src/modules/events/routes.ts`, `src/api/errors.ts`, `src/api/schemas.ts`.
  - Finish: seeded state loads from `data/demo/loans.seed.json`; no hard-coded replacement of seed data in route handlers.
- [x] TRIANGULATE: add not-found and invalid filter tests.
- [x] REFACTOR: centralize event append/list helpers and canonical enum typing.
  - Verification: targeted test, `npm test -- --run`, `npm run typecheck`.
  - Rollback boundary: revert store/read route files; PR 1 health route remains independently usable.

### PR 2 / Work Unit 3 — Deterministic quotes and Wavy Node risk mock

- [x] RED: add quote and wallet-risk tests.
  - Files: `tests/quotes-risk.test.ts`.
  - Target behavior: reproducible `POST /quotes`; scenario constants; `liquidationCurrency = USDC`; stable `assessmentHash`; changed input changes risk result.
  - Test command: `npm test -- --run tests/quotes-risk.test.ts`.
- [x] GREEN: implement deterministic money/hash utilities, quote engine, risk engine, Wavy adapter, and routes.
  - Files: `src/config/demoConfig.ts`, `src/domain/money.ts`, `src/domain/canonicalJson.ts`, `src/domain/hashing.ts`, `src/domain/quoteEngine.ts`, `src/domain/riskEngine.ts`, `src/adapters/wavyNode.ts`, `src/modules/quotes/routes.ts`, `src/modules/risk/routes.ts`.
  - Finish: `POST /quotes` and `POST /risk/wallet` conform to OpenAPI success shapes and store accepted risk assessments.
- [x] TRIANGULATE: add SME scenario and AML non-PASS/review-list test case through injected config.
- [x] REFACTOR: keep route handlers thin; no external Wavy connectivity required.
  - Verification: targeted test, prior PR 1 tests, `npm run typecheck`.
  - Rollback boundary: remove quote/risk modules without affecting read APIs.

### PR 2 / Work Unit 4 — Loan creation and core lifecycle through activation

- [x] RED: add lifecycle integration tests for create → approve → deposit → activate and invalid transitions.
  - Files: `tests/loan-lifecycle.test.ts`.
  - Target behavior: `POST /loans` creates `Requested` with `LoanCreated`; approve records `LoanApproved`; deposit records collateral tx and keeps `Approved`; activate requires deposit/vault and records `LoanActivated` plus receipt when applicable; invalid transition preserves loan/events.
  - Test command: `npm test -- --run tests/loan-lifecycle.test.ts`.
- [x] GREEN: implement state machine and lifecycle write routes.
  - Files: `src/domain/stateMachine.ts`, `src/modules/loans/routes.ts`, `src/store/demoStore.ts`, `src/adapters/web3.ts`.
  - Finish: core transitions follow `docs/demo/states-events.md`; receipt is `soulbound = true` in mock activation.
- [x] TRIANGULATE: add terminal state safety tests for `Repaid`, `Liquidated`, and `Cancelled` fixtures/states.
- [x] REFACTOR: make `DemoStore.mutateLoan` atomic: validate/prepare/call adapter/commit.
  - Verification: lifecycle test, seed/read tests, quote/risk tests, `npm run typecheck`.
  - Rollback boundary: revert lifecycle mutations while preserving PR 1 and quote/risk reads.

### PR 3 / Work Unit 5 — Payment attestation hashing and idempotency

- [x] RED: add payment attestation tests.
  - Files: `tests/payment-attestations.test.ts`.
  - Target behavior: canonical `POST /loans/{loanId}/payments/attest`; deterministic hash; identical retry is idempotent; partial payment remains `Active`; final payment becomes `Repaid`; terminal loan rejects without mutation.
  - Test command: `npm test -- --run tests/payment-attestations.test.ts`.
- [x] GREEN: implement canonical payment payload, hash generation, web3 registration call, outstanding principal update, attestation storage, and `InstallmentPaid` events.
  - Files: `src/domain/paymentAttestations.ts`, `src/modules/payments/routes.ts`, `src/adapters/web3.ts`, `src/store/demoStore.ts`, `src/domain/money.ts`.
  - Finish: response includes `loanId`, `installmentId`, `amount`, `currency`, `attestationHash`, `remainingPrincipal`, and resulting `status`.
- [x] TRIANGULATE: add changed-evidence hash-difference and currency mismatch tests.
- [x] REFACTOR: keep idempotency check before principal decrement and event append.
  - Verification: payment tests, lifecycle tests, `npm run typecheck`.
  - Rollback boundary: remove payment route/module and attestation store additions.

### PR 3 / Work Unit 6 — Margin call, liquidation, and web3 failure safety

- [x] RED: add margin-call/liquidation/failure tests.
  - Files: `tests/liquidation-web3-failure.test.ts`.
  - Target behavior: margin call requires active loan and threshold LTV; liquidation requires `MarginCall` or `Defaulted`; liquidation proceeds are always `USDC`; mock liquidation records canonical event; injected adapter failure preserves state/events.
  - Test command: `npm test -- --run tests/liquidation-web3-failure.test.ts`.
- [x] GREEN: implement margin-call and liquidation route behavior through mock web3 adapter.
  - Files: `src/modules/loans/routes.ts`, `src/adapters/web3.ts`, `src/domain/stateMachine.ts`, `src/store/demoStore.ts`.
  - Finish: `POST /loans/{loanId}/margin-call` and `POST /loans/{loanId}/liquidate` satisfy specs and use USDC constant.
- [x] TRIANGULATE: add rejection tests for non-USDC proceeds and terminal double-liquidation.
- [x] REFACTOR: centralize adapter outcome handling and error codes.
  - Verification: targeted test, payment tests, lifecycle tests, `npm run typecheck`.
  - Rollback boundary: revert margin/liquidation endpoints while leaving activation/payment adapter methods intact.

### PR 4 / Work Unit 7 — Dashboard aggregation and event filtering refresh path

- [x] RED: add dashboard/events tests.
  - Files: `tests/dashboard-events.test.ts`.
  - Target behavior: `GET /events?loanId=...` filters; `GET /dashboard/summary` derives active principal, vault count, weighted LTV, margin-call count, payment/liquidation counters, exposure by asset, and latest 10 events from current loans/events.
  - Test command: `npm test -- --run tests/dashboard-events.test.ts`.
- [x] GREEN: implement dashboard aggregation and request-driven/manual refresh hook without adding public non-OpenAPI endpoints.
  - Files: `src/domain/dashboard.ts`, `src/modules/dashboard/routes.ts`, `src/modules/events/routes.ts`, `src/app.ts`, `src/adapters/web3.ts`.
  - Finish: dashboard metrics are explainable from seeded/current state and recorded events.
- [x] TRIANGULATE: add tests showing payment and liquidation update counters/recent events.
- [x] REFACTOR: keep aggregation pure and deterministic for unit testing.
  - Verification: dashboard tests, full `npm test -- --run`, `npm run typecheck`.
  - Rollback boundary: remove dashboard route/domain; event list route remains from PR 1.

### PR 4 / Work Unit 8 — OpenAPI contract smoke, docs, and final hardening

- [x] RED: add contract smoke tests for every canonical public path.
  - Files: `tests/openapi-contract-smoke.test.ts`.
  - Target paths: `GET /health`, `POST /quotes`, `POST /risk/wallet`, `GET /loans`, `POST /loans`, `GET /loans/{loanId}`, `POST /loans/{loanId}/approve`, `POST /loans/{loanId}/collateral/deposit`, `POST /loans/{loanId}/activate`, `POST /loans/{loanId}/payments/attest`, `POST /loans/{loanId}/margin-call`, `POST /loans/{loanId}/liquidate`, `GET /dashboard/summary`, `GET /events`.
  - Test command: `npm test -- --run tests/openapi-contract-smoke.test.ts`.
- [x] GREEN: tighten schemas/errors and route registration gaps.
  - Files: `src/api/schemas.ts`, `src/api/errors.ts`, route modules under `src/modules/**/routes.ts`, `src/app.ts`.
  - Finish: representative success payloads align with `docs/demo/openapi.yaml`; singular/unnested alternatives are not required for the canonical flow.
- [x] TRIANGULATE: add enum/path negative tests for unknown statuses/scenarios and not-found loans.
- [x] REFACTOR: update local run instructions and final code cleanup.
  - Files: `README.md` or `docs/demo/backend-runbook.md`.
  - Verification: `npm test -- --run`, `npm run typecheck`, `npm run build`, `npm run lint`.
  - Rollback boundary: revert docs/schema smoke hardening only; functional PRs remain intact.

## Final Verification Checklist

- [x] All accepted specs under `openspec/changes/batch-2-backend-risk-attestations/specs/**/spec.md` have passing test evidence.
- [x] `openspec/changes/batch-2-backend-risk-attestations/apply-progress.md` contains RED/GREEN/TRIANGULATE/REFACTOR evidence for every work unit.
- [x] Full commands pass: `npm test -- --run`, `npm run typecheck`, `npm run build`, `npm run lint`.
- [x] No real Wavy, RPC, ABI, contract address, private key, or secret dependency is required for local demo success.
- [x] Liquidation previews/results/events report proceeds in `USDC`.
- [x] Dashboard values are derived from loans/events, not unrelated hard-coded summaries.
- [x] `openspec/changes/batch-2-backend-risk-attestations/verify-report.md` is prepared during verify with command outputs and spec coverage notes.
