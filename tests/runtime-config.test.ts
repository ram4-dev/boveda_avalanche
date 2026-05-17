import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadFujiContractsConfig } from '../src/config/fujiContracts.js';
import { loadRuntimeConfig, parseRuntimeMode } from '../src/config/runtime.js';

const expectedAddresses = {
  LoanRegistry: '0x75ebfec02dae1e0cd631c2d4961c5ee1849d4fd3',
  CollateralVault: '0x45e96820551466861d20f081ab390caa9368f68b',
  LoanReceiptNFT: '0x03abd300629808fa9763ddb820469b2fc065e64f',
  PaymentAttestation: '0x3ddc450c16231807d63f560c01455808ce130b0e',
  LiquidationEngine: '0xe29eaebcc8d90b18bd13afedbf5cef274f3a58c4'
} as const;

describe('Fuji contract runtime config', () => {
  it('parses runtime mode flags without exposing secrets', () => {
    expect(parseRuntimeMode('fuji')).toBe('fuji');
    expect(parseRuntimeMode('demo')).toBe('demo');
    expect(parseRuntimeMode(undefined)).toBe('demo');
  });

  it('loads Fuji runtime config from public contract artifacts when explicitly requested', () => {
    const runtime = loadRuntimeConfig({ mode: 'fuji', env: {} });

    expect(runtime.mode).toBe('fuji');
    expect(runtime.contracts?.contracts.LoanRegistry.address).toBe(expectedAddresses.LoanRegistry);
    expect(runtime.evidenceSource).toBe('fuji-unavailable');
  });

  it('marks Fuji runtime ready only when operator signing prerequisites are provided', () => {
    const runtime = loadRuntimeConfig({
      mode: 'fuji',
      env: {
        BOVEDA_FUJI_ATTESTOR_PRIVATE_KEY: 'present',
        BOVEDA_FUJI_BORROWER_PRIVATE_KEY: 'present',
        BOVEDA_FUJI_ORIGINATOR_PRIVATE_KEY: 'present',
        BOVEDA_FUJI_FUNDING_PARTNER_ADDRESS: '0x1111111111111111111111111111111111111111'
      }
    });

    expect(runtime.prerequisites).toBe('ready');
    expect(runtime.evidenceSource).toBe('fuji-live');
    expect(runtime.validationErrors).toEqual([]);
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
