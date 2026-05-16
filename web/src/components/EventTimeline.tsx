import type { OnChainEvent } from '../api/types.js';
import { isUsdcCurrency, shortHash, unsupportedLiquidationCurrencyMessage } from './format.js';

function renderLiquidationProceeds(event: OnChainEvent) {
  const { proceedsAmount, proceedsCurrency } = event.payload;
  if (!proceedsAmount || !proceedsCurrency) return null;
  if (!isUsdcCurrency(proceedsCurrency)) {
    return <div className="event-payload">{unsupportedLiquidationCurrencyMessage(proceedsCurrency)}</div>;
  }
  return <div className="event-payload">Proceeds {String(proceedsAmount)} USDC</div>;
}

function formatOccurredAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function EventTimeline({ events }: { events: OnChainEvent[] }) {
  if (events.length === 0) return <p className="muted">No loan events recorded yet.</p>;
  return (
    <ol className="event-list" aria-label="Loan event timeline">
      {events.map((event) => (
        <li key={event.eventId}>
          <span className="event-type">{event.eventType}</span>
          <span className="event-meta">
            {formatOccurredAt(event.occurredAt)} · tx {shortHash(event.txHash)}
          </span>
          {event.payload.attestationHash ? (
            <div className="event-payload">Attestation {String(event.payload.attestationHash)}</div>
          ) : null}
          {event.eventType === 'Liquidated' ? renderLiquidationProceeds(event) : null}
        </li>
      ))}
    </ol>
  );
}
