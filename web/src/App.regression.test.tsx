import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { sampleLoan } from './state/demoPayloads.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('app dashboard regression', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    const loan = sampleLoan({ status: 'Active', loanId: 'loan-sample-arch' });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/runtime' && method === 'GET') return jsonResponse({
        mode: 'fuji',
        evidenceSource: 'fuji-live',
        prerequisites: 'ready',
        networkName: 'Avalanche Fuji',
        explorerBaseUrl: 'https://testnet.snowtrace.io',
        contracts: [
          { name: 'LoanRegistry', address: '0x75eBfec02dAE1e0cd631C2d4961c5EE1849D4Fd3' },
          { name: 'CollateralVault', address: '0x45E96820551466861d20f081ab390CAA9368F68B' },
          { name: 'PaymentAttestation', address: '0x3dDC450C16231807d63f560c01455808ce130B0e' },
          { name: 'LiquidationEngine', address: '0xe29EAEbCc8D90b18BD13AfEdbf5ceF274f3a58c4' }
        ]
      });
      if (url === '/runtime/fuji-smoke' && method === 'GET') return jsonResponse({ ok: true, mode: 'fuji', chainId: 43113, expectedChainId: 43113, contracts: [], errors: [] });
      if (url.includes('/runtime/fuji-usdc-balances') && method === 'GET') return jsonResponse({
        mode: 'fuji',
        evidenceSource: 'fuji-live',
        chainId: 43113,
        token: { symbol: 'USDC', address: loan.collateral.tokenAddress, decimals: 6 },
        balances: [
          { address: loan.borrower.walletAddress.toLowerCase(), amountBaseUnits: '15000000', formatted: '15' },
          { address: loan.originator.walletAddress?.toLowerCase(), amountBaseUnits: '23000000', formatted: '23' },
          { address: loan.fundingPartner.walletAddress?.toLowerCase(), amountBaseUnits: '42000000', formatted: '42' }
        ],
        updatedAt: '2026-06-15T00:00:00Z'
      });
      if (url === '/dashboard/summary' && method === 'GET') return jsonResponse({ activePrincipalUsd: '150000', activeVaults: 1, averageLtvBps: 5000, loansInMarginCall: 0, paymentsAttested: 1, liquidationsExecuted: 0, exposureByAsset: [{ asset: 'USDC', valueUsd: '15' }], recentEvents: [] });
      if (url === '/loans' && method === 'GET') return jsonResponse({ loans: [loan] });
      if (url === '/events' && method === 'GET') return jsonResponse({ events: [{ eventId: 'evt-1', eventType: 'InstallmentPaid', loanId: 'loan-sample-arch', txHash: null, blockNumber: null, occurredAt: '2026-06-15T00:00:00Z', payload: { attestationHash: '0xabc', proceedsCurrency: 'USDC', evidence: { source: 'fuji-live', status: 'confirmed' } } }] });
      if (url === '/loans/loan-sample-arch' && method === 'GET') return jsonResponse(loan);
      if (url.includes('/collateral/deposit') && method === 'POST') return jsonResponse({ ...loan, collateral: { ...loan.collateral, amount: '15000000', amountBaseUnits: '15000000', tokenDecimals: 6 } });
      if (url.includes('/payments/attest') && method === 'POST') return jsonResponse({ loanId: loan.loanId, status: 'Repaid', releaseEvidence: { status: 'pending' } });
      if (url.includes('/margin-call') && method === 'POST') return jsonResponse({ ...loan, status: 'MarginCall' });
      if (url.includes('/liquidate') && method === 'POST') return jsonResponse({ loanId: loan.loanId, status: 'Liquidated', proceedsAmount: '15000000', proceedsCurrency: 'USDC', distribution: loan.liquidationPreview.distribution });
      return jsonResponse({});
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('renders the Bóveda operator dashboard as the base and only app view', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: /Buenas .* Arkangeles\./i })).toBeInTheDocument();
    expect(screen.getAllByText('Bóveda').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Arkangeles IFC/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('fuji-live').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Borrower widget/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Institutional dashboard/i })).not.toBeInTheDocument();

    const dashboard = screen.getByLabelText('Dashboard institucional');
    expect(within(dashboard).getByText('Cartera activa')).toBeInTheDocument();
    expect(within(dashboard).getAllByText('Vaults activos').length).toBeGreaterThan(0);
    expect(within(dashboard).getAllByText('LTV promedio').length).toBeGreaterThan(0);
    expect(within(dashboard).getAllByText('Margin calls').length).toBeGreaterThan(0);
    expect(within(dashboard).getByRole('heading', { name: 'Solicitudes pendientes' })).toBeInTheDocument();
    expect(within(dashboard).getByRole('heading', { name: 'Préstamos activos' })).toBeInTheDocument();
    expect(within(dashboard).getByRole('heading', { name: 'Eventos on-chain recientes' })).toBeInTheDocument();
    expect(within(dashboard).getByRole('region', { name: 'Simulador end-to-end' })).toBeInTheDocument();
    expect(within(dashboard).getByRole('heading', { name: 'Simulador end-to-end' })).toBeInTheDocument();
    expect(within(dashboard).getByLabelText('Balances USDC Fuji')).toBeInTheDocument();
    expect(await within(dashboard).findByText('23 USDC')).toBeInTheDocument();
    expect(within(dashboard).getAllByText('Abrir en AvalScan')).toHaveLength(3);
    expect(screen.getAllByText(/USDC/i).length).toBeGreaterThan(0);
  });

  it('shows the simulator starting at step 1 and all action buttons visible', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: /Buenas .* Arkangeles\./i });

    const simulator = screen.getByRole('region', { name: 'Simulador end-to-end' });
    // Step 1 button should always be enabled (can create a new solicitud at any time)
    expect(within(simulator).getByRole('button', { name: /Crear solicitud/i })).toBeInTheDocument();
    // The stepper panel should show no active loan (since simulatedLoanId is null)
    expect(within(simulator).getByText('Sin solicitud activa')).toBeInTheDocument();
    // All lifecycle action buttons are rendered
    expect(within(simulator).getByRole('button', { name: /Aprobar cr.dito/i })).toBeInTheDocument();
    expect(within(simulator).getByRole('button', { name: /Depositar colateral/i })).toBeInTheDocument();
    expect(within(simulator).getByRole('button', { name: /Pago final/i })).toBeInTheDocument();
    expect(within(simulator).getByRole('button', { name: /Liquidar/i })).toBeInTheDocument();
  });
});
