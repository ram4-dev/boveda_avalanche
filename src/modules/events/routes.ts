import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Web3Adapter } from '../../adapters/web3.js';
import type { DemoStore } from '../../store/demoStore.js';

type ListEventsQuery = {
  loanId?: string;
};

export async function registerEventRoutes(app: FastifyInstance, store: DemoStore, web3: Web3Adapter): Promise<void> {
  app.get('/events', async (request: FastifyRequest<{ Querystring: ListEventsQuery }>) => {
    await web3.refreshPendingEvents?.();
    return { events: store.listEvents({ loanId: request.query.loanId }) };
  });
}
