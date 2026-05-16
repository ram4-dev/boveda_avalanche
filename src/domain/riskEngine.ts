import { DEMO_RISK_EXPIRES_AT, scenarioRiskProfiles } from '../config/demoConfig.js';
import type { AmlStatus, LoanScenario, RiskAssessment } from './types.js';
import { sha256Canonical, shortHash } from './hashing.js';

export type RiskAssessmentRequest = {
  walletAddress: string;
  scenario: LoanScenario;
  collateralToken: string;
};

export type RiskEngineOptions = {
  reviewWallets?: string[];
  blockWallets?: string[];
};

export function assessWalletRisk(
  input: RiskAssessmentRequest,
  options: RiskEngineOptions = {}
): RiskAssessment {
  const normalizedWallet = input.walletAddress.toLowerCase();
  const profile = scenarioRiskProfiles[input.scenario];
  const amlStatus = classifyAml(normalizedWallet, options);
  const maxLtvBps = amlStatus === 'PASS'
    ? profile.maxLtvBps
    : amlStatus === 'REVIEW'
      ? Math.max(profile.maxLtvBps - 1000, 1)
      : 1;
  const riskReason = mockRiskReason(amlStatus, input.scenario);
  const payload = {
    schemaVersion: 'boveda.wallet-risk.v1',
    walletAddress: normalizedWallet,
    scenario: input.scenario,
    collateralToken: input.collateralToken.toUpperCase(),
    provider: 'WAVY_NODE_MOCK',
    riskStatus: 'COMPLETED',
    riskScore: profile.riskScore,
    amlStatus,
    maxLtvBps,
    riskReason,
    expiresAt: DEMO_RISK_EXPIRES_AT
  };
  const scenarioSlug = input.scenario.toLowerCase().replaceAll('_', '-');

  return {
    riskAssessmentId: `risk-${scenarioSlug}-${shortHash(payload)}`,
    provider: 'WAVY_NODE_MOCK',
    riskStatus: 'COMPLETED',
    riskScore: profile.riskScore,
    amlStatus,
    maxLtvBps,
    riskReason,
    providerReference: {
      walletAddress: normalizedWallet,
      scenario: input.scenario,
      collateralToken: input.collateralToken.toUpperCase()
    },
    assessmentHash: sha256Canonical(payload),
    expiresAt: DEMO_RISK_EXPIRES_AT
  };
}

function mockRiskReason(amlStatus: AmlStatus, scenario: LoanScenario): string {
  if (amlStatus === 'PASS') {
    return `Mock risk profile cleared for ${scenario}`;
  }

  if (amlStatus === 'REVIEW') {
    return `Mock risk profile requires manual review for ${scenario}`;
  }

  return `Mock risk profile blocked for ${scenario}`;
}

function classifyAml(wallet: string, options: RiskEngineOptions): AmlStatus {
  if ((options.blockWallets ?? []).map((entry) => entry.toLowerCase()).includes(wallet)) {
    return 'BLOCK';
  }

  if ((options.reviewWallets ?? []).map((entry) => entry.toLowerCase()).includes(wallet)) {
    return 'REVIEW';
  }

  return 'PASS';
}
