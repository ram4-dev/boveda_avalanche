import { assessWalletRisk, type RiskAssessmentRequest, type RiskEngineOptions } from '../domain/riskEngine.js';
import type { RiskAssessment } from '../domain/types.js';

export interface WavyNodeAdapter {
  assessWallet(input: RiskAssessmentRequest): Promise<RiskAssessment>;
}

export function createMockWavyNodeAdapter(options: RiskEngineOptions = {}): WavyNodeAdapter {
  return {
    async assessWallet(input) {
      return assessWalletRisk(input, options);
    }
  };
}
