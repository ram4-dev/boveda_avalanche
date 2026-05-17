import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InstitutionalDashboardScreen } from './InstitutionalDashboardScreen.js';
import { sampleLoan } from '../state/demoPayloads.js';
import { ApiClientError } from '../api/client.js';

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

    expect(await screen.findByText(/Resumen no disponible/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Eventos no disponibles/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Préstamos no disponibles/i)).not.toBeInTheDocument();
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

    expect(await screen.findByText(/Préstamos no disponibles/i)).toBeInTheDocument();
  });

  it('falls back to /demo/reset when /demo/release-and-reset returns Not Found', async () => {
    const summary = {
      activePrincipalUsd: '150000',
      activeVaults: 1,
      averageLtvBps: 5000,
      loansInMarginCall: 0,
      paymentsAttested: 1,
      liquidationsExecuted: 0,
      exposureByAsset: [],
      recentEvents: []
    };
    const baseLoan = sampleLoan({ loanId: 'loan-sample-arch', status: 'Active' });
    const releaseAndReset = vi.fn().mockRejectedValue(new ApiClientError(404, 'NOT_FOUND', 'Not Found'));
    const resetDemo = vi.fn().mockResolvedValue({
      mode: 'demo',
      seedSourcePath: 'data/demo/loans.seed.json',
      loanCount: 2,
      eventCount: 0
    });
    const client = {
      getDashboardSummary: async () => summary,
      listLoans: async () => ({ loans: [baseLoan] }),
      listEvents: async () => ({ events: [] }),
      getLoan: async () => baseLoan,
      releaseAndReset,
      resetDemo
    };

    render(<InstitutionalDashboardScreen client={client} />);

    expect(await screen.findByText(/Reset demo/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reset demo/i }));

    await waitFor(() => {
      expect(releaseAndReset).toHaveBeenCalledTimes(1);
      expect(resetDemo).toHaveBeenCalledTimes(1);
    });
  });
});
