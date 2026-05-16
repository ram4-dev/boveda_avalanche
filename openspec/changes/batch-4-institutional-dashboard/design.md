# Design: batch-4-institutional-dashboard

## Status

Designed. No production code implemented in this phase.

## Executive Summary

Batch 4 adds an institutional dashboard view to the existing Batch 3 Vite/React frontend without changing Batch 2 backend semantics. The dashboard is a read-oriented funder/originator experience backed first by canonical Batch 2 endpoints:

- `GET /dashboard/summary`
- `GET /loans`
- `GET /loans/{loanId}`
- `GET /events`

The design introduces a separate dashboard API/type boundary, an independent dashboard state hook, pure selectors for portfolio/risk/audit presentation, and a dashboard view composed from summary cards, portfolio table, risk/exposure section, audit trail, loan detail, and dual demo mode toggle. Fixture fallback is allowed only for missing presentation labels or aggregate demo context, and every fixture-derived value must be labeled as demo data.

Batch 3 borrower journey state remains separate. The app gains a lightweight view switch or route boundary so the borrower widget remains available and regression-protected.

## Source Inputs

- Product scope: `boveda_plan_funcional_tareas_hackathon.md`, Batch 4 — Institutional Dashboard.
- Proposal: `openspec/changes/batch-4-institutional-dashboard/proposal.md`.
- Spec: `openspec/changes/batch-4-institutional-dashboard/specs/institutional-dashboard/spec.md`.
- API contract: `docs/demo/openapi.yaml`.
- Seed data: `data/demo/loans.seed.json`.
- Existing frontend baseline: `web/src/` from Batch 3 commit `145a767`.
- Visual system: `DESIGN.md`, `web/src/styles/tokens.css`, and `web/src/styles/app.css`.
- Strict TDD commands: `npm test -- --run`, `npm run typecheck`, `npm run build`, `npm run lint`.

## Current Frontend Seams

### Existing API client

`web/src/api/client.ts` already exposes:

- `listLoans(filter?)`
- `getLoan(loanId)`
- `listEvents(filter?)`
- borrower mutation methods for Batch 3

It does not yet expose `getDashboardSummary()`, even though `docs/demo/openapi.yaml` defines `GET /dashboard/summary`.

### Existing type definitions

`web/src/api/types.ts` already includes core `Loan`, `LoanScenario`, `LoanStatus`, `OnChainEvent`, `LiquidationPreview`, and related contract types. It does not yet define `DashboardSummary` or an event-list response type.

### Existing app composition

`web/src/App.tsx` currently renders a borrower-only app shell and owns:

- `createBovedaApiClient()`
- `useBorrowerJourney(client)`
- `useInjectedWallet()`
- `OfferRequestScreen`
- `LoanActivityScreen`

Batch 4 should add a view boundary above borrower/dashboard composition rather than mixing dashboard selection or demo mode into `useBorrowerJourney`.

## Architecture

### High-level data flow

```text
App
 ├─ createBovedaApiClient()
 ├─ View selector / route boundary
 │   ├─ BorrowerWidgetView
 │   │   └─ useBorrowerJourney(client)  // existing Batch 3 state
 │   └─ InstitutionalDashboardView
 │       └─ useInstitutionalDashboard(client)
 │           ├─ getDashboardSummary()
 │           ├─ listLoans({ scenario? }) or listLoans()
 │           ├─ listEvents({ loanId? }) or listEvents()
 │           └─ getLoan(selectedLoanId)
 └─ shared formatting/components/styles
```

### Design principles

1. **API first:** canonical OpenAPI response shapes are source of truth. The frontend may format, group, filter, and label; it must not create backend truth.
2. **State isolation:** dashboard state is independent from borrower journey state.
3. **Read-oriented dashboard:** Batch 4 should not add dashboard mutations or backend writes.
4. **Fixture honesty:** fixture-derived values must carry source metadata and UI labels.
5. **Demo clarity:** first viewport must communicate capital, active loans/vaults, LTV/risk, payment attestations, and traceability.
6. **Reviewability:** implementation should be split into TDD slices; the full dashboard likely exceeds the 400 changed-line review budget.

## API And Client Boundaries

### Client additions

Add only read methods needed by the dashboard:

```ts
getDashboardSummary(): Promise<DashboardSummary>
listLoans(filter?: { scenario?: LoanScenario; status?: LoanStatus }): Promise<{ loans: Loan[] }>
getLoan(loanId: string): Promise<Loan>
listEvents(filter?: { loanId?: string }): Promise<{ events: OnChainEvent[] }>
```

`listLoans`, `getLoan`, and `listEvents` already exist at runtime; implementation should mostly tighten their return typing and add `getDashboardSummary`.

### Endpoint contract

- `getDashboardSummary()` must call `GET /dashboard/summary`.
- `listLoans(filter)` must keep using `GET /loans` with optional query params.
- `getLoan(loanId)` must keep URL-encoding `loanId`.
- `listEvents({ loanId })` must keep using `GET /events?loanId=...` where provided.
- No Batch 4 UI code should call borrower mutation endpoints.

### Type additions

Add canonical dashboard read types in `web/src/api/types.ts`:

```ts
export type DashboardExposure = {
  asset: string;
  valueUsd: string;
};

export type DashboardSummary = {
  activePrincipalUsd: string;
  activeVaults: number;
  averageLtvBps: number;
  loansInMarginCall: number;
  paymentsAttested: number;
  liquidationsExecuted: number;
  exposureByAsset: DashboardExposure[];
  recentEvents: OnChainEvent[];
};

export type LoansResponse = { loans: Loan[] };
export type EventsResponse = { events: OnChainEvent[] };
```

Do not loosen canonical enum types to arbitrary strings unless the API contract changes.

### Error boundary

The client already maps canonical API failures to `ApiClientError`. Dashboard state should convert errors into a presentational error object that preserves safe `code` and `message`, similar to `BorrowerFacingError`, without raw JSON dumps.

## Dashboard State Model

### New files

Recommended state modules:

- `web/src/state/institutionalDashboard.ts`
- `web/src/state/institutionalDashboard.test.ts`
- `web/src/state/dashboardSelectors.ts`
- `web/src/state/dashboardSelectors.test.ts`
- Optional: `web/src/state/dashboardFixtures.ts` for deterministic presentation fallback metadata.

### State shape

```ts
export type DashboardLoadStatus = 'idle' | 'loading' | 'ready' | 'partial' | 'empty' | 'error';
export type DashboardAction = null | 'loading' | 'refreshing' | 'selectingLoan';
export type DashboardDemoMode = 'institutional' | 'crypto-native' | 'all';
export type DashboardDataSource = 'api' | 'derived' | 'demo-fixture';

export type DashboardField<T> = {
  value: T;
  source: DashboardDataSource;
  label?: 'Demo data';
};

export type InstitutionalDashboardState = {
  status: DashboardLoadStatus;
  summary: DashboardSummary | null;
  loans: Loan[];
  events: OnChainEvent[];
  selectedLoanId: string | null;
  selectedLoan: Loan | null;
  demoMode: DashboardDemoMode;
  action: DashboardAction;
  lastLoadedAt: string | null;
  errors: Partial<Record<'summary' | 'loans' | 'events' | 'selectedLoan' | 'refresh', SafeDashboardError>>;
};
```

### Loading behavior

Initial load should request summary, loans, and events independently. Use `Promise.allSettled` semantics so one failed section does not blank the whole dashboard.

Recommended status rules:

- `loading`: no confirmed data yet and initial requests pending.
- `ready`: required sections loaded and at least one loan or summary is available.
- `partial`: at least one core section loaded and at least one section failed.
- `empty`: loan list succeeds with no loans, and no useful summary/events can explain the dashboard.
- `error`: all required initial reads fail and there is no prior confirmed data.

### Refresh behavior

Refresh should preserve last confirmed data while showing per-section refreshing/error indicators. It should not clear `selectedLoanId` unless the selected loan disappears from the refreshed loan list and no detail can be loaded.

### Selected loan behavior

- Selecting a loan from the portfolio table sets `selectedLoanId` immediately for UI continuity.
- The dashboard may call `GET /loans/{loanId}` for fresh detail.
- If detail load fails, keep portfolio row context visible and show detail-specific error.
- Loan-specific audit evidence can call `GET /events?loanId={loanId}` or filter the already loaded event list when no additional call is needed.

### Demo mode behavior

The mode is local UI state only:

- `institutional`: prioritize/filter `SME_FIAT_WORKING_CAPITAL` loans.
- `crypto-native`: prioritize/filter `WEB3_BRIDGE` loans.
- `all`: show all loans.

Changing mode must not mutate loans, events, borrower journey state, backend state, or selected loan truth. If selected loan no longer matches the selected mode, either clear the detail with an explanatory empty state or keep it labeled as outside current mode; prefer clearing for simplicity.

## Selectors And Derivations

Keep selectors pure and testable. They should accept canonical API data plus demo mode/fixture context, then return view models with source metadata.

### Recommended selectors

- `selectLoansForMode(loans, demoMode)`
- `selectPortfolioSummary(summary, loans)`
- `selectRiskSummary(summary, loans)`
- `selectExposureByAsset(summary, loans)`
- `selectAuditEvents(summary, events, selectedLoanId?)`
- `selectLoanDetailViewModel(loan, events)`
- `selectDashboardEmptyState(state)`
- `selectDashboardHealthSeverity({ averageLtvBps, loansInMarginCall })`

### Portfolio summary derivation

Preferred data order:

1. API `DashboardSummary` field.
2. Safe derivation from canonical `Loan[]` when the aggregate is straightforward and source can be marked `derived`.
3. Deterministic fixture fallback only when neither API nor straightforward derivation exists, marked `demo-fixture` with visible label.

Examples:

- Active principal: use `summary.activePrincipalUsd` first. Deriving cross-currency active principal from loan principals is risky; avoid unless the value is explicitly USD or fixture-labeled.
- Active loans: derive from `Loan.status` values `Active` and `MarginCall` unless an API aggregate is added later.
- Active vaults: use `summary.activeVaults` first; fallback can count active loans with `collateral.vaultAddress`, marked `derived`.
- Delinquency/default exposure: use `summary.loansInMarginCall` plus loan status counts for `MarginCall` and `Defaulted`.

### Risk derivation

- Convert basis points to percentages via shared formatting helper.
- Severity bands should be deterministic and conservative:
  - healthy: no margin-call loans and average LTV below 65%.
  - warning: margin-call loans present or average LTV between 65% and liquidation threshold context.
  - critical: defaulted/liquidated context or average LTV near/above 80%.
- Loan-level status always comes from canonical `Loan.status`; do not infer terminal state from LTV alone.

### Exposure derivation

- Use `summary.exposureByAsset` first.
- If absent or empty, derive from `loans[].collateral.token/valueUsd` only as `derived` and label where UI copy would otherwise imply API aggregate truth.
- Sort by numeric USD exposure descending when values parse safely; otherwise preserve API order.

### Audit derivation

- Prefer explicit `GET /events` response for full audit trail.
- `DashboardSummary.recentEvents` can seed a summary/recent-events widget when full events are unavailable, but it should not silently replace a failed `GET /events` section.
- Event payload rendering should whitelist known useful keys such as `attestationHash`, `proceedsCurrency`, `proceedsAmount`, `vaultAddress`, `receiptTokenId`, and `reason`; do not render raw payload JSON.

### Loan detail derivation

The detail view model should include:

- identity: loan ID, scenario, canonical status;
- participants: borrower, wallet, originator, funding partner;
- principal/collateral: principal amount/currency, collateral token/amount/value, vault address, deposit tx hash;
- terms: APR, tenor, repayment frequency, initial/margin/liquidation LTV, liquidation currency;
- risk: risk score, AML status, max LTV, assessment hash;
- receipt: token ID, owner wallet, soulbound status or empty state;
- payments: recent `InstallmentPaid` event highlights and/or attestation payload;
- liquidation: `liquidationPreview` with USDC proceeds distribution.

## Component Layout

### View-level components

Recommended structure:

```text
web/src/screens/InstitutionalDashboardScreen.tsx
web/src/components/DashboardViewToggle.tsx
web/src/components/PortfolioSummaryCards.tsx
web/src/components/PortfolioTable.tsx
web/src/components/RiskExposurePanel.tsx
web/src/components/AuditTrail.tsx
web/src/components/LoanDetailPanel.tsx
web/src/components/DataSourceBadge.tsx
```

For review control, large components can be introduced incrementally. Shared primitive components from Batch 3 (`MetricTile`, `StatusPill`, `KeyValueList`, `Alert`, formatting helpers) should be reused where appropriate.

### Screen composition

```text
InstitutionalDashboardScreen
 ├─ Dashboard hero/header
 │   ├─ title: Institutional dashboard
 │   ├─ subtitle: funder/originator portfolio guarantees
 │   ├─ Local Batch 2 API chip
 │   ├─ refresh button
 │   └─ DashboardViewToggle
 ├─ PortfolioSummaryCards
 │   ├─ capital utilized
 │   ├─ active loans
 │   ├─ active vaults
 │   ├─ margin/default exposure
 │   ├─ payments attested
 │   └─ liquidations executed
 ├─ Dashboard content grid
 │   ├─ PortfolioTable
 │   ├─ RiskExposurePanel
 │   └─ AuditTrail
 └─ LoanDetailPanel / drawer / side rail
```

### Layout strategy

Use a bounded data-product layout consistent with the current design language:

- `main.app-shell` may remain the top container.
- Add view-specific classes such as `dashboard-layout`, `dashboard-grid`, `dashboard-card`, and `dashboard-table`.
- Desktop: summary cards across the top, main table/risk/audit grid below, detail as side rail or inline right panel.
- Narrow screens: stack summary cards, table, risk, audit, then detail; no sticky floating sidebars that overlap content.
- Long identifiers should use monospace with wrapping/truncation and `title`/accessible labels.

### Portfolio table

Columns should remain demo-readable:

- loan ID or short ID;
- scenario label;
- borrower;
- status;
- principal;
- collateral;
- current LTV;
- vault/receipt indicator;
- action: inspect/view details.

Avoid a dense enterprise table. This is a hackathon dashboard; clarity beats completeness.

### Risk/exposure panel

Should show:

- average LTV;
- margin-call/default count;
- exposure by collateral asset;
- threshold explanation for selected loan when available;
- severity copy using positive/warning/danger semantics.

### Audit trail

Rows should show:

- event type;
- loan ID;
- timestamp;
- tx hash or block number when present;
- event ID;
- whitelisted payload highlights.

For missing chain evidence, show copy such as `Simulated evidence`, `No tx hash`, or `Pending chain evidence`; never fabricate explorer links.

### Loan detail panel

A drawer-style or right-rail detail panel is acceptable, but must be non-overlapping and keyboard-accessible. For Batch 4 speed, an inline panel under/next-to the table is safer than a modal drawer. If a drawer is used, it must manage focus and close behavior correctly.

Recommended for first implementation: inline detail panel inside the dashboard layout. It is easier to test and avoids modal accessibility risk.

## Routing And View Strategy

### Preferred approach for hackathon speed

Use a local view switch in `App.tsx` rather than adding a router dependency:

```ts
type AppView = 'borrower' | 'institutional';
```

Add accessible buttons or tabs in the header:

- `Borrower widget`
- `Institutional dashboard`

Default view options:

- For preserving Batch 3 behavior, default to borrower view.
- For demo presentation, a query/hash default such as `#dashboard` may be considered only if implemented without routing complexity.

### Why not a full router now

A router adds dependency/config/testing surface that is not needed for Batch 4 acceptance. The dashboard is a local demo view in one Vite app, and a tab-style boundary is sufficient.

### Borrower regression protection

When the borrower view is active:

- continue to use `useBorrowerJourney` exactly for borrower behavior;
- keep wallet connection in borrower view;
- keep existing borrower headings, labels, and status text stable where current tests depend on them.

When the institutional view is active:

- instantiate/use `useInstitutionalDashboard` separately;
- do not pass dashboard selected loan or mode into borrower journey;
- do not call borrower mutations.

If React hook rules make conditional hook usage awkward, extract `BorrowerWidgetView` and `InstitutionalDashboardView` child components and render one child by view.

## Fixture Fallback Policy

### Fixture boundaries

Allowed fixture uses:

- scenario/narrative labels for institutional vs crypto-native mode;
- empty-state helper copy;
- presentation-only fallback aggregate when a canonical field is absent or impossible to derive safely;
- deterministic sample metadata tied to `data/demo/loans.seed.json`.

Disallowed fixture uses:

- hiding failed required endpoint reads;
- replacing canonical loan status, event truth, tx hash, block number, payment evidence, or liquidation result;
- simulating backend writes or persistence;
- fabricating live on-chain finality.

### Source metadata

Every selector output that may be fixture-derived should carry source metadata:

```ts
source: 'api' | 'derived' | 'demo-fixture'
```

UI components should render `DataSourceBadge` for `demo-fixture` values and, where useful, `Derived from API loans` labels for derived values.

### Failure behavior

If `GET /dashboard/summary` fails but `GET /loans` succeeds, the dashboard can still show loan-derived sections, but the summary card area must show a summary-specific error. It must not present a fixture summary as live API-backed data.

## Accessibility And Error Handling

### Accessibility requirements

- View toggle must be keyboard reachable and expose selected state (`aria-pressed` or tab semantics).
- Refresh button must have an accessible name such as `Refresh institutional dashboard data`.
- Loading and refresh states should use polite live regions where appropriate.
- Errors should use `role="alert"` only for actionable failures, not for every informational badge.
- Tables should use semantic table markup when feasible; if cards are used for responsiveness, preserve row/label clarity.
- Detail panel should have a heading tied to selected loan identity.
- Long hashes/addresses should not be the only accessible label; include context like `Deposit transaction hash`.
- Color severity must be backed by text labels, not color alone.

### Error display

Use section-level error states:

- summary error;
- loans/portfolio error;
- events/audit error;
- selected-loan detail error;
- refresh error.

Safe display format:

```text
<CODE>: <message>
```

Do not render raw error objects, stack traces, raw payload JSON, environment variables, `.env` values, tokens, private keys, or secret-manager output.

### Empty states

Empty states should explain what is missing and how to recover:

- empty loans: `No demo loans returned by the local Batch 2 API` plus refresh guidance;
- no matching mode: `No institutional loans in this demo mode` plus switch option;
- no events: `No audit events yet` plus mention that events appear after API-simulated actions;
- no receipt/payment evidence: useful detail-level empty copy.

## Styling Strategy

Extend `web/src/styles/app.css` and reuse `web/src/styles/tokens.css` variables:

- surfaces: `--color-surface`, `--color-surface-alt`;
- borders: `--color-border`, `--color-border-strong`;
- accents: `--color-accent`, `--color-positive`, `--color-warning`, `--color-danger`;
- typography: `--font-sans`, `--font-mono`;
- radius/spacing tokens.

Do not introduce a separate visual system. Avoid gradients/blobs and avoid sticky/floating panels that could recreate the Batch 3 overlap problem.

## Testing And Strict TDD Plan

Strict TDD is active. Implementation must start each slice with failing tests and record RED/GREEN/TRIANGULATE/REFACTOR evidence in later `apply-progress.md`.

### Test commands

- Primary: `npm test -- --run`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Lint: `npm run lint`

### Slice-level coverage

#### 1. API client contract

Add/extend `web/src/api/client.test.ts` before implementation:

- `getDashboardSummary()` calls `GET /dashboard/summary`.
- Existing `listLoans`, `getLoan`, and `listEvents` paths remain unchanged.
- Query/path encoding remains safe.
- Canonical error parsing still works.

#### 2. Dashboard selectors

Add pure tests for:

- mode filtering for `SME_FIAT_WORKING_CAPITAL`, `WEB3_BRIDGE`, and `all`;
- active loan/vault counts;
- basis-point-to-percent display inputs;
- exposure sorting/grouping;
- API vs derived vs fixture source labels;
- audit payload highlight whitelisting;
- loan detail view model including USDC liquidation context.

#### 3. Dashboard state hook

Add tests for pure load helpers where possible:

- successful summary/loans/events load;
- partial failure preserving successful sections;
- refresh preserving last confirmed data;
- selected loan detail success/failure;
- demo mode not mutating canonical loans.

If hook tests become too heavy, extract pure async loaders such as `loadInstitutionalDashboard(client, current)` and test them directly, following the existing `loadBorrowerContext` pattern.

#### 4. Component tests

Add focused React Testing Library tests for:

- summary cards render capital/vault/risk/payment/liquidation metrics;
- portfolio table renders borrower, status, collateral, LTV, and inspect action;
- risk panel renders average LTV, margin-call count, exposure by asset;
- audit trail renders tx/block evidence and missing-evidence labels;
- loan detail renders participants, receipt/payment/liquidation context;
- fixture-derived values render `Demo data` labels.

#### 5. App regression tests

Extend `web/src/App.regression.test.tsx` or add `web/src/InstitutionalDashboard.regression.test.tsx`:

- app can switch to institutional dashboard;
- borrower view remains available and current Batch 3 assertions still pass;
- dashboard fetches canonical reads without invoking borrower mutation endpoints;
- switching dashboard mode does not break borrower widget state.

## Review Workload And Chained Delivery

The complete dashboard likely exceeds the 400 changed-line review budget because it touches API types/client tests, state/selectors, multiple components, App composition, styles, and regression tests.

Recommended chained delivery if implementation forecast remains above budget:

### PR/work unit 1 — API and state foundation

- API client `getDashboardSummary` and return types.
- Dashboard types/selectors.
- Dashboard loading state helpers/hook.
- Tests for API and selectors.
- Minimal placeholder screen only if needed to compile.

Expected risk: low/medium. Mostly pure logic and contracts.

### PR/work unit 2 — Dashboard UI core

- View switch in `App`.
- Institutional dashboard screen.
- Summary cards, portfolio table, risk panel.
- Component tests and styles.

Expected risk: medium. Main UI review burden.

### PR/work unit 3 — Audit/detail/demo mode polish

- Audit trail.
- Loan detail panel.
- Demo mode toggle.
- Fixture labels and App regression coverage.
- Final styling polish.

Expected risk: medium/high. More UX interactions and edge cases.

If hackathon speed requires one branch, keep implementation single-threaded and preserve strict tests, but pause before `sdd-apply` for explicit delivery strategy approval because the forecast exceeds the session review budget.

## Rollout Plan

1. Land dashboard behind a local in-app view switch so borrower widget remains default and recoverable.
2. Use canonical local Batch 2 API reads first.
3. Add fixture/derived labels only where required for demo clarity.
4. Verify with full commands.
5. In Batch 5, integrate with deployed contracts/addresses if available; do not force that into Batch 4.

## Rollback Plan

- Remove `InstitutionalDashboardScreen`, dashboard components, dashboard state/selectors, dashboard-specific tests/styles, and `getDashboardSummary` if no longer needed.
- Restore `App.tsx` to borrower-only composition.
- Leave Batch 2 backend and Batch 3 borrower code untouched.
- Run `npm test -- --run`, `npm run typecheck`, `npm run build`, and `npm run lint`.

## Open Decisions For Tasks Phase

1. Delivery strategy: one hackathon branch vs chained PR/work units. Forecast suggests chained delivery.
2. Default app view: preserve borrower default, or use dashboard default for demo presentation.
3. Detail presentation: inline detail panel recommended; drawer acceptable only if accessibility/focus cost is accepted.
4. Fixture file location: prefer `web/src/state/dashboardFixtures.ts` if presentation fallback is needed.
5. Whether to type existing API methods generically or keep casts in state modules; recommendation is to tighten client return types for dashboard reads.

## Non-Goals Reaffirmed

This design does not implement production code and does not add:

- new backend endpoints;
- production persistence;
- auth/RBAC;
- real KYC/fiat/payment rails;
- real Wavy Node/oracle/indexer integration;
- real DEX liquidation or chain settlement;
- secret handling or `.env` reads.

## Skill Resolution

injected
