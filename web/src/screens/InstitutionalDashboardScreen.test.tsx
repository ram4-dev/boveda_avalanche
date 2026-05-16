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
      getLoan: async () => loan
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
      getLoan: async () => sampleLoan()
    };

    render(<InstitutionalDashboardScreen client={client} />);

    expect(await screen.findByText(/Portfolio loans unavailable/i)).toBeInTheDocument();
  });
});
