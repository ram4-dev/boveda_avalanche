import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFastifyApp } from '../src/app.js';
import { createMockWeb3Adapter } from '../src/adapters/web3.js';
import { buildFujiRuntimeConfig } from '../src/config/runtime.js';
import { loadFujiContractsConfig } from '../src/config/fujiContracts.js';

function loadFujiContractsForTest() {
  const result = loadFujiContractsConfig();
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.config;
}

describe('Fuji USDC balance polling endpoint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads USDC balances for requested wallets through Fuji RPC', async () => {
    const rpc = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string };
      expect(body.method).toBe('eth_call');
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0xe4e1c0' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', rpc);

    const app = buildFastifyApp({
      runtime: buildFujiRuntimeConfig({ prerequisites: 'ready', contracts: loadFujiContractsForTest() }),
      web3: createMockWeb3Adapter()
    });

    const response = await app.inject({
      method: 'GET',
      url: '/runtime/fuji-usdc-balances?tokenAddress=0x5425890298aed601595a70AB815c96711a31Bc65&addresses=0x6f981Bf8d4fA751db294Bb62dDEB3d904514F2CF'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      mode: 'fuji',
      token: { symbol: 'USDC', decimals: 6 },
      balances: [
        {
          address: '0x6f981bf8d4fa751db294bb62ddeb3d904514f2cf',
          amountBaseUnits: '15000000',
          formatted: '15'
        }
      ]
    });
  });
});
