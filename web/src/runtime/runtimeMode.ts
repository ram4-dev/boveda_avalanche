export type RuntimeMode = 'demo' | 'fuji';
export type EvidenceSource = 'demo-simulated' | 'fuji-live' | 'fuji-unavailable';

export type RuntimeRoute = {
  mode: RuntimeMode;
  pathPrefix: '/' | '/demo';
};

export type RuntimeMetadata = {
  mode: RuntimeMode;
  evidenceSource: EvidenceSource;
  prerequisites: 'ready' | 'missing' | 'unavailable';
  chainId?: number | null;
  networkName?: string | null;
  explorerBaseUrl?: string | null;
};

export type FujiReadOnlyStatus = {
  ok: boolean;
  mode: 'fuji';
  rpcUrlSource: 'default-public' | 'env:BOVEDA_FUJI_RPC_URL' | 'test';
  chainId: number | null;
  expectedChainId: 43113;
  contracts: Array<{ name: string; address: string; bytecodePresent: boolean; bytecodeBytes: number }>;
  errors: string[];
};

export function resolveRuntimeRoute(pathname = '/'): RuntimeRoute {
  return pathname === '/demo' || pathname.startsWith('/demo/')
    ? { mode: 'demo', pathPrefix: '/demo' }
    : { mode: 'fuji', pathPrefix: '/' };
}

export function runtimeModeLabel(input: { routeMode: RuntimeMode; evidenceSource?: EvidenceSource; fujiReadOnlyOk?: boolean }): string {
  if (!input.evidenceSource) {
    return input.routeMode === 'demo'
      ? 'Demo mode — verifying simulated API runtime.'
      : 'Fuji mode — verifying API runtime evidence.';
  }

  if (input.routeMode === 'demo') {
    return 'Demo mode — simulated evidence only; no live Fuji finality.';
  }

  if (input.evidenceSource === 'fuji-unavailable') {
    return input.fujiReadOnlyOk
      ? 'Fuji contracts reachable (read-only) — write adapter pending. Use /demo for deterministic simulated evidence.'
      : 'Fuji mode unavailable — live chain evidence pending. Use /demo for deterministic simulated evidence.';
  }

  return 'Fuji live mode — Avalanche Fuji evidence enabled';
}

export function runtimeModeMismatch(routeMode: RuntimeMode, metadata: RuntimeMetadata | null): string | null {
  if (!metadata || metadata.mode === routeMode) {
    return null;
  }
  return `Route expects ${routeMode} mode but API reports ${metadata.mode} mode. Check Vite API base URL configuration before presenting evidence.`;
}

export function isFujiReadOnlyStatus(value: unknown): value is FujiReadOnlyStatus {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<FujiReadOnlyStatus>;
  return candidate.mode === 'fuji'
    && typeof candidate.ok === 'boolean'
    && (typeof candidate.chainId === 'number' || candidate.chainId === null)
    && candidate.expectedChainId === 43113
    && Array.isArray(candidate.contracts)
    && Array.isArray(candidate.errors);
}

export function isRuntimeMetadata(value: unknown): value is RuntimeMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<RuntimeMetadata>;
  return (candidate.mode === 'demo' || candidate.mode === 'fuji')
    && (candidate.evidenceSource === 'demo-simulated' || candidate.evidenceSource === 'fuji-live' || candidate.evidenceSource === 'fuji-unavailable');
}
