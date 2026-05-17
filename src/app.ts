import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { createMockWavyNodeAdapter, type WavyNodeAdapter } from './adapters/wavyNode.js';
import { createFujiWeb3Adapter, createMockWeb3Adapter, createUnavailableWeb3Adapter, type FujiSignerConfig, type Web3Adapter } from './adapters/web3.js';
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

type FujiUsdcBalancesQuery = {
  tokenAddress?: string;
  addresses?: string;
};

export function buildFastifyApp(deps: Partial<AppDeps> = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const seedSourcePath = deps.seedSourcePath ?? DEFAULT_SEED_SOURCE_PATH;
  const seed = deps.seed ?? loadSeedFileSync(seedSourcePath);
  const loadCurrentSeed = () => deps.seed ?? loadSeedFileSync(seedSourcePath);
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
    app.get('/runtime/fuji-usdc-balances', async (request: FastifyRequest<{ Querystring: FujiUsdcBalancesQuery }>, reply) => {
      const tokenAddress = normalizeAddress(request.query.tokenAddress);
      const addresses = parseAddressList(request.query.addresses);
      if (!tokenAddress) {
        return reply.status(400).send({ error: { code: 'INVALID_REQUEST', message: 'tokenAddress must be a 0x address' } });
      }
      if (addresses.length === 0) {
        return reply.status(400).send({ error: { code: 'INVALID_REQUEST', message: 'addresses must include at least one 0x address' } });
      }

      const requestJsonRpc = createFetchJsonRpcRequester(process.env.BOVEDA_FUJI_RPC_URL ?? DEFAULT_FUJI_RPC_URL);
      try {
        const balances = await Promise.all(addresses.map(async (address) => {
          const amountBaseUnits = await readErc20Balance(requestJsonRpc, tokenAddress, address);
          return {
            address,
            amountBaseUnits,
            formatted: formatBaseUnits(amountBaseUnits, 6)
          };
        }));
        return {
          mode: 'fuji',
          evidenceSource: web3.evidenceSource ?? runtime.evidenceSource,
          chainId: runtime.contracts?.chainId ?? 43113,
          token: { symbol: 'USDC', address: tokenAddress, decimals: 6 },
          balances,
          updatedAt: new Date().toISOString()
        };
      } catch {
        return reply.status(503).send({ error: { code: 'WEB3_UNAVAILABLE', message: 'Fuji USDC balance polling is unavailable' } });
      }
    });
  }

  if (runtime.mode === 'demo' && runtime.resetEnabled) {
    app.post('/demo/reset', async () => {
      store.reset(loadCurrentSeed());
      return buildDemoResetResponse({
        mode: 'demo',
        seedSourcePath,
        loanCount: store.listLoans().length,
        eventCount: store.listEvents().length
      });
    });
  }

  // Available in all modes: releases active on-chain vaults (fuji-live) then resets the in-memory store.
  app.post('/demo/release-and-reset', async () => {
    const activeWithVault = store.listLoans().filter(
      (loan) => (loan.status === 'Active' || loan.status === 'MarginCall') && loan.onChainLoanId
    );
    const releases: Array<{ loanId: string; onChainLoanId: string | null; txHash: string | null; noop: boolean }> = [];
    for (const loan of activeWithVault) {
      if (web3.releaseVaultForReset) {
        try {
          const result = await web3.releaseVaultForReset(loan);
          releases.push({ loanId: loan.loanId, onChainLoanId: loan.onChainLoanId ?? null, txHash: result.txHash, noop: result.noop });
        } catch (error) {
          releases.push({ loanId: loan.loanId, onChainLoanId: loan.onChainLoanId ?? null, txHash: null, noop: false });
          app.log.error({ err: error, loanId: loan.loanId }, 'release-and-reset: vault release failed, continuing with store reset');
        }
      }
    }
    store.reset(loadCurrentSeed());
    return {
      mode: runtime.mode,
      evidenceSource: web3.evidenceSource ?? 'demo-simulated',
      releases,
      seedSourcePath,
      loanCount: store.listLoans().length,
      eventCount: store.listEvents().length,
      resetAt: new Date().toISOString()
    };
  });
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

function parseAddressList(value: string | undefined): string[] {
  return [...new Set((value ?? '').split(',').map((entry) => normalizeAddress(entry)).filter((entry): entry is string => Boolean(entry)))].slice(0, 10);
}

function normalizeAddress(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && /^0x[a-fA-F0-9]{40}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

async function readErc20Balance(requestJsonRpc: (method: string, params: unknown[]) => Promise<unknown>, tokenAddress: string, ownerAddress: string): Promise<string> {
  const owner = ownerAddress.slice(2).padStart(64, '0');
  const result = await requestJsonRpc('eth_call', [{ to: tokenAddress, data: `0x70a08231${owner}` }, 'latest']);
  if (typeof result !== 'string' || !/^0x[a-fA-F0-9]+$/.test(result)) {
    throw new Error('Invalid balanceOf result');
  }
  return BigInt(result).toString();
}

function formatBaseUnits(value: string, decimals: number): string {
  const amount = BigInt(value);
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = amount % base;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
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

  if (runtime.prerequisites !== 'ready' || !runtime.contracts) {
    return createUnavailableWeb3Adapter(`${runtime.prerequisites} runtime prerequisites`);
  }

  const signerConfig = loadFujiSignerConfigFromRuntime();
  return createFujiWeb3Adapter({
    runtimeContracts: runtime.contracts,
    rpcUrl: process.env.BOVEDA_FUJI_RPC_URL ?? DEFAULT_FUJI_RPC_URL,
    signerConfig
  });
}

function loadFujiSignerConfigFromRuntime(): FujiSignerConfig {
  return {
    attestorPrivateKey: process.env.BOVEDA_FUJI_ATTESTOR_PRIVATE_KEY,
    borrowerPrivateKey: process.env.BOVEDA_FUJI_BORROWER_PRIVATE_KEY,
    originatorPrivateKey: process.env.BOVEDA_FUJI_ORIGINATOR_PRIVATE_KEY,
    fundingPartnerAddress: process.env.BOVEDA_FUJI_FUNDING_PARTNER_ADDRESS as FujiSignerConfig['fundingPartnerAddress']
  };
}
