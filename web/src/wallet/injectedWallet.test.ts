import { describe, expect, it, vi } from 'vitest';
import { connectInjectedWallet, getInjectedProvider, shortenAddress } from './injectedWallet.js';

describe('injected wallet boundary', () => {
  it('reports provider absence without asking for secrets', async () => {
    expect(getInjectedProvider({})).toBeNull();
    await expect(connectInjectedWallet(null)).resolves.toEqual({ status: 'unavailable' });
  });

  it('requests accounts from the injected provider and returns the selected address', async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      expect(method).toBe('eth_requestAccounts');
      return ['0xA11CE00000000000000000000000000000000001'];
    });

    await expect(connectInjectedWallet({ request })).resolves.toEqual({ status: 'connected', address: '0xA11CE00000000000000000000000000000000001' });
    expect(shortenAddress('0xA11CE00000000000000000000000000000000001')).toBe('0xA11C…0001');
  });

  it('handles rejection and malformed accounts with safe messages', async () => {
    await expect(connectInjectedWallet({ request: vi.fn(async () => { throw new Error('User rejected request'); }) })).resolves.toEqual({ status: 'rejected', message: 'User rejected request' });
    await expect(connectInjectedWallet({ request: vi.fn(async () => []) })).resolves.toEqual({ status: 'rejected', message: 'Wallet did not return an account' });
    await expect(connectInjectedWallet({ request: vi.fn(async () => [42]) })).resolves.toEqual({ status: 'rejected', message: 'Wallet did not return an account' });
  });
});
