import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';
import { checkFujiReadOnlyConnection, type FujiReadOnlyStatus } from '../src/config/fujiReadOnly.js';
import { FUJI_CHAIN_ID, REQUIRED_FUJI_CONTRACT_NAMES, type FujiContractsConfig } from '../src/config/fujiContracts.js';
import { buildFujiRuntimeConfig } from '../src/config/runtime.js';

const contracts = Object.fromEntries(
  REQUIRED_FUJI_CONTRACT_NAMES.map((name, index) => [
    name,
    {
      address: `0x${String(index + 1).repeat(40)}` as `0x${string}`,
      abiArtifact: `out/${name}.sol/${name}.json`
    }
  ])
) as FujiContractsConfig['contracts'];

const config: FujiContractsConfig = {
  chainId: FUJI_CHAIN_ID,
  networkName: 'Avalanche Fuji',
  explorerBaseUrl: 'https://testnet.snowtrace.io',
  contracts,
  abiStatus: 'valid'
};

const okStatus: FujiReadOnlyStatus = {
  ok: true,
  mode: 'fuji',
  rpcUrlSource: 'test',
  chainId: FUJI_CHAIN_ID,
  expectedChainId: FUJI_CHAIN_ID,
  contracts: REQUIRED_FUJI_CONTRACT_NAMES.map((name) => ({ name, address: config.contracts[name].address, bytecodePresent: true, bytecodeBytes: 42 })),
  errors: []
};

describe('Fuji read-only contract smoke', () => {
  it('checks Fuji chain id and bytecode without exposing RPC URLs', async () => {
    const status = await checkFujiReadOnlyConnection(config, {
      rpcUrlSource: 'test',
      requestJsonRpc: async (method) => {
        if (method === 'eth_chainId') return '0xa869';
        if (method === 'eth_getCode') return '0x6001600055';
        throw new Error(`unexpected method ${method}`);
      }
    });

    expect(status).toMatchObject({ ok: true, mode: 'fuji', rpcUrlSource: 'test', chainId: 43113, expectedChainId: 43113, errors: [] });
    expect(status).not.toHaveProperty('rpcUrl');
    expect(status.contracts).toHaveLength(REQUIRED_FUJI_CONTRACT_NAMES.length);
    expect(status.contracts.every((contract) => contract.bytecodePresent)).toBe(true);
  });

  it('reports unsafe read-only status when chain id or bytecode checks fail', async () => {
    const status = await checkFujiReadOnlyConnection(config, {
      rpcUrlSource: 'test',
      requestJsonRpc: async (method) => method === 'eth_chainId' ? '0x1' : '0x'
    });

    expect(status.ok).toBe(false);
    expect(status.errors.join('\n')).toContain('chainId mismatch');
    expect(status.errors.join('\n')).toContain('has no bytecode');
  });

  it('exposes a Fuji-only smoke endpoint for local browser E2E checks', async () => {
    const app = buildFastifyApp({
      runtime: buildFujiRuntimeConfig({ prerequisites: 'missing', contracts: config }),
      fujiReadOnlyChecker: async () => okStatus
    });

    const response = await app.inject({ method: 'GET', url: '/runtime/fuji-smoke' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, mode: 'fuji', chainId: 43113 });
  });

  it('does not register the Fuji smoke endpoint in demo mode', async () => {
    const app = buildFastifyApp();
    const response = await app.inject({ method: 'GET', url: '/runtime/fuji-smoke' });
    expect(response.statusCode).toBe(404);
  });
});
