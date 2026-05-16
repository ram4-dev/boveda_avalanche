import { ApiClientError, type BovedaApiClient } from '../api/client.js';
import type { DashboardSummary, EventsResponse, Loan, LoansResponse, OnChainEvent } from '../api/types.js';
import type { DashboardDemoMode } from './dashboardSelectors.js';

export type DashboardLoadStatus = 'idle' | 'loading' | 'ready' | 'partial' | 'empty' | 'error';
export type DashboardAction = null | 'loading' | 'refreshing' | 'selectingLoan';
export type DashboardErrorKey = 'summary' | 'loans' | 'events' | 'selectedLoan' | 'refresh';
export type SafeDashboardError = { code: string; message: string };

export type InstitutionalDashboardState = {
  status: DashboardLoadStatus;
  summary: DashboardSummary | null;
  loans: Loan[];
  events: OnChainEvent[];
  selectedLoanId: string | null;
  selectedLoan: Loan | null;
  demoMode: DashboardDemoMode;
  action: DashboardAction;
  lastLoadedAt: string | null;
  errors: Partial<Record<DashboardErrorKey, SafeDashboardError>>;
};

type DashboardReadClient = {
  getDashboardSummary: () => Promise<DashboardSummary | null>;
  listLoans: () => Promise<LoansResponse>;
  listEvents: () => Promise<EventsResponse>;
};
type LoanDetailClient = Pick<BovedaApiClient, 'getLoan' | 'listEvents'>;

export function createInitialInstitutionalDashboardState(): InstitutionalDashboardState {
  return {
    status: 'idle',
    summary: null,
    loans: [],
    events: [],
    selectedLoanId: null,
    selectedLoan: null,
    demoMode: 'all',
    action: null,
    lastLoadedAt: null,
    errors: {}
  };
}

export async function loadInstitutionalDashboard(client: DashboardReadClient, current: InstitutionalDashboardState): Promise<InstitutionalDashboardState> {
  return readDashboardSections(client, { ...current, action: 'loading' }, false);
}

export async function refreshInstitutionalDashboard(client: DashboardReadClient, current: InstitutionalDashboardState): Promise<InstitutionalDashboardState> {
  return readDashboardSections(client, { ...current, action: 'refreshing' }, true);
}

export async function selectInstitutionalDashboardLoan(client: LoanDetailClient, current: InstitutionalDashboardState, loanId: string): Promise<InstitutionalDashboardState> {
  const portfolioLoan = current.loans.find((loan) => loan.loanId === loanId) ?? current.selectedLoan;
  try {
    const loan = await client.getLoan(loanId);
    const events = (await client.listEvents({ loanId })).events;
    return {
      ...current,
      selectedLoanId: loanId,
      selectedLoan: loan,
      events: mergeEvents(current.events, events),
      action: null,
      errors: withoutError(current.errors, 'selectedLoan')
    };
  } catch (error) {
    return {
      ...current,
      selectedLoanId: loanId,
      selectedLoan: portfolioLoan,
      action: null,
      errors: { ...current.errors, selectedLoan: toDashboardError(error) }
    };
  }
}

export function setDashboardDemoMode(current: InstitutionalDashboardState, demoMode: DashboardDemoMode): InstitutionalDashboardState {
  const selectedLoanMatchesMode = current.selectedLoan ? loanMatchesMode(current.selectedLoan, demoMode) : false;
  return {
    ...current,
    demoMode,
    selectedLoanId: selectedLoanMatchesMode ? current.selectedLoanId : null,
    selectedLoan: selectedLoanMatchesMode ? current.selectedLoan : null
  };
}

async function readDashboardSections(client: DashboardReadClient, current: InstitutionalDashboardState, preserveOnFailure: boolean): Promise<InstitutionalDashboardState> {
  const [summaryResult, loansResult, eventsResult] = await Promise.allSettled([
    client.getDashboardSummary(),
    client.listLoans(),
    client.listEvents()
  ]);

  const summary = fulfilledValue<DashboardSummary | null>(summaryResult, preserveOnFailure ? current.summary : null);
  const loansResponse = fulfilledValue<LoansResponse | null>(loansResult, null);
  const eventsResponse = fulfilledValue<EventsResponse | null>(eventsResult, null);
  const loans = loansResponse?.loans ?? (preserveOnFailure ? current.loans : []);
  const events = eventsResponse?.events ?? (preserveOnFailure ? current.events : []);

  const errors: InstitutionalDashboardState['errors'] = {
    ...current.errors,
    summary: rejectedError(summaryResult),
    loans: rejectedError(loansResult),
    events: rejectedError(eventsResult)
  };

  const next: InstitutionalDashboardState = {
    ...current,
    summary,
    loans,
    events,
    selectedLoan: current.selectedLoanId ? loans.find((loan) => loan.loanId === current.selectedLoanId) ?? current.selectedLoan : current.selectedLoan,
    action: null,
    lastLoadedAt: anyFulfilled([summaryResult, loansResult, eventsResult]) ? new Date().toISOString() : current.lastLoadedAt,
    errors: removeUndefinedErrors(errors)
  };

  return { ...next, status: computeStatus(next, [summaryResult, loansResult, eventsResult]) };
}

function computeStatus(state: InstitutionalDashboardState, results: PromiseSettledResult<unknown>[]): DashboardLoadStatus {
  const fulfilled = results.filter((result) => result.status === 'fulfilled').length;
  const rejected = results.length - fulfilled;
  const hasUsefulData = Boolean(state.summary) || state.loans.length > 0 || state.events.length > 0;
  if (fulfilled === 0 && !hasUsefulData) return 'error';
  if (rejected > 0) return hasUsefulData ? 'partial' : 'error';
  if (!hasUsefulData) return 'empty';
  return 'ready';
}

function fulfilledValue<T>(result: PromiseSettledResult<unknown>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value as T : fallback;
}

function rejectedError(result: PromiseSettledResult<unknown>): SafeDashboardError | undefined {
  return result.status === 'rejected' ? toDashboardError(result.reason) : undefined;
}

function anyFulfilled(results: PromiseSettledResult<unknown>[]): boolean {
  return results.some((result) => result.status === 'fulfilled');
}

function toDashboardError(error: unknown): SafeDashboardError {
  if (error instanceof ApiClientError) return { code: error.code, message: error.message };
  if (error instanceof Error) return { code: 'REQUEST_FAILED', message: error.message };
  return { code: 'REQUEST_FAILED', message: 'Dashboard request failed. Please retry.' };
}

function withoutError(errors: InstitutionalDashboardState['errors'], key: DashboardErrorKey): InstitutionalDashboardState['errors'] {
  const next = { ...errors };
  delete next[key];
  return next;
}

function removeUndefinedErrors(errors: InstitutionalDashboardState['errors']): InstitutionalDashboardState['errors'] {
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => value !== undefined)) as InstitutionalDashboardState['errors'];
}

function mergeEvents(current: OnChainEvent[], incoming: OnChainEvent[]): OnChainEvent[] {
  const byId = new Map(current.map((event) => [event.eventId, event]));
  incoming.forEach((event) => byId.set(event.eventId, event));
  return [...byId.values()];
}

function loanMatchesMode(loan: Loan, demoMode: DashboardDemoMode): boolean {
  if (demoMode === 'all') return true;
  if (demoMode === 'institutional') return loan.scenario === 'SME_FIAT_WORKING_CAPITAL';
  return loan.scenario === 'WEB3_BRIDGE';
}
