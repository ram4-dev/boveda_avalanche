# Proposal: batch-3-borrower-widget

## Status

Proposed.

## Intent

Build the complete Batch 3 borrower-facing widget as a Vite + React + TypeScript frontend for the Bóveda Avalanche demo. The widget should let a judge follow the borrower journey end-to-end: view terms, connect an injected wallet, deposit or simulate collateral, see an active loan and receipt, attest a payment, and observe margin-call/liquidation outcomes against the local Batch 2 API.

## Why

Batch 2 verified the local backend API, risk mock, payment attestation, loan lifecycle, events, and dashboard aggregation. Batch 3 must convert those capabilities into a borrower-visible experience that communicates Bóveda’s core value without technical narration: crypto collateral is locked or simulated through the vault flow, off-chain payments are attested, risk movement is visible, and liquidation proceeds are reported in USDC.

## Scope

### In scope

- Create the minimal Vite + React + TypeScript frontend scaffold needed for the borrower widget if none exists.
- Extend package/test configuration for frontend tests while keeping existing backend tests runnable with `npm test -- --run`.
- Build a quiet, polished data-product UI following the project UI standards:
  - background `#f6f8fb`, surface `#ffffff`, text `#172033`, muted `#647084`, border `#d9e1ec`, accent `#0f766e`, secondary `#2563eb`, warning `#dc2626`, positive `#16a34a`;
  - compact headings, 8px card radius, 6px controls, 12/16/24/32 spacing;
  - useful first screen, no generic purple-blue gradients, decorative blobs, oversized empty cards, raw JSON dumps, or unstable layouts.
- Implement the Batch 3 borrower flow:
  - B3.1 offer/request screen showing principal amount, collateral, LTV, tenor, APR/rate, and liquidation thresholds;
  - B3.2 basic real wallet connection through `window.ethereum` / injected provider when available, displaying the selected borrower address and a safe unavailable-provider state when absent;
  - B3.3 visible collateral deposit action using the canonical local API simulation unless real contract integration is already available behind the backend adapter;
  - B3.4 active loan view showing status, paid installments/payment evidence, current LTV, receipt NFT details, and recent events;
  - B3.5 payment simulation through `POST /loans/{loanId}/payments/attest` with visible attestation hash/event feedback;
  - B3.6 margin-call and liquidation risk view with clear alerting and liquidation outcome/proceeds in USDC.
- Consume the local Batch 2 API as the source of behavior instead of reimplementing backend logic in frontend code.
- Prefer the canonical web3 startup scenario (`WEB3_BRIDGE`, `loan-web3-001`) for the primary demo path while keeping the seeded SME case usable as supporting context if affordable.
- Preserve strict TDD evidence during implementation.

### Out of scope

- Real KYC, fiat rails, payment processor integration, accounting reconciliation, credit bureau, or off-ramp.
- Production-grade wallet/session management, custody, private keys, seed phrases, or secret handling.
- Production Wavy Node, production oracle, real DEX liquidation, or real Avalanche Fuji contract integration beyond what the Batch 2 adapter exposes.
- Rebuilding Batch 2 backend state transitions, risk scoring, attestation hashing, or dashboard aggregation in frontend code.
- Institutional dashboard work from Batch 4 except where a small event/receipt panel helps the borrower story.

## Canonical sources and dependencies

- Project context and strict TDD policy: `openspec/config.yaml`.
- Product scope: `boveda_plan_funcional_tareas_hackathon.md`, Batch 3.
- API source of truth: `docs/demo/openapi.yaml`.
- Demo flow and semantics: `docs/demo/demo-flow.md` and `docs/demo/states-events.md`.
- Demo fixtures: `data/demo/loans.seed.json`.
- Backend operation and canonical paths: `docs/demo/backend-runbook.md`.
- Backend readiness: `openspec/changes/batch-2-backend-risk-attestations/verify-report.md`.
- Existing test/package setup: `package.json`, `vitest.config.ts`, `tsconfig.json`.

The OpenAPI contract is canonical when prose differs. In particular, Batch 3 should use `POST /quotes` and `POST /loans/{loanId}/payments/attest`, not singular or unnested alternatives.

## Affected areas

- Frontend scaffold and app entry points for Vite/React/TypeScript.
- UI components for offer, wallet, collateral deposit, active loan, payment attestation, event feedback, and liquidation risk.
- API client/module for the canonical Batch 2 endpoints:
  - `GET /loans`, `GET /loans/{loanId}`;
  - `POST /quotes`;
  - `POST /risk/wallet`;
  - `POST /loans/{loanId}/collateral/deposit`;
  - `POST /loans/{loanId}/activate` if required to complete the deposit-to-active path;
  - `POST /loans/{loanId}/payments/attest`;
  - `POST /loans/{loanId}/margin-call`;
  - `POST /loans/{loanId}/liquidate`;
  - `GET /events?loanId=...`.
- Wallet provider abstraction around injected `window.ethereum` only.
- Test setup for browser-oriented React tests, likely requiring jsdom/React Testing Library additions, while preserving current Node backend tests.
- Build/typecheck scripts and TypeScript configuration as needed for frontend files.
- OpenSpec artifacts for subsequent spec/design/tasks/apply/verify phases.

## Proposed behavior at a high level

1. The borrower lands on a useful first screen with the current offer/loan context, not a marketing landing page.
2. The widget loads or derives the primary demo loan from the local API and displays terms in business language: principal, collateral, LTV, APR, tenor, risk thresholds, originator, and funding partner.
3. If an injected wallet provider exists, the borrower can request accounts and see the connected address. If not, the UI explains that the demo can continue with simulated backend actions but real wallet connection is unavailable.
4. The borrower can register a collateral deposit against an approved loan using the Batch 2 deposit endpoint; if activation is required to show the active state and receipt, the widget uses the activation endpoint rather than faking local state.
5. The active view displays status, current LTV, outstanding principal, next due date, receipt token details, and traceable events.
6. The borrower can simulate a payment, receive an attestation hash, and see the event/status feedback refresh from the API.
7. The borrower can trigger or view a margin-call scenario and liquidation outcome, with USDC proceeds and distribution clearly shown.

## Testing and TDD expectations

Strict TDD is active. The implementation phase must follow RED, GREEN, TRIANGULATE, REFACTOR and record evidence.

Required command baseline:

```text
npm test -- --run
npm run typecheck
npm run build
npm run lint
```

Expected test coverage in later phases:

- API client tests for canonical endpoint paths and response handling.
- Wallet abstraction tests for injected provider success, rejection, and absence.
- Component tests for the offer, active loan, payment attestation, margin-call, and liquidation states.
- Regression protection that frontend test configuration does not break existing backend Vitest tests.

## Risks

- **Frontend scaffold in backend package:** the repo currently has a Node/Fastify TypeScript setup with Vitest in `node` environment. Adding React/Vite/jsdom could disrupt backend tests if configuration is not isolated carefully.
- **Browser-to-local-API integration:** Vite dev server and the Fastify API may need a proxy or CORS decision; this should be resolved in design without changing canonical public API paths.
- **Mutable in-memory demo state:** the Batch 2 backend mutates seed-backed runtime state. Tests and demo flows need deterministic setup/reset assumptions.
- **Wallet availability:** judges may not have an injected wallet. The unavailable-provider state must be clear and non-blocking for the local API simulation path.
- **Scope size:** complete Batch 3 plus scaffold/test setup may exceed the 700 changed-line review budget; tasks must forecast size and split into chained work units if necessary.
- **Mock-vs-real expectations:** collateral deposit and liquidation remain API-simulated unless Batch 1/real web3 integration is available behind the backend adapter. UI copy must be honest about demo simulation boundaries.

## Rollback plan

- Remove the frontend scaffold, React/Vite dependencies, UI tests, and any frontend-specific TypeScript/Vitest configuration added for this change.
- Restore `package.json`, lockfile, `vitest.config.ts`, and `tsconfig.json` to their pre-Batch-3 state if test/build configuration causes regressions.
- Keep Batch 2 backend artifacts untouched; frontend work must not alter canonical API behavior.
- If a later implementation slice partially lands, disable or remove the widget entry point while preserving backend commands: `npm test -- --run`, `npm run typecheck`, `npm run build`, and `npm run lint`.

## Success criteria

- A judge can complete or understand the borrower journey without prior technical explanation: offer → wallet → collateral deposit/activation → active loan/receipt → payment attestation → margin call/liquidation.
- The widget consumes the local Batch 2 API contract and shows real response data/events rather than hardcoded state transitions.
- Wallet connection uses only an injected provider when available, displays borrower address, and never handles private keys, seed phrases, credentials, or `.env` secrets.
- Liquidation proceeds are always shown in USDC.
- The UI follows the project’s consistent, quiet data-product standards.
- Existing backend tests remain green, and frontend tests cover the core borrower states.
- Required verification commands pass.
- If forecast changed lines exceed 700 or the work becomes high-risk, implementation pauses for a chained work-unit decision before apply.

## Memory / artifact policy

OpenSpec is the authoritative artifact store for this runtime. Engram was requested by policy, but no callable memory tools are available in this executor environment; significant decisions are therefore persisted in OpenSpec artifacts and reported back to the parent for any memory write-back it can perform.
