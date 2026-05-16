import type { EvidenceSource, Loan, OnChainEvent } from '../api/types.js';
import { formatBps, formatMoney } from './format.js';
import { StatusPill } from './StatusPill.js';
import { selectLoanDetailViewModel } from '../state/dashboardSelectors.js';
import { EvidenceBadge } from './EvidenceBadge.js';
import { ExplorerLink } from './ExplorerLink.js';

type LoanDetailPanelProps = {
  loan: Loan | null;
  events: OnChainEvent[];
  errorMessage?: string;
};

export function LoanDetailPanel({ loan, events, errorMessage }: LoanDetailPanelProps) {
  if (!loan) {
    return <section className="dashboard-card" aria-label="Loan detail">
      <header className="card-title-row"><h2>Loan detail</h2></header>
      <p>Select a loan from the portfolio table to inspect borrower, collateral, payment, and liquidation evidence.</p>
    </section>;
  }

  const detail = selectLoanDetailViewModel(loan, events);
  const explorerBaseUrl = 'https://testnet.snowtrace.io';
  const collateralSource: EvidenceSource = loan.collateralEvidence?.source ?? (detail.collateral.depositTxHash ? 'fuji-live' : 'demo-simulated');
  const activationSource: EvidenceSource = loan.activationEvidence?.source ?? 'demo-simulated';
  const receiptSource: EvidenceSource = loan.receiptEvidence?.source ?? activationSource;
  const liquidationSource: EvidenceSource = detail.liquidationEvidence.evidenceSource;

  return <section className="dashboard-card" aria-label="Loan detail">
    <header className="card-title-row">
      <h2>Loan detail</h2>
      <StatusPill status={detail.status} />
    </header>

    {errorMessage ? <p role="alert">Detail refresh failed: {errorMessage}</p> : null}

    <div className="loan-detail-grid">
      <p><strong>Loan ID:</strong> <span className="mono-cell">{detail.loanId}</span></p>
      <p><strong>Scenario:</strong> {detail.scenario.replaceAll('_', ' ')}</p>
      <p><strong>Borrower:</strong> {detail.borrower.displayName} <span className="mono-cell">{detail.borrower.walletAddress}</span></p>
      <p><strong>Originator:</strong> {detail.originator.displayName}</p>
      <p><strong>Funding partner:</strong> {detail.fundingPartner.displayName}</p>
      <p><strong>Principal:</strong> {formatMoney(detail.principal.amount, detail.principal.currency)}</p>
      <p><strong>Collateral:</strong> {formatMoney(detail.collateral.valueUsd, 'USD')} ({detail.collateral.token})</p>
      <p><strong>Current LTV:</strong> {formatBps(detail.currentMetrics.currentLtvBps)}</p>
      <p><strong>Margin call threshold:</strong> {formatBps(detail.terms.marginCallLtvBps)}</p>
      <p><strong>Liquidation threshold:</strong> {formatBps(detail.terms.liquidationLtvBps)}</p>
      <p><strong>APR:</strong> {formatBps(detail.terms.aprBps)}</p>
      <p><strong>Tenor:</strong> {detail.terms.tenorDays} days</p>
      <p><strong>Repayment frequency:</strong> {detail.terms.repaymentFrequency}</p>
      <p><strong>Vault address:</strong> {detail.collateral.vaultAddress ? <span className="mono-cell">{detail.collateral.vaultAddress}</span> : 'Unavailable — no vault address recorded'}</p>
      <p><strong>Deposit tx hash:</strong> {detail.collateral.depositTxHash ? <span className="mono-cell">{detail.collateral.depositTxHash}</span> : 'Unavailable — no deposit tx hash recorded'}</p>
      <EvidenceBadge source={collateralSource} />
      <div className="button-row">
        <ExplorerLink entity="tx" value={detail.collateral.depositTxHash} source={collateralSource} explorerBaseUrl={explorerBaseUrl} />
        <ExplorerLink entity="address" value={detail.collateral.vaultAddress} source={collateralSource} explorerBaseUrl={explorerBaseUrl} />
      </div>
      <p><strong>Receipt:</strong> {detail.receipt.receiptTokenId ?? detail.receipt.emptyLabel}</p>
      <p><strong>Receipt owner wallet:</strong> {detail.receipt.ownerWallet ? <span className="mono-cell">{detail.receipt.ownerWallet}</span> : 'Unavailable — no receipt owner wallet'}</p>
      <p><strong>Soulbound status:</strong> {detail.receipt.soulbound === null ? 'Unavailable — receipt not minted yet' : detail.receipt.soulbound ? 'Soulbound (non-transferable)' : 'Transferable'}</p>
      <EvidenceBadge source={receiptSource} />
      <EvidenceBadge source={activationSource} />
      <p><strong>Liquidation proceeds:</strong> {formatMoney(detail.liquidation.proceedsAmount, detail.liquidation.proceedsCurrency)}</p>
      <p><strong>Liquidation currency:</strong> {detail.liquidation.proceedsCurrency}</p>
      <EvidenceBadge source={liquidationSource} />
      <div className="button-row">
        <ExplorerLink entity="tx" value={detail.liquidationEvidence.txHash} source={liquidationSource} explorerBaseUrl={explorerBaseUrl} />
        <ExplorerLink entity="block" value={detail.liquidationEvidence.blockNumber} source={liquidationSource} explorerBaseUrl={explorerBaseUrl} />
      </div>
    </div>

    <h3>Payment evidence</h3>
    {detail.paymentEvidence.length ? <ul className="audit-highlights" aria-label="Loan payment evidence">
      {detail.paymentEvidence.map((payment) => <li key={payment.eventId}>
        <span>{payment.eventId}</span>
        <code>{payment.occurredAt}</code>
        <EvidenceBadge source={payment.evidenceSource} />
        <div className="button-row">
          <ExplorerLink entity="tx" value={payment.txHash} source={payment.evidenceSource} explorerBaseUrl={explorerBaseUrl} />
          <ExplorerLink entity="block" value={payment.blockNumber} source={payment.evidenceSource} explorerBaseUrl={explorerBaseUrl} />
        </div>
        {payment.highlights.length ? <ul className="audit-highlights" aria-label={`Payment highlights ${payment.eventId}`}>
          {payment.highlights.map((highlight) => <li key={`${payment.eventId}-${highlight.label}`}>
            <span>{highlight.label}</span>
            <code>{highlight.value}</code>
          </li>)}
        </ul> : <p className="table-subtle">No installment/amount/currency/attestation fields were included in this payment event.</p>}
      </li>)}
    </ul> : <p>{detail.paymentEmptyLabel}</p>}
  </section>;
}
