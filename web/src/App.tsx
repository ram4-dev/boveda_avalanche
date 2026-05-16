import { useMemo } from 'react';
import { createBovedaApiClient } from './api/client.js';
import { OfferRequestScreen } from './screens/OfferRequestScreen.js';
import { LoanActivityScreen } from './screens/LoanActivityScreen.js';
import { useBorrowerJourney } from './state/borrowerJourney.js';
import { useInjectedWallet } from './wallet/useInjectedWallet.js';
import './styles/app.css';

export function App() {
  const client = useMemo(() => createBovedaApiClient(), []);
  const journey = useBorrowerJourney(client);
  const wallet = useInjectedWallet();
  const loan = journey.state.selectedLoan;
  const walletAddress = wallet.connection.status === 'connected' ? wallet.connection.address : loan?.borrower.walletAddress;
  const isLoading = journey.state.loadStatus === 'loading' || journey.state.loadStatus === 'idle';

  return <main className="app-shell">
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">B</div>
        <div>
          <h1>Bóveda borrower widget</h1>
          <p className="brand-subtitle">Avalanche-backed credit demo for borrowers</p>
        </div>
      </div>
      <div className="header-meta">
        <span className="network-chip" aria-label="Demo network status">
          <span className="network-dot" aria-hidden="true"></span>
          Local Batch 2 API
        </span>
        <button
          className="button button-secondary"
          onClick={journey.reload}
          aria-label="Refresh borrower data"
        >
          Refresh
        </button>
      </div>
    </header>

    {journey.state.loadStatus === 'ready' ? (
      <div className="sr-status" role="status" aria-label="Borrower data status">
        Borrower data loaded from local Batch 2 API. Collateral, payment, and liquidation controls remain API-simulated until contracts are wired.
      </div>
    ) : null}

    {isLoading ? (
      <section className="card" aria-live="polite">
        <span className="card-kicker">Loading</span>
        <h2>Loading borrower context…</h2>
        <p>Fetching the canonical WEB3_BRIDGE loan from the local Batch 2 API.</p>
      </section>
    ) : null}

    {journey.state.loadStatus === 'empty' ? (
      <section className="card">
        <span className="card-kicker">Empty</span>
        <h2>No demo loan available</h2>
        <p>The local API returned no borrower demo loans. Start the backend and retry.</p>
        <button className="button button-secondary" onClick={journey.reload}>Retry</button>
      </section>
    ) : null}

    {journey.state.loadStatus === 'error' ? (
      <section className="card">
        <span className="card-kicker">Error</span>
        <h2>Could not load borrower context</h2>
        <p role="alert">{journey.state.errors.load?.code}: {journey.state.errors.load?.message}</p>
        <button className="button button-secondary" onClick={journey.reload}>Retry</button>
      </section>
    ) : null}

    {loan ? (
      <div className="borrower-layout">
        <aside className="borrower-sidebar" aria-label="Borrower context">
          <section className="sidebar-section">
            <span className="sidebar-title">Borrower profile</span>
            <p className="sidebar-name">{loan.borrower.displayName}</p>
            <p className="address-line" title={walletAddress}>{walletAddress}</p>
          </section>
          <section className="sidebar-section">
            <span className="sidebar-title">Demo assets</span>
            <div className="asset-pill-row" aria-label="Borrower assets">
              <span className="asset-pill"><span className="asset-dot" aria-hidden="true">$</span>{loan.principal.currency}</span>
              <span className="asset-pill"><span className="asset-dot" aria-hidden="true">◇</span>{loan.collateral.token}</span>
              <span className="asset-pill"><span className="asset-dot" aria-hidden="true">⤫</span>USDC</span>
            </div>
          </section>
          <section className="sidebar-section">
            <span className="sidebar-title">Scenario</span>
            <p className="sidebar-name">{loan.scenario.replaceAll('_', ' ')}</p>
            <p className="sidebar-description">Offer, wallet connection, collateral, receipt, payment attestation, margin call, and liquidation run through the local Batch 2 API.</p>
          </section>
        </aside>

        <div className="borrower-main">
          <OfferRequestScreen
            loan={loan}
            wallet={wallet.connection}
            quote={journey.state.quote}
            risk={journey.state.risk ?? loan.riskAssessment}
            action={journey.state.action}
            errors={journey.state.errors}
            onConnectWallet={wallet.connect}
            onCreateQuote={() => journey.createQuote(walletAddress)}
            onAssessRisk={() => journey.assessRisk(walletAddress)}
          />
        </div>

        <aside className="borrower-rail" aria-label="Loan activity and evidence">
          <LoanActivityScreen
            loan={loan}
            events={journey.state.events}
            lastPayment={journey.state.lastPayment}
            lastLiquidation={journey.state.lastLiquidation}
            action={journey.state.action}
            errors={journey.state.errors}
            onDeposit={journey.depositCollateral}
            onActivate={journey.activateLoan}
            onAttestPayment={journey.attestPayment}
            onTriggerMarginCall={journey.triggerMarginCall}
            onLiquidate={journey.liquidateLoan}
          />
        </aside>
      </div>
    ) : null}
  </main>;
}

export default App;
