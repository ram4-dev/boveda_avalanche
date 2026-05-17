export type LoanScenario = 'WEB3_BRIDGE' | 'SME_FIAT_WORKING_CAPITAL';
export type LoanStatus = 'Requested' | 'Approved' | 'Active' | 'MarginCall' | 'Repaid' | 'Defaulted' | 'Liquidated' | 'Cancelled';
export type PaymentRail = 'WIRE_SIMULATED' | 'SPEI_SIMULATED' | 'ACH_SIMULATED' | 'MANUAL_SIMULATED';
export type AmlStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export type Borrower = { borrowerId: string; displayName: string; borrowerType: string; walletAddress: string };
export type Originator = { originatorId: string; displayName: string; originatorType: string; walletAddress?: string | null };
export type FundingPartner = { fundingPartnerId: string; displayName: string; walletAddress?: string | null };
export type Principal = { amount: string; currency: string; fiatRail: PaymentRail; disbursementRef?: string | null };
export type Collateral = { token: string; tokenAddress?: string | null; chainId: number; amount: string; amountBaseUnits?: string; tokenDecimals?: number; referencePriceUsd?: string; valueUsd: string; vaultAddress?: string | null; depositTxHash?: string | null };
export type Terms = { initialLtvBps: number; marginCallLtvBps: number; liquidationLtvBps: number; aprBps: number; tenorDays: number; repaymentFrequency: string; liquidationCurrency: 'USDC' };
export type RiskAssessment = { riskAssessmentId: string; provider: 'WAVY_NODE_MOCK' | 'WAVY_NODE_ADAPTER'; riskScore: number; amlStatus: AmlStatus; maxLtvBps: number; assessmentHash: string; expiresAt: string };
export type LoanReceipt = { receiptTokenId: string; soulbound: true; ownerWallet: string };
export type LoanMetrics = { currentLtvBps: number; outstandingPrincipal: string; outstandingCurrency: string; nextPaymentDueAt?: string | null };
export type ProceedsDistribution = { fundingPartnerAmount: string; originatorFeeAmount: string; borrowerRemainderAmount: string };
export type LiquidationPreview = { proceedsAmount: string; proceedsCurrency: 'USDC'; distribution: ProceedsDistribution };
export type EvidenceContractRef = { name: string; address: string };
export type EvidenceMetadata = { mode: RuntimeMode | 'demo' | 'fuji'; source: EvidenceSource; status: string; label?: string; txHash?: string | null; blockNumber?: number | null; explorerUrl?: string | null; contracts?: EvidenceContractRef[] };
export type OnChainEvidenceStepName =
  | 'createLoan'
  | 'approve'
  | 'depositCollateral'
  | 'registerPayment'
  | 'setLoanStatusRepaid'
  | 'setLoanStatusDefaulted'
  | 'releaseCollateral'
  | 'canLiquidate'
  | 'liquidateLoan';
export type OnChainEvidenceStepStatus = 'confirmed' | 'pending' | 'noop' | 'failed';
export type OnChainEvidenceStep = { step: OnChainEvidenceStepName; txHash: string | null; blockNumber: number | null; status: OnChainEvidenceStepStatus; explorerUrl?: string | null; note?: string };
export type CanLiquidateInfo = { allowed: boolean; reason: string };
export type Loan = { loanId: string; onChainLoanId?: string | null; scenario: LoanScenario; status: LoanStatus; borrower: Borrower; originator: Originator; fundingPartner: FundingPartner; principal: Principal; collateral: Collateral; terms: Terms; riskAssessment: RiskAssessment; receipt: LoanReceipt | null; currentMetrics: LoanMetrics; liquidationPreview: LiquidationPreview; collateralEvidence?: EvidenceMetadata; activationEvidence?: EvidenceMetadata; receiptEvidence?: EvidenceMetadata };
export type OnChainEvent = { eventId: string; eventType: string; loanId: string; txHash: string | null; blockNumber: number | null; occurredAt: string; payload: Record<string, unknown> & { evidence?: EvidenceMetadata } };
export type DashboardExposure = { asset: string; valueUsd: string };
export type DashboardSummary = { activePrincipalUsd: string; activeVaults: number; averageLtvBps: number; loansInMarginCall: number; paymentsAttested: number; liquidationsExecuted: number; exposureByAsset: DashboardExposure[]; recentEvents: OnChainEvent[] };
export type LoansResponse = { loans: Loan[] };
export type EventsResponse = { events: OnChainEvent[] };
export type RuntimeMode = 'demo' | 'fuji';
export type EvidenceSource = 'demo-simulated' | 'fuji-live' | 'fuji-unavailable';
export type RuntimeMetadata = { mode: RuntimeMode; evidenceSource: EvidenceSource; prerequisites: 'ready' | 'missing' | 'unavailable'; chainId?: number | null; networkName?: string | null; explorerBaseUrl?: string | null; contracts?: Array<{ name: string; address: string; abiArtifact?: string }> };
export type FujiReadOnlyContractStatus = { name: string; address: string; bytecodePresent: boolean; bytecodeBytes: number };
export type FujiReadOnlyStatus = { ok: boolean; mode: 'fuji'; rpcUrlSource: 'default-public' | 'env:BOVEDA_FUJI_RPC_URL' | 'test'; chainId: number | null; expectedChainId: 43113; contracts: FujiReadOnlyContractStatus[]; errors: string[] };
export type FujiUsdcBalance = { address: string; amountBaseUnits: string; formatted: string };
export type FujiUsdcBalancesResponse = { mode: 'fuji'; evidenceSource: EvidenceSource; chainId: number; token: { symbol: 'USDC'; address: string; decimals: number }; balances: FujiUsdcBalance[]; updatedAt: string };

export type QuoteRequest = { scenario: LoanScenario; borrowerWallet: string; requestedPrincipal: { amount: string; currency: string }; collateralToken: string; collateralValueUsd?: string };
export type QuoteResponse = { quoteId?: string; scenario: LoanScenario; suggestedPrincipal: { amount: string; currency: string }; requiredCollateralValueUsd: string; terms: Terms };
export type RiskAssessmentRequest = { walletAddress: string; scenario: LoanScenario; collateralToken: string };
export type CreateLoanRequest = { scenario: LoanScenario; borrower: Borrower; originator: Originator; fundingPartner: FundingPartner; principal: Principal; collateral: Collateral; terms: Terms; riskAssessmentId: string };
export type StatelessLoanSnapshot = { loanSnapshot?: Loan };
export type ApproveLoanRequest = { approvedBy: string; fiatDisbursementRef?: string } & StatelessLoanSnapshot;
export type CancelLoanRequest = { cancelledBy?: string; reason?: string } & StatelessLoanSnapshot;
export type DemoResetResponse = { mode: 'demo'; seedSourcePath: string; loanCount: number; eventCount: number };
export type CollateralDepositRequest = { token: string; amount: string; txHash?: string; vaultAddress?: string } & StatelessLoanSnapshot;
export type CollateralTopUpRequest = { token: string; amount: string; txHash?: string } & StatelessLoanSnapshot;
export type ActivateLoanRequest = { receiptTokenId?: string } & StatelessLoanSnapshot;
export type PaymentAttestationRequest = { installmentId: string; amount: string; currency: string; paymentRail: PaymentRail; paidAt: string; externalPaymentRef?: string } & StatelessLoanSnapshot;
export type PaymentAttestation = { loanId: string; installmentId: string; amount: string; currency: string; paymentRail?: PaymentRail; attestationHash: string; remainingPrincipal: string; status: LoanStatus; evidence?: EvidenceMetadata; releaseEvidence?: Record<string, unknown>; onChainEvidence?: OnChainEvidenceStep[] };
export type MarginCallRequest = { currentLtvBps: number; reason: string } & StatelessLoanSnapshot;
export type LiquidationRequest = { reason?: string; proceedsAmount: string; proceedsCurrency: 'USDC' } & StatelessLoanSnapshot;
export type LiquidationResult = { loanId?: string; status?: LoanStatus; liquidationTxHash?: string; proceedsAmount: string; proceedsCurrency: 'USDC'; distribution: ProceedsDistribution; evidence?: EvidenceMetadata; canLiquidate?: CanLiquidateInfo; onChainEvidence?: OnChainEvidenceStep[] };
