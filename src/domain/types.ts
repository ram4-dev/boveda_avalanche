export const LOAN_SCENARIOS = ['WEB3_BRIDGE', 'SME_FIAT_WORKING_CAPITAL'] as const;
export type LoanScenario = (typeof LOAN_SCENARIOS)[number];

export const LOAN_STATUSES = [
  'Requested',
  'Approved',
  'Active',
  'MarginCall',
  'Repaid',
  'Defaulted',
  'Liquidated',
  'Cancelled'
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const EVENT_TYPES = [
  'LoanCreated',
  'LoanApproved',
  'CollateralDeposited',
  'LoanActivated',
  'ReceiptIssued',
  'InstallmentPaid',
  'MarginCall',
  'Defaulted',
  'Liquidated',
  'CollateralReleased',
  'LoanCancelled'
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type PaymentRail = 'WIRE_SIMULATED' | 'SPEI_SIMULATED' | 'ACH_SIMULATED' | 'MANUAL_SIMULATED';
export type RepaymentFrequency = 'WEEKLY' | 'MONTHLY' | 'BULLET';
export type AmlStatus = 'PASS' | 'REVIEW' | 'BLOCK';

export type Borrower = {
  borrowerId: string;
  displayName: string;
  borrowerType: 'WEB3_STARTUP' | 'SME_EXPORTER' | 'INDIVIDUAL';
  walletAddress: string;
};

export type Originator = {
  originatorId: string;
  displayName: string;
  originatorType: 'VC_FUND' | 'SOFOM' | 'BANK_PARTNER' | 'FINTECH_LENDER';
};

export type FundingPartner = {
  fundingPartnerId: string;
  displayName: string;
};

export type Money = {
  amount: string;
  currency: string;
};

export type Principal = {
  amount: string;
  currency: string;
  fiatRail: PaymentRail;
  disbursementRef?: string | null;
};

export type Collateral = {
  token: string;
  tokenAddress?: string | null;
  chainId: number;
  amount: string;
  referencePriceUsd?: string;
  valueUsd: string;
  vaultAddress?: string | null;
  depositTxHash?: string | null;
};

export type CollateralTerms = {
  initialLtvBps: number;
  marginCallLtvBps: number;
  liquidationLtvBps: number;
  aprBps: number;
  tenorDays: number;
  repaymentFrequency: RepaymentFrequency;
  liquidationCurrency: 'USDC';
};

export type RiskAssessment = {
  riskAssessmentId: string;
  provider: 'WAVY_NODE_MOCK' | 'WAVY_NODE_ADAPTER';
  riskScore: number;
  amlStatus: AmlStatus;
  maxLtvBps: number;
  assessmentHash: string;
  expiresAt: string;
};

export type LoanReceipt = {
  receiptTokenId: string;
  soulbound: true;
  ownerWallet: string;
};

export type LoanMetrics = {
  currentLtvBps: number;
  outstandingPrincipal: string;
  outstandingCurrency: string;
  nextPaymentDueAt?: string | null;
};

export type ProceedsDistribution = {
  fundingPartnerAmount: string;
  originatorFeeAmount: string;
  borrowerRemainderAmount: string;
};

export type LiquidationPreview = {
  proceedsAmount: string;
  proceedsCurrency: 'USDC';
  distribution: ProceedsDistribution;
};

export type Loan = {
  loanId: string;
  scenario: LoanScenario;
  status: LoanStatus;
  borrower: Borrower;
  originator: Originator;
  fundingPartner: FundingPartner;
  principal: Principal;
  collateral: Collateral;
  terms: CollateralTerms;
  riskAssessment: RiskAssessment;
  receipt: LoanReceipt | null;
  currentMetrics: LoanMetrics;
  liquidationPreview: LiquidationPreview;
};

export type OnChainEvent = {
  eventId: string;
  eventType: EventType;
  loanId: string;
  txHash: string | null;
  blockNumber: number | null;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type SeedFile = {
  generatedAt: string;
  sourceOfTruth: string;
  loans: Loan[];
};

export function isLoanScenario(value: unknown): value is LoanScenario {
  return typeof value === 'string' && LOAN_SCENARIOS.includes(value as LoanScenario);
}

export function isLoanStatus(value: unknown): value is LoanStatus {
  return typeof value === 'string' && LOAN_STATUSES.includes(value as LoanStatus);
}
