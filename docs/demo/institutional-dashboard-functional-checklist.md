# Institutional Dashboard Functional Checklist (Batch 4)

## Portfolio first screen

- [x] Institutional dashboard view is selectable from the app header.
- [x] Summary cards show capital utilized, active loans, active vaults, margin/default exposure, payments attested, and liquidations executed.
- [x] Portfolio table shows loan, scenario, borrower, status, principal, collateral, current LTV, vault/receipt context, and inspect action.
- [x] Risk panel shows average LTV, loans in margin call, exposure by collateral asset, and severity label.

## Audit and detail evidence

- [x] Audit trail lists canonical events with event ID, loan ID, occurred-at timestamp, tx hash, and block number.
- [x] Missing chain evidence is labeled clearly when tx hash or block number is absent.
- [x] Audit payload rendering is compact and allowlisted (no raw JSON dumps).
- [x] Loan detail panel shows participant context, borrower wallet, collateral and terms, receipt status, payment evidence, and liquidation context.
- [x] Loan detail uses inline non-overlapping layout and supports selected-loan refresh error messaging.

## Demo mode and data provenance

- [x] Demo mode toggle supports Institutional, Crypto-native, and All.
- [x] Mode filtering is local to dashboard state and does not mutate canonical API records.
- [x] Source badges label non-canonical values as Demo data or Derived from API loans.

## Guardrails

- [x] Dashboard remains read-oriented (no borrower mutation flows triggered by dashboard rendering).
- [x] Canonical endpoints remain dashboard reads only: GET /dashboard/summary, GET /loans, GET /loans/{loanId}, GET /events.
