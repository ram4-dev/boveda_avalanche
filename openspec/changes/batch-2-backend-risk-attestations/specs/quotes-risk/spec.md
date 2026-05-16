# Quotes and Wallet Risk Specification

## Purpose

Provide deterministic demo terms and wallet risk assessments for the Batch 2 loan flow while preserving a replaceable Wavy Node boundary.

## Requirements

### Requirement: Deterministic Scenario-Aware Quotes

The system MUST calculate `POST /quotes` responses deterministically from the request scenario, requested principal, collateral token, and available collateral value using canonical `QuoteResponse` and `CollateralTerms` fields.

#### Scenario: Web3 bridge quote returns collateralized demo terms

- GIVEN a quote request with `scenario = WEB3_BRIDGE`, a borrower wallet, requested principal, and collateral token
- WHEN the client calls `POST /quotes`
- THEN the response MUST include the same scenario, a suggested principal, required collateral value in USD, and terms
- AND the terms MUST include `initialLtvBps`, `marginCallLtvBps`, `liquidationLtvBps`, `aprBps`, `tenorDays`, `repaymentFrequency`, and `liquidationCurrency = USDC`.

#### Scenario: Same quote request is reproducible

- GIVEN the same quote request is submitted more than once against the same demo configuration
- WHEN the backend calculates the quote
- THEN the response values MUST be identical for acceptance-test purposes.

### Requirement: Wavy Node Wallet Risk Assessment

The system MUST implement `POST /risk/wallet` as a Wavy Node mock or adapter-backed assessment that returns the canonical `RiskAssessment` fields without requiring production Wavy Node connectivity.

#### Scenario: Wallet risk response contains canonical risk fields

- GIVEN a risk request with `walletAddress`, `scenario`, and `collateralToken`
- WHEN the client calls `POST /risk/wallet`
- THEN the response MUST include `riskAssessmentId`, `provider`, `riskScore`, `amlStatus`, `maxLtvBps`, `assessmentHash`, and `expiresAt`
- AND `provider` MUST be either `WAVY_NODE_MOCK` or `WAVY_NODE_ADAPTER`.

#### Scenario: Risk assessment hash is stable for the same assessment inputs

- GIVEN the same wallet, scenario, collateral token, and demo assessment configuration
- WHEN wallet risk is assessed repeatedly
- THEN the assessment hash MUST be reproducible
- AND changing an assessment input MUST produce a distinguishable assessment result.

### Requirement: Quote And Risk Acceptance Alignment

The system MUST ensure accepted loan requests can reference a prior risk assessment and must keep loan terms within the assessed maximum LTV for the demo scenario.

#### Scenario: Create loan uses a risk assessment accepted by the backend

- GIVEN a client has received a risk assessment with `amlStatus = PASS` and a `maxLtvBps`
- WHEN it creates a loan using `riskAssessmentId` and terms whose `initialLtvBps` does not exceed `maxLtvBps`
- THEN the backend MUST be able to accept the loan request and preserve the referenced risk assessment on the loan.
