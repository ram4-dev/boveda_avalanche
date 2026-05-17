import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';
import { createMockWavyNodeAdapter } from '../src/adapters/wavyNode.js';

const web3QuoteRequest = {
  scenario: 'WEB3_BRIDGE',
  borrowerWallet: '0xA11CE00000000000000000000000000000000001',
  requestedPrincipal: { amount: '150000', currency: 'USD' },
  collateralToken: 'AVAX',
  collateralValueUsd: '300000'
};

describe('quotes and Wavy Node wallet risk API', () => {
  it('returns canonical validation errors instead of 500s for missing POST bodies', async () => {
    const app = buildFastifyApp();

    const quote = await app.inject({ method: 'POST', url: '/quotes' });
    const risk = await app.inject({ method: 'POST', url: '/risk/wallet' });

    expect(quote.statusCode).toBe(400);
    expect(quote.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Request body must be a JSON object' }
    });
    expect(risk.statusCode).toBe(400);
    expect(risk.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Request body must be a JSON object' }
    });

    const emptyQuote = await app.inject({ method: 'POST', url: '/quotes', payload: {} });
    const emptyRisk = await app.inject({ method: 'POST', url: '/risk/wallet', payload: {} });
    expect(emptyQuote.statusCode).toBe(400);
    expect(emptyQuote.json().error.code).toBe('INVALID_REQUEST');
    expect(emptyRisk.statusCode).toBe(400);
    expect(emptyRisk.json().error.code).toBe('INVALID_REQUEST');
  });

  it('returns deterministic WEB3 bridge quote terms with USDC liquidation currency', async () => {
    const app = buildFastifyApp();

    const first = await app.inject({ method: 'POST', url: '/quotes', payload: web3QuoteRequest });
    const second = await app.inject({ method: 'POST', url: '/quotes', payload: web3QuoteRequest });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(first.json()).toEqual({
      scenario: 'WEB3_BRIDGE',
      suggestedPrincipal: { amount: '150000', currency: 'USD' },
      requiredCollateralValueUsd: '300000',
      terms: {
        initialLtvBps: 5000,
        marginCallLtvBps: 7000,
        liquidationLtvBps: 8000,
        aprBps: 1450,
        tenorDays: 90,
        repaymentFrequency: 'MONTHLY',
        liquidationCurrency: 'USDC'
      }
    });
  });

  it('triangulates SME quote constants and caps suggested principal by collateral value', async () => {
    const app = buildFastifyApp();

    const response = await app.inject({
      method: 'POST',
      url: '/quotes',
      payload: {
        scenario: 'SME_FIAT_WORKING_CAPITAL',
        borrowerWallet: '0xB0B0000000000000000000000000000000000002',
        requestedPrincipal: { amount: '1000000', currency: 'MXN' },
        collateralToken: 'USDC',
        collateralValueUsd: '65000'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      scenario: 'SME_FIAT_WORKING_CAPITAL',
      suggestedPrincipal: { amount: '696150', currency: 'MXN' },
      requiredCollateralValueUsd: '65000',
      terms: {
        initialLtvBps: 6300,
        marginCallLtvBps: 7200,
        liquidationLtvBps: 8200,
        aprBps: 1850,
        tenorDays: 120,
        repaymentFrequency: 'MONTHLY',
        liquidationCurrency: 'USDC'
      }
    });
  });

  it('returns stable Wavy mock assessment hashes and changes them when input changes', async () => {
    const app = buildFastifyApp();
    const payload = {
      walletAddress: '0xA11CE00000000000000000000000000000000001',
      scenario: 'WEB3_BRIDGE',
      collateralToken: 'AVAX'
    };

    const first = await app.inject({ method: 'POST', url: '/risk/wallet', payload });
    const second = await app.inject({ method: 'POST', url: '/risk/wallet', payload });
    const changed = await app.inject({
      method: 'POST',
      url: '/risk/wallet',
      payload: { ...payload, collateralToken: 'USDC' }
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(changed.statusCode).toBe(200);
    expect(first.json()).toEqual(second.json());
    expect(first.json()).toMatchObject({
      provider: 'WAVY_NODE_MOCK',
      riskScore: 82,
      amlStatus: 'PASS',
      maxLtvBps: 5500,
      expiresAt: '2026-05-16T00:00:00.000Z'
    });
    expect(first.json().riskAssessmentId).toMatch(/^risk-web3-bridge-[a-f0-9]{12}$/);
    expect(first.json().assessmentHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(changed.json().assessmentHash).not.toBe(first.json().assessmentHash);
    expect(changed.json().riskAssessmentId).not.toBe(first.json().riskAssessmentId);
  });

  it('supports an injected Wavy review list without external Wavy connectivity', async () => {
    const app = buildFastifyApp({
      wavyNode: createMockWavyNodeAdapter({ reviewWallets: ['0xdead000000000000000000000000000000000000'] })
    });

    const response = await app.inject({
      method: 'POST',
      url: '/risk/wallet',
      payload: {
        walletAddress: '0xDEAD000000000000000000000000000000000000',
        scenario: 'WEB3_BRIDGE',
        collateralToken: 'AVAX'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      provider: 'WAVY_NODE_MOCK',
      amlStatus: 'REVIEW',
      maxLtvBps: 4500
    });
  });
});
