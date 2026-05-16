export type InjectedEthereumProvider = {
  request(args: { method: 'eth_requestAccounts' | 'eth_accounts'; params?: unknown[] }): Promise<unknown>;
};

export type WalletConnection =
  | { status: 'unavailable' }
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected'; address: string }
  | { status: 'rejected'; message: string };

export function getInjectedProvider(source: { ethereum?: unknown } = globalThis.window as unknown as { ethereum?: unknown }): InjectedEthereumProvider | null {
  const provider = source.ethereum;
  if (typeof provider === 'object' && provider !== null && typeof (provider as InjectedEthereumProvider).request === 'function') {
    return provider as InjectedEthereumProvider;
  }
  return null;
}

export async function connectInjectedWallet(provider: InjectedEthereumProvider | null): Promise<WalletConnection> {
  if (!provider) return { status: 'unavailable' };
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const address = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null;
    if (!address) return { status: 'rejected', message: 'Wallet did not return an account' };
    return { status: 'connected', address };
  } catch (error) {
    return { status: 'rejected', message: error instanceof Error ? error.message : 'Wallet request was rejected' };
  }
}

export function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
