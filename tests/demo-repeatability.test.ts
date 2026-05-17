import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';

const paymentPayload = {
  installmentId: 'inst-repeat-001',
  amount: '85',
  currency: 'MXN',
  paymentRail: 'SPEI_SIMULATED',
  paidAt: '2026-06-15T00:00:00Z',
  externalPaymentRef: 'spei-pay-repeat-001'
};

describe('demo repeatability after reset', () => {
  it('supports two consecutive runs without stale payment/liquidation evidence', async () => {
    const app = buildFastifyApp();

    await runLifecycle(app, paymentPayload, 'COLLATERAL_DROP_RUN_1');
    const runOneEvents = await app.inject({ method: 'GET', url: '/events?loanId=loan-sample-arch' });
    expect(runOneEvents.statusCode).toBe(200);
    expect(runOneEvents.json().events.filter((event: { eventType: string }) => event.eventType === 'InstallmentPaid')).toHaveLength(1);
    expect(runOneEvents.json().events.filter((event: { eventType: string }) => event.eventType === 'Liquidated')).toHaveLength(1);

    const reset = await app.inject({ method: 'POST', url: '/demo/reset' });
    expect(reset.statusCode).toBe(200);

    const afterResetEvents = await app.inject({ method: 'GET', url: '/events?loanId=loan-sample-arch' });
    expect(afterResetEvents.json().events.filter((event: { eventType: string }) => event.eventType === 'InstallmentPaid')).toHaveLength(0);
    expect(afterResetEvents.json().events.filter((event: { eventType: string }) => event.eventType === 'Liquidated')).toHaveLength(0);

    await runLifecycle(app, paymentPayload, 'COLLATERAL_DROP_RUN_2');
    const runTwoEvents = await app.inject({ method: 'GET', url: '/events?loanId=loan-sample-arch' });
    expect(runTwoEvents.statusCode).toBe(200);
    expect(runTwoEvents.json().events.filter((event: { eventType: string }) => event.eventType === 'InstallmentPaid')).toHaveLength(1);
    expect(runTwoEvents.json().events.filter((event: { eventType: string }) => event.eventType === 'Liquidated')).toHaveLength(1);
    expect(runTwoEvents.json().events.filter((event: { eventType: string }) => event.eventType === 'InstallmentPaid').at(-1)?.payload.installmentId).toBe('inst-repeat-001');
  });
});

async function runLifecycle(app: ReturnType<typeof buildFastifyApp>, payment: typeof paymentPayload, liquidationReason: string): Promise<void> {
  const paymentResult = await app.inject({
    method: 'POST',
    url: '/loans/loan-sample-arch/payments/attest',
    payload: payment
  });
  expect(paymentResult.statusCode).toBe(200);

  const marginCall = await app.inject({
    method: 'POST',
    url: '/loans/loan-sample-arch/margin-call',
    payload: {
      currentLtvBps: 7600,
      reason: liquidationReason,
      requiredTopUpAmount: '12000',
      requiredTopUpCurrency: 'USDC'
    }
  });
  expect(marginCall.statusCode).toBe(200);

  const liquidation = await app.inject({
    method: 'POST',
    url: '/loans/loan-sample-arch/liquidate',
    payload: {
      reason: liquidationReason,
      proceedsAmount: '15000000',
      proceedsCurrency: 'USDC'
    }
  });
  expect(liquidation.statusCode).toBe(200);
  expect(liquidation.json()).toMatchObject({
    status: 'Liquidated',
    proceedsCurrency: 'USDC',
    evidence: {
      mode: 'demo',
      source: 'demo-simulated'
    }
  });
}
