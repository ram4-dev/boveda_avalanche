import Fastify, { type FastifyInstance } from 'fastify';
import { createMockWavyNodeAdapter, type WavyNodeAdapter } from './adapters/wavyNode.js';
import { createMockWeb3Adapter, createUnavailableWeb3Adapter, type Web3Adapter } from './adapters/web3.js';
import { DEFAULT_FUJI_RPC_URL, checkFujiReadOnlyConnection, createFetchJsonRpcRequester, type FujiReadOnlyStatus } from './config/fujiReadOnly.js';
import { buildDemoRuntimeConfig, toPublicRuntimeMetadata, type RuntimeConfig } from './config/runtime.js';
import { registerDashboardRoutes } from './modules/dashboard/routes.js';
import { registerEventRoutes } from './modules/events/routes.js';
import { registerHealthRoutes } from './modules/health/routes.js';
import { registerLoanRoutes } from './modules/loans/routes.js';
import { registerPaymentRoutes } from './modules/payments/routes.js';
import { registerQuoteRoutes } from './modules/quotes/routes.js';
import { registerRiskRoutes } from './modules/risk/routes.js';
import type { SeedFile } from './domain/types.js';
import { DemoStore } from './store/demoStore.js';
import { DEFAULT_SEED_SOURCE_PATH, loadSeedFileSync } from './store/seedLoader.js';

export type AppDeps = {
  store: DemoStore;
  wavyNode: WavyNodeAdapter;
  web3: Web3Adapter;
  runtime: RuntimeConfig;
  seed: SeedFile;
  seedSourcePath: string;
  fujiReadOnlyChecker: () => Promise<FujiReadOnlyStatus>;
};

export function buildFastifyApp(deps: Partial<AppDeps> = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const seedSourcePath = deps.seedSourcePath ?? DEFAULT_SEED_SOURCE_PATH;
  const seed = deps.seed ?? loadSeedFileSync();
  const store = deps.store ?? DemoStore.fromSeed(seed);
  const wavyNode = deps.wavyNode ?? createMockWavyNodeAdapter();
  const runtime = deps.runtime ?? buildDemoRuntimeConfig();
  const web3 = deps.web3 ?? createDefaultWeb3Adapter(runtime);
  const fujiReadOnlyChecker = deps.fujiReadOnlyChecker ?? createDefaultFujiReadOnlyChecker(runtime);

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-boveda-runtime-mode', runtime.mode);
    reply.header('x-boveda-evidence-source', web3.evidenceSource ?? runtime.evidenceSource);
    return payload;
  });

  void app.register(registerHealthRoutes);
  app.get('/runtime', async () => toPublicRuntimeMetadata({
    ...runtime,
    evidenceSource: web3.evidenceSource ?? runtime.evidenceSource
  }));

  if (runtime.mode === 'fuji') {
    app.get('/runtime/fuji-smoke', async () => fujiReadOnlyChecker());
  }

  if (runtime.mode === 'demo' && runtime.resetEnabled) {
    app.post('/demo/reset', async () => {
      store.reset(seed);
      return buildDemoResetResponse({
        mode: 'demo',
        seedSourcePath,
        loanCount: store.listLoans().length,
        eventCount: store.listEvents().length
      });
    });
  }
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

function buildDemoResetResponse(input: { mode: 'demo'; seedSourcePath: string; loanCount: number; eventCount: number }) {
  return {
    mode: input.mode,
    resetAt: new Date().toISOString(),
    seedSourcePath: input.seedSourcePath,
    loanCount: input.loanCount,
    eventCount: input.eventCount,
    evidenceSource: 'demo-simulated' as const,
    label: 'Simulated demo evidence'
  };
}

function createDefaultFujiReadOnlyChecker(runtime: RuntimeConfig): () => Promise<FujiReadOnlyStatus> {
  const rpcUrl = process.env.BOVEDA_FUJI_RPC_URL ?? DEFAULT_FUJI_RPC_URL;
  const rpcUrlSource = process.env.BOVEDA_FUJI_RPC_URL ? 'env:BOVEDA_FUJI_RPC_URL' as const : 'default-public' as const;
  return () => checkFujiReadOnlyConnection(runtime.contracts, {
    rpcUrlSource,
    requestJsonRpc: createFetchJsonRpcRequester(rpcUrl)
  });
}

function createDefaultWeb3Adapter(runtime: RuntimeConfig): Web3Adapter {
  if (runtime.mode === 'demo') {
    return createMockWeb3Adapter();
  }

  if (runtime.prerequisites === 'ready') {
    return createUnavailableWeb3Adapter('Fuji signing adapter is not configured in this batch slice');
  }

  return createUnavailableWeb3Adapter(`${runtime.prerequisites} runtime prerequisites`);
}
