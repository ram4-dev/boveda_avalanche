import type { LoanScenario, CollateralTerms } from '../domain/types.js';

export const DEMO_GENERATED_AT = '2026-05-15T00:00:00.000Z';
export const DEMO_RISK_EXPIRES_AT = '2026-05-16T00:00:00.000Z';
export const USDC = 'USDC' as const;

export const scenarioTerms: Record<LoanScenario, CollateralTerms> = {
  WEB3_BRIDGE: {
    initialLtvBps: 5000,
    marginCallLtvBps: 7000,
    liquidationLtvBps: 8000,
    aprBps: 1450,
    tenorDays: 90,
    repaymentFrequency: 'MONTHLY',
    liquidationCurrency: USDC
  },
  SME_FIAT_WORKING_CAPITAL: {
    initialLtvBps: 6300,
    marginCallLtvBps: 7200,
    liquidationLtvBps: 8200,
    aprBps: 1850,
    tenorDays: 120,
    repaymentFrequency: 'MONTHLY',
    liquidationCurrency: USDC
  }
};

// FX rate aligned with the dashboard-driven Fuji demo: 150,000 MXN principal
// translates to 8,823.529412 USDC equivalent (~17 MXN per USD). Same rate applies to
// the SME loan: 850,000 MXN ~ 50,000 USDC.
export const demoFxUsdPerCurrency: Record<string, number> = {
  USD: 1,
  USDC: 1,
  MXN: 1 / 17
};

export const scenarioRiskProfiles: Record<LoanScenario, { riskScore: number; maxLtvBps: number }> = {
  WEB3_BRIDGE: { riskScore: 82, maxLtvBps: 5500 },
  SME_FIAT_WORKING_CAPITAL: { riskScore: 76, maxLtvBps: 6500 }
};
