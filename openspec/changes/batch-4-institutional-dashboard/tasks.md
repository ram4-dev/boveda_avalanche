# Tasks: batch-4-institutional-dashboard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900-1,400 additions/deletions |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 API/state foundation → PR 2 dashboard core UI → PR 3 audit/detail/demo polish |
| Delivery strategy | chained slices |
| Chain strategy | Work Unit 1 API/state foundation → Work Unit 2 core dashboard UI → Work Unit 3 audit/detail/demo polish |

Decision needed before apply: Resolved — user selected chained slices on 2026-05-16
Chained PRs recommended: Yes
Chain strategy: Work Unit 1 API/state foundation → Work Unit 2 core dashboard UI → Work Unit 3 audit/detail/demo polish
400-line budget risk: High

## SDD Apply Gate

Delivery strategy confirmed: use chained slices because the forecast exceeds the 400-line review budget. Apply one work unit at a time with verification/review checkpoints. If actual implementation scope grows into backend/schema/auth/persistence, pause for a new decision.

## Verification Commands

Run these at the end of every work unit and again during `sdd-verify`:

- `npm test -- --run`
- `npm run typecheck`
- `npm run build`
- `npm run lint`

Strict TDD is active. Test runner: `npm test -- --run`. Each apply slice must record RED, GREEN, TRIANGULATE, and REFACTOR evidence in `openspec/changes/batch-4-institutional-dashboard/apply-progress.md`.

## Work Unit 1 — API and Dashboard State Foundation

Start boundary: Batch 4 OpenSpec artifacts exist; no production dashboard code exists.  
Finish boundary: canonical dashboard read contracts, dashboard selectors, and dashboard loading model are tested and compiled, with minimal/no visible UI.  
Rollback boundary: remove the files and edits listed in this unit; Batch 3 borrower widget remains unchanged.

### 1. Lock dashboard API contracts

- [x] RED: Extend `web/src/api/client.test.ts` to expect `getDashboardSummary()` calling `GET /dashboard/summary`.
- [x] RED: Extend `web/src/api/client.test.ts` to preserve existing `listLoans`, `getLoan`, and `listEvents({ loanId })` path/query behavior.
- [x] GREEN: Add `DashboardExposure`, `DashboardSummary`, `LoansResponse`, and `EventsResponse` to `web/src/api/types.ts` using `docs/demo/openapi.yaml` as source of truth.
- [x] GREEN: Add `getDashboardSummary()` to `web/src/api/client.ts`; do not add new backend endpoints or borrower mutations.
- [x] TRIANGULATE: Add/confirm encoded `loanId` and query-param tests in `web/src/api/client.test.ts`.
- [x] REFACTOR: Keep the API client transport-only; no dashboard business logic in `web/src/api/client.ts`.

Verification: `npm test -- --run web/src/api/client.test.ts`, then full verification commands.

### 2. Add pure dashboard selectors

- [x] RED: Create `web/src/state/dashboardSelectors.test.ts` covering `SME_FIAT_WORKING_CAPITAL`, `WEB3_BRIDGE`, and `all` demo-mode filtering.
- [x] RED: Add tests for active loan counts, active vault counts, margin/default exposure, basis-points-to-percent inputs, and status severity.
- [x] RED: Add tests for exposure-by-asset source priority: API summary first, safe loan derivation second, demo fixture only with `Demo data` metadata.
- [x] RED: Add tests for audit payload whitelisting and missing tx/block evidence labels.
- [x] RED: Add tests for selected-loan detail view model including receipt, payment evidence, and `USDC` liquidation context.
- [x] GREEN: Create `web/src/state/dashboardSelectors.ts` with pure selectors named in `design.md`.
- [x] GREEN: Determined `web/src/state/dashboardFixtures.ts` was not needed for Work Unit 1; deterministic fallback metadata is isolated in pure selector outputs only.
- [x] TRIANGULATE: Cover empty loans, no matching demo mode, absent exposure entries, absent receipt/payment evidence, and malformed numeric strings.
- [x] REFACTOR: Reuse `web/src/components/format.ts` where possible; do not duplicate money/LTV formatting logic unnecessarily.

Verification: `npm test -- --run web/src/state/dashboardSelectors.test.ts`, then full verification commands.

### 3. Add dashboard loading state model

- [x] RED: Create `web/src/state/institutionalDashboard.test.ts` for successful summary/loans/events load.
- [x] RED: Add tests for partial failure preserving successful sections and exposing section-specific safe errors.
- [x] RED: Add tests for refresh preserving last confirmed data.
- [x] RED: Add tests for selecting a loan via `GET /loans/{loanId}` and preserving selected identity during detail refresh.
- [x] RED: Add tests that demo mode changes do not mutate canonical loans/events.
- [x] GREEN: Create `web/src/state/institutionalDashboard.ts` with `InstitutionalDashboardState`, load helpers, refresh helper, selection helper, and local demo-mode reducer/actions.
- [x] TRIANGULATE: Cover empty portfolio, all initial reads failing, selected detail failure, and selected loan outside current mode.
- [x] REFACTOR: Keep async loading helpers testable; avoid coupling to React until a hook is needed by the screen.

Verification: `npm test -- --run web/src/state/institutionalDashboard.test.ts`, then full verification commands.

## Work Unit 2 — Institutional Dashboard Core UI

Start boundary: Work Unit 1 passes and provides typed data/selectors/state.  
Finish boundary: user can switch to a dashboard view showing first-screen summary, portfolio table, and risk/exposure without breaking borrower view.  
Rollback boundary: remove screen/components/styles/App edits from this unit; keep Work Unit 1 if useful.

### 4. Add App view boundary without borrower regression

- [ ] RED: Extend `web/src/App.regression.test.tsx` to assert the existing borrower widget view still renders and remains selectable.
- [ ] RED: Add App regression coverage for switching to `Institutional dashboard` without invoking borrower mutation endpoints.
- [ ] GREEN: Extract or add view composition in `web/src/App.tsx` with local view state: borrower widget and institutional dashboard.
- [ ] GREEN: Create placeholder `web/src/screens/InstitutionalDashboardScreen.tsx` wired to `useInstitutionalDashboard` or tested load helpers.
- [ ] TRIANGULATE: Test switching back from dashboard to borrower view and preserving borrower baseline behavior.
- [ ] REFACTOR: If hook rules become awkward, extract `BorrowerWidgetView` and `InstitutionalDashboardView` child components in `web/src/App.tsx` or `web/src/screens/`.

Verification: `npm test -- --run web/src/App.regression.test.tsx`, then full verification commands.

### 5. Build summary cards and portfolio table

- [ ] RED: Create `web/src/components/PortfolioSummaryCards.test.tsx` for capital utilized, active loans, active vaults, margin/default exposure, payments attested, and liquidations executed.
- [ ] RED: Create `web/src/components/PortfolioTable.test.tsx` for loan ID, scenario, borrower, status, principal, collateral, current LTV, vault/receipt indicator, and inspect action.
- [ ] GREEN: Create `web/src/components/PortfolioSummaryCards.tsx` using dashboard selector view models.
- [ ] GREEN: Create `web/src/components/PortfolioTable.tsx` with semantic table markup or accessible card rows for narrow screens.
- [ ] TRIANGULATE: Cover empty portfolio, long wallet/loan IDs, terminal statuses, and fixture/derived labels.
- [ ] REFACTOR: Reuse `MetricTile`, `StatusPill`, `KeyValueList`, `DataSourceBadge` if created, and formatting helpers instead of new primitives.

Verification: targeted component tests, then full verification commands.

### 6. Build risk and exposure panel

- [ ] RED: Create `web/src/components/RiskExposurePanel.test.tsx` for average LTV, loans in margin call, exposure-by-asset rows, severity copy, and selected-loan thresholds.
- [ ] GREEN: Create `web/src/components/RiskExposurePanel.tsx`.
- [ ] TRIANGULATE: Cover no exposure entries, warning/critical/healthy severity, missing selected loan, and derived/demo-fixture labels.
- [ ] REFACTOR: Keep color severity backed by text labels; do not rely on color alone.

Verification: `npm test -- --run web/src/components/RiskExposurePanel.test.tsx`, then full verification commands.

### 7. Style dashboard core layout

- [ ] RED: Add stable role/text assertions in `web/src/App.regression.test.tsx` or component tests for non-overlapping dashboard regions and accessible headings.
- [ ] GREEN: Extend `web/src/styles/app.css` with bounded dashboard layout classes: `dashboard-layout`, `dashboard-grid`, `dashboard-card`, `dashboard-table`, and responsive stacking.
- [ ] GREEN: Reuse `web/src/styles/tokens.css` variables; do not introduce a competing visual system.
- [ ] TRIANGULATE: Cover narrow layout assumptions with DOM/role assertions where practical; manually inspect CSS for long identifiers wrapping.
- [ ] REFACTOR: Remove redundant CSS and avoid sticky/floating sidebars that could recreate Batch 3 overlap issues.

Verification: full verification commands.

## Work Unit 3 — Audit Trail, Loan Detail, Demo Mode Polish

Start boundary: dashboard core view renders summary/table/risk and borrower regression tests remain green.  
Finish boundary: B4.1-B4.6 acceptance is complete with audit evidence, loan detail, dual demo mode, fixture labels, and final regression coverage.  
Rollback boundary: remove audit/detail/demo-mode components and related App/screen wiring; dashboard core remains reviewable.

### 8. Add audit trail component

- [x] RED: Create `web/src/components/AuditTrail.test.tsx` for event type, loan ID, occurred-at timestamp, event ID, tx hash, block number, and missing-evidence labels.
- [x] RED: Add tests that whitelisted payload highlights render while raw JSON payloads do not.
- [x] GREEN: Create `web/src/components/AuditTrail.tsx` consuming selector output from `web/src/state/dashboardSelectors.ts`.
- [x] TRIANGULATE: Cover empty events, summary recent events, loan-filtered events, and absent tx/block evidence.
- [x] REFACTOR: Keep event rendering compact and traceable; do not fabricate explorer links or chain finality.

Verification: `npm test -- --run web/src/components/AuditTrail.test.tsx`, then full verification commands.

### 9. Add loan detail panel

- [x] RED: Create `web/src/components/LoanDetailPanel.test.tsx` for participant details, borrower wallet, originator/funding partner, principal, collateral, terms, risk, receipt, payment evidence, and liquidation context.
- [x] RED: Add tests for useful empty states when receipt/payment/liquidation evidence is absent.
- [x] GREEN: Create `web/src/components/LoanDetailPanel.tsx` as an inline non-overlapping panel.
- [x] GREEN: Wire inspect action from `PortfolioTable` through `web/src/screens/InstitutionalDashboardScreen.tsx` to state selection/detail loading.
- [x] TRIANGULATE: Cover selected loan refresh failure, selected loan outside current demo mode, and `USDC` liquidation proceeds distribution.
- [x] REFACTOR: Keep panel keyboard-accessible and heading tied to selected loan identity; avoid modal/drawer focus complexity unless explicitly chosen.

Verification: `npm test -- --run web/src/components/LoanDetailPanel.test.tsx`, then full verification commands.

### 10. Add dual demo mode toggle and fixture badges

- [x] RED: Create `web/src/components/DashboardViewToggle.test.tsx` for `Institutional`, `Crypto-native`, and `All` modes with accessible selected state.
- [x] RED: Create `web/src/components/DataSourceBadge.test.tsx` for `Demo data`, `Derived from API loans`, and API-backed no-badge behavior if the badge component is introduced.
- [x] GREEN: Create `web/src/components/DashboardViewToggle.tsx` and `web/src/components/DataSourceBadge.tsx`.
- [x] GREEN: Wire demo mode through `web/src/screens/InstitutionalDashboardScreen.tsx` to `selectLoansForMode` and related selectors.
- [x] TRIANGULATE: Cover no matching scenario, switching back to `all`, and selected detail clearing/labeling behavior.
- [x] REFACTOR: Keep demo mode local to dashboard state; do not pass it into `useBorrowerJourney`.

Verification: targeted tests, then full verification commands.

### 11. Final App regression and documentation evidence

- [x] RED: Add/extend `web/src/App.regression.test.tsx` or `web/src/InstitutionalDashboard.regression.test.tsx` for complete dashboard first-screen acceptance: summary, table, risk, audit, detail affordance, demo toggle.
- [x] GREEN: Complete screen wiring in `web/src/screens/InstitutionalDashboardScreen.tsx` and any missing App composition.
- [x] TRIANGULATE: Assert API read paths are used and borrower mutation endpoints are not called by dashboard rendering.
- [x] REFACTOR: Simplify props/view models after component tests pass.
- [x] Update `openspec/changes/batch-4-institutional-dashboard/apply-progress.md` with RED/GREEN/TRIANGULATE/REFACTOR evidence for all work units during apply.
- [x] If demo operation changed, update `docs/demo/borrower-widget-functional-checklist.md` or create a Batch 4 dashboard checklist at `docs/demo/institutional-dashboard-functional-checklist.md`.

Verification: full verification commands.

## SDD Verify Phase Tasks

- [ ] Run `npm test -- --run` and record pass/fail evidence.
- [ ] Run `npm run typecheck` and record pass/fail evidence.
- [ ] Run `npm run build` and record pass/fail evidence.
- [ ] Run `npm run lint` and record pass/fail evidence.
- [ ] Review changed files against `openspec/changes/batch-4-institutional-dashboard/specs/institutional-dashboard/spec.md` requirements.
- [ ] Confirm Batch 3 borrower widget regressions are covered and green.
- [ ] Confirm fixture-derived values are visibly labeled and do not hide endpoint failures.
- [ ] Confirm no secrets, `.env`, private keys, credentials, or tokens are read or required.
- [ ] Write `openspec/changes/batch-4-institutional-dashboard/verify-report.md`.

## Acceptance Checklist

- [ ] B4.1 dashboard layout renders with clear cards, portfolio table, risk section, audit trail, and loan inspection.
- [ ] B4.2 portfolio widgets show capital utilized, active loans, active vaults, and margin/default exposure.
- [ ] B4.3 LTV/risk widget shows average LTV, margin-call loans, exposure by asset, and threshold context.
- [ ] B4.4 audit trail shows canonical events with tx/block evidence when present and honest missing-evidence labels when absent.
- [ ] B4.5 loan detail shows loan ID, borrower wallet, participant context, collateral, payments, status, receipt, and liquidation context.
- [ ] B4.6 dual demo mode toggles institutional/traditional, crypto-native, and all views without mutating backend or borrower state.
- [ ] Canonical Batch 2 endpoints are used first: `GET /dashboard/summary`, `GET /loans`, `GET /loans/{loanId}`, `GET /events`.
- [ ] Fixture-derived values are deterministic, isolated, and visibly labeled `Demo data` or equivalent.
- [ ] Existing Batch 2 backend tests and Batch 3 frontend tests remain green.
- [ ] Verification commands pass.

## Notes For Parent/Apply Orchestrator

- User selected chained slices. Keep work units as explicit review checkpoints and do not broaden scope into backend/schema/auth/persistence work.
- If commits/PRs are later requested, split by the same work-unit boundaries.
- Engram memory save-back was requested, but no callable memory tools are exposed in this executor runtime; this task artifact is persisted in OpenSpec only.

## Skill Resolution

injected
