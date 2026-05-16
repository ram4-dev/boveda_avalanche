import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadFujiContractsConfig } from '../src/config/fujiContracts.js';
import { loadRuntimeConfig, parseRuntimeMode } from '../src/config/runtime.js';

const expectedAddresses = {
  LoanRegistry: '0xb6832e4c43e97d5ad11e99abcb23d9a734a4be14',
  CollateralVault: '0xe550a10f585e5595ae187f08a701bdef890de057',
  LoanReceiptNFT: '0xf88b6e8c107a0a5da6f398734783541cbe12a38c',
  PaymentAttestation: '0xa222a02e828d5480be971b80d4157f2abe1fabda',
  LiquidationEngine: '0x212f6565319caa343c8c39e9b11a447febf2055a'
} as const;

describe('Fuji contract runtime config', () => {
  it('parses runtime mode flags without exposing secrets', () => {
    expect(parseRuntimeMode('fuji')).toBe('fuji');
    expect(parseRuntimeMode('demo')).toBe('demo');
    expect(parseRuntimeMode(undefined)).toBe('demo');
  });

  it('loads Fuji runtime config from public contract artifacts when explicitly requested', () => {
    const runtime = loadRuntimeConfig({ mode: 'fuji' });

    expect(runtime.mode).toBe('fuji');
    expect(runtime.contracts?.contracts.LoanRegistry.address).toBe(expectedAddresses.LoanRegistry);
    expect(runtime.evidenceSource).toBe('fuji-unavailable');
  });

  it('loads the broadcast-authoritative Fuji addresses and ABI artifacts', () => {
    const result = loadFujiContractsConfig();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.join('\n'));

    expect(result.config.chainId).toBe(43113);
    expect(result.config.networkName).toBe('Avalanche Fuji');
    expect(Object.fromEntries(Object.entries(result.config.contracts).map(([name, contract]) => [name, contract.address]))).toMatchObject(expectedAddresses);
    expect(result.config.abiStatus).toBe('valid');
  });

  it('returns safe validation errors for invalid addresses, missing ABI artifacts, and broadcast mismatches', () => {
    const root = mkdtempSync(join(tmpdir(), 'boveda-runtime-config-'));
    const abiDir = join(root, 'out', 'LoanRegistry.sol');
    mkdirSync(abiDir, { recursive: true });
    writeFileSync(join(abiDir, 'LoanRegistry.json'), JSON.stringify({ abi: [] }));

    const broadcastPath = join(root, 'broadcast.json');
    writeFileSync(
      broadcastPath,
      JSON.stringify({
        transactions: [{ contractName: 'LoanRegistry', contractAddress: expectedAddresses.LoanRegistry }]
      })
    );

    const configPath = join(root, 'fuji-contracts.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        chainId: 43113,
        networkName: 'Avalanche Fuji',
        explorerBaseUrl: 'https://testnet.snowtrace.io',
        contracts: {
          LoanRegistry: {
            address: 'not-an-address',
            abiArtifact: 'out/LoanRegistry.sol/LoanRegistry.json'
          },
          CollateralVault: {
            address: expectedAddresses.CollateralVault,
            abiArtifact: 'out/Missing.sol/Missing.json'
          },
          LoanReceiptNFT: {
            address: expectedAddresses.LoanReceiptNFT,
            abiArtifact: 'out/Missing.sol/Missing.json'
          },
          PaymentAttestation: {
            address: expectedAddresses.PaymentAttestation,
            abiArtifact: 'out/Missing.sol/Missing.json'
          },
          LiquidationEngine: {
            address: expectedAddresses.LiquidationEngine,
            abiArtifact: 'out/Missing.sol/Missing.json'
          }
        }
      })
    );

    const result = loadFujiContractsConfig({ configPath, broadcastPath, rootDir: root });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected config validation to fail');
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Invalid address for LoanRegistry'),
        expect.stringContaining('Broadcast address mismatch for LoanRegistry'),
        expect.stringContaining('Missing ABI artifact for CollateralVault')
      ])
    );
    expect(result.errors.join(' ')).not.toContain(process.cwd());
  });
});
