import { describe, expect, it } from 'vitest';
import type { OnChainEvent } from '../api/types.js';
import { sampleLoan, sampleRiskAssessment } from './demoPayloads.js';
import {
  createInitialDemoControls,
  demoControlsReducer,
  deriveCollateralValueUsd,
  deriveCurrentLtvBps,
  deriveDemoView
} from './demoControls.js';

const events: OnChainEvent[] = [{ eventId: 'evt-1', eventType: 'LoanActivated', loanId: 'loan-sample-arch', txHash: null, blockNumber: null, occurredAt: '2026-06-15T00:00:00Z', payload: {} }];

describe('demo controls state', () => {
  it('does not override canonical API data by default', () => {
    const loan = sampleLoan({ status: 'Active' });
    const view = deriveDemoView({ loan, events, risk: loan.riskAssessment, lastPayment: null, lastLiquidation: null }, createInitialDemoControls());

    expect(view.isDemoOverridden).toBe(false);
    expect(view.loan.status).toBe('Active');
    expect(view.events).toEqual(events);
  });

  it('derives collateral value and current LTV from editable collateral price', () => {
    const loan = sampleLoan();
    const overrides = demoControlsReducer(createInitialDemoControls(), { type: 'set-collateral-price', priceUsd: '70' });

    expect(deriveCollateralValueUsd(loan, overrides)).toBe('1050000000');
    expect(deriveCurrentLtvBps(loan, overrides)).toBeGreaterThanOrEqual(0);

    const view = deriveDemoView({ loan, events, risk: loan.riskAssessment, lastPayment: null, lastLiquidation: null }, overrides);
    expect(view.loan.collateral.referencePriceUsd).toBe('70');
    expect(view.loan.collateral.valueUsd).toBe('1050000000');
    expect(view.loan.currentMetrics.currentLtvBps).toBeGreaterThanOrEqual(0);
    expect(view.loan.status).toBe('Active');
  });

  it('overrides risk score and AML status without changing canonical loan identity', () => {
    const loan = sampleLoan();
    let overrides = createInitialDemoControls();
    overrides = demoControlsReducer(overrides, { type: 'set-risk-score', score: 18 });
    overrides = demoControlsReducer(overrides, { type: 'set-aml-status', amlStatus: 'BLOCK' });

    const view = deriveDemoView({ loan, events, risk: sampleRiskAssessment(), lastPayment: null, lastLiquidation: null }, overrides);

    expect(view.loan.loanId).toBe('loan-sample-arch');
    expect(view.risk.riskScore).toBe(18);
    expect(view.risk.amlStatus).toBe('BLOCK');
    expect(view.risk.assessmentHash).toContain('demo-risk-override');
  });

  it('processes one payment with visible demo evidence', () => {
    const loan = sampleLoan();
    const overrides = demoControlsReducer(createInitialDemoControls(), { type: 'process-one-payment' });
    const view = deriveDemoView({ loan, events, risk: loan.riskAssessment, lastPayment: null, lastLiquidation: null }, overrides);

    expect(Number(view.loan.currentMetrics.outstandingPrincipal)).toBeGreaterThanOrEqual(0);
    expect(view.lastPayment?.attestationHash).toBe('demo-payment-attestation-001');
    expect(view.events.some((event) => event.eventType === 'DemoPaymentProcessed')).toBe(true);
  });

  it('completes all payments and marks collateral as releasable then released', () => {
    const loan = sampleLoan();
    let overrides = demoControlsReducer(createInitialDemoControls(), { type: 'complete-all-payments' });
    let view = deriveDemoView({ loan, events, risk: loan.riskAssessment, lastPayment: null, lastLiquidation: null }, overrides);

    expect(view.loan.status).toBe('Repaid');
    expect(view.loan.currentMetrics.outstandingPrincipal).toBe('0');
    expect(view.collateralRelease).toBe('releasable');
    expect(view.events.some((event) => event.eventType === 'DemoCollateralReleasable')).toBe(true);

    overrides = demoControlsReducer(overrides, { type: 'release-collateral' });
    view = deriveDemoView({ loan, events, risk: loan.riskAssessment, lastPayment: null, lastLiquidation: null }, overrides);
    expect(view.collateralRelease).toBe('released');
    expect(view.events.some((event) => event.eventType === 'DemoCollateralReleased')).toBe(true);
  });

  it('auto-expires payments into default and enables liquidation result', () => {
    const loan = sampleLoan();
    let overrides = demoControlsReducer(createInitialDemoControls(), { type: 'auto-expire-payments' });
    let view = deriveDemoView({ loan, events, risk: loan.riskAssessment, lastPayment: null, lastLiquidation: null }, overrides);

    expect(view.loan.status).toBe('Defaulted');
    expect(view.events.some((event) => event.eventType === 'DemoPaymentsExpired')).toBe(true);
    expect(view.lastLiquidation).toBeNull();

    overrides = demoControlsReducer(overrides, { type: 'trigger-liquidation' });
    view = deriveDemoView({ loan, events, risk: loan.riskAssessment, lastPayment: null, lastLiquidation: null }, overrides);
    expect(view.loan.status).toBe('Liquidated');
    expect(view.lastLiquidation?.proceedsAmount).toBe('154200');
    expect(view.events.some((event) => event.eventType === 'DemoLiquidated')).toBe(true);
  });

  it('runs the happy repayment path step by step until collateral release', () => {
    const loan = sampleLoan();
    let overrides = demoControlsReducer(createInitialDemoControls(), { type: 'select-demo-path', pathId: 'happy-repayment' });
    expect(overrides.activePathId).toBe('happy-repayment');
    expect(overrides.pathStepIndex).toBe(0);

    for (let index = 0; index < 7; index += 1) overrides = demoControlsReducer(overrides, { type: 'next-path-step' });
    const view = deriveDemoView({ loan, events, risk: loan.riskAssessment, lastPayment: null, lastLiquidation: null }, overrides);

    expect(view.loan.status).toBe('Repaid');
    expect(view.loan.currentMetrics.outstandingPrincipal).toBe('0');
    expect(view.collateralRelease).toBe('released');
    expect(view.events.some((event) => event.eventType === 'DemoCollateralReleased')).toBe(true);
  });

  it('auto-runs the collateral crash path to automatic liquidation', () => {
    const loan = sampleLoan();
    let overrides = demoControlsReducer(createInitialDemoControls(), { type: 'select-demo-path', pathId: 'collateral-crash-liquidation' });
    overrides = demoControlsReducer(overrides, { type: 'auto-run-path' });
    const view = deriveDemoView({ loan, events, risk: loan.riskAssessment, lastPayment: null, lastLiquidation: null }, overrides);

    expect(view.loan.status).toBe('Liquidated');
    expect(view.loan.collateral.referencePriceUsd).toBe('60');
    expect(view.lastLiquidation?.proceedsCurrency).toBe('USDC');
    expect(view.events.some((event) => event.eventType === 'DemoAutomaticLiquidation')).toBe(true);
  });

  it('runs the missed payments path through grace-period default and liquidation', () => {
    const loan = sampleLoan();
    let overrides = demoControlsReducer(createInitialDemoControls(), { type: 'select-demo-path', pathId: 'missed-payments-liquidation' });
    for (let index = 0; index < 6; index += 1) overrides = demoControlsReducer(overrides, { type: 'next-path-step' });
    let view = deriveDemoView({ loan, events, risk: loan.riskAssessment, lastPayment: null, lastLiquidation: null }, overrides);

    expect(view.loan.status).toBe('Defaulted');
    expect(view.events.some((event) => event.eventType === 'DemoGracePeriodExpired')).toBe(true);

    overrides = demoControlsReducer(overrides, { type: 'next-path-step' });
    view = deriveDemoView({ loan, events, risk: loan.riskAssessment, lastPayment: null, lastLiquidation: null }, overrides);
    expect(view.loan.status).toBe('Liquidated');
    expect(view.events.some((event) => event.eventType === 'DemoAutomaticLiquidation')).toBe(true);
  });

  it('applies presets and resets to canonical override state', () => {
    let overrides = demoControlsReducer(createInitialDemoControls(), { type: 'apply-preset', preset: 'collateral-crash' });
    expect(overrides.collateralPriceUsd).toBe('70');
    expect(overrides.enabled).toBe(true);

    overrides = demoControlsReducer(overrides, { type: 'reset' });
    expect(overrides).toEqual(createInitialDemoControls());
  });
});
