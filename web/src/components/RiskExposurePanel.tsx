import type { DashboardSummary, Loan } from '../api/types.js';
import { formatBps, formatMoney } from './format.js';
import { selectExposureByAsset, selectRiskSummary } from '../state/dashboardSelectors.js';
import { DataSourceBadge } from './DataSourceBadge.js';

type Props = {
  summary: DashboardSummary | null;
  loans: Loan[];
  selectedLoan?: Loan | null;
};

export function RiskExposurePanel({ summary, loans, selectedLoan }: Props) {
  const risk = selectRiskSummary(summary, loans);
  const exposure = selectExposureByAsset(summary, loans);

  return <section className="dashboard-card" aria-label="Portfolio risk and exposure">
    <header className="card-title-row">
      <h2>Risk and exposure</h2>
      <span className={`severity-pill severity-${risk.severity}`}>{risk.severity}</span>
    </header>

    <div className="dashboard-risk-grid">
      <article className="metric-tile">
        <span>Average LTV</span>
        <strong>{risk.averageLtv.label}</strong>
        <DataSourceBadge label={risk.averageLtv.source === 'api' ? undefined : risk.averageLtv.label} />
      </article>
      <article className="metric-tile">
        <span>Loans in margin call</span>
        <strong>{risk.loansInMarginCall.value}</strong>
        <DataSourceBadge label={risk.loansInMarginCall.label} />
      </article>
    </div>

    {selectedLoan ? <div className="risk-thresholds" aria-label="Selected loan thresholds">
      <p>Selected loan thresholds</p>
      <ul>
        <li>Current LTV: <strong>{formatBps(selectedLoan.currentMetrics.currentLtvBps)}</strong></li>
        <li>Margin call threshold: <strong>{formatBps(selectedLoan.terms.marginCallLtvBps)}</strong></li>
        <li>Liquidation threshold: <strong>{formatBps(selectedLoan.terms.liquidationLtvBps)}</strong></li>
      </ul>
    </div> : null}

    <h3>Exposure by collateral asset</h3>
    <ul className="exposure-list" aria-label="Exposure by collateral asset">
      {exposure.map((row) => <li key={`${row.asset}-${row.valueUsd}`}>
        <span>{row.asset}</span>
        <strong>{formatMoney(row.valueUsd, 'USD')}</strong>
        {'label' in row ? <DataSourceBadge label={row.label} /> : null}
      </li>)}
    </ul>
  </section>;
}
