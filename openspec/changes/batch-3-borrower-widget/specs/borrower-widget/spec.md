# Borrower Widget Specification

## Purpose

Define the accepted borrower-facing Batch 3 widget behavior for the Bóveda Avalanche demo. The widget helps a judge follow the borrower journey end-to-end using the local Batch 2 API and canonical OpenAPI contract, without reimplementing backend loan, risk, attestation, or liquidation logic in frontend state.

## Requirements

### Requirement: Canonical API Contract Consumption

The system MUST consume `docs/demo/openapi.yaml` as the canonical API contract for borrower-widget behavior and MUST use the documented Batch 2 paths and response fields for all backend-backed states. The system MUST NOT use singular or unnested alternatives for canonical paths, and MUST NOT fake accepted lifecycle transitions locally when the API exposes a mutation endpoint.

#### Scenario: Load borrower demo context from the API

- GIVEN the local demo API is available
- WHEN the borrower widget starts
- THEN it MUST load loan context through `GET /loans` and/or `GET /loans/{loanId}`
- AND it SHOULD prefer the `WEB3_BRIDGE` / `loan-web3-001` demo context when available
- AND it MUST render borrower, originator, funding partner, principal, collateral, terms, risk assessment, metrics, receipt, and liquidation preview fields from the API response.

#### Scenario: Use canonical mutation paths

- GIVEN the borrower performs quote, risk, deposit, activation, payment, margin-call, liquidation, or event-refresh actions
- WHEN the widget calls the backend
- THEN it MUST use the canonical paths `POST /quotes`, `POST /risk/wallet`, `POST /loans/{loanId}/collateral/deposit`, `POST /loans/{loanId}/activate`, `POST /loans/{loanId}/payments/attest`, `POST /loans/{loanId}/margin-call`, `POST /loans/{loanId}/liquidate`, and `GET /events?loanId=...` as applicable
- AND it MAY use `POST /loans` only for an API-backed new request flow, never for local-only loan creation.

### Requirement: Borrower Offer And Request Terms

The system MUST present a useful first screen showing the borrower offer/request context in business terms: principal amount and currency, collateral token, collateral amount and value, initial/current LTV, tenor, APR/rate, repayment frequency, margin-call threshold, liquidation threshold, liquidation currency, originator, and funding partner. The screen MUST distinguish an API-loaded existing request/loan from any newly quoted or submitted request.

#### Scenario: Display accepted offer terms

- GIVEN a loan response contains `principal`, `collateral`, `terms`, `originator`, `fundingPartner`, and `currentMetrics`
- WHEN the borrower views the first screen
- THEN the widget MUST show principal amount/currency, collateral token/amount/value, initial and current LTV, APR, tenor, repayment frequency, margin-call threshold, liquidation threshold, originator, and funding partner
- AND it MUST show liquidation currency as `USDC` when displaying liquidation terms or proceeds.

#### Scenario: Show API-backed request status

- GIVEN the borrower is viewing a loan in `Requested`, `Approved`, `Active`, `MarginCall`, `Repaid`, `Defaulted`, `Liquidated`, or `Cancelled` status
- WHEN the request/offer summary is rendered
- THEN the widget MUST show the API status and the next borrower-relevant action for that status
- AND it MUST NOT present an action as complete until the API response or event feed confirms it.

### Requirement: Injected Wallet Connection

The system MUST support a basic real wallet connection through an injected `window.ethereum` provider when available, MUST display the selected borrower address after account access succeeds, and MUST provide a safe non-blocking unavailable-provider state when no provider exists. The system MUST NOT request, store, display, or require private keys, seed phrases, credentials, or `.env` secrets.

#### Scenario: Connect injected wallet successfully

- GIVEN an injected wallet provider is available and returns at least one account
- WHEN the borrower chooses to connect a wallet
- THEN the widget MUST request wallet accounts through the injected provider
- AND it MUST display the selected address in a readable shortened or full form
- AND it MUST use that address for borrower-facing quote and risk requests when the borrower triggers those actions.

#### Scenario: Continue when wallet provider is unavailable

- GIVEN no injected wallet provider is available
- WHEN the borrower views the wallet section
- THEN the widget MUST explain that real wallet connection is unavailable in the current browser
- AND it MUST allow the local API simulation journey to remain understandable without secret material or private-key prompts.

#### Scenario: Handle wallet rejection safely

- GIVEN an injected wallet provider is available
- WHEN the borrower rejects or the provider fails the account request
- THEN the widget MUST show a user-safe error message
- AND it MUST leave the prior loan and API state unchanged.

### Requirement: Quote And Risk Integration

The system MUST integrate quote and wallet-risk responses from the local API and display their borrower-relevant results without duplicating backend risk logic in frontend code.

#### Scenario: Generate quote from canonical endpoint

- GIVEN the borrower provides or accepts a scenario, borrower wallet, requested principal, collateral token, and optional collateral value
- WHEN the borrower requests terms
- THEN the widget MUST call `POST /quotes`
- AND it MUST display `suggestedPrincipal`, `requiredCollateralValueUsd`, `initialLtvBps`, `marginCallLtvBps`, `liquidationLtvBps`, `aprBps`, `tenorDays`, `repaymentFrequency`, and `liquidationCurrency` from the quote response.

#### Scenario: Display wallet risk assessment

- GIVEN a borrower wallet address, scenario, and collateral token are available
- WHEN the borrower requests or refreshes risk assessment
- THEN the widget MUST call `POST /risk/wallet`
- AND it MUST display `riskScore`, `amlStatus`, `maxLtvBps`, `assessmentHash`, provider, and expiry in borrower-readable form
- AND it MUST clearly identify review or block outcomes instead of treating every risk response as approved.

### Requirement: Collateral Deposit And Activation Flow

The system MUST expose a visible collateral deposit action for eligible `Approved` loans and MUST use the canonical API simulation unless real contract behavior is already available behind the backend adapter. If activation is needed to show active state and receipt details, the system MUST call the canonical activation endpoint rather than faking an active loan locally.

#### Scenario: Deposit collateral for an approved loan

- GIVEN an API loan is in `Approved` status
- AND the borrower can see collateral token, amount, vault address, and transaction-hash context for the demo simulation
- WHEN the borrower confirms collateral deposit
- THEN the widget MUST call `POST /loans/{loanId}/collateral/deposit` with `token`, `amount`, `txHash`, and `vaultAddress`
- AND it MUST show the returned loan collateral fields and a `CollateralDeposited` event after refresh.

#### Scenario: Activate after recorded deposit

- GIVEN collateral deposit has been recorded and the returned loan is still activation-eligible
- WHEN the borrower continues to active-loan state
- THEN the widget MUST call `POST /loans/{loanId}/activate` when activation is required by the API flow
- AND it MUST show `Active` status only after the API returns an active loan
- AND it MUST show receipt information only when the API response includes a receipt or the refreshed event feed confirms receipt issuance.

#### Scenario: Prevent ineligible deposit actions

- GIVEN a loan is not in `Approved` status
- WHEN the widget renders collateral actions
- THEN it MUST disable or replace the deposit action with status-specific guidance
- AND it MUST not call the deposit endpoint for an ineligible state.

### Requirement: Active Loan State And Receipt Display

The system MUST provide an active-loan view that presents current borrower obligations, collateral state, payment evidence, receipt details, and recent traceable events from API data.

#### Scenario: Render active loan details

- GIVEN the API returns a loan in `Active` or `MarginCall` status
- WHEN the active-loan section is shown
- THEN the widget MUST display status, outstanding principal and currency, current LTV, next payment due date when present, collateral token/value, vault address, deposit transaction hash when present, and recent events for the loan.

#### Scenario: Render receipt NFT details

- GIVEN the loan response includes a `receipt`
- WHEN the borrower views receipt details
- THEN the widget MUST display `receiptTokenId`, `ownerWallet`, and `soulbound`
- AND it MUST communicate that the receipt is demo evidence of the active loan rather than a transferable asset when `soulbound` is true.

#### Scenario: Show payment evidence from responses and events

- GIVEN payment attestations or `InstallmentPaid` events exist for the loan
- WHEN the active-loan view refreshes
- THEN the widget MUST show installment id, amount, currency, attestation hash, remaining principal, and resulting loan status when those fields are returned by the API or event payload.

### Requirement: Payment Simulation And Attestation Feedback

The system MUST allow a borrower to simulate an off-chain payment through the canonical payment attestation endpoint and MUST make the resulting attestation evidence visible.

#### Scenario: Attest a payment for an active loan

- GIVEN a loan is in `Active` or `MarginCall` status
- AND the borrower provides or accepts demo payment fields including installment id, amount, currency, payment rail, paid-at timestamp, and optional external reference
- WHEN the borrower submits the simulated payment
- THEN the widget MUST call `POST /loans/{loanId}/payments/attest`
- AND it MUST display the returned `attestationHash`, `remainingPrincipal`, and resulting `status`
- AND it MUST refresh or display related `InstallmentPaid` event feedback.

#### Scenario: Preserve state on payment errors

- GIVEN the API rejects a payment because the loan state, amount, currency, payment rail, or timestamp is invalid
- WHEN the attestation request fails
- THEN the widget MUST show the API error in borrower-readable language
- AND it MUST preserve the last confirmed loan state and avoid showing a new attestation hash.

### Requirement: Margin Call And Liquidation View

The system MUST expose margin-call and liquidation states clearly, including borrower alerting, current LTV versus thresholds, required top-up information when provided, and liquidation proceeds in USDC.

#### Scenario: Show margin-call alert

- GIVEN current LTV is at or above `marginCallLtvBps` or the loan status is `MarginCall`
- WHEN the borrower views risk status
- THEN the widget MUST show a clear margin-call alert
- AND it MUST display current LTV, margin-call threshold, liquidation threshold, reason when available, required top-up amount/currency when available, and the current API status.

#### Scenario: Trigger margin-call simulation

- GIVEN a loan is eligible for margin call
- WHEN the borrower or demo operator triggers the margin-call simulation
- THEN the widget MUST call `POST /loans/{loanId}/margin-call` with `currentLtvBps` and `reason`
- AND it MUST render the returned `MarginCall` status and refreshed `MarginCall` event payload.

#### Scenario: Display liquidation outcome in USDC

- GIVEN a loan is in `MarginCall` or `Defaulted` status
- WHEN liquidation is simulated through `POST /loans/{loanId}/liquidate`
- THEN the widget MUST show `Liquidated` status, liquidation transaction hash when present, `proceedsAmount`, `proceedsCurrency`, and distribution amounts
- AND `proceedsCurrency` MUST be displayed as `USDC`
- AND funding partner, originator fee, and borrower remainder amounts MUST be distinguishable.

#### Scenario: Prevent invalid liquidation display

- GIVEN liquidation is not allowed for the current API state or the API rejects a non-`USDC` proceeds currency
- WHEN the liquidation action is attempted or rendered
- THEN the widget MUST show user-safe guidance or the API error
- AND it MUST not present liquidation as completed unless the API returns a liquidation result or `Liquidated` event.

### Requirement: Loading, Empty, Refresh, And API Error States

The system MUST provide explicit loading, empty, success, refresh, and error states for API-backed borrower actions. Error displays MUST use safe borrower-readable messages and SHOULD surface canonical API `error.code` and `error.message` when present, without dumping raw JSON.

#### Scenario: Initial loading and retry

- GIVEN the widget has not yet loaded loan data
- WHEN API requests are pending
- THEN the widget MUST show a stable loading state that does not shift the core layout unexpectedly
- AND if loading fails, it MUST show a retry path and the affected action or data area.

#### Scenario: Empty loan list

- GIVEN `GET /loans` succeeds with no usable borrower demo loan
- WHEN the widget renders the borrower context
- THEN it MUST show an empty state explaining that no demo loan is available
- AND it SHOULD offer a quote/request path or retry guidance instead of showing blank cards.

#### Scenario: Mutation error handling

- GIVEN a deposit, activation, payment, margin-call, or liquidation request fails
- WHEN the API returns a canonical error object or safe HTTP failure
- THEN the widget MUST show the error near the affected action
- AND it MUST keep the last confirmed API-backed loan, receipt, payment, and event state visible.

### Requirement: Accessible And Responsive Data-Product UI

The system MUST follow the project’s quiet, polished data-product UI standards and basic accessibility/responsive requirements for the borrower journey.

#### Scenario: Consistent visual system

- GIVEN the borrower widget is rendered
- WHEN a judge views any borrower state
- THEN the UI MUST use the project palette (`#f6f8fb`, `#ffffff`, `#172033`, `#647084`, `#d9e1ec`, `#0f766e`, `#2563eb`, `#dc2626`, `#16a34a`), compact headings, 8px card radius, 6px controls, and 12/16/24/32 spacing
- AND it MUST avoid generic purple-blue gradients, decorative blobs, oversized empty cards, raw JSON dumps, and unstable layouts.

#### Scenario: Keyboard and assistive technology basics

- GIVEN the borrower uses keyboard navigation or assistive technology
- WHEN they navigate wallet, deposit, payment, margin-call, liquidation, retry, and refresh controls
- THEN all actionable controls MUST be reachable by keyboard, have visible focus, have accessible names, and expose disabled/loading states appropriately
- AND status, warning, success, and error messages SHOULD be announced or associated with the relevant control or region.

#### Scenario: Responsive layout

- GIVEN the widget is viewed on narrow and desktop widths
- WHEN borrower offer, active-loan, receipt, event, payment, and liquidation sections are displayed
- THEN the layout MUST remain readable without horizontal scrolling for normal content
- AND primary borrower actions MUST remain discoverable without relying on hover-only interactions.
