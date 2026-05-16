import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OfferRequestScreen } from './OfferRequestScreen.js';
import { sampleLoan, sampleQuote, sampleRiskAssessment } from '../state/demoPayloads.js';
import type { QuoteResponse } from '../api/types.js';

const baseProps = {
  loan: sampleLoan({ loanId: 'loan-web3-001', status: 'Active' }),
  wallet: { status: 'unavailable' as const },
  quote: null,
  risk: null,
  action: null,
  errors: {},
  onConnectWallet: vi.fn(),
  onCreateQuote: vi.fn(),
  onAssessRisk: vi.fn()
};

describe('OfferRequestScreen', () => {
  it('renders accepted offer terms, partners, liquidation currency, and next action copy', () => {
    render(<OfferRequestScreen {...baseProps} />);

    expect(screen.getByRole('heading', { name: /Borrower offer/i })).toBeInTheDocument();
    expect(screen.getByText('150000 USD')).toBeInTheDocument();
    expect(screen.getByText('2750 AVAX')).toBeInTheDocument();
    expect(screen.getAllByText('50.00%')[0]).toBeInTheDocument();
    expect(screen.getByText('14.50% APR')).toBeInTheDocument();
    expect(screen.getByText('90 days')).toBeInTheDocument();
    expect(screen.getByText('70.00% / 80.00%')).toBeInTheDocument();
    expect(screen.getAllByText('USDC')[0]).toBeInTheDocument();
    expect(screen.getByText('Ark Capital Demo Fund')).toBeInTheDocument();
    expect(screen.getByText('Bóveda Bridge Credit Pool')).toBeInTheDocument();
    expect(screen.getByText(/Ready for payment attestation/i)).toBeInTheDocument();
    expect(screen.queryByText(/[{}\[\]"]/)).not.toBeInTheDocument();
  });

  it('shows wallet unavailable, connected, and rejected states without blocking API simulation', async () => {
    const onConnectWallet = vi.fn();
    const { rerender } = render(<OfferRequestScreen {...baseProps} onConnectWallet={onConnectWallet} />);
    expect(screen.getByText(/Real wallet connection is unavailable/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Connect injected wallet/i }));
    expect(onConnectWallet).toHaveBeenCalled();

    rerender(<OfferRequestScreen {...baseProps} wallet={{ status: 'connected', address: '0xA11CE00000000000000000000000000000000001' }} />);
    expect(screen.getByText('0xA11C…0001')).toBeInTheDocument();

    rerender(<OfferRequestScreen {...baseProps} wallet={{ status: 'rejected', message: 'User rejected request' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('User rejected request');
  });

  it('displays quote fields and REVIEW/BLOCK risk copy from API responses', () => {
    const { rerender } = render(<OfferRequestScreen {...baseProps} quote={sampleQuote()} risk={sampleRiskAssessment({ amlStatus: 'REVIEW', riskScore: 62 })} />);
    expect(screen.getByText('Required collateral')).toBeInTheDocument();
    expect(screen.getByText('300000 USD')).toBeInTheDocument();
    expect(screen.getByText('50.00% / 70.00% / 80.00%')).toBeInTheDocument();
    expect(screen.getByText('14.50% APR, 90 days')).toBeInTheDocument();
    expect(screen.getAllByText('USDC').length).toBeGreaterThan(1);
    expect(screen.getByText(/Requires review/i)).toBeInTheDocument();

    rerender(<OfferRequestScreen {...baseProps} quote={sampleQuote()} risk={sampleRiskAssessment({ amlStatus: 'BLOCK', riskScore: 12 })} />);
    expect(screen.getByText(/Blocked/i)).toBeInTheDocument();
  });

  it('displays quote terms from the canonical nested OpenAPI QuoteResponse shape', () => {
    const openApiQuote = {
      scenario: 'WEB3_BRIDGE',
      suggestedPrincipal: { amount: '125000', currency: 'USD' },
      requiredCollateralValueUsd: '250000',
      terms: {
        initialLtvBps: 5000,
        marginCallLtvBps: 7000,
        liquidationLtvBps: 8000,
        aprBps: 1450,
        tenorDays: 90,
        repaymentFrequency: 'MONTHLY',
        liquidationCurrency: 'USDC'
      }
    } as QuoteResponse;

    render(<OfferRequestScreen {...baseProps} quote={openApiQuote} />);

    expect(screen.getByText('125000 USD')).toBeInTheDocument();
    expect(screen.getByText('250000 USD')).toBeInTheDocument();
    expect(screen.getByText('50.00% / 70.00% / 80.00%')).toBeInTheDocument();
    expect(screen.getByText('14.50% APR, 90 days')).toBeInTheDocument();
    expect(screen.getAllByText('USDC').length).toBeGreaterThan(1);
    expect(screen.queryByText(/undefined|NaN/i)).not.toBeInTheDocument();
  });

  it('shows approved deposit guidance and disables collateral action for non-eligible statuses', () => {
    const approved = sampleLoan({ status: 'Approved' });
    const { rerender } = render(<OfferRequestScreen {...baseProps} loan={approved} />);
    expect(screen.getByText(/Collateral deposit is available/i)).toBeInTheDocument();

    rerender(<OfferRequestScreen {...baseProps} loan={sampleLoan({ status: 'Requested' })} />);
    expect(screen.getByText(/Waiting for originator approval/i)).toBeInTheDocument();
  });
});
