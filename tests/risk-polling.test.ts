import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';
import type { WavyNodeAdapter } from '../src/adapters/wavyNode.js';

function createLoanPayload(riskAssessmentId: string) {
  return {
    scenario: 'WEB3_BRIDGE',
    borrower: {
      borrowerId: 'borrower-smoke-demo',
      displayName: 'Smoke Labs Demo',
      borrowerType: 'WEB3_STARTUP',
      walletAddress: '0xC0FFEE0000000000000000000000000000000003'
    },
    originator: {
      originatorId: 'originator-ark-capital-demo',
      displayName: 'Ark Capital Demo Fund',
      originatorType: 'VC_FUND'
    },
    fundingPartner: {
      fundingPartnerId: 'funding-bridge-vault-demo',
      displayName: 'Bóveda Bridge Credit Pool'
    },
    principal: {
      amount: '50000',
      currency: 'USD',
      fiatRail: 'WIRE_SIMULATED',
      disbursementRef: null
    },
    collateral: {
      token: 'AVAX',
      tokenAddress: '0x0000000000000000000000000000000000000000',
      chainId: 43113,
      amount: '1000',
      referencePriceUsd: '100',
      valueUsd: '100000',
      vaultAddress: null,
      depositTxHash: null
    },
    terms: {
      initialLtvBps: 5000,
      marginCallLtvBps: 7000,
      liquidationLtvBps: 8000,
      aprBps: 1450,
      tenorDays: 90,
      repaymentFrequency: 'MONTHLY',
      liquidationCurrency: 'USDC'
    },
    riskAssessmentId
  };
}

describe('risk async polling API', () => {
  it('returns pending assessment with null score when Wavy investigation is requested', async () => {
    const pending = {
      riskAssessmentId: 'risk-pending-1',
      provider: 'WAVY_NODE_ADAPTER' as const,
      riskStatus: 'INVESTIGATION_REQUESTED' as const,
      riskScore: null,
      amlStatus: 'PENDING' as const,
      maxLtvBps: null,
      riskReason: 'Wavy Node investigation requested. Risk score is pending.',
      providerReference: {
        walletAddress: '0xa11ce00000000000000000000000000000000001',
        chainId: '43114',
        scenario: 'WEB3_BRIDGE' as const,
        collateralToken: 'AVAX',
        investigationId: 'inv-1'
      },
      assessmentHash: '0xabc',
      expiresAt: '2026-05-16T00:00:00.000Z'
    };

    const adapter: WavyNodeAdapter = {
      assessWallet: async () => pending,
      refreshAssessment: async (assessment) => assessment
    };

    const app = buildFastifyApp({ wavyNode: adapter });
    const response = await app.inject({
      method: 'POST',
      url: '/risk/wallet',
      payload: {
        walletAddress: '0xA11CE00000000000000000000000000000000001',
        scenario: 'WEB3_BRIDGE',
        collateralToken: 'AVAX'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ riskStatus: 'INVESTIGATION_REQUESTED', riskScore: null, maxLtvBps: null, amlStatus: 'PENDING' });
  });

  it('polling endpoint refreshes pending assessment to completed', async () => {
    let refreshCount = 0;
    const pending = {
      riskAssessmentId: 'risk-pending-2',
      provider: 'WAVY_NODE_ADAPTER' as const,
      riskStatus: 'INVESTIGATION_REQUESTED' as const,
      riskScore: null,
      amlStatus: 'PENDING' as const,
      maxLtvBps: null,
      riskReason: 'pending',
      providerReference: {
        walletAddress: '0xa11ce00000000000000000000000000000000001',
        chainId: '43114',
        scenario: 'WEB3_BRIDGE' as const,
        collateralToken: 'AVAX',
        investigationId: 'inv-2'
      },
      assessmentHash: '0xabc',
      expiresAt: '2026-05-16T00:00:00.000Z'
    };
    const completed = {
      ...pending,
      riskStatus: 'COMPLETED' as const,
      riskScore: 21,
      amlStatus: 'PASS' as const,
      maxLtvBps: 5500,
      riskReason: 'Completed',
      providerReference: { ...pending.providerReference, analysisId: 'analysis-2' }
    };

    const adapter: WavyNodeAdapter = {
      assessWallet: async () => pending,
      refreshAssessment: async () => {
        refreshCount += 1;
        return refreshCount > 1 ? completed : pending;
      }
    };

    const app = buildFastifyApp({ wavyNode: adapter });

    await app.inject({ method: 'POST', url: '/risk/wallet', payload: { walletAddress: '0xA11CE00000000000000000000000000000000001', scenario: 'WEB3_BRIDGE', collateralToken: 'AVAX' } });

    const first = await app.inject({ method: 'GET', url: '/risk/assessments/risk-pending-2' });
    expect(first.statusCode).toBe(200);
    expect(first.json().riskStatus).toBe('INVESTIGATION_REQUESTED');

    const second = await app.inject({ method: 'GET', url: '/risk/assessments/risk-pending-2' });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ riskStatus: 'COMPLETED', riskScore: 21, maxLtvBps: 5500, amlStatus: 'PASS' });
  });

  it('returns canonical 404 when polling unknown risk assessment id', async () => {
    const app = buildFastifyApp();
    const response = await app.inject({ method: 'GET', url: '/risk/assessments/risk-missing-404' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'RISK_ASSESSMENT_NOT_FOUND',
        message: 'Risk assessment risk-missing-404 was not found'
      }
    });
  });

  it('loan creation accepts completed no-history demo pass assessments', async () => {
    const completedNoHistoryPass = {
      riskAssessmentId: 'risk-no-history-pass',
      provider: 'WAVY_NODE_ADAPTER' as const,
      riskStatus: 'COMPLETED' as const,
      riskScore: 0,
      amlStatus: 'PASS' as const,
      maxLtvBps: 5500,
      riskReason: 'Demo fallback: Wavy investigation failed with no usable transaction graph, so Bóveda allows this wallet as minimal risk. This is not a final Wavy compliance result.',
      providerReference: {
        walletAddress: '0xa11ce00000000000000000000000000000000001',
        chainId: '1',
        scenario: 'WEB3_BRIDGE' as const,
        collateralToken: 'AVAX',
        investigationId: 'inv-no-history'
      },
      assessmentHash: '0xabc',
      expiresAt: '2026-05-16T00:00:00.000Z'
    };

    const adapter: WavyNodeAdapter = {
      assessWallet: async () => completedNoHistoryPass,
      refreshAssessment: async (assessment) => assessment
    };

    const app = buildFastifyApp({ wavyNode: adapter });
    const risk = await app.inject({ method: 'POST', url: '/risk/wallet', payload: { walletAddress: '0xA11CE00000000000000000000000000000000001', scenario: 'WEB3_BRIDGE', collateralToken: 'AVAX' } });
    const response = await app.inject({ method: 'POST', url: '/loans', payload: createLoanPayload(risk.json().riskAssessmentId) });

    expect(response.statusCode).toBe(201);
    expect(response.json().riskAssessment).toMatchObject({ riskStatus: 'COMPLETED', amlStatus: 'PASS', riskScore: 0, maxLtvBps: 5500 });
  });

  it('loan creation rejects pending risk assessments', async () => {
    const pending = {
      riskAssessmentId: 'risk-pending-3',
      provider: 'WAVY_NODE_ADAPTER' as const,
      riskStatus: 'INVESTIGATION_REQUESTED' as const,
      riskScore: null,
      amlStatus: 'PENDING' as const,
      maxLtvBps: null,
      riskReason: 'pending',
      providerReference: {
        walletAddress: '0xa11ce00000000000000000000000000000000001',
        chainId: '43114',
        scenario: 'WEB3_BRIDGE' as const,
        collateralToken: 'AVAX',
        investigationId: 'inv-3'
      },
      assessmentHash: '0xabc',
      expiresAt: '2026-05-16T00:00:00.000Z'
    };

    const adapter: WavyNodeAdapter = {
      assessWallet: async () => pending,
      refreshAssessment: async (assessment) => assessment
    };

    const app = buildFastifyApp({ wavyNode: adapter });
    const risk = await app.inject({ method: 'POST', url: '/risk/wallet', payload: { walletAddress: '0xA11CE00000000000000000000000000000000001', scenario: 'WEB3_BRIDGE', collateralToken: 'AVAX' } });

    const response = await app.inject({ method: 'POST', url: '/loans', payload: createLoanPayload(risk.json().riskAssessmentId) });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.message).toMatch(/is not completed/i);
  });
});
