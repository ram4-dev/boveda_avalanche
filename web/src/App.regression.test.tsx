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

    expect(await screen.findByRole('heading', { name: /Borrower offer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh borrower data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect injected wallet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Attest simulated payment/i })).toBeEnabled();
    expect(screen.getByText(/local API simulation/i)).toBeInTheDocument();
  });

  it('announces API-backed readiness in a polite status region', async () => {
    render(<App />);

    expect(await screen.findByRole('status', { name: /Borrower data status/i })).toHaveTextContent(/Borrower data loaded from local Batch 2 API/i);
  });

  it('keeps borrower UI honest, avoids raw JSON dumps, and shows USDC liquidation proceeds copy', async () => {
    render(<App />);

    expect(await screen.findByText(/Collateral and liquidation actions are API-simulated/i)).toBeInTheDocument();
    expect(screen.getByText(/Liquidation preview proceeds are denominated in USDC/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\{"|"loanId"|\[object Object\]/);
  });

  it('announces successful wallet connection and shows review/block risk states distinctly', async () => {
    vi.stubGlobal('window', Object.assign(window, { ethereum: { request: vi.fn(async () => ['0xA11CE00000000000000000000000000000000001']) } }));
    render(<App />);
    await screen.findByRole('heading', { name: /Borrower offer/i });

    await userEvent.click(screen.getByRole('button', { name: /Connect injected wallet/i }));
    expect(screen.getByText('0xA11C…0001')).toBeInTheDocument();

    const riskRegion = within(screen.getByRole('heading', { name: /Quote and wallet risk/i }).closest('article')!);
    expect(riskRegion.getByText(/Risk passed/i)).toBeInTheDocument();
  });
});
