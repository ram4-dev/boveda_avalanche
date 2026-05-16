import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';

const paymentPayload = {
  installmentId: 'inst-dashboard-001',
  amount: '12500',
  currency: 'USD',
  paymentRail: 'WIRE_SIMULATED',
  paidAt: '2026-06-15T00:00:00Z',
  externalPaymentRef: 'wire-dashboard-001'
};

const marginCallPayload = {
  currentLtvBps: 7600,
  reason: 'COLLATERAL_PRICE_DROP',
  requiredTopUpAmount: '32000',
  requiredTopUpCurrency: 'USDC'
};

const liquidationPayload = {
  reason: 'LTV_BREACH',
  proceedsAmount: '154200',
  proceedsCurrency: 'USDC',
  distribution: {
    fundingPartnerAmount: '150000',
    originatorFeeAmount: '2100',
    borrowerRemainderAmount: '2100'
  }
};

describe('dashboard aggregation and event filtering', () => {
  it('filters events by loan and derives seeded dashboard metrics from loans and events', async () => {
    const app = buildFastifyApp();

    const filteredEvents = await app.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' });
    expect(filteredEvents.statusCode).toBe(200);
    expect(filteredEvents.json().events).toHaveLength(5);
    expect(filteredEvents.json().events.every((event: { loanId: string }) => event.loanId === 'loan-web3-001')).toBe(true);
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
      activePrincipalUsd: '150000',
      activeVaults: 1,
      averageLtvBps: 5000,
      loansInMarginCall: 0,
      paymentsAttested: 0,
      liquidationsExecuted: 0,
      exposureByAsset: [{ asset: 'AVAX', valueUsd: '300000' }]
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

    const payment = await app.inject({ method: 'POST', url: '/loans/loan-web3-001/payments/attest', payload: paymentPayload });
    expect(payment.statusCode).toBe(200);

    const afterPayment = await app.inject({ method: 'GET', url: '/dashboard/summary' });
    expect(afterPayment.statusCode).toBe(200);
    expect(afterPayment.json()).toMatchObject({
      activePrincipalUsd: '137500',
      activeVaults: 1,
      averageLtvBps: 5000,
      loansInMarginCall: 0,
      paymentsAttested: 1,
      liquidationsExecuted: 0
    });
    expect(afterPayment.json().recentEvents[0]).toMatchObject({
      eventType: 'InstallmentPaid',
      loanId: 'loan-web3-001',
      payload: { installmentId: 'inst-dashboard-001', remainingPrincipal: '137500', status: 'Active' }
    });

    const marginCall = await app.inject({ method: 'POST', url: '/loans/loan-web3-001/margin-call', payload: marginCallPayload });
    expect(marginCall.statusCode).toBe(200);
    const liquidation = await app.inject({ method: 'POST', url: '/loans/loan-web3-001/liquidate', payload: liquidationPayload });
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
  });
});
