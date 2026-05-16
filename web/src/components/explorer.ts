export type ExplorerTarget = 'address' | 'tx';

const CHAIN_EXPLORER_BASE: Record<number, string> = {
  43113: 'https://testnet.snowtrace.io'
};

export function buildExplorerUrl(target: ExplorerTarget, chainId: number, value: string): string {
  const base = CHAIN_EXPLORER_BASE[chainId] ?? 'https://testnet.snowtrace.io';
  const normalized = value.startsWith('0x') ? value : value;
  return `${base}/${target}/${normalized}`;
}

export function buildExplorerAddressLink(chainId: number, address: string): string {
  return buildExplorerUrl('address', chainId, address);
}

export function buildExplorerTxLink(chainId: number, txHash: string): string {
  return buildExplorerUrl('tx', chainId, txHash);
}
