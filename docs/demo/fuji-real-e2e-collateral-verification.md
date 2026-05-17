# Fuji real USDC collateral verification

This document defines the real-Fuji collateral path for the `real-usdc-collateral-demo` change. The key rule remains: **a frontend wallet prompt or submitted tx hash is not proof of collateral**. The backend credits collateral, releases collateral, or reports liquidation only from adapter-confirmed Fuji evidence.

## Decision

Use **Fuji USDC as both collateral token and liquidation proceeds token** for the hackathon live path.

Why:

- The Slice A contracts now support a no-swap liquidation path where locked collateral token must equal the proceeds token.
- Fuji USDC has 6 decimals, which matches the demo economics precisely: 10 USDC principal, 15 USDC collateral, 10 USDC funding-partner recovery, 0.5 USDC originator fee, and 4.5 USDC borrower remainder.
- `/demo` remains deterministic and clearly labeled `demo-simulated`; `/`/Fuji mode must label missing signer/RPC prerequisites as `fuji-unavailable` rather than silently falling back to mock hashes.

## Public live configuration

Public values may be committed and shown to judges:

- Chain: Avalanche Fuji C-Chain, `43113`
- USDC/proceeds token: `0x5425890298aed601595a70AB815c96711a31Bc65`
- LoanRegistry: `0x75eBfec02dAE1e0cd631C2d4961c5EE1849D4Fd3`
- CollateralVault: `0x45E96820551466861d20f081ab390CAA9368F68B`
- LoanReceiptNFT: `0x03AbD300629808fA9763DdB820469B2FC065e64F`
- PaymentAttestation: `0x3dDC450C16231807d63f560c01455808ce130B0e`
- LiquidationEngine: `0xe29EAEbCc8D90b18BD13AfEdbf5ceF274f3a58c4`

Operator-only values must never be printed or committed:

- Fuji RPC credentialed URL, if any.
- Attestor private key.
- Borrower private key.
- Originator/operator private key.
- Funding partner key; only its public address is safe to expose.

Runtime env names used by the backend adapter:

```text
BOVEDA_FUJI_RPC_URL                 # optional; public RPC fallback exists
BOVEDA_FUJI_ATTESTOR_PRIVATE_KEY    # secret
BOVEDA_FUJI_BORROWER_PRIVATE_KEY    # secret
BOVEDA_FUJI_ORIGINATOR_PRIVATE_KEY  # secret
BOVEDA_FUJI_FUNDING_PARTNER_ADDRESS # public address
```

If any signer prerequisite is absent, the API must return `WEB3_UNAVAILABLE` with `fuji-unavailable` evidence source.

## Required verification algorithm

Given loan id, expected borrower wallet, expected USDC token, expected amount, and submitted tx hash:

1. Read canonical loan/vault state from contracts.
2. Fetch the submitted transaction receipt on Fuji and verify it mined successfully.
3. Verify the transaction/receipt is for the expected contract and actor role.
4. Decode/validate `CollateralDeposited` and ERC-20 `Transfer` evidence for 15,000,000 base units (15 USDC).
5. Read final `CollateralVault.getVault(loanId)` state and require locked USDC collateral.
6. Use token decimals from ERC-20 metadata or the verified runtime config; do not hard-code 18 decimals for USDC.
7. Expose tx hash, block number, source label, token address, decimals, and base-unit amount in API responses/events.

## Payment + release path

Final repayment creates two separate evidence items:

1. `InstallmentPaid` / payment-attestation evidence.
2. `CollateralReleased` only when the adapter confirms release tx/balance evidence.

If release is pending or unavailable, the payment response may include `releaseEvidence.status = pending|unavailable`, but the event feed must not claim collateral was released.

## Liquidation path

The live adapter must ignore client-supplied distribution amounts and use adapter/contract-confirmed values. The canonical 15 USDC collateral distribution is:

- FundingPartner: `10_000_000` base units (10 USDC)
- Originator fee: `500_000` base units (0.5 USDC)
- Borrower remainder: `4_500_000` base units (4.5 USDC)

The `Liquidated` event/response must include source label, tx hash, block number, USDC token context, and distribution evidence.

## Repeatable demo path

For a live Fuji run, reset means **create a fresh loan and fund actors again**. On-chain state is not reset in place. `/demo` can still use `POST /demo/reset` for deterministic local repeatability.

## Verification commands

```bash
npm test -- --run
npm run typecheck
npm run build
npm run lint
```

If contracts or deploy artifacts change again:

```bash
forge build
forge test
```

## References

- Avalanche Fuji network docs: https://build.avax.network/docs/quick-start/networks/fuji
- Avalanche C-Chain EVM API docs: https://build.avax.network/docs/api-reference/c-chain/api
- Core testnet faucet: https://core.app/tools/testnet-faucet/
- Circle USDC network/address docs: https://developers.circle.com/stablecoins/usdc-contract-addresses
- ERC-20 specification: https://eips.ethereum.org/EIPS/eip-20
- Ethereum JSON-RPC transaction receipt docs: https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactionreceipt
- Snowtrace Fuji explorer: https://testnet.snowtrace.io/
