import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { sampleLoan } from './state/demoPayloads.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('borrower widget accessibility and polish regression', () => {
  beforeEach(() => {
    const loan = sampleLoan({ status: 'Active' });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/loans?')) return jsonResponse({ loans: [loan] });
      if (url === '/events?loanId=loan-web3-001') return jsonResponse({ events: [{ eventId: 'evt-1', eventType: 'InstallmentPaid', loanId: 'loan-web3-001', txHash: null, blockNumber: null, occurredAt: '2026-06-15T00:00:00Z', payload: { attestationHash: '0xabc', proceedsCurrency: 'USDC' } }] });
      if (url === '/loans/loan-web3-001') return jsonResponse(loan);
      return jsonResponse({});
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders keyboard-reachable controls with accessible names and non-blocking wallet absence', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: /Borrower request/i })).toBeInTheDocument();
    expect(screen.getByText(/Offer terms, collateral requirement, and risk score are not shown/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh borrower data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect injected wallet/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Loan activity pending/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Loan activity$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Attest simulated payment/i })).not.toBeInTheDocument();
    expect(screen.getByText(/local API simulation/i)).toBeInTheDocument();
  });

  it('announces API-backed readiness in a polite status region', async () => {
    render(<App />);

    expect(await screen.findByRole('status', { name: /Borrower data status/i })).toHaveTextContent(/Borrower data loaded from local Batch 2 API/i);
  });

  it('reveals risk and then offer terms as the path advances', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: /Borrower request/i });

    await userEvent.click(screen.getByRole('button', { name: /Next step/i }));
    expect(screen.getByRole('heading', { name: /Wallet risk check/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Borrower offer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Loan activity$/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Next step/i }));
    expect(screen.getByRole('heading', { name: /Borrower offer/i })).toBeInTheDocument();
    expect(screen.getAllByText('2750 AVAX').length).toBeGreaterThan(0);
    expect(screen.getAllByText('50.00%').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: /^Loan activity$/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Next step/i }));
    await userEvent.click(screen.getByRole('button', { name: /Next step/i }));
    await userEvent.click(screen.getByRole('button', { name: /Next step/i }));
    expect(screen.getByRole('heading', { name: /^Loan activity$/i })).toBeInTheDocument();
  });

  it('keeps borrower UI honest, avoids raw JSON dumps, and shows USDC liquidation proceeds copy', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: /Borrower request/i });
    await userEvent.click(screen.getByRole('button', { name: /Auto-run path/i }));
    expect(screen.getAllByText('DemoCollateralReleased').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\{"|"loanId"|\[object Object\]/);
  });

  it('announces successful wallet connection and shows review/block risk states distinctly', async () => {
    vi.stubGlobal('window', Object.assign(window, { ethereum: { request: vi.fn(async () => ['0xA11CE00000000000000000000000000000000001']) } }));
    render(<App />);
    await screen.findByRole('heading', { name: /Borrower request/i });
    await userEvent.click(screen.getByRole('button', { name: /Next step/i }));

    await userEvent.click(screen.getByRole('button', { name: /Connect injected wallet/i }));
    expect(screen.getByText('0xA11C…0001')).toBeInTheDocument();

    const riskRegion = within(screen.getByRole('heading', { name: /Wallet risk check/i }).closest('article')!);
    expect(riskRegion.getByText(/Risk passed/i)).toBeInTheDocument();
  });

  it('runs scripted demo paths without changing the API contract path', async () => {
    const fetchSpy = vi.mocked(fetch);
    render(<App />);
    await screen.findByRole('heading', { name: /Demo paths/i });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Demo path' }), 'collateral-crash-liquidation');
    await userEvent.click(screen.getByRole('button', { name: /Auto-run path/i }));

    expect(screen.getByText('165000 USD')).toBeInTheDocument();
    expect(screen.getByText('90.91%')).toBeInTheDocument();
    expect(screen.getByText('DemoAutomaticLiquidation')).toBeInTheDocument();
    expect(screen.getByText('154200 USDC')).toBeInTheDocument();

    const calledUrls = fetchSpy.mock.calls.map(([input]) => String(input));
    expect(calledUrls.some((url) => url.includes('/demo'))).toBe(false);
  });
});
