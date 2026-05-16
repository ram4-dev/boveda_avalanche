# Batch 7 keeper dry-run

## Purpose
Batch 7 B7.2 keeper dry-run evaluates loan risk actions using the OracleAdapter without mutating state.

## Command
```bash
npm run keeper:dry-run
```

Optional seed path:
```bash
npm run keeper:dry-run -- --seed data/demo/loans.seed.json
```

## Decision model
For each loan, keeper computes LTV from `principal` and `collateral` through `OracleAdapter` and emits a planned action:

- `NOOP_HEALTHY`: LTV below `marginCallLtvBps`
- `PLAN_MARGIN_CALL`: 
  - Active loan with LTV >= `marginCallLtvBps` and < `liquidationLtvBps`
  - **Active loan with LTV >= `liquidationLtvBps` (safe demo policy)**
- `PLAN_LIQUIDATION`: MarginCall/Defaulted loan with LTV >= `liquidationLtvBps`
- `NOOP_ALREADY_ESCALATED`: MarginCall/Defaulted loan below liquidation threshold; do not re-emit a margin call
- `FAIL_CLOSED`: price/validation errors (stale/invalid/unsupported token)
- `NOOP_UNSUPPORTED_STATUS`: statuses outside Active/MarginCall/Defaulted

## Safe demo policy for Active loans above liquidation threshold
The keeper **does not directly liquidate Active loans**, even if LTV is above liquidation threshold. It plans `PLAN_MARGIN_CALL` first (`ACTIVE_ABOVE_LIQUIDATION_CALL_MARGIN_FIRST`) to avoid aggressive liquidation jumps in demo mode and preserve explicit state progression.

## Notes
- Dry-run never calls API routes and never mutates `DemoStore`.
- Price source is controlled from seed data (`referencePriceUsd`, fallback to `valueUsd / amount`) and stamped with current time.
- `FAIL_CLOSED` means the keeper should not emit margin call/liquidation plans for that loan until price input is valid/fresh.
