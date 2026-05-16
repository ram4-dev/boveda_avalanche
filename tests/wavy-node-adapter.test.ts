import { describe, expect, it, vi } from 'vitest';
import { createRealWavyNodeAdapter, createWavyNodeAdapterFromEnv } from '../src/adapters/wavyNode.js';

describe('real Wavy Node adapter mapping', () => {
  const baseInput = {
    walletAddress: '0xA11CE00000000000000000000000000000000001',
    scenario: 'WEB3_BRIDGE' as const,
    collateralToken: 'AVAX'
  };

  it('maps completed Wavy scan-risk payload to completed Boveda risk assessment', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        data: {
          results: [{
            analysisId: 'analysis-123',
            address: baseInput.walletAddress,
            chainId: '43114',
            riskScore: 67,
            riskLevel: 'high',
            riskReason: 'High exposure to suspicious wallets',
            completedAt: '2026-05-16T09:00:00.000Z'
          }]
        }
      }), { status: 200 })
    );

    const adapter = createRealWavyNodeAdapter({ apiKey: 'ApiKey wavy_test', projectId: 'project-1', fetchImpl });
    const assessment = await adapter.assessWallet(baseInput);

    expect(assessment).toMatchObject({
      riskStatus: 'COMPLETED',
      riskScore: 67,
      amlStatus: 'REVIEW',
      maxLtvBps: 4500,
      riskReason: 'High exposure to suspicious wallets'
    });
  });

  it('returns FAILED without investigation when initial scan-risk has terminal auth failure', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 401 }));
    const adapter = createRealWavyNodeAdapter({ apiKey: 'ApiKey wavy_test', projectId: 'project-1', fetchImpl });
    const assessment = await adapter.assessWallet(baseInput);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(assessment.riskStatus).toBe('FAILED');
    expect(assessment.riskScore).toBeNull();
  });

  it('keeps pending with null score and provisional progress fields while analysis is running', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { results: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { id: 'inv-1', analysis_id: null, analysis_status: 'pending' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { id: 'inv-1', analysis_id: 'analysis-1', analysis_status: 'running' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { analysisId: 'analysis-1', status: 'running', completedLayers: 3, maxDepth: 7, riskScore: 46, patternsDetected: 1 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { results: [] } }), { status: 200 }));

    const adapter = createRealWavyNodeAdapter({ apiKey: 'ApiKey wavy_test', projectId: 'project-1', fetchImpl });
    const initial = await adapter.assessWallet(baseInput);
    const refreshed = await adapter.refreshAssessment(initial);

    expect(refreshed.riskStatus).toBe('PENDING');
    expect(refreshed.riskScore).toBeNull();
    expect(refreshed.maxLtvBps).toBeNull();
    expect(refreshed.providerReference).toMatchObject({
      analysisId: 'analysis-1',
      analysisStatus: 'running',
      completedLayers: 3,
      maxDepth: 7,
      provisionalRiskScore: 46,
      patternsDetected: 1
    });
  });

  it('converts no-history failed investigation to completed PASS only when demo policy is enabled', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: {
          id: 'inv-no-history',
          analysis_id: 'analysis-no-history',
          analysis_status: 'failed',
          nodes: [{ id: baseInput.walletAddress.toLowerCase() }],
          edges: [],
          tracked_transactions: []
        }
      }), { status: 200 }));

    const adapter = createRealWavyNodeAdapter({ apiKey: 'ApiKey wavy_test', projectId: 'project-1', noHistoryPolicy: 'pass', fetchImpl });
    const pending = {
      riskAssessmentId: 'risk-pending-no-history', provider: 'WAVY_NODE_ADAPTER' as const, riskStatus: 'PENDING' as const,
      riskScore: null, amlStatus: 'PENDING' as const, maxLtvBps: null, riskReason: 'pending',
      providerReference: { chainId: '43114', walletAddress: baseInput.walletAddress.toLowerCase(), investigationId: 'inv-no-history', scenario: 'WEB3_BRIDGE' as const, collateralToken: 'AVAX' },
      assessmentHash: '0xabc', expiresAt: '2026-05-16T00:00:00.000Z'
    };

    const refreshed = await adapter.refreshAssessment(pending);

    expect(refreshed).toMatchObject({
      riskStatus: 'COMPLETED',
      riskScore: 0,
      amlStatus: 'PASS',
      maxLtvBps: 5500
    });
    expect(refreshed.riskReason).toMatch(/Demo fallback/i);
    expect(refreshed.riskReason).toMatch(/not a final Wavy compliance result/i);
  });

  it('keeps failed analysis with usable graph FAILED even when no-history demo policy is enabled', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: {
          id: 'inv-with-history',
          analysis_id: 'analysis-with-history',
          analysis_status: 'failed',
          nodes: [{ id: 'root' }, { id: 'counterparty' }],
          edges: [{ id: 'edge-1' }],
          tracked_transactions: [{ type: 'out' }]
        }
      }), { status: 200 }));

    const adapter = createRealWavyNodeAdapter({ apiKey: 'ApiKey wavy_test', projectId: 'project-1', noHistoryPolicy: 'pass', fetchImpl });
    const pending = {
      riskAssessmentId: 'risk-pending-with-history', provider: 'WAVY_NODE_ADAPTER' as const, riskStatus: 'PENDING' as const,
      riskScore: null, amlStatus: 'PENDING' as const, maxLtvBps: null, riskReason: 'pending',
      providerReference: { chainId: '43114', walletAddress: baseInput.walletAddress.toLowerCase(), investigationId: 'inv-with-history', scenario: 'WEB3_BRIDGE' as const, collateralToken: 'AVAX' },
      assessmentHash: '0xabc', expiresAt: '2026-05-16T00:00:00.000Z'
    };

    const refreshed = await adapter.refreshAssessment(pending);

    expect(refreshed.riskStatus).toBe('FAILED');
    expect(refreshed.riskScore).toBeNull();
    expect(refreshed.maxLtvBps).toBeNull();
  });

  it('keeps terminal scan auth failures FAILED even when no-history demo policy is enabled', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 401 }));
    const adapter = createRealWavyNodeAdapter({ apiKey: 'ApiKey wavy_test', projectId: 'project-1', noHistoryPolicy: 'pass', fetchImpl });

    const assessment = await adapter.assessWallet(baseInput);

    expect(assessment.riskStatus).toBe('FAILED');
    expect(assessment.riskScore).toBeNull();
    expect(assessment.maxLtvBps).toBeNull();
  });

  it('marks pending assessment FAILED when progress status is failed', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { id: 'inv-2', analysis_id: 'analysis-2', analysis_status: 'pending' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { analysisId: 'analysis-2', status: 'failed' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { results: [] } }), { status: 200 }));

    const adapter = createRealWavyNodeAdapter({ apiKey: 'ApiKey wavy_test', projectId: 'project-1', fetchImpl });
    const pending = {
      riskAssessmentId: 'risk-pending-failed', provider: 'WAVY_NODE_ADAPTER' as const, riskStatus: 'PENDING' as const,
      riskScore: null, amlStatus: 'PENDING' as const, maxLtvBps: null, riskReason: 'pending',
      providerReference: { chainId: '43114', walletAddress: baseInput.walletAddress.toLowerCase(), investigationId: 'inv-2', scenario: 'WEB3_BRIDGE' as const, collateralToken: 'AVAX' },
      assessmentHash: '0xabc', expiresAt: '2026-05-16T00:00:00.000Z'
    };

    const refreshed = await adapter.refreshAssessment(pending);
    expect(refreshed.riskStatus).toBe('FAILED');
    expect(refreshed.riskScore).toBeNull();
  });

  it('maps completed progress to completed assessment when scan-risk cache is still empty', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { analysisId: 'analysis-3', status: 'completed', riskScore: 12, patternsDetected: 2 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { results: [] } }), { status: 200 }));

    const adapter = createRealWavyNodeAdapter({ apiKey: 'ApiKey wavy_test', projectId: 'project-1', fetchImpl });
    const pending = {
      riskAssessmentId: 'risk-pending-completed', provider: 'WAVY_NODE_ADAPTER' as const, riskStatus: 'PENDING' as const,
      riskScore: null, amlStatus: 'PENDING' as const, maxLtvBps: null, riskReason: 'pending',
      providerReference: { chainId: '43114', walletAddress: baseInput.walletAddress.toLowerCase(), analysisId: 'analysis-3', scenario: 'WEB3_BRIDGE' as const, collateralToken: 'AVAX' },
      assessmentHash: '0xabc', expiresAt: '2026-05-16T00:00:00.000Z'
    };

    const refreshed = await adapter.refreshAssessment(pending);
    expect(refreshed.riskStatus).toBe('COMPLETED');
    expect(refreshed.riskScore).toBe(12);
    expect(refreshed.riskReason).toMatch(/progress is completed/i);
  });

  it('prefers scan-risk completed result over progress score when both are available', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { analysisId: 'analysis-4', status: 'completed', riskScore: 12 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { results: [{ analysisId: 'analysis-4', address: baseInput.walletAddress, chainId: '43114', riskScore: 80, riskLevel: 'critical', completedAt: '2026-05-16T09:10:00.000Z' }] } }), { status: 200 }));

    const adapter = createRealWavyNodeAdapter({ apiKey: 'ApiKey wavy_test', projectId: 'project-1', fetchImpl });
    const pending = {
      riskAssessmentId: 'risk-pending-scan-preferred', provider: 'WAVY_NODE_ADAPTER' as const, riskStatus: 'PENDING' as const,
      riskScore: null, amlStatus: 'PENDING' as const, maxLtvBps: null, riskReason: 'pending',
      providerReference: { chainId: '43114', walletAddress: baseInput.walletAddress.toLowerCase(), analysisId: 'analysis-4', scenario: 'WEB3_BRIDGE' as const, collateralToken: 'AVAX' },
      assessmentHash: '0xabc', expiresAt: '2026-05-16T00:00:00.000Z'
    };

    const refreshed = await adapter.refreshAssessment(pending);
    expect(refreshed.riskStatus).toBe('COMPLETED');
    expect(refreshed.riskScore).toBe(80);
    expect(refreshed.riskReason).toMatch(/Minimal|High|Critical|Low|Medium|exposure|reported|score/i);
  });

  it('maps unrecognized completed Wavy riskLevel to REVIEW instead of PASS', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { results: [{ analysisId: 'analysis-unknown-level', address: baseInput.walletAddress, chainId: '43114', riskScore: 5, riskLevel: 'unexpected_level', completedAt: '2026-05-16T09:10:00.000Z' }] } }), { status: 200 })
    );

    const adapter = createRealWavyNodeAdapter({ apiKey: 'ApiKey wavy_test', projectId: 'project-1', fetchImpl });
    const assessment = await adapter.assessWallet(baseInput);

    expect(assessment.riskStatus).toBe('COMPLETED');
    expect(assessment.amlStatus).toBe('REVIEW');
  });

  it('returns FAILED status when real mode lacks required configuration', async () => {
    const adapter = createWavyNodeAdapterFromEnv({ WAVYNODE_MODE: 'real' });
    const assessment = await adapter.assessWallet(baseInput);
    expect(assessment.riskStatus).toBe('FAILED');
    expect(assessment.riskScore).toBeNull();
    expect(assessment.maxLtvBps).toBeNull();
  });
});
