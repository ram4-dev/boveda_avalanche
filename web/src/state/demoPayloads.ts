import type { CollateralDepositRequest, CollateralTopUpRequest, Loan, LoanScenario, LoanStatus, MarginCallRequest, PaymentAttestationRequest, QuoteResponse, RiskAssessment } from '../api/types.js';

const now = '2026-06-15T00:00:00Z';

export function sampleLoan(overrides: Partial<Loan> & { loanId?: string; scenario?: LoanScenario; status?: LoanStatus } = {}): Loan {
  const loan: Loan = {
    loanId: overrides.loanId ?? 'loan-sample-arch',
    scenario: overrides.scenario ?? 'WEB3_BRIDGE',
    status: overrides.status ?? 'Active',
    borrower: { borrowerId: 'borrower-nova-labs-demo', displayName: 'Nova Labs DAO Services', borrowerType: 'WEB3_STARTUP', walletAddress: '0x6f981Bf8d4fA751db294Bb62dDEB3d904514F2CF' },
    originator: { originatorId: 'originator-arkangeles-demo', displayName: 'Arkangeles IFC Operator', originatorType: 'VC_FUND', walletAddress: '0x1139dd3EF90bbA276Edf3fA7ec4efd0781E4b5bC' },
    fundingPartner: { fundingPartnerId: 'funding-bridge-vault-demo', displayName: 'Bóveda Demo Credit Pool', walletAddress: '0x4b85d24F1995D1FBD93D454C4883B13f21ca34D5' },
    principal: { amount: '170', currency: 'MXN', fiatRail: 'SPEI_SIMULATED', disbursementRef: 'spei-demo-2026-001' },
    collateral: { token: 'USDC', tokenAddress: '0x5425890298aed601595a70AB815c96711a31Bc65', chainId: 43113, amount: '15', amountBaseUnits: '15000000', tokenDecimals: 6, referencePriceUsd: '1', valueUsd: '15', vaultAddress: '0x45E96820551466861d20f081ab390CAA9368F68B', depositTxHash: '0xbf410bff14228631383c7547780178c0d83619dc6943e9598f64f5b5352bc5d7' },
    terms: { initialLtvBps: 5000, marginCallLtvBps: 7000, liquidationLtvBps: 8000, aprBps: 1450, tenorDays: 90, repaymentFrequency: 'MONTHLY', liquidationCurrency: 'USDC' },
    riskAssessment: sampleRiskAssessment(),
    receipt: { receiptTokenId: '1', soulbound: true, ownerWallet: '0x6f981Bf8d4fA751db294Bb62dDEB3d904514F2CF' },
    currentMetrics: { currentLtvBps: 5000, outstandingPrincipal: '170', outstandingCurrency: 'MXN', nextPaymentDueAt: now },
    liquidationPreview: { proceedsAmount: '15000000', proceedsCurrency: 'USDC', distribution: { fundingPartnerAmount: '10000000', originatorFeeAmount: '500000', borrowerRemainderAmount: '4500000' } }
  };
  return { ...loan, ...overrides };
}

export function sampleQuote(overrides: Partial<QuoteResponse> = {}): QuoteResponse {
  return {
    scenario: 'WEB3_BRIDGE',
    suggestedPrincipal: { amount: '170', currency: 'MXN' },
    requiredCollateralValueUsd: '15',
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
  return { token: loan.collateral.token, amount: loan.collateral.amountBaseUnits ?? loan.collateral.amount, txHash: loan.collateral.depositTxHash ?? '', vaultAddress: loan.collateral.vaultAddress ?? '' };
}

export function buildDemoTopUpPayload(loan: Loan): CollateralTopUpRequest {
  return { token: loan.collateral.token, amount: '250', txHash: '0x4444444444444444444444444444444444444444444444444444444444444444' };
}

export function buildDemoPaymentPayload(loan: Loan): PaymentAttestationRequest {
  return { installmentId: 'inst-demo-001', amount: loan.currentMetrics.outstandingPrincipal, currency: loan.currentMetrics.outstandingCurrency, paymentRail: loan.principal.fiatRail, paidAt: now, externalPaymentRef: 'demo-payment-ref' };
}

export function buildDemoMarginCallPayload(loan: Loan): MarginCallRequest {
  return { currentLtvBps: Math.max(loan.terms.marginCallLtvBps + 600, loan.currentMetrics.currentLtvBps), reason: 'COLLATERAL_PRICE_DROP' };
}
