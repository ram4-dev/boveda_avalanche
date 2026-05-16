import type { OracleAdapter } from '../adapters/oracle.js';
import { applyBps, currencyToUsd, normalizeDecimalString } from '../domain/money.js';
import type { Loan, LoanStatus } from '../domain/types.js';

export type KeeperDecision =
  | 'NOOP_HEALTHY'
  | 'NOOP_UNSUPPORTED_STATUS'
  | 'NOOP_ALREADY_ESCALATED'
  | 'PLAN_MARGIN_CALL'
  | 'PLAN_LIQUIDATION'
  | 'FAIL_CLOSED';

export type KeeperPolicy =
  | 'STANDARD_THRESHOLDS'
  | 'MARGIN_CALL_FIRST'
  | 'CRITICAL_COLLATERAL_BUFFER';

export type KeeperDryRunOptions = {
  /** Liquidate when collateral coverage is at or below repayment obligation plus this buffer. 1000 = 10%. */
  criticalCoverageBufferBps?: number;
  /** Temporary demo proxy for admin expenses until the domain model gets an explicit fee field. */
  adminExpenseBps?: number;
};

export type KeeperDryRunResult = {
  loanId: string;
  status: LoanStatus;
  decision: KeeperDecision;
  policy: KeeperPolicy;
  computedLtvBps: number | null;
  marginCallLtvBps: number;
  liquidationLtvBps: number;
  reason: string;
  collateralValueUsd?: string;
  repaymentObligationUsd?: string;
  coverageRatioBps?: number;
  error?: string;
};

const supportedStatuses: LoanStatus[] = ['Active', 'MarginCall', 'Defaulted'];
const DEFAULT_CRITICAL_COVERAGE_BUFFER_BPS = 1000;
const DEFAULT_ADMIN_EXPENSE_BPS = 0;

export function evaluateKeeperDryRun(loans: Loan[], oracle: OracleAdapter, options: KeeperDryRunOptions = {}): KeeperDryRunResult[] {
  return loans.map((loan) => evaluateLoanForKeeperDryRun(loan, oracle, options));
}

function evaluateLoanForKeeperDryRun(loan: Loan, oracle: OracleAdapter, options: KeeperDryRunOptions): KeeperDryRunResult {
  const base = {
    loanId: loan.loanId,
    status: loan.status,
    marginCallLtvBps: loan.terms.marginCallLtvBps,
    liquidationLtvBps: loan.terms.liquidationLtvBps
  };

  if (!supportedStatuses.includes(loan.status)) {
    return {
      ...base,
      decision: 'NOOP_UNSUPPORTED_STATUS',
      policy: 'STANDARD_THRESHOLDS',
      computedLtvBps: null,
      reason: `Loan status ${loan.status} is outside keeper scope`
    };
  }

  let computed: KeeperRiskComputation;
  try {
    computed = computeKeeperRisk(loan, oracle, options);
  } catch (error) {
    return {
      ...base,
      decision: 'FAIL_CLOSED',
      policy: 'STANDARD_THRESHOLDS',
      computedLtvBps: null,
      reason: 'Price validation failed; keeper dry-run does not emit state-changing actions',
      error: error instanceof Error ? error.message : String(error)
    };
  }

  const riskFields = {
    computedLtvBps: computed.ltvBps,
    collateralValueUsd: normalizeDecimalString(computed.collateralValueUsd),
    repaymentObligationUsd: normalizeDecimalString(computed.repaymentObligationUsd),
    coverageRatioBps: computed.coverageRatioBps
  };

  if (computed.isCriticalCoverage) {
    return {
      ...base,
      ...riskFields,
      decision: 'PLAN_LIQUIDATION',
      policy: 'CRITICAL_COLLATERAL_BUFFER',
      reason: 'Collateral value is within the critical 10% repayment coverage buffer; plan liquidation to preserve lender coverage and return any surplus through normal proceeds distribution'
    };
  }

  if (computed.ltvBps < loan.terms.marginCallLtvBps && loan.status === 'Active') {
    return {
      ...base,
      ...riskFields,
      decision: 'NOOP_HEALTHY',
      policy: 'STANDARD_THRESHOLDS',
      reason: 'LTV below margin-call threshold'
    };
  }

  if (loan.status === 'Active' || loan.status === 'Defaulted') {
    return {
      ...base,
      ...riskFields,
      decision: 'PLAN_MARGIN_CALL',
      policy: 'MARGIN_CALL_FIRST',
      reason: 'Keeper policy moves price-threshold and default risk to MarginCall before liquidation unless collateral coverage becomes critical'
    };
  }

  return {
    ...base,
    ...riskFields,
    decision: 'NOOP_ALREADY_ESCALATED',
    policy: 'MARGIN_CALL_FIRST',
    reason: 'Loan is already in MarginCall; keeper waits for top-up/recovery or critical collateral coverage before planning liquidation'
  };
}

type KeeperRiskComputation = {
  ltvBps: number;
  collateralValueUsd: number;
  repaymentObligationUsd: number;
  coverageRatioBps: number;
  isCriticalCoverage: boolean;
};

function computeKeeperRisk(loan: Loan, oracle: OracleAdapter, options: KeeperDryRunOptions): KeeperRiskComputation {
  const normalizedPrice = oracle.getNormalizedPrice(loan.collateral.token);
  const collateralAmount = Number(loan.collateral.amount);
  if (!Number.isFinite(collateralAmount) || collateralAmount <= 0) {
    throw new Error(`Keeper: collateral amount must be a positive decimal for ${loan.collateral.token}`);
  }

  const collateralValueUsd = collateralAmount * Number(normalizedPrice.priceUsd);
  const repaymentObligationUsd = estimateRepaymentObligationUsd(loan, options);
  if (!Number.isFinite(repaymentObligationUsd) || repaymentObligationUsd <= 0) {
    throw new Error('Keeper: repayment obligation must be positive');
  }

  const coverageRatioBps = Math.round((collateralValueUsd * 10000) / repaymentObligationUsd);
  const criticalCoverageThresholdBps = 10000 + (options.criticalCoverageBufferBps ?? DEFAULT_CRITICAL_COVERAGE_BUFFER_BPS);

  return {
    ltvBps: oracle.computeLoanLtvBps(loan),
    collateralValueUsd,
    repaymentObligationUsd,
    coverageRatioBps,
    isCriticalCoverage: coverageRatioBps <= criticalCoverageThresholdBps
  };
}

function estimateRepaymentObligationUsd(loan: Loan, options: KeeperDryRunOptions): number {
  const outstandingPrincipalUsd = currencyToUsd(loan.currentMetrics.outstandingPrincipal, loan.currentMetrics.outstandingCurrency);
  const fullPrincipalUsd = currencyToUsd(loan.principal.amount, loan.principal.currency);
  const interestUsd = applyBps(fullPrincipalUsd, loan.terms.aprBps) * (loan.terms.tenorDays / 365);
  const adminExpenseUsd = applyBps(fullPrincipalUsd, options.adminExpenseBps ?? DEFAULT_ADMIN_EXPENSE_BPS);

  return outstandingPrincipalUsd + interestUsd + adminExpenseUsd;
}
