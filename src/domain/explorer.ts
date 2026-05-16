export const CANONICAL_EXPLORER_BASE: Record<number, string> = {
  43113: 'https://testnet.snowtrace.io',
  43114: 'https://snowtrace.io'
};

export type ExplorerTarget = 'address' | 'tx';

export function buildExplorerUrl(target: ExplorerTarget, chainId: number, value: string): string {
  const base = CANONICAL_EXPLORER_BASE[chainId] ?? CANONICAL_EXPLORER_BASE[43113];
  return `${base}/${target}/${value}`;
}

export function buildExplorerTxLink(chainId: number, txHash: string): string {
  return buildExplorerUrl('tx', chainId, txHash);
}

export function buildExplorerAddressLink(chainId: number, address: string): string {
  return buildExplorerUrl('address', chainId, address);
}
