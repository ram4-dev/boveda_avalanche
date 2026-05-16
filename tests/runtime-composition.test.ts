import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';
import { Web3UnavailableError, type Web3Adapter } from '../src/adapters/web3.js';
import { buildDemoRuntimeConfig, buildFujiRuntimeConfig } from '../src/config/runtime.js';
import { DemoStore } from '../src/store/demoStore.js';
import { loadSeedFileSync } from '../src/store/seedLoader.js';
import type { Loan, SeedFile } from '../src/domain/types.js';

function appWithStore(runtime = buildDemoRuntimeConfig()) {
  const store = DemoStore.fromSeed(loadSeedFileSync());
  return { app: buildFastifyApp({ store, runtime }), store };
}

function seedWithApprovedDepositedLoan(): SeedFile {
  const seed = loadSeedFileSync();
  const source = seed.loans[0];
  const approvedDeposited: Loan = {
    ...structuredClone(source),
    loanId: 'loan-runtime-approved-deposited',
    status: 'Approved',
    receipt: null
  };
  return { ...seed, loans: [...seed.loans, approvedDeposited] };
}

function seedWithMarginCallLoan(): SeedFile {
  const seed = loadSeedFileSync();
  const source = seed.loans[0];
  const marginCall: Loan = {
    ...structuredClone(source),
    loanId: 'loan-runtime-margin-call',
    status: 'MarginCall',
    currentMetrics: {
      ...source.currentMetrics,
      currentLtvBps: source.terms.marginCallLtvBps
    }
  };
  return { ...seed, loans: [...seed.loans, marginCall] };
}

describe('runtime composition and observability', () => {
  it('reports demo runtime metadata and response evidence headers', async () => {
    const { app } = appWithStore(buildDemoRuntimeConfig());

    const runtime = await app.inject({ method: 'GET', url: '/runtime' });
    expect(runtime.statusCode).toBe(200);
    expect(runtime.json()).toMatchObject({
      mode: 'demo',
      evidenceSource: 'demo-simulated',
      prerequisites: 'ready'
    });

    const loans = await app.inject({ method: 'GET', url: '/loans' });
    expect(loans.statusCode).toBe(200);
    expect(loans.headers['x-boveda-runtime-mode']).toBe('demo');
    expect(loans.headers['x-boveda-evidence-source']).toBe('demo-simulated');
  });

  it('uses an unavailable Fuji adapter without silently falling back to mock hashes', async () => {
    const store = DemoStore.fromSeed(seedWithApprovedDepositedLoan());
    const app = buildFastifyApp({ store, runtime: buildFujiRuntimeConfig({ prerequisites: 'missing' }) });
    const loan = store.getLoan('loan-runtime-approved-deposited');
    if (!loan) throw new Error('Expected approved seed loan');

    const runtime = await app.inject({ method: 'GET', url: '/runtime' });
    expect(runtime.json()).toMatchObject({
      mode: 'fuji',
      evidenceSource: 'fuji-unavailable',
      prerequisites: 'missing'
    });

    const activated = await app.inject({
      method: 'POST',
      url: `/loans/${loan.loanId}/activate`,
      payload: { receiptTokenId: 'fuji-pending-1' }
    });

    expect(activated.statusCode).toBe(503);
    expect(activated.headers['x-boveda-runtime-mode']).toBe('fuji');
    expect(activated.headers['x-boveda-evidence-source']).toBe('fuji-unavailable');
    expect(activated.json()).toEqual({
      error: {
        code: 'WEB3_UNAVAILABLE',
        message: 'Fuji web3 adapter is unavailable: missing runtime prerequisites'
      }
    });
  });

  it('returns WEB3_UNAVAILABLE for payment attestation and liquidation in Fuji-unavailable mode', async () => {
    const paymentStore = DemoStore.fromSeed(loadSeedFileSync());
    const paymentApp = buildFastifyApp({ store: paymentStore, runtime: buildFujiRuntimeConfig({ prerequisites: 'missing' }) });

    const payment = await paymentApp.inject({
      method: 'POST',
      url: '/loans/loan-web3-001/payments/attest',
      payload: {
        installmentId: 'runtime-fuji-unavailable-001',
        amount: '100',
        currency: 'USD',
        paymentRail: 'WIRE_SIMULATED',
        paidAt: '2026-05-16T00:00:00.000Z'
      }
    });
    expect(payment.statusCode).toBe(503);
    expect(payment.json().error.code).toBe('WEB3_UNAVAILABLE');

    const liquidationStore = DemoStore.fromSeed(seedWithMarginCallLoan());
    const liquidationApp = buildFastifyApp({ store: liquidationStore, runtime: buildFujiRuntimeConfig({ prerequisites: 'missing' }) });
    const liquidation = await liquidationApp.inject({
      method: 'POST',
      url: '/loans/loan-runtime-margin-call/liquidate',
      payload: { reason: 'runtime-test', proceedsAmount: '50000', proceedsCurrency: 'USDC' }
    });
    expect(liquidation.statusCode).toBe(503);
    expect(liquidation.json().error.code).toBe('WEB3_UNAVAILABLE');
  });

  it('accepts an injected Fuji adapter and marks canonical responses as Fuji live', async () => {
    const store = DemoStore.fromSeed(seedWithApprovedDepositedLoan());
    const fakeFujiAdapter: Web3Adapter = {
      evidenceSource: 'fuji-live',
      async activateLoan(input) {
        return {
          ok: true,
          txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          blockNumber: 12345,
          receiptTokenId: input.receiptTokenId ?? '777',
          ownerWallet: input.loan.borrower.walletAddress,
          vaultAddress: input.loan.collateral.vaultAddress ?? ''
        };
      },
      async topUpCollateral() {
        throw new Web3UnavailableError('unused');
      },
      async registerPaymentAttestation() {
        throw new Web3UnavailableError('unused');
      },
      async liquidateLoan() {
        throw new Web3UnavailableError('unused');
      }
    };
    const app = buildFastifyApp({ store, web3: fakeFujiAdapter, runtime: buildFujiRuntimeConfig({ prerequisites: 'ready' }) });
    const loan = store.getLoan('loan-runtime-approved-deposited');
    if (!loan) throw new Error('Expected approved seed loan');

    const activated = await app.inject({
      method: 'POST',
      url: `/loans/${loan.loanId}/activate`,
      payload: { receiptTokenId: '777' }
    });

    expect(activated.statusCode).toBe(200);
    expect(activated.headers['x-boveda-runtime-mode']).toBe('fuji');
    expect(activated.headers['x-boveda-evidence-source']).toBe('fuji-live');
    expect((await app.inject({ method: 'GET', url: `/events?loanId=${loan.loanId}` })).headers['x-boveda-evidence-source']).toBe('fuji-live');
  });
});
