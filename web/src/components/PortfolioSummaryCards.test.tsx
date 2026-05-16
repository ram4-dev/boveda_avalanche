import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DashboardSummary } from '../api/types.js';
import { sampleLoan } from '../state/demoPayloads.js';
import { PortfolioSummaryCards } from './PortfolioSummaryCards.js';

const summary: DashboardSummary = {
  activePrincipalUsd: '150000',
  activeVaults: 2,
  averageLtvBps: 5100,
  loansInMarginCall: 1,
  paymentsAttested: 4,
  liquidationsExecuted: 1,
  exposureByAsset: [],
  recentEvents: []
};

describe('PortfolioSummaryCards', () => {
  it('renders canonical portfolio metrics', () => {
    render(<PortfolioSummaryCards summary={summary} loans={[sampleLoan({ status: 'Active' }), sampleLoan({ loanId: 'loan-2', status: 'MarginCall' })]} />);

    expect(screen.getByRole('heading', { name: 'Portfolio summary' })).toBeInTheDocument();
    expect(screen.getByText('150000 USD')).toBeInTheDocument();
    expect(screen.getByText('Active loans').closest('.metric-tile')).toHaveTextContent('2');
    expect(screen.getByText('Payments attested').closest('.metric-tile')).toHaveTextContent('4');
  });

  it('labels fallback values as demo data when summary is unavailable', () => {
    render(<PortfolioSummaryCards summary={null} loans={[]} />);
    expect(screen.getAllByText('Demo data').length).toBeGreaterThan(0);
  });
});
