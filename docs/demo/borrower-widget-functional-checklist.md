# Batch 3 Borrower Widget — Functional Checklist

This checklist captures what the Batch 3 frontend should do based on the work completed so far.

## Runtime

- [ ] API runs locally with `npm run dev`.
- [ ] Borrower Widget runs locally with `npm run dev:web`.
- [ ] Frontend can point to a non-default API with `VITE_BOVEDA_API_BASE_URL`.
- [ ] `npm test -- --run`, `npm run typecheck`, `npm run build`, and `npm run lint` pass.

## Borrower offer

- [ ] Load the primary `WEB3_BRIDGE` borrower loan from the Batch 2 API.
- [ ] Fall back to unfiltered loans if no `WEB3_BRIDGE` loan is available.
- [ ] Show principal, collateral, initial/current LTV, APR, tenor, thresholds, liquidation currency, originator, and funding partner.
- [ ] Refresh quote through canonical `POST /quotes` using `requestedPrincipal`.
- [ ] Read quote response from canonical nested `terms` fields.
- [ ] Assess wallet risk through canonical `POST /risk/wallet`.
- [ ] Show PASS, REVIEW, and BLOCK risk states distinctly.

## Wallet

- [ ] Detect injected wallet provider through `window.ethereum`.
- [ ] Request accounts with `eth_requestAccounts`.
- [ ] Display the connected address safely.
- [ ] Handle missing wallet provider without blocking the API-simulated demo.
- [ ] Handle rejected or malformed wallet responses without private-key or seed-phrase handling.

## Collateral and activation

- [ ] Show next-action guidance based on loan status.
- [ ] For `Approved` loans, allow API-simulated collateral deposit.
- [ ] Activate the loan through the Batch 2 API after deposit.
- [ ] Display vault address and deposit transaction evidence.
- [ ] Display receipt NFT token, owner, and soulbound status after activation.
- [ ] Keep copy honest that deposit/activation are API-simulated until contracts are wired through the backend adapter.

## Active loan and payments

- [ ] Show active loan status, outstanding principal, current LTV, next due date, and collateral value.
- [ ] Attest simulated payments through canonical `POST /loans/{loanId}/payments/attest`.
- [ ] Display attestation hash, remaining principal, and resulting status.
- [ ] Preserve confirmed state when payment requests fail.
- [ ] Disable borrower mutations for terminal statuses.

## Risk, margin call, and liquidation

- [ ] Show margin-call warning when current LTV reaches the margin threshold.
- [ ] Trigger margin-call simulation through the Batch 2 API when eligible.
- [ ] Simulate liquidation through canonical `POST /loans/{loanId}/liquidate` when eligible.
- [ ] Display liquidation proceeds and distribution rows in USDC.
- [ ] Guard non-USDC liquidation payloads in preview, result, and event timeline instead of presenting them as valid proceeds.

## Event evidence

- [ ] Load loan events with canonical `GET /events?loanId=...`.
- [ ] Render an event timeline without raw JSON dumps.
- [ ] Show attestation hashes and liquidation proceeds evidence.
- [ ] Handle empty event lists cleanly.

## UX and accessibility

- [ ] Follow `DESIGN.md`: Web2 trust, high-fidelity minimalism, white cards, subtle slate background, hairline borders, blue primary action, generous spacing.
- [ ] Keep mobile web full-screen and readable.
- [ ] Keep desktop as a three-zone dashboard: borrower context, main workflow, loan evidence.
- [ ] Provide accessible names for primary controls.
- [ ] Provide status/error regions for loading, success, and API errors.
- [ ] Avoid aggressive gradients, neon/cyberpunk visuals, decorative blobs, oversized empty cards, and raw data dumps.
