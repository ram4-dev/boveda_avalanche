import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { sampleLoan } from '../state/demoPayloads.js';
import { PortfolioTable } from './PortfolioTable.js';

describe('PortfolioTable', () => {
  it('renders portfolio columns and inspect action', async () => {
    const onInspect = vi.fn();
    const loan = sampleLoan({ status: 'Active' });
    render(<PortfolioTable loans={[loan]} onInspectLoan={onInspect} />);

    expect(screen.getByRole('columnheader', { name: 'Loan' })).toBeInTheDocument();
    expect(screen.getByText(loan.loanId)).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: `Inspect ${loan.loanId}` }));
    expect(onInspect).toHaveBeenCalledWith(loan.loanId);
  });

  it('shows empty copy when no loans are present', () => {
    render(<PortfolioTable loans={[]} onInspectLoan={vi.fn()} />);
    expect(screen.getByText(/No loans available/i)).toBeInTheDocument();
  });
});
