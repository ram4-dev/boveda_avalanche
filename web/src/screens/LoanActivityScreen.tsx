import type { BorrowerFacingError } from '../api/errors.js';
import type { LiquidationResult, Loan, OnChainEvent, PaymentAttestation } from '../api/types.js';
import { ActionButton } from '../components/ActionButton.js';
import { Alert } from '../components/Alert.js';
import { EventTimeline } from '../components/EventTimeline.js';
import { KeyValueList } from '../components/KeyValueList.js';
import { MetricTile } from '../components/MetricTile.js';
import { StatusPill } from '../components/StatusPill.js';
import { formatBps, formatDate, formatMoney, isUsdcCurrency, shortHash, unsupportedLiquidationCurrencyMessage } from '../components/format.js';
import type { JourneyAction } from '../state/borrowerJourney.js';

type Props = {
  loan: Loan;
  events: OnChainEvent[];
  lastPayment: PaymentAttestation | null;
  lastLiquidation: LiquidationResult | null;
  action: JourneyAction;
  errors: Partial<Record<'deposit' | 'activate' | 'payment' | 'marginCall' | 'liquidation', BorrowerFacingError>>;
  onDeposit: () => void;
  onActivate: () => void;
  onAttestPayment: () => void;
  onTriggerMarginCall: () => void;
  onLiquidate: () => void;
};

const terminal = new Set(['Repaid', 'Liquidated', 'Cancelled']);

export function LoanActivityScreen({ loan, events, lastPayment, lastLiquidation, action, errors, onDeposit, onActivate, onAttestPayment, onTriggerMarginCall, onLiquidate }: Props) {
  const canDeposit = loan.status === 'Approved';
  const canPay = loan.status === 'Active' || loan.status === 'MarginCall';
  const canMarginCall = loan.status === 'Active' && loan.currentMetrics.currentLtvBps >= loan.terms.marginCallLtvBps;
  const canLiquidate = loan.status === 'MarginCall' || loan.status === 'Defaulted';
  const marginEvent = events.find((event) => event.eventType === 'MarginCall');
  const isTerminal = terminal.has(loan.status);
  const previewUsesUsdc = isUsdcCurrency(loan.liquidationPreview.proceedsCurrency);
  const liquidationUsesUsdc = lastLiquidation ? isUsdcCurrency(lastLiquidation.proceedsCurrency) : true;
  const showMarginAlert = loan.status === 'MarginCall' || loan.currentMetrics.currentLtvBps >= loan.terms.marginCallLtvBps;

  return (
    <section className="screen-grid" aria-labelledby="loan-activity-title">
      <article className="card">
        <div className="card-title-row">
          <div>
            <span className="card-kicker">Loan activity</span>
            <h2 id="loan-activity-title">Loan activity</h2>
          </div>
          <StatusPill status={loan.status} />
        </div>
        {isTerminal ? <Alert>Terminal status reached. Review evidence; borrower mutations are disabled.</Alert> : null}
        <div className="metric-grid">
          <MetricTile
            hero
            label="Outstanding"
            value={formatMoney(loan.currentMetrics.outstandingPrincipal, loan.currentMetrics.outstandingCurrency)}
          />
          <MetricTile
            label="Current LTV"
            value={formatBps(loan.currentMetrics.currentLtvBps)}
            detail={`Margin ${formatBps(loan.terms.marginCallLtvBps)}`}
          />
          <MetricTile
            label="Next due"
            value={formatDate(loan.currentMetrics.nextPaymentDueAt)}
          />
          <MetricTile
            label="Collateral value"
            value={`${loan.collateral.valueUsd} USD`}
            detail={`${loan.collateral.amount} ${loan.collateral.token}`}
          />
        </div>
        <hr className="card-divider" />
        <KeyValueList items={[
          { label: 'Vault', value: loan.collateral.vaultAddress ?? 'Not recorded' },
          { label: 'Deposit tx', value: shortHash(loan.collateral.depositTxHash) },
          { label: 'Borrower', value: loan.borrower.displayName }
        ]} />
      </article>

      <article className="card">
        <span className="card-kicker">Collateral</span>
        <h2>Collateral and activation</h2>
        <p>This action records an API-simulated collateral deposit until contracts are wired through the backend web3 adapter.</p>
        {errors.deposit ? <Alert tone="danger">{errors.deposit.code}: {errors.deposit.message}</Alert> : null}
        {errors.activate ? <Alert tone="danger">{errors.activate.code}: {errors.activate.message}</Alert> : null}
        <div className="button-row">
          <ActionButton onClick={onDeposit} disabled={!canDeposit} loading={action === 'depositing'}>
            Record API-simulated collateral deposit
          </ActionButton>
          <ActionButton variant="secondary" onClick={onActivate} disabled={loan.status !== 'Approved'} loading={action === 'activating'}>
            Activate loan and receipt
          </ActionButton>
        </div>
      </article>

      <article className="card">
        <span className="card-kicker">Receipt</span>
        <h2>Receipt NFT</h2>
        {loan.receipt ? (
          <KeyValueList items={[
            { label: 'Receipt', value: `Receipt #${loan.receipt.receiptTokenId}` },
            { label: 'Owner', value: loan.receipt.ownerWallet },
            { label: 'Transferability', value: loan.receipt.soulbound ? 'Soulbound demo evidence, not transferable collateral' : 'Transferable' }
          ]} />
        ) : (
          <p>Receipt appears only after the API activates the loan.</p>
        )}
      </article>

      <article className="card">
        <span className="card-kicker">Payment</span>
        <h2>Payment attestation</h2>
        {errors.payment ? <Alert tone="danger">{errors.payment.code}: {errors.payment.message}</Alert> : null}
        <ActionButton onClick={onAttestPayment} disabled={!canPay} loading={action === 'attestingPayment'}>
          Attest simulated payment
        </ActionButton>
        {lastPayment ? (
          <Alert tone="success">
            Attestation {lastPayment.attestationHash}; {lastPayment.remainingPrincipal} {lastPayment.currency} remaining; status {lastPayment.status}
          </Alert>
        ) : null}
      </article>

      <article className="card">
        <span className="card-kicker">Risk</span>
        <h2>Risk and liquidation</h2>
        {showMarginAlert ? (
          <Alert tone="warning">
            Margin call: current LTV {formatBps(loan.currentMetrics.currentLtvBps)} vs threshold {formatBps(loan.terms.marginCallLtvBps)}.
            {marginEvent?.payload.requiredTopUpAmount
              ? ` Top-up: ${String(marginEvent.payload.requiredTopUpAmount)} ${String(marginEvent.payload.requiredTopUpCurrency)}`
              : ''}
          </Alert>
        ) : null}
        {errors.marginCall ? <Alert tone="danger">{errors.marginCall.code}: {errors.marginCall.message}</Alert> : null}
        {errors.liquidation ? <Alert tone="danger">{errors.liquidation.code}: {errors.liquidation.message}</Alert> : null}
        <div className="button-row">
          <ActionButton variant="secondary" onClick={onTriggerMarginCall} disabled={!canMarginCall} loading={action === 'triggeringMarginCall'}>
            Trigger margin-call simulation
          </ActionButton>
          <ActionButton variant="danger" onClick={onLiquidate} disabled={!canLiquidate} loading={action === 'liquidating'}>
            Simulate liquidation
          </ActionButton>
        </div>
        {lastLiquidation
          ? (liquidationUsesUsdc ? (
              <Alert tone="success">
                <strong>{lastLiquidation.proceedsAmount} USDC</strong>
                <span className="muted">Funding partner: {lastLiquidation.distribution.fundingPartnerAmount}; Originator fee: {lastLiquidation.distribution.originatorFeeAmount}; Borrower remainder: {lastLiquidation.distribution.borrowerRemainderAmount}</span>
              </Alert>
            ) : (
              <Alert tone="danger">{unsupportedLiquidationCurrencyMessage(lastLiquidation.proceedsCurrency)}</Alert>
            ))
          : (previewUsesUsdc ? (
              <p className="muted">Liquidation preview proceeds are denominated in USDC.</p>
            ) : (
              <Alert tone="danger">{unsupportedLiquidationCurrencyMessage(loan.liquidationPreview.proceedsCurrency)}</Alert>
            ))
        }
      </article>

      <article className="card">
        <span className="card-kicker">Audit trail</span>
        <h2>Event evidence</h2>
        <EventTimeline events={events} />
      </article>
    </section>
  );
}
