import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';

describe('seeded loan read API', () => {
  it('loads demo loans from the seed file and exposes canonical read endpoints', async () => {
    const app = buildFastifyApp();

    const listResponse = await app.inject({ method: 'GET', url: '/loans' });
    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json();
    expect(listBody.loans.map((loan: { loanId: string }) => loan.loanId)).toEqual([
      'loan-web3-001',
      'loan-sme-001'
    ]);

    const filteredResponse = await app.inject({
      method: 'GET',
      url: '/loans?scenario=WEB3_BRIDGE&status=Active'
    });
    expect(filteredResponse.statusCode).toBe(200);
    expect(filteredResponse.json().loans).toMatchObject([
      { loanId: 'loan-web3-001', scenario: 'WEB3_BRIDGE', status: 'Active' }
    ]);

    const detailResponse = await app.inject({ method: 'GET', url: '/loans/loan-web3-001' });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      loanId: 'loan-web3-001',
      scenario: 'WEB3_BRIDGE',
      status: 'Active',
      borrower: { walletAddress: '0xA11CE00000000000000000000000000000000001' },
      terms: { liquidationCurrency: 'USDC' }
    });

    const eventsResponse = await app.inject({ method: 'GET', url: '/events' });
    expect(eventsResponse.statusCode).toBe(200);
    expect(eventsResponse.json().events.map((event: { eventType: string; loanId: string }) => [
      event.loanId,
      event.eventType
    ])).toEqual([
      ['loan-web3-001', 'LoanCreated'],
      ['loan-web3-001', 'LoanApproved'],
      ['loan-web3-001', 'CollateralDeposited'],
      ['loan-web3-001', 'LoanActivated'],
      ['loan-web3-001', 'ReceiptIssued'],
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
