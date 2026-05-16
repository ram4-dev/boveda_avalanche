import { currencyToUsd, normalizeDecimalString } from './money.js';
import type { Loan, OnChainEvent } from './types.js';

export type DashboardSummary = {
  activePrincipalUsd: string;
  activeVaults: number;
  averageLtvBps: number;
  loansInMarginCall: number;
  paymentsAttested: number;
  liquidationsExecuted: number;
  exposureByAsset: Array<{ asset: string; valueUsd: string }>;
  recentEvents: OnChainEvent[];
};

const activeStatuses = new Set(['Active', 'MarginCall']);

export function buildDashboardSummary(loans: Loan[], events: OnChainEvent[]): DashboardSummary {
  const activeLoans = loans.filter((loan) => activeStatuses.has(loan.status));
  const activePrincipalUsd = activeLoans.reduce((total, loan) => {
    return total + currencyToUsd(loan.currentMetrics.outstandingPrincipal, loan.currentMetrics.outstandingCurrency);
  }, 0);

  const collateralValueUsd = activeLoans.reduce((total, loan) => total + Number(loan.collateral.valueUsd), 0);
  const weightedLtv = collateralValueUsd === 0
    ? 0
    : Math.round(activeLoans.reduce((total, loan) => total + (loan.currentMetrics.currentLtvBps * Number(loan.collateral.valueUsd)), 0) / collateralValueUsd);

  return {
    activePrincipalUsd: normalizeDecimalString(activePrincipalUsd),
    activeVaults: activeLoans.filter((loan) => Boolean(loan.collateral.vaultAddress)).length,
    averageLtvBps: weightedLtv,
    loansInMarginCall: loans.filter((loan) => loan.status === 'MarginCall').length,
    paymentsAttested: events.filter((event) => event.eventType === 'InstallmentPaid').length,
    liquidationsExecuted: events.filter((event) => event.eventType === 'Liquidated').length,
    exposureByAsset: exposureByAsset(activeLoans),
    recentEvents: [...events].sort(compareEventsNewestFirst).slice(0, 10)
  };
}

function exposureByAsset(loans: Loan[]): Array<{ asset: string; valueUsd: string }> {
  const totals = new Map<string, number>();
  for (const loan of loans) {
    totals.set(loan.collateral.token, (totals.get(loan.collateral.token) ?? 0) + Number(loan.collateral.valueUsd));
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([asset, valueUsd]) => ({ asset, valueUsd: normalizeDecimalString(valueUsd) }));
}

function compareEventsNewestFirst(left: OnChainEvent, right: OnChainEvent): number {
  const byTime = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  if (byTime !== 0) {
    return byTime;
  }
  return right.eventId.localeCompare(left.eventId);
}
