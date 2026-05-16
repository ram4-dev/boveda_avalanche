import { scenarioRiskProfiles } from '../config/demoConfig.js';
import { assessWalletRisk, type RiskAssessmentRequest, type RiskEngineOptions } from '../domain/riskEngine.js';
import { sha256Canonical, shortHash } from '../domain/hashing.js';
import type { AmlStatus, RiskAssessment, RiskStatus } from '../domain/types.js';

const DEFAULT_BASE_URL = 'https://api.wavynode.com/v1';
const DEFAULT_CHAIN_ID = '43114';
const DEFAULT_EXPIRES_IN_SECONDS = 15 * 60;
const INVESTIGATION_NAME = 'Boveda wallet risk check';

export interface WavyNodeAdapter {
  assessWallet(input: RiskAssessmentRequest): Promise<RiskAssessment>;
  refreshAssessment(assessment: RiskAssessment): Promise<RiskAssessment>;
}

export type RealWavyNodeConfig = {
  baseUrl?: string;
  apiKey: string;
  projectId: string;
  chainId?: string;
  expiresInSeconds?: number;
  noHistoryPolicy?: 'fail' | 'pass';
  fetchImpl?: typeof fetch;
};

type WavyScanRiskResponse = {
  success?: boolean;
  data?: {
    results?: WavyScanRiskResult[];
  };
};

type WavyInvestigationResponse = {
  success?: boolean;
  data?: {
    id?: string;
    analysis_id?: string | null;
    analysis_status?: 'pending' | 'running' | 'completed' | 'failed';
    nodes?: unknown[];
    edges?: unknown[];
    tracked_transactions?: unknown[];
  };
};

type WavyAnalysisProgressResponse = {
  success?: boolean;
  data?: {
    analysisId?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed';
    completedLayers?: number;
    maxDepth?: number;
    incremental?: boolean;
    riskScore?: number;
    patternsDetected?: number;
    startedAt?: string;
  };
};

type WavyScanRiskResult = {
  analysisId?: string;
  address?: string;
  chainId?: string;
  riskScore?: number;
  riskLevel?: 'minimal' | 'low' | 'medium' | 'high' | 'critical';
  riskReason?: string;
  suspiciousActivity?: boolean;
  patterns?: Array<string | Record<string, unknown>>;
  patternsDetected?: number;
  transactionsAnalyzed?: number;
  completedAt?: string;
};

type ScanRiskFetchResult = {
  ok: boolean;
  status: number;
  payload?: WavyScanRiskResponse;
};

type InvestigationFetchResult = {
  ok: boolean;
  status: number;
  payload?: WavyInvestigationResponse;
};

type ProgressFetchResult = {
  ok: boolean;
  status: number;
  payload?: WavyAnalysisProgressResponse;
};

export function createMockWavyNodeAdapter(options: RiskEngineOptions = {}): WavyNodeAdapter {
  return {
    async assessWallet(input) {
      return assessWalletRisk(input, options);
    },
    async refreshAssessment(assessment) {
      return assessment;
    }
  };
}

export function createWavyNodeAdapterFromEnv(env: NodeJS.ProcessEnv = process.env): WavyNodeAdapter {
  if (env.WAVYNODE_MODE !== 'real') {
    return createMockWavyNodeAdapter();
  }

  const chainId = env.WAVYNODE_CHAIN_ID ?? DEFAULT_CHAIN_ID;
  const expiresInSeconds = parsePositiveInteger(env.WAVYNODE_RISK_TTL_SECONDS) ?? DEFAULT_EXPIRES_IN_SECONDS;

  if (!env.WAVYNODE_API_KEY || !env.WAVYNODE_PROJECT_ID) {
    return createFailedWavyNodeAdapter({
      chainId,
      expiresInSeconds,
      reason: 'Wavy Node real mode is enabled but required API configuration is missing.'
    });
  }

  if (!env.WAVYNODE_API_KEY.trim().startsWith('ApiKey ')) {
    return createFailedWavyNodeAdapter({
      chainId,
      expiresInSeconds,
      reason: 'Wavy Node API key is missing the required ApiKey prefix.'
    });
  }

  return createRealWavyNodeAdapter({
    apiKey: env.WAVYNODE_API_KEY,
    projectId: env.WAVYNODE_PROJECT_ID,
    baseUrl: env.WAVYNODE_BASE_URL,
    chainId,
    expiresInSeconds,
    noHistoryPolicy: env.WAVYNODE_NO_HISTORY_POLICY === 'pass' ? 'pass' : 'fail'
  });
}

function createFailedWavyNodeAdapter(config: { chainId: string; expiresInSeconds: number; reason: string }): WavyNodeAdapter {
  return {
    async assessWallet(input) {
      return buildFailedAssessment({
        input,
        walletAddress: input.walletAddress.toLowerCase(),
        chainId: config.chainId,
        reason: `${config.reason} Risk assessment marked as FAILED.`,
        expiresInSeconds: config.expiresInSeconds
      });
    },
    async refreshAssessment(assessment) {
      return assessment;
    }
  };
}

export function createRealWavyNodeAdapter(config: RealWavyNodeConfig): WavyNodeAdapter {
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const chainId = config.chainId ?? DEFAULT_CHAIN_ID;
  const expiresInSeconds = config.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS;
  const noHistoryPolicy = config.noHistoryPolicy ?? 'fail';

  return {
    async assessWallet(input) {
      const normalizedWallet = input.walletAddress.toLowerCase();

      const firstScan = await fetchScanRisk({ fetchImpl, baseUrl, projectId: config.projectId, apiKey: config.apiKey, chainId, walletAddress: normalizedWallet });
      if (!firstScan.ok && isTerminalScanFailure(firstScan.status)) {
        return buildFailedAssessment({
          input,
          walletAddress: normalizedWallet,
          chainId,
          reason: `Wavy Node scan-risk HTTP ${firstScan.status}. Risk assessment marked as FAILED.`,
          expiresInSeconds
        });
      }

      const firstResult = firstScan.ok ? extractResultForWallet(firstScan.payload, normalizedWallet) : undefined;
      if (isCompletedScanResult(firstResult)) {
        return mapScanResultToCompletedAssessment({
          input,
          walletAddress: normalizedWallet,
          chainId,
          expiresInSeconds,
          result: firstResult,
          investigationId: null
        });
      }

      const investigation = await createInvestigation({
        fetchImpl,
        baseUrl,
        projectId: config.projectId,
        apiKey: config.apiKey,
        walletAddress: normalizedWallet,
        chainId
      });

      if (!investigation.ok) {
        return buildFailedAssessment({
          input,
          walletAddress: normalizedWallet,
          chainId,
          reason: `Wavy Node investigation request failed (${investigation.reason}). Risk assessment marked as FAILED.`,
          expiresInSeconds
        });
      }

      return buildPendingAssessment({
        input,
        walletAddress: normalizedWallet,
        chainId,
        expiresInSeconds,
        status: 'INVESTIGATION_REQUESTED',
        reason: 'Wavy Node investigation requested. Risk score is pending.',
        investigationId: investigation.investigationId ?? null,
        analysisId: investigation.analysisId ?? null,
        analysisStatus: investigation.analysisStatus ?? 'pending'
      });
    },

    async refreshAssessment(assessment) {
      if (assessment.provider !== 'WAVY_NODE_ADAPTER') {
        return assessment;
      }

      if (assessment.riskStatus === 'COMPLETED' || assessment.riskStatus === 'FAILED') {
        return assessment;
      }

      const scenario = assessment.providerReference?.scenario;
      const collateralToken = assessment.providerReference?.collateralToken;
      const walletAddress = assessment.providerReference?.walletAddress;
      const assessmentChainId = assessment.providerReference?.chainId ?? chainId;

      if (!scenario || !collateralToken || !walletAddress) {
        return {
          ...assessment,
          riskStatus: 'FAILED',
          amlStatus: 'REVIEW',
          riskReason: 'Pending Wavy assessment is missing provider reference fields. Risk assessment marked as FAILED.'
        };
      }

      const refreshInput: RiskAssessmentRequest = {
        scenario,
        collateralToken,
        walletAddress
      };

      const normalizedWallet = walletAddress.toLowerCase();
      const investigationId = assessment.providerReference?.investigationId ?? null;

      let analysisId = assessment.providerReference?.analysisId ?? null;
      let analysisStatus = assessment.providerReference?.analysisStatus;
      let noUsableInvestigationHistory = false;

      if (investigationId && !analysisId) {
        const investigation = await fetchInvestigation({
          fetchImpl,
          baseUrl,
          projectId: config.projectId,
          apiKey: config.apiKey,
          investigationId
        });

        if (investigation.ok) {
          analysisId = investigation.payload?.data?.analysis_id ?? null;
          analysisStatus = investigation.payload?.data?.analysis_status;
          noUsableInvestigationHistory = isNoUsableInvestigationHistory(investigation.payload);
        } else if (isTerminalScanFailure(investigation.status)) {
          return {
            ...assessment,
            riskStatus: 'FAILED',
            amlStatus: 'REVIEW',
            riskScore: null,
            maxLtvBps: null,
            riskReason: `Wavy Node get-investigation HTTP ${investigation.status}. Risk assessment marked as FAILED.`
          };
        }
      }

      let progress: WavyAnalysisProgressResponse['data'] | undefined;
      if (analysisId) {
        const progressResponse = await fetchAnalysisProgress({
          fetchImpl,
          baseUrl,
          apiKey: config.apiKey,
          analysisId
        });

        if (!progressResponse.ok) {
          if (isTerminalScanFailure(progressResponse.status)) {
            return {
              ...assessment,
              riskStatus: 'FAILED',
              amlStatus: 'REVIEW',
              riskScore: null,
              maxLtvBps: null,
              riskReason: `Wavy Node analysis progress HTTP ${progressResponse.status}. Risk assessment marked as FAILED.`
            };
          }
        } else {
          progress = progressResponse.payload?.data;
          analysisStatus = progress?.status ?? analysisStatus;
        }
      }

      if (analysisStatus === 'failed') {
        if (noHistoryPolicy === 'pass' && noUsableInvestigationHistory) {
          return buildNoHistoryPassAssessment({
            input: refreshInput,
            walletAddress: normalizedWallet,
            chainId: assessmentChainId,
            expiresInSeconds,
            riskAssessmentId: assessment.riskAssessmentId,
            investigationId,
            analysisId,
            reason: 'Demo fallback: Wavy investigation failed with no usable transaction graph, so Bóveda allows this wallet as minimal risk. This is not a final Wavy compliance result.'
          });
        }

        return {
          ...assessment,
          riskStatus: 'FAILED',
          amlStatus: 'REVIEW',
          riskScore: null,
          maxLtvBps: null,
          riskReason: 'Wavy Node analysis progress reported failed status. Risk assessment marked as FAILED.'
        };
      }

      const scan = await fetchScanRisk({
        fetchImpl,
        baseUrl,
        projectId: config.projectId,
        apiKey: config.apiKey,
        chainId: assessmentChainId,
        walletAddress: normalizedWallet
      });

      if (scan.ok) {
        const result = extractResultForWallet(scan.payload, normalizedWallet);
        if (isCompletedScanResult(result)) {
          return mapScanResultToCompletedAssessment({
            input: refreshInput,
            walletAddress: normalizedWallet,
            chainId: assessmentChainId,
            expiresInSeconds,
            result,
            investigationId,
            riskAssessmentId: assessment.riskAssessmentId
          });
        }
      } else if (isTerminalScanFailure(scan.status)) {
        return {
          ...assessment,
          riskStatus: 'FAILED',
          amlStatus: 'REVIEW',
          riskScore: null,
          maxLtvBps: null,
          riskReason: `Wavy Node scan-risk HTTP ${scan.status}. Risk assessment marked as FAILED.`
        };
      }

      if (progress?.status === 'completed' && typeof progress.riskScore === 'number') {
        return buildCompletedFromProgress({
          input: refreshInput,
          walletAddress: normalizedWallet,
          chainId: assessmentChainId,
          expiresInSeconds,
          riskAssessmentId: assessment.riskAssessmentId,
          investigationId,
          analysisId,
          riskScore: progress.riskScore,
          patternsDetected: progress.patternsDetected
        });
      }

      if (progress?.status === 'pending' || progress?.status === 'running') {
        return buildPendingAssessment({
          input: refreshInput,
          walletAddress: normalizedWallet,
          chainId: assessmentChainId,
          expiresInSeconds,
          status: 'PENDING',
          reason: 'Wavy Node investigation is in progress. Risk score is not available yet.',
          investigationId,
          analysisId,
          analysisStatus: progress.status,
          completedLayers: progress.completedLayers,
          maxDepth: progress.maxDepth,
          provisionalRiskScore: typeof progress.riskScore === 'number' ? progress.riskScore : undefined,
          patternsDetected: progress.patternsDetected,
          riskAssessmentId: assessment.riskAssessmentId
        });
      }

      return {
        ...buildPendingAssessment({
          input: refreshInput,
          walletAddress: normalizedWallet,
          chainId: assessmentChainId,
          expiresInSeconds,
          status: 'PENDING',
          reason: scan.ok
            ? 'Wavy Node investigation is still pending. Risk score is not available yet.'
            : `Wavy Node investigation still pending. Latest scan-risk HTTP ${scan.status}.`,
          investigationId,
          analysisId,
          analysisStatus,
          riskAssessmentId: assessment.riskAssessmentId
        }),
        assessmentHash: assessment.assessmentHash
      };
    }
  };
}

async function fetchScanRisk(input: {
  fetchImpl: typeof fetch;
  baseUrl: string;
  projectId: string;
  apiKey: string;
  chainId: string;
  walletAddress: string;
}): Promise<ScanRiskFetchResult> {
  try {
    const url = new URL(`${input.baseUrl}/projects/${input.projectId}/addresses/scan-risk`);
    url.searchParams.set('addresses', input.walletAddress);
    url.searchParams.set('chainId', input.chainId);

    const response = await input.fetchImpl(url, {
      method: 'GET',
      headers: {
        'x-api-key': input.apiKey
      }
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const payload = (await response.json()) as WavyScanRiskResponse;
    return { ok: true, status: response.status, payload };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function fetchInvestigation(input: {
  fetchImpl: typeof fetch;
  baseUrl: string;
  projectId: string;
  apiKey: string;
  investigationId: string;
}): Promise<InvestigationFetchResult> {
  try {
    const response = await input.fetchImpl(`${input.baseUrl}/projects/${input.projectId}/investigations/${input.investigationId}`, {
      method: 'GET',
      headers: {
        'x-api-key': input.apiKey
      }
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const payload = (await response.json()) as WavyInvestigationResponse;
    return { ok: true, status: response.status, payload };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function fetchAnalysisProgress(input: {
  fetchImpl: typeof fetch;
  baseUrl: string;
  apiKey: string;
  analysisId: string;
}): Promise<ProgressFetchResult> {
  try {
    const response = await input.fetchImpl(`${input.baseUrl}/analysis/${input.analysisId}/progress`, {
      method: 'GET',
      headers: {
        'x-api-key': input.apiKey
      }
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const payload = (await response.json()) as WavyAnalysisProgressResponse;
    return { ok: true, status: response.status, payload };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function createInvestigation(input: {
  fetchImpl: typeof fetch;
  baseUrl: string;
  projectId: string;
  apiKey: string;
  walletAddress: string;
  chainId: string;
}): Promise<{ ok: true; investigationId?: string | null; analysisId?: string | null; analysisStatus?: 'pending' | 'running' | 'completed' | 'failed' | null } | { ok: false; reason: string }> {
  try {
    const response = await input.fetchImpl(`${input.baseUrl}/projects/${input.projectId}/investigations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': input.apiKey
      },
      body: JSON.stringify({
        name: INVESTIGATION_NAME,
        wallet: input.walletAddress,
        chainId: input.chainId
      })
    });

    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }

    const payload = (await response.json()) as WavyInvestigationResponse;
    if (payload.success !== true) {
      return { ok: false, reason: 'response was not successful' };
    }

    return {
      ok: true,
      investigationId: payload.data?.id ?? null,
      analysisId: payload.data?.analysis_id ?? null,
      analysisStatus: payload.data?.analysis_status ?? null
    };
  } catch {
    return { ok: false, reason: 'request failed' };
  }
}

function extractResultForWallet(payload: WavyScanRiskResponse | undefined, walletAddress: string): WavyScanRiskResult | undefined {
  if (!payload?.success) {
    return undefined;
  }
  return payload.data?.results?.find((entry) => entry.address?.toLowerCase() === walletAddress) ?? payload.data?.results?.[0];
}

function isCompletedScanResult(result: WavyScanRiskResult | undefined): result is WavyScanRiskResult & { riskScore: number; completedAt: string } {
  return typeof result?.riskScore === 'number' && typeof result.completedAt === 'string' && !Number.isNaN(Date.parse(result.completedAt));
}

function isNoUsableInvestigationHistory(payload: WavyInvestigationResponse | undefined): boolean {
  const nodes = payload?.data?.nodes;
  const edges = payload?.data?.edges;
  const trackedTransactions = payload?.data?.tracked_transactions;
  return Array.isArray(nodes) && nodes.length <= 1 && Array.isArray(edges) && edges.length === 0 && Array.isArray(trackedTransactions) && trackedTransactions.length === 0;
}

function mapScanResultToCompletedAssessment(input: {
  input: RiskAssessmentRequest;
  walletAddress: string;
  chainId: string;
  expiresInSeconds: number;
  result: WavyScanRiskResult;
  investigationId: string | null;
  riskAssessmentId?: string;
}): RiskAssessment {
  const scenarioProfile = scenarioRiskProfiles[input.input.scenario];
  const riskScore = boundedRiskScore(input.result.riskScore ?? scenarioProfile.riskScore);
  const parsedRiskLevel = parseWavyRiskLevel(input.result.riskLevel);
  const hasUnrecognizedRiskLevel = typeof input.result.riskLevel === 'string' && !parsedRiskLevel;
  const riskLevel = parsedRiskLevel ?? classifyRiskLevel(riskScore);
  const amlStatus = hasUnrecognizedRiskLevel ? 'REVIEW' : mapRiskLevelToAmlStatus(riskLevel);
  const maxLtvBps = amlStatus === 'PASS'
    ? scenarioProfile.maxLtvBps
    : amlStatus === 'REVIEW'
      ? Math.max(scenarioProfile.maxLtvBps - 1000, 1)
      : 1;
  const riskReason = input.result.riskReason?.trim() || (hasUnrecognizedRiskLevel ? 'Unrecognized Wavy Node risk level. Risk assessment requires review.' : defaultReasonForRiskLevel(riskLevel));
  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString();
  const canonicalPayload = {
    schemaVersion: 'boveda.wallet-risk.v1',
    provider: 'WAVY_NODE_ADAPTER',
    riskStatus: 'COMPLETED',
    walletAddress: input.walletAddress,
    scenario: input.input.scenario,
    collateralToken: input.input.collateralToken.toUpperCase(),
    chainId: input.chainId,
    investigationId: input.investigationId,
    analysisId: input.result.analysisId ?? null,
    riskScore,
    riskLevel,
    amlStatus,
    maxLtvBps,
    riskReason,
    completedAt: input.result.completedAt,
    expiresAt
  };

  return {
    riskAssessmentId: input.riskAssessmentId ?? input.result.analysisId ?? `risk-wavy-${shortHash(canonicalPayload)}`,
    provider: 'WAVY_NODE_ADAPTER',
    riskStatus: 'COMPLETED',
    riskScore,
    amlStatus,
    maxLtvBps,
    riskReason,
    providerReference: {
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      investigationId: input.investigationId,
      analysisId: input.result.analysisId ?? null,
      analysisStatus: 'completed',
      scenario: input.input.scenario,
      collateralToken: input.input.collateralToken.toUpperCase()
    },
    assessmentHash: sha256Canonical(canonicalPayload),
    expiresAt
  };
}

function buildCompletedFromProgress(input: {
  input: RiskAssessmentRequest;
  walletAddress: string;
  chainId: string;
  expiresInSeconds: number;
  riskAssessmentId: string;
  investigationId: string | null;
  analysisId: string | null;
  riskScore: number;
  patternsDetected?: number;
}): RiskAssessment {
  const scenarioProfile = scenarioRiskProfiles[input.input.scenario];
  const boundedScore = boundedRiskScore(input.riskScore);
  const riskLevel = classifyRiskLevel(boundedScore);
  const amlStatus = mapRiskLevelToAmlStatus(riskLevel);
  const maxLtvBps = amlStatus === 'PASS'
    ? scenarioProfile.maxLtvBps
    : amlStatus === 'REVIEW'
      ? Math.max(scenarioProfile.maxLtvBps - 1000, 1)
      : 1;
  const riskReason = 'Wavy Node analysis progress is completed; using final progress risk score while scan-risk cache catches up.';
  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString();
  const canonicalPayload = {
    schemaVersion: 'boveda.wallet-risk.v1',
    provider: 'WAVY_NODE_ADAPTER',
    riskStatus: 'COMPLETED',
    walletAddress: input.walletAddress,
    scenario: input.input.scenario,
    collateralToken: input.input.collateralToken.toUpperCase(),
    chainId: input.chainId,
    investigationId: input.investigationId,
    analysisId: input.analysisId,
    riskScore: boundedScore,
    riskLevel,
    amlStatus,
    maxLtvBps,
    riskReason,
    expiresAt
  };

  return {
    riskAssessmentId: input.riskAssessmentId,
    provider: 'WAVY_NODE_ADAPTER',
    riskStatus: 'COMPLETED',
    riskScore: boundedScore,
    amlStatus,
    maxLtvBps,
    riskReason,
    providerReference: {
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      investigationId: input.investigationId,
      analysisId: input.analysisId,
      analysisStatus: 'completed',
      provisionalRiskScore: boundedScore,
      patternsDetected: input.patternsDetected,
      scenario: input.input.scenario,
      collateralToken: input.input.collateralToken.toUpperCase()
    },
    assessmentHash: sha256Canonical(canonicalPayload),
    expiresAt
  };
}

function buildNoHistoryPassAssessment(input: {
  input: RiskAssessmentRequest;
  walletAddress: string;
  chainId: string;
  expiresInSeconds: number;
  riskAssessmentId: string;
  investigationId: string | null;
  analysisId: string | null;
  reason: string;
}): RiskAssessment {
  const scenarioProfile = scenarioRiskProfiles[input.input.scenario];
  const riskScore = 0;
  const riskLevel = 'minimal';
  const amlStatus: AmlStatus = 'PASS';
  const maxLtvBps = scenarioProfile.maxLtvBps;
  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString();
  const canonicalPayload = {
    schemaVersion: 'boveda.wallet-risk.v1',
    provider: 'WAVY_NODE_ADAPTER',
    riskStatus: 'COMPLETED',
    demoFallback: 'NO_HISTORY_PASS',
    walletAddress: input.walletAddress,
    scenario: input.input.scenario,
    collateralToken: input.input.collateralToken.toUpperCase(),
    chainId: input.chainId,
    investigationId: input.investigationId,
    analysisId: input.analysisId,
    riskScore,
    riskLevel,
    amlStatus,
    maxLtvBps,
    riskReason: input.reason,
    expiresAt
  };

  return {
    riskAssessmentId: input.riskAssessmentId,
    provider: 'WAVY_NODE_ADAPTER',
    riskStatus: 'COMPLETED',
    riskScore,
    amlStatus,
    maxLtvBps,
    riskReason: input.reason,
    providerReference: {
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      investigationId: input.investigationId,
      analysisId: input.analysisId,
      analysisStatus: 'failed',
      scenario: input.input.scenario,
      collateralToken: input.input.collateralToken.toUpperCase()
    },
    assessmentHash: sha256Canonical(canonicalPayload),
    expiresAt
  };
}

function buildPendingAssessment(input: {
  input: RiskAssessmentRequest;
  walletAddress: string;
  chainId: string;
  expiresInSeconds: number;
  status: Extract<RiskStatus, 'INVESTIGATION_REQUESTED' | 'PENDING'>;
  reason: string;
  investigationId: string | null;
  analysisId: string | null;
  analysisStatus?: 'pending' | 'running' | 'completed' | 'failed';
  completedLayers?: number;
  maxDepth?: number;
  provisionalRiskScore?: number;
  patternsDetected?: number;
  riskAssessmentId?: string;
}): RiskAssessment {
  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString();
  const canonicalPayload = {
    schemaVersion: 'boveda.wallet-risk.v1',
    provider: 'WAVY_NODE_ADAPTER',
    riskStatus: input.status,
    walletAddress: input.walletAddress,
    scenario: input.input.scenario,
    collateralToken: input.input.collateralToken.toUpperCase(),
    chainId: input.chainId,
    investigationId: input.investigationId,
    analysisId: input.analysisId,
    analysisStatus: input.analysisStatus ?? null,
    completedLayers: input.completedLayers ?? null,
    maxDepth: input.maxDepth ?? null,
    provisionalRiskScore: input.provisionalRiskScore ?? null,
    patternsDetected: input.patternsDetected ?? null,
    riskReason: input.reason,
    expiresAt
  };

  return {
    riskAssessmentId: input.riskAssessmentId ?? `risk-wavy-${shortHash(canonicalPayload)}`,
    provider: 'WAVY_NODE_ADAPTER',
    riskStatus: input.status,
    riskScore: null,
    amlStatus: 'PENDING',
    maxLtvBps: null,
    riskReason: input.reason,
    providerReference: {
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      investigationId: input.investigationId,
      analysisId: input.analysisId,
      analysisStatus: input.analysisStatus,
      completedLayers: input.completedLayers,
      maxDepth: input.maxDepth,
      provisionalRiskScore: input.provisionalRiskScore,
      patternsDetected: input.patternsDetected,
      scenario: input.input.scenario,
      collateralToken: input.input.collateralToken.toUpperCase()
    },
    assessmentHash: sha256Canonical(canonicalPayload),
    expiresAt
  };
}

function buildFailedAssessment(input: {
  input: RiskAssessmentRequest;
  walletAddress: string;
  chainId: string;
  reason: string;
  expiresInSeconds: number;
}): RiskAssessment {
  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString();
  const canonicalPayload = {
    schemaVersion: 'boveda.wallet-risk.v1',
    provider: 'WAVY_NODE_ADAPTER',
    riskStatus: 'FAILED',
    walletAddress: input.walletAddress,
    scenario: input.input.scenario,
    collateralToken: input.input.collateralToken.toUpperCase(),
    chainId: input.chainId,
    riskReason: input.reason,
    expiresAt
  };

  return {
    riskAssessmentId: `risk-wavy-${shortHash(canonicalPayload)}`,
    provider: 'WAVY_NODE_ADAPTER',
    riskStatus: 'FAILED',
    riskScore: null,
    amlStatus: 'REVIEW',
    maxLtvBps: null,
    riskReason: input.reason,
    providerReference: {
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      scenario: input.input.scenario,
      collateralToken: input.input.collateralToken.toUpperCase()
    },
    assessmentHash: sha256Canonical(canonicalPayload),
    expiresAt
  };
}

function isTerminalScanFailure(status: number): boolean {
  return status === 400 || status === 401 || status === 403;
}

function parseWavyRiskLevel(riskLevel: string | undefined): 'minimal' | 'low' | 'medium' | 'high' | 'critical' | undefined {
  if (riskLevel === 'minimal' || riskLevel === 'low' || riskLevel === 'medium' || riskLevel === 'high' || riskLevel === 'critical') {
    return riskLevel;
  }
  return undefined;
}

function mapRiskLevelToAmlStatus(riskLevel: 'minimal' | 'low' | 'medium' | 'high' | 'critical'): AmlStatus {
  if (riskLevel === 'critical') return 'BLOCK';
  if (riskLevel === 'medium' || riskLevel === 'high') return 'REVIEW';
  return 'PASS';
}

function classifyRiskLevel(riskScore: number): 'minimal' | 'low' | 'medium' | 'high' | 'critical' {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 40) return 'medium';
  if (riskScore >= 20) return 'low';
  return 'minimal';
}

function defaultReasonForRiskLevel(riskLevel: 'minimal' | 'low' | 'medium' | 'high' | 'critical'): string {
  if (riskLevel === 'critical') return 'Critical risk level reported by Wavy Node.';
  if (riskLevel === 'high') return 'High risk level reported by Wavy Node.';
  if (riskLevel === 'medium') return 'Medium risk level reported by Wavy Node.';
  if (riskLevel === 'low') return 'Low risk level reported by Wavy Node.';
  return 'Minimal risk level reported by Wavy Node.';
}

function parsePositiveInteger(rawValue: string | undefined): number | undefined {
  if (!rawValue) return undefined;
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function boundedRiskScore(riskScore: number): number {
  return Math.min(100, Math.max(0, Math.round(riskScore)));
}

export type { RiskAssessmentRequest };
