# Design: Batch 2 Backend Risk Attestations

## Context and Decision Summary

Batch 2 introduces the first executable backend for the Bóveda Avalanche demo. The repository is currently spec-first: docs, OpenAPI, OpenSpec artifacts, and seed data exist; no Node/Fastify scaffold was detected. The backend will implement the canonical API in `docs/demo/openapi.yaml`, enforce lifecycle semantics from `docs/demo/states-events.md`, and seed deterministic state from `data/demo/loans.seed.json`.

Primary decisions:

- Build a Node.js + TypeScript + Fastify app in the repo root under `src/`, with root `package.json` scripts so the configured `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` commands work from the repository root.
- Use a deterministic in-memory `DemoStore` seeded at process start. No production database is introduced in Batch 2.
- Keep Wavy Node and web3/contract work behind adapter interfaces. Batch 2 uses mock implementations; real Avalanche Fuji ABI/address integration plugs into the same interfaces later.
- Use canonical sorted JSON plus SHA-256 for deterministic risk and payment hashes. These are demo attestations, not production signatures.
- Expose only OpenAPI-defined public paths. Manual post-transaction refresh is implemented as internal/request-driven reconciliation, not as a new public endpoint.

## Proposed File Boundaries

```text
package.json
package-lock.json
src/
  index.ts                      # process entrypoint
  app.ts                        # buildFastifyApp(deps)
  config/demoConfig.ts          # fixed demo clock, FX, scenario constants
  api/
    errors.ts                   # canonical HTTP error helpers
    schemas.ts                  # Fastify JSON schemas mirroring OpenAPI success shapes
  domain/
    types.ts                    # TypeScript model matching OpenAPI schemas
    money.ts                    # decimal string parsing/formatting and bps math
    canonicalJson.ts            # stable serialization for hashing
    hashing.ts                  # sha256Hex helpers
    stateMachine.ts             # allowed lifecycle transitions and terminal safety
    quoteEngine.ts              # deterministic quote algorithm
    riskEngine.ts               # mock Wavy assessment algorithm
    paymentAttestations.ts      # canonical payment payload + hash/idempotency
    dashboard.ts                # aggregation from loans/events
  store/
    seedLoader.ts               # reads data/demo/loans.seed.json
    demoStore.ts                # in-memory loans, risks, attestations, events
    seedEvents.ts               # canonical bootstrap events derived from seed loans
  adapters/
    wavyNode.ts                 # interface + mock implementation
    web3.ts                     # interface + mock implementation
  modules/
    health/routes.ts
    quotes/routes.ts
    risk/routes.ts
    loans/routes.ts
    payments/routes.ts
    dashboard/routes.ts
    events/routes.ts
tests/
  *.test.ts                     # Vitest unit and Fastify inject coverage
vitest.config.ts
tsconfig.json
```

Root placement avoids introducing monorepo indirection while preserving a clear backend namespace under `src/`. If future batches add frontend/contracts, the app can be moved behind unchanged module boundaries.

## Fastify Module Boundaries

`src/app.ts` constructs the app from explicit dependencies:

```ts
type AppDeps = {
  store: DemoStore;
  wavyNode: WavyNodeAdapter;
  web3: Web3Adapter;
  clock: Clock;
};

export function buildFastifyApp(deps: AppDeps): FastifyInstance;
```

Registered plugins:

- `health`: `GET /health`; no domain dependencies.
- `quotes`: `POST /quotes`; calls `quoteEngine`.
- `risk`: `POST /risk/wallet`; calls `WavyNodeAdapter.assessWallet`, stores accepted assessment by ID.
- `loans`: `GET /loans`, `POST /loans`, `GET /loans/:loanId`, `approve`, `collateral/deposit`, `activate`, `margin-call`, `liquidate`.
- `payments`: `POST /loans/:loanId/payments/attest`; validates state, computes attestation, calls web3 registration, mutates loan/events atomically.
- `dashboard`: `GET /dashboard/summary`; calls aggregation over current loans and event store.
- `events`: `GET /events`; supports optional `loanId` filter.

Route handlers should stay thin: validate request, call domain/store service, return OpenAPI success schema or a standard error. OpenAPI does not define error schemas, so use consistent non-success responses such as `{ "error": { "code": "INVALID_TRANSITION", "message": "..." } }` with appropriate `400`, `404`, `409`, or `422` status.

## TypeScript Domain Model

`src/domain/types.ts` mirrors OpenAPI names and enum values exactly:

```ts
export type LoanScenario = 'WEB3_BRIDGE' | 'SME_FIAT_WORKING_CAPITAL';
export type LoanStatus =
  | 'Requested' | 'Approved' | 'Active' | 'MarginCall'
  | 'Repaid' | 'Defaulted' | 'Liquidated' | 'Cancelled';
export type AmlStatus = 'PASS' | 'REVIEW' | 'BLOCK';
export type PaymentRail = 'WIRE_SIMULATED' | 'SPEI_SIMULATED' | 'ACH_SIMULATED' | 'MANUAL_SIMULATED';
export type EventType =
  | 'LoanCreated' | 'LoanApproved' | 'CollateralDeposited' | 'LoanActivated'
  | 'ReceiptIssued' | 'InstallmentPaid' | 'MarginCall' | 'Defaulted'
  | 'Liquidated' | 'CollateralReleased' | 'LoanCancelled';

export type DecimalString = string;
export type HexString = `0x${string}`;
```

Money and token amounts remain decimal strings to match OpenAPI and avoid JavaScript float leakage. `money.ts` provides scaled-integer helpers for:

- converting `Money` to USD with fixed demo FX rates;
- bps calculations (`amount * bps / 10000`);
- decimal string normalization with trailing zero trimming.

Important modeled aggregates:

- `Loan` exactly follows OpenAPI: borrower, originator, funding partner, principal, collateral, terms, risk assessment, optional receipt, current metrics, liquidation preview.
- `RiskAssessment` is stored by `riskAssessmentId` and copied into accepted loan records.
- `PaymentAttestationRecord` is internal and keyed by `loanId + installmentId + attestationHash` for idempotency.
- `OnChainEvent` is canonical even for application-only/mock events.

## State and Event Store

`DemoStore` is an in-memory repository initialized from `data/demo/loans.seed.json`:

```ts
interface DemoStore {
  listLoans(filter?: { scenario?: LoanScenario; status?: LoanStatus }): Loan[];
  getLoan(loanId: string): Loan | undefined;
  createLoan(input: CreateLoanRequest): Loan;
  mutateLoan<T>(loanId: string, mutation: LoanMutation<T>): T;
  saveRiskAssessment(assessment: RiskAssessment): void;
  getRiskAssessment(id: string): RiskAssessment | undefined;
  savePaymentAttestation(record: PaymentAttestationRecord): void;
  findPaymentAttestation(key: PaymentAttestationKey): PaymentAttestationRecord | undefined;
  appendEvent(event: OnChainEvent): void;
  listEvents(filter?: { loanId?: string }): OnChainEvent[];
}
```

Mutation rules:

1. Read current loan snapshot.
2. Validate state transition and request fields.
3. Prepare next loan and event payloads without committing.
4. Call adapter if the operation has a web3-like side effect.
5. Commit loan and events only after adapter success.
6. On validation or adapter failure, preserve loan state and event history.

Seed event policy:

- At bootstrap, derive canonical historical events from each seed loan status using only OpenAPI `EventType` values.
- `loan-web3-001` (`Active`) receives `LoanCreated`, `LoanApproved`, `CollateralDeposited`, `LoanActivated`, and optional `ReceiptIssued` if receipt data exists.
- `loan-sme-001` (`Approved`) receives `LoanCreated` and `LoanApproved`.
- Event timestamps are deterministic: start from seed `generatedAt` and increment by one second per generated event.

This keeps `/events` and dashboard `recentEvents` traceable before any new demo mutation.

## State Machine

`stateMachine.ts` contains a single source of truth for allowed transitions:

```ts
const allowedTransitions = {
  Requested: ['Approved', 'Cancelled'],
  Approved: ['Active', 'Cancelled'],
  Active: ['MarginCall', 'Repaid', 'Defaulted'],
  MarginCall: ['Active', 'Defaulted', 'Liquidated', 'Repaid'],
  Defaulted: ['Liquidated'],
  Repaid: [],
  Liquidated: [],
  Cancelled: [],
} satisfies Record<LoanStatus, LoanStatus[]>;
```

Endpoint mapping:

- `POST /loans`: creates `Requested`, records `LoanCreated`.
- `approve`: `Requested -> Approved`, records `LoanApproved`.
- `collateral/deposit`: requires `Approved`, records `CollateralDeposited`, status remains `Approved`.
- `activate`: requires `Approved` plus collateral `depositTxHash` and `vaultAddress`; adapter issues/registers receipt; transitions to `Active`; records `LoanActivated` and optional `ReceiptIssued`.
- `payments/attest`: accepts `Active` or `MarginCall`; final payment transitions to `Repaid`; partial payment preserves current status unless future explicit top-up logic is added.
- `margin-call`: requires `Active` and `currentLtvBps >= marginCallLtvBps`; transitions to `MarginCall`.
- `liquidate`: requires `MarginCall` or `Defaulted`; requires `proceedsCurrency = USDC`; transitions to `Liquidated` and returns `LiquidationResult`.

Terminal statuses (`Repaid`, `Liquidated`, `Cancelled`) reject lifecycle mutations and do not emit success events.

## Deterministic Quote Algorithm

Scenario constants in `demoConfig.ts`:

```ts
WEB3_BRIDGE: {
  initialLtvBps: 5000,
  marginCallLtvBps: 7000,
  liquidationLtvBps: 8000,
  aprBps: 1450,
  tenorDays: 90,
  repaymentFrequency: 'MONTHLY',
  liquidationCurrency: 'USDC',
}
SME_FIAT_WORKING_CAPITAL: {
  initialLtvBps: 6300,
  marginCallLtvBps: 7200,
  liquidationLtvBps: 8200,
  aprBps: 1850,
  tenorDays: 120,
  repaymentFrequency: 'MONTHLY',
  liquidationCurrency: 'USDC',
}
```

Fixed demo FX rates are used only for deterministic USD math. USD is `1`; MXN uses a fixed rate chosen to preserve seed relationships (`850000 MXN` maps to approximately `40950 USD`, matching `6300 bps` over `65000 USD` collateral value).

Algorithm for `POST /quotes`:

1. Normalize scenario, collateral token, requested amount, and currency.
2. Convert requested principal to USD with fixed demo FX.
3. Select scenario terms.
4. If `collateralValueUsd` is provided, cap suggested principal by `collateralValueUsd * initialLtvBps / 10000`; otherwise suggest the requested principal.
5. Compute `requiredCollateralValueUsd = suggestedPrincipalUsd * 10000 / initialLtvBps`.
6. Return OpenAPI `QuoteResponse` with `liquidationCurrency = USDC`.

No randomness, external pricing, or live oracle calls are used in Batch 2.

## Wavy Node Mock Risk Algorithm

`WavyNodeAdapter` boundary:

```ts
export interface WavyNodeAdapter {
  assessWallet(input: RiskAssessmentRequest): Promise<RiskAssessment>;
}
```

Mock implementation:

- Uses scenario profiles aligned with seed fixtures:
  - `WEB3_BRIDGE`: base `riskScore = 82`, `maxLtvBps = 5500`.
  - `SME_FIAT_WORKING_CAPITAL`: base `riskScore = 76`, `maxLtvBps = 6500`.
- Returns `provider = WAVY_NODE_MOCK`.
- Uses a fixed demo clock for `expiresAt` (`generatedAt + 24h`) unless tests inject another clock.
- Produces `riskAssessmentId = risk-${scenarioSlug}-${shortHash}`.
- Produces `assessmentHash = 0x${sha256(canonicalJson(payload))}`.
- `payload` includes schema version, normalized wallet, scenario, collateral token, provider, risk score, AML status, max LTV, and expiry.

Canonical demo tokens and valid demo wallets return `amlStatus = PASS`. A small deny/review list can be kept in config for tests; no real AML integration is included.

Loan creation validates that:

- `riskAssessmentId` exists in the store or is one of the seeded assessments;
- assessment `amlStatus = PASS`;
- requested `terms.initialLtvBps <= riskAssessment.maxLtvBps`.

## Payment Attestation Hashing

Payment attestation is deterministic and idempotent per evidence:

```ts
type CanonicalPaymentPayload = {
  schemaVersion: 'boveda.payment-attestation.v1';
  loanId: string;
  installmentId: string;
  amount: string;
  currency: string;
  paymentRail: PaymentRail;
  paidAt: string;
  externalPaymentRef: string | null;
};
```

Hash algorithm:

1. Validate loan exists and status is `Active` or `MarginCall`.
2. Validate payment currency matches `loan.currentMetrics.outstandingCurrency` for Batch 2.
3. Normalize decimal amount and ISO timestamp.
4. Serialize `CanonicalPaymentPayload` with recursive key sorting.
5. Compute `attestationHash = 0x${sha256(canonicalJson(payload))}`.
6. If an identical attestation already exists for `loanId + installmentId + hash`, return the stored response without double-decrementing principal or double-emitting `InstallmentPaid`.
7. Otherwise call `web3.registerPaymentAttestation` in mock mode, then decrement outstanding principal.
8. If remaining principal is zero, status becomes `Repaid`; otherwise it remains `Active` or `MarginCall`.
9. Record `InstallmentPaid` with attestation hash, remaining principal, and resulting status.

This hash is suitable for later contract submission but is not a production legal signature.

## Mock Web3 Adapter Interface

```ts
export interface Web3Adapter {
  activateLoan(input: ActivateLoanInput): Promise<ActivationOutcome>;
  registerPaymentAttestation(input: PaymentRegistrationInput): Promise<PaymentRegistrationOutcome>;
  liquidateLoan(input: LiquidationInput): Promise<LiquidationOutcome>;
  refreshPendingEvents?(): Promise<Web3RefreshOutcome>;
}

type AdapterOutcome =
  | { ok: true; txHash: HexString; blockNumber: number | null }
  | { ok: false; code: string; message: string };
```

Operation-specific additions:

- `ActivationOutcome`: receipt token ID, owner wallet, vault address.
- `PaymentRegistrationOutcome`: attestation hash and optional tx evidence.
- `LiquidationOutcome`: proceeds amount, `proceedsCurrency = USDC`, distribution, tx evidence.

Mock behavior:

- Deterministic tx hashes: SHA-256 over operation name, loan ID, canonical input, and adapter mode.
- Deterministic receipt token IDs: use request `receiptTokenId` if provided; otherwise derive a stable numeric token from loan ID hash.
- No ABI files, RPC URLs, contract addresses, private keys, or credentials are required.
- Failure simulation is dependency-injected in tests; production mock defaults to success.

Manual refresh path:

- The mock adapter returns immediate outcomes, so mutations commit synchronously.
- The interface includes `refreshPendingEvents()` for later real adapter modes.
- Read routes may call an internal reconciler before returning events/dashboard if configured, but no non-canonical public refresh endpoint is added.

## Dashboard Aggregation

`dashboard.ts` computes `DashboardSummary` from current loans and canonical events:

- `activePrincipalUsd`: sum outstanding principal converted to USD for loans in `Active` or `MarginCall`.
- `activeVaults`: count `Active` or `MarginCall` loans with a vault address.
- `averageLtvBps`: collateral-value-weighted average LTV for `Active` or `MarginCall` loans.
- `loansInMarginCall`: count status `MarginCall`.
- `paymentsAttested`: count `InstallmentPaid` events.
- `liquidationsExecuted`: count `Liquidated` events.
- `exposureByAsset`: sum collateral `valueUsd` by token for `Active` or `MarginCall` loans.
- `recentEvents`: latest 10 events by `occurredAt` descending, with event sequence as tie-breaker.

All liquidation previews, liquidation results, and `Liquidated` events must report `USDC` as proceeds currency.

## Public API Contract Notes

- Success responses must conform to `docs/demo/openapi.yaml`.
- Canonical paths are `POST /quotes` and `POST /loans/{loanId}/payments/attest`; do not implement singular/unnested alternatives as required demo paths.
- Create-loan IDs are assigned by the backend because `CreateLoanRequest` has no `loanId`. Use deterministic IDs in fresh stores: `loan-${scenarioSlug}-${sequenceOrShortHash}`.
- Validation should reject unknown enum values early with `400`/`422`.
- Not-found loans return `404` and do not mutate store state.

## Test Strategy

Strict TDD applies during implementation. Because no scaffold exists, the first apply slice must create Vitest/Fastify test infrastructure and demonstrate a failing test before production code.

Recommended coverage:

1. **Scaffold RED/GREEN**
   - RED: `GET /health` injection test fails before route exists.
   - GREEN: health route returns canonical fields.
2. **Seed and read API**
   - `GET /loans` includes `loan-web3-001` and `loan-sme-001`.
   - query filters by `scenario` and `status`.
   - `GET /events` returns canonical seed-derived event types.
3. **Quote and risk units**
   - same quote input returns identical values.
   - scenario terms match constants and liquidation currency is USDC.
   - same risk input returns identical `assessmentHash`; changed input changes hash.
4. **Lifecycle integration**
   - create -> approve -> deposit -> activate flow with Fastify inject.
   - invalid transition leaves loan and events unchanged.
   - terminal loan rejects mutation.
5. **Payment attestations**
   - same evidence yields same hash.
   - identical retry is idempotent.
   - partial payment remains active; final payment becomes `Repaid`.
   - terminal loan payment is rejected without mutation.
6. **Liquidation and web3 failure safety**
   - liquidation requires USDC and records canonical event.
   - adapter failure preserves prior state and event count.
7. **Dashboard**
   - metrics are derived from current loans/events.
   - payment and liquidation events update counters.
8. **OpenAPI contract smoke**
   - assert every canonical path has a registered Fastify route.
   - validate representative success payloads against route schemas or selected OpenAPI-derived schemas.

## Rollout and Apply Slices

Suggested implementation sequence for tasks/apply:

1. Tooling/scaffold + health test.
2. Domain types, seed loader, store, event bootstrap.
3. Loans read/create and lifecycle state machine.
4. Quote/risk engines and Wavy mock adapter.
5. Web3 adapter, activation, payment attestation, liquidation.
6. Dashboard aggregation and event filtering.
7. Contract/schema smoke tests and README/run instructions.

Each slice should keep changes reviewable and record RED/GREEN/TRIANGULATE/REFACTOR evidence.

## Review Risks and Mitigations

- **Large initial scaffold:** likely exceeds the session review budget of 400 changed lines if implemented as one PR. Mitigate by splitting tasks into small TDD slices and pause before apply for delivery strategy if forecast remains high.
- **Schema drift:** OpenAPI is canonical; route schemas and TypeScript unions must preserve exact enum/path names.
- **Mock boundary leakage:** keep Wavy and web3 behaviors behind interfaces; route handlers must not hard-code adapter internals.
- **Determinism drift:** inject clock and use canonical JSON/hashing in tests; avoid `Date.now()` and random IDs in domain logic.
- **State/event inconsistency:** use one `DemoStore.mutateLoan` path and commit loan/events atomically only after adapter success.
- **Payment retry double-counting:** implement idempotency before decrementing outstanding principal or emitting `InstallmentPaid`.
- **Liquidation currency mistakes:** centralize a `USDC` constant and reject non-USDC liquidation requests.
- **Future real web3 integration:** current in-memory transaction model is acceptable for demo, but real adapter will need outbox/reconciliation to handle chain success with process failure before commit.
