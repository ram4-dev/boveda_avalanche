export type LoanScenario = 'WEB3_BRIDGE' | 'SME_FIAT_WORKING_CAPITAL';
export type LoanStatus = 'Requested' | 'Approved' | 'Active' | 'MarginCall' | 'Repaid' | 'Defaulted' | 'Liquidated' | 'Cancelled';
export type PaymentRail = 'WIRE_SIMULATED' | 'SPEI_SIMULATED' | 'ACH_SIMULATED' | 'MANUAL_SIMULATED';
export type AmlStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export type Borrower = { borrowerId: string; displayName: string; borrowerType: string; walletAddress: string };
export type Originator = { originatorId: string; displayName: string; originatorType: string };
export type FundingPartner = { fundingPartnerId: string; displayName: string };
export type Principal = { amount: string; currency: string; fiatRail: PaymentRail; disbursementRef?: string | null };
export type Collateral = { token: string; tokenAddress?: string | null; chainId: number; amount: string; referencePriceUsd?: string; valueUsd: string; vaultAddress?: string | null; depositTxHash?: string | null };
export type Terms = { initialLtvBps: number; marginCallLtvBps: number; liquidationLtvBps: number; aprBps: number; tenorDays: number; repaymentFrequency: string; liquidationCurrency: 'USDC' };
export type RiskAssessment = { riskAssessmentId: string; provider: 'WAVY_NODE_MOCK' | 'WAVY_NODE_ADAPTER'; riskScore: number; amlStatus: AmlStatus; maxLtvBps: number; assessmentHash: string; expiresAt: string };
export type LoanReceipt = { receiptTokenId: string; soulbound: true; ownerWallet: string };
export type LoanMetrics = { currentLtvBps: number; outstandingPrincipal: string; outstandingCurrency: string; nextPaymentDueAt?: string | null };
export type ProceedsDistribution = { fundingPartnerAmount: string; originatorFeeAmount: string; borrowerRemainderAmount: string };
export type LiquidationPreview = { proceedsAmount: string; proceedsCurrency: 'USDC'; distribution: ProceedsDistribution };
export type Loan = { loanId: string; scenario: LoanScenario; status: LoanStatus; borrower: Borrower; originator: Originator; fundingPartner: FundingPartner; principal: Principal; collateral: Collateral; terms: Terms; riskAssessment: RiskAssessment; receipt: LoanReceipt | null; currentMetrics: LoanMetrics; liquidationPreview: LiquidationPreview };
export type OnChainReceipt = {
  txHash: string;
  blockNumber: number | null;
  status: 'success' | 'failed' | 'unknown';
  gasUsed?: string | null;
};
export type OnChainEvent = {
  eventId: string;
  eventType: string;
  loanId: string;
  txHash: string | null;
  blockNumber: number | null;
  occurredAt: string;
  payload: Record<string, unknown>;
  txReceipt?: OnChainReceipt;
  explorerUrl?: string;
  source?: 'chain' | 'fallback';
};
export type DashboardExposure = { asset: string; valueUsd: string };
export type DashboardSourceDefinition = {
  field: string;
  source: 'api' | 'chain' | 'derived' | 'fallback';
  dataPath: string;
  backend: string;
  explorer?: string;
  note: string;
};
export type DataSourcesResponse = { sources: DashboardSourceDefinition[] };
export type SourceStatus = 'available' | 'pending' | 'stale' | 'unavailable';
export type SourceStatusPayload = {
  summary?: SourceStatus;
  events: SourceStatus;
  details?: string;
};
export type DashboardSummary = {
  activePrincipalUsd: string;
  activeVaults: number;
  averageLtvBps: number;
  loansInMarginCall: number;
  paymentsAttested: number;
  liquidationsExecuted: number;
  exposureByAsset: DashboardExposure[];
  recentEvents: OnChainEvent[];
  sourceStatus?: SourceStatusPayload;
};
export type LoansResponse = { loans: Loan[] };
export type EventsResponse = { events: OnChainEvent[]; sourceStatus?: SourceStatusPayload };

export type QuoteRequest = { scenario: LoanScenario; borrowerWallet: string; requestedPrincipal: { amount: string; currency: string }; collateralToken: string; collateralValueUsd?: string };
export type QuoteResponse = { quoteId?: string; scenario: LoanScenario; suggestedPrincipal: { amount: string; currency: string }; requiredCollateralValueUsd: string; terms: Terms };
export type RiskAssessmentRequest = { walletAddress: string; scenario: LoanScenario; collateralToken: string };
export type CollateralDepositRequest = { token: string; amount: string; txHash: string; vaultAddress: string };
export type CollateralTopUpRequest = { token: string; amount: string; txHash?: string };
export type ActivateLoanRequest = { receiptTokenId?: string };
export type PaymentAttestationRequest = { installmentId: string; amount: string; currency: string; paymentRail: PaymentRail; paidAt: string; externalPaymentRef?: string };
export type PaymentAttestation = { loanId: string; installmentId: string; amount: string; currency: string; paymentRail?: PaymentRail; attestationHash: string; remainingPrincipal: string; status: LoanStatus };
export type MarginCallRequest = { currentLtvBps: number; reason: string };
export type LiquidationRequest = { proceedsAmount: string; proceedsCurrency: 'USDC' };
export type LiquidationResult = { loanId?: string; status?: LoanStatus; liquidationTxHash?: string; proceedsAmount: string; proceedsCurrency: 'USDC'; distribution: ProceedsDistribution };
