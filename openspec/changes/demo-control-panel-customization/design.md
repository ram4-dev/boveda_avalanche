# Demo Control Panel Customization Design

## Overview

Add a local presenter control layer to the existing Borrower Widget. The Batch 2 API remains the canonical source on initial load and for supported API actions. The demo panel applies local scenario overrides on top of the loaded loan so a presenter can drive video-friendly flows without restarting the backend or waiting for real time.

## Current Architecture

Relevant current frontend seams:

- `web/src/App.tsx`
  - Creates API client.
  - Uses `useBorrowerJourney`.
  - Renders left borrower sidebar, main offer screen, and right loan activity rail.
- `web/src/state/borrowerJourney.ts`
  - Loads canonical loan/events.
  - Holds selected loan, quote, risk, payment/liquidation result, action, errors.
  - Calls existing API actions: quote, risk, deposit, activate, payment attest, margin call, liquidate.
- `web/src/screens/OfferRequestScreen.tsx`
  - Displays offer metrics, quote, wallet, risk.
- `web/src/screens/LoanActivityScreen.tsx`
  - Displays current metrics, receipt, payment, risk/liquidation controls, event timeline.
- `web/src/api/types.ts`
  - Defines Loan, RiskAssessment, PaymentAttestation, LiquidationResult, and related types.

## Key Decision

Use local demo overrides rather than backend rewrites for presenter customization. The API contract stays unchanged: no new endpoints, schema changes, persistence requirements, or backend state mutations are required for this SDD. This preserves the semi-functional live demo path while adding a frontend-only variable storytelling layer for the video demo.

Why:

- Fastest path for hackathon video demos.
- Keeps Batch 2 API contract stable.
- Avoids fake persistence complexity.
- Makes simulation boundaries explicit.
- Reset can simply clear overrides and reload canonical API data.

## State Model

Introduce a demo control state module, likely `web/src/state/demoControls.ts`.

### Core types

Suggested model:

```ts
export type DemoPaymentMode =
  | "none"
  | "one-payment"
  | "complete-all"
  | "miss-next"
  | "auto-expire";
export type DemoAutomationMode = "idle" | "auto-liquidation" | "auto-repayment";
export type DemoPreset =
  | "canonical"
  | "healthy"
  | "risk-review"
  | "risk-blocked"
  | "collateral-crash"
  | "full-repayment"
  | "default-liquidation";
export type CollateralReleaseState = "locked" | "releasable" | "released";

export type DemoOverrides = {
  enabled: boolean;
  preset: DemoPreset;
  collateralPriceUsd?: string;
  riskScore?: number;
  amlStatus?: AmlStatus;
  paymentMode: DemoPaymentMode;
  missedPayments: number;
  forceStatus?: LoanStatus;
  collateralRelease: CollateralReleaseState;
  liquidationProceedsAmount?: string;
  proceedsRecipientWallet?: string;
  automationMode: DemoAutomationMode;
  automationStep: number;
};
```

Derived state should be computed by pure functions:

- `deriveCollateralValue(loan, overrides)`
- `deriveCurrentLtvBps(loan, overrides)`
- `deriveRiskAssessment(loan, currentRisk, overrides)`
- `deriveDemoLoan(loan, overrides)`
- `deriveDemoPaymentEvidence(loan, overrides)`
- `deriveDemoLiquidation(loan, overrides)`
- `deriveDemoEvents(events, loan, overrides)`

### Calculation notes

- Collateral value = collateral amount \* collateral reference price.
- Current LTV bps = outstanding principal / collateral value \* 10_000.
- If LTV >= liquidation threshold, demo status may become Defaulted or Liquidated depending on preset/action.
- If LTV >= margin threshold but below liquidation threshold, demo status may become MarginCall.
- Full repayment sets outstanding principal to 0 and collateral release to Releasable or Released.
- Liquidation uses USDC proceeds, preserving existing convention.

## UI Placement

Use the existing bounded left sidebar as the presenter panel.

Recommended layout:

1. Borrower summary section remains at top.
2. Add `DemoControlsPanel` below summary.
3. Keep controls compact:
   - Preset segmented/select control.
   - Collateral price numeric input.
   - Risk score range or number input.
   - AML status select.
   - Payment quick actions.
   - Scenario quick actions.
   - Reset demo button.
4. Use a distinct `Demo controls` label and helper text: `Local presenter overrides only`.

Avoid making it floating or sticky. It should remain a bounded lateral panel with background.

## Component Boundaries

Suggested files:

- `web/src/state/demoControls.ts`
  - Types, initial state, reducer, derivation helpers.
- `web/src/state/demoControls.test.ts`
  - Pure reducer/derived-state tests.
- `web/src/components/DemoControlsPanel.tsx`
  - Presenter controls UI.
- `web/src/components/DemoControlsPanel.test.tsx`
  - UI interactions and visible labels.
- `web/src/App.tsx`
  - Owns demo control state and passes derived loan/risk/events/payment/liquidation into existing screens.
- `web/src/styles/app.css`
  - Panel and form-control styling consistent with existing tokens.

## Integration Strategy

In `App.tsx`:

1. Load canonical journey as today.
2. Create local demo control state.
3. When `loan` exists, derive:
   - `displayLoan`
   - `displayRisk`
   - `displayEvents`
   - `displayLastPayment`
   - `displayLastLiquidation`
4. Pass derived display values to `OfferRequestScreen` and `LoanActivityScreen`.
5. Keep API mutations available, but make local demo quick actions independent from API where needed.

The canonical `journey.state.selectedLoan` should not be mutated directly.

## Presenter Actions

### Presets

- Canonical reset
- Healthy borrower
- Risk review
- Risk blocked
- Collateral crash
- Full repayment
- Default and liquidation

### Manual Controls

- Collateral reference price USD
- Risk score
- AML status
- Process one payment
- Complete all payments
- Miss next payment
- Auto-expire payments
- Trigger liquidation
- Auto-run liquidation sequence
- Release collateral
- Proceeds recipient wallet
- Use connected wallet as proceeds recipient
- Reset demo

## API Boundary

No new backend endpoint is required, and this SDD should not change the existing Batch 2 API structure. The frontend demo layer must be optional, local, resettable, and clearly separate from canonical API data.

Use existing API calls when the presenter clicks borrower-equivalent actions:

- deposit collateral
- activate loan
- attest one payment
- margin call
- liquidate

Use local overrides for presenter-only state shaping:

- risk score/status override
- collateral price change
- complete all payments
- miss/expire payments
- released collateral state
- preset transitions
- auto-run liquidation/repayment animation state
- displayed liquidation recipient wallet

Real wallet credibility should be handled in two layers:

1. Batch 3 / current SDD: connect an injected wallet and let the presenter select/display it as the demo proceeds recipient. This is still local/demo routing.
2. Batch 5: wire contract addresses/ABI and real Fuji transactions so a connected wallet can sign or receive actual testnet movements.

## Visual Design

Follow existing DESIGN.md/tokens:

- Quiet data-product controls.
- Compact rows.
- Avoid nested cards.
- Use sidebar background and hairline dividers.
- Use clear labels and small helper text.
- Use warning/danger tones only for risk/default/liquidation.
- Keep buttons from wrapping badly on small widths.

## Testing Strategy

Strict TDD:

1. RED: Add reducer/derived-state tests for collateral price to LTV, risk overrides, payment modes, default, liquidation, reset.
2. GREEN: Implement pure state module.
3. RED: Add UI tests for DemoControlsPanel labels and interactions.
4. GREEN: Implement UI panel.
5. RED: Add App integration test for derived values flowing into existing screens.
6. GREEN: Wire `App.tsx`.
7. REFACTOR: Consolidate formatting/helpers if needed.

## Review Risk

Expected touched areas:

- `web/src/state/*`
- `web/src/components/*`
- `web/src/App.tsx`
- `web/src/styles/app.css`
- tests

Estimated changed lines: 450-700.

This is near the configured review budget. If implementation grows into backend changes or extensive screen rewrites, split into chained PR/work units.

## Skill Resolution

injected
