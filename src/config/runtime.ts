import { loadFujiContractsConfig, type FujiContractsConfig } from './fujiContracts.js';

export type RuntimeMode = 'demo' | 'fuji';
export type EvidenceSource = 'demo-simulated' | 'fuji-live' | 'fuji-unavailable';
export type RuntimePrerequisites = 'ready' | 'missing' | 'unavailable';

export type RuntimeConfig = {
  mode: RuntimeMode;
  evidenceSource: EvidenceSource;
  prerequisites: RuntimePrerequisites;
  resetEnabled: boolean;
  contracts?: FujiContractsConfig;
  validationErrors?: string[];
};

export type PublicRuntimeMetadata = {
  mode: RuntimeMode;
  evidenceSource: EvidenceSource;
  prerequisites: RuntimePrerequisites;
  chainId: 43113 | null;
  networkName: string | null;
  explorerBaseUrl: string | null;
  contracts: Array<{ name: string; address: string; abiArtifact: string }>;
  abiStatus: 'valid' | 'invalid' | 'not-applicable';
  validationErrors: string[];
};

export function buildDemoRuntimeConfig(): RuntimeConfig {
  return {
    mode: 'demo',
    evidenceSource: 'demo-simulated',
    prerequisites: 'ready',
    resetEnabled: true
  };
}

export function buildFujiRuntimeConfig(options: { prerequisites?: RuntimePrerequisites; contracts?: FujiContractsConfig; validationErrors?: string[] } = {}): RuntimeConfig {
  const prerequisites = options.prerequisites ?? (options.contracts ? 'ready' : 'missing');
  return {
    mode: 'fuji',
    evidenceSource: prerequisites === 'ready' ? 'fuji-live' : 'fuji-unavailable',
    prerequisites,
    resetEnabled: false,
    contracts: options.contracts,
    validationErrors: options.validationErrors ?? []
  };
}

export function parseRuntimeMode(value: string | undefined): RuntimeMode {
  return value === 'fuji' ? 'fuji' : 'demo';
}

export function loadRuntimeConfig(options: { mode?: RuntimeMode; env?: NodeJS.ProcessEnv } = {}): RuntimeConfig {
  const mode = options.mode ?? 'demo';
  if (mode === 'demo') {
    return buildDemoRuntimeConfig();
  }

  const contracts = loadFujiContractsConfig();
  if (!contracts.ok) {
    return buildFujiRuntimeConfig({ prerequisites: 'missing', validationErrors: contracts.errors });
  }

  const env = options.env ?? process.env;
  const prerequisites = hasFujiWriteRuntimePrerequisites(env) ? 'ready' : 'missing';
  return buildFujiRuntimeConfig({ prerequisites, contracts: contracts.config });
}

export function hasFujiWriteRuntimePrerequisites(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.BOVEDA_FUJI_ATTESTOR_PRIVATE_KEY &&
    env.BOVEDA_FUJI_BORROWER_PRIVATE_KEY &&
    env.BOVEDA_FUJI_ORIGINATOR_PRIVATE_KEY &&
    env.BOVEDA_FUJI_FUNDING_PARTNER_ADDRESS
  );
}

export function toPublicRuntimeMetadata(runtime: RuntimeConfig): PublicRuntimeMetadata {
  return {
    mode: runtime.mode,
    evidenceSource: runtime.evidenceSource,
    prerequisites: runtime.prerequisites,
    chainId: runtime.contracts?.chainId ?? null,
    networkName: runtime.contracts?.networkName ?? null,
    explorerBaseUrl: runtime.contracts?.explorerBaseUrl ?? null,
    contracts: runtime.contracts
      ? Object.entries(runtime.contracts.contracts).map(([name, contract]) => ({
          name,
          address: contract.address,
          abiArtifact: contract.abiArtifact
        }))
      : [],
    abiStatus: runtime.mode === 'demo' ? 'not-applicable' : runtime.contracts?.abiStatus ?? 'invalid',
    validationErrors: runtime.validationErrors ?? []
  };
}
