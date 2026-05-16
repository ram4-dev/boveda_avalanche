import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OnChainEvent } from '../api/types.js';
import { sampleLoan } from '../state/demoPayloads.js';
import { LoanDetailPanel } from './LoanDetailPanel.js';

const loan = sampleLoan({ loanId: 'loan-web3-001', status: 'Active' });
const paymentTxHash = `0x${'1'.repeat(64)}`;
const liquidationTxHash = `0x${'2'.repeat(64)}`;

const paymentEvent: OnChainEvent = {
  eventId: 'evt-pay-1',
  eventType: 'InstallmentPaid',
  loanId: 'loan-web3-001',
  txHash: paymentTxHash,
  blockNumber: 99,
  occurredAt: '2026-06-15T00:00:00Z',
  payload: { installmentId: 'inst-001', amount: '12500', currency: 'USD', attestationHash: '0xattest', evidence: { source: 'fuji-live', mode: 'fuji', status: 'confirmed' } }
};

const liquidationEvent: OnChainEvent = {
  eventId: 'evt-liquidation-1',
  eventType: 'LiquidationExecuted',
  loanId: 'loan-web3-001',
  txHash: liquidationTxHash,
  blockNumber: 101,
  occurredAt: '2026-06-16T00:00:00Z',
  payload: { proceedsAmount: '154200', proceedsCurrency: 'USDC', evidence: { source: 'fuji-live', mode: 'fuji', status: 'confirmed' } }
};

describe('LoanDetailPanel', () => {
  it('renders participant, required evidence fields, payment highlights, and liquidation context', () => {
    render(<LoanDetailPanel loan={loan} events={[paymentEvent, liquidationEvent]} />);

    expect(screen.getByRole('heading', { name: 'Loan detail' })).toBeInTheDocument();
    expect(screen.getByText(/Loan ID:/)).toBeInTheDocument();
    expect(screen.getByText(/Borrower:/)).toBeInTheDocument();
    expect(screen.getByText(/Originator:/)).toBeInTheDocument();
    expect(screen.getByText(/Funding partner:/)).toBeInTheDocument();
    expect(screen.getByText(/Vault address:/)).toBeInTheDocument();
    expect(screen.getByText(/Deposit tx hash:/)).toBeInTheDocument();
    expect(screen.getByText(/APR:/)).toBeInTheDocument();
    expect(screen.getByText(/Tenor:/)).toBeInTheDocument();
    expect(screen.getByText(/Repayment frequency:/)).toBeInTheDocument();
    expect(screen.getByText(/Receipt owner wallet:/)).toBeInTheDocument();
    expect(screen.getByText(/Soulbound status:/)).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.getAllByText('Fuji live evidence').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('link', { name: 'View Fuji tx' }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText('Loan payment evidence')).toBeInTheDocument();
    expect(screen.getByText('installmentId')).toBeInTheDocument();
    expect(screen.getByText('inst-001')).toBeInTheDocument();
    expect(screen.getByText('attestationHash')).toBeInTheDocument();
    expect(screen.getByText('0xattest')).toBeInTheDocument();
  });

  it('shows useful empty states when no detail is selected or evidence is absent', () => {
    const { rerender } = render(<LoanDetailPanel loan={null} events={[]} />);
    expect(screen.getByText(/Select a loan from the portfolio table/i)).toBeInTheDocument();

    rerender(<LoanDetailPanel loan={{ ...loan, collateral: { ...loan.collateral, vaultAddress: null, depositTxHash: null }, receipt: null }} events={[]} errorMessage="detail failed" />);
    expect(screen.getAllByText('Simulated demo evidence').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('alert')).toHaveTextContent('detail failed');
    expect(screen.getByText('No receipt minted yet')).toBeInTheDocument();
    expect(screen.getByText('Unavailable — no receipt owner wallet')).toBeInTheDocument();
    expect(screen.getByText('Unavailable — receipt not minted yet')).toBeInTheDocument();
    expect(screen.getByText('Unavailable — no vault address recorded')).toBeInTheDocument();
    expect(screen.getByText('Unavailable — no deposit tx hash recorded')).toBeInTheDocument();
    expect(screen.getByText('No payment evidence recorded yet')).toBeInTheDocument();
  });
});
