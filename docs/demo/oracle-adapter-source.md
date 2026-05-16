# Batch 7 OracleAdapter source decision

## Decision

Batch 7 now has two oracle paths:

| Context | Source | Status |
| --- | --- | --- |
| Keeper dry-run / local backend | Controlled adapter source (`CONTROLLED_DEMO_ADAPTER`) in `src/adapters/oracle.ts` | Deterministic demo/test path |
| On-chain liquidation guard | Chainlink-compatible `ChainlinkPriceOracle` in `contracts/ChainlinkPriceOracle.sol` | Real oracle path, feed addresses configured by admin |

## Why both paths exist

- The TypeScript dry-run stays deterministic and does not require live chain infrastructure.
- Real liquidation enforcement must not trust caller-supplied prices.
- `LiquidationEngine` now uses the configured on-chain `priceOracle` as source of truth when one is set.
- Manual `collateralPrice` arguments remain only as fallback/demo path when no `priceOracle` is configured.

## Chainlink-compatible on-chain source

`ChainlinkPriceOracle` stores token to feed mappings:

```text
token address -> Chainlink AggregatorV3 feed address
```

It validates `latestRoundData` before returning a price:

- feed is configured;
- answer is positive;
- `updatedAt` is present;
- `answeredInRound >= roundId`;
- round is not from the future;
- round is not older than `maxStalenessSeconds`.

Fuji feed addresses are intentionally **not hardcoded**. They must be configured during deploy/runbook using verified Chainlink Avalanche Fuji feed addresses for each collateral token.

## LiquidationEngine behavior

When `priceOracle` is configured:

```text
LiquidationEngine.canLiquidate/liquidateLoan ignore caller-supplied price inputs and read from priceOracle.
```

When `priceOracle` is not configured:

```text
LiquidationEngine uses the explicit collateralPrice/priceDecimals arguments as the controlled demo fallback.
```

## Setup path in this branch

`script/Deploy.s.sol` now deploys `ChainlinkPriceOracle` and can connect it to `LiquidationEngine` during Fuji deploy.

Required env/config inputs for a real feed:

```bash
CHAINLINK_MAX_STALENESS_SECONDS=86400
COLLATERAL_TOKEN_ADDRESS=0x...
COLLATERAL_USD_FEED_ADDRESS=0x...
```

If both collateral/feed addresses are present, deploy executes:

```solidity
priceOracle.setFeed(COLLATERAL_TOKEN_ADDRESS, COLLATERAL_USD_FEED_ADDRESS);
liquidationEngine.setPriceOracle(address(priceOracle));
```

If they are missing or zero, the oracle is deployed but not connected, and `LiquidationEngine` remains in controlled manual-price fallback mode.

## Next operational step

Before enabling real keeper transactions on Fuji:

1. Verify official Chainlink Avalanche Fuji feed addresses for each collateral token.
2. Set `COLLATERAL_TOKEN_ADDRESS` and `COLLATERAL_USD_FEED_ADDRESS` before deploy, or call `setFeed(token, feed)` after deploy.
3. Confirm `LiquidationEngine.setPriceOracle(oracle)` was called.
4. Verify `canLiquidateFromOracle(loanId)` before sending liquidation txs.
