import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DashboardSummary, OnChainEvent } from '../api/types.js';
import { AuditTrail } from './AuditTrail.js';

const event: OnChainEvent = {
  eventId: 'evt-1',
  eventType: 'InstallmentPaid',
  loanId: 'loan-web3-001',
  txHash: null,
  blockNumber: null,
  occurredAt: '2026-06-15T00:00:00Z',
  payload: { attestationHash: '0xabc', rawSecret: 'hide-me', amount: '12500', evidence: { source: 'fuji-unavailable', mode: 'fuji', status: 'pending' } }
};

const summary: DashboardSummary = {
  activePrincipalUsd: '1',
  activeVaults: 1,
  averageLtvBps: 5000,
  loansInMarginCall: 0,
  paymentsAttested: 1,
  liquidationsExecuted: 0,
  exposureByAsset: [],
  recentEvents: [event]
};

describe('AuditTrail', () => {
  it('renders canonical event evidence with missing-evidence labels and whitelisted payload highlights', () => {
    render(<AuditTrail summary={summary} events={[]} />);

    expect(screen.getByRole('heading', { name: 'Audit trail' })).toBeInTheDocument();
    expect(screen.getByText('InstallmentPaid')).toBeInTheDocument();
    expect(screen.getByText('No tx hash or block recorded')).toBeInTheDocument();
    expect(screen.getByText('Fuji evidence pending/unavailable')).toBeInTheDocument();
    expect(screen.getByText('attestationHash')).toBeInTheDocument();
    expect(screen.getByText('amount')).toBeInTheDocument();
    expect(screen.queryByText('rawSecret')).not.toBeInTheDocument();
  });

  it('filters by selected loan and handles empty states', () => {
    const other = { ...event, eventId: 'evt-2', loanId: 'loan-sme-001', eventType: 'LoanCreated' };
    const { rerender } = render(<AuditTrail summary={null} events={[event, other]} selectedLoanId="loan-web3-001" />);

    expect(screen.getByText('Filtered by loan-web3-001')).toBeInTheDocument();
    const list = screen.getByLabelText('Audit events');
    expect(within(list).getByText('InstallmentPaid')).toBeInTheDocument();
    expect(within(list).queryByText('LoanCreated')).not.toBeInTheDocument();

    rerender(<AuditTrail summary={null} events={[{ ...other, txHash: `0x${'3'.repeat(64)}`, blockNumber: 123, payload: { ...other.payload, evidence: { source: 'fuji-live', mode: 'fuji', status: 'confirmed' } } }]} />);
    expect(screen.getByRole('link', { name: 'View Fuji tx' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Fuji block' })).toBeInTheDocument();

    rerender(<AuditTrail summary={null} events={[]} />);
    expect(screen.getByText(/No canonical events available/i)).toBeInTheDocument();
  });
});
