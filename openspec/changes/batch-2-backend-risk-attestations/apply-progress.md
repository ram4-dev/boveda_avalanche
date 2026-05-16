# Apply Progress: batch-2-backend-risk-attestations

## Status

PR 1 / Work Units 1-2 completed on branch `feature/batch-2-pr1-scaffold-read-api`.

Resolved delivery path: `auto-chain / feature-branch-chain`. This slice intentionally stops before Work Units 3-8.

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

## Memory

Callable Engram memory tools were not exposed to this delegated executor, so apply progress was persisted to OpenSpec only.
