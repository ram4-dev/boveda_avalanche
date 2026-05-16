import type { WalletConnection } from '../wallet/injectedWallet.js';
import { shortenAddress } from '../wallet/injectedWallet.js';
import type { BorrowerFacingError } from '../api/errors.js';
import type { Loan, QuoteResponse, RiskAssessment } from '../api/types.js';
import { ActionButton } from '../components/ActionButton.js';
import { Alert } from '../components/Alert.js';
import { KeyValueList } from '../components/KeyValueList.js';
import { MetricTile } from '../components/MetricTile.js';
import { StatusPill } from '../components/StatusPill.js';
import { formatBps, formatMoney } from '../components/format.js';
import { getStatusGuidance, type JourneyAction } from '../state/borrowerJourney.js';

type DemoOfferStage = 'request' | 'risk' | 'offer';

type Props = {
  loan: Loan;
  wallet: WalletConnection;
  quote: QuoteResponse | null;
  risk: RiskAssessment | null;
  action: JourneyAction;
  errors: Partial<Record<'quote' | 'risk', BorrowerFacingError>>;
  demoStage?: DemoOfferStage;
  onConnectWallet: () => void;
  onCreateQuote: () => void;
  onAssessRisk: () => void;
};

export function OfferRequestScreen({ loan, wallet, quote, risk, action, errors, demoStage = 'offer', onConnectWallet, onCreateQuote, onAssessRisk }: Props) {
  if (demoStage === 'request') return <RequestStage loan={loan} wallet={wallet} onConnectWallet={onConnectWallet} />;
  if (demoStage === 'risk') return <RiskStage loan={loan} wallet={wallet} risk={risk} action={action} errors={errors} onConnectWallet={onConnectWallet} onAssessRisk={onAssessRisk} />;

  return (
    <section className="screen-grid" aria-labelledby="borrower-offer-title">
      <article className="card">
        <div className="card-title-row">
          <div>
            <span className="card-kicker">Loan offer</span>
            <h2 id="borrower-offer-title">Borrower offer</h2>
          </div>
          <StatusPill status={loan.status} />
        </div>
        <div className="metric-grid">
          <MetricTile
            hero
            label="Principal"
            value={formatMoney(loan.principal.amount, loan.principal.currency)}
            detail={loan.principal.fiatRail}
          />
          <MetricTile
            label="Collateral"
            value={`${loan.collateral.amount} ${loan.collateral.token}`}
            detail={`${loan.collateral.valueUsd} USD value`}
          />
          <MetricTile
            label="Initial / current LTV"
            value={formatBps(loan.terms.initialLtvBps)}
            detail={`Current ${formatBps(loan.currentMetrics.currentLtvBps)}`}
          />
          <MetricTile
            label="APR / tenor"
            value={`${formatBps(loan.terms.aprBps)} APR`}
            detail={`${loan.terms.tenorDays} days`}
          />
        </div>
        <hr className="card-divider" />
        <KeyValueList items={[
          { label: 'Repayment', value: loan.terms.repaymentFrequency },
          { label: 'Thresholds', value: `${formatBps(loan.terms.marginCallLtvBps)} / ${formatBps(loan.terms.liquidationLtvBps)}` },
          { label: 'Liquidation currency', value: loan.terms.liquidationCurrency },
          { label: 'Originator', value: loan.originator.displayName },
          { label: 'Funding partner', value: loan.fundingPartner.displayName }
        ]} />
      </article>

      <article className="card">
        <span className="card-kicker">Next step</span>
        <h2>Status and next action</h2>
        <p>{getStatusGuidance(loan)}</p>
        <p className="muted">Collateral and liquidation actions are API-simulated until smart contracts are wired through the backend adapter.</p>
      </article>

      <article className="card">
        <span className="card-kicker">Wallet</span>
        <h2>Injected wallet</h2>
        {wallet.status === 'connected' ? (
          <p title={wallet.address}>
            <strong>{shortenAddress(wallet.address)}</strong> connected for quote and risk requests.
          </p>
        ) : null}
        {wallet.status === 'unavailable' ? (
          <Alert>
            Real wallet connection is unavailable in this browser. You can still review the local API simulation without private keys or seed phrases.
          </Alert>
        ) : null}
        {wallet.status === 'rejected' ? (
          <Alert tone="danger">{wallet.message}</Alert>
        ) : null}
        <ActionButton variant="secondary" onClick={onConnectWallet} loading={wallet.status === 'connecting'}>
          Connect injected wallet
        </ActionButton>
      </article>

      <article className="card">
        <span className="card-kicker">Risk engine</span>
        <h2>Quote and wallet risk</h2>
        <div className="button-row">
          <ActionButton onClick={onCreateQuote} loading={action === 'quoting'}>Refresh quote</ActionButton>
          <ActionButton variant="secondary" onClick={onAssessRisk} loading={action === 'risking'}>Assess wallet risk</ActionButton>
        </div>
        {errors.quote ? <Alert tone="danger">{errors.quote.code}: {errors.quote.message}</Alert> : null}
        {errors.risk ? <Alert tone="danger">{errors.risk.code}: {errors.risk.message}</Alert> : null}
        {quote ? (
          <>
            <hr className="card-divider" />
            <KeyValueList items={[
              { label: 'Suggested principal', value: formatMoney(quote.suggestedPrincipal.amount, quote.suggestedPrincipal.currency) },
              { label: 'Required collateral', value: `${quote.requiredCollateralValueUsd} USD` },
              { label: 'Quote LTV', value: `${formatBps(quote.terms.initialLtvBps)} / ${formatBps(quote.terms.marginCallLtvBps)} / ${formatBps(quote.terms.liquidationLtvBps)}` },
              { label: 'Quote terms', value: `${formatBps(quote.terms.aprBps)} APR, ${quote.terms.tenorDays} days` },
              { label: 'Liquidation currency', value: quote.terms.liquidationCurrency }
            ]} />
          </>
        ) : null}
        {risk ? (
          <Alert tone={risk.riskStatus === 'COMPLETED' ? (risk.amlStatus === 'PASS' ? 'success' : risk.amlStatus === 'REVIEW' ? 'warning' : 'danger') : risk.riskStatus === 'FAILED' ? 'danger' : 'warning'}>
            {risk.riskStatus === 'COMPLETED'
              ? `${risk.amlStatus === 'PASS' ? 'Risk passed' : risk.amlStatus === 'REVIEW' ? 'Requires review' : 'Blocked'} — score ${risk.riskScore}, max LTV ${formatBps(risk.maxLtvBps ?? 0)}, reason: ${risk.riskReason}, hash ${risk.assessmentHash}`
              : `${risk.riskStatus === 'FAILED' ? 'Risk assessment failed' : 'Risk investigation pending'} — reason: ${risk.riskReason}, status: ${risk.riskStatus}, hash ${risk.assessmentHash}`}
          </Alert>
        ) : null}
      </article>
    </section>
  );
}

function RequestStage({ loan, wallet, onConnectWallet }: { loan: Loan; wallet: WalletConnection; onConnectWallet: () => void }) {
  return (
    <section className="screen-grid" aria-labelledby="borrower-request-title">
      <article className="card">
        <div className="card-title-row">
          <div>
            <span className="card-kicker">Loan request</span>
            <h2 id="borrower-request-title">Borrower request</h2>
          </div>
          <StatusPill status="Requested" />
        </div>
        <div className="metric-grid">
          <MetricTile hero label="Requested principal" value={formatMoney(loan.principal.amount, loan.principal.currency)} detail={loan.principal.fiatRail} />
          <MetricTile label="Collateral token" value={loan.collateral.token} detail="Collateral terms pending offer" />
        </div>
        <p className="muted">Step 1: the borrower submits the loan request. Offer terms, collateral requirement, and risk score are not shown until the next demo steps.</p>
      </article>
      <article className="card">
        <span className="card-kicker">Wallet</span>
        <h2>Injected wallet</h2>
        {wallet.status === 'connected' ? <p title={wallet.address}><strong>{shortenAddress(wallet.address)}</strong> connected for the borrower request.</p> : null}
        {wallet.status === 'unavailable' ? <Alert>Real wallet connection is unavailable in this browser. You can still review the local API simulation without private keys or seed phrases.</Alert> : null}
        <ActionButton variant="secondary" onClick={onConnectWallet} loading={wallet.status === 'connecting'}>Connect injected wallet</ActionButton>
      </article>
    </section>
  );
}

function RiskStage({ loan, wallet, risk, action, errors, onConnectWallet, onAssessRisk }: { loan: Loan; wallet: WalletConnection; risk: RiskAssessment | null; action: JourneyAction; errors: Partial<Record<'quote' | 'risk', BorrowerFacingError>>; onConnectWallet: () => void; onAssessRisk: () => void }) {
  return (
    <section className="screen-grid" aria-labelledby="risk-check-title">
      <article className="card">
        <div className="card-title-row">
          <div>
            <span className="card-kicker">Risk check</span>
            <h2 id="risk-check-title">Wallet risk check</h2>
          </div>
          <StatusPill status={loan.status} />
        </div>
        <p className="muted">Step 2: Bóveda checks wallet risk before presenting the final offer and collateral requirement.</p>
        {wallet.status === 'connected' ? <p title={wallet.address}><strong>{shortenAddress(wallet.address)}</strong> connected for risk scoring.</p> : null}
        {errors.risk ? <Alert tone="danger">{errors.risk.code}: {errors.risk.message}</Alert> : null}
        {risk ? (
          <Alert tone={risk.riskStatus === 'COMPLETED' ? (risk.amlStatus === 'PASS' ? 'success' : risk.amlStatus === 'REVIEW' ? 'warning' : 'danger') : risk.riskStatus === 'FAILED' ? 'danger' : 'warning'}>
            {risk.riskStatus === 'COMPLETED'
              ? `${risk.amlStatus === 'PASS' ? 'Risk passed' : risk.amlStatus === 'REVIEW' ? 'Requires review' : 'Blocked'} — score ${risk.riskScore}, max LTV ${formatBps(risk.maxLtvBps ?? 0)}, reason: ${risk.riskReason}, hash ${risk.assessmentHash}`
              : `${risk.riskStatus === 'FAILED' ? 'Risk assessment failed' : 'Risk investigation pending'} — reason: ${risk.riskReason}, status: ${risk.riskStatus}, hash ${risk.assessmentHash}`}
          </Alert>
        ) : null}
        <div className="button-row">
          <ActionButton variant="secondary" onClick={onConnectWallet} loading={wallet.status === 'connecting'}>Connect injected wallet</ActionButton>
          <ActionButton onClick={onAssessRisk} loading={action === 'risking'}>Assess wallet risk</ActionButton>
        </div>
      </article>
    </section>
  );
}
