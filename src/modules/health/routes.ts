import type { FastifyInstance } from 'fastify';

export const HEALTH_RESPONSE = {
  ok: true,
  service: 'boveda-demo-api',
  version: '0.1.0-batch0'
} as const;

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => HEALTH_RESPONSE);
}
