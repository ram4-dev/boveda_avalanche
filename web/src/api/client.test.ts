import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, createBovedaApiClient, resolveApiBaseUrl } from './client.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) }
  });
}

describe('createBovedaApiClient', () => {
  it('uses canonical Batch 2 paths and methods', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/dashboard/summary') && method === 'GET') return jsonResponse({ activePrincipalUsd: '150000', activeVaults: 1, averageLtvBps: 5000, loansInMarginCall: 0, paymentsAttested: 1, liquidationsExecuted: 0, exposureByAsset: [], recentEvents: [] });
      if (url.endsWith('/loans?scenario=WEB3_BRIDGE') && method === 'GET') return jsonResponse({ loans: [] });
      if (url.endsWith('/loans/loan-web3-001') && method === 'GET') return jsonResponse({ loanId: 'loan-web3-001' });
      if (url.endsWith('/quotes') && method === 'POST') return jsonResponse({ quoteId: 'quote-1' });
      if (url.endsWith('/risk/wallet') && method === 'POST') return jsonResponse({ riskAssessmentId: 'risk-1' });
      if (url.endsWith('/risk/assessments/risk-1') && method === 'GET') return jsonResponse({ riskAssessmentId: 'risk-1' });
      if (url.endsWith('/loans/loan-web3-001/collateral/deposit') && method === 'POST') return jsonResponse({ loanId: 'loan-web3-001', status: 'Approved' });
      if (url.endsWith('/loans/loan-web3-001/activate') && method === 'POST') return jsonResponse({ loanId: 'loan-web3-001', status: 'Active' });
      if (url.endsWith('/loans/loan-web3-001/payments/attest') && method === 'POST') return jsonResponse({ attestationHash: '0xabc' });
      if (url.endsWith('/loans/loan-web3-001/margin-call') && method === 'POST') return jsonResponse({ loanId: 'loan-web3-001', status: 'MarginCall' });
      if (url.endsWith('/loans/loan-web3-001/liquidate') && method === 'POST') return jsonResponse({ proceedsCurrency: 'USDC' });
      if (url.endsWith('/events?loanId=loan-web3-001') && method === 'GET') return jsonResponse({ events: [] });
      throw new Error(`Unexpected ${method} ${url}`);
    });
    const client = createBovedaApiClient({ baseUrl: 'http://api.local', fetch: fetchMock });

    await client.getDashboardSummary();
    await client.listLoans({ scenario: 'WEB3_BRIDGE' });
    await client.getLoan('loan-web3-001');
    await client.createQuote({ scenario: 'WEB3_BRIDGE', borrowerWallet: '0xabc', requestedPrincipal: { amount: '150000', currency: 'USD' }, collateralToken: 'AVAX', collateralValueUsd: '300000' });
    await client.assessWalletRisk({ walletAddress: '0xabc', scenario: 'WEB3_BRIDGE', collateralToken: 'AVAX' });
    await client.getRiskAssessment('risk-1');
    await client.depositCollateral('loan-web3-001', { token: 'AVAX', amount: '2750', txHash: '0x1', vaultAddress: '0xvault' });
    await client.activateLoan('loan-web3-001', { receiptTokenId: 'demo-receipt-1' });
    await client.attestPayment('loan-web3-001', { installmentId: 'inst-001', amount: '12500', currency: 'USD', paymentRail: 'WIRE_SIMULATED', paidAt: '2026-06-15T00:00:00Z' });
    await client.createMarginCall('loan-web3-001', { currentLtvBps: 7600, reason: 'COLLATERAL_PRICE_DROP' });
    await client.liquidateLoan('loan-web3-001', { proceedsAmount: '154200', proceedsCurrency: 'USDC' });
    await client.listEvents({ loanId: 'loan-web3-001' });

    expect(fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? 'GET'} ${String(input).replace('http://api.local', '')}`)).toEqual([
      'GET /dashboard/summary',
      'GET /loans?scenario=WEB3_BRIDGE',
      'GET /loans/loan-web3-001',
      'POST /quotes',
      'POST /risk/wallet',
      'GET /risk/assessments/risk-1',
      'POST /loans/loan-web3-001/collateral/deposit',
      'POST /loans/loan-web3-001/activate',
      'POST /loans/loan-web3-001/payments/attest',
      'POST /loans/loan-web3-001/margin-call',
      'POST /loans/loan-web3-001/liquidate',
      'GET /events?loanId=loan-web3-001'
    ]);
  });

  it('encodes path params, query params, and parses canonical API errors', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/events?loanId=loan+with%2Fslash')) {
        return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Loan missing' } }, { status: 404 });
      }
      return jsonResponse({ ok: true });
    });
    const client = createBovedaApiClient({ baseUrl: '/api/', fetch: fetchMock });

    await client.getLoan('loan with/slash');
    await client.listLoans({ scenario: 'WEB3_BRIDGE', status: 'MarginCall' });
    await expect(client.listEvents({ loanId: 'loan with/slash' })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Loan missing', status: 404 });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/loans/loan%20with%2Fslash', expect.objectContaining({ method: 'GET' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/loans?scenario=WEB3_BRIDGE&status=MarginCall', expect.objectContaining({ method: 'GET' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/events?loanId=loan+with%2Fslash', expect.objectContaining({ method: 'GET' }));
  });

  it('surfaces safe non-JSON HTTP failures and resolves optional Vite base URL', async () => {
    const fetchMock = vi.fn(async () => new Response('gateway unavailable', { status: 502, headers: { 'content-type': 'text/plain' } }));
    const client = createBovedaApiClient({ baseUrl: '', fetch: fetchMock });

    await expect(client.getLoan('loan-web3-001')).rejects.toBeInstanceOf(ApiClientError);
    await expect(client.getLoan('loan-web3-001')).rejects.toMatchObject({ code: 'HTTP_502', message: 'gateway unavailable' });
    expect(resolveApiBaseUrl({ VITE_BOVEDA_API_BASE_URL: 'http://localhost:3000/' })).toBe('http://localhost:3000');
    expect(resolveApiBaseUrl({})).toBe('');
  });
});
