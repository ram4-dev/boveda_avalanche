# E2E Demo Flows Specification

## Purpose

Define Batch 5 acceptance behavior for the complete hackathon demo flow: happy origination, payment attestation, liquidation, and cross-surface evidence visibility in both real Fuji-backed mode and deterministic mock/demo mode.

## Requirements

### Requirement: Happy Origination E2E Evidence

The system MUST support a demonstrable happy origination path from loan creation or selection through collateral deposit, loan activation, and receipt or transaction evidence. The flow MUST preserve canonical API and state/event semantics unless a later approved design identifies a minimal explicit blocker.

For real Fuji mode, collateral deposit evidence MUST be backend-verified from chain state/logs before it is credited. A frontend wallet popup, client-supplied token amount, or client-supplied transaction hash is not sufficient proof. The selected real collateral token for Batch 5 is **WAVAX on Fuji**; liquidation proceeds remain **USDC**.

#### Scenario: Fuji-backed happy origination produces live evidence when prerequisites exist

- GIVEN the application is operating at `/` with external Fuji runtime prerequisites supplied
- AND a borrower selects or creates an eligible loan whose collateral token is the confirmed Fuji WAVAX contract
- WHEN the borrower completes WAVAX collateral deposit and activation
- THEN the backend MUST verify `LoanRegistry.getLoan(loanId)`, the transaction receipt, vault `CollateralDeposited` logs, ERC-20 `Transfer` logs, and `CollateralVault.getVault(loanId)` before crediting collateral as live
- AND the verified borrower, WAVAX token contract, vault recipient, amount, loan ID, and Fuji chain context MUST match the requested loan terms
- AND the loan MUST reach the accepted active state according to canonical lifecycle semantics
- AND the UI or event surfaces MUST show collateral deposit, activation, and receipt or transaction evidence
- AND live transaction/event evidence SHOULD include explorer links when safe deterministic links are available.

#### Scenario: Demo happy origination remains deterministic

- GIVEN the application is operating at `/demo`
- AND deterministic mock/demo state is available
- WHEN the borrower completes the origination path
- THEN the loan MUST reach the expected active demo state
- AND collateral deposit, activation, and receipt evidence MUST be visible
- AND every generated tx, event, or receipt marker MUST be labeled as simulated demo evidence.

#### Scenario: Origination evidence is testable without live chain access

- GIVEN strict TDD tests exercise the happy origination flow with deterministic adapters
- WHEN tests complete collateral deposit and activation
- THEN they MUST be able to assert active loan state, receipt or transaction evidence, mode labels, and event feed updates
- AND they MUST NOT require live secrets or external Fuji availability.

### Requirement: Payment Attestation E2E Evidence

The system MUST support a demonstrable payment attestation path in which borrower-facing surfaces, dashboard surfaces, and event feed surfaces show consistent evidence for an installment payment or equivalent accepted payment action.

#### Scenario: Fuji-backed payment attestation shows live evidence

- GIVEN a loan is active in `/` Fuji-backed mode
- WHEN a borrower completes a payment action that produces attestation evidence
- THEN the borrower UI MUST show the payment result and attestation hash, transaction hash, receipt, or event evidence returned by the system
- AND the institutional dashboard and event feed MUST reflect the same loan ID and payment evidence
- AND live evidence SHOULD include safe explorer links when available.

#### Scenario: Demo payment attestation shows simulated evidence

- GIVEN a loan is active in `/demo`
- WHEN a borrower completes the demo payment action
- THEN the borrower UI MUST show the payment result and simulated attestation marker
- AND the institutional dashboard and event feed MUST show corresponding simulated payment evidence
- AND the evidence MUST NOT be represented as live Fuji finality.

#### Scenario: Missing payment evidence is visible

- GIVEN a payment action succeeds at the business-state level but live transaction or event evidence is pending or unavailable
- WHEN borrower or dashboard surfaces render the result
- THEN they MUST show the accepted payment state and a clear pending or unavailable evidence label
- AND they MUST NOT fabricate hashes, blocks, receipts, events, or explorer links.

### Requirement: Liquidation E2E Evidence

The system MUST support a demonstrable liquidation path using an LTV or default trigger, liquidation outcome, USDC proceeds, and dashboard/event visibility. The system MUST preserve canonical state/event semantics and MUST report liquidation proceeds in `USDC`.

#### Scenario: Liquidation by LTV or default trigger is visible

- GIVEN a loan is eligible for margin-call, default, or liquidation behavior under canonical demo semantics
- WHEN a presenter or accepted flow triggers liquidation
- THEN the system MUST show the trigger context such as current LTV, threshold breach, missed/defaulted payment, or canonical status
- AND it MUST show the liquidation outcome and final or pending loan state.

#### Scenario: Liquidation proceeds are reported in USDC

- GIVEN liquidation evidence includes proceeds or distribution values
- WHEN the borrower UI, dashboard, event feed, or runbook displays liquidation results
- THEN proceeds currency MUST be displayed as `USDC`
- AND funding partner amount, originator fee amount, and borrower remainder amount MUST be distinguishable when those values are available.

#### Scenario: Live and simulated liquidation evidence stay separate

- GIVEN liquidation is executed in `/` with live Fuji evidence available
- WHEN liquidation evidence is rendered
- THEN live transaction, event, block, contract, or explorer evidence SHOULD be displayed safely
- AND if liquidation is executed in `/demo`, the evidence MUST be labeled as simulated and MUST NOT link to fabricated live finality.

### Requirement: Cross-Surface Evidence Consistency

For origination, payment, and liquidation flows, the borrower UI, institutional dashboard, and event feed MUST agree on the loan identity, active runtime mode, evidence source, and canonical state transition outcomes.

#### Scenario: Same loan evidence appears across surfaces

- GIVEN a borrower completes origination, payment, or liquidation flow
- WHEN the dashboard and event feed refresh or render the affected loan
- THEN they MUST refer to the same loan ID as the borrower surface
- AND they MUST show compatible state, event type, amount, currency, tx/hash/receipt marker, and evidence-source labels.

#### Scenario: Evidence links are only created from real evidence

- GIVEN an evidence item lacks a live transaction hash, block number, event source, or deterministic public explorer target
- WHEN any UI or report renders the item
- THEN the system MUST show unavailable, pending, or simulated status as appropriate
- AND it MUST NOT create a misleading explorer link.
