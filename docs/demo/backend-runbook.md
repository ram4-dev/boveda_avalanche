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

## Mock integration boundaries

Batch 2 is mock-first by design:

- `WAVY_NODE_MOCK` provides deterministic wallet risk assessments through the Wavy adapter boundary.
- `MockWeb3Adapter` simulates activation, payment registration, liquidation, deterministic tx hashes, and a request-driven refresh hook.
- No real Wavy credentials, Avalanche RPC URL, ABI files, contract addresses, or private keys are required for local demo success.

When Batch 1 smart contract ABI/addresses are available, add a real web3 adapter behind the same `Web3Adapter` interface instead of changing public HTTP paths.

## State and dashboard traceability

Runtime state is deterministic and in-memory:

- seed loans load from `data/demo/loans.seed.json`;
- accepted mutations append canonical events;
- `GET /events?loanId=...` filters the recorded event feed;
- `GET /dashboard/summary` derives portfolio metrics from current loans and recorded events.

Liquidation previews, liquidation responses, and `Liquidated` events report proceeds in `USDC` for the demo.
