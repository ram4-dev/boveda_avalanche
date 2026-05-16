# Payment Attestations Specification

## Purpose

Represent off-chain fiat payments as deterministic backend attestations that can be traced in API responses and later registered on-chain.

## Requirements

### Requirement: Canonical Payment Attestation Endpoint

The system MUST create payment attestations through `POST /loans/{loanId}/payments/attest` using the canonical `PaymentAttestationRequest` and `PaymentAttestation` schemas.

#### Scenario: Attest a partial installment payment

- GIVEN a loan is `Active` with outstanding principal
- WHEN the client calls `POST /loans/{loanId}/payments/attest` with `installmentId`, `amount`, `currency`, `paymentRail`, `paidAt`, and optional `externalPaymentRef`
- THEN the response MUST include `loanId`, `installmentId`, `amount`, `currency`, `attestationHash`, `remainingPrincipal`, and resulting `status`
- AND the loan MUST remain `Active` when outstanding principal remains.

#### Scenario: Attest a final payment

- GIVEN a loan is `Active` or `MarginCall` and the attested payment fully repays the outstanding principal
- WHEN the payment is attested
- THEN the response status MUST be `Repaid`
- AND subsequent loan reads MUST show the loan as `Repaid`.

### Requirement: Deterministic Attestation Hash

The system MUST generate a reproducible attestation hash for the canonical payment payload so the same payment evidence can be verified in tests and later submitted to a contract adapter.

#### Scenario: Same payment evidence produces the same hash

- GIVEN the same `loanId`, `installmentId`, `amount`, `currency`, `paymentRail`, `paidAt`, and `externalPaymentRef`
- WHEN the payment is attested more than once against the same current demo state
- THEN the attestation hash MUST be reproducible for that evidence
- AND changing any payment evidence field MUST produce a distinguishable attestation hash.

### Requirement: InstallmentPaid Event Recording

The system MUST record an `InstallmentPaid` event whenever a payment attestation is accepted.

#### Scenario: Accepted payment appears in the event log

- GIVEN a payment attestation request is accepted for a loan
- WHEN the client requests `GET /events?loanId={loanId}`
- THEN the event list MUST include an `InstallmentPaid` event containing the installment ID, payment amount, currency, payment rail, attestation hash, remaining principal, and resulting loan status.

### Requirement: Payment Attestation State Safety

The system MUST reject payment attestations for terminal loans and MUST NOT mutate principal or events when payment evidence is rejected.

#### Scenario: Cannot attest payment after liquidation

- GIVEN a loan is `Liquidated`
- WHEN the client calls `POST /loans/{loanId}/payments/attest`
- THEN the backend MUST reject the attestation
- AND the loan principal, status, and event history MUST remain unchanged.
