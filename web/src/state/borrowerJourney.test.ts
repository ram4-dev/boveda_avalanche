import { describe, expect, it, vi } from 'vitest';
import { createInitialJourneyState, loadBorrowerContext, refreshQuote, refreshRisk, selectPreferredLoan } from './borrowerJourney.js';
import { sampleLoan } from './demoPayloads.js';

const activeLoan = sampleLoan({ loanId: 'loan-web3-001', scenario: 'WEB3_BRIDGE', status: 'Active' });
const smeLoan = sampleLoan({ loanId: 'loan-sme-001', scenario: 'SME_FIAT_WORKING_CAPITAL', status: 'Approved' });

describe('borrower journey state', () => {
  it('prefers the canonical WEB3 bridge demo loan and loads filtered events', async () => {
    const client = {
      listLoans: vi.fn(async () => ({ loans: [smeLoan, activeLoan] })),
      listEvents: vi.fn(async () => ({ events: [{ eventId: 'evt-1', eventType: 'LoanActivated', loanId: 'loan-web3-001', txHash: null, blockNumber: null, occurredAt: '2026-05-15T00:00:00Z', payload: {} }] }))
    };

    const state = await loadBorrowerContext(client, createInitialJourneyState());

    expect(client.listLoans).toHaveBeenCalledWith({ scenario: 'WEB3_BRIDGE' });
    expect(client.listEvents).toHaveBeenCalledWith({ loanId: 'loan-web3-001' });
    expect(state.loadStatus).toBe('ready');
    expect(state.selectedLoan?.loanId).toBe('loan-web3-001');
    expect(state.events).toHaveLength(1);
  });

  it('falls back to unfiltered loans when the WEB3 bridge filter is empty', async () => {
    const client = {
      listLoans: vi.fn(async (filter?: { scenario?: string }) => filter?.scenario === 'WEB3_BRIDGE' ? { loans: [] } : { loans: [smeLoan] }),
      listEvents: vi.fn(async () => ({ events: [{ eventId: 'evt-sme', eventType: 'LoanApproved', loanId: 'loan-sme-001', txHash: null, blockNumber: null, occurredAt: '2026-05-15T00:00:00Z', payload: {} }] }))
    };

    const state = await loadBorrowerContext(client, createInitialJourneyState());

    expect(client.listLoans).toHaveBeenNthCalledWith(1, { scenario: 'WEB3_BRIDGE' });
    expect(client.listLoans).toHaveBeenCalledTimes(2);
    expect(client.listLoans.mock.calls[1]).toEqual([]);
    expect(client.listEvents).toHaveBeenCalledWith({ loanId: 'loan-sme-001' });
    expect(state.loadStatus).toBe('ready');
    expect(state.selectedLoan?.loanId).toBe('loan-sme-001');
  });

  it('reports empty/error states without dropping confirmed data', async () => {
    const emptyClient = { listLoans: vi.fn(async () => ({ loans: [] })), listEvents: vi.fn() };
    await expect(loadBorrowerContext(emptyClient, createInitialJourneyState())).resolves.toMatchObject({ loadStatus: 'empty', selectedLoan: null });

    const current = { ...createInitialJourneyState(), loadStatus: 'ready' as const, selectedLoan: activeLoan, events: [] };
    const failingClient = { listLoans: vi.fn(async () => { throw new Error('api down'); }), listEvents: vi.fn() };
    const state = await loadBorrowerContext(failingClient, current);
    expect(state.loadStatus).toBe('error');
    expect(state.selectedLoan?.loanId).toBe('loan-web3-001');
    expect(state.errors.load?.message).toBe('api down');
  });

  it('stores quote and risk results while preserving the selected loan on action errors', async () => {
    const base = { ...createInitialJourneyState(), loadStatus: 'ready' as const, selectedLoan: activeLoan, events: [] };
    const quoteClient = { createQuote: vi.fn(async (_input: unknown) => ({ scenario: 'WEB3_BRIDGE', suggestedPrincipal: { amount: '170', currency: 'MXN' }, requiredCollateralValueUsd: '15', terms: { initialLtvBps: 5000, marginCallLtvBps: 7000, liquidationLtvBps: 8000, aprBps: 1450, tenorDays: 90, repaymentFrequency: 'MONTHLY', liquidationCurrency: 'USDC' } })) };
    const withQuote = await refreshQuote(quoteClient, base, '0x6f981Bf8d4fA751db294Bb62dDEB3d904514F2CF');
    expect(withQuote.quote?.terms.liquidationCurrency).toBe('USDC');
    const quotePayload = quoteClient.createQuote.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(quotePayload).toMatchObject({ requestedPrincipal: { amount: '170', currency: 'MXN' } });
    expect(quotePayload).not.toHaveProperty('requestedAmount');
    expect(quotePayload).not.toHaveProperty('requestedCurrency');

    const riskClient = { assessWalletRisk: vi.fn(async () => { throw new Error('risk unavailable'); }) };
    const withRiskError = await refreshRisk(riskClient, withQuote, '0x6f981Bf8d4fA751db294Bb62dDEB3d904514F2CF');
    expect(withRiskError.selectedLoan?.loanId).toBe('loan-web3-001');
    expect(withRiskError.errors.risk?.message).toBe('risk unavailable');
  });

  it('chooses the first web3 loan when the canonical id is absent', () => {
    const alternate = sampleLoan({ loanId: 'loan-web3-alt', scenario: 'WEB3_BRIDGE', status: 'Requested' });
    expect(selectPreferredLoan([smeLoan, alternate])?.loanId).toBe('loan-web3-alt');
  });
});
