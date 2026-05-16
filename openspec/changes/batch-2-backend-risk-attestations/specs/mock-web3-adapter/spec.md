# Mock Web3 Adapter Boundary Specification

## Purpose

Keep Batch 2 mock-first while preserving a stable boundary for later Avalanche Fuji contract ABI and address integration.

## Requirements

### Requirement: Mock-First Contract Boundary

The system MUST route loan activation, payment registration, and liquidation contract-like actions through a replaceable web3 boundary while keeping the public HTTP API contract unchanged.

#### Scenario: Public API does not change between mock and real adapter modes

- GIVEN the backend is configured with the Batch 2 mock adapter
- WHEN a client calls activation, payment attestation, or liquidation endpoints
- THEN the request and response schemas MUST match `docs/demo/openapi.yaml`
- AND replacing the mock adapter with a future real adapter MUST NOT require different public paths, enum values, or response shapes.

### Requirement: Local Demo Does Not Require Real Chain Credentials

The system MUST complete the canonical demo flow with mock web3 behavior when real ABI files, contract addresses, RPC credentials, or private keys are unavailable.

#### Scenario: Activate a loan without real chain configuration

- GIVEN a loan is `Approved` and collateral deposit data has been recorded
- AND no real contract ABI/address configuration is available
- WHEN the client calls `POST /loans/{loanId}/activate`
- THEN the backend MUST activate the loan using mock web3 behavior
- AND the returned loan MUST include a receipt with `soulbound = true`.

### Requirement: Mock Web3 Outcomes Are Traceable

The system MUST expose mock web3 outcomes as canonical loan state changes and events so the demo remains auditable.

#### Scenario: Liquidation through mock web3 records a canonical event

- GIVEN a loan is eligible for liquidation
- WHEN the client calls `POST /loans/{loanId}/liquidate` in mock mode
- THEN the backend MUST return a canonical `LiquidationResult`
- AND it MUST record a `Liquidated` event containing transaction evidence when available and proceeds in `USDC`.

### Requirement: Adapter Failures Preserve Loan Consistency

The system MUST preserve existing loan state and avoid success events when a web3 boundary action cannot be completed or simulated.

#### Scenario: Failed activation does not issue a receipt

- GIVEN a loan is `Approved`
- WHEN the web3 boundary cannot complete or simulate activation
- THEN the backend MUST reject the activation outcome
- AND the loan MUST remain `Approved`
- AND no `LoanActivated` or `ReceiptIssued` success event MUST be recorded.
