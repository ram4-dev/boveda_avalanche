import type { FastifyInstance } from 'fastify';
import type { Web3Adapter, Web3RefreshOutcome } from '../../adapters/web3.js';
import { buildDashboardSummary } from '../../domain/dashboard.js';
import { DASHBOARD_SOURCE_MATRIX } from '../../domain/dashboardSources.js';
import type { DemoStore } from '../../store/demoStore.js';

type SourceStatus = 'available' | 'pending' | 'stale' | 'unavailable';

type DashboardSummaryResponse = {
  summary: ReturnType<typeof buildDashboardSummary>;
  sourceStatus: {
    summary: SourceStatus;
    events: SourceStatus;
    details?: string;
  };
};

type RefreshOutcome = Web3RefreshOutcome | undefined;

function determineSourceStatus(refresh: RefreshOutcome): { summary: SourceStatus; events: SourceStatus; details?: string } {
  if (!refresh) {
    return { summary: 'available', events: 'available' };
  }

  if (!refresh.sourceAvailable) {
    return {
      summary: refresh.pendingEvents > 0 ? 'stale' : 'available',
      events: refresh.pendingEvents > 0 ? 'stale' : 'available',
      details: refresh.sourceError
    };
  }

  if (refresh.pendingEvents > 0) {
    return { summary: 'pending', events: 'pending' };
  }

  return { summary: 'available', events: 'available' };
}

export async function registerDashboardRoutes(app: FastifyInstance, store: DemoStore, web3: Web3Adapter): Promise<void> {
  app.get('/dashboard/summary', async () => {
    const refresh = await web3.refreshPendingEvents?.();
    return {
      ...buildDashboardSummary(store.listLoans(), store.listEvents()),
      sourceStatus: determineSourceStatus(refresh)
    };
  });

  app.get('/dashboard/data-sources', async () => {
    return { sources: DASHBOARD_SOURCE_MATRIX };
  });
}
