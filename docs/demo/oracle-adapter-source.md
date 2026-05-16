# Batch 7 OracleAdapter source decision

## Decision
For Batch 7 PR slice B7.1, backend price reads use a **controlled adapter source** (`CONTROLLED_DEMO_ADAPTER`) implemented in `src/adapters/oracle.ts`.

## Why now
- Keeps demo behavior deterministic and reviewable.
- Enables LTV computation for margin-risk workflows without introducing external infra dependencies.
- Provides explicit validation for invalid prices (zero/negative/stale/future).

## Boundary for next slice
The adapter API is intentionally replaceable:
- `getNormalizedPrice(token)`
- `computeLoanLtvBps(loan)`

A later slice can provide a Chainlink Fuji-compatible implementation behind the same boundary for keeper automation.
