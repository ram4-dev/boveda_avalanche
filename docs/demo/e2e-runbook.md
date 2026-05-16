# Batch 5 E2E Demo Runbook (Two Consecutive Runs)

## Scope

This runbook covers deterministic demo-mode execution (`/demo`) for:
- origination/activation evidence,
- payment attestation evidence,
- liquidation evidence (USDC proceeds),
- dashboard/event verification,
- reset and repeat.

It does **not** require live Fuji signing/RPC for baseline demo success.

## Runtime and evidence labels

- `/demo` must show **Demo mode — simulated evidence only**.
- Simulated hashes/events are labeled **Simulated demo evidence**.
- Fuji-only links are shown only when evidence source is `fuji-live` and values are valid.
- `fuji-unavailable` keeps labels visible but should not render explorer links.

## Fuji read-only smoke

Open:

```text
http://127.0.0.1:5176/
```

Expected banner:

```text
Fuji contracts reachable (read-only) — write adapter pending. Use /demo for deterministic simulated evidence.
```

Browser/API smoke endpoint:

```text
http://127.0.0.1:5176/runtime/fuji-smoke
```

Expected result:
- `ok: true`,
- `chainId: 43113`,
- all configured Batch 5 contracts report `bytecodePresent: true`,
- no RPC URL or secret-bearing value is returned.

This proves the local API can reach Fuji and detect deployed contracts. It does **not** prove write flows yet; collateral deposit/payment/liquidation writes remain disabled until the wallet/signature/receipt-verification adapter is implemented.

## Fuji prerequisites (operator-supplied placeholders)

For live write verification on `/` (not required for this runbook), operators must provide:
- Fuji RPC endpoint (placeholder)
- signer/private key custody path (placeholder)
- funded test wallet(s) (placeholder)
- contract/runtime availability checks (placeholder)

Do not store or print secrets in docs, scripts, logs, or commits.

## Run 1 (demo)

1. Start API: `npm run dev`
2. Open demo route in frontend: `/demo`
3. Execute flow:
   - collateral/origination activation checkpoint,
   - payment attestation checkpoint,
   - margin-call + liquidation checkpoint.
4. Verify evidence surfaces:
   - borrower activity labels,
   - dashboard cards,
   - event timeline/audit trail,
   - loan detail panel,
   - liquidation proceeds currency = `USDC`.

## Reset

Run:

```bash
npm run demo:reset -- --base-url http://127.0.0.1:3000
```

Script checks:
- `GET /runtime` reports `mode=demo` before reset,
- `POST /demo/reset` succeeds,
- `GET /loans/loan-web3-001` returns baseline outstanding principal,
- `GET /events?loanId=loan-web3-001` has baseline seed events and no stale payment/liquidation evidence.

## Run 2 (demo)

Repeat the same flow after reset and verify:
- payment and liquidation evidence are newly generated for the second run,
- stale run-1 payment/liquidation events are not carried into run-2 history,
- labels remain honest (`Simulated demo evidence` in demo mode).

## Fallback recovery

If `demo:reset` fails:
1. Confirm API is reachable and still in demo mode via `GET /runtime`.
2. Retry `npm run demo:reset -- --base-url <demo-api-url>`.
3. Restart API and rerun reset.

Batch 5 repeatability remains blocked until reset verification succeeds.
