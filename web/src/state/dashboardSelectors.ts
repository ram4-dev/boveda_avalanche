import type { DashboardSummary, Loan, OnChainEvent } from '../api/types.js';
import { formatBps } from '../components/format.js';

export type DashboardDemoMode = 'institutional' | 'crypto-native' | 'all';
export type DashboardDataSource = 'api' | 'derived' | 'demo-fixture';
export type DashboardField<T> = { value: T; source: DashboardDataSource; label?: 'Demo data' | 'Derived from API loans' };
export type DashboardSeverity = 'healthy' | 'warning' | 'critical';

const activeStatuses = new Set<Loan['status']>(['Active', 'MarginCall']);
const terminalRiskStatuses = new Set<Loan['status']>(['Defaulted', 'Liquidated']);
const payloadAllowlist = new Set(['attestationHash', 'proceedsCurrency', 'proceedsAmount', 'vaultAddress', 'receiptTokenId', 'reason', 'amount', 'currency', 'installmentId']);

export function selectLoansForMode(loans: Loan[], demoMode: DashboardDemoMode): Loan[] {
  if (demoMode === 'all') return loans;
  const scenario = demoMode === 'institutional' ? 'SME_FIAT_WORKING_CAPITAL' : 'WEB3_BRIDGE';
  return loans.filter((loan) => loan.scenario === scenario);
}

export function selectPortfolioSummary(summary: DashboardSummary | null, loans: Loan[]) {
  const activeLoans = loans.filter((loan) => activeStatuses.has(loan.status));
  return {
    activePrincipalUsd: summary
      ? field(summary.activePrincipalUsd, 'api')
      : field('Unavailable', 'demo-fixture', 'Demo data'),
    activeLoans: field(activeLoans.length, 'derived', 'Derived from API loans'),
    activeVaults: summary
      ? field(summary.activeVaults, 'api')
      : field(activeLoans.filter((loan) => Boolean(loan.collateral.vaultAddress)).length, 'derived', 'Derived from API loans'),
    marginOrDefaultExposure: field(loans.filter((loan) => loan.status === 'MarginCall' || loan.status === 'Defaulted').length, 'derived', 'Derived from API loans'),
    paymentsAttested: summary ? field(summary.paymentsAttested, 'api') : field(0, 'demo-fixture', 'Demo data'),
    liquidationsExecuted: summary ? field(summary.liquidationsExecuted, 'api') : field(0, 'demo-fixture', 'Demo data')
  };
}

export function selectRiskSummary(summary: DashboardSummary | null, loans: Loan[]) {
  const averageLtvBps = summary?.averageLtvBps ?? averageValidBps(loans.map((loan) => loan.currentMetrics.currentLtvBps));
  const loansInMarginCall = summary?.loansInMarginCall ?? loans.filter((loan) => loan.status === 'MarginCall').length;
  return {
    averageLtv: { ...field(averageLtvBps, summary ? 'api' : 'derived', summary ? undefined : 'Derived from API loans'), label: formatBpsOrUnavailable(averageLtvBps) },
    loansInMarginCall: field(loansInMarginCall, summary ? 'api' : 'derived', summary ? undefined : 'Derived from API loans'),
    severity: selectDashboardHealthSeverity({ averageLtvBps, loansInMarginCall, hasTerminalRisk: loans.some((loan) => terminalRiskStatuses.has(loan.status)) })
  };
}

export function selectDashboardHealthSeverity(input: { averageLtvBps: number | null; loansInMarginCall: number; hasTerminalRisk?: boolean }): DashboardSeverity {
  if (input.hasTerminalRisk || (isFiniteNumber(input.averageLtvBps) && input.averageLtvBps >= 8000)) return 'critical';
  if (input.loansInMarginCall > 0 || (isFiniteNumber(input.averageLtvBps) && input.averageLtvBps >= 6500)) return 'warning';
  return 'healthy';
}

export function selectExposureByAsset(summary: DashboardSummary | null, loans: Loan[]) {
  if (summary?.exposureByAsset.length) {
    return [...summary.exposureByAsset]
      .sort((a, b) => safeNumber(b.valueUsd) - safeNumber(a.valueUsd))
      .map((entry) => ({ ...entry, source: 'api' as const }));
  }

  const totals = new Map<string, number>();
  loans.forEach((loan) => {
    const value = safeNumberOrNull(loan.collateral.valueUsd);
    if (value === null) return;
    totals.set(loan.collateral.token, (totals.get(loan.collateral.token) ?? 0) + value);
  });

  const derived = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([asset, value]) => ({ asset, valueUsd: String(value), source: 'derived' as const, label: 'Derived from API loans' as const }));
  return derived.length ? derived : [{ asset: 'No exposure data', valueUsd: '0', source: 'demo-fixture' as const, label: 'Demo data' as const }];
}

export function selectAuditEvents(summary: DashboardSummary | null, events: OnChainEvent[], selectedLoanId?: string) {
  const source = events.length > 0 ? events : summary?.recentEvents ?? [];
  return source
    .filter((event) => !selectedLoanId || event.loanId === selectedLoanId)
    .map((event) => ({
      eventId: event.eventId,
      eventType: event.eventType,
      loanId: event.loanId,
      occurredAt: event.occurredAt,
      txHash: event.txHash,
      blockNumber: event.blockNumber,
      evidenceLabel: event.txHash || event.blockNumber ? 'On-chain evidence recorded' : 'No tx hash or block recorded',
      payloadHighlights: payloadHighlights(event.payload)
    }));
}

export function selectLoanDetailViewModel(loan: Loan, events: OnChainEvent[]) {
  const paymentEvents = events.filter((event) => event.loanId === loan.loanId && event.eventType === 'InstallmentPaid');
  const paymentEvidence = paymentEvents.map((event) => ({ eventId: event.eventId, occurredAt: event.occurredAt, highlights: payloadHighlights(event.payload) }));
  return {
    loanId: loan.loanId,
    scenario: loan.scenario,
    status: loan.status,
    borrower: loan.borrower,
    originator: loan.originator,
    fundingPartner: loan.fundingPartner,
    principal: loan.principal,
    collateral: loan.collateral,
    currentMetrics: loan.currentMetrics,
    terms: loan.terms,
    risk: loan.riskAssessment,
    receipt: loan.receipt ? { ...loan.receipt, emptyLabel: undefined as string | undefined } : { receiptTokenId: null, soulbound: null, ownerWallet: null, emptyLabel: 'No receipt minted yet' },
    paymentEvidence,
    paymentEmptyLabel: paymentEvidence.length ? undefined : 'No payment evidence recorded yet',
    liquidation: loan.liquidationPreview
  };
}

function field<T>(value: T, source: DashboardDataSource, label?: DashboardField<T>['label']): DashboardField<T> {
  return label ? { value, source, label } : { value, source };
}

function payloadHighlights(payload: Record<string, unknown>) {
  return Object.entries(payload)
    .filter(([key, value]) => payloadAllowlist.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
    .map(([label, value]) => ({ label, value: String(value) }));
}

function averageValidBps(values: number[]): number | null {
  const valid = values.filter(isFiniteNumber);
  if (!valid.length) return null;
  return Math.round(valid.reduce((total, value) => total + value, 0) / valid.length);
}

function formatBpsOrUnavailable(value: number | null): string {
  return isFiniteNumber(value) ? formatBps(value) : 'Unavailable';
}

function safeNumber(value: string): number {
  return safeNumberOrNull(value) ?? 0;
}

function safeNumberOrNull(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
