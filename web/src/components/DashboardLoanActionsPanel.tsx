import { useState } from 'react';
import type { BovedaApiClient } from '../api/client.js';
import type { Loan, OnChainEvent } from '../api/types.js';
import { ActionButton } from './ActionButton.js';
import { Alert } from './Alert.js';
import { formatBps, shortHash } from './format.js';
import { buildDemoDepositPayload, buildDemoMarginCallPayload, buildDemoPaymentPayload, buildDemoTopUpPayload } from '../state/demoPayloads.js';
import { ApiClientError } from '../api/client.js';

type OperationError = { code: string; message: string };

type OperationKey = 'approve' | 'deposit' | 'topUp' | 'activate' | 'payment' | 'marginCall' | 'liquidation';

type Props = {
  loan: Loan;
  events: OnChainEvent[];
  client: Pick<BovedaApiClient, 'approveLoan' | 'depositCollateral' | 'topUpCollateral' | 'activateLoan' | 'attestPayment' | 'createMarginCall' | 'liquidateLoan'>;
  onActionComplete: () => Promise<void>;
};

function toOperationError(error: unknown): OperationError {
  if (error instanceof ApiClientError) return { code: error.code, message: error.message };
  if (error instanceof Error) return { code: 'REQUEST_FAILED', message: error.message };
  return { code: 'REQUEST_FAILED', message: 'Operation failed. Retry from the dashboard.' };
}

export function DashboardLoanActionsPanel({ loan, events, client, onActionComplete }: Props) {
  const [action, setAction] = useState<null | OperationKey>(null);
  const [errors, setErrors] = useState<Partial<Record<OperationKey, OperationError>>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canApprove = loan.status === 'Requested';
  const canDeposit = loan.status === 'Approved';
  const canActivate = loan.status === 'Approved' && Boolean(loan.collateral.depositTxHash) && Boolean(loan.collateral.vaultAddress);
  const canTopUp = (loan.status === 'Active' || loan.status === 'MarginCall') && Boolean(loan.collateral.vaultAddress) && Boolean(loan.collateral.depositTxHash);
  const canPay = loan.status === 'Active' || loan.status === 'MarginCall';
  const canMarginCall = loan.status === 'Active' && loan.currentMetrics.currentLtvBps >= loan.terms.marginCallLtvBps;
  const canLiquidate = loan.status === 'MarginCall' || loan.status === 'Defaulted';
  const lastPayment = [...events].filter((event) => event.loanId === loan.loanId && event.eventType === 'InstallmentPaid').pop();
  const lastLiquidation = events.find((event) => event.loanId === loan.loanId && event.eventType === 'Liquidated');

  async function execute(key: OperationKey, operation: () => Promise<unknown>, successText: string) {
    setAction(key);
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setSuccessMessage(null);

    try {
      await operation();
      setSuccessMessage(successText);
      await onActionComplete();
    } catch (error) {
      setErrors((current) => ({ ...current, [key]: toOperationError(error) }));
    } finally {
      setAction(null);
    }
  }

  return (
    <section className="dashboard-card" aria-label="Live loan operations">
      <header className="card-title-row">
        <div>
          <h2>Live loan operations</h2>
          <small className="mono-cell">Trigger API-backed actions from the dashboard</small>
        </div>
      </header>

      {successMessage ? <Alert tone="success">{successMessage}</Alert> : null}
      {action ? <p>Executing {action.replace(/([A-Z])/g, ' $1').trim()}…</p> : null}

      <div className="button-row">
        <ActionButton onClick={() => execute('approve', async () => client.approveLoan(loan.loanId, { approvedBy: 'dashboard-demo', fiatDisbursementRef: `demo-disbursement-${shortHash(loan.loanId)}` }), 'Loan approved successfully.')} disabled={!canApprove} loading={action === 'approve'}>
          Approve loan
        </ActionButton>
        <ActionButton variant="secondary" onClick={() => execute('deposit', async () => client.depositCollateral(loan.loanId, buildDemoDepositPayload(loan)), 'Collateral deposit recorded.')} disabled={!canDeposit} loading={action === 'deposit'}>
          Record collateral deposit
        </ActionButton>
        <ActionButton variant="secondary" onClick={() => execute('activate', async () => client.activateLoan(loan.loanId, { receiptTokenId: `receipt-${shortHash(loan.loanId)}` }), 'Loan activated and receipt recorded.')} disabled={!canActivate} loading={action === 'activate'}>
          Activate loan
        </ActionButton>
      </div>

      <div className="button-row">
        <ActionButton variant="secondary" onClick={() => execute('topUp', async () => client.topUpCollateral(loan.loanId, buildDemoTopUpPayload(loan)), 'Collateral top-up recorded.')} disabled={!canTopUp} loading={action === 'topUp'}>
          Top up collateral
        </ActionButton>
        <ActionButton variant="secondary" onClick={() => execute('payment', async () => client.attestPayment(loan.loanId, buildDemoPaymentPayload(loan)), 'Payment attestation submitted.')} disabled={!canPay} loading={action === 'payment'}>
          Attest payment
        </ActionButton>
      </div>

      <div className="button-row">
        <ActionButton variant="secondary" onClick={() => execute('marginCall', async () => client.createMarginCall(loan.loanId, buildDemoMarginCallPayload(loan)), 'Margin call triggered.')} disabled={!canMarginCall} loading={action === 'marginCall'}>
          Trigger margin call
        </ActionButton>
        <ActionButton variant="danger" onClick={() => execute('liquidation', async () => client.liquidateLoan(loan.loanId, { proceedsAmount: loan.liquidationPreview.proceedsAmount, proceedsCurrency: 'USDC' }), 'Loan liquidation simulated.')} disabled={!canLiquidate} loading={action === 'liquidation'}>
          Simulate liquidation
        </ActionButton>
      </div>

      {errors.approve ? <Alert tone="danger">Approve failed: {errors.approve.message}</Alert> : null}
      {errors.deposit ? <Alert tone="danger">Deposit failed: {errors.deposit.message}</Alert> : null}
      {errors.activate ? <Alert tone="danger">Activate failed: {errors.activate.message}</Alert> : null}
      {errors.topUp ? <Alert tone="danger">Top-up failed: {errors.topUp.message}</Alert> : null}
      {errors.payment ? <Alert tone="danger">Payment attestation failed: {errors.payment.message}</Alert> : null}
      {errors.marginCall ? <Alert tone="danger">Margin call failed: {errors.marginCall.message}</Alert> : null}
      {errors.liquidation ? <Alert tone="danger">Liquidation failed: {errors.liquidation.message}</Alert> : null}

      <div className="dashboard-action-notes">
        <p><strong>Status:</strong> {loan.status} · Current LTV {formatBps(loan.currentMetrics.currentLtvBps)}</p>
        {lastPayment ? <p>Last attestation: {shortHash(lastPayment.eventId)} ({lastPayment.occurredAt})</p> : null}
        {lastLiquidation ? <p>Last liquidation event: {shortHash(lastLiquidation.eventId)} ({lastLiquidation.occurredAt})</p> : null}
      </div>
    </section>
  );
}
