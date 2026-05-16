import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoanActivityScreen } from './LoanActivityScreen.js';
import { sampleLoan } from '../state/demoPayloads.js';
import type { OnChainEvent } from '../api/types.js';

const event = (eventType: string, payload: Record<string, unknown> = {}): OnChainEvent => ({ eventId: `evt-${eventType}`, eventType, loanId: 'loan-web3-001', txHash: '0x1234567890abcdef1234', blockNumber: null, occurredAt: '2026-06-15T00:00:00Z', payload });

const props = {
  loan: sampleLoan({ status: 'Active' }),
  events: [event('LoanActivated'), event('ReceiptIssued')],
  lastPayment: null,
  lastLiquidation: null,
  action: null,
  errors: {},
  onDeposit: vi.fn(),
  onActivate: vi.fn(),
  onTopUp: vi.fn(),
  onAttestPayment: vi.fn(),
  onTriggerMarginCall: vi.fn(),
  onLiquidate: vi.fn()
};

describe('LoanActivityScreen', () => {
  it('renders active loan, receipt, payment controls, and event evidence', async () => {
    const onAttestPayment = vi.fn();
    render(<LoanActivityScreen {...props} onAttestPayment={onAttestPayment} />);

    expect(screen.getByRole('heading', { name: /Loan activity/i })).toBeInTheDocument();
    expect(screen.getByText('150000 USD')).toBeInTheDocument();
    expect(screen.getByText('50.00%')).toBeInTheDocument();
    expect(screen.getByText('Receipt #1')).toBeInTheDocument();
    expect(screen.getByText(/soulbound demo evidence/i)).toBeInTheDocument();
    expect(screen.getByText('LoanActivated')).toBeInTheDocument();
    expect(screen.getAllByText('Simulated demo evidence').length).toBeGreaterThanOrEqual(4);
    await userEvent.click(screen.getByRole('button', { name: /Attest simulated payment/i }));
    expect(onAttestPayment).toHaveBeenCalled();
  });

  it('allows approved deposit and activation but prevents ineligible deposit calls', async () => {
    const onDeposit = vi.fn();
    const onActivate = vi.fn();
    const { rerender } = render(<LoanActivityScreen {...props} loan={sampleLoan({ status: 'Approved', receipt: null, collateral: { ...props.loan.collateral, depositTxHash: null } })} onDeposit={onDeposit} onActivate={onActivate} />);

    await userEvent.click(screen.getByRole('button', { name: /Record simulated collateral deposit/i }));
    expect(onDeposit).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Activate loan and receipt/i }));
    expect(onActivate).toHaveBeenCalled();

    rerender(<LoanActivityScreen {...props} loan={sampleLoan({ status: 'Requested' })} onDeposit={onDeposit} />);
    expect(screen.getByRole('button', { name: /Record simulated collateral deposit/i })).toBeDisabled();
  });

  it('allows collateral top-up only for active or margin-call loans with recorded collateral', async () => {
    const onTopUp = vi.fn();
    const { rerender } = render(<LoanActivityScreen {...props} loan={sampleLoan({ status: 'Active' })} onTopUp={onTopUp} />);

    const topUpButton = screen.getByRole('button', { name: /Record collateral top-up/i });
    expect(topUpButton).toBeEnabled();
    await userEvent.click(topUpButton);
    expect(onTopUp).toHaveBeenCalledTimes(1);

    rerender(<LoanActivityScreen {...props} loan={sampleLoan({ status: 'MarginCall' })} onTopUp={onTopUp} />);
    expect(screen.getByRole('button', { name: /Record collateral top-up/i })).toBeEnabled();

    rerender(<LoanActivityScreen {...props} loan={sampleLoan({ status: 'Active', collateral: { ...props.loan.collateral, amount: '0', vaultAddress: null } })} onTopUp={onTopUp} />);
    expect(screen.getByRole('button', { name: /Record collateral top-up/i })).toBeDisabled();

    rerender(<LoanActivityScreen {...props} loan={sampleLoan({ status: 'Approved' })} onTopUp={onTopUp} />);
    expect(screen.getByRole('button', { name: /Record collateral top-up/i })).toBeDisabled();
  });

  it('shows payment attestation feedback and preserves borrower-readable errors', () => {
    render(<LoanActivityScreen {...props} lastPayment={{ loanId: 'loan-web3-001', installmentId: 'inst-001', amount: '12500', currency: 'USD', attestationHash: '0xabc123456789', remainingPrincipal: '137500', status: 'Active' }} errors={{ payment: { code: 'INVALID_REQUEST', message: 'Bad amount' }, topUp: { code: 'INVALID_REQUEST', message: 'Bad top-up' } }} />);

    expect(screen.getByText(/0xabc123456789/i)).toBeInTheDocument();
    expect(screen.getByText(/137500 USD remaining/i)).toBeInTheDocument();
    expect(screen.getByText('INVALID_REQUEST: Bad amount')).toBeInTheDocument();
    expect(screen.getByText('INVALID_REQUEST: Bad top-up')).toBeInTheDocument();
  });

  it('renders margin-call and liquidation flow with USDC proceeds and distribution rows', async () => {
    const onMarginCall = vi.fn();
    const onLiquidate = vi.fn();
    render(<LoanActivityScreen {...props} loan={sampleLoan({ status: 'MarginCall', currentMetrics: { ...props.loan.currentMetrics, currentLtvBps: 7600 } })} events={[event('MarginCall', { requiredTopUpAmount: '32000', requiredTopUpCurrency: 'USDC' })]} lastLiquidation={{ proceedsAmount: '154200', proceedsCurrency: 'USDC', distribution: { fundingPartnerAmount: '150000', originatorFeeAmount: '2100', borrowerRemainderAmount: '2100' } }} onTriggerMarginCall={onMarginCall} onLiquidate={onLiquidate} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/Margin call/i);
    expect(screen.getByText(/Top-up: 32000 USDC/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Simulate liquidation/i }));
    expect(onLiquidate).toHaveBeenCalled();
    expect(screen.getByText('154200 USDC')).toBeInTheDocument();
    expect(screen.getByText(/Funding partner: 150000/i)).toBeInTheDocument();
    expect(screen.getByText(/Originator fee: 2100/i)).toBeInTheDocument();
    expect(screen.getByText(/Borrower remainder: 2100/i)).toBeInTheDocument();
  });

  it('guards non-USDC liquidation result currencies instead of presenting them as valid proceeds', () => {
    const unsafeLiquidation = {
      proceedsAmount: '154200',
      proceedsCurrency: 'DAI',
      distribution: { fundingPartnerAmount: '150000', originatorFeeAmount: '2100', borrowerRemainderAmount: '2100' }
    };
    const unsafeLoan = sampleLoan({ liquidationPreview: { ...props.loan.liquidationPreview, proceedsCurrency: 'DAI' } as never });

    render(<LoanActivityScreen {...props} loan={unsafeLoan} lastLiquidation={unsafeLiquidation as never} />);

    expect(screen.getByText(/Unsupported liquidation currency DAI/i)).toBeInTheDocument();
    expect(screen.getByText(/Bóveda borrower demo displays liquidation proceeds only in USDC/i)).toBeInTheDocument();
    expect(screen.queryByText('154200 DAI')).not.toBeInTheDocument();
  });

  it('guards non-USDC liquidation preview currencies instead of echoing unsupported preview copy', () => {
    const unsafeLoan = sampleLoan({ liquidationPreview: { ...props.loan.liquidationPreview, proceedsCurrency: 'DAI' } as never });

    render(<LoanActivityScreen {...props} loan={unsafeLoan} />);

    expect(screen.getByText(/Unsupported liquidation currency DAI/i)).toBeInTheDocument();
    expect(screen.getByText(/Bóveda borrower demo displays liquidation proceeds only in USDC/i)).toBeInTheDocument();
    expect(screen.queryByText(/Liquidation preview proceeds are denominated in DAI/i)).not.toBeInTheDocument();
  });

  it('shows terminal status guidance without mutation affordances', () => {
    render(<LoanActivityScreen {...props} loan={sampleLoan({ status: 'Liquidated' })} />);
    expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Attest simulated payment/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Simulate liquidation/i })).toBeDisabled();
  });

  it('renders Fuji-aware copy and disabled actions when evidence is unavailable', () => {
    render(<LoanActivityScreen {...props} loan={sampleLoan({ status: 'Approved' })} evidenceSource="fuji-unavailable" />);

    expect(screen.getAllByText('Fuji evidence pending/unavailable').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('button', { name: /Record Fuji collateral evidence/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Attest payment on Fuji/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Execute Fuji liquidation/i })).toBeDisabled();
    expect(screen.getByText(/Fuji mode unavailable/i)).toBeInTheDocument();
  });
});
