import type { DashboardSummary, Loan } from '../api/types.js';
import { formatMoney } from './format.js';
import { selectPortfolioSummary } from '../state/dashboardSelectors.js';
import { DataSourceBadge } from './DataSourceBadge.js';

type Props = {
  summary: DashboardSummary | null;
  loans: Loan[];
};

export function PortfolioSummaryCards({ summary, loans }: Props) {
  const view = selectPortfolioSummary(summary, loans);

  return <section className="dashboard-card" aria-label="Portfolio summary cards">
    <header className="card-title-row">
      <h2>Portfolio summary</h2>
    </header>
    <div className="dashboard-summary-grid">
      <article className="metric-tile metric-hero">
        <span>Capital utilized</span>
        <strong>{formatMoney(view.activePrincipalUsd.value, 'USD')}</strong>
        <DataSourceBadge label={view.activePrincipalUsd.label} />
      </article>
      <article className="metric-tile">
        <span>Active loans</span>
        <strong>{view.activeLoans.value}</strong>
        <DataSourceBadge label={view.activeLoans.label} />
      </article>
      <article className="metric-tile">
        <span>Active vaults</span>
        <strong>{view.activeVaults.value}</strong>
        <DataSourceBadge label={view.activeVaults.label} />
      </article>
      <article className="metric-tile">
        <span>Margin/default exposure</span>
        <strong>{view.marginOrDefaultExposure.value}</strong>
        <DataSourceBadge label={view.marginOrDefaultExposure.label} />
      </article>
      <article className="metric-tile">
        <span>Payments attested</span>
        <strong>{view.paymentsAttested.value}</strong>
        <DataSourceBadge label={view.paymentsAttested.label} />
      </article>
      <article className="metric-tile">
        <span>Liquidations executed</span>
        <strong>{view.liquidationsExecuted.value}</strong>
        <DataSourceBadge label={view.liquidationsExecuted.label} />
      </article>
    </div>
  </section>;
}
