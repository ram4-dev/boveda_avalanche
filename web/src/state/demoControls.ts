import type { AmlStatus, LiquidationResult, Loan, LoanStatus, OnChainEvent, PaymentAttestation, RiskAssessment } from '../api/types.js';

export type DemoPaymentMode = 'none' | 'one-payment' | 'complete-all' | 'miss-next' | 'auto-expire';
export type DemoPreset = 'canonical' | 'healthy' | 'risk-review' | 'risk-blocked' | 'collateral-crash' | 'full-repayment' | 'default-liquidation';
export type DemoPathId = 'happy-repayment' | 'collateral-crash-liquidation' | 'missed-payments-liquidation';
export type CollateralReleaseState = 'locked' | 'releasable' | 'released';

export type DemoPathStep = {
  label: string;
  description: string;
  status?: LoanStatus;
  collateralPriceUsd?: string;
  paymentMode?: DemoPaymentMode;
  collateralRelease?: CollateralReleaseState;
  liquidationTriggered?: boolean;
  eventType: string;
};

export type DemoControlsState = {
  enabled: boolean;
  preset: DemoPreset;
  activePathId: DemoPathId;
  pathStepIndex: number;
  pathMode: boolean;
  collateralPriceUsd: string;
  riskScore: number | null;
  amlStatus: AmlStatus | null;
  paymentMode: DemoPaymentMode;
  missedPayments: number;
  forceStatus: LoanStatus | null;
  collateralRelease: CollateralReleaseState;
  liquidationTriggered: boolean;
  liquidationProceedsAmount: string | null;
};

export type DemoControlsAction =
  | { type: 'select-demo-path'; pathId: DemoPathId }
  | { type: 'next-path-step' }
  | { type: 'auto-run-path' }
  | { type: 'set-collateral-price'; priceUsd: string }
  | { type: 'set-risk-score'; score: number }
  | { type: 'set-aml-status'; amlStatus: AmlStatus }
  | { type: 'process-one-payment' }
  | { type: 'complete-all-payments' }
  | { type: 'miss-next-payment' }
  | { type: 'auto-expire-payments' }
  | { type: 'trigger-liquidation' }
  | { type: 'release-collateral' }
  | { type: 'apply-preset'; preset: DemoPreset }
  | { type: 'reset' };

export type DemoViewInput = {
  loan: Loan;
  events: OnChainEvent[];
  risk: RiskAssessment;
  lastPayment: PaymentAttestation | null;
  lastLiquidation: LiquidationResult | null;
};

export type DemoView = {
  loan: Loan;
  events: OnChainEvent[];
  risk: RiskAssessment;
  lastPayment: PaymentAttestation | null;
  lastLiquidation: LiquidationResult | null;
  collateralRelease: CollateralReleaseState;
  isDemoOverridden: boolean;
};

const now = '2026-06-15T00:00:00Z';
const overdue = '2026-05-01T00:00:00Z';
const onePaymentAmount = 12_500;

const demoPaths: Record<DemoPathId, { label: string; summary: string; steps: DemoPathStep[] }> = {
  'happy-repayment': {
    label: 'Happy repayment path',
    summary: 'Request, offer, collateral, fiat disbursement, full repayment, collateral release.',
    steps: [
      { label: 'Request loan', description: 'Borrower asks for a bridge loan.', status: 'Requested', eventType: 'DemoLoanRequested' },
      { label: 'Risk checked', description: 'Wallet risk score and AML status are assessed.', status: 'Requested', eventType: 'DemoRiskChecked' },
      { label: 'Offer returned', description: 'Bóveda returns terms, LTV, rate, and collateral requirements.', status: 'Requested', eventType: 'DemoOfferReturned' },
      { label: 'Offer accepted', description: 'Borrower accepts the terms.', status: 'Approved', eventType: 'DemoOfferAccepted' },
      { label: 'Collateral sent', description: 'Borrower sends AVAX collateral to the vault.', status: 'Approved', eventType: 'DemoCollateralSent' },
      { label: 'Fiat deposited', description: 'Originator disburses fiat off-chain and the loan becomes active.', status: 'Active', eventType: 'DemoFiatDeposited' },
      { label: 'All payments made', description: 'All installments are attested and outstanding balance reaches zero.', status: 'Repaid', paymentMode: 'complete-all', collateralRelease: 'releasable', eventType: 'DemoAllPaymentsCompleted' },
      { label: 'Collateral released', description: 'Collateral is released back to the borrower after repayment.', status: 'Repaid', paymentMode: 'complete-all', collateralRelease: 'released', eventType: 'DemoCollateralReleased' }
    ]
  },
  'collateral-crash-liquidation': {
    label: 'Collateral crash liquidation',
    summary: 'Healthy loan becomes undercollateralized after AVAX price drops and is liquidated automatically.',
    steps: [
      { label: 'Request loan', description: 'Borrower asks for a bridge loan.', status: 'Requested', eventType: 'DemoLoanRequested' },
      { label: 'Risk checked', description: 'Wallet risk score and AML status are assessed.', status: 'Requested', eventType: 'DemoRiskChecked' },
      { label: 'Offer returned', description: 'Risk and quote are returned.', status: 'Requested', eventType: 'DemoOfferReturned' },
      { label: 'Offer accepted', description: 'Borrower accepts approved terms.', status: 'Approved', eventType: 'DemoOfferAccepted' },
      { label: 'Collateral sent', description: 'Collateral is locked in the vault.', status: 'Approved', eventType: 'DemoCollateralSent' },
      { label: 'Fiat deposited', description: 'Loan is activated after fiat disbursement.', status: 'Active', eventType: 'DemoFiatDeposited' },
      { label: 'Token price drops', description: 'AVAX price drops and LTV crosses the margin threshold.', status: 'MarginCall', collateralPriceUsd: '70', eventType: 'DemoCollateralPriceDropped' },
      { label: 'Automatic liquidation', description: 'Liquidation executes automatically after the breach.', status: 'Liquidated', collateralPriceUsd: '60', liquidationTriggered: true, eventType: 'DemoAutomaticLiquidation' }
    ]
  },
  'missed-payments-liquidation': {
    label: 'Missed payments liquidation',
    summary: 'Loan activates normally, payments are missed, grace period expires, then liquidation runs.',
    steps: [
      { label: 'Request loan', description: 'Borrower asks for a bridge loan.', status: 'Requested', eventType: 'DemoLoanRequested' },
      { label: 'Risk checked', description: 'Wallet risk score and AML status are assessed.', status: 'Requested', eventType: 'DemoRiskChecked' },
      { label: 'Offer returned', description: 'Bóveda returns terms and risk assessment.', status: 'Requested', eventType: 'DemoOfferReturned' },
      { label: 'Offer accepted', description: 'Borrower accepts terms.', status: 'Approved', eventType: 'DemoOfferAccepted' },
      { label: 'Collateral sent', description: 'Collateral is locked before disbursement.', status: 'Approved', eventType: 'DemoCollateralSent' },
      { label: 'Fiat deposited', description: 'Loan is activated and fiat is disbursed.', status: 'Active', eventType: 'DemoFiatDeposited' },
      { label: 'Grace period expired', description: 'Payments are missed and grace period expires.', status: 'Defaulted', paymentMode: 'auto-expire', eventType: 'DemoGracePeriodExpired' },
      { label: 'Automatic liquidation', description: 'Collateral is liquidated automatically after default.', status: 'Liquidated', paymentMode: 'auto-expire', liquidationTriggered: true, eventType: 'DemoAutomaticLiquidation' }
    ]
  }
};

export function createInitialDemoControls(): DemoControlsState {
  return {
    enabled: true,
    preset: 'canonical',
    activePathId: 'happy-repayment',
    pathStepIndex: 0,
    pathMode: true,
    collateralPriceUsd: '',
    riskScore: null,
    amlStatus: null,
    paymentMode: 'none',
    missedPayments: 0,
    forceStatus: null,
    collateralRelease: 'locked',
    liquidationTriggered: false,
    liquidationProceedsAmount: null
  };
}

export function getDemoPathOptions(): Array<{ id: DemoPathId; label: string; summary: string }> {
  return Object.entries(demoPaths).map(([id, path]) => ({ id: id as DemoPathId, label: path.label, summary: path.summary }));
}

export function getDemoPathSteps(pathId: DemoPathId): DemoPathStep[] {
  return demoPaths[pathId].steps;
}

export function getCurrentDemoPathStep(state: DemoControlsState): DemoPathStep {
  const steps = getDemoPathSteps(state.activePathId);
  return steps[Math.min(state.pathStepIndex, steps.length - 1)];
}

export function demoControlsReducer(state: DemoControlsState, action: DemoControlsAction): DemoControlsState {
  switch (action.type) {
    case 'select-demo-path':
      return { ...createInitialDemoControls(), enabled: true, activePathId: action.pathId, pathMode: true };
    case 'next-path-step': {
      const steps = getDemoPathSteps(state.activePathId);
      return { ...state, enabled: true, pathMode: true, pathStepIndex: Math.min(state.pathStepIndex + 1, steps.length - 1) };
    }
    case 'auto-run-path': {
      const steps = getDemoPathSteps(state.activePathId);
      return { ...state, enabled: true, pathMode: true, pathStepIndex: steps.length - 1 };
    }
    case 'set-collateral-price':
      return { ...state, enabled: true, pathMode: false, preset: 'canonical', collateralPriceUsd: action.priceUsd };
    case 'set-risk-score':
      return { ...state, enabled: true, pathMode: false, preset: 'canonical', riskScore: clampRisk(action.score) };
    case 'set-aml-status':
      return { ...state, enabled: true, pathMode: false, preset: 'canonical', amlStatus: action.amlStatus };
    case 'process-one-payment':
      return { ...state, enabled: true, pathMode: false, preset: 'canonical', paymentMode: 'one-payment', collateralRelease: 'locked' };
    case 'complete-all-payments':
      return { ...state, enabled: true, pathMode: false, preset: 'full-repayment', paymentMode: 'complete-all', forceStatus: 'Repaid', collateralRelease: 'releasable', liquidationTriggered: false };
    case 'miss-next-payment':
      return { ...state, enabled: true, pathMode: false, preset: 'canonical', paymentMode: 'miss-next', missedPayments: Math.max(1, state.missedPayments), collateralRelease: 'locked' };
    case 'auto-expire-payments':
      return { ...state, enabled: true, pathMode: false, preset: 'default-liquidation', paymentMode: 'auto-expire', missedPayments: Math.max(3, state.missedPayments), forceStatus: 'Defaulted', collateralRelease: 'locked' };
    case 'trigger-liquidation':
      return { ...state, enabled: true, pathMode: false, preset: 'default-liquidation', forceStatus: 'Liquidated', collateralRelease: 'locked', liquidationTriggered: true, liquidationProceedsAmount: state.liquidationProceedsAmount ?? '154200' };
    case 'release-collateral':
      return { ...state, enabled: true, pathMode: false, paymentMode: 'complete-all', forceStatus: 'Repaid', collateralRelease: 'released', liquidationTriggered: false };
    case 'apply-preset':
      return presetState(action.preset);
    case 'reset':
      return createInitialDemoControls();
    default:
      return state;
  }
}

export function deriveDemoView(input: DemoViewInput, overrides: DemoControlsState): DemoView {
  const effective = applyPathStep(overrides);
  if (!effective.enabled) return { ...input, collateralRelease: 'locked', isDemoOverridden: false };
  const collateralValueUsd = deriveCollateralValueUsd(input.loan, effective);
  const currentLtvBps = deriveCurrentLtvBps(input.loan, effective);
  const outstandingPrincipal = deriveOutstandingPrincipal(input.loan, effective);
  const status = deriveStatus(input.loan, effective, currentLtvBps, outstandingPrincipal);
  const collateralRelease = deriveCollateralRelease(effective, status, outstandingPrincipal);

  const loan: Loan = {
    ...input.loan,
    status,
    collateral: {
      ...input.loan.collateral,
      referencePriceUsd: activeCollateralPrice(input.loan, effective),
      valueUsd: collateralValueUsd
    },
    currentMetrics: {
      ...input.loan.currentMetrics,
      currentLtvBps,
      outstandingPrincipal,
      nextPaymentDueAt: effective.paymentMode === 'miss-next' || effective.paymentMode === 'auto-expire' ? overdue : input.loan.currentMetrics.nextPaymentDueAt
    }
  };

  const risk = deriveRiskAssessment(input.risk, effective);
  const lastPayment = derivePayment(input.loan, effective, input.lastPayment);
  const lastLiquidation = deriveLiquidation(input.loan, effective, input.lastLiquidation, status);
  const events = deriveDemoEvents(input.events, loan, effective, collateralRelease, lastPayment, lastLiquidation);

  return { loan, risk, events, lastPayment, lastLiquidation, collateralRelease, isDemoOverridden: true };
}

export function deriveCollateralValueUsd(loan: Loan, overrides: DemoControlsState): string {
  const price = parseAmount(activeCollateralPrice(loan, applyPathStep(overrides)));
  const amount = parseAmount(loan.collateral.amount);
  if (price <= 0 || amount <= 0) return loan.collateral.valueUsd;
  return formatAmount(price * amount);
}

export function deriveCurrentLtvBps(loan: Loan, overrides: DemoControlsState): number {
  const effective = applyPathStep(overrides);
  const collateralValue = parseAmount(deriveCollateralValueUsd(loan, effective));
  const outstanding = parseAmount(deriveOutstandingPrincipal(loan, effective));
  if (collateralValue <= 0) return loan.currentMetrics.currentLtvBps;
  return Math.round((outstanding / collateralValue) * 10_000);
}

function applyPathStep(state: DemoControlsState): DemoControlsState {
  if (!state.enabled || !state.pathMode) return state;
  const step = getCurrentDemoPathStep(state);
  return {
    ...state,
    collateralPriceUsd: step.collateralPriceUsd ?? state.collateralPriceUsd,
    paymentMode: step.paymentMode ?? state.paymentMode,
    forceStatus: step.status ?? state.forceStatus,
    collateralRelease: step.collateralRelease ?? state.collateralRelease,
    liquidationTriggered: step.liquidationTriggered ?? state.liquidationTriggered,
    liquidationProceedsAmount: step.liquidationTriggered ? state.liquidationProceedsAmount ?? '154200' : state.liquidationProceedsAmount,
    missedPayments: step.paymentMode === 'auto-expire' ? Math.max(3, state.missedPayments) : state.missedPayments
  };
}

function presetState(preset: DemoPreset): DemoControlsState {
  const base = createInitialDemoControls();
  switch (preset) {
    case 'canonical':
      return base;
    case 'healthy':
      return { ...base, enabled: true, preset, collateralPriceUsd: '120', riskScore: 88, amlStatus: 'PASS', forceStatus: 'Active' };
    case 'risk-review':
      return { ...base, enabled: true, preset, riskScore: 54, amlStatus: 'REVIEW' };
    case 'risk-blocked':
      return { ...base, enabled: true, preset, riskScore: 18, amlStatus: 'BLOCK' };
    case 'collateral-crash':
      return { ...base, enabled: true, preset, collateralPriceUsd: '70', forceStatus: null };
    case 'full-repayment':
      return { ...base, enabled: true, preset, paymentMode: 'complete-all', forceStatus: 'Repaid', collateralRelease: 'releasable' };
    case 'default-liquidation':
      return { ...base, enabled: true, preset, paymentMode: 'auto-expire', missedPayments: 3, forceStatus: 'Defaulted' };
  }
}

function deriveStatus(loan: Loan, overrides: DemoControlsState, currentLtvBps: number, outstandingPrincipal: string): LoanStatus {
  if (overrides.forceStatus) return overrides.forceStatus;
  if (parseAmount(outstandingPrincipal) <= 0) return 'Repaid';
  if (overrides.paymentMode === 'auto-expire') return 'Defaulted';
  if (currentLtvBps >= loan.terms.liquidationLtvBps) return 'Defaulted';
  if (currentLtvBps >= loan.terms.marginCallLtvBps) return 'MarginCall';
  return loan.status;
}

function deriveOutstandingPrincipal(loan: Loan, overrides: DemoControlsState): string {
  const outstanding = parseAmount(loan.currentMetrics.outstandingPrincipal);
  if (overrides.paymentMode === 'complete-all') return '0';
  if (overrides.paymentMode === 'one-payment') return formatAmount(Math.max(0, outstanding - onePaymentAmount));
  return loan.currentMetrics.outstandingPrincipal;
}

function deriveCollateralRelease(overrides: DemoControlsState, status: LoanStatus, outstandingPrincipal: string): CollateralReleaseState {
  if (overrides.collateralRelease === 'released') return 'released';
  if (overrides.collateralRelease === 'releasable') return 'releasable';
  if (status === 'Repaid' || parseAmount(outstandingPrincipal) <= 0) return 'releasable';
  return 'locked';
}

function deriveRiskAssessment(risk: RiskAssessment, overrides: DemoControlsState): RiskAssessment {
  if (overrides.riskScore === null && overrides.amlStatus === null) return risk;
  return {
    ...risk,
    riskScore: overrides.riskScore ?? risk.riskScore,
    amlStatus: overrides.amlStatus ?? risk.amlStatus,
    assessmentHash: `demo-risk-override-${overrides.riskScore ?? risk.riskScore}-${overrides.amlStatus ?? risk.amlStatus}`
  };
}

function derivePayment(loan: Loan, overrides: DemoControlsState, current: PaymentAttestation | null): PaymentAttestation | null {
  if (overrides.paymentMode === 'one-payment') {
    return { loanId: loan.loanId, installmentId: 'demo-installment-001', amount: '12500', currency: loan.currentMetrics.outstandingCurrency, paymentRail: loan.principal.fiatRail, attestationHash: 'demo-payment-attestation-001', remainingPrincipal: formatAmount(Math.max(0, parseAmount(loan.currentMetrics.outstandingPrincipal) - onePaymentAmount)), status: 'Active' };
  }
  if (overrides.paymentMode === 'complete-all') {
    return { loanId: loan.loanId, installmentId: 'demo-installment-final', amount: loan.currentMetrics.outstandingPrincipal, currency: loan.currentMetrics.outstandingCurrency, paymentRail: loan.principal.fiatRail, attestationHash: 'demo-payment-attestation-final', remainingPrincipal: '0', status: 'Repaid' };
  }
  return current;
}

function deriveLiquidation(loan: Loan, overrides: DemoControlsState, current: LiquidationResult | null, status: LoanStatus): LiquidationResult | null {
  if (!overrides.liquidationTriggered && status !== 'Liquidated') return current;
  return {
    loanId: loan.loanId,
    status: 'Liquidated',
    liquidationTxHash: 'demo-liquidation-tx',
    proceedsAmount: overrides.liquidationProceedsAmount ?? loan.liquidationPreview.proceedsAmount,
    proceedsCurrency: 'USDC',
    distribution: loan.liquidationPreview.distribution
  };
}

function deriveDemoEvents(events: OnChainEvent[], loan: Loan, overrides: DemoControlsState, release: CollateralReleaseState, payment: PaymentAttestation | null, liquidation: LiquidationResult | null): OnChainEvent[] {
  const next = [...events];
  const step = overrides.enabled ? getCurrentDemoPathStep(overrides) : null;
  if (step) next.push(demoEvent(step.eventType, loan.loanId, { step: step.label, description: step.description }));
  if (payment && overrides.paymentMode === 'one-payment') next.push(demoEvent('DemoPaymentProcessed', loan.loanId, { attestationHash: payment.attestationHash, remainingPrincipal: payment.remainingPrincipal }));
  if (overrides.paymentMode === 'complete-all') next.push(demoEvent('DemoAllPaymentsCompleted', loan.loanId, { attestationHash: payment?.attestationHash ?? 'demo-payment-attestation-final' }));
  if (overrides.paymentMode === 'miss-next') next.push(demoEvent('DemoPaymentOverdue', loan.loanId, { missedPayments: 1 }));
  if (overrides.paymentMode === 'auto-expire') next.push(demoEvent('DemoPaymentsExpired', loan.loanId, { missedPayments: Math.max(3, overrides.missedPayments) }));
  if (release === 'releasable') next.push(demoEvent('DemoCollateralReleasable', loan.loanId, { collateralToken: loan.collateral.token }));
  if (release === 'released') next.push(demoEvent('DemoCollateralReleased', loan.loanId, { collateralToken: loan.collateral.token }));
  if (liquidation && loan.status === 'Liquidated') next.push(demoEvent('DemoLiquidated', loan.loanId, { proceedsAmount: liquidation.proceedsAmount, proceedsCurrency: 'USDC' }));
  return next;
}

function demoEvent(eventType: string, loanId: string, payload: Record<string, unknown>): OnChainEvent {
  const discriminator = String(payload.step ?? payload.attestationHash ?? payload.collateralToken ?? payload.missedPayments ?? payload.proceedsAmount ?? 'event')
    .replace(/[^a-z0-9-]/gi, '-')
    .toLowerCase();
  return { eventId: `demo-${eventType}-${discriminator}`, eventType, loanId, txHash: null, blockNumber: null, occurredAt: now, payload };
}

function activeCollateralPrice(loan: Loan, overrides: DemoControlsState): string {
  return overrides.collateralPriceUsd.trim() || loan.collateral.referencePriceUsd || '0';
}

function parseAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value - Math.round(value)) < 0.000001) return String(Math.round(value));
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function clampRisk(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}
