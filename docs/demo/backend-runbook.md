# Bóveda Batch 2 Backend Runbook

This runbook covers the local Node.js/TypeScript/Fastify backend introduced for Batch 2: risk, loan lifecycle, payment attestations, liquidation, dashboard aggregation, and event listing.

## Local commands

Install dependencies from the public npm registry if the local npm configuration points to a private registry:

```bash
npm install --registry=https://registry.npmjs.org
```

Run the API locally:

```bash
npm run dev
```

Verify the Batch 2 backend:

```bash
npm test -- --run
npm run typecheck
npm run build
npm run lint
```

Focused test examples:

```bash
npm test -- --run tests/dashboard-events.test.ts
npm test -- --run tests/openapi-contract-smoke.test.ts
```

## Canonical API surface

The canonical public paths come from `docs/demo/openapi.yaml`:

- `GET /health`
- `POST /quotes`
- `POST /risk/wallet`
- `GET /loans`
- `POST /loans`
- `GET /loans/{loanId}`
- `POST /loans/{loanId}/approve`
- `POST /loans/{loanId}/collateral/deposit`
- `POST /loans/{loanId}/activate`
- `POST /loans/{loanId}/payments/attest`
- `POST /loans/{loanId}/margin-call`
- `POST /loans/{loanId}/liquidate`
- `GET /dashboard/summary`
- `GET /events`

Use `POST /quotes` and `POST /loans/{loanId}/payments/attest` for the demo flow; singular or unnested alternatives are not canonical.

## Mock and Fuji integration boundaries

Batch 2 remains mock-first for `/demo`, while Batch 5 adds an honest Fuji runtime boundary:

- `WAVY_NODE_MOCK` provides deterministic wallet risk assessments through the Wavy adapter boundary.
- `MockWeb3Adapter` simulates activation, payment registration, liquidation, deterministic tx hashes, and a request-driven refresh hook for `/demo` only.
- Fuji mode uses public contract config plus operator-supplied runtime signer prerequisites. If any prerequisite is missing, the backend returns `WEB3_UNAVAILABLE` and labels evidence as `fuji-unavailable`; it must not silently fall back to mock hashes.
- No real Wavy credentials, private keys, or secret RPC values are required for local `/demo` success, and secret values must not be printed or committed.

For Batch 5 real-Fuji collateral verification, see `docs/demo/fuji-real-e2e-collateral-verification.md`. The chosen live path is **USDC collateral on Fuji** with **USDC liquidation proceeds**: 10 USDC principal, 15 USDC collateral, 10 USDC funding-partner recovery, 0.5 USDC originator fee, and 4.5 USDC borrower remainder. The backend must verify adapter-confirmed on-chain evidence before trusting a frontend wallet prompt or submitted `txHash`.

## State and dashboard traceability

Runtime state is deterministic and in-memory:

- seed loans load from `data/demo/loans.seed.json`;
- accepted mutations append canonical events;
- `GET /events?loanId=...` filters the recorded event feed;
- `GET /dashboard/summary` derives portfolio metrics from current loans and recorded events.

Liquidation previews, liquidation responses, and `Liquidated` events report proceeds in `USDC` for the demo.

## Dashboard-driven Fuji lifecycle (change `dashboard-driven-fuji-lifecycle`)

The institutional dashboard can drive the full credit lifecycle as real Fuji transactions when the backend runs in `mode=fuji` with prerequisites `ready`. Required environment variable NAMES (values are not read by the agent and never committed):

- `BOVEDA_FUJI_RPC_URL` — optional. Default is the Avalanche public Fuji RPC.
- `BOVEDA_FUJI_ATTESTOR_PRIVATE_KEY` — attestor signer for `PaymentAttestation.registerPayment`.
- `BOVEDA_FUJI_BORROWER_PRIVATE_KEY` — borrower signer for `USDC.approve`, `CollateralVault.depositCollateral`, and `CollateralVault.releaseCollateral`.
- `BOVEDA_FUJI_ORIGINATOR_PRIVATE_KEY` — originator/admin signer for `LoanRegistry.createLoan`, `LoanRegistry.setLoanStatus`, and `LiquidationEngine.liquidateLoan`.
- `BOVEDA_FUJI_FUNDING_PARTNER_ADDRESS` — public address receiving the funding-partner share of liquidation proceeds. Use `0x4b85d24F1995D1FBD93D454C4883B13f21ca34D5` for the demo.
- Optional gas thresholds: `BOVEDA_FUJI_GAS_MIN_ORIGINATOR_WEI`, `BOVEDA_FUJI_GAS_MIN_BORROWER_WEI`, `BOVEDA_FUJI_GAS_MIN_ATTESTOR_WEI`. Defaults: 0.05 / 0.02 / 0.01 AVAX.

If you already have `DEPLOYER_PRIVATE_KEY` and `BORROWER_PRIVATE_KEY` configured for `scripts/fuji-liquidation-smoke.mjs`, duplicate them into the `BOVEDA_FUJI_*` names:

```dotenv
BOVEDA_FUJI_ORIGINATOR_PRIVATE_KEY=<same value as DEPLOYER_PRIVATE_KEY>
BOVEDA_FUJI_ATTESTOR_PRIVATE_KEY=<same value as DEPLOYER_PRIVATE_KEY>
BOVEDA_FUJI_BORROWER_PRIVATE_KEY=<same value as BORROWER_PRIVATE_KEY>
BOVEDA_FUJI_FUNDING_PARTNER_ADDRESS=0x4b85d24F1995D1FBD93D454C4883B13f21ca34D5
```

The agent never reads these values; the operator duplicates them manually. The deployer/originator address `0x1139dd3EF90bbA276Edf3fA7ec4efd0781E4b5bC` is shared between originator, attestor, and admin roles by demo design (`docs/demo/fuji-demo-addresses.md`).

### What changes per endpoint in `fuji-live` ready mode

| Endpoint | Demo mode | Fuji-live ready mode |
|---|---|---|
| `POST /loans` | Store-only `Requested` loan, no on-chain side-effect. | Originates `LoanRegistry.createLoan(borrower, originator, USDC, 0, principal, ltvBps, dueDate)` with ORIGINATOR signer, captures the numeric `LoanCreated.loanId`, persists it on the loan as `onChainLoanId`. If the event is missing the loan is rolled back. |
| `POST /loans/:id/approve` | Store-only `LoanApproved`. | Unchanged. |
| `POST /loans/:id/collateral/deposit` | Strict body required (`txHash`, `vaultAddress`); backend verifies the supplied tx. | Body optional (`token` + `amount` enough). Backend signs `USDC.approve(CollateralVault, amount)` only when allowance is insufficient, then `CollateralVault.depositCollateral(onChainLoanId, amount)` with BORROWER signer. Response carries `onChainEvidence` with `approve` and `depositCollateral` steps. |
| `POST /loans/:id/payments/attest` | Synthetic registration. | Calls `PaymentAttestation.registerPayment` with ATTESTOR signer; on final payment also calls `LoanRegistry.setLoanStatus(Repaid)` with ORIGINATOR (idempotent) and `CollateralVault.releaseCollateral` with BORROWER. Response includes `onChainEvidence` array with the three steps. |
| `POST /loans/:id/liquidate` | Synthetic distribution. | Calls `LoanRegistry.setLoanStatus(Defaulted)` (idempotent) then `LiquidationEngine.canLiquidate` then `liquidateLoan` with ORIGINATOR signer and the configured `BOVEDA_FUJI_FUNDING_PARTNER_ADDRESS`. Response carries `canLiquidate` and `onChainEvidence`. When `canLiquidate.allowed` is false, the route returns HTTP 422 `WEB3_LIQUIDATION_NOT_ALLOWED` with no tx sent. |

Gas precheck: every step that signs a tx reads the signer's AVAX balance and returns HTTP 503 `WEB3_GAS_INSUFFICIENT` with the role name when the balance is below the configured threshold. Defaults are 0.05 AVAX (originator), 0.02 AVAX (borrower), 0.01 AVAX (attestor); override via the `BOVEDA_FUJI_GAS_MIN_*_WEI` env names listed above.

The dashboard operator panel "Simulador end-to-end" drives these endpoints in order; the JSON viewer "Última evidencia" surfaces the new `onChainEvidence` and `canLiquidate` fields as they come back from the backend.
