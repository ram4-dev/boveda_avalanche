# Demo API Specification

## Purpose

Expose the Batch 2 demo backend through the canonical OpenAPI contract so frontends, tests, and later contract integrations use one stable API surface.

## Requirements

### Requirement: Canonical API Surface

The system MUST expose the public HTTP paths and operation semantics defined in `docs/demo/openapi.yaml` for Batch 2 and MUST treat that OpenAPI file as canonical when other plan prose differs.

#### Scenario: Health check follows the canonical contract

- GIVEN the demo backend is running
- WHEN a client requests `GET /health`
- THEN the response MUST include `ok`, `service`, and `version` fields matching the `HealthResponse` schema.

#### Scenario: Canonical endpoint names are used for quotes and payment attestations

- GIVEN a client executes the demo flow
- WHEN it creates a quote and attests a payment
- THEN it MUST use `POST /quotes` and `POST /loans/{loanId}/payments/attest`
- AND the backend MUST NOT require singular or unnested alternatives for the canonical flow.

### Requirement: OpenAPI Schema Conformance

The system MUST accept request bodies and return response bodies that conform to the schemas, enum values, required fields, and path parameters in `docs/demo/openapi.yaml`.

#### Scenario: Loan response uses canonical enums and nested objects

- GIVEN a seeded or newly created loan exists
- WHEN a client requests `GET /loans/{loanId}`
- THEN the response MUST include canonical `LoanStatus`, `LoanScenario`, money, borrower, originator, funding partner, collateral, terms, risk assessment, metrics, and liquidation preview fields.

### Requirement: Deterministic Seeded Loan Access

The system MUST initialize demo loan state from `data/demo/loans.seed.json` and expose seeded loans through the canonical loan read endpoints until changed by accepted lifecycle mutations.

#### Scenario: List all seeded loans

- GIVEN the backend has started with the demo seed file
- WHEN a client requests `GET /loans`
- THEN the response MUST include `loan-web3-001` and `loan-sme-001` in the `loans` array.

#### Scenario: Filter seeded loans by scenario and status

- GIVEN seeded loans include different scenarios and statuses
- WHEN a client requests `GET /loans?scenario=WEB3_BRIDGE&status=Active`
- THEN every returned loan MUST match `scenario = WEB3_BRIDGE` and `status = Active`.

#### Scenario: Read one seeded loan

- GIVEN seeded loan `loan-web3-001` exists
- WHEN a client requests `GET /loans/loan-web3-001`
- THEN the response MUST return that loan with its current demo state.
