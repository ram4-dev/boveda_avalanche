import type { DashboardSummary, OnChainEvent } from '../api/types.js';
import { selectAuditEvents } from '../state/dashboardSelectors.js';

type AuditTrailProps = {
  summary: DashboardSummary | null;
  events: OnChainEvent[];
  selectedLoanId?: string | null;
};

export function AuditTrail({ summary, events, selectedLoanId }: AuditTrailProps) {
  const rows = selectAuditEvents(summary, events, selectedLoanId ?? undefined);

  return <section className="dashboard-card" aria-label="Audit trail">
    <header className="card-title-row">
      <h2>Audit trail</h2>
      {selectedLoanId ? <small className="mono-cell">Filtered by {selectedLoanId}</small> : null}
    </header>

    {!rows.length ? <p>No canonical events available for the selected dashboard context.</p> : <ul className="audit-list" aria-label="Audit events">
      {rows.map((row) => <li key={row.eventId} className="audit-item">
        <div className="audit-item-head">
          <strong>{row.eventType}</strong>
          <span className="table-subtle mono-cell">{row.eventId}</span>
        </div>
        <div className="audit-item-grid">
          <span>Loan</span><span className="mono-cell">{row.loanId}</span>
          <span>Occurred</span><span>{row.occurredAt}</span>
          <span>Tx hash</span><span className="mono-cell">{row.txHash ?? 'Not recorded'}</span>
          <span>Block</span><span>{row.blockNumber ?? 'Not recorded'}</span>
        </div>
        <p className="table-subtle">{row.evidenceLabel}</p>
        {row.payloadHighlights.length ? <ul className="audit-highlights" aria-label={`Payload highlights ${row.eventId}`}>
          {row.payloadHighlights.map((highlight) => <li key={`${row.eventId}-${highlight.label}`}>
            <span>{highlight.label}</span>
            <code>{highlight.value}</code>
          </li>)}
        </ul> : null}
      </li>)}
    </ul>}
  </section>;
}
