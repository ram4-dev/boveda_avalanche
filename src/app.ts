import Fastify, { type FastifyInstance } from 'fastify';
import { createMockWavyNodeAdapter, type WavyNodeAdapter } from './adapters/wavyNode.js';
import { createMockWeb3Adapter, type Web3Adapter } from './adapters/web3.js';
import { registerDashboardRoutes } from './modules/dashboard/routes.js';
import { registerEventRoutes } from './modules/events/routes.js';
import { registerHealthRoutes } from './modules/health/routes.js';
import { registerLoanRoutes } from './modules/loans/routes.js';
import { registerPaymentRoutes } from './modules/payments/routes.js';
import { registerQuoteRoutes } from './modules/quotes/routes.js';
import { registerRiskRoutes } from './modules/risk/routes.js';
import { DemoStore } from './store/demoStore.js';
import { loadSeedFileSync } from './store/seedLoader.js';

export type AppDeps = {
  store: DemoStore;
  wavyNode: WavyNodeAdapter;
  web3: Web3Adapter;
};

export function buildFastifyApp(deps: Partial<AppDeps> = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const store = deps.store ?? DemoStore.fromSeed(loadSeedFileSync());
  const wavyNode = deps.wavyNode ?? createMockWavyNodeAdapter();
  const web3 = deps.web3 ?? createMockWeb3Adapter();

  void app.register(registerHealthRoutes);
  void app.register(async (scopedApp) => {
    await registerQuoteRoutes(scopedApp);
    await registerRiskRoutes(scopedApp, store, wavyNode);
    await registerLoanRoutes(scopedApp, store, web3);
    await registerPaymentRoutes(scopedApp, store, web3);
    await registerDashboardRoutes(scopedApp, store, web3);
    await registerEventRoutes(scopedApp, store, web3);
  });

  return app;
}
