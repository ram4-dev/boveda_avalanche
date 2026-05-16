# Proposal: batch-4-institutional-dashboard

## Status

Proposed.

## Intent

Build the Batch 4 Institutional Dashboard for the Bóveda Avalanche hackathon demo. The dashboard should show why Bóveda is infrastructure for originators and funding partners, not only a borrower-facing crypto app: collateral is verifiable, portfolio risk is understandable, payments are attested, audit events are traceable, and liquidation is programmatic.

## Executive Summary

Batch 4 adds an institutional dashboard experience on top of the verified Batch 2 backend and the committed Batch 3 Vite/React frontend baseline. It will consume the canonical Batch 2 read endpoints first (`GET /dashboard/summary`, `GET /events`, `GET /loans`, `GET /loans/{loanId}`), reuse the existing frontend API/test/design patterns, and introduce a polished dashboard view with portfolio metrics, risk/LTV analysis, audit trail, loan detail, and a dual demo toggle for the institutional and crypto-native stories.

Fixtures may be used only where aggregate dashboard data is missing or insufficient for demo clarity, and any such values must be visibly labeled as demo data. This change must not add production persistence, real KYC/fiat integrations, secret handling, real chain settlement, or backend endpoint rewrites unless later SDD phases prove a minimal contract gap.

## Why

The borrower widget explains the user journey, but the hackathon story also needs to convince institutional stakeholders. A funder, originator, or partner should be able to look at one screen and understand:

- how much capital is deployed;
- which loans/vaults are active;
- what LTV and margin-call exposure exists;
- which payments were attested;
- which events are traceable to transaction hashes or event IDs;
- how a specific loan is collateralized, paid, and liquidated if needed.

This is the Batch 4 acceptance target from the product plan: communicate guarantees to the funder through verifiable collateral, LTV, attested payments, and programmatic liquidation.

## Source of Truth

- Project context and strict TDD policy: `openspec/config.yaml`.
- Product scope: `boveda_plan_funcional_tareas_hackathon.md`, Batch 4 — Institutional Dashboard.
- API source of truth: `docs/demo/openapi.yaml`.
- Demo semantics: `docs/demo/demo-flow.md` and `docs/demo/states-events.md`.
- Seed data: `data/demo/loans.seed.json`.
- Backend readiness: `openspec/changes/batch-2-backend-risk-attestations/verify-report.md`.
- Frontend baseline: `openspec/changes/batch-3-borrower-widget/verify-report.md` plus `web/src/`.
- Visual system: `DESIGN.md` and the existing Batch 3 tokens/styles.

When prose and OpenAPI differ, `docs/demo/openapi.yaml` is canonical.

## Scope

### In scope

- B4.1: Institutional dashboard layout with clear cards and a portfolio table.
- B4.2: Portfolio widgets for capital utilized, active loans, active vaults, and delinquency/default or margin-call exposure.
- B4.3: LTV/risk widget showing average LTV, loans in margin call, and exposure by collateral asset.
- B4.4: Audit trail listing canonical demo events, with tx hashes, block numbers, event IDs, or clear unavailable states when those fields are absent.
- B4.5: Loan detail view showing loan ID, borrower wallet, originator/funding partner, collateral, payments/attestation evidence, current status, receipt context, and liquidation preview/result context.
- B4.6: Dual demo mode toggle between:
  - institutional/traditional case (`SME_FIAT_WORKING_CAPITAL` or equivalent portfolio narrative), and
  - crypto-native case (`WEB3_BRIDGE`).
- Frontend API client/types/state additions needed to consume Batch 2 dashboard, events, and loans endpoints.
- Demo fixture fallback only for missing aggregate values or presentation labels, with explicit `Demo data` labeling.
- Tests planned under strict TDD before implementation: API client contracts, pure dashboard derivations, component rendering, and App-level regression coverage.
- Preservation of Batch 2 backend behavior and Batch 3 borrower widget behavior.

### Out of scope

- Real KYC, fiat rails, payment processor, accounting reconciliation, credit bureau, or off-ramp integrations.
- Production persistence, authentication, roles/permissions, or multi-tenant reporting.
- New backend endpoints or schema rewrites unless a later approved spec/design phase identifies a strict minimum gap.
- Production oracle, DEX liquidation, Wavy Node integration, indexer, or real chain settlement.
- Wallet private keys, seed phrases, `.env` secrets, credentials, tokens, or secret-manager reads.
- Reimplementing Batch 2 loan/event/dashboard business logic in frontend code.
- Replacing the Batch 3 borrower widget rather than extending the frontend with a dashboard route/view.

## Proposed Behavior at a High Level

1. The app exposes an institutional dashboard view built from Batch 2 dashboard summary, loan list/detail, and events data.
2. The top section communicates funder-facing portfolio health: deployed capital, active loans, active vaults, average LTV, margin/default exposure, payment attestations, and liquidation count.
3. A portfolio table lists demo loans with scenario, borrower, status, principal, collateral, LTV, vault/receipt context, and an action to inspect details.
4. A risk section explains average LTV, loans in margin call, liquidation threshold context, and exposure by collateral asset.
5. The audit trail lists recent canonical events (`LoanCreated`, `CollateralDeposited`, `InstallmentPaid`, `MarginCall`, `Liquidated`, etc.) with event IDs and tx/block data when available.
6. Selecting a loan opens a detail view or drawer with the full institutional story for that loan: participants, wallet, collateral, terms, current metrics, payment evidence, receipt, and liquidation preview/result.
7. A dual demo toggle changes the narrative lens between institutional/traditional and crypto-native scenarios without changing canonical API contracts.
8. Any fallback fixture-derived value is labeled as demo data so judges do not confuse presentation scaffolding with live backend/on-chain data.

## Affected Areas

- `web/src/api/`: dashboard/event/loan read methods and TypeScript contract types as needed.
- `web/src/state/`: dashboard loading state, pure selectors/derivations, demo mode selection, and fixture fallback boundaries.
- `web/src/components/`: reusable dashboard cards, portfolio table, risk/exposure panels, audit trail, loan detail, and demo toggle controls.
- `web/src/App.tsx`: composition/routing or view selection to include the institutional dashboard while preserving the borrower widget baseline.
- `web/src/styles/`: dashboard layout and component styling consistent with `DESIGN.md` and existing tokens.
- `web/src/**/*.test.{ts,tsx}`: new strict-TDD tests and regression updates.
- OpenSpec artifacts for later phases: spec, design, tasks, apply progress, verify report, and archive.

## Dependencies and Assumptions

- Batch 2 backend endpoints are available and should be used as the primary source of data.
- Batch 3 frontend scaffold, API patterns, test setup, and UI tokens are available in `web/src/` and should be reused.
- `GET /dashboard/summary` includes `activePrincipalUsd`, `activeVaults`, `averageLtvBps`, `loansInMarginCall`, `paymentsAttested`, `liquidationsExecuted`, `exposureByAsset`, and `recentEvents`.
- `GET /loans` and `GET /loans/{loanId}` provide the portfolio and detail records.
- `GET /events` provides audit-trail rows and can be filtered by loan where supported.
- Liquidation proceeds remain denominated in `USDC`.
- Demo state is deterministic enough for local testing; if reset support is needed, it belongs in later Batch 5 unless already present.

## Fixture Policy

Fixtures are allowed only as a presentation fallback when the canonical Batch 2 response lacks a field needed for an institutional dashboard explanation. Fixture-derived values must:

- be deterministic;
- be isolated from API transport code;
- be labeled as `Demo data` or equivalent in the UI;
- not mutate canonical API state;
- not hide failures of required Batch 2 endpoints.

## Testing and TDD Expectations

Strict TDD is active. Later implementation must follow RED, GREEN, TRIANGULATE, REFACTOR and record evidence.

Baseline verification commands:

```text
npm test -- --run
npm run typecheck
npm run build
npm run lint
```

Expected coverage in later phases:

- API client tests for canonical dashboard, events, loans, and loan-detail endpoint paths.
- Pure selector tests for portfolio metrics, exposure grouping, demo mode filtering, and fixture labeling.
- Component tests for summary cards, risk widget, portfolio table, audit trail, and loan detail view.
- App regression tests confirming the dashboard renders without breaking the Batch 3 borrower widget baseline.

## Risks

- **Review workload risk:** dashboard UI plus state/types/tests can exceed the 400 changed-line budget. Later tasks should forecast size and pause before apply if chained delivery is safer.
- **Fixture ambiguity:** unlabeled fallback data could mislead judges. Mitigation: strict fixture labeling and selector-level tests.
- **Endpoint drift:** frontend code could accidentally invent endpoint shapes. Mitigation: OpenAPI remains canonical and API-client tests should lock paths/contracts.
- **Coupling to borrower state:** Batch 3 state is borrower-flow oriented. Dashboard state should be separate enough to avoid regressions.
- **Overloaded UI:** too many institutional metrics can reduce demo clarity. Mitigation: prioritize first-screen guarantees and move detail into table/drawer sections.
- **Backend mutation side effects:** the demo backend has mutable in-memory state. Dashboard tests should use mocked client responses or deterministic fixtures instead of relying on mutation order.

## Rollback Plan

- Remove the Batch 4 dashboard view, state modules, components, tests, and styles introduced by this change.
- Restore `web/src/App.tsx` to the Batch 3 borrower-widget-only composition if dashboard integration causes regressions.
- Preserve Batch 2 backend endpoints and Batch 3 borrower widget artifacts; Batch 4 must not require backend rollback.
- Remove any fixture fallback files added for dashboard presentation if the direction is rejected.
- Keep `npm test -- --run`, `npm run typecheck`, `npm run build`, and `npm run lint` as the rollback verification baseline.

## Success Criteria

- A funder/originator can understand the portfolio at a glance: capital deployed, active loans/vaults, LTV, margin/default exposure, and payment attestations.
- The dashboard consumes the canonical Batch 2 endpoints rather than hardcoding portfolio state.
- Audit trail rows show traceable event evidence with tx hash/block data when present and honest unavailable states when absent.
- Loan detail view explains a single loan from borrower wallet through collateral, payments, receipt, status, and liquidation context.
- Dual demo mode clearly supports both the institutional/traditional and crypto-native narratives.
- Fixture-derived values are deterministic and visibly labeled as demo data.
- Existing Batch 2 backend tests and Batch 3 frontend tests remain green.
- Required verification commands pass.
- If later implementation forecast exceeds the 400 changed-line review budget or requires backend work, the flow pauses for a delivery strategy decision before apply.

## Memory / Artifact Policy

OpenSpec is the authoritative artifact store for this executor runtime. Engram save-back was requested by policy, but no callable memory tools were exposed to this subagent; this proposal is therefore persisted as an OpenSpec artifact and should be saved to Engram by the parent if memory tooling is available there.

## Skill Resolution

injected
