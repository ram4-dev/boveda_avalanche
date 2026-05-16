# Dashboard and Events Specification

## Purpose

Provide a traceable institutional dashboard and event feed derived from seeded/current loan state and accepted demo events.

## Requirements

### Requirement: Event Feed Reflects Accepted Demo Mutations

The system MUST expose application and on-chain-like events through `GET /events` using the canonical `OnChainEvent` schema and canonical `EventType` values.

#### Scenario: List all recorded events

- GIVEN lifecycle, payment, margin-call, or liquidation mutations have been accepted
- WHEN a client requests `GET /events`
- THEN the response MUST include events with `eventId`, `eventType`, `loanId`, `occurredAt`, and `payload`
- AND each event type MUST be one of the enum values in `docs/demo/openapi.yaml`.

#### Scenario: Filter events by loan

- GIVEN events exist for multiple loans
- WHEN a client requests `GET /events?loanId=loan-web3-001`
- THEN every returned event MUST have `loanId = loan-web3-001`.

### Requirement: Dashboard Summary Is Derived From Traceable State

The system MUST compute `GET /dashboard/summary` from the current loan state plus recorded events, not from unrelated hard-coded summary values.

#### Scenario: Dashboard summary includes canonical metrics

- GIVEN the backend has loaded seeded loans and recorded any accepted mutations
- WHEN a client requests `GET /dashboard/summary`
- THEN the response MUST include `activePrincipalUsd`, `activeVaults`, `averageLtvBps`, `loansInMarginCall`, `paymentsAttested`, `liquidationsExecuted`, `exposureByAsset`, and `recentEvents`
- AND each metric MUST be explainable from current loans and event history.

#### Scenario: Payment and liquidation mutations update dashboard counters

- GIVEN a loan has an accepted `InstallmentPaid` event and another loan has an accepted `Liquidated` event
- WHEN a client requests `GET /dashboard/summary`
- THEN `paymentsAttested` MUST include the accepted payment event
- AND `liquidationsExecuted` MUST include the accepted liquidation event
- AND `recentEvents` MUST include recent accepted events.

### Requirement: Manual Post-Transaction Refresh Path

The system MUST support a demo refresh path that reconciles backend state with mock web3 transaction outcomes without requiring a production indexer or adding non-canonical public API endpoints.

#### Scenario: Mock transaction outcome becomes visible after refresh

- GIVEN a mock web3 action has produced a transaction outcome for activation, payment registration, or liquidation
- WHEN the backend performs its manual or request-driven refresh path
- THEN subsequent `GET /events`, `GET /loans/{loanId}`, and `GET /dashboard/summary` responses MUST reflect the refreshed event and loan state.
