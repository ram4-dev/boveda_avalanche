import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';

const web3QuoteRequest = {
  scenario: 'WEB3_BRIDGE',
  borrowerWallet: '0xC0FFEE0000000000000000000000000000000003',
  requestedPrincipal: { amount: '50000', currency: 'USD' },
  collateralToken: 'AVAX',
  collateralValueUsd: '100000'
};

function createLoanPayload(riskAssessmentId: string) {
  return {
    scenario: 'WEB3_BRIDGE',
    borrower: {
      borrowerId: 'borrower-smoke-demo',
      displayName: 'Smoke Labs Demo',
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

describe('OpenAPI canonical public path smoke coverage', () => {
  it('serves representative success responses for every canonical Batch 2 public path', async () => {
    const app = buildFastifyApp();

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ ok: true, service: 'boveda-demo-api', version: '0.1.0-batch0' });

    const quote = await app.inject({ method: 'POST', url: '/quotes', payload: web3QuoteRequest });
    expect(quote.statusCode).toBe(200);
    expect(quote.json()).toMatchObject({ scenario: 'WEB3_BRIDGE', terms: { liquidationCurrency: 'USDC' } });

    const risk = await app.inject({
      method: 'POST',
      url: '/risk/wallet',
      payload: { walletAddress: web3QuoteRequest.borrowerWallet, scenario: 'WEB3_BRIDGE', collateralToken: 'AVAX' }
    });
    expect(risk.statusCode).toBe(200);
    expect(risk.json()).toMatchObject({ provider: 'WAVY_NODE_MOCK', amlStatus: 'PASS' });

    const loans = await app.inject({ method: 'GET', url: '/loans' });
    expect(loans.statusCode).toBe(200);
    expect(loans.json().loans.length).toBeGreaterThanOrEqual(2);

    const created = await app.inject({ method: 'POST', url: '/loans', payload: createLoanPayload(risk.json().riskAssessmentId) });
    expect(created.statusCode).toBe(201);
    const loanId = created.json().loanId;
    expect(created.json()).toMatchObject({ loanId, status: 'Requested', scenario: 'WEB3_BRIDGE' });

    const loan = await app.inject({ method: 'GET', url: `/loans/${loanId}` });
    expect(loan.statusCode).toBe(200);
    expect(loan.json()).toMatchObject({ loanId, status: 'Requested' });

    const approved = await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/approve`,
      payload: { approvedBy: 'originator-ark-capital-demo', fiatDisbursementRef: 'wire-smoke-001' }
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ loanId, status: 'Approved' });

    const deposited = await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/collateral/deposit`,
      payload: {
        token: 'AVAX',
        amount: '1000',
        txHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
        vaultAddress: '0xB0VEDA0000000000000000000000000000000005'
      }
    });
    expect(deposited.statusCode).toBe(200);
    expect(deposited.json()).toMatchObject({ loanId, status: 'Approved' });

    const activated = await app.inject({ method: 'POST', url: `/loans/${loanId}/activate`, payload: { receiptTokenId: '9100' } });
    expect(activated.statusCode).toBe(200);
    expect(activated.json()).toMatchObject({ loanId, status: 'Active', receipt: { receiptTokenId: '9100', soulbound: true } });

    const payment = await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/payments/attest`,
      payload: {
        installmentId: 'inst-smoke-001',
        amount: '5000',
        currency: 'USD',
        paymentRail: 'WIRE_SIMULATED',
        paidAt: '2026-06-15T00:00:00Z',
        externalPaymentRef: 'wire-smoke-payment-001'
      }
    });
    expect(payment.statusCode).toBe(200);
    expect(payment.json()).toMatchObject({ loanId, installmentId: 'inst-smoke-001', remainingPrincipal: '45000', status: 'Active' });

    const marginCall = await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/margin-call`,
      payload: { currentLtvBps: 7600, reason: 'COLLATERAL_PRICE_DROP', requiredTopUpAmount: '10000', requiredTopUpCurrency: 'USDC' }
    });
    expect(marginCall.statusCode).toBe(200);
    expect(marginCall.json()).toMatchObject({ loanId, status: 'MarginCall' });

    const liquidation = await app.inject({
      method: 'POST',
      url: `/loans/${loanId}/liquidate`,
      payload: {
        reason: 'LTV_BREACH',
        proceedsAmount: '51000',
        proceedsCurrency: 'USDC',
        distribution: { fundingPartnerAmount: '45000', originatorFeeAmount: '1000', borrowerRemainderAmount: '5000' }
      }
    });
    expect(liquidation.statusCode).toBe(200);
    expect(liquidation.json()).toMatchObject({ loanId, status: 'Liquidated', proceedsCurrency: 'USDC' });

    const dashboard = await app.inject({ method: 'GET', url: '/dashboard/summary' });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json()).toMatchObject({ paymentsAttested: 1, liquidationsExecuted: 1 });

    const events = await app.inject({ method: 'GET', url: '/events' });
    expect(events.statusCode).toBe(200);
    expect(events.json().events.some((event: { eventType: string; loanId: string }) => event.loanId === loanId && event.eventType === 'Liquidated')).toBe(true);
  });

  it('rejects unknown enum/path inputs and missing loans with canonical non-success responses', async () => {
    const app = buildFastifyApp();

    const badLoanScenario = await app.inject({ method: 'GET', url: '/loans?scenario=UNKNOWN_SCENARIO' });
    expect(badLoanScenario.statusCode).toBe(400);
    expect(badLoanScenario.json().error.code).toBe('INVALID_FILTER');

    const badLoanStatus = await app.inject({ method: 'GET', url: '/loans?status=Paid' });
    expect(badLoanStatus.statusCode).toBe(400);
    expect(badLoanStatus.json().error.code).toBe('INVALID_FILTER');

    const badQuoteScenario = await app.inject({ method: 'POST', url: '/quotes', payload: { ...web3QuoteRequest, scenario: 'UNKNOWN_SCENARIO' } });
    expect(badQuoteScenario.statusCode).toBe(400);
    expect(badQuoteScenario.json().error.code).toBe('INVALID_REQUEST');

    const badRiskScenario = await app.inject({
      method: 'POST',
      url: '/risk/wallet',
      payload: { walletAddress: web3QuoteRequest.borrowerWallet, scenario: 'UNKNOWN_SCENARIO', collateralToken: 'AVAX' }
    });
    expect(badRiskScenario.statusCode).toBe(400);
    expect(badRiskScenario.json().error.code).toBe('INVALID_REQUEST');

    const missingLoan = await app.inject({ method: 'GET', url: '/loans/loan-does-not-exist' });
    expect(missingLoan.statusCode).toBe(404);
    expect(missingLoan.json().error).toMatchObject({ code: 'LOAN_NOT_FOUND' });
  });

  it('documents local Batch 2 backend commands and mock integration boundaries', () => {
    const runbookPath = 'docs/demo/backend-runbook.md';
    expect(existsSync(runbookPath)).toBe(true);
    const runbook = readFileSync(runbookPath, 'utf8');
    expect(runbook).toContain('npm test -- --run');
    expect(runbook).toContain('npm run typecheck');
    expect(runbook).toContain('npm run build');
    expect(runbook).toContain('npm run lint');
    expect(runbook).toContain('MockWeb3Adapter');
  });
});
