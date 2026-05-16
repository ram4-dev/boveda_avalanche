import type { CollateralDepositRequest, Loan, LoanScenario, LoanStatus, MarginCallRequest, PaymentAttestationRequest, QuoteResponse, RiskAssessment } from '../api/types.js';

const now = '2026-06-15T00:00:00Z';

export function sampleLoan(overrides: Partial<Loan> & { loanId?: string; scenario?: LoanScenario; status?: LoanStatus } = {}): Loan {
  const loan: Loan = {
    loanId: overrides.loanId ?? 'loan-web3-001',
    scenario: overrides.scenario ?? 'WEB3_BRIDGE',
    status: overrides.status ?? 'Active',
    borrower: { borrowerId: 'borrower-nova-labs-demo', displayName: 'Nova Labs DAO Services', borrowerType: 'WEB3_STARTUP', walletAddress: '0xA11CE00000000000000000000000000000000001' },
    originator: { originatorId: 'originator-ark-capital-demo', displayName: 'Ark Capital Demo Fund', originatorType: 'VC_FUND' },
    fundingPartner: { fundingPartnerId: 'funding-bridge-vault-demo', displayName: 'Bóveda Bridge Credit Pool' },
    principal: { amount: '150000', currency: 'USD', fiatRail: 'WIRE_SIMULATED', disbursementRef: 'wire-demo-2026-001' },
    collateral: { token: 'AVAX', tokenAddress: '0x0000000000000000000000000000000000000000', chainId: 43113, amount: '2750', referencePriceUsd: '109.09', valueUsd: '300000', vaultAddress: '0xB0VEDA0000000000000000000000000000000001', depositTxHash: '0x1111111111111111111111111111111111111111111111111111111111111111' },
    terms: { initialLtvBps: 5000, marginCallLtvBps: 7000, liquidationLtvBps: 8000, aprBps: 1450, tenorDays: 90, repaymentFrequency: 'MONTHLY', liquidationCurrency: 'USDC' },
    riskAssessment: sampleRiskAssessment(),
    receipt: { receiptTokenId: '1', soulbound: true, ownerWallet: '0xA11CE00000000000000000000000000000000001' },
    currentMetrics: { currentLtvBps: 5000, outstandingPrincipal: '150000', outstandingCurrency: 'USD', nextPaymentDueAt: now },
    liquidationPreview: { proceedsAmount: '154200', proceedsCurrency: 'USDC', distribution: { fundingPartnerAmount: '150000', originatorFeeAmount: '2100', borrowerRemainderAmount: '2100' } }
  };
  return { ...loan, ...overrides };
}

export function sampleQuote(overrides: Partial<QuoteResponse> = {}): QuoteResponse {
  return {
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
    },
    ...overrides
  };
}

export function sampleRiskAssessment(overrides: Partial<RiskAssessment> = {}): RiskAssessment {
  return { riskAssessmentId: 'risk-web3-001', provider: 'WAVY_NODE_MOCK', riskScore: 82, amlStatus: 'PASS', maxLtvBps: 5500, assessmentHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', expiresAt: '2026-05-16T00:00:00Z', ...overrides };
}

export function buildDemoDepositPayload(loan: Loan): CollateralDepositRequest {
  return { token: loan.collateral.token, amount: loan.collateral.amount, txHash: loan.collateral.depositTxHash ?? '0x3333333333333333333333333333333333333333333333333333333333333333', vaultAddress: loan.collateral.vaultAddress ?? '0xB0VEDA0000000000000000000000000000000003' };
}

export function buildDemoPaymentPayload(loan: Loan): PaymentAttestationRequest {
  const amount = loan.currentMetrics.outstandingPrincipal === loan.principal.amount ? '12500' : loan.currentMetrics.outstandingPrincipal;
  return { installmentId: 'inst-demo-001', amount, currency: loan.currentMetrics.outstandingCurrency, paymentRail: loan.principal.fiatRail, paidAt: now, externalPaymentRef: 'demo-payment-ref' };
}

export function buildDemoMarginCallPayload(loan: Loan): MarginCallRequest {
  return { currentLtvBps: Math.max(loan.terms.marginCallLtvBps + 600, loan.currentMetrics.currentLtvBps), reason: 'COLLATERAL_PRICE_DROP' };
}
