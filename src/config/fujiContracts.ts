import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export const FUJI_CHAIN_ID = 43113 as const;
export const REQUIRED_FUJI_CONTRACT_NAMES = [
  'LoanRegistry',
  'CollateralVault',
  'LoanReceiptNFT',
  'PaymentAttestation',
  'LiquidationEngine'
] as const;

export type FujiContractName = (typeof REQUIRED_FUJI_CONTRACT_NAMES)[number];
export type HexAddress = `0x${string}`;

export type FujiContractEntry = {
  address: HexAddress;
  abiArtifact: string;
};

export type FujiContractsConfig = {
  chainId: typeof FUJI_CHAIN_ID;
  networkName: 'Avalanche Fuji';
  explorerBaseUrl: string;
  contracts: Record<FujiContractName, FujiContractEntry>;
  abiStatus: 'valid';
};

type RawFujiContractsConfig = {
  chainId?: unknown;
  networkName?: unknown;
  explorerBaseUrl?: unknown;
  contracts?: Record<string, { address?: unknown; abiArtifact?: unknown }>;
};

type BroadcastTransaction = {
  contractName?: unknown;
  contractAddress?: unknown;
};

type BroadcastArtifact = {
  transactions?: BroadcastTransaction[];
};

export type FujiContractsConfigResult =
  | { ok: true; config: FujiContractsConfig }
  | { ok: false; errors: string[] };

export type FujiContractsConfigOptions = {
  rootDir?: string;
  configPath?: string;
  broadcastPath?: string;
};

const DEFAULT_CONFIG_PATH = 'config/fuji-contracts.json';
const DEFAULT_BROADCAST_PATH = 'broadcast/Deploy.s.sol/43113/run-latest.json';

export function loadFujiContractsConfig(options: FujiContractsConfigOptions = {}): FujiContractsConfigResult {
  const rootDir = options.rootDir ?? process.cwd();
  const configPath = resolvePath(rootDir, options.configPath ?? DEFAULT_CONFIG_PATH);
  const broadcastPath = resolvePath(rootDir, options.broadcastPath ?? DEFAULT_BROADCAST_PATH);
  const errors: string[] = [];

  const rawConfig = readJson<RawFujiContractsConfig>(configPath, 'Fuji contracts config', errors);
  const rawBroadcast = readJson<BroadcastArtifact>(broadcastPath, 'Fuji broadcast artifact', errors);

  if (!rawConfig) {
    return { ok: false, errors };
  }

  if (rawConfig.chainId !== FUJI_CHAIN_ID) {
    errors.push(`Fuji config chainId must be ${FUJI_CHAIN_ID}`);
  }
  if (rawConfig.networkName !== 'Avalanche Fuji') {
    errors.push('Fuji config networkName must be Avalanche Fuji');
  }
  if (typeof rawConfig.explorerBaseUrl !== 'string' || rawConfig.explorerBaseUrl.length === 0) {
    errors.push('Fuji config explorerBaseUrl is required');
  }
  if (!rawConfig.contracts || typeof rawConfig.contracts !== 'object') {
    errors.push('Fuji config contracts object is required');
  }

  const broadcastAddresses = rawBroadcast ? extractBroadcastAddresses(rawBroadcast) : new Map<FujiContractName, string>();
  const contracts = {} as Record<FujiContractName, FujiContractEntry>;

  for (const contractName of REQUIRED_FUJI_CONTRACT_NAMES) {
    const entry = rawConfig.contracts?.[contractName];
    if (!entry) {
      errors.push(`Missing contract config for ${contractName}`);
      continue;
    }

    if (typeof entry.address !== 'string' || !isHexAddress(entry.address)) {
      errors.push(`Invalid address for ${contractName}`);
    }

    const broadcastAddress = broadcastAddresses.get(contractName);
    if (broadcastAddress && typeof entry.address === 'string' && entry.address.toLowerCase() !== broadcastAddress.toLowerCase()) {
      errors.push(`Broadcast address mismatch for ${contractName}`);
    }

    if (typeof entry.abiArtifact !== 'string' || entry.abiArtifact.length === 0) {
      errors.push(`Missing ABI artifact path for ${contractName}`);
    } else {
      validateAbiArtifact(resolvePath(rootDir, entry.abiArtifact), contractName, errors);
    }

    if (typeof entry.address === 'string' && isHexAddress(entry.address) && typeof entry.abiArtifact === 'string') {
      contracts[contractName] = {
        address: entry.address.toLowerCase() as HexAddress,
        abiArtifact: entry.abiArtifact
      };
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    config: {
      chainId: FUJI_CHAIN_ID,
      networkName: 'Avalanche Fuji',
      explorerBaseUrl: rawConfig.explorerBaseUrl as string,
      contracts,
      abiStatus: 'valid'
    }
  };
}

function resolvePath(rootDir: string, path: string): string {
  return isAbsolute(path) ? path : join(rootDir, path);
}

function readJson<T>(path: string, label: string, errors: string[]): T | null {
  if (!existsSync(path)) {
    errors.push(`${label} is missing`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    errors.push(`${label} is not valid JSON`);
    return null;
  }
}

function extractBroadcastAddresses(artifact: BroadcastArtifact): Map<FujiContractName, string> {
  const addresses = new Map<FujiContractName, string>();
  for (const transaction of artifact.transactions ?? []) {
    if (!isFujiContractName(transaction.contractName) || typeof transaction.contractAddress !== 'string') {
      continue;
    }
    if (!addresses.has(transaction.contractName)) {
      addresses.set(transaction.contractName, transaction.contractAddress);
    }
  }
  return addresses;
}

function validateAbiArtifact(path: string, contractName: FujiContractName, errors: string[]): void {
  if (!existsSync(path)) {
    errors.push(`Missing ABI artifact for ${contractName}`);
    return;
  }

  try {
    const artifact = JSON.parse(readFileSync(path, 'utf8')) as { abi?: unknown };
    if (!Array.isArray(artifact.abi)) {
      errors.push(`ABI artifact for ${contractName} does not contain an abi array`);
    }
  } catch {
    errors.push(`ABI artifact for ${contractName} is not valid JSON`);
  }
}

function isFujiContractName(value: unknown): value is FujiContractName {
  return typeof value === 'string' && REQUIRED_FUJI_CONTRACT_NAMES.includes(value as FujiContractName);
}

function isHexAddress(value: string): value is HexAddress {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
