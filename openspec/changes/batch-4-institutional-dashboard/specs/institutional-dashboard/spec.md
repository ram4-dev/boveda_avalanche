# Institutional Dashboard Specification

## Purpose

Define the accepted Batch 4 institutional dashboard behavior for the Bóveda Avalanche hackathon demo. The dashboard helps a funder, originator, or institutional partner understand portfolio health, verifiable collateral, LTV/risk exposure, attested payments, audit evidence, and programmatic liquidation using the canonical Batch 2 API and the committed Batch 3 frontend baseline.

## Requirements

### Requirement: Canonical API Contract Consumption

The system MUST consume `docs/demo/openapi.yaml` as the canonical API contract for institutional-dashboard behavior. The system MUST use the documented Batch 2 read endpoints for dashboard, events, loans, and loan detail data before using fixtures. The system MUST NOT invent alternative endpoint paths, mutate backend state for read-only dashboard presentation, or reimplement Batch 2 dashboard/event/loan business logic in frontend code.

#### Scenario: Load dashboard data from canonical read endpoints

- GIVEN the local demo API is available
- WHEN the institutional dashboard starts
- THEN it MUST request portfolio summary through `GET /dashboard/summary`
- AND it MUST request portfolio loans through `GET /loans`
- AND it MUST request audit events through `GET /events`
- AND it MAY request selected loan details through `GET /loans/{loanId}` when a loan is opened or selected.

#### Scenario: Respect OpenAPI when product prose differs

- GIVEN `boveda_plan_funcional_tareas_hackathon.md` and `docs/demo/openapi.yaml` describe related dashboard behavior differently
- WHEN implementation selects endpoint paths, enum values, or response fields
- THEN `docs/demo/openapi.yaml` MUST be treated as canonical
- AND the UI MUST adapt to canonical fields such as `DashboardSummary`, `Loan`, and `OnChainEvent` instead of requiring undocumented backend changes.

#### Scenario: Avoid frontend-only backend semantics

- GIVEN dashboard summary, loan, or event data is returned by the API
- WHEN the dashboard derives display metrics
- THEN derivations MUST be limited to presentation concerns such as formatting, grouping, filtering, and fixture labeling
- AND the system MUST NOT locally change loan status, payment status, liquidation outcome, or event truth unless the value is explicitly marked as demo fixture data.

### Requirement: Institutional Dashboard Layout (B4.1)

The system MUST provide an institutional dashboard layout with clear hierarchy, first-screen portfolio signal, summary cards, a portfolio table, a risk section, an audit trail, and a loan detail area or drawer. The layout MUST follow `DESIGN.md` and existing Batch 3 tokens/styles, and MUST avoid floating or overlapping panels, raw JSON dumps, decorative blobs, and oversized empty cards.

#### Scenario: Render base institutional dashboard

- GIVEN dashboard summary, loans, and events have loaded successfully
- WHEN a user opens the institutional dashboard view
- THEN the dashboard MUST show a title or context indicating that this is the institutional/funder view
- AND it MUST show summary cards before lower-priority details
- AND it MUST show a portfolio table
- AND it MUST show a risk/LTV section
- AND it MUST show an audit-trail section
- AND it MUST provide a way to inspect an individual loan.

#### Scenario: Preserve useful first screen

- GIVEN a judge or funder views the dashboard without technical narration
- WHEN the first viewport is rendered
- THEN it MUST communicate capital deployed, active loan/vault context, current portfolio risk, payment attestation evidence, and traceable event evidence
- AND it SHOULD keep secondary implementation details in the table, detail view, or audit trail rather than crowding the hero area.

#### Scenario: Keep responsive data-product layout

- GIVEN the dashboard is viewed on a desktop-sized viewport or a narrower demo viewport
- WHEN layout styles are applied
- THEN summary cards, table, risk section, audit trail, and detail content MUST remain readable
- AND long identifiers such as loan IDs, wallet addresses, tx hashes, vault addresses, and assessment hashes MUST wrap, truncate with accessible labels, or use readable monospace formatting without breaking layout.

### Requirement: Portfolio Widgets (B4.2)

The system MUST show portfolio widgets for institutional decision-making. At minimum, the dashboard MUST display capital utilized, active loans, active vaults, and delinquency/default or margin-call exposure. The system SHOULD use `GET /dashboard/summary` fields where available and MAY derive active loan counts or delinquency/default counts from `GET /loans` when those aggregate values are absent.

#### Scenario: Show capital utilized and active vaults

- GIVEN `GET /dashboard/summary` returns `activePrincipalUsd` and `activeVaults`
- WHEN the summary cards render
- THEN the dashboard MUST show active principal/capital utilized in readable money format
- AND it MUST show active vault count
- AND it MUST not relabel these fields as live production TVL unless the API provides that meaning.

#### Scenario: Show active loans from API data

- GIVEN `GET /loans` returns loans with canonical `status` values
- WHEN the portfolio widgets render
- THEN the dashboard MUST show active loan count using canonical active states such as `Active` and `MarginCall`
- AND it MAY distinguish approved/requested pipeline loans from active deployed loans
- AND it MUST keep terminal states such as `Repaid`, `Liquidated`, `Cancelled`, and `Defaulted` visibly distinct when counted or displayed.

#### Scenario: Show delinquency or margin/default exposure

- GIVEN `GET /dashboard/summary` returns `loansInMarginCall`
- OR `GET /loans` returns loans in `MarginCall` or `Defaulted` status
- WHEN portfolio risk widgets render
- THEN the dashboard MUST show margin-call/default exposure in a prominent card or label
- AND it MUST distinguish healthy exposure from loans needing action.

### Requirement: LTV And Risk Widget (B4.3)

The system MUST show a risk section with average LTV, loans in margin call, and exposure by collateral asset. The system MUST display LTV values as percentages derived from basis points, MUST preserve liquidation currency as `USDC`, and MUST explain threshold context when loan-level terms are available.

#### Scenario: Display average LTV and margin-call count

- GIVEN `GET /dashboard/summary` returns `averageLtvBps` and `loansInMarginCall`
- WHEN the risk section renders
- THEN the dashboard MUST display average LTV as a percentage
- AND it MUST display loans in margin call as a count
- AND it SHOULD include visual severity that distinguishes healthy, warning, and critical risk states.

#### Scenario: Display exposure by asset

- GIVEN `GET /dashboard/summary` returns `exposureByAsset` entries with `asset` and `valueUsd`
- WHEN exposure breakdown renders
- THEN the dashboard MUST show each collateral asset and USD exposure value
- AND it SHOULD sort or group entries so the largest or most important exposures are easy to scan
- AND it MUST show an empty or unavailable state if no exposure entries are returned.

#### Scenario: Explain loan-level threshold context

- GIVEN a selected loan includes `currentMetrics.currentLtvBps`, `terms.marginCallLtvBps`, and `terms.liquidationLtvBps`
- WHEN the dashboard displays loan-level risk
- THEN it MUST show current LTV, margin-call threshold, and liquidation threshold as percentages
- AND it MUST make clear whether the loan is healthy, in margin call, defaulted, liquidated, or already repaid based on canonical API status.

### Requirement: Audit Trail (B4.4)

The system MUST show an audit trail based on canonical `OnChainEvent` records from `GET /events` and/or `DashboardSummary.recentEvents`. Audit rows MUST include event type, loan ID, occurrence time, and available traceability evidence such as tx hash or block number. Missing chain evidence MUST be shown honestly as unavailable or simulated rather than hidden.

#### Scenario: Render canonical audit events

- GIVEN `GET /events` returns `events` containing `eventId`, `eventType`, `loanId`, `occurredAt`, and `payload`
- WHEN the audit trail renders
- THEN each row MUST show event type, loan ID, and occurred-at timestamp
- AND it MUST show event ID or an equivalent trace identifier
- AND it SHOULD show relevant payload highlights without dumping raw JSON.

#### Scenario: Show tx hash and block evidence when available

- GIVEN an event includes non-null `txHash` or `blockNumber`
- WHEN the event row renders
- THEN the dashboard MUST display the tx hash and/or block number as trace evidence
- AND it MAY render a link only when a safe deterministic explorer URL is available without secrets or environment reads.

#### Scenario: Label missing chain evidence honestly

- GIVEN an event has null or absent `txHash` and null or absent `blockNumber`
- WHEN the event row renders
- THEN the dashboard MUST show a clear unavailable, pending, or simulated-evidence label
- AND it MUST NOT fabricate tx hashes, block numbers, explorer links, or on-chain finality.

#### Scenario: Filter audit trail by selected loan

- GIVEN a user selects a loan from the portfolio table
- WHEN loan-specific audit evidence is shown
- THEN the system MAY call `GET /events?loanId={loanId}` if supported by the API client
- AND it MUST show only events for that loan in the detail context
- AND it MUST keep the broader audit trail available or recoverable.

### Requirement: Loan Detail View (B4.5)

The system MUST provide a loan detail view, drawer, or equivalent inspection area for a selected loan. The detail view MUST show loan ID, scenario, borrower wallet, borrower/originator/funding partner names, collateral, principal, terms, current metrics, payment/attestation evidence when present, receipt context when present, current status, and liquidation preview/result context.

#### Scenario: Open loan detail from portfolio table

- GIVEN the portfolio table contains at least one loan
- WHEN a user selects or inspects a loan
- THEN the system MUST show loan detail for that loan
- AND it MUST use `GET /loans/{loanId}` when a fresh detail request is needed
- AND it MUST preserve the selected loan identity if the detail request is refreshing.

#### Scenario: Show participant and collateral details

- GIVEN a selected loan contains borrower, originator, funding partner, principal, collateral, and terms
- WHEN the detail view renders
- THEN it MUST show loan ID, scenario, borrower display name, borrower wallet, originator display name, funding partner display name, principal amount/currency, collateral token/amount/value, vault address when present, deposit tx hash when present, APR, tenor, repayment frequency, margin-call threshold, liquidation threshold, and liquidation currency.

#### Scenario: Show receipt and payment evidence

- GIVEN a selected loan includes a `receipt`, `InstallmentPaid` event, or payment attestation evidence in recent events
- WHEN the detail view renders
- THEN it MUST show receipt token ID, owner wallet, and soulbound status when a receipt exists
- AND it MUST show payment evidence such as installment ID, amount, currency, attestation hash, or related event payload highlights when present
- AND it MUST show a useful empty state when no payment or receipt evidence exists yet.

#### Scenario: Show liquidation context in USDC

- GIVEN a selected loan contains `liquidationPreview`
- WHEN liquidation context renders
- THEN the dashboard MUST show proceeds amount, proceeds currency, and proceeds distribution
- AND proceeds currency MUST be displayed as `USDC`
- AND funding partner amount, originator fee amount, and borrower remainder amount MUST be distinguishable.

### Requirement: Dual Demo Mode Toggle (B4.6)

The system MUST provide a dual demo mode toggle between an institutional/traditional scenario and a crypto-native scenario. The toggle MUST change the narrative lens or loan filtering using canonical `LoanScenario` values where available, and MUST NOT mutate canonical backend data.

#### Scenario: Select institutional/traditional demo mode

- GIVEN the portfolio contains loans with scenario `SME_FIAT_WORKING_CAPITAL`
- WHEN the user selects the institutional or traditional demo mode
- THEN the dashboard MUST prioritize or filter the dashboard narrative toward those loans
- AND it SHOULD emphasize originator/funding partner, fiat rail, collateralized credit, portfolio risk, and attested payment guarantees.

#### Scenario: Select crypto-native demo mode

- GIVEN the portfolio contains loans with scenario `WEB3_BRIDGE`
- WHEN the user selects crypto-native demo mode
- THEN the dashboard MUST prioritize or filter the dashboard narrative toward those loans
- AND it SHOULD emphasize wallet identity, token collateral, vault evidence, receipt context, and liquidation programmability.

#### Scenario: Handle missing scenario data

- GIVEN the selected demo mode has no matching loans
- WHEN the dashboard applies the mode
- THEN it MUST show a clear empty or unavailable state for that mode
- AND it MUST offer a way to switch back or show all available demo data
- AND it MUST NOT fabricate canonical loans for the missing mode unless explicitly labeled as demo fixture data.

### Requirement: Fixture Fallback And Demo Data Labeling

The system MAY use deterministic fixtures only where the canonical Batch 2 API lacks aggregate dashboard data or presentation labels needed for demo clarity. Fixture-derived values MUST be isolated from API transport, visibly labeled as `Demo data` or equivalent, and MUST NOT mask required endpoint failures.

#### Scenario: Label fixture-derived aggregate values

- GIVEN an aggregate value is derived from `data/demo/loans.seed.json` or a Batch 4 frontend fixture instead of `GET /dashboard/summary`
- WHEN that value appears in a card, table, risk section, audit trail, or detail view
- THEN the UI MUST visibly label the value or section as demo data
- AND tests MUST be able to distinguish API-derived values from fixture-derived values.

#### Scenario: Do not hide required endpoint failures behind fixtures

- GIVEN `GET /dashboard/summary`, `GET /loans`, or `GET /events` fails
- WHEN fixture fallback exists for a secondary presentation value
- THEN the dashboard MUST still show the affected API failure state
- AND it MUST NOT present the entire dashboard as live API-backed data.

#### Scenario: Keep fixtures deterministic and non-mutating

- GIVEN the dashboard uses fixture fallback for missing labels, demo narrative text, or aggregate presentation
- WHEN the user changes demo mode, selects loans, refreshes data, or opens detail
- THEN fixture use MUST remain deterministic
- AND it MUST NOT mutate API responses, local canonical loan status, event truth, or backend state.

### Requirement: Loading, Empty, Refresh, And Error States

The system MUST provide explicit loading, empty, refreshing, partial-success, and error states for dashboard summary, loans, events, and selected loan detail. Error displays MUST be safe and readable, SHOULD surface canonical API `error.code` and `error.message` when available, and MUST NOT dump raw JSON or expose secrets.

#### Scenario: Initial dashboard loading

- GIVEN the institutional dashboard has not completed initial reads
- WHEN summary, loans, and events requests are pending
- THEN the dashboard MUST show stable loading UI for the affected sections
- AND it MUST avoid layout jumps that obscure the first-screen dashboard structure.

#### Scenario: Empty portfolio

- GIVEN `GET /loans` succeeds with an empty list
- WHEN the portfolio table renders
- THEN the dashboard MUST show an empty portfolio state
- AND summary, risk, and audit sections MUST either show available data or clearly explain unavailable dependencies.

#### Scenario: Partial dashboard failure

- GIVEN one dashboard read succeeds and another fails
- WHEN the dashboard renders
- THEN the successful section SHOULD remain visible
- AND the failed section MUST show a section-specific error and retry or refresh guidance
- AND the dashboard MUST NOT collapse into a blank screen.

#### Scenario: Refresh preserves last confirmed data

- GIVEN the dashboard has already loaded data
- WHEN a refresh is in progress or fails
- THEN the dashboard SHOULD keep last confirmed summary, portfolio, audit, and selected loan data visible where safe
- AND it MUST show refresh progress or failure near the affected area.

### Requirement: Batch 3 Borrower Widget Regression Protection

The system MUST preserve the committed Batch 3 borrower widget behavior while adding the institutional dashboard. Batch 4 MUST extend the frontend with a dashboard view, route, mode, or composition boundary without breaking borrower wallet connection, offer display, deposit/activation, payment, margin/liquidation UI, event timeline, API client behavior, or existing tests.

#### Scenario: Borrower widget remains available

- GIVEN Batch 4 dashboard code is present
- WHEN the app renders the borrower-widget path, mode, or baseline composition
- THEN the borrower offer/request screen MUST remain available
- AND wallet connection, quote, risk, deposit/activation, payment, margin call, liquidation, and event timeline controls MUST remain functionally equivalent to Batch 3 expectations.

#### Scenario: Dashboard state does not pollute borrower state

- GIVEN a user changes institutional demo mode, selects dashboard loans, opens dashboard detail, or refreshes dashboard data
- WHEN the borrower widget is rendered again
- THEN borrower journey state MUST NOT be overwritten by dashboard-only selection, fixture labels, or institutional filters
- AND canonical borrower API mutations MUST continue to use their documented Batch 3 paths.

#### Scenario: Existing tests remain green

- GIVEN Batch 4 implementation is complete
- WHEN verification runs `npm test -- --run`, `npm run typecheck`, `npm run build`, and `npm run lint`
- THEN existing Batch 2 backend tests and Batch 3 frontend tests MUST remain green
- AND new dashboard tests MUST be added for API client contracts, dashboard state derivations, component rendering, fixture labels, and App-level regression coverage.

### Requirement: Security And Non-Goals

The system MUST NOT require or inspect secrets for the institutional dashboard. The system MUST NOT implement real KYC, fiat rails, production persistence, authentication/RBAC, production oracle/indexer behavior, DEX liquidation, real Wavy Node integration, or real chain settlement as part of Batch 4 unless a later approved SDD change explicitly expands scope.

#### Scenario: Dashboard runs without secrets

- GIVEN no `.env`, private key, seed phrase, wallet secret, credential, token, or secret manager output is available
- WHEN the institutional dashboard loads local demo API data
- THEN it MUST still render API-backed or honestly labeled demo information
- AND it MUST NOT prompt for or read secret material.

#### Scenario: Avoid unauthorized backend expansion

- GIVEN a desired dashboard value is not available from the canonical Batch 2 endpoints
- WHEN implementation plans the value
- THEN it MUST prefer deterministic fixture labeling or frontend presentation derivation
- AND it MUST NOT add new backend endpoints, persistence, auth, or schema rewrites without explicit approval in later SDD phases.

## Acceptance Summary

- The dashboard MUST communicate to a funder/originator that collateral is verifiable, portfolio LTV/risk is understandable, payments are attested, audit events are traceable, and liquidation is programmatic.
- The dashboard MUST cover B4.1 through B4.6 using canonical Batch 2 API reads first.
- Fixture-derived data MUST be deterministic, isolated, and visibly labeled.
- Loading, empty, partial failure, and refresh states MUST be safe and useful.
- Batch 3 borrower widget behavior and tests MUST not regress.
- Batch 4 implementation MUST follow strict TDD in later phases; this spec does not implement production code.
