import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';
import { buildFujiRuntimeConfig } from '../src/config/runtime.js';

describe('demo reset endpoint', () => {
  it('resets deterministic demo state from seed and returns safe reset evidence', async () => {
    const app = buildFastifyApp();

    const baselineEvents = await app.inject({ method: 'GET', url: '/events?loanId=loan-sample-arch' });
    expect(baselineEvents.statusCode).toBe(200);

    const payment = await app.inject({
      method: 'POST',
      url: '/loans/loan-sample-arch/payments/attest',
      payload: {
        installmentId: 'inst-reset-001',
        amount: '85',
        currency: 'MXN',
        paymentRail: 'SPEI_SIMULATED',
        paidAt: '2026-06-15T00:00:00Z',
        externalPaymentRef: 'spei-pay-reset-001'
      }
    });
    expect(payment.statusCode).toBe(200);

    const beforeResetLoan = await app.inject({ method: 'GET', url: '/loans/loan-sample-arch' });
    expect(beforeResetLoan.statusCode).toBe(200);
    expect(beforeResetLoan.json().currentMetrics.outstandingPrincipal).toBe('85');

    const reset = await app.inject({ method: 'POST', url: '/demo/reset' });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toMatchObject({
      mode: 'demo',
      evidenceSource: 'demo-simulated',
      label: 'Simulated demo evidence',
      seedSourcePath: 'data/demo/loans.seed.json',
      loanCount: 2
    });
    expect(reset.json().eventCount).toEqual(expect.any(Number));
    expect(reset.json().resetAt).toEqual(expect.any(String));

    const afterResetLoan = await app.inject({ method: 'GET', url: '/loans/loan-sample-arch' });
    expect(afterResetLoan.statusCode).toBe(200);
    expect(afterResetLoan.json().currentMetrics.outstandingPrincipal).toBe('170');

    const eventsAfterReset = await app.inject({ method: 'GET', url: '/events?loanId=loan-sample-arch' });
    expect(eventsAfterReset.statusCode).toBe(200);
    expect(eventsAfterReset.json().events).toEqual(baselineEvents.json().events);
  });

  it('is not registered in fuji mode and does not mutate state', async () => {
    const app = buildFastifyApp({ runtime: buildFujiRuntimeConfig({ prerequisites: 'missing' }) });

    const before = await app.inject({ method: 'GET', url: '/events?loanId=loan-sample-arch' });
    const reset = await app.inject({ method: 'POST', url: '/demo/reset' });
    const after = await app.inject({ method: 'GET', url: '/events?loanId=loan-sample-arch' });

    expect(reset.statusCode).toBe(404);
    expect(before.json().events).toEqual(after.json().events);
  });
});
