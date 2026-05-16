# Demo Control Panel Customization Apply Progress

## Summary

Implemented a frontend-only Demo Paths panel layered over canonical Batch 2 API data. No backend endpoints, request/response schemas, or persistence behavior were changed. The panel now focuses on scripted step-by-step flows instead of loose variable controls.

## RED

- Added `web/src/state/demoControls.test.ts`; initial run failed because `web/src/state/demoControls.ts` did not exist.
- Added `web/src/components/DemoControlsPanel.test.tsx`; initial run failed because `DemoControlsPanel` and state module did not exist.
- Added App regression coverage for local demo overrides; initial run failed because `App` did not render Demo controls.

## GREEN

- Added `web/src/state/demoControls.ts` with local override state, reducer, scripted demo paths, and derived display state:
  - happy repayment path: request loan, offer returned, offer accepted, collateral sent, fiat deposited, all payments made, collateral released;
  - collateral crash liquidation path: same start, then token price drop, margin/default, automatic liquidation;
  - missed payments liquidation path: same start, then grace period expiry/default and automatic liquidation;
  - collateral price -> collateral value/LTV/status;
  - payment/default/liquidation demo events and results.
- Added `web/src/components/DemoControlsPanel.tsx` as a presenter-facing scripted path runner.
- Wired `App.tsx` to derive display loan/risk/events/payment/liquidation from canonical journey data plus local demo overrides.
- Added compact sidebar control styles in `web/src/styles/app.css`.

## TRIANGULATE

- Covered collateral crash, PASS/REVIEW/BLOCK risk overrides, one-payment evidence, full repayment, collateral release, auto-expire/default, liquidation, presets, reset, and all three scripted paths.
- Added App regression to confirm no `/demo` API path is called for local overrides.

## REFACTOR

- Kept the API client and backend untouched.
- Fixed TypeScript narrowing in `App.tsx` by passing the narrowed display loan to `DemoControlsPanel`.
- Adjusted the component test to use direct `change` for controlled input event contracts.

## Verification

- `npm test -- --run` — PASS, 17 files / 69 tests.
- `npm run typecheck` — PASS.
- `npm run build` — PASS.
- `npm run lint` — PASS.

## Notes

- npm continues to warn about unknown `always-auth`; this is non-blocking and pre-existing.
- Demo paths are explicitly labeled as scripted local demo flows; the semi-functional API-backed live demo path remains available.
- The app now starts at the zero-state `Borrower request` stage, then reveals `Wallet risk check`, then the full `Borrower offer` as the path advances.
