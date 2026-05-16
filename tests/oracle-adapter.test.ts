import { describe, expect, it } from 'vitest';
import { createControlledOracleAdapter } from '../src/adapters/oracle.js';

const now = new Date('2026-06-20T12:00:00.000Z');

describe('controlled oracle adapter', () => {
  it('returns normalized price payload for supported tokens', () => {
    const oracle = createControlledOracleAdapter({
      now: () => now,
      maxPriceAgeSeconds: 300,
      prices: {
        AVAX: { priceUsd: '35.5', asOf: '2026-06-20T11:59:00.000Z' }
      }
    });

    expect(oracle.getNormalizedPrice('avax')).toEqual({
      token: 'AVAX',
      priceUsd: '35.5',
      asOf: '2026-06-20T11:59:00.000Z',
      ageSeconds: 60,
      source: 'CONTROLLED_DEMO_ADAPTER'
    });
  });

  it('computes LTV bps for existing loan principal/collateral fields', () => {
    const oracle = createControlledOracleAdapter({
      now: () => now,
      prices: {
        AVAX: { priceUsd: '40', asOf: '2026-06-20T11:59:30.000Z' }
      }
    });

    const ltvBps = oracle.computeLoanLtvBps({
      principal: { amount: '1000', currency: 'USD', fiatRail: 'WIRE_SIMULATED' },
      collateral: { token: 'AVAX', chainId: 43113, amount: '50', valueUsd: '0' }
    });

    expect(ltvBps).toBe(5000);
  });

  it('rejects zero, negative, stale, and future prices', () => {
    const staleOracle = createControlledOracleAdapter({
      now: () => now,
      maxPriceAgeSeconds: 300,
      prices: {
        AVAX: { priceUsd: '30', asOf: '2026-06-20T11:50:00.000Z' }
      }
    });
    expect(() => staleOracle.getNormalizedPrice('AVAX')).toThrow(/stale/i);

    const zeroOracle = createControlledOracleAdapter({
      now: () => now,
      prices: {
        AVAX: { priceUsd: '0', asOf: '2026-06-20T11:59:59.000Z' }
      }
    });
    expect(() => zeroOracle.getNormalizedPrice('AVAX')).toThrow(/positive/i);

    const negativeOracle = createControlledOracleAdapter({
      now: () => now,
      prices: {
        AVAX: { priceUsd: '-1', asOf: '2026-06-20T11:59:59.000Z' }
      }
    });
    expect(() => negativeOracle.getNormalizedPrice('AVAX')).toThrow(/positive/i);

    const futureOracle = createControlledOracleAdapter({
      now: () => now,
      prices: {
        AVAX: { priceUsd: '30', asOf: '2026-06-20T12:00:01.000Z' }
      }
    });
    expect(() => futureOracle.getNormalizedPrice('AVAX')).toThrow(/future/i);
  });

  it('rejects unsupported collateral tokens', () => {
    const oracle = createControlledOracleAdapter({
      now: () => now,
      prices: {
        AVAX: { priceUsd: '40', asOf: '2026-06-20T11:59:30.000Z' }
      }
    });

    expect(() => oracle.getNormalizedPrice('BTC')).toThrow(/unsupported token/i);
  });
});
