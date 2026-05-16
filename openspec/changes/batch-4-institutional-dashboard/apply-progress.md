# Apply Progress: batch-4-institutional-dashboard

## Work Unit 2 — Institutional Dashboard Core UI

### 4) App view boundary without borrower regression

- RED
  - Extended `web/src/App.regression.test.tsx` with view-switch coverage:
    - borrower view remains selectable,
    - institutional dashboard can be selected,
    - switching back preserves borrower baseline,
    - dashboard render does not call borrower mutation endpoints.
- GREEN
  - Updated `web/src/App.tsx` to add explicit app-level view boundary (`borrower` vs `dashboard`).
  - Kept borrower flow inside `BorrowerWidgetView` and added new `InstitutionalDashboardScreen` route-level view.
- TRIANGULATE
  - Added assertions that dashboard renders summary/table/risk regions and that borrower controls still appear after switching back.
- REFACTOR
  - Isolated borrower-specific state/actions from dashboard view composition to avoid coupling with dashboard state.

### 5) Summary cards and portfolio table

- RED
  - Added `web/src/components/PortfolioSummaryCards.test.tsx`.
  - Added `web/src/components/PortfolioTable.test.tsx`.
- GREEN
  - Implemented `web/src/components/PortfolioSummaryCards.tsx` using selector-derived portfolio metrics.
  - Implemented `web/src/components/PortfolioTable.tsx` with accessible table headers and inspect action.
- TRIANGULATE
  - Covered empty portfolio state and inspect callback behavior.
  - Covered fallback `Demo data` labels when summary aggregates are unavailable.
- REFACTOR
  - Reused existing formatting/status primitives (`format.ts`, `StatusPill`) and avoided new dashboard-only formatting utilities.

### 6) Risk and exposure panel

- RED
  - Added `web/src/components/RiskExposurePanel.test.tsx` for average LTV, margin-call count, exposure list, severity, and selected-loan threshold context.
- GREEN
  - Implemented `web/src/components/RiskExposurePanel.tsx` using `selectRiskSummary` and `selectExposureByAsset` selectors.
- TRIANGULATE
  - Covered selected-loan threshold rendering and API exposure rendering.
- REFACTOR
  - Kept severity as text + style (`healthy|warning|critical`) for non-color-only signaling.

### 7) Dashboard core layout styling

- RED
  - Added/used App regression assertions for heading/region visibility under dashboard view.
- GREEN
  - Extended `web/src/styles/app.css` with bounded dashboard layout classes:
    - `view-switch`, `dashboard-layout`, `dashboard-toolbar`, `dashboard-grid`, `dashboard-card`, `dashboard-summary-grid`, `dashboard-table`, `dashboard-risk-grid`, `severity-pill`, `risk-thresholds`, `exposure-list`.
- TRIANGULATE
  - Added responsive behavior for dashboard sections under existing media breakpoints.
- REFACTOR
  - Reused existing tokens and card/button patterns; avoided sticky/floating overlapping panes.

## Commands and Results

- Targeted tests:
  - `npm test -- --run web/src/App.regression.test.tsx web/src/components/PortfolioSummaryCards.test.tsx web/src/components/PortfolioTable.test.tsx web/src/components/RiskExposurePanel.test.tsx`
  - Result: PASS (4 files, 9 tests).

- Full verification:
  - `npm test -- --run`
  - `npm run typecheck`
  - `npm run build`
  - `npm run lint`
  - Result: PASS (20 test files, 72 tests; typecheck/build/lint passed).

## Work Unit 3 — Audit Trail, Loan Detail, Demo Mode Polish

### 8) AuditTrail component

- RED
  - Added `web/src/components/AuditTrail.test.tsx` for canonical evidence fields, missing-evidence labels, payload allowlisting, selected-loan filtering, and empty state.
- GREEN
  - Implemented `web/src/components/AuditTrail.tsx` using `selectAuditEvents` selector output.
  - Rendered compact evidence rows with event ID, loan ID, occurred-at, tx hash, block number, and allowlisted payload highlights.
- TRIANGULATE
  - Covered summary-fallback events and events-list paths.
  - Covered absent tx/block values and selected-loan filtering behavior.
- REFACTOR
  - Kept event rendering compact and traceable with no explorer links, no chain-finality claims, and no raw JSON dumps.

### 9) LoanDetailPanel + inspect wiring

- RED
  - Added `web/src/components/LoanDetailPanel.test.tsx` for participant context, borrower wallet, terms/risk, receipt/payment evidence, liquidation context, and empty states.
- GREEN
  - Implemented `web/src/components/LoanDetailPanel.tsx` as an inline non-overlapping panel.
  - Wired inspect flow from `PortfolioTable` through `InstitutionalDashboardScreen` into `selectInstitutionalDashboardLoan` state path.
  - Updated `web/src/state/dashboardSelectors.ts` to expose `currentMetrics` in `selectLoanDetailViewModel` for threshold rendering.
- TRIANGULATE
  - Covered selected-loan detail refresh errors surfaced as safe alert copy.
  - Preserved `USDC` liquidation context in detail rendering.
- REFACTOR
  - Kept panel keyboard-friendly and heading-stable; avoided modal/drawer focus complexity.

### 10) Demo mode toggle + source badges

- RED
  - Added `web/src/components/DashboardViewToggle.test.tsx` for Institutional/Crypto-native/All modes with selected state.
  - Added `web/src/components/DataSourceBadge.test.tsx` for `Demo data`, `Derived from API loans`, and API/no-label behavior.
- GREEN
  - Implemented `web/src/components/DashboardViewToggle.tsx` and `web/src/components/DataSourceBadge.tsx`.
  - Wired mode changes in `InstitutionalDashboardScreen` using `setDashboardDemoMode` and `selectLoansForMode`.
  - Applied source badges in `PortfolioSummaryCards` and `RiskExposurePanel`.
- TRIANGULATE
  - Mode changes clear mismatched selected loans via existing dashboard state behavior.
  - All mode remains default and renders canonical unfiltered portfolio.
- REFACTOR
  - Kept demo mode local to institutional dashboard state and isolated from `useBorrowerJourney`.

### 11) Final regression + documentation evidence

- RED
  - Extended `web/src/App.regression.test.tsx` to assert first-screen dashboard acceptance includes summary, table, risk panel, audit trail, loan-detail affordance, and demo toggle.
- GREEN
  - Completed `web/src/screens/InstitutionalDashboardScreen.tsx` wiring for toggle, audit trail, and loan detail panel.
  - Added `docs/demo/institutional-dashboard-functional-checklist.md`.
- TRIANGULATE
  - Regression confirms dashboard rendering does not invoke borrower mutation endpoints.
- REFACTOR
  - Added bounded dashboard utility CSS classes for new sections without introducing floating/sticky overlaps.

## Commands and Results

- Targeted tests:
  - `npm test -- --run web/src/components/AuditTrail.test.tsx web/src/components/LoanDetailPanel.test.tsx web/src/components/DashboardViewToggle.test.tsx web/src/components/DataSourceBadge.test.tsx web/src/App.regression.test.tsx`
  - Result: PASS (5 files, 10 tests).

- Full verification:
  - `npm test -- --run`
  - `npm run typecheck`
  - `npm run build`
  - `npm run lint`
  - Result: PASS (24 test files, 79 tests; typecheck/build/lint passed).

## Scope Guard

- Implemented Work Unit 3 only (audit trail, loan detail, demo mode polish, final regression/docs) on top of existing Work Unit 1 and Work Unit 2 PASS baseline.
- No backend endpoint changes, schema changes, auth/persistence work, secret reads, or borrower-mutation usage in dashboard rendering.

## Blocker Fixes Before Verify (Fresh Review)

### Blocker 1: Section-specific partial failure UX

- RED
  - Added `web/src/screens/InstitutionalDashboardScreen.test.tsx` with partial-load cases asserting section-specific guidance for summary, loans, and events.
- GREEN
  - Updated `web/src/screens/InstitutionalDashboardScreen.tsx` to render section-level status guidance near affected regions:
    - summary message above `PortfolioSummaryCards` using `state.errors.summary`;
    - loans message above `PortfolioTable` using `state.errors.loans`;
    - events message above `AuditTrail` using `state.errors.events`.
- TRIANGULATE
  - Covered mixed partial paths (`summary+events` failures and `loans` failure) while keeping unaffected sections visible.
- REFACTOR
  - Kept existing global partial banner and added scoped guidance without coupling dashboard state to borrower flow.

### Blocker 2: Loan detail required evidence fields

- RED
  - Extended `web/src/components/LoanDetailPanel.test.tsx` to require visible fields and unavailable states for:
    - vault address,
    - deposit tx hash,
    - APR,
    - tenor,
    - repayment frequency,
    - receipt owner wallet,
    - soulbound status.
- GREEN
  - Updated `web/src/components/LoanDetailPanel.tsx` to render these required evidence fields and honest unavailable labels when data is absent.
- TRIANGULATE
  - Verified both populated and missing-evidence paths (`receipt: null`, null vault/deposit hash).
- REFACTOR
  - Reused existing loan/detail model and formatting helpers; no API/backend changes.

### Blocker 3: Payment evidence highlights visibility

- RED
  - Extended `web/src/components/LoanDetailPanel.test.tsx` to assert display of `installmentId`, `amount`, `currency`, and `attestationHash` highlights from payment events.
- GREEN
  - Updated `web/src/components/LoanDetailPanel.tsx` to render `payment.highlights` under each payment evidence event.
- TRIANGULATE
  - Added useful empty-state copy when an installment payment event lacks those highlight keys.
- REFACTOR
  - Kept highlight sourcing in selectors (`selectLoanDetailViewModel`) and UI rendering in panel only.

## Blocker Fix Commands and Results

- Targeted blocker tests:
  - `npm test -- --run web/src/screens/InstitutionalDashboardScreen.test.tsx web/src/components/LoanDetailPanel.test.tsx`
  - Result: PASS (2 files, 4 tests).

- Full verification after blocker fixes:
  - `npm test -- --run`
  - `npm run typecheck`
  - `npm run build`
  - `npm run lint`
  - Result: PASS (25 test files, 81 tests; typecheck/build/lint passed).

- Re-run verification (2026-05-16):
  - `npm test -- --run web/src/screens/InstitutionalDashboardScreen.test.tsx web/src/components/LoanDetailPanel.test.tsx`
  - `npm test -- --run`
  - `npm run typecheck`
  - `npm run build`
  - `npm run lint`
  - Result: PASS (targeted 2 files/4 tests, full 25 files/81 tests; typecheck/build/lint passed).
