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
For each loan, keeper computes LTV from `principal` and `collateral` through `OracleAdapter`, estimates the repayment obligation, and emits a planned action.

Repayment obligation is estimated as:

```text
outstanding principal + full-tenor interest + configured admin expense proxy
```

Current domain data has no explicit administrative-expense field, so the dry-run exposes an `adminExpenseBps` option and defaults it to `0` until that field exists.

The critical liquidation guard uses a 10% coverage buffer:

```text
collateral value <= repayment obligation * 110%
```

## Planned actions

- `NOOP_HEALTHY`: Active loan LTV is below `marginCallLtvBps` and collateral coverage is not critical.
- `PLAN_MARGIN_CALL`: Price-threshold or default risk should move to MarginCall first when collateral coverage is not critical.
- `PLAN_LIQUIDATION`: Any keeper-scoped loan (`Active`, `MarginCall`, or `Defaulted`) whose collateral value is within the critical 10% repayment coverage buffer.
- `NOOP_ALREADY_ESCALATED`: MarginCall loan below the critical buffer; wait for borrower top-up/recovery or further price deterioration.
- `FAIL_CLOSED`: price/validation errors (stale/invalid/unsupported token).
- `NOOP_UNSUPPORTED_STATUS`: statuses outside Active/MarginCall/Defaulted.

## Margin-call-first policy
The keeper does **not** liquidate solely because a price threshold or payment default happened. It plans `PLAN_MARGIN_CALL` first so the borrower has an explicit recovery/top-up path.

## Critical coverage exception
If collateral value falls to within 10% of the total repayment obligation, the keeper plans `PLAN_LIQUIDATION` immediately. That uses the normal liquidation/proceeds process: deduct lender repayment, interest, and administrative expenses, and return any surplus to the borrower.

This exception protects the protocol if collateral price collapses quickly and the margin-call window would leave the lender under-covered.

## Notes
- Dry-run never calls API routes and never mutates `DemoStore`.
- Price source is controlled from seed data (`referencePriceUsd`, fallback to `valueUsd / amount`) and stamped with current time.
- `FAIL_CLOSED` means the keeper should not emit margin call/liquidation plans for that loan until price input is valid/fresh.
