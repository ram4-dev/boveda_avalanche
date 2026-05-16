import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';
import { createMockWeb3Adapter } from '../src/adapters/web3.js';
import type { Loan, LoanStatus, SeedFile } from '../src/domain/types.js';
import { DemoStore } from '../src/store/demoStore.js';
import { loadSeedFileSync } from '../src/store/seedLoader.js';

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

describe('margin call, liquidation, and web3 failure safety', () => {
  it('moves an Active loan to MarginCall only when current LTV reaches the threshold', async () => {
    const app = buildFastifyApp();
    const before = await app.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' });

    const belowThreshold = await app.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/margin-call',
      payload: { ...marginCallPayload, currentLtvBps: 6900 }
    });
    expect(belowThreshold.statusCode).toBe(409);
    expect((await app.inject({ method: 'GET', url: '/loans/loan-web3-001' })).json()).toMatchObject({
      status: 'Active',
      currentMetrics: { currentLtvBps: 5000 }
    });
    expect((await app.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' })).json().events).toHaveLength(
      before.json().events.length
    );

    const marginCall = await app.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/margin-call',
      payload: marginCallPayload
    });
    expect(marginCall.statusCode).toBe(200);
    expect(marginCall.json()).toMatchObject({
      status: 'MarginCall',
      currentMetrics: { currentLtvBps: 7600 }
    });

    const events = await app.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' });
    expect(events.json().events.at(-1)).toMatchObject({
      eventType: 'MarginCall',
      loanId: 'loan-web3-001',
      payload: {
        currentLtvBps: 7600,
        marginCallLtvBps: 7000,
        liquidationLtvBps: 8000,
        requiredTopUpAmount: '32000',
        requiredTopUpCurrency: 'USDC',
        status: 'MarginCall'
      }
    });
  });

  it('liquidates only eligible loans with USDC proceeds and records a canonical Liquidated event', async () => {
    const app = buildFastifyApp();

    const activeLiquidation = await app.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/liquidate',
      payload: liquidationPayload
    });
    expect(activeLiquidation.statusCode).toBe(409);

    const marginCall = await app.inject({ method: 'POST', url: '/loans/loan-web3-001/margin-call', payload: marginCallPayload });
    expect(marginCall.statusCode).toBe(200);

    const liquidation = await app.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/liquidate',
      payload: liquidationPayload
    });
    expect(liquidation.statusCode).toBe(200);
    expect(liquidation.json()).toMatchObject({
      loanId: 'loan-web3-001',
      status: 'Liquidated',
      proceedsAmount: '154200',
      proceedsCurrency: 'USDC',
      distribution: liquidationPayload.distribution
    });
    expect(liquidation.json().liquidationTxHash).toMatch(/^0x[a-f0-9]{64}$/);

    const liquidatedLoan = await app.inject({ method: 'GET', url: '/loans/loan-web3-001' });
    expect(liquidatedLoan.json()).toMatchObject({ status: 'Liquidated' });
    const events = await app.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' });
    expect(events.json().events.at(-1)).toMatchObject({
      eventType: 'Liquidated',
      loanId: 'loan-web3-001',
      payload: {
        proceedsAmount: '154200',
        proceedsCurrency: 'USDC',
        distribution: liquidationPayload.distribution,
        status: 'Liquidated'
      }
    });

    const doubleLiquidation = await app.inject({ method: 'POST', url: '/loans/loan-web3-001/liquidate', payload: liquidationPayload });
    expect(doubleLiquidation.statusCode).toBe(409);
  });

  it('rejects non-USDC liquidation proceeds and preserves state/events on adapter failure', async () => {
    const nonUsdcApp = buildFastifyApp({ store: DemoStore.fromSeed(seedWithLoanStatus('loan-web3-001', 'MarginCall')) });
    const beforeNonUsdc = await nonUsdcApp.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' });
    const nonUsdc = await nonUsdcApp.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/liquidate',
      payload: { ...liquidationPayload, proceedsCurrency: 'USD' }
    });
    expect(nonUsdc.statusCode).toBe(400);
    expect(nonUsdc.json().error.code).toBe('INVALID_REQUEST');
    expect((await nonUsdcApp.inject({ method: 'GET', url: '/loans/loan-web3-001' })).json().status).toBe('MarginCall');
    expect((await nonUsdcApp.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' })).json().events).toHaveLength(
      beforeNonUsdc.json().events.length
    );

    const failingWeb3 = {
      ...createMockWeb3Adapter(),
      async liquidateLoan() {
        throw new Error('mock liquidation failure');
      }
    };
    const failureApp = buildFastifyApp({
      store: DemoStore.fromSeed(seedWithLoanStatus('loan-web3-001', 'MarginCall')),
      web3: failingWeb3
    });
    const beforeFailure = await failureApp.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' });
    const failure = await failureApp.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/liquidate',
      payload: liquidationPayload
    });
    expect(failure.statusCode).toBe(502);
    expect(failure.json().error.code).toBe('WEB3_ACTION_FAILED');
    expect((await failureApp.inject({ method: 'GET', url: '/loans/loan-web3-001' })).json().status).toBe('MarginCall');
    expect((await failureApp.inject({ method: 'GET', url: '/events?loanId=loan-web3-001' })).json().events).toHaveLength(
      beforeFailure.json().events.length
    );
  });
});

function seedWithLoanStatus(loanId: string, status: LoanStatus): SeedFile {
  const seed = loadSeedFileSync();
  return {
    ...seed,
    loans: seed.loans.map((loan): Loan => loan.loanId === loanId ? { ...loan, status, currentMetrics: { ...loan.currentMetrics, currentLtvBps: 7600 } } : loan)
  };
}
