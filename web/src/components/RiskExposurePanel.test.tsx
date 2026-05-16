import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DashboardSummary } from '../api/types.js';
import { sampleLoan } from '../state/demoPayloads.js';
import { RiskExposurePanel } from './RiskExposurePanel.js';

const summary: DashboardSummary = {
  activePrincipalUsd: '150000',
  activeVaults: 1,
  averageLtvBps: 7000,
  loansInMarginCall: 1,
  paymentsAttested: 1,
  liquidationsExecuted: 0,
  exposureByAsset: [{ asset: 'AVAX', valueUsd: '300000' }],
  recentEvents: []
};

describe('RiskExposurePanel', () => {
  it('renders average ltv, margin call count, and exposure list', () => {
    render(<RiskExposurePanel summary={summary} loans={[sampleLoan({ status: 'MarginCall' })]} selectedLoan={null} />);

    expect(screen.getByRole('heading', { name: 'Risk and exposure' })).toBeInTheDocument();
    expect(screen.getByText('70.00%')).toBeInTheDocument();
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText('AVAX')).toBeInTheDocument();
    expect(screen.getByText('300000 USD')).toBeInTheDocument();
  });

  it('shows selected loan threshold context', () => {
    const loan = sampleLoan({ status: 'Active' });
    render(<RiskExposurePanel summary={summary} loans={[loan]} selectedLoan={loan} />);
    expect(screen.getByLabelText('Selected loan thresholds')).toBeInTheDocument();
    expect(screen.getByText(/Margin call threshold/i)).toBeInTheDocument();
  });
});
