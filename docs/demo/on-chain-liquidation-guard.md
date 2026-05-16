# On-chain liquidation guard batch

This batch moves the critical liquidation rule from advisory keeper logic into smart contracts before any real keeper is allowed to submit liquidation transactions.

## Decision

The keeper may detect risk and submit transactions, but the smart contract must be the final authority for whether liquidation is allowed.

| Layer | Role | Authority |
| --- | --- | --- |
| Keeper | Reads price/LTV, detects risk, submits margin-call or liquidation tx | Advisory / transaction sender |
| Smart contract | Validates status, price input, collateral value, repayment obligation, and proceeds | Source of truth |
| Backend/UI | Explains state and displays planned/executed actions | Presentation only |

## Policy to enforce

Normal risk flow is margin-call-first:

1. Price threshold risk moves to `MarginCall` first.
2. Default risk moves to `MarginCall` first.
3. Borrower can recover by adding collateral/top-up.

Critical coverage exception:

```text
collateral value <= repayment obligation * 110%
```

When that condition is true, liquidation is allowed immediately to protect lender coverage during fast collateral price drops.

Repayment obligation means:

```text
outstanding principal + full-tenor expected interest + administrative expenses
```

Any surplus after lender repayment, interest, and administrative/fee deductions must be returned to the borrower through the normal liquidation proceeds process.

## Why contract enforcement is required

If the rule only lives in the keeper, another caller or a buggy keeper could invoke liquidation outside the intended policy. The contract must reject invalid liquidation attempts even when a transaction is submitted.

The keeper should still mirror the same rule off-chain to avoid sending failing transactions, but it must not be trusted as the policy authority.

## Proposed smart contract surface

Add a view guard that keeper/backend/tests can call before liquidation:

```solidity
function canLiquidate(
    uint256 loanId,
    uint256 collateralPrice,
    uint256 priceDecimals
) external view returns (bool allowed, string memory reason);
```

`liquidateLoan(...)` must enforce the same logic internally:

```solidity
require(allowed, "LiquidationEngine: liquidation not allowed");
```

## Required contract behavior

| Case | Expected result |
| --- | --- |
| Active loan reaches margin threshold but coverage is not critical | Liquidation rejected; margin call path only |
| Defaulted loan but coverage is not critical | Liquidation rejected; margin call path first |
| MarginCall loan but coverage is not critical | Liquidation rejected; wait for top-up/recovery or further price deterioration |
| Any keeper-scoped loan with critical coverage | Liquidation allowed |
| Repaid, Cancelled, or already Liquidated loan | Liquidation rejected |
| Invalid/stale/zero price input | Liquidation rejected |
| No vault or no collateral | Liquidation rejected |

## Data model gap

Current contracts do not explicitly store all components needed for repayment obligation:

- outstanding principal versus original principal;
- full-tenor expected interest or accrued interest;
- administrative expenses;
- any explicit liquidation fee policy beyond `originatorFeeBps`.

Implementation must choose one of these before coding:

| Option | Description | Trade-off |
| --- | --- | --- |
| Minimal demo | Use `loan.loanAmount` plus configured fee/admin bps | Fast, but approximate |
| Contract field | Add repayment/admin fields to `LoanRegistry` | More explicit, broader migration |
| External quote | Pass obligation amount into liquidation with contract-side bounds | Flexible, but needs stronger trust model |

Recommended first implementation: minimal demo guard using `loan.loanAmount` plus configurable admin/fee bps, then document the approximation.

## Implementation status (Batch 10 in this branch)

- [x] Added contract-level liquidation guard API via `canLiquidate(...)`.
- [x] Enforced guard inside `LiquidationEngine.liquidateLoan(...)`.
- [x] Kept proceeds distribution order: funding partner repayment first, originator fee from remainder, borrower surplus last.
- [x] Restricted `CollateralVault.liquidateCollateral(...)` to the configured `LiquidationEngine`, so direct originator calls cannot bypass the guard.
- [x] Aligned `CollateralVault` so `Active`, `MarginCall`, and `Defaulted` loans can be liquidated only through the guarded engine path.
- [x] Added Foundry tests for non-critical rejection, critical acceptance, defaulted critical liquidation, and admin-expense threshold behavior in `test/LiquidationEngine.t.sol`.
- [x] Updated docs to mark keeper policy as contract-enforced dependency.
- [x] Ran targeted and full Foundry tests in this environment after installing Foundry locally.

## Implemented demo formula

Current on-chain repayment obligation formula is intentionally minimal and explicit:

```text
repayment_obligation = loan.loanAmount + (loan.loanAmount * adminExpenseBps / 10000)
```

Critical liquidation guard uses:

```text
collateral_value <= repayment_obligation * 110%
```

`adminExpenseBps` is configurable in `LiquidationEngine` (`setAdminExpenseBps`) and defaults to `0`.

## Acceptance criteria

- A liquidation transaction cannot succeed unless the contract-level guard allows it.
- Keeper dry-run and contract guard produce the same decision for documented scenarios.
- Tests prove margin-call-first behavior for non-critical price/default risk.
- Tests prove automatic liquidation when collateral coverage is within the 10% critical buffer.
- Surplus proceeds remain payable to the borrower after deductions.

## Out of scope for this documentation batch

- Implementing Solidity changes.
- Wiring real Fuji addresses.
- Running a real keeper transaction.
- Replacing the controlled OracleAdapter with Chainlink Fuji.
