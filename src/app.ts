import Fastify, { type FastifyInstance } from 'fastify';
import { registerEventRoutes } from './modules/events/routes.js';
import { registerHealthRoutes } from './modules/health/routes.js';
import { registerLoanRoutes } from './modules/loans/routes.js';
import { DemoStore } from './store/demoStore.js';
import { loadSeedFileSync } from './store/seedLoader.js';

export type AppDeps = {
  store: DemoStore;
};

export function buildFastifyApp(deps: Partial<AppDeps> = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const store = deps.store ?? DemoStore.fromSeed(loadSeedFileSync());

  void app.register(registerHealthRoutes);
  void app.register(async (scopedApp) => {
    await registerLoanRoutes(scopedApp, store);
    await registerEventRoutes(scopedApp, store);
  });

  return app;
}
