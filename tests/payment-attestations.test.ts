import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';
import type { Loan, LoanStatus, SeedFile } from '../src/domain/types.js';
import { DemoStore } from '../src/store/demoStore.js';
import { loadSeedFileSync } from '../src/store/seedLoader.js';

const partialPaymentPayload = {
  installmentId: 'inst-demo-001',
  amount: '12500',
  currency: 'USD',
  paymentRail: 'WIRE_SIMULATED',
  paidAt: '2026-06-15T00:00:00Z',
  externalPaymentRef: 'wire-pay-demo-001'
};

describe('payment attestation API', () => {
  it('attests a partial payment, records InstallmentPaid, and handles identical retries idempotently', async () => {
    const app = buildFastifyApp();

    const first = await app.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/payments/attest',
      payload: partialPaymentPayload
    });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      loanId: 'loan-web3-001',
      installmentId: 'inst-demo-001',
      amount: '12500',
      currency: 'USD',
      remainingPrincipal: '137500',
      status: 'Active'
    });
    expect(first.json().attestationHash).toMatch(/^0x[a-f0-9]{64}$/);

    const loanAfterFirst = await app.inject({ method: 'GET', url: '/loans/loan-web3-001' });
    expect(loanAfterFirst.json().currentMetrics.outstandingPrincipal).toBe('137500');
    expect(loanAfterFirst.json().status).toBe('Active');

    const eventsAfterFirst = await app.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' });
    const paymentEvents = eventsAfterFirst.json().events.filter((event: { eventType: string }) => event.eventType === 'InstallmentPaid');
    expect(paymentEvents).toHaveLength(1);
    expect(paymentEvents[0]).toMatchObject({
      eventType: 'InstallmentPaid',
      loanId: 'loan-web3-001',
      payload: {
        installmentId: 'inst-demo-001',
        amount: '12500',
        currency: 'USD',
        paymentRail: 'WIRE_SIMULATED',
        attestationHash: first.json().attestationHash,
        remainingPrincipal: '137500',
        status: 'Active'
      }
    });

    const retry = await app.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/payments/attest',
      payload: partialPaymentPayload
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first.json());

    const loanAfterRetry = await app.inject({ method: 'GET', url: '/loans/loan-web3-001' });
    expect(loanAfterRetry.json().currentMetrics.outstandingPrincipal).toBe('137500');
    const eventsAfterRetry = await app.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' });
    expect(eventsAfterRetry.json().events.filter((event: { eventType: string }) => event.eventType === 'InstallmentPaid')).toHaveLength(1);
  });

  it('makes final payment Repaid and preserves MarginCall status for partial repayment', async () => {
    const finalPaymentApp = buildFastifyApp();
    const finalPayment = await finalPaymentApp.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/payments/attest',
      payload: {
        ...partialPaymentPayload,
        installmentId: 'inst-final-001',
        amount: '150000',
        externalPaymentRef: 'wire-pay-final-001'
      }
    });
    expect(finalPayment.statusCode).toBe(200);
    expect(finalPayment.json()).toMatchObject({
      loanId: 'loan-web3-001',
      remainingPrincipal: '0',
      status: 'Repaid'
    });
    const repaidLoan = await finalPaymentApp.inject({ method: 'GET', url: '/loans/loan-web3-001' });
    expect(repaidLoan.json()).toMatchObject({ status: 'Repaid', currentMetrics: { outstandingPrincipal: '0' } });

    const marginCallApp = buildFastifyApp({ store: DemoStore.fromSeed(seedWithLoanStatus('loan-web3-001', 'MarginCall')) });
    const marginCallPayment = await marginCallApp.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/payments/attest',
      payload: {
        ...partialPaymentPayload,
        installmentId: 'inst-margin-001',
        amount: '5000',
        externalPaymentRef: 'wire-pay-margin-001'
      }
    });
    expect(marginCallPayment.statusCode).toBe(200);
    expect(marginCallPayment.json()).toMatchObject({ remainingPrincipal: '145000', status: 'MarginCall' });
    const marginCallLoan = await marginCallApp.inject({ method: 'GET', url: '/loans/loan-web3-001' });
    expect(marginCallLoan.json()).toMatchObject({ status: 'MarginCall', currentMetrics: { outstandingPrincipal: '145000' } });
  });

  it('changes hash when payment evidence changes and rejects invalid payment mutations without changing state', async () => {
    const app = buildFastifyApp();
    const first = await app.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/payments/attest',
      payload: partialPaymentPayload
    });
    const changedEvidence = await app.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/payments/attest',
      payload: { ...partialPaymentPayload, installmentId: 'inst-demo-002', externalPaymentRef: 'wire-pay-demo-002' }
    });
    expect(changedEvidence.statusCode).toBe(200);
    expect(changedEvidence.json().attestationHash).not.toBe(first.json().attestationHash);

    const currencyMismatchEvents = await app.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' });
    const badCurrency = await app.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/payments/attest',
      payload: { ...partialPaymentPayload, installmentId: 'inst-bad-currency', currency: 'MXN' }
    });
    expect(badCurrency.statusCode).toBe(400);
    expect(badCurrency.json().error.code).toBe('INVALID_REQUEST');
    expect((await app.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' })).json().events).toHaveLength(
      currencyMismatchEvents.json().events.length
    );

    const terminalApp = buildFastifyApp({ store: DemoStore.fromSeed(seedWithLoanStatus('loan-web3-001', 'Liquidated')) });
    const terminalBefore = await terminalApp.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' });
    const terminal = await terminalApp.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/payments/attest',
      payload: partialPaymentPayload
    });
    expect(terminal.statusCode).toBe(409);
    expect((await terminalApp.inject({ method: 'GET', url: '/loans/loan-web3-001' })).json()).toMatchObject({
      status: 'Liquidated',
      currentMetrics: { outstandingPrincipal: '150000' }
    });
    expect((await terminalApp.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' })).json().events).toHaveLength(
      terminalBefore.json().events.length
    );
  });
});

function seedWithLoanStatus(loanId: string, status: LoanStatus): SeedFile {
  const seed = loadSeedFileSync();
  return {
    ...seed,
    loans: seed.loans.map((loan): Loan => loan.loanId === loanId ? { ...loan, status } : loan)
  };
}
