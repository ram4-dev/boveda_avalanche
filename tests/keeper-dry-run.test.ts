import { describe, expect, it } from 'vitest';
import { createControlledOracleAdapter } from '../src/adapters/oracle.js';
import { evaluateKeeperDryRun } from '../src/keeper/dryRun.js';
import type { Loan } from '../src/domain/types.js';

const now = new Date('2026-06-20T12:00:00.000Z');

function buildLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    loanId: 'loan-keeper-001',
    scenario: 'WEB3_BRIDGE',
    status: 'Active',
    borrower: {
      borrowerId: 'borrower-1',
      displayName: 'Borrower',
      borrowerType: 'WEB3_STARTUP',
      walletAddress: '0xB0R'
    },
    originator: {
      originatorId: 'originator-1',
      displayName: 'Originator',
      originatorType: 'VC_FUND'
    },
    fundingPartner: {
      fundingPartnerId: 'funding-1',
      displayName: 'Funding'
    },
    principal: {
      amount: '1000',
      currency: 'USD',
      fiatRail: 'WIRE_SIMULATED',
      disbursementRef: null
    },
    collateral: {
      token: 'AVAX',
      chainId: 43113,
      amount: '100',
      valueUsd: '0',
      vaultAddress: '0xvault',
      depositTxHash: '0xdeposit'
    },
    terms: {
      initialLtvBps: 5000,
      marginCallLtvBps: 7000,
      liquidationLtvBps: 8000,
      aprBps: 1000,
      tenorDays: 90,
      repaymentFrequency: 'MONTHLY',
      liquidationCurrency: 'USDC'
    },
    riskAssessment: {
      riskAssessmentId: 'risk-1',
      provider: 'WAVY_NODE_MOCK',
      riskScore: 720,
      amlStatus: 'PASS',
      maxLtvBps: 7500,
      assessmentHash: '0xrisk',
      expiresAt: '2026-06-21T00:00:00.000Z'
    },
    receipt: null,
    currentMetrics: {
      currentLtvBps: 5000,
      outstandingPrincipal: '1000',
      outstandingCurrency: 'USD',
      nextPaymentDueAt: null
    },
    liquidationPreview: {
      proceedsAmount: '1000',
      proceedsCurrency: 'USDC',
      distribution: {
        fundingPartnerAmount: '900',
        originatorFeeAmount: '50',
        borrowerRemainderAmount: '50'
      }
    },
    ...overrides
  };
}

describe('keeper dry-run evaluator', () => {
  it('marks healthy active loans as noop below margin-call threshold', () => {
    const oracle = createControlledOracleAdapter({
      now: () => now,
      prices: {
        AVAX: { priceUsd: '20', asOf: '2026-06-20T11:59:30.000Z' }
      }
    });

    const [result] = evaluateKeeperDryRun([buildLoan()], oracle);
    expect(result.decision).toBe('NOOP_HEALTHY');
    expect(result.computedLtvBps).toBe(5000);
  });

  it('plans margin call for active loans at or above margin threshold and below liquidation threshold', () => {
    const oracle = createControlledOracleAdapter({
      now: () => now,
      prices: {
        AVAX: { priceUsd: '14', asOf: '2026-06-20T11:59:30.000Z' }
      }
    });

    const [result] = evaluateKeeperDryRun([buildLoan()], oracle);
    expect(result.decision).toBe('PLAN_MARGIN_CALL');
    expect(result.computedLtvBps).toBeGreaterThanOrEqual(7000);
    expect(result.computedLtvBps).toBeLessThan(8000);
  });

  it('does not mark already escalated margin-call loans healthy before explicit recovery', () => {
    const oracle = createControlledOracleAdapter({
      now: () => now,
      prices: {
        AVAX: { priceUsd: '20', asOf: '2026-06-20T11:59:30.000Z' }
      }
    });

    const [result] = evaluateKeeperDryRun([buildLoan({ status: 'MarginCall' })], oracle);
    expect(result.decision).toBe('NOOP_ALREADY_ESCALATED');
    expect(result.computedLtvBps).toBeLessThan(7000);
  });

  it('does not re-emit margin calls for already escalated loans below liquidation threshold', () => {
    const oracle = createControlledOracleAdapter({
      now: () => now,
      prices: {
        AVAX: { priceUsd: '14', asOf: '2026-06-20T11:59:30.000Z' }
      }
    });

    const [result] = evaluateKeeperDryRun([buildLoan({ status: 'MarginCall' })], oracle);
    expect(result.decision).toBe('NOOP_ALREADY_ESCALATED');
    expect(result.computedLtvBps).toBeGreaterThanOrEqual(7000);
    expect(result.computedLtvBps).toBeLessThan(8000);
  });

  it('keeps margin-call/defaulted loans out of liquidation while coverage is above the critical buffer', () => {
    const oracle = createControlledOracleAdapter({
      now: () => now,
      prices: {
        AVAX: { priceUsd: '12', asOf: '2026-06-20T11:59:30.000Z' }
      }
    });

    const marginCallLoan = buildLoan({ loanId: 'loan-margin-1', status: 'MarginCall' });
    const defaultedLoan = buildLoan({ loanId: 'loan-default-1', status: 'Defaulted' });
    const results = evaluateKeeperDryRun([marginCallLoan, defaultedLoan], oracle);

    expect(results[0].decision).toBe('NOOP_ALREADY_ESCALATED');
    expect(results[1].decision).toBe('PLAN_MARGIN_CALL');
    expect(results[1].policy).toBe('MARGIN_CALL_FIRST');
  });

  it('plans liquidation for any keeper-scoped loan once collateral coverage is within the critical 10 percent buffer', () => {
    const oracle = createControlledOracleAdapter({
      now: () => now,
      prices: {
        AVAX: { priceUsd: '11', asOf: '2026-06-20T11:59:30.000Z' }
      }
    });

    const activeLoan = buildLoan({ loanId: 'loan-active-1', status: 'Active' });
    const marginCallLoan = buildLoan({ loanId: 'loan-margin-1', status: 'MarginCall' });
    const defaultedLoan = buildLoan({ loanId: 'loan-default-1', status: 'Defaulted' });
    const results = evaluateKeeperDryRun([activeLoan, marginCallLoan, defaultedLoan], oracle);

    expect(results.map((result) => result.decision)).toEqual(['PLAN_LIQUIDATION', 'PLAN_LIQUIDATION', 'PLAN_LIQUIDATION']);
    expect(results.every((result) => result.policy === 'CRITICAL_COLLATERAL_BUFFER')).toBe(true);
    expect(results.every((result) => Number(result.coverageRatioBps) <= 11000)).toBe(true);
  });

  it('skips statuses outside keeper scope without requesting oracle prices', () => {
    const oracle = createControlledOracleAdapter({
      now: () => now,
      prices: {}
    });

    const [result] = evaluateKeeperDryRun([buildLoan({ status: 'Approved' })], oracle);
    expect(result.decision).toBe('NOOP_UNSUPPORTED_STATUS');
    expect(result.computedLtvBps).toBeNull();
  });

  it('fails closed on stale prices and never mutates input loans', () => {
    const originalLoan = buildLoan({ status: 'Active' });
    const before = structuredClone(originalLoan);
    const oracle = createControlledOracleAdapter({
      now: () => now,
      maxPriceAgeSeconds: 60,
      prices: {
        AVAX: { priceUsd: '20', asOf: '2026-06-20T11:50:00.000Z' }
      }
    });

    const [result] = evaluateKeeperDryRun([originalLoan], oracle);

    expect(result.decision).toBe('FAIL_CLOSED');
    expect(result.error).toMatch(/stale/i);
    expect(originalLoan).toEqual(before);
  });

  it('uses margin-call-first policy for active loans above liquidation threshold while coverage is not critical', () => {
    const oracle = createControlledOracleAdapter({
      now: () => now,
      prices: {
        AVAX: { priceUsd: '12', asOf: '2026-06-20T11:59:30.000Z' }
      }
    });

    const [result] = evaluateKeeperDryRun([buildLoan({ status: 'Active' })], oracle);
    expect(result.decision).toBe('PLAN_MARGIN_CALL');
    expect(result.policy).toBe('MARGIN_CALL_FIRST');
    expect(Number(result.coverageRatioBps)).toBeGreaterThan(11000);
  });
});
