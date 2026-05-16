import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstitutionalDashboardScreen } from './InstitutionalDashboardScreen.js';
import { sampleLoan } from '../state/demoPayloads.js';

describe('InstitutionalDashboardScreen partial failures', () => {
  it('renders section-specific guidance for summary, loans, and events failures', async () => {
    const loan = sampleLoan({ loanId: 'loan-web3-001' });
    const client = {
      getDashboardSummary: async () => {
        throw new Error('summary unavailable');
      },
      listLoans: async () => ({ loans: [loan] }),
      listEvents: async () => {
        throw new Error('events unavailable');
      },
      getLoan: async () => loan,
      getDashboardDataSources: async () => ({ sources: [] }),
      approveLoan: async () => ({} as any),
      createQuote: async () => ({ quoteId: '', scenario: 'WEB3_BRIDGE', suggestedPrincipal: { amount: '0', currency: 'USD' }, requiredCollateralValueUsd: '0', terms: { initialLtvBps: 0, marginCallLtvBps: 0, liquidationLtvBps: 0, aprBps: 0, tenorDays: 0, repaymentFrequency: '', liquidationCurrency: 'USDC' } }),
      assessWalletRisk: async () => ({ riskAssessmentId: 'risk-1', provider: 'WAVY_NODE_MOCK', riskScore: 0, amlStatus: 'PASS', maxLtvBps: 0, assessmentHash: '0x', expiresAt: '2026-01-01T00:00:00Z' }),
      depositCollateral: async () => ({} as any),
      topUpCollateral: async () => ({} as any),
      activateLoan: async () => ({} as any),
      attestPayment: async () => ({} as any),
      createMarginCall: async () => ({} as any),
      liquidateLoan: async () => ({} as any)
    };

    render(<InstitutionalDashboardScreen client={client} />);

    expect(await screen.findByText(/Portfolio summary unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Events unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/Portfolio loans unavailable/i)).not.toBeInTheDocument();
  });

  it('renders loans section guidance when loans fail during partial load', async () => {
    const summary = { activePrincipalUsd: '150000', activeVaults: 1, averageLtvBps: 5000, loansInMarginCall: 0, paymentsAttested: 1, liquidationsExecuted: 0, exposureByAsset: [], recentEvents: [] };
    const client = {
      getDashboardSummary: async () => summary,
      listLoans: async () => {
        throw new Error('loans unavailable');
      },
      listEvents: async () => ({ events: [] }),
      getLoan: async () => sampleLoan(),
      getDashboardDataSources: async () => ({ sources: [] }),
      approveLoan: async () => ({} as any),
      createQuote: async () => ({ quoteId: '', scenario: 'WEB3_BRIDGE', suggestedPrincipal: { amount: '0', currency: 'USD' }, requiredCollateralValueUsd: '0', terms: { initialLtvBps: 0, marginCallLtvBps: 0, liquidationLtvBps: 0, aprBps: 0, tenorDays: 0, repaymentFrequency: '', liquidationCurrency: 'USDC' } }),
      assessWalletRisk: async () => ({ riskAssessmentId: 'risk-1', provider: 'WAVY_NODE_MOCK', riskScore: 0, amlStatus: 'PASS', maxLtvBps: 0, assessmentHash: '0x', expiresAt: '2026-01-01T00:00:00Z' }),
      depositCollateral: async () => ({} as any),
      topUpCollateral: async () => ({} as any),
      activateLoan: async () => ({} as any),
      attestPayment: async () => ({} as any),
      createMarginCall: async () => ({} as any),
      liquidateLoan: async () => ({} as any)
    };

    render(<InstitutionalDashboardScreen client={client} />);

    expect(await screen.findByText(/Portfolio loans unavailable/i)).toBeInTheDocument();
  });
});
