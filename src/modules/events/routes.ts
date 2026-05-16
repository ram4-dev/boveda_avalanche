import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { OnChainEvent } from '../../domain/types.js';
import type { Web3Adapter, Web3RefreshOutcome } from '../../adapters/web3.js';
import type { DemoStore } from '../../store/demoStore.js';

type ListEventsQuery = {
  loanId?: string;
};

type SourceStatus = 'available' | 'pending' | 'stale' | 'unavailable';

type RefreshOutcome = Web3RefreshOutcome | undefined;

type EventsResponse = {
  events: OnChainEvent[];
  sourceStatus: {
    events: SourceStatus;
    details?: string;
  };
};

type AuditTrailResponse = {
  auditTrail: OnChainEvent[];
  sourceStatus: {
    events: SourceStatus;
    details?: string;
  };
};

function attachAuditFields(event: OnChainEvent): OnChainEvent {
  return {
    ...event,
    explorerUrl: event.explorerUrl ?? (event.txHash ? `https://testnet.snowtrace.io/tx/${event.txHash}` : undefined),
    source: event.source ?? (event.txHash ? 'chain' : 'fallback')
  };
}

function determineEventStatus(refresh: RefreshOutcome): EventsResponse['sourceStatus'] {
  if (!refresh) {
    return { events: 'available' };
  }

  if (!refresh.sourceAvailable) {
    return { events: refresh.pendingEvents > 0 ? 'stale' : 'available', details: refresh.sourceError };
  }

  if (refresh.pendingEvents > 0) {
    return { events: 'pending' };
  }

  return { events: 'available' };
}

export async function registerEventRoutes(app: FastifyInstance, store: DemoStore, web3: Web3Adapter): Promise<void> {
  app.get('/events', async (request: FastifyRequest<{ Querystring: ListEventsQuery }>) => {
    const refresh = await web3.refreshPendingEvents?.();
    return {
      events: store.listEvents({ loanId: request.query.loanId }).map(attachAuditFields),
      sourceStatus: determineEventStatus(refresh)
    } satisfies EventsResponse;
  });

  app.get('/audit-trail', async (request: FastifyRequest<{ Querystring: ListEventsQuery }>) => {
    const refresh = await web3.refreshPendingEvents?.();
    return {
      auditTrail: store.listEvents({ loanId: request.query.loanId }).map(attachAuditFields),
      sourceStatus: determineEventStatus(refresh)
    } satisfies AuditTrailResponse;
  });
}
