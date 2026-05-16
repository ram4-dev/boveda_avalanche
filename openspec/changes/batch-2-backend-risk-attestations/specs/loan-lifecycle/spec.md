# Loan Lifecycle Specification

## Purpose

Coordinate demo loan creation, approval, collateral deposit, activation, margin call, repayment, default, cancellation, and liquidation according to the shared state machine.

## Requirements

### Requirement: Loan Creation Starts In Requested State

The system MUST create loans through `POST /loans` using the canonical `CreateLoanRequest` schema, assign or preserve a unique loan identifier, set the initial status to `Requested`, and record a `LoanCreated` event.

#### Scenario: Create a new loan request

- GIVEN a valid borrower, originator, funding partner, principal, collateral, terms, and accepted `riskAssessmentId`
- WHEN the client calls `POST /loans`
- THEN the response status MUST be `201`
- AND the returned loan MUST have `status = Requested`
- AND a `LoanCreated` event MUST be visible through `GET /events?loanId={loanId}`.

### Requirement: Allowed Lifecycle Transitions

The system MUST enforce the state transitions defined in `docs/demo/states-events.md` for all lifecycle mutation endpoints.

#### Scenario: Approve, deposit collateral, and activate a requested loan

- GIVEN a loan is in `Requested` status
- WHEN the client calls `POST /loans/{loanId}/approve`
- THEN the loan MUST move to `Approved` and a `LoanApproved` event MUST be recorded
- WHEN the client calls `POST /loans/{loanId}/collateral/deposit`
- THEN collateral transaction details MUST be recorded and the loan MUST remain `Approved`
- WHEN the client calls `POST /loans/{loanId}/activate`
- THEN the loan MUST move to `Active` and `LoanActivated` MUST be recorded.

#### Scenario: Margin call and liquidation follow allowed paths

- GIVEN a loan is `Active`
- WHEN the client calls `POST /loans/{loanId}/margin-call` with an LTV above the margin-call threshold
- THEN the loan MUST move to `MarginCall` and a `MarginCall` event MUST be recorded
- WHEN the client calls `POST /loans/{loanId}/liquidate` with `proceedsCurrency = USDC`
- THEN the loan MUST move to `Liquidated` and a `Liquidated` event MUST be recorded.

#### Scenario: Invalid transition does not mutate state

- GIVEN a loan is in a terminal state of `Repaid`, `Liquidated`, or `Cancelled`
- WHEN a client calls a lifecycle mutation that is not allowed from that state
- THEN the backend MUST reject the transition
- AND the loan status and event history MUST remain unchanged by that rejected request.

### Requirement: Terminal State Safety

The system MUST treat `Repaid`, `Liquidated`, and `Cancelled` as terminal demo states.

#### Scenario: Terminal loan remains immutable to lifecycle mutations

- GIVEN a loan has reached `Liquidated`
- WHEN a client attempts to approve, activate, margin-call, attest payment against, or liquidate it again
- THEN the backend MUST return a non-success outcome
- AND MUST NOT record a success event for the attempted mutation.

### Requirement: Liquidation Proceeds Are Always USDC

The system MUST require and return `USDC` as the proceeds currency for liquidation requests, results, previews, and `Liquidated` events.

#### Scenario: Liquidate with USDC proceeds

- GIVEN a loan is eligible for liquidation
- WHEN the client calls `POST /loans/{loanId}/liquidate` with `proceedsCurrency = USDC`
- THEN the response MUST have `status = Liquidated`
- AND `proceedsCurrency` MUST equal `USDC`
- AND the event payload MUST report the distribution in USDC terms.
