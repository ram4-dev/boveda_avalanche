# Demo Control Panel Customization Tasks

## Review Forecast

Estimated changed lines: 450-700.

Recommended delivery: one branch is acceptable for hackathon speed if implementation stays frontend-only and within the forecast. Pause and reconsider chained PRs if backend endpoints, persistence, or broad screen rewrites are added.

## Verification Commands

- `npm test -- --run`
- `npm run typecheck`
- `npm run build`
- `npm run lint`

## Strict TDD Plan

STRICT TDD MODE IS ACTIVE. Test runner: `npm test -- --run`.

Each implementation slice should record RED, GREEN, TRIANGULATE, and REFACTOR evidence in `openspec/changes/demo-control-panel-customization/apply-progress.md`.

## Tasks

### 1. Add demo override state model

- [ ] RED: Add tests in `web/src/state/demoControls.test.ts` for initial state, reset, preset selection, collateral price override, and risk override.
- [ ] GREEN: Create `web/src/state/demoControls.ts` with types, initial state, reducer, and basic selectors.
- [ ] TRIANGULATE: Add tests for invalid/edge collateral price inputs and bounded risk score values.
- [ ] REFACTOR: Keep derivation helpers pure and independent from React.

Acceptance:

- Local demo overrides can be initialized, updated, and reset without mutating canonical loan data.

### 2. Derive collateral value, LTV, and status from overrides

- [ ] RED: Add tests for collateral price decrease crossing margin-call and liquidation thresholds.
- [ ] GREEN: Implement `deriveCollateralValue`, `deriveCurrentLtvBps`, and `deriveDemoLoan`.
- [ ] TRIANGULATE: Cover healthy, margin-call, default/liquidation, and reset cases.
- [ ] REFACTOR: Reuse existing formatting helpers rather than duplicating UI formatting.

Acceptance:

- Adjusting collateral price updates displayed collateral value, LTV, and risk/default status deterministically.

### 3. Derive risk override behavior

- [ ] RED: Add tests for PASS, REVIEW, and BLOCK risk outcomes.
- [ ] GREEN: Implement `deriveRiskAssessment` using canonical risk as fallback.
- [ ] TRIANGULATE: Verify risk score bounds and max-LTV guidance.
- [ ] REFACTOR: Preserve current `Risk passed`, `Requires review`, and `Blocked` user-facing strings where possible.

Acceptance:

- Presenter can change risk score/status without changing wallet/private-key assumptions.

### 4. Derive payment, repayment, and collateral release scenarios

- [ ] RED: Add tests for one payment, complete all payments, miss next payment, auto-expire payments, collateral releasable, and collateral released.
- [ ] GREEN: Implement payment-mode derivations and release-state derivations.
- [ ] TRIANGULATE: Verify outstanding principal, status, next due date, and payment evidence outputs.
- [ ] REFACTOR: Keep presenter-only payment evidence clearly labeled as local demo evidence if no API action was called.

Acceptance:

- Presenter can show one payment, full repayment, overdue/default, and collateral release flows.

### 5. Derive liquidation scenario

- [ ] RED: Add tests for liquidation availability and liquidation result display after margin/default.
- [ ] GREEN: Implement `deriveDemoLiquidation` and demo event derivation for terminal Liquidated state.
- [ ] TRIANGULATE: Verify USDC proceeds distribution and disabled state before eligibility.
- [ ] REFACTOR: Keep existing unsupported-currency guard intact.

Acceptance:

- Presenter can show liquidation after eligible demo states with proceeds/distribution visible.

### 5b. Add auto-run liquidation and recipient wallet demo behavior

- [ ] RED: Add tests for automatic liquidation sequence steps: collateral crash, margin/default, liquidated.
- [ ] RED: Add tests for proceeds recipient wallet display and use-connected-wallet behavior.
- [ ] GREEN: Implement local automation state and recipient wallet override.
- [ ] TRIANGULATE: Verify reset clears automation and recipient overrides.
- [ ] REFACTOR: Keep automation frontend-only and clearly labeled as local demo automation.

Acceptance:

- Presenter can auto-run the liquidation story and show a demo proceeds recipient wallet without changing API/backend contracts.

### 6. Build DemoControlsPanel UI

- [ ] RED: Add `web/src/components/DemoControlsPanel.test.tsx` for visible labels, preset selection, collateral price input, risk controls, payment buttons, liquidation/release buttons, and reset.
- [ ] GREEN: Implement `web/src/components/DemoControlsPanel.tsx`.
- [ ] TRIANGULATE: Add accessibility labels and disabled-state tests.
- [ ] REFACTOR: Keep markup compact and avoid nested cards.

Acceptance:

- The left panel contains a clearly labeled Demo controls section with all required controls.

### 7. Wire App integration

- [ ] RED: Add or extend `web/src/App.regression.test.tsx` for derived demo controls flowing into offer/activity display.
- [ ] GREEN: Wire demo override state in `web/src/App.tsx` and pass derived values into existing screens.
- [ ] TRIANGULATE: Verify reset restores canonical API state.
- [ ] REFACTOR: Avoid duplicating canonical journey state and keep API mutations unchanged.

Acceptance:

- Demo controls update visible borrower widget state while canonical API load remains default.

### 8. Style panel and controls

- [ ] RED: Add UI regression expectations only where text/roles are stable.
- [ ] GREEN: Extend `web/src/styles/app.css` for compact panel controls, inputs, segmented presets, helper labels, and warning states.
- [ ] TRIANGULATE: Check desktop and narrow layouts.
- [ ] REFACTOR: Remove redundant styling and preserve DESIGN.md visual system.

Acceptance:

- The panel remains bounded, non-floating, readable, and visually distinct as presenter controls.

### 9. Final verification

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm run lint`.
- [ ] Update `apply-progress.md` with evidence.
- [ ] Update or add demo checklist notes if needed.

Acceptance:

- All tests and build checks pass.
- SDD requirements are traceable to implemented tests.

## Implementation Notes

- Prefer frontend-only local overrides for this SDD.
- Do not change the Batch 2 API structure, endpoint paths, request/response schemas, or backend persistence model.
- Keep the existing semi-functional live demo path working against the API while layering video-demo controls locally in the frontend.
- Do not add secrets, private-key handling, .env dependencies, or wallet custody flows.
- Do not claim local demo overrides are real chain settlement.
- Preserve existing test-sensitive strings unless a test intentionally changes them.

## Skill Resolution

injected
