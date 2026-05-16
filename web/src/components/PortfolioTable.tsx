import type { Loan } from '../api/types.js';
import { formatBps, formatMoney, shortHash } from './format.js';
import { StatusPill } from './StatusPill.js';

type Props = {
  loans: Loan[];
  onInspectLoan: (loanId: string) => void;
};

export function PortfolioTable({ loans, onInspectLoan }: Props) {
  if (!loans.length) {
    return <section className="dashboard-card" aria-label="Portfolio table">
      <header className="card-title-row"><h2>Portfolio loans</h2></header>
      <p>No loans available for the selected dashboard context.</p>
    </section>;
  }

  return <section className="dashboard-card" aria-label="Portfolio table">
    <header className="card-title-row"><h2>Portfolio loans</h2></header>
    <div className="dashboard-table-scroll">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th scope="col">Loan</th>
            <th scope="col">Scenario</th>
            <th scope="col">Borrower</th>
            <th scope="col">Status</th>
            <th scope="col">Principal</th>
            <th scope="col">Collateral</th>
            <th scope="col">Current LTV</th>
            <th scope="col">Vault / receipt</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => <tr key={loan.loanId}>
            <td className="mono-cell" title={loan.loanId}>{loan.loanId}</td>
            <td>{loan.scenario.replaceAll('_', ' ')}</td>
            <td title={loan.borrower.walletAddress}>{loan.borrower.displayName}<div className="table-subtle mono-cell">{shortHash(loan.borrower.walletAddress)}</div></td>
            <td><StatusPill status={loan.status} /></td>
            <td>{formatMoney(loan.principal.amount, loan.principal.currency)}</td>
            <td>{formatMoney(loan.collateral.valueUsd, 'USD')}<div className="table-subtle">{loan.collateral.token}</div></td>
            <td>{formatBps(loan.currentMetrics.currentLtvBps)}</td>
            <td>{loan.collateral.vaultAddress ? <span className="mono-cell" title={loan.collateral.vaultAddress}>{shortHash(loan.collateral.vaultAddress)}</span> : 'No vault'}<div className="table-subtle">{loan.receipt?.receiptTokenId ?? 'No receipt'}</div></td>
            <td><button className="button button-secondary" onClick={() => onInspectLoan(loan.loanId)} aria-label={`Inspect ${loan.loanId}`}>Inspect</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}
