import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';

const paymentPayload = {
  installmentId: 'inst-dashboard-001',
  amount: '85',
  currency: 'MXN',
  paymentRail: 'SPEI_SIMULATED',
  paidAt: '2026-06-15T00:00:00Z',
  externalPaymentRef: 'spei-dashboard-001'
};

const marginCallPayload = {
  currentLtvBps: 7600,
  reason: 'COLLATERAL_PRICE_DROP',
  requiredTopUpAmount: '32000',
  requiredTopUpCurrency: 'USDC'
};

const liquidationPayload = {
  reason: 'LTV_BREACH',
  proceedsAmount: '15000000',
  proceedsCurrency: 'USDC',
  distribution: {
    fundingPartnerAmount: '10000000',
    originatorFeeAmount: '500000',
    borrowerRemainderAmount: '4500000'
  }
};

describe('dashboard aggregation and event filtering', () => {
  it('filters events by loan and derives seeded dashboard metrics from loans and events', async () => {
    const app = buildFastifyApp();

    const filteredEvents = await app.inject({ method: 'GET', url: '/events?loanId=loan-sample-arch' });
    expect(filteredEvents.statusCode).toBe(200);
    expect(filteredEvents.json().events).toHaveLength(5);
    expect(filteredEvents.json().events.every((event: { loanId: string }) => event.loanId === 'loan-sample-arch')).toBe(true);
    expect(filteredEvents.json().events.map((event: { eventType: string }) => event.eventType)).toEqual([
      'LoanCreated',
      'LoanApproved',
      'CollateralDeposited',
      'LoanActivated',
      'ReceiptIssued'
    ]);

    const dashboard = await app.inject({ method: 'GET', url: '/dashboard/summary' });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json()).toMatchObject({
      activePrincipalUsd: '10',
      activeVaults: 1,
      averageLtvBps: 5000,
      loansInMarginCall: 0,
      paymentsAttested: 0,
      liquidationsExecuted: 0,
      exposureByAsset: [{ asset: 'USDC', valueUsd: '15' }]
    });
    expect(dashboard.json().recentEvents).toHaveLength(7);
    expect(dashboard.json().recentEvents[0]).toMatchObject({
      eventId: 'seed-000007',
      eventType: 'LoanApproved',
      loanId: 'loan-sme-001'
    });
  });

  it('updates dashboard counters and recent events after payment and liquidation mutations', async () => {
    const app = buildFastifyApp();

    const payment = await app.inject({ method: 'POST', url: '/loans/loan-sample-arch/payments/attest', payload: paymentPayload });
    expect(payment.statusCode).toBe(200);

    const afterPayment = await app.inject({ method: 'GET', url: '/dashboard/summary' });
    expect(afterPayment.statusCode).toBe(200);
    expect(afterPayment.json()).toMatchObject({
      activePrincipalUsd: '5',
      activeVaults: 1,
      averageLtvBps: 5000,
      loansInMarginCall: 0,
      paymentsAttested: 1,
      liquidationsExecuted: 0
    });
    expect(afterPayment.json().recentEvents[0]).toMatchObject({
      eventType: 'InstallmentPaid',
      loanId: 'loan-sample-arch',
      payload: {
        loanId: 'loan-sample-arch',
        installmentId: 'inst-dashboard-001',
        amount: '85',
        currency: 'MXN',
        remainingPrincipal: '85',
        status: 'Active',
        evidence: {
          source: 'demo-simulated',
          mode: 'demo',
          status: 'simulated'
        }
      }
    });

    const marginCall = await app.inject({ method: 'POST', url: '/loans/loan-sample-arch/margin-call', payload: marginCallPayload });
    expect(marginCall.statusCode).toBe(200);
    const liquidation = await app.inject({ method: 'POST', url: '/loans/loan-sample-arch/liquidate', payload: liquidationPayload });
    expect(liquidation.statusCode).toBe(200);

    const afterLiquidation = await app.inject({ method: 'GET', url: '/dashboard/summary' });
    expect(afterLiquidation.statusCode).toBe(200);
    expect(afterLiquidation.json()).toMatchObject({
      activePrincipalUsd: '0',
      activeVaults: 0,
      averageLtvBps: 0,
      loansInMarginCall: 0,
      paymentsAttested: 1,
      liquidationsExecuted: 1,
      exposureByAsset: []
    });
    expect(afterLiquidation.json().recentEvents.slice(0, 3).map((event: { eventType: string }) => event.eventType)).toEqual([
      'Liquidated',
      'MarginCall',
      'InstallmentPaid'
    ]);
    expect(afterLiquidation.json().recentEvents[0]).toMatchObject({
      eventType: 'Liquidated',
      loanId: 'loan-sample-arch',
      payload: {
        reason: 'LTV_BREACH',
        trigger: {
          fromStatus: 'MarginCall',
          outcome: 'LIQUIDATED'
        },
        proceedsCurrency: 'USDC',
        distribution: {
          fundingPartnerAmount: '10000000',
          originatorFeeAmount: '500000',
          borrowerRemainderAmount: '4500000'
        },
        status: 'Liquidated',
        evidence: {
          source: 'demo-simulated',
          mode: 'demo',
          status: 'simulated'
        }
      }
    });
  });
});
