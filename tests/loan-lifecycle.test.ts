import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';
import { buildFujiRuntimeConfig } from '../src/config/runtime.js';
import { DemoStore } from '../src/store/demoStore.js';
import { loadSeedFileSync } from '../src/store/seedLoader.js';
import type { Loan, LoanStatus, SeedFile } from '../src/domain/types.js';

async function acceptedRiskAssessmentId(app = buildFastifyApp()): Promise<{ app: ReturnType<typeof buildFastifyApp>; riskAssessmentId: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/risk/wallet',
    payload: {
      walletAddress: '0xC0FFEE0000000000000000000000000000000003',
      scenario: 'WEB3_BRIDGE',
      collateralToken: 'AVAX'
    }
  });
  expect(response.statusCode).toBe(200);
  return { app, riskAssessmentId: response.json().riskAssessmentId };
}

function createLoanPayload(riskAssessmentId: string) {
  return {
    scenario: 'WEB3_BRIDGE',
    borrower: {
      borrowerId: 'borrower-coffee-demo',
      displayName: 'Coffee Labs Demo',
      borrowerType: 'WEB3_STARTUP',
      walletAddress: '0xC0FFEE0000000000000000000000000000000003'
    },
    originator: {
      originatorId: 'originator-ark-capital-demo',
      displayName: 'Ark Capital Demo Fund',
      originatorType: 'VC_FUND'
    },
    fundingPartner: {
      fundingPartnerId: 'funding-bridge-vault-demo',
      displayName: 'Bóveda Bridge Credit Pool'
    },
    principal: {
      amount: '50000',
      currency: 'USD',
      fiatRail: 'WIRE_SIMULATED',
      disbursementRef: null
    },
    collateral: {
      token: 'AVAX',
      tokenAddress: '0x0000000000000000000000000000000000000000',
      chainId: 43113,
      amount: '1000',
      referencePriceUsd: '100',
      valueUsd: '100000',
      vaultAddress: null,
      depositTxHash: null
    },
    terms: {
      initialLtvBps: 5000,
      marginCallLtvBps: 7000,
      liquidationLtvBps: 8000,
      aprBps: 1450,
      tenorDays: 90,
      repaymentFrequency: 'MONTHLY',
      liquidationCurrency: 'USDC'
    },
    riskAssessmentId
  };
}

describe('loan creation and lifecycle through activation', () => {
  it('returns canonical validation errors instead of 500s for missing PR2 POST bodies', async () => {
    const { app, riskAssessmentId } = await acceptedRiskAssessmentId();

    const createMissingBody = await app.inject({ method: 'POST', url: '/loans' });
    expect(createMissingBody.statusCode).toBe(400);
    expect(createMissingBody.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Request body must be a JSON object' }
    });

    const createdForApprove = await app.inject({
      method: 'POST',
      url: '/loans',
      payload: createLoanPayload(riskAssessmentId)
    });
    const approveMissingBody = await app.inject({
      method: 'POST',
      url: `/loans/${createdForApprove.json().loanId}/approve`
    });
    expect(approveMissingBody.statusCode).toBe(400);
    expect(approveMissingBody.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Request body must be a JSON object' }
    });

    const approveEmptyBody = await app.inject({
      method: 'POST',
      url: `/loans/${createdForApprove.json().loanId}/approve`,
      payload: {}
    });
    expect(approveEmptyBody.statusCode).toBe(400);
    expect(approveEmptyBody.json().error.code).toBe('INVALID_REQUEST');

    const createdForDeposit = await app.inject({
      method: 'POST',
      url: '/loans',
      payload: { ...createLoanPayload(riskAssessmentId), borrower: { ...createLoanPayload(riskAssessmentId).borrower, borrowerId: 'borrower-deposit-missing-body' } }
    });
    const approved = await app.inject({
      method: 'POST',
      url: `/loans/${createdForDeposit.json().loanId}/approve`,
      payload: { approvedBy: 'originator-ark-capital-demo' }
    });
    expect(approved.statusCode).toBe(200);

    const depositMissingBody = await app.inject({
      method: 'POST',
      url: `/loans/${createdForDeposit.json().loanId}/collateral/deposit`
    });
    expect(depositMissingBody.statusCode).toBe(400);
    expect(depositMissingBody.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Request body must be a JSON object' }
    });

    const depositEmptyBody = await app.inject({
      method: 'POST',
      url: `/loans/${createdForDeposit.json().loanId}/collateral/deposit`,
      payload: {}
    });
    expect(depositEmptyBody.statusCode).toBe(400);
    expect(depositEmptyBody.json().error.code).toBe('INVALID_REQUEST');
  });

  it('creates a Requested loan and records a LoanCreated event using an accepted risk assessment', async () => {
    const { app, riskAssessmentId } = await acceptedRiskAssessmentId();

    const response = await app.inject({
      method: 'POST',
      url: '/loans',
      payload: createLoanPayload(riskAssessmentId)
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      scenario: 'WEB3_BRIDGE',
      status: 'Requested',
      riskAssessment: { riskAssessmentId, amlStatus: 'PASS' },
      collateral: { vaultAddress: null, depositTxHash: null },
      receipt: null
    });
    expect(response.json().loanId).toMatch(/^loan-web3-bridge-[a-f0-9]{12}$/);

    const events = await app.inject({ method: 'GET', url: `/events?loanId=${response.json().loanId}` });
    expect(events.statusCode).toBe(200);
    expect(events.json().events.map((event: { eventType: string }) => event.eventType)).toEqual(['LoanCreated']);
  });

  it('approves, records collateral deposit, and activates with a soulbound mock receipt', async () => {
    const { app, riskAssessmentId } = await acceptedRiskAssessmentId();
    const created = await app.inject({ method: 'POST', url: '/loans', payload: createLoanPayload(riskAssessmentId) });
    const loanId = created.json().loanId;

    const approved = await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/approve`,
      payload: { approvedBy: 'originator-ark-capital-demo', fiatDisbursementRef: 'wire-demo-pr2-001' }
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ status: 'Approved', principal: { disbursementRef: 'wire-demo-pr2-001' } });

    const prematureActivationEvents = await app.inject({ method: 'GET', url: `/events?loanId=${loanId}` });
    const prematureActivation = await app.inject({ method: 'POST', url: `/loans/${loanId}/activate`, payload: {} });
    expect(prematureActivation.statusCode).toBe(409);
    expect((await app.inject({ method: 'GET', url: `/events?loanId=${loanId}` })).json().events).toHaveLength(
      prematureActivationEvents.json().events.length
    );

    const deposited = await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/collateral/deposit`,
      payload: {
        token: 'AVAX',
        amount: '1000',
        txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        vaultAddress: '0xB0VEDA0000000000000000000000000000000003'
      }
    });
    expect(deposited.statusCode).toBe(200);
    expect(deposited.json()).toMatchObject({
      status: 'Approved',
      collateral: {
        depositTxHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        vaultAddress: '0xB0VEDA0000000000000000000000000000000003'
      }
    });

    const activated = await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/activate`,
      payload: { receiptTokenId: '9001' }
    });
    expect(activated.statusCode).toBe(200);
    expect(activated.json()).toMatchObject({
      status: 'Active',
      txHash: expect.stringMatching(/^0x[a-f0-9]{64}$/),
      blockNumber: null,
      activationTxHash: expect.stringMatching(/^0x[a-f0-9]{64}$/),
      activationBlockNumber: null,
      activationEvidence: {
        mode: 'demo',
        source: 'demo-simulated',
        status: 'simulated',
        label: 'Simulated demo evidence',
        txHash: expect.stringMatching(/^0x[a-f0-9]{64}$/),
        blockNumber: null,
        contracts: [{ name: 'CollateralVault', address: '0xB0VEDA0000000000000000000000000000000003' }]
      },
      receipt: {
        receiptTokenId: '9001',
        soulbound: true,
        ownerWallet: '0xC0FFEE0000000000000000000000000000000003'
      }
    });

    const events = await app.inject({ method: 'GET', url: `/events?loanId=${loanId}` });
    expect(events.json().events.map((event: { eventType: string }) => event.eventType)).toEqual([
      'LoanCreated',
      'LoanApproved',
      'CollateralDeposited',
      'LoanActivated',
      'ReceiptIssued'
    ]);
    const activationEvent = events.json().events.find((event: { eventType: string }) => event.eventType === 'LoanActivated');
    expect(activationEvent.payload.evidence).toMatchObject({
      source: 'demo-simulated',
      mode: 'demo',
      status: 'simulated'
    });
  });

  it('tops up collateral for Active and MarginCall loans and records a distinct event', async () => {
    const { app, riskAssessmentId } = await acceptedRiskAssessmentId();
    const created = await app.inject({ method: 'POST', url: '/loans', payload: createLoanPayload(riskAssessmentId) });
    const loanId = created.json().loanId;

    await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/approve`,
      payload: { approvedBy: 'originator-ark-capital-demo', fiatDisbursementRef: 'wire-topup-001' }
    });

    await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/collateral/deposit`,
      payload: {
        token: 'AVAX',
        amount: '1000',
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        vaultAddress: '0xB0VEDA0000000000000000000000000000000006'
      }
    });

    await app.inject({ method: 'POST', url: `/loans/${loanId}/activate`, payload: { receiptTokenId: '9200' } });

    const activeTopUp = await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/collateral/top-up`,
      payload: {
        token: 'AVAX',
        amount: '150',
        txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      }
    });
    expect(activeTopUp.statusCode).toBe(200);
    expect(activeTopUp.json()).toMatchObject({
      status: 'Active',
      collateral: { amount: '1150' }
    });

    await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/margin-call`,
      payload: { currentLtvBps: 7600, reason: 'COLLATERAL_PRICE_DROP', requiredTopUpAmount: '100', requiredTopUpCurrency: 'AVAX' }
    });

    const marginCallTopUp = await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/collateral/top-up`,
      payload: {
        token: 'AVAX',
        amount: '200',
        txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        resultingLtvBps: 6400
      }
    });
    expect(marginCallTopUp.statusCode).toBe(200);
    expect(marginCallTopUp.json()).toMatchObject({
      status: 'Active',
      collateral: { amount: '1350', depositTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      currentMetrics: { currentLtvBps: 6400 }
    });

    const events = await app.inject({ method: 'GET', url: `/events?loanId=${loanId}` });
    expect(events.statusCode).toBe(200);
    expect(events.json().events.map((event: { eventType: string }) => event.eventType)).toEqual([
      'LoanCreated',
      'LoanApproved',
      'CollateralDeposited',
      'LoanActivated',
      'ReceiptIssued',
      'CollateralToppedUp',
      'MarginCall',
      'CollateralToppedUp'
    ]);
  });

  it('rejects invalid loan creation and lifecycle transitions without mutating state or events', async () => {
    const { app, riskAssessmentId } = await acceptedRiskAssessmentId();
    const payload = createLoanPayload(riskAssessmentId);

    const badRisk = await app.inject({
      method: 'POST',
      url: '/loans',
      payload: { ...payload, riskAssessmentId: 'risk-missing' }
    });
    expect(badRisk.statusCode).toBe(422);

    const created = await app.inject({ method: 'POST', url: '/loans', payload });
    const loanId = created.json().loanId;
    const before = await app.inject({ method: 'GET', url: `/events?loanId=${loanId}` });

    const invalidDeposit = await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/collateral/deposit`,
      payload: {
        token: 'AVAX',
        amount: '1000',
        txHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
        vaultAddress: '0xB0VEDA0000000000000000000000000000000004'
      }
    });

    expect(invalidDeposit.statusCode).toBe(409);
    expect((await app.inject({ method: 'GET', url: `/loans/${loanId}` })).json().status).toBe('Requested');
    expect((await app.inject({ method: 'GET', url: `/events?loanId=${loanId}` })).json().events).toHaveLength(
      before.json().events.length
    );
  });

  it('returns WEB3_UNAVAILABLE for activation in fuji mode without fabricating live evidence hashes', async () => {
    const { app, riskAssessmentId } = await acceptedRiskAssessmentId(buildFastifyApp({ runtime: buildFujiRuntimeConfig({ prerequisites: 'missing' }) }));
    const created = await app.inject({ method: 'POST', url: '/loans', payload: createLoanPayload(riskAssessmentId) });
    const loanId = created.json().loanId;

    await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/approve`,
      payload: { approvedBy: 'originator-ark-capital-demo' }
    });
    await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/collateral/deposit`,
      payload: {
        token: 'AVAX',
        amount: '1000',
        txHash: '0x7777777777777777777777777777777777777777777777777777777777777777',
        vaultAddress: '0xB0VEDA0000000000000000000000000000000007'
      }
    });

    const activation = await app.inject({ method: 'POST', url: `/loans/${loanId}/activate`, payload: {} });
    expect(activation.statusCode).toBe(503);
    expect(activation.json().error.code).toBe('WEB3_UNAVAILABLE');
    expect(activation.json().error.message).toContain('Fuji web3 adapter is unavailable');
    expect(activation.json().error.message).not.toContain('0x');
  });

  it('keeps Repaid, Liquidated, and Cancelled loans terminal for practical lifecycle mutations', async () => {
    const seed = loadSeedFileSync();
    const terminalLoans: Loan[] = ['Repaid', 'Liquidated', 'Cancelled'].map((status, index) => ({
      ...structuredClone(seed.loans[0]),
      loanId: `loan-terminal-${status.toLowerCase()}`,
      status: status as LoanStatus,
      receipt: status === 'Cancelled' ? null : structuredClone(seed.loans[0].receipt)
    }));
    const terminalSeed: SeedFile = { ...seed, loans: [...seed.loans, ...terminalLoans] };
    const app = buildFastifyApp({ store: DemoStore.fromSeed(terminalSeed) });

    for (const loan of terminalLoans) {
      const before = await app.inject({ method: 'GET', url: `/events?loanId=${loan.loanId}` });
      const response = await app.inject({
        method: 'POST',
        url: `/loans/${loan.loanId}/approve`,
        payload: { approvedBy: 'originator-ark-capital-demo' }
      });

      expect(response.statusCode).toBe(409);
      expect((await app.inject({ method: 'GET', url: `/loans/${loan.loanId}` })).json().status).toBe(loan.status);
      expect((await app.inject({ method: 'GET', url: `/events?loanId=${loan.loanId}` })).json().events).toHaveLength(
        before.json().events.length
      );
    }
  });
});
