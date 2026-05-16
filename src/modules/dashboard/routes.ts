import type { FastifyInstance } from 'fastify';
import type { Web3Adapter } from '../../adapters/web3.js';
import { buildDashboardSummary } from '../../domain/dashboard.js';
import { DASHBOARD_SOURCE_MATRIX } from '../../domain/dashboardSources.js';
import type { DemoStore } from '../../store/demoStore.js';

export async function registerDashboardRoutes(app: FastifyInstance, store: DemoStore, web3: Web3Adapter): Promise<void> {
  app.get('/dashboard/summary', async () => {
    await web3.refreshPendingEvents?.();
    return buildDashboardSummary(store.listLoans(), store.listEvents());
  });

  app.get('/dashboard/data-sources', async () => {
    return { sources: DASHBOARD_SOURCE_MATRIX };
  });
}
