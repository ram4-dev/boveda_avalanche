# Demo Control Panel Customization

## Status

Proposed

## Executive Summary

Add a presenter-facing Demo Control Panel to the Borrower Widget so hackathon judges can see the most important borrower scenarios without waiting for real time, external services, or manual backend resets. The panel lets the presenter modify collateral price, risk score/status, payment progression, overdue/default behavior, repayment completion, collateral release, and liquidation outcomes while clearly labeling these controls as demo simulations.

## Problem

The current borrower widget shows the Batch 2 API flow, but a video demo needs sharper narrative control:

- The collateral price must be adjustable to make LTV, margin call, and default states understandable.
- Risk checks should be demonstrable without relying on a hard-coded mock score.
- Payments need presenter shortcuts: one payment, complete all payments, or miss/expire payments.
- The happy path must show collateral release after full repayment.
- The risk path must show liquidation after margin breach/default.
- The presenter needs a reset button to return to the canonical seed scenario.

## Architecture Constraint

This change SHALL NOT modify the existing Batch 2 API structure or require new backend endpoints. The demo paths panel is a frontend-only script/override layer for video storytelling. The existing API remains available for the semi-functional live demo path, while presenter paths can locally simulate states that are hard to trigger on demand.

## Goals

- Add a bounded, polished presenter panel integrated with the existing left demo panel.
- Replace loose manual customizations with scripted demo paths that can be advanced step by step or auto-run.
- Provide three primary paths:
  - Happy repayment: request loan -> offer returned -> offer accepted -> collateral sent -> fiat deposited -> all payments made -> collateral released.
  - Collateral crash liquidation: same start -> token price drops -> LTV breach -> automatic liquidation.
  - Missed payments liquidation: same start -> payments missed -> grace period expired/default -> automatic liquidation.
- Keep the simulation honest by labeling all path actions as scripted local demo flows unless the action calls the existing Batch 2 API.
- Preserve existing borrower widget behavior and tests.

## Non-Goals

- Changing the Batch 2 API structure, request/response schemas, or canonical endpoint paths.
- Real oracle integration.
- Real payment processor integration.
- Real smart-contract collateral release or liquidation settlement.
- Persisting demo overrides server-side.
- Replacing the Batch 2 API as source of truth.
- Blocking future backend/live-demo development with frontend demo-only assumptions.
- Reading private keys, seed phrases, .env files, wallet secrets, or credentials.

## Scope

### Include

- React state layer for local demo scenario overrides on top of canonical API data.
- Demo control UI inside the existing borrower sidebar/panel area.
- Derived metric calculations for collateral value, LTV, margin/default state, and liquidation preview.
- Scripted presenter paths for payments, collateral movement, disbursement, default, and liquidation scenarios.
- Auto-run demo sequences that show how risk breach/default automatically leads to liquidation.
- Demo proceeds recipient wallet field so the video can show funds routed to a common wallet address, while clearly labeling it as local/demo unless Batch 5 contract integration is active.
- Reset to canonical loaded API state.
- Tests for reducer/state transitions and UI feedback.

### Exclude

- Backend schema migration.
- Production-grade state persistence.
- Real Wavy Node/oracle/risk provider changes.
- Real chain settlement semantics.

## UX Principles

- The panel should read as a presenter control surface, not as borrower-facing production UI.
- Controls must be compact and scannable.
- Demo-only behavior must be visibly labeled.
- The first viewport should explain the demo state without narration.
- Avoid nested cards and floating panels; keep the panel bounded with a subtle background.

## Acceptance Criteria

- A presenter can run the happy repayment path step by step until collateral release.
- A presenter can run the collateral crash liquidation path and see token price drop, LTV breach, automatic liquidation, and USDC proceeds/distribution.
- A presenter can run the missed payments liquidation path and see grace-period default, automatic liquidation, and USDC proceeds/distribution.
- A presenter can run an automatic liquidation sequence from risk breach/default to terminal liquidation without manual step-by-step clicking.
- A presenter can set or display a demo proceeds recipient wallet for the liquidation outcome.
- A presenter can reset the demo to canonical Batch 2 API data.
- Existing tests remain green.
- New tests cover demo state transitions and visible UI labels.

## Risks

- Overloading the borrower UI with too many controls.
- Confusing simulated local state with canonical API state.
- Losing credibility if automatic liquidation only appears as a manual button and no recipient wallet is shown.
- Breaking string-sensitive existing UI tests.
- Scope creep into backend rewrites.

## Mitigations

- Label the feature as Demo controls.
- Keep overrides local and resettable.
- Preserve existing core strings.
- Add focused reducer tests before UI implementation.
- Only use existing API calls where already supported.

## Skill Resolution

injected
