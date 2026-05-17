import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';

describe('seeded loan read API', () => {
  it('loads demo loans from the seed file and exposes canonical read endpoints', async () => {
    const app = buildFastifyApp();

    const listResponse = await app.inject({ method: 'GET', url: '/loans' });
    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json();
    expect(listBody.loans.map((loan: { loanId: string }) => loan.loanId)).toEqual([
      'loan-sample-arch',
      'loan-sme-001'
    ]);
    for (const loan of listBody.loans as Array<Record<string, unknown>>) {
      expect(Object.prototype.hasOwnProperty.call(loan, 'onChainLoanId')).toBe(true);
      expect(loan.onChainLoanId).toBeNull();
    }

    const filteredResponse = await app.inject({
      method: 'GET',
      url: '/loans?scenario=WEB3_BRIDGE&status=Active'
    });
    expect(filteredResponse.statusCode).toBe(200);
    expect(filteredResponse.json().loans).toMatchObject([
      { loanId: 'loan-sample-arch', scenario: 'WEB3_BRIDGE', status: 'Active' }
    ]);

    const detailResponse = await app.inject({ method: 'GET', url: '/loans/loan-sample-arch' });
    expect(detailResponse.statusCode).toBe(200);
    const detailBody = detailResponse.json();
    expect(Object.prototype.hasOwnProperty.call(detailBody, 'onChainLoanId')).toBe(true);
    expect(detailBody.onChainLoanId).toBeNull();
    expect(detailBody).toMatchObject({
      loanId: 'loan-sample-arch',
      scenario: 'WEB3_BRIDGE',
      status: 'Active',
      borrower: { walletAddress: '0x000000000000000000000000000000000000dE01' },
      originator: { walletAddress: '0x1139dd3EF90bbA276Edf3fA7ec4efd0781E4b5bC' },
      fundingPartner: { walletAddress: '0x4b85d24F1995D1FBD93D454C4883B13f21ca34D5' },
      principal: { amount: '170', currency: 'MXN' },
      collateral: { token: 'USDC', amount: '15', amountBaseUnits: '15000000', tokenDecimals: 6, vaultAddress: '0x45E96820551466861d20f081ab390CAA9368F68B' },
      currentMetrics: { outstandingPrincipal: '170', outstandingCurrency: 'MXN' },
      terms: { liquidationCurrency: 'USDC' }
    });

    const eventsResponse = await app.inject({ method: 'GET', url: '/events' });
    expect(eventsResponse.statusCode).toBe(200);
    expect(eventsResponse.json().events.map((event: { eventType: string; loanId: string }) => [
      event.loanId,
      event.eventType
    ])).toEqual([
      ['loan-sample-arch', 'LoanCreated'],
      ['loan-sample-arch', 'LoanApproved'],
      ['loan-sample-arch', 'CollateralDeposited'],
      ['loan-sample-arch', 'LoanActivated'],
      ['loan-sample-arch', 'ReceiptIssued'],
      ['loan-sme-001', 'LoanCreated'],
      ['loan-sme-001', 'LoanApproved']
    ]);
  });

  it('returns 404 for missing loans without faking a seed record', async () => {
    const app = buildFastifyApp();

    const response = await app.inject({ method: 'GET', url: '/loans/loan-missing-404' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'LOAN_NOT_FOUND',
        message: 'Loan loan-missing-404 was not found'
      }
    });
  });

  it('rejects invalid scenario and status filters with canonical validation errors', async () => {
    const app = buildFastifyApp();

    const invalidScenario = await app.inject({ method: 'GET', url: '/loans?scenario=BAD_SCENARIO' });
    expect(invalidScenario.statusCode).toBe(400);
    expect(invalidScenario.json().error).toMatchObject({
      code: 'INVALID_FILTER',
      message: "Invalid scenario filter 'BAD_SCENARIO'. Allowed values: WEB3_BRIDGE, SME_FIAT_WORKING_CAPITAL"
    });

    const invalidStatus = await app.inject({ method: 'GET', url: '/loans?status=Paid' });
    expect(invalidStatus.statusCode).toBe(400);
    expect(invalidStatus.json().error).toMatchObject({
      code: 'INVALID_FILTER',
      message: "Invalid status filter 'Paid'. Allowed values: Requested, Approved, Active, MarginCall, Repaid, Defaulted, Liquidated, Cancelled"
    });
  });
});
