import { useEffect, useMemo, useState } from 'react';
import type { BovedaApiClient } from '../api/client.js';
import { AuditTrail } from '../components/AuditTrail.js';
import { DashboardSourcesPanel } from '../components/DashboardSourcesPanel.js';
import { DashboardViewToggle } from '../components/DashboardViewToggle.js';
import { LoanDetailPanel } from '../components/LoanDetailPanel.js';
import { PortfolioSummaryCards } from '../components/PortfolioSummaryCards.js';
import { PortfolioTable } from '../components/PortfolioTable.js';
import { RiskExposurePanel } from '../components/RiskExposurePanel.js';
import { selectLoansForMode } from '../state/dashboardSelectors.js';
import {
  createInitialInstitutionalDashboardState,
  loadInstitutionalDashboard,
  refreshInstitutionalDashboard,
  selectInstitutionalDashboardLoan,
  setDashboardDemoMode
} from '../state/institutionalDashboard.js';

type Props = {
  client: Pick<BovedaApiClient, 'getDashboardSummary' | 'listLoans' | 'listEvents' | 'getLoan'>;
};

export function InstitutionalDashboardScreen({ client }: Props) {
  const [state, setState] = useState(createInitialInstitutionalDashboardState);

  useEffect(() => {
    let cancelled = false;
    loadInstitutionalDashboard(client, createInitialInstitutionalDashboardState()).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const filteredLoans = useMemo(() => selectLoansForMode(state.loans, state.demoMode), [state.loans, state.demoMode]);

  const onRefresh = async () => {
    const next = await refreshInstitutionalDashboard(client, { ...state, action: 'refreshing' });
    setState(next);
  };

  const onInspectLoan = async (loanId: string) => {
    const next = await selectInstitutionalDashboardLoan(client, { ...state, action: 'selectingLoan' }, loanId);
    setState(next);
  };

  return <section className="dashboard-layout" aria-label="Institutional dashboard">
    <header className="dashboard-toolbar">
      <div>
        <span className="card-kicker">Institutional view</span>
        <h2>Institutional dashboard</h2>
      </div>
      <div className="dashboard-toolbar-actions">
        <DashboardViewToggle mode={state.demoMode} onChangeMode={(mode) => setState((current) => setDashboardDemoMode(current, mode))} />
        <button className="button button-secondary" onClick={onRefresh} aria-label="Refresh institutional dashboard">
          {state.action === 'refreshing' ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </header>

    {state.status === 'loading' || state.status === 'idle' ? <article className="dashboard-card"><p>Loading institutional dashboard from the local backend API…</p></article> : null}
    {state.status === 'error' ? <article className="dashboard-card"><p role="alert">Could not load institutional dashboard. Retry after backend readiness check.</p></article> : null}
    {state.status === 'partial' ? <article className="dashboard-card"><p role="status">Dashboard loaded with partial data. Some sections use last confirmed values.</p></article> : null}
    {state.status === 'empty' ? <article className="dashboard-card"><p>No institutional portfolio data was returned by the API.</p></article> : null}

    {(state.status === 'ready' || state.status === 'partial') ? <>
      {state.summary?.sourceStatus ? <article className="dashboard-card"><p role="status">{state.summary.sourceStatus.events === 'pending' ? 'Chain event refresh is in progress; some on-chain evidence is still pending.' : state.summary.sourceStatus.events === 'stale' ? 'Chain source is currently unavailable; audit and event state may be stale.' : state.summary.sourceStatus.events === 'unavailable' ? 'Chain source unavailable; fallback values are shown where needed.' : 'Chain source is available and up to date.'} {state.summary.sourceStatus.details ? `Details: ${state.summary.sourceStatus.details}` : ''}</p></article> : null}
      {state.errors.summary ? <article className="dashboard-card"><p role="status">Portfolio summary unavailable: {state.errors.summary.message}. Showing fallback metrics where possible.</p></article> : null}
      <PortfolioSummaryCards summary={state.summary} loans={filteredLoans} />
      <div className="dashboard-grid">
        <div>
          {state.errors.loans ? <article className="dashboard-card"><p role="status">Portfolio loans unavailable: {state.errors.loans.message}. Retry refresh to restore canonical loan rows.</p></article> : null}
          <PortfolioTable loans={filteredLoans} onInspectLoan={onInspectLoan} />
        </div>
        <RiskExposurePanel summary={state.summary} loans={filteredLoans} selectedLoan={state.selectedLoan} />
      </div>
      <DashboardSourcesPanel client={client} />
      <div className="dashboard-grid">
        <div>
          {state.errors.events ? <article className="dashboard-card"><p role="status">Events unavailable: {state.errors.events.message}. Audit trail reflects the latest successfully loaded evidence.</p></article> : null}
          <AuditTrail summary={state.summary} events={state.events} selectedLoanId={state.selectedLoanId} />
        </div>
        <LoanDetailPanel loan={state.selectedLoan} events={state.events} errorMessage={state.errors.selectedLoan?.message} />
      </div>
    </> : null}
  </section>;
}
