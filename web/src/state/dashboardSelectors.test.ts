import { describe, expect, it } from 'vitest';
import type { DashboardSummary, Loan, OnChainEvent } from '../api/types.js';
import { sampleLoan } from './demoPayloads.js';
import {
  selectAuditEvents,
  selectExposureByAsset,
  selectLoansForMode,
  selectLoanDetailViewModel,
  selectPortfolioSummary,
  selectRiskSummary
} from './dashboardSelectors.js';

const web3Loan = sampleLoan({ loanId: 'loan-web3-001', scenario: 'WEB3_BRIDGE', status: 'Active' });
const smeLoan = sampleLoan({
  loanId: 'loan-sme-001',
  scenario: 'SME_FIAT_WORKING_CAPITAL',
  status: 'MarginCall',
  collateral: { ...web3Loan.collateral, token: 'USDC', valueUsd: '65000', vaultAddress: '0xvault-sme' },
  currentMetrics: { ...web3Loan.currentMetrics, currentLtvBps: 7200, outstandingPrincipal: '850000', outstandingCurrency: 'MXN' },
  receipt: null
});
const defaultedLoan = sampleLoan({ loanId: 'loan-defaulted-001', scenario: 'WEB3_BRIDGE', status: 'Defaulted', collateral: { ...web3Loan.collateral, valueUsd: 'bad-usd' } });

const event: OnChainEvent = {
  eventId: 'evt-pay-001',
  eventType: 'InstallmentPaid',
  loanId: 'loan-web3-001',
  txHash: null,
  blockNumber: null,
  occurredAt: '2026-06-15T00:00:00Z',
  payload: { attestationHash: '0xattest', rawSecret: 'must-not-render', amount: '12500', ignored: { nested: true } }
};

const summary: DashboardSummary = {
  activePrincipalUsd: '192100',
  activeVaults: 2,
  averageLtvBps: 6400,
  loansInMarginCall: 1,
  paymentsAttested: 3,
  liquidationsExecuted: 0,
  exposureByAsset: [{ asset: 'USDC', valueUsd: '15065000' }],
  recentEvents: [event]
};

describe('dashboard selectors', () => {
  it('filters loans by demo mode without mutating canonical loans', () => {
    const loans = [web3Loan, smeLoan];

    expect(selectLoansForMode(loans, 'crypto-native').map((loan) => loan.loanId)).toEqual(['loan-web3-001']);
    expect(selectLoansForMode(loans, 'institutional').map((loan) => loan.loanId)).toEqual(['loan-sme-001']);
    expect(selectLoansForMode(loans, 'all')).toEqual(loans);
    expect(loans).toEqual([web3Loan, smeLoan]);
  });

  it('derives portfolio metrics, basis-point risk labels, and severity', () => {
    const portfolio = selectPortfolioSummary(null, [web3Loan, smeLoan, defaultedLoan]);
    expect(portfolio.activeLoans.value).toBe(2);
    expect(portfolio.activeVaults).toMatchObject({ value: 2, source: 'derived' });
    expect(portfolio.marginOrDefaultExposure.value).toBe(2);
    expect(portfolio.activePrincipalUsd).toMatchObject({ value: 'Unavailable', source: 'demo-fixture', label: 'Demo data' });

    const fromSummary = selectPortfolioSummary(summary, [web3Loan]);
    expect(fromSummary.activePrincipalUsd).toMatchObject({ value: '192100', source: 'api' });
    expect(fromSummary.activeVaults).toMatchObject({ value: 2, source: 'api' });

    const risk = selectRiskSummary(summary, [web3Loan, smeLoan]);
    expect(risk.averageLtv.label).toBe('64.00%');
    expect(risk.loansInMarginCall.value).toBe(1);
    expect(risk.severity).toBe('warning');

    expect(selectRiskSummary(null, [defaultedLoan]).severity).toBe('critical');
  });

  it('prioritizes API exposure, safely derives loan exposure, and labels fixture fallback', () => {
    expect(selectExposureByAsset(summary, [web3Loan])[0]).toMatchObject({ asset: 'USDC', valueUsd: '15065000', source: 'api' });

    const derived = selectExposureByAsset(null, [web3Loan, smeLoan]);
    expect(derived).toEqual([
      { asset: 'USDC', valueUsd: '15065000', source: 'derived', label: 'Derived from API loans' }
    ]);

    expect(selectExposureByAsset(null, [])).toEqual([{ asset: 'No exposure data', valueUsd: '0', source: 'demo-fixture', label: 'Demo data' }]);
    expect(selectExposureByAsset(null, [defaultedLoan])[0]).toMatchObject({ asset: 'No exposure data', source: 'demo-fixture' });
  });

  it('whitelists audit payload highlights and labels missing chain evidence', () => {
    const rows = selectAuditEvents(summary, [], 'loan-web3-001');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ eventId: 'evt-pay-001', evidenceLabel: 'No tx hash or block recorded' });
    expect(rows[0]?.payloadHighlights).toEqual([{ label: 'attestationHash', value: '0xattest' }, { label: 'amount', value: '12500' }]);
    expect(JSON.stringify(rows[0])).not.toContain('rawSecret');
  });

  it('builds selected-loan detail models with receipt, payment evidence, USDC liquidation, and empty states', () => {
    const detail = selectLoanDetailViewModel(web3Loan, [event]);
    expect(detail).toMatchObject({ loanId: 'loan-web3-001', scenario: 'WEB3_BRIDGE', status: 'Active', liquidation: { proceedsCurrency: 'USDC' } });
    expect(detail.receipt).toMatchObject({ receiptTokenId: '1', emptyLabel: undefined });
    expect(detail.paymentEvidence).toHaveLength(1);

    const empty = selectLoanDetailViewModel(smeLoan, []);
    expect(empty.receipt.emptyLabel).toBe('No receipt minted yet');
    expect(empty.paymentEmptyLabel).toBe('No payment evidence recorded yet');
  });

  it('handles empty modes and malformed numbers conservatively', () => {
    expect(selectLoansForMode([web3Loan], 'institutional')).toEqual([]);
    expect(selectRiskSummary(null, [{ ...web3Loan, currentMetrics: { ...web3Loan.currentMetrics, currentLtvBps: Number.NaN } } as Loan]).averageLtv.label).toBe('Unavailable');
    expect(selectAuditEvents(null, [], undefined)).toEqual([]);
  });
});
