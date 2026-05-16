import type { OracleAdapter } from '../adapters/oracle.js';
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
  | 'ACTIVE_ABOVE_LIQUIDATION_CALL_MARGIN_FIRST';

export type KeeperDryRunResult = {
  loanId: string;
  status: LoanStatus;
  decision: KeeperDecision;
  policy: KeeperPolicy;
  computedLtvBps: number | null;
  marginCallLtvBps: number;
  liquidationLtvBps: number;
  reason: string;
  error?: string;
};

const supportedStatuses: LoanStatus[] = ['Active', 'MarginCall', 'Defaulted'];

export function evaluateKeeperDryRun(loans: Loan[], oracle: OracleAdapter): KeeperDryRunResult[] {
  return loans.map((loan) => evaluateLoanForKeeperDryRun(loan, oracle));
}

function evaluateLoanForKeeperDryRun(loan: Loan, oracle: OracleAdapter): KeeperDryRunResult {
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

  let ltvBps: number;
  try {
    ltvBps = oracle.computeLoanLtvBps(loan);
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

  if (ltvBps < loan.terms.marginCallLtvBps) {
    return {
      ...base,
      decision: 'NOOP_HEALTHY',
      policy: 'STANDARD_THRESHOLDS',
      computedLtvBps: ltvBps,
      reason: 'LTV below margin-call threshold'
    };
  }

  if (loan.status !== 'Active' && ltvBps < loan.terms.liquidationLtvBps) {
    return {
      ...base,
      decision: 'NOOP_ALREADY_ESCALATED',
      policy: 'STANDARD_THRESHOLDS',
      computedLtvBps: ltvBps,
      reason: `Loan already ${loan.status}; keeper dry-run waits for liquidation threshold before planning liquidation`
    };
  }

  if (ltvBps >= loan.terms.liquidationLtvBps) {
    if (loan.status === 'MarginCall' || loan.status === 'Defaulted') {
      return {
        ...base,
        decision: 'PLAN_LIQUIDATION',
        policy: 'STANDARD_THRESHOLDS',
        computedLtvBps: ltvBps,
        reason: 'LTV reached liquidation threshold while loan is MarginCall/Defaulted'
      };
    }

    return {
      ...base,
      decision: 'PLAN_MARGIN_CALL',
      policy: 'ACTIVE_ABOVE_LIQUIDATION_CALL_MARGIN_FIRST',
      computedLtvBps: ltvBps,
      reason: 'Safe demo policy: Active loans above liquidation threshold are escalated to MarginCall first, not liquidated directly'
    };
  }

  return {
    ...base,
    decision: 'PLAN_MARGIN_CALL',
    policy: 'STANDARD_THRESHOLDS',
    computedLtvBps: ltvBps,
    reason: 'LTV reached margin-call threshold'
  };
}
