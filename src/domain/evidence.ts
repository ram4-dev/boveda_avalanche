export type EvidenceMode = 'demo' | 'fuji';
export type EvidenceSource = 'demo-simulated' | 'fuji-live' | 'fuji-unavailable';
export type EvidenceStatus = 'simulated' | 'confirmed' | 'pending' | 'unavailable';

export type ContractReference = {
  name: string;
  address: string;
};

export type EvidenceMetadata = {
  mode: EvidenceMode;
  source: EvidenceSource;
  status: EvidenceStatus;
  label: string;
  txHash?: `0x${string}`;
  blockNumber?: number | null;
  explorerUrl?: string | null;
  contracts?: ContractReference[];
};

type EvidenceOptions = {
  txHash?: `0x${string}`;
  blockNumber?: number | null;
  contracts?: ContractReference[];
};

export function buildEvidenceMetadata(source: EvidenceSource, options: EvidenceOptions = {}): EvidenceMetadata {
  const mode: EvidenceMode = source === 'demo-simulated' ? 'demo' : 'fuji';
  const status: EvidenceStatus = source === 'demo-simulated'
    ? 'simulated'
    : source === 'fuji-live'
      ? 'confirmed'
      : 'unavailable';

  return {
    mode,
    source,
    status,
    label: source === 'demo-simulated'
      ? 'Simulated demo evidence'
      : source === 'fuji-live'
        ? 'Fuji live evidence'
        : 'Fuji evidence pending/unavailable',
    txHash: options.txHash,
    blockNumber: options.blockNumber ?? null,
    explorerUrl: null,
    contracts: options.contracts ?? []
  };
}

export function buildVaultContractReference(vaultAddress?: string | null): ContractReference[] {
  if (!vaultAddress) {
    return [];
  }

  return [{ name: 'CollateralVault', address: vaultAddress }];
}

export function buildLoanEvidenceMetadata(
  source: EvidenceSource,
  options: Omit<EvidenceOptions, 'contracts'> & { vaultAddress?: string | null }
): EvidenceMetadata {
  return buildEvidenceMetadata(source, {
    txHash: options.txHash,
    blockNumber: options.blockNumber,
    contracts: buildVaultContractReference(options.vaultAddress)
  });
}
