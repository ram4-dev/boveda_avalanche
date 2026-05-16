# Design: batch-3-borrower-widget

## Status

Designed.

## Summary

Batch 3 adds a Vite + React + TypeScript borrower widget to the existing single npm package without changing Batch 2 backend behavior. The frontend is a thin, API-backed demo surface: it loads the canonical `WEB3_BRIDGE` loan, connects an injected wallet when available, records API-simulated collateral/payment/risk/liquidation actions, and renders refreshed loan/events data. Backend state transitions, risk scoring, attestation hashing, and liquidation rules remain owned by the Batch 2 API.

## Goals and non-goals

### Goals

- Provide a judge-friendly borrower journey: offer/terms → wallet → collateral deposit/activation → active loan/receipt → payment attestation → margin call/liquidation.
- Use canonical API paths from `docs/demo/openapi.yaml`; no singular or unnested endpoint alternatives.
- Keep backend commands working, especially `npm test -- --run`, while adding browser-oriented React tests.
- Apply the quiet data-product UI standard: useful first screen, stable cards, compact headings, canonical palette, no decorative gradients/blobs/raw JSON dumps.
- Preserve strict TDD during implementation.

### Non-goals

- No production wallet/session/custody layer, private key handling, seed phrases, or secret reads.
- No frontend reimplementation of backend loan, risk, payment, or liquidation state machines.
- No production CORS/auth/deployment hardening beyond local-demo Vite proxy and configurable API base URL.
- No institutional dashboard implementation except borrower-relevant events/receipt/liquidation evidence.

## App placement and build shape

Use a `web/` frontend root inside the current repository/package so Batch 3 stays small and reviewable.

```text
web/
  index.html
  tsconfig.json
  src/
    main.tsx
    App.tsx
    api/
      client.ts
      errors.ts
      types.ts
    wallet/
      injectedWallet.ts
      useInjectedWallet.ts
    state/
      borrowerJourney.ts
      demoPayloads.ts
    screens/
      OfferRequestScreen.tsx
      LoanActivityScreen.tsx
    components/
      ActionButton.tsx
      Alert.tsx
      EventTimeline.tsx
      KeyValueList.tsx
      MetricTile.tsx
      StatusPill.tsx
    styles/
      tokens.css
      app.css
    test/
      setup.ts
```

Root-level additions:

```text
vite.config.ts              # Vite app config with root: web
vitest config/workspace     # Backend node project + web jsdom project
package.json                # React/Vite/test scripts/deps
```

Design decisions:

- Keep backend source under existing `src/` and backend tests under existing `tests/`.
- Keep `npm run dev` as the Fastify backend command; add `npm run dev:web` for the Vite UI.
- Use Vite `root: 'web'`; build output should not wipe backend `dist`. Prefer `outDir: '../dist/web'` with `emptyOutDir: false`, or another excluded web build dir.
- Use Vite dev-server proxy for local API calls so frontend code can call canonical paths (`/loans`, `/quotes`, etc.) without changing API paths:
  - `/health`, `/quotes`, `/risk`, `/loans`, `/events`, `/dashboard` → `http://localhost:3000`.
- Allow `VITE_BOVEDA_API_BASE_URL` as an optional browser-safe base URL override. Do not read `.env` contents or require secrets.

## Package, TypeScript, and test setup

### Dependencies

Runtime:

- `react`
- `react-dom`

Dev/runtime tooling:

- `vite` as explicit dev dependency even though Vitest may already pull it transitively.
- `@vitejs/plugin-react`
- `typescript` remains shared.
- `jsdom`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `@types/react`
- `@types/react-dom`

### Scripts

Preserve existing backend ergonomics while making full verification include frontend checks:

```jsonc
{
  "dev": "tsx src/index.ts",
  "dev:web": "vite --config vite.config.ts",
  "test": "vitest",
  "typecheck": "npm run typecheck:api && npm run typecheck:web",
  "typecheck:api": "tsc --noEmit --pretty false -p tsconfig.json",
  "typecheck:web": "tsc --noEmit --pretty false -p web/tsconfig.json",
  "build": "npm run build:api && npm run build:web",
  "build:api": "tsc -p tsconfig.json",
  "build:web": "vite build --config vite.config.ts",
  "lint": "npm run typecheck"
}
```

Implementation may use Vitest projects/workspace or equivalent supported Vitest 3 configuration, but must enforce these boundaries:

- Backend test project:
  - environment: `node`
  - include: `tests/**/*.test.ts`
  - no DOM setup files
- Web test project:
  - environment: `jsdom`
  - include: `web/src/**/*.test.{ts,tsx}`
  - setup: `web/src/test/setup.ts` for `@testing-library/jest-dom/vitest`

`npm test -- --run` must run backend and web tests, or implementation must add a documented equivalent that is also invoked by the primary test script. Backend-only tests must remain runnable and green under the existing command semantics.

### TypeScript boundaries

- Keep root `tsconfig.json` backend-oriented (`NodeNext`, node/vitest globals) and do not add `web/src` to it.
- Add `web/tsconfig.json` using DOM libs, `jsx: react-jsx`, and browser/bundler module resolution.
- Share no backend implementation imports into `web/src`; duplicate only lightweight OpenAPI-shaped frontend types or generate them later if needed.

## API client boundary

Create `web/src/api/client.ts` as a framework-free fetch boundary. React components and reducers call named methods; they never construct endpoint strings directly.

```ts
type BovedaApiClient = {
  listLoans(filter?: { scenario?: LoanScenario; status?: LoanStatus }): Promise<{ loans: Loan[] }>;
  getLoan(loanId: string): Promise<Loan>;
  createQuote(input: QuoteRequest): Promise<QuoteResponse>;
  assessWalletRisk(input: RiskAssessmentRequest): Promise<RiskAssessment>;
  depositCollateral(loanId: string, input: CollateralDepositRequest): Promise<Loan>;
  activateLoan(loanId: string, input?: ActivateLoanRequest): Promise<Loan>;
  attestPayment(loanId: string, input: PaymentAttestationRequest): Promise<PaymentAttestation>;
  createMarginCall(loanId: string, input: MarginCallRequest): Promise<Loan>;
  liquidateLoan(loanId: string, input: LiquidationRequest): Promise<LiquidationResult>;
  listEvents(filter?: { loanId?: string }): Promise<{ events: OnChainEvent[] }>;
};
```

Rules:

- Use only canonical paths:
  - `GET /loans`, `GET /loans/{loanId}`
  - `POST /quotes`
  - `POST /risk/wallet`
  - `POST /loans/{loanId}/collateral/deposit`
  - `POST /loans/{loanId}/activate`
  - `POST /loans/{loanId}/payments/attest`
  - `POST /loans/{loanId}/margin-call`
  - `POST /loans/{loanId}/liquidate`
  - `GET /events?loanId=...`
- Encode query params through `URLSearchParams`; encode loan ids in path segments.
- Parse `{ error: { code, message } }` into an `ApiClientError` and render safe `code/message` strings near the affected action.
- Never raw-dump JSON in UI. Debug data can remain in tests, not borrower screens.
- Do not transform lifecycle state except formatting bps, dates, hashes, and amounts for display.

## Wallet provider boundary

Implement the injected wallet support as an isolated module, not as a React component concern.

```ts
export type InjectedEthereumProvider = {
  request(args: { method: 'eth_requestAccounts' | 'eth_accounts'; params?: unknown[] }): Promise<unknown>;
};

export type WalletConnection =
  | { status: 'unavailable' }
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected'; address: string }
  | { status: 'rejected'; message: string };
```

Rules:

- Access only `window.ethereum` when present.
- Request accounts with `eth_requestAccounts` on explicit user action.
- Display shortened address by default, with a full address available in text/title if useful.
- On absence, show a non-blocking message: real wallet connection is unavailable, but local API simulation can still be reviewed.
- On rejection/failure, show a safe error and leave API-loaded loan state untouched.
- No private keys, seed phrases, credentials, or `.env` values are requested, displayed, logged, or stored.

## Borrower journey state model

Use a small reducer/hook in `web/src/state/borrowerJourney.ts` to coordinate API calls and UI action state. The reducer is not the source of loan truth; it holds the last confirmed API data and action lifecycle flags.

```ts
type BorrowerJourneyState = {
  loadStatus: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  selectedLoan: Loan | null;
  events: OnChainEvent[];
  quote: QuoteResponse | null;
  risk: RiskAssessment | null;
  lastPayment: PaymentAttestation | null;
  lastLiquidation: LiquidationResult | null;
  action: null | 'quoting' | 'risking' | 'depositing' | 'activating' | 'attestingPayment' | 'triggeringMarginCall' | 'liquidating' | 'refreshing';
  errors: Partial<Record<'load' | 'quote' | 'risk' | 'deposit' | 'activate' | 'payment' | 'marginCall' | 'liquidation' | 'refresh', BorrowerFacingError>>;
};
```

Bootstrap flow:

1. `GET /loans?scenario=WEB3_BRIDGE`.
2. Prefer `loan-web3-001` when present; otherwise choose the first `WEB3_BRIDGE` loan.
3. If no `WEB3_BRIDGE` loan exists, fall back to `GET /loans` and show an empty/supporting-context state.
4. Fetch `GET /events?loanId={selectedLoan.loanId}` after selecting a loan.

Mutation pattern:

1. Validate action eligibility from `selectedLoan.status` and required fields.
2. Call the canonical endpoint.
3. Store returned response as `lastPayment`/`lastLiquidation` when applicable.
4. Refresh `GET /loans/{loanId}` and `GET /events?loanId={loanId}` after successful mutations so visible state is API-confirmed.
5. On errors, keep the last confirmed loan/events visible and set only the action-specific error.

Status-derived actions:

| API status | Borrower guidance/actions |
| --- | --- |
| `Requested` | Show terms and status; no deposit until approved. Quote/risk refresh allowed as explanatory demo actions. |
| `Approved` | Enable collateral deposit with canonical token/amount/vault/tx hash values, then enable activation once deposit is recorded. |
| `Active` | Show receipt/obligations/events; enable payment attestation and margin-call simulation. |
| `MarginCall` | Show alert/top-up information; enable payment attestation and liquidation simulation. |
| `Defaulted` | Show default guidance; enable liquidation simulation. |
| `Repaid` | Show terminal paid state; disable risk/liquidation actions. |
| `Liquidated` | Show liquidation result/proceeds in USDC; disable further mutations. |
| `Cancelled` | Show terminal cancelled state; disable mutations. |

Demo payload helpers belong in `web/src/state/demoPayloads.ts` and must be transparent in UI copy:

- Deposit: use loan collateral `token`/`amount`, existing or configured vault address, and a deterministic demo tx hash if the current approved seed has no `depositTxHash`.
- Activation: optionally pass a demo `receiptTokenId`; show receipt only after API response includes it.
- Payment: default to borrower-readable editable/confirmable fields (`installmentId`, `amount`, `currency`, `paymentRail`, `paidAt`, optional external ref), then call `POST /loans/{loanId}/payments/attest`.
- Margin call: use `currentLtvBps >= marginCallLtvBps` with reason such as `COLLATERAL_PRICE_DROP`.
- Liquidation: use `loan.liquidationPreview.proceedsAmount`, `USDC`, and preview distribution; assert/display `USDC` only.

## Screen and component model

Use two main screens inside a simple app shell. Avoid adding a router unless implementation discovers it is necessary; tabs or segmented navigation are enough.

### Screen 1: `OfferRequestScreen`

Purpose: useful first screen for terms, borrower context, wallet, quote/risk, and collateral readiness.

Sections/components:

- `TermsSummaryCard`
  - principal amount/currency
  - collateral token/amount/value
  - initial/current LTV
  - APR, tenor, repayment frequency
  - margin-call/liquidation thresholds
  - liquidation currency (`USDC`)
  - originator and funding partner
- `StatusNextActionCard`
  - API loan status
  - next borrower-relevant action derived from status
- `WalletConnectionCard`
  - injected provider state
  - connect button
  - selected borrower address
  - unavailable/rejected safe messaging
- `QuoteRiskPanel`
  - `POST /quotes` result fields
  - `POST /risk/wallet` result fields: risk score, AML status, max LTV, assessment hash, provider, expiry
  - clear REVIEW/BLOCK copy, not all-green treatment
- `CollateralDepositCard`
  - visible only as enabled for `Approved`; otherwise disabled/guidance
  - calls deposit, then activation only via explicit button or clearly labeled combined flow that still calls both endpoints in order

### Screen 2: `LoanActivityScreen`

Purpose: active-loan evidence, payment attestation, events, margin call, and liquidation outcome.

Sections/components:

- `ActiveLoanSummaryCard`
  - status, outstanding principal/currency, current LTV, next payment due date, collateral value/token, vault address, deposit tx hash
- `ReceiptCard`
  - `receiptTokenId`, `ownerWallet`, `soulbound`
  - copy that soulbound receipt is demo evidence, not transferable collateral
- `PaymentAttestationCard`
  - editable/confirmable demo fields
  - attestation hash, remaining principal, resulting status after API response
- `RiskAndLiquidationCard`
  - current LTV vs thresholds
  - margin-call alert with required top-up when available from event payload
  - liquidation action only for `MarginCall`/`Defaulted`
  - proceeds amount/currency and distribution rows: funding partner, originator fee, borrower remainder
- `EventTimeline`
  - recent canonical events filtered by selected loan
  - event type, time, tx hash when present, selected borrower-readable payload fields
  - no raw JSON dumps

Shared components should stay small and dumb; they receive already-selected loan/event data and callback props. Formatting helpers can live under `web/src/components/format.ts` or `web/src/api/format.ts` as long as they do not encode business rules.

## Data flow

```text
Vite React UI
  ↓ named client methods
web/src/api/client.ts
  ↓ fetch canonical local paths, with Vite proxy in dev
Batch 2 Fastify API
  ↓ stores transitions/events
DemoStore + web3/risk/payment adapters
  ↑ canonical Loan/Event/Attestation/Liquidation responses
web reducer stores last confirmed API data
  ↑ React components render borrower-readable state
```

Important invariants:

- The UI may have optimistic loading indicators, but not optimistic lifecycle completion.
- A status is shown as complete only after the API response or refreshed event feed confirms it.
- Events are supporting evidence; the current loan response remains the main current-state source.
- Liquidation proceeds are always displayed in USDC.

## Style system and accessibility

Implement project UI standards with CSS custom properties in `web/src/styles/tokens.css`:

```css
:root {
  --color-bg: #f6f8fb;
  --color-surface: #ffffff;
  --color-text: #172033;
  --color-muted: #647084;
  --color-border: #d9e1ec;
  --color-accent: #0f766e;
  --color-secondary: #2563eb;
  --color-warning: #dc2626;
  --color-positive: #16a34a;
  --radius-card: 8px;
  --radius-control: 6px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
}
```

Layout rules:

- Background `#f6f8fb`, white cards, subtle borders, compact headings.
- Two-column desktop grid where useful; single-column responsive layout on narrow screens.
- Stable loading skeletons/placeholders that do not shift the whole page.
- No generic purple-blue gradients, decorative blobs, oversized empty cards, hover-only actions, or raw JSON dumps.

Accessibility rules:

- All buttons and tabs are keyboard reachable with visible focus.
- Use semantic buttons, headings, lists/tables only where appropriate.
- Add `aria-live="polite"` for success/refresh feedback and `role="alert"` for errors/warnings.
- Disabled/loading states must be exposed through `disabled`/`aria-busy` where applicable.
- Error text should be associated with the affected action region.

## Test strategy

Strict TDD must be followed in apply: RED → GREEN → TRIANGULATE → REFACTOR, with evidence recorded.

Recommended test layers:

1. API client unit tests (`web/src/api/client.test.ts`)
   - canonical endpoint paths and methods
   - query encoding for events/loans
   - canonical error parsing from `{ error: { code, message } }`
   - no singular/unnested alternatives
2. Wallet tests (`web/src/wallet/injectedWallet.test.ts`)
   - provider unavailable
   - successful `eth_requestAccounts`
   - rejection/failure preserves safe error
   - malformed/empty accounts handled safely
3. Reducer/state tests (`web/src/state/borrowerJourney.test.ts`)
   - prefers `WEB3_BRIDGE` / `loan-web3-001`
   - status-derived action eligibility
   - mutation success refreshes loan/events
   - mutation error preserves last confirmed state
4. Component tests with React Testing Library
   - offer terms render required business fields and `USDC` liquidation currency
   - wallet unavailable and connected states
   - approved-loan deposit/activation eligibility
   - active loan receipt/payment attestation display
   - margin-call alert and liquidation result distribution
   - loading/empty/error states do not raw-dump JSON
5. Regression verification
   - existing backend tests still run under `npm test -- --run`
   - `npm run typecheck`
   - `npm run build`
   - `npm run lint`

The first implementation slice should add test tooling and at least one failing API-client or wallet/component test before production UI code.

## Rollout and implementation sequencing

Recommended reviewable slices for tasks/apply:

1. Frontend scaffold, test/tooling isolation, API client, wallet boundary, and RED/GREEN tests.
2. Offer/request screen and style tokens with API-backed initial load, quote, risk, and wallet UI.
3. Loan activity screen with deposit/activation, payment attestation, events, margin call, and liquidation UI.
4. Polish/accessibility/regression pass and final verification evidence.

If task forecasting exceeds the configured review budget, pause before apply and split into chained PRs. The most likely split is tooling/client/wallet first, borrower screens second, lifecycle mutations/polish third.

## Review risks

- **Vitest config risk:** mixing Node backend tests with jsdom UI tests can break existing tests if setup files or environments leak. Use separate projects/workspace boundaries.
- **Build output risk:** Vite must not empty backend `dist`; configure output carefully and verify `npm run build`.
- **Dependency/review size risk:** React/Vite/testing packages and lockfile changes may dominate the diff. Keep app code compact and avoid adding UI libraries.
- **API availability risk:** browser demo requires the Fastify backend running separately. Vite proxy should make this explicit; UI must show retry/error states.
- **Mutable demo state risk:** Batch 2 store mutates in memory. Component tests should mock the API client; manual demo should document reset by restarting backend.
- **Seed status mismatch:** canonical `loan-web3-001` is currently `Active`, while deposit flow needs `Approved`. The UI must still render the deposit path for approved loans (for example the SME seed or created/approved loans) and not fake a deposit for an active loan.
- **Wallet availability risk:** judges may lack `window.ethereum`; unavailable state must be non-blocking.
- **Simulation honesty risk:** collateral, margin, and liquidation remain API-simulated unless backend adapter provides real contract behavior. UI copy must not imply production custody/execution.

## Open questions for tasks/apply

- Whether to expose the supporting SME approved loan through a small loan selector to demonstrate deposit, or keep the primary path fixed to `loan-web3-001` and rely on created/approved demo setup for deposit tests.
- Exact Vitest project/workspace syntax should be confirmed against installed Vitest 3 during the first TDD slice.
- Whether `npm run build` should always build both backend and web, or whether a separate `build:all` is preferable. This design recommends building both to satisfy Batch 3 verification.
