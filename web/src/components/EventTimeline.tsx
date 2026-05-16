import type { EvidenceSource, OnChainEvent } from '../api/types.js';
import { isUsdcCurrency, shortHash, unsupportedLiquidationCurrencyMessage } from './format.js';
import { EvidenceBadge } from './EvidenceBadge.js';
import { ExplorerLink } from './ExplorerLink.js';

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
      {events.map((event) => {
        const evidence = event.payload.evidence;
        const source: EvidenceSource = evidence?.source ?? (event.txHash || event.blockNumber ? 'fuji-live' : 'demo-simulated');
        const txHash = event.txHash ?? evidence?.txHash ?? null;
        const blockNumber = event.blockNumber ?? evidence?.blockNumber ?? null;
        const contractAddress = (evidence?.contracts?.[0]?.address ?? event.payload.vaultAddress) as string | undefined;
        const explorerBaseUrl = evidence?.explorerUrl ?? 'https://testnet.snowtrace.io';

        return <li key={event.eventId}>
          <span className="event-type">{event.eventType}</span>
          <span className="event-meta">
            {formatOccurredAt(event.occurredAt)} · tx {shortHash(txHash)}
          </span>
          <EvidenceBadge source={source} />
          <div className="button-row">
            <ExplorerLink entity="tx" value={txHash} source={source} explorerBaseUrl={explorerBaseUrl} />
            <ExplorerLink entity="address" value={contractAddress} source={source} explorerBaseUrl={explorerBaseUrl} />
            <ExplorerLink entity="block" value={blockNumber} source={source} explorerBaseUrl={explorerBaseUrl} />
          </div>
          {event.payload.attestationHash ? (
            <div className="event-payload">Attestation {String(event.payload.attestationHash)}</div>
          ) : null}
          {event.eventType === 'CollateralToppedUp' && event.payload.amount ? (
            <div className="event-payload">Top-up {String(event.payload.amount)} {String(event.payload.token ?? '')}</div>
          ) : null}
          {event.eventType === 'Liquidated' ? renderLiquidationProceeds(event) : null}
        </li>;
      })}
    </ol>
  );
}
