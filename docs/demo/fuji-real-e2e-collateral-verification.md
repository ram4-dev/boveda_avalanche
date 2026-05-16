# Fuji real E2E collateral verification

This document defines the real-Fuji collateral deposit plan for Batch 5 without implementing it yet. The key rule is: **the frontend wallet prompt is not proof of deposit**. The backend must independently verify on-chain state before crediting collateral or advancing the loan.

## Decision

Use an **ERC-20 collateral path** for the first real E2E test.

**Chosen demo split:**
- **Collateral token:** `WAVAX` on Fuji, because it keeps the AVAX collateral narrative while matching the current ERC-20 vault mechanics.
- **Liquidation proceeds currency:** `USDC`, which is already the canonical liquidation output in the API/specs/docs.

| Option | Recommendation | Why |
|--------|----------------|-----|
| Native AVAX | Do not use with current contracts | The deployed `CollateralVault` uses ERC-20 `transferFrom`; it has no payable/native AVAX deposit path. |
| WAVAX / AVAX-like ERC-20 | **Chosen for real collateral** | Keeps the AVAX collateral narrative while matching ERC-20 `approve` + `transferFrom` vault mechanics. |
| USDC on Fuji | Use for liquidation proceeds, not primary collateral | Liquidation proceeds are already canonicalized as `USDC`; using it as collateral would weaken the “crypto treasury collateral” story. |
| BTC.b | Stretch only | Strong mainnet story, but too risky for a Fuji hackathon default unless contract address and funding path are prevalidated. |

**Practical recommendation:** implement the first real Fuji E2E with **WAVAX collateral** and **USDC liquidation proceeds**. Do not use native AVAX without changing the vault contract. Before coding, confirm the exact Fuji WAVAX contract/funding path and keep `/demo` deterministic as fallback.

## Current contract reality

The deployed Solidity stack expects ERC-20 collateral:

- `LoanRegistry.createLoan(...)` rejects `collateralToken == address(0)`.
- `CollateralVault.depositCollateral(...)` reads the loan’s `collateralToken` and calls `IERC20(loan.collateralToken).transferFrom(msg.sender, address(this), amount)`.
- `CollateralVault` emits `CollateralDeposited(uint256 indexed loanId, address indexed borrower, uint256 amount)`.
- `CollateralVault.getVault(loanId)` exposes the actual stored collateral token, amount, borrower, locked flag, and liquidation flag.

That means a real deposit requires:

1. borrower has ERC-20 token balance;
2. borrower approves the vault to spend the required amount;
3. borrower calls `depositCollateral(loanId, amount)`;
4. the transaction mines successfully;
5. backend verifies contract state and logs before trusting the result.

## Manual backend verification rule

The backend must not trust any of these by themselves:

- wallet popup appeared;
- frontend says the user clicked approve/sign;
- frontend supplies a `txHash`;
- frontend supplies `amount`, `token`, or `vaultAddress`;
- transaction was submitted but not mined.

The backend may credit collateral only after it verifies all required on-chain evidence.

## Required verification algorithm

Given `loanId`, expected borrower wallet, expected token, and expected amount. For the chosen real E2E path, `expectedToken` is the confirmed Fuji `WAVAX` contract and liquidation result currency remains `USDC`:

1. **Read canonical loan state** from `LoanRegistry.getLoan(loanId)`.
   - Verify `loan.borrower == expectedBorrower`.
   - Verify `loan.collateralToken == expectedToken`.
   - Verify `loan.collateralAmount` / required amount matches the product terms.

2. **Fetch the submitted transaction receipt** using the Fuji RPC.
   - Verify receipt exists.
   - Verify `receipt.status == 1`.
   - Verify `receipt.to == CollateralVault` for the deposit call.
   - Verify `receipt.from == loan.borrower`.
   - Verify the RPC/client network is Fuji C-Chain before trusting the receipt; do not infer chain identity from the frontend.

3. **Decode and verify vault event logs** in the receipt.
   - Require `CollateralDeposited(loanId, borrower, amount)` from `CollateralVault`.
   - Verify `event.loanId == loanId`.
   - Verify `event.borrower == loan.borrower`.
   - Verify `event.amount >= expectedAmount`.

4. **Verify ERC-20 transfer evidence**.
   - Decode the token contract’s `Transfer(from, to, value)` log.
   - Verify `log.address == loan.collateralToken`.
   - Verify `from == loan.borrower`.
   - Verify `to == CollateralVault`.
   - Verify `value >= expectedAmount` in base units, using the token’s decimals policy.

5. **Read final vault state** from `CollateralVault.getVault(loanId)`.
   - Verify `vault.borrower == loan.borrower`.
   - Verify `vault.collateralToken == loan.collateralToken`.
   - Verify `vault.amount >= expectedAmount`.
   - Verify `vault.locked == true`.
   - Verify `vault.liquidated == false` before activation/liquidation.

6. **Cross-check registry state/events**.
   - Verify `LoanCollateralUpdated(loanId, newAmount)` was emitted or read back `LoanRegistry.getLoan(loanId).collateralAmount`.
   - Verify expected state transition, e.g. `LoanStateChanged(..., Active)` or `getLoanStatus(loanId) == Active`, depending on the flow.

Only after all checks pass should the API mark deposit evidence as `fuji-live` and expose explorer links.

## Token-selection checklist before coding

Before implementing the real adapter, confirm this for the selected token:

- [ ] Exact Fuji token contract address is confirmed from an official/reputable source.
- [ ] Token is visible on a Fuji explorer.
- [ ] Demo borrower wallet can receive enough token balance.
- [ ] Token decimals are known and documented.
- [ ] `approve(CollateralVault, amount)` works from the borrower wallet.
- [ ] `depositCollateral(loanId, amount)` emits both vault and ERC-20 transfer evidence.
- [ ] Backend can decode `Transfer` and `CollateralDeposited` logs.
- [ ] Explorer links show the token transfer clearly enough for judges.

## Suggested first real E2E path

1. Use **WAVAX on Fuji** as the collateral token.
2. Keep liquidation proceeds denominated and displayed in **USDC**.
3. Confirm the exact Fuji WAVAX token contract, decimals, funding path, and explorer visibility before coding.
4. Avoid BTC.b for the default run unless we already control a Fuji BTC.b-compatible token/faucet path.
5. Keep `/demo` independent and deterministic so the presentation still works if Fuji token funding or RPC fails.

## What remains to implement later

This document is only the decision/runbook basis. Implementation still needs:

- real `FujiWeb3Adapter` read/write path;
- browser wallet network/token approval flow;
- backend receipt/log decoder;
- token-decimals normalization;
- explorer link generation for verified live evidence;
- real-Fuji reset strategy, likely “new loan per run” rather than true chain reset.

## References

- Avalanche Fuji network docs: https://build.avax.network/docs/quick-start/networks/fuji
- Avalanche C-Chain EVM API docs: https://build.avax.network/docs/api-reference/c-chain/api
- Core testnet faucet: https://core.app/tools/testnet-faucet/
- Circle USDC network/address docs: https://developers.circle.com/stablecoins/usdc-contract-addresses
- ERC-20 specification: https://eips.ethereum.org/EIPS/eip-20
- Ethereum JSON-RPC transaction receipt docs: https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactionreceipt
- MetaMask transaction docs: https://docs.metamask.io/wallet/how-to/send-transactions/
- Snowtrace Fuji explorer: https://testnet.snowtrace.io/
