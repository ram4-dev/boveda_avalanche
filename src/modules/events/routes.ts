import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { OnChainEvent } from '../../domain/types.js';
import type { Web3Adapter } from '../../adapters/web3.js';
import type { DemoStore } from '../../store/demoStore.js';

type ListEventsQuery = {
  loanId?: string;
};

function attachAuditFields(event: OnChainEvent): OnChainEvent {
  return {
    ...event,
    explorerUrl: event.explorerUrl ?? (event.txHash ? `https://testnet.snowtrace.io/tx/${event.txHash}` : undefined),
    source: event.source ?? (event.txHash ? 'chain' : 'fallback')
  };
}

export async function registerEventRoutes(app: FastifyInstance, store: DemoStore, web3: Web3Adapter): Promise<void> {
  app.get('/events', async (request: FastifyRequest<{ Querystring: ListEventsQuery }>) => {
    await web3.refreshPendingEvents?.();
    return { events: store.listEvents({ loanId: request.query.loanId }).map(attachAuditFields) };
  });

  app.get('/audit-trail', async (request: FastifyRequest<{ Querystring: ListEventsQuery }>) => {
    await web3.refreshPendingEvents?.();
    return {
      auditTrail: store.listEvents({ loanId: request.query.loanId }).map(attachAuditFields)
    };
  });
}
