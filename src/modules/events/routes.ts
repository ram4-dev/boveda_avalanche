import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DemoStore } from '../../store/demoStore.js';

type ListEventsQuery = {
  loanId?: string;
};

export async function registerEventRoutes(app: FastifyInstance, store: DemoStore): Promise<void> {
  app.get('/events', async (request: FastifyRequest<{ Querystring: ListEventsQuery }>) => {
    return { events: store.listEvents({ loanId: request.query.loanId }) };
  });
}
