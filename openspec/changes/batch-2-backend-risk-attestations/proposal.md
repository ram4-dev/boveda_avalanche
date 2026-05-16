# Change Proposal: Batch 2 Backend Risk Attestations

## Intent

Implement Batch 2 of the Bóveda Avalanche hackathon demo as a Node.js + TypeScript + Fastify backend that exposes the canonical demo API, coordinates risk and loan lifecycle behavior, produces payment attestations, and feeds the institutional dashboard.

The backend must make the Batch 0 demo contract executable for frontends while remaining mock-first for external dependencies. It should complete or consistently simulate the minimum flow from quote through wallet risk, loan creation, approval, collateral deposit, activation, payment attestation, margin call, liquidation, dashboard aggregation, and event listing.

## Source of Truth

- Project context: `openspec/config.yaml`
- Product scope: `boveda_plan_funcional_tareas_hackathon.md` — Batch 2
- Canonical API contract: `docs/demo/openapi.yaml`
- Demo sequence and non-goals: `docs/demo/demo-flow.md`
- State transitions and event semantics: `docs/demo/states-events.md`
- Deterministic fixture data: `data/demo/loans.seed.json`
- Exploration handoff, if present: `context.md`

When plan prose and OpenAPI disagree, `docs/demo/openapi.yaml` is canonical. In particular, use `POST /quotes` and `POST /loans/{loanId}/payments/attest` rather than singular or unnested alternatives in the plan text.

## Scope

### In scope

- Create the Batch 2 backend scaffold using Node.js, TypeScript, Fastify, and Vitest.
- Implement the OpenAPI-defined endpoint surface:
  - `GET /health`
  - `POST /quotes`
  - `POST /risk/wallet`
  - `GET /loans`
  - `POST /loans`
  - `GET /loans/{loanId}`
  - `POST /loans/{loanId}/approve`
  - `POST /loans/{loanId}/collateral/deposit`
  - `POST /loans/{loanId}/activate`
  - `POST /loans/{loanId}/payments/attest`
  - `POST /loans/{loanId}/margin-call`
  - `POST /loans/{loanId}/liquidate`
  - `GET /dashboard/summary`
  - `GET /events`
- Seed the runtime from `data/demo/loans.seed.json` and preserve deterministic demo behavior.
- Implement deterministic terms and quote calculation for Batch 2 demo scenarios.
- Implement a Wavy Node mock/adapter boundary returning risk score, AML status, max LTV, expiry, and assessment hash.
- Implement payment attestation payload/hash generation suitable for later on-chain registration.
- Implement a mock-first web3 adapter for loan activation, payment, and liquidation actions; real ABI/address integration is deferred behind the same interface.
- Enforce the state machine from `docs/demo/states-events.md` for loan lifecycle mutations.
- Record application/on-chain-like events for API responses, dashboard traceability, and manual post-transaction refresh.
- Implement dashboard aggregation from seeded/current loan state plus recorded events.
- Keep liquidation proceeds denominated in `USDC`.
- Follow strict TDD with Vitest: RED, GREEN, TRIANGULATE, REFACTOR, with evidence captured during apply/verify.

### Out of scope

- Real KYC, fiat rails, credit bureau, accounting reconciliation, or off-ramp integrations.
- Production-grade Wavy Node integration.
- Production-grade oracle, DEX liquidation, indexer, or custody workflows.
- Real Batch 1 contract ABI/address usage until those artifacts are available.
- Persistent production database unless later design/tasks explicitly justify it; deterministic in-memory or file-backed demo state is acceptable.
- Frontend implementation for Batch 3 or dashboard UI implementation for Batch 4.

## Affected Areas

- New backend application scaffold, likely under a dedicated backend/API directory.
- API routing and validation for the canonical OpenAPI paths.
- Domain modules for loans, quotes, wallet risk, payments, dashboard aggregation, events, and state transitions.
- Adapter interfaces for Wavy Node and web3/contract integration.
- Seed loading from `data/demo/loans.seed.json`.
- Tests and project tooling: Vitest, TypeScript, Fastify injection tests, lint/typecheck/build scripts as applicable.
- Documentation/run instructions for local demo backend commands.
- OpenSpec artifacts for this change: proposal, spec, design, tasks, apply progress, verify report, and archive.

## Dependencies and Assumptions

- Batch 0 documents and seed data are the accepted baseline.
- The current repo is spec-first; no backend scaffold is assumed to exist.
- Batch 1 ABI/addresses are not required for the initial Batch 2 implementation.
- The web3 integration must be replaceable: mock behavior now, real Avalanche Fuji adapter later.
- API identifiers, enum values, statuses, and event names stay in English per `docs/demo/openapi.yaml`.
- Narrative docs may remain Spanish where already established.

## Risks

- **No existing scaffold:** implementation may introduce many files at once. Mitigation: split tasks into TDD slices and pause if review workload forecast exceeds the 700 changed-line budget.
- **Endpoint naming drift:** plan prose has singular/unnested endpoint examples. Mitigation: treat OpenAPI as canonical.
- **Mock-vs-real boundary leakage:** demo code could hard-code assumptions that later block Batch 1 integration. Mitigation: design explicit adapter interfaces before apply.
- **State inconsistency:** dashboard, loan mutations, and events could diverge. Mitigation: centralize state transition and event recording rules.
- **Hash determinism:** payment/risk hashes must be stable enough for tests and demo replay. Mitigation: define canonical payload serialization in design/spec.
- **Listener scope creep:** a real event listener may exceed hackathon scope. Mitigation: use manual post-transaction refresh or fixture/event updates unless ABI/address integration is ready.

## Rollback Plan

- Revert the Batch 2 backend scaffold and OpenSpec change artifacts if the direction is rejected before implementation.
- If implementation begins and causes integration problems, disable or remove the new backend entrypoint/routes while preserving Batch 0 docs and seed data.
- Keep external integrations behind mock adapters so real web3/Wavy dependencies can be removed without affecting the local demo flow.
- Avoid modifying the canonical OpenAPI contract unless a later approved SDD decision requires it.

## Success Criteria

- A local Fastify backend can run with deterministic seed data and satisfy the canonical endpoint names in `docs/demo/openapi.yaml`.
- The backend can simulate the minimum demo flow end-to-end with traceable loan state and events.
- Quote and risk responses are deterministic and scenario-aware.
- Loan lifecycle mutations enforce allowed transitions from `docs/demo/states-events.md`.
- Payment attestation returns a reproducible hash and records an `InstallmentPaid` event.
- Dashboard summary metrics are computed from loan/event data and are explainable from the seed/current state.
- Liquidation responses and events always report proceeds in `USDC`.
- Web3 behavior is accessible through a mock adapter now and can later consume real ABI/addresses without changing route contracts.
- Vitest evidence demonstrates strict TDD execution for the scaffold and core behavior.
- Review workload is forecast before apply; if the implementation plan exceeds 700 changed lines or requires chained PRs, pause for delivery strategy approval.
