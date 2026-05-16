import { useCallback, useEffect, useState } from 'react';
import { toBorrowerError, type BorrowerFacingError } from '../api/errors.js';
import type { BovedaApiClient } from '../api/client.js';
import type { Loan, OnChainEvent, PaymentAttestation, QuoteResponse, RiskAssessment, LiquidationResult } from '../api/types.js';
import { buildDemoDepositPayload, buildDemoMarginCallPayload, buildDemoPaymentPayload, buildDemoTopUpPayload } from './demoPayloads.js';

export type JourneyAction = null | 'loading' | 'quoting' | 'risking' | 'depositing' | 'toppingUpCollateral' | 'activating' | 'attestingPayment' | 'triggeringMarginCall' | 'liquidating' | 'refreshing';
export type ErrorKey = 'load' | 'quote' | 'risk' | 'deposit' | 'topUp' | 'activate' | 'payment' | 'marginCall' | 'liquidation' | 'refresh';

export type BorrowerJourneyState = {
  loadStatus: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  selectedLoan: Loan | null;
  events: OnChainEvent[];
  quote: QuoteResponse | null;
  risk: RiskAssessment | null;
  lastPayment: PaymentAttestation | null;
  lastLiquidation: LiquidationResult | null;
  action: JourneyAction;
  errors: Partial<Record<ErrorKey, BorrowerFacingError>>;
};

export function createInitialJourneyState(): BorrowerJourneyState {
  return { loadStatus: 'idle', selectedLoan: null, events: [], quote: null, risk: null, lastPayment: null, lastLiquidation: null, action: null, errors: {} };
}

export function selectPreferredLoan(loans: Loan[]): Loan | null {
  return loans.find((loan) => loan.loanId === 'loan-web3-001' && loan.scenario === 'WEB3_BRIDGE') ?? loans.find((loan) => loan.scenario === 'WEB3_BRIDGE') ?? loans[0] ?? null;
}

export async function loadBorrowerContext(client: Pick<BovedaApiClient, 'listLoans' | 'listEvents'>, current: BorrowerJourneyState): Promise<BorrowerJourneyState> {
  try {
    const filteredResponse = await client.listLoans({ scenario: 'WEB3_BRIDGE' }) as { loans: Loan[] };
    const loans = filteredResponse.loans.length > 0 ? filteredResponse.loans : (await client.listLoans() as { loans: Loan[] }).loans;
    const selectedLoan = selectPreferredLoan(loans);
    if (!selectedLoan) return { ...current, loadStatus: 'empty', selectedLoan: null, events: [], errors: { ...current.errors, load: undefined } };
    const eventResponse = await client.listEvents({ loanId: selectedLoan.loanId }) as { events: OnChainEvent[] };
    return { ...current, loadStatus: 'ready', selectedLoan, events: eventResponse.events, errors: { ...current.errors, load: undefined } };
  } catch (error) {
    return { ...current, loadStatus: 'error', errors: { ...current.errors, load: toBorrowerError(error) } };
  }
}

export async function refreshQuote(client: Pick<BovedaApiClient, 'createQuote'>, current: BorrowerJourneyState, walletAddress?: string): Promise<BorrowerJourneyState> {
  if (!current.selectedLoan) return current;
  try {
    const loan = current.selectedLoan;
    const quote = await client.createQuote({
      scenario: loan.scenario,
      borrowerWallet: walletAddress || loan.borrower.walletAddress,
      requestedPrincipal: { amount: loan.principal.amount, currency: loan.principal.currency },
      collateralToken: loan.collateral.token,
      collateralValueUsd: loan.collateral.valueUsd
    }) as QuoteResponse;
    return { ...current, quote, errors: { ...current.errors, quote: undefined } };
  } catch (error) {
    return { ...current, errors: { ...current.errors, quote: toBorrowerError(error) } };
  }
}

export async function refreshRisk(client: Pick<BovedaApiClient, 'assessWalletRisk'>, current: BorrowerJourneyState, walletAddress?: string): Promise<BorrowerJourneyState> {
  if (!current.selectedLoan) return current;
  try {
    const loan = current.selectedLoan;
    const risk = await client.assessWalletRisk({ walletAddress: walletAddress || loan.borrower.walletAddress, scenario: loan.scenario, collateralToken: loan.collateral.token }) as RiskAssessment;
    return { ...current, risk, errors: { ...current.errors, risk: undefined } };
  } catch (error) {
    return { ...current, errors: { ...current.errors, risk: toBorrowerError(error) } };
  }
}

export function getStatusGuidance(loan: Loan): string {
  const map = {
    Requested: 'Waiting for originator approval before collateral can be recorded.',
    Approved: 'Collateral deposit is available through the API-simulated vault flow.',
    Active: 'Ready for payment attestation and risk monitoring.',
    MarginCall: 'Margin call active: repay or top up collateral before liquidation.',
    Defaulted: 'Defaulted: liquidation simulation is available.',
    Repaid: 'Loan repaid. No borrower mutation is needed.',
    Liquidated: 'Loan liquidated. Review USDC proceeds and distribution.',
    Cancelled: 'Request cancelled. No borrower actions are available.'
  } satisfies Record<Loan['status'], string>;
  return map[loan.status];
}

export function useBorrowerJourney(client: BovedaApiClient) {
  const [state, setState] = useState(createInitialJourneyState());
  const walletAddress = state.selectedLoan?.borrower.walletAddress;

  const load = useCallback(async () => setState((current) => ({ ...current, loadStatus: 'loading', action: 'loading' })), []);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loadStatus: 'loading', action: 'loading' }));
    void loadBorrowerContext(client, createInitialJourneyState()).then((next) => {
      if (!cancelled) setState({ ...next, action: null });
    });
    return () => { cancelled = true; };
  }, [client]);

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, action: 'refreshing' }));
    const next = await loadBorrowerContext(client, state);
    setState({ ...next, action: null });
  }, [client, state]);

  const quote = useCallback(async (address?: string) => setState({ ...(await refreshQuote(client, state, address ?? walletAddress)), action: null }), [client, state, walletAddress]);
  const risk = useCallback(async (address?: string) => setState({ ...(await refreshRisk(client, state, address ?? walletAddress)), action: null }), [client, state, walletAddress]);

  const withMutation = useCallback(async (action: Exclude<JourneyAction, null | 'loading' | 'quoting' | 'risking' | 'refreshing'>, errorKey: ErrorKey, operation: (loan: Loan) => Promise<unknown>) => {
    if (!state.selectedLoan) return;
    setState((current) => ({ ...current, action }));
    try {
      const result = await operation(state.selectedLoan);
      const loan = await client.getLoan(state.selectedLoan.loanId) as Loan;
      const events = (await client.listEvents({ loanId: state.selectedLoan.loanId }) as { events: OnChainEvent[] }).events;
      setState((current) => ({ ...current, selectedLoan: loan, events, action: null, lastPayment: action === 'attestingPayment' ? result as PaymentAttestation : current.lastPayment, lastLiquidation: action === 'liquidating' ? result as LiquidationResult : current.lastLiquidation, errors: { ...current.errors, [errorKey]: undefined } }));
    } catch (error) {
      setState((current) => ({ ...current, action: null, errors: { ...current.errors, [errorKey]: toBorrowerError(error) } }));
    }
  }, [client, state.selectedLoan]);

  return {
    state,
    load,
    reload,
    createQuote: quote,
    assessRisk: risk,
    depositCollateral: () => withMutation('depositing', 'deposit', (loan) => client.depositCollateral(loan.loanId, buildDemoDepositPayload(loan))),
    topUpCollateral: () => withMutation('toppingUpCollateral', 'topUp', (loan) => client.topUpCollateral(loan.loanId, buildDemoTopUpPayload(loan))),
    activateLoan: () => withMutation('activating', 'activate', (loan) => client.activateLoan(loan.loanId, { receiptTokenId: `receipt-${loan.loanId}` })),
    attestPayment: () => withMutation('attestingPayment', 'payment', (loan) => client.attestPayment(loan.loanId, buildDemoPaymentPayload(loan))),
    triggerMarginCall: () => withMutation('triggeringMarginCall', 'marginCall', (loan) => client.createMarginCall(loan.loanId, buildDemoMarginCallPayload(loan))),
    liquidateLoan: () => withMutation('liquidating', 'liquidation', (loan) => client.liquidateLoan(loan.loanId, { proceedsAmount: loan.liquidationPreview.proceedsAmount, proceedsCurrency: 'USDC' }))
  };
}
