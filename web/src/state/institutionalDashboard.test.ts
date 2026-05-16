import { describe, expect, it, vi } from 'vitest';
import type { DashboardSummary, Loan, OnChainEvent } from '../api/types.js';
import { sampleLoan } from './demoPayloads.js';
import {
  createInitialInstitutionalDashboardState,
  loadInstitutionalDashboard,
  refreshInstitutionalDashboard,
  selectInstitutionalDashboardLoan,
  setDashboardDemoMode
} from './institutionalDashboard.js';

const web3Loan = sampleLoan({ loanId: 'loan-web3-001', scenario: 'WEB3_BRIDGE', status: 'Active' });
const smeLoan = sampleLoan({ loanId: 'loan-sme-001', scenario: 'SME_FIAT_WORKING_CAPITAL', status: 'Approved' });
const event: OnChainEvent = { eventId: 'evt-1', eventType: 'LoanCreated', loanId: 'loan-web3-001', txHash: '0xabc', blockNumber: 12, occurredAt: '2026-05-15T00:00:00Z', payload: {} };
const summary: DashboardSummary = { activePrincipalUsd: '150000', activeVaults: 1, averageLtvBps: 5000, loansInMarginCall: 0, paymentsAttested: 1, liquidationsExecuted: 0, exposureByAsset: [], recentEvents: [event] };

describe('institutional dashboard state', () => {
  it('loads summary, loans, and events independently into ready state', async () => {
    const client = {
      getDashboardSummary: vi.fn(async () => summary),
      listLoans: vi.fn(async () => ({ loans: [web3Loan, smeLoan] })),
      listEvents: vi.fn(async () => ({ events: [event] }))
    };

    const state = await loadInstitutionalDashboard(client, createInitialInstitutionalDashboardState());

    expect(client.getDashboardSummary).toHaveBeenCalledOnce();
    expect(client.listLoans).toHaveBeenCalledWith();
    expect(client.listEvents).toHaveBeenCalledWith();
    expect(state).toMatchObject({ status: 'ready', summary, loans: [web3Loan, smeLoan], events: [event], action: null });
    expect(state.lastLoadedAt).toBeTruthy();
  });

  it('preserves successful sections and exposes safe errors during partial failure', async () => {
    const client = {
      getDashboardSummary: vi.fn(async () => { throw new Error('summary down'); }),
      listLoans: vi.fn(async () => ({ loans: [web3Loan] })),
      listEvents: vi.fn(async () => ({ events: [event] }))
    };

    const state = await loadInstitutionalDashboard(client, createInitialInstitutionalDashboardState());

    expect(state.status).toBe('partial');
    expect(state.summary).toBeNull();
    expect(state.loans).toEqual([web3Loan]);
    expect(state.errors.summary).toEqual({ code: 'REQUEST_FAILED', message: 'summary down' });
  });

  it('refreshes while preserving last confirmed data when a section fails', async () => {
    const current = { ...createInitialInstitutionalDashboardState(), status: 'ready' as const, summary, loans: [web3Loan], events: [event], selectedLoanId: 'loan-web3-001', selectedLoan: web3Loan };
    const client = {
      getDashboardSummary: vi.fn(async () => ({ ...summary, activePrincipalUsd: '180000' })),
      listLoans: vi.fn(async () => { throw new Error('loans offline'); }),
      listEvents: vi.fn(async () => ({ events: [] }))
    };

    const state = await refreshInstitutionalDashboard(client, current);

    expect(state.status).toBe('partial');
    expect(state.summary?.activePrincipalUsd).toBe('180000');
    expect(state.loans).toEqual([web3Loan]);
    expect(state.selectedLoanId).toBe('loan-web3-001');
    expect(state.errors.loans?.message).toBe('loans offline');
  });

  it('loads selected loan detail and preserves selected identity on detail failure', async () => {
    const current = { ...createInitialInstitutionalDashboardState(), status: 'ready' as const, loans: [web3Loan], events: [event] };
    const detail = { ...web3Loan, status: 'MarginCall' as const };
    const client = { getLoan: vi.fn(async () => detail), listEvents: vi.fn(async () => ({ events: [event] })) };

    const selected = await selectInstitutionalDashboardLoan(client, current, 'loan-web3-001');
    expect(client.getLoan).toHaveBeenCalledWith('loan-web3-001');
    expect(client.listEvents).toHaveBeenCalledWith({ loanId: 'loan-web3-001' });
    expect(selected.selectedLoanId).toBe('loan-web3-001');
    expect(selected.selectedLoan?.status).toBe('MarginCall');

    const failingClient = { getLoan: vi.fn(async () => { throw new Error('detail failed'); }), listEvents: vi.fn() };
    const failed = await selectInstitutionalDashboardLoan(failingClient, selected, 'loan-web3-001');
    expect(failed.selectedLoanId).toBe('loan-web3-001');
    expect(failed.selectedLoan?.loanId).toBe('loan-web3-001');
    expect(failed.errors.selectedLoan?.message).toBe('detail failed');
  });

  it('keeps demo mode local and does not mutate canonical loans or events', () => {
    const current = { ...createInitialInstitutionalDashboardState(), loans: [web3Loan, smeLoan], events: [event], selectedLoanId: 'loan-web3-001', selectedLoan: web3Loan };
    const next = setDashboardDemoMode(current, 'institutional');

    expect(next.demoMode).toBe('institutional');
    expect(next.loans).toBe(current.loans);
    expect(next.events).toBe(current.events);
    expect(next.selectedLoanId).toBeNull();
    expect(next.selectedLoan).toBeNull();
    expect(current.selectedLoanId).toBe('loan-web3-001');
  });

  it('reports empty and all-failed initial loads', async () => {
    const emptyClient = { getDashboardSummary: vi.fn(async () => null), listLoans: vi.fn(async () => ({ loans: [] })), listEvents: vi.fn(async () => ({ events: [] })) };
    expect((await loadInstitutionalDashboard(emptyClient, createInitialInstitutionalDashboardState())).status).toBe('empty');

    const failingClient = { getDashboardSummary: vi.fn(async () => { throw new Error('summary failed'); }), listLoans: vi.fn(async () => { throw new Error('loans failed'); }), listEvents: vi.fn(async () => { throw new Error('events failed'); }) };
    const state = await loadInstitutionalDashboard(failingClient, createInitialInstitutionalDashboardState());
    expect(state.status).toBe('error');
    expect(state.errors).toMatchObject({ summary: { message: 'summary failed' }, loans: { message: 'loans failed' }, events: { message: 'events failed' } });
  });
});
