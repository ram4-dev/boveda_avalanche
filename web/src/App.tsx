import { useEffect, useMemo, useReducer, useState } from 'react';
import { createBovedaApiClient } from './api/client.js';
import { InstitutionalDashboardScreen } from './screens/InstitutionalDashboardScreen.js';
import { OfferRequestScreen } from './screens/OfferRequestScreen.js';
import { LoanActivityScreen } from './screens/LoanActivityScreen.js';
import { DemoControlsPanel } from './components/DemoControlsPanel.js';
import { RuntimeModeBanner } from './components/RuntimeModeBanner.js';
import { useBorrowerJourney } from './state/borrowerJourney.js';
import { createInitialDemoControls, demoControlsReducer, deriveDemoView, getCurrentDemoPathStep } from './state/demoControls.js';
import { useInjectedWallet } from './wallet/useInjectedWallet.js';
import { isFujiReadOnlyStatus, isRuntimeMetadata, resolveRuntimeRoute, type FujiReadOnlyStatus, type RuntimeMetadata } from './runtime/runtimeMode.js';
import './styles/app.css';

type AppView = 'borrower' | 'dashboard';

export function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const runtimeRoute = useMemo(() => resolveRuntimeRoute(pathname), [pathname]);
  const client = useMemo(() => createBovedaApiClient({ runtimeMode: runtimeRoute.mode }), [runtimeRoute.mode]);
  const [view, setView] = useState<AppView>('borrower');
  const [runtimeMetadata, setRuntimeMetadata] = useState<RuntimeMetadata | null>(null);
  const [fujiReadOnlyStatus, setFujiReadOnlyStatus] = useState<FujiReadOnlyStatus | null>(null);

  useEffect(() => {
    const handleLocationChange = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    setRuntimeMetadata(null);
    setFujiReadOnlyStatus(null);
    let cancelled = false;
    void client.getRuntime()
      .then(async (metadata) => {
        if (cancelled || !isRuntimeMetadata(metadata)) return;
        setRuntimeMetadata(metadata);
        if (metadata.mode === 'fuji') {
          const status = await client.getFujiReadOnlyStatus().catch(() => null);
          if (!cancelled && isFujiReadOnlyStatus(status)) setFujiReadOnlyStatus(status);
        }
      })
      .catch(() => {
        if (!cancelled) setRuntimeMetadata(null);
      });
    return () => { cancelled = true; };
  }, [client]);

  return <main className="app-shell">
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">B</div>
        <div>
          <h1>Bóveda demo workspace</h1>
          <p className="brand-subtitle">Borrower journey + institutional dashboard over local Batch 2 API</p>
        </div>
      </div>
      <div className="header-meta">
        <span className="network-chip" aria-label="Demo network status">
          <span className="network-dot" aria-hidden="true"></span>
          {runtimeRoute.mode === 'demo' ? 'Demo API mode' : 'Fuji API mode'}
        </span>
        <nav className="view-switch" aria-label="Demo view switcher">
          <button className={`button ${view === 'borrower' ? 'button-primary' : 'button-secondary'}`} onClick={() => setView('borrower')} aria-pressed={view === 'borrower'}>
            Borrower widget
          </button>
          <button className={`button ${view === 'dashboard' ? 'button-primary' : 'button-secondary'}`} onClick={() => setView('dashboard')} aria-pressed={view === 'dashboard'}>
            Institutional dashboard
          </button>
        </nav>
      </div>
    </header>

    <RuntimeModeBanner routeMode={runtimeRoute.mode} metadata={runtimeMetadata} fujiReadOnlyStatus={fujiReadOnlyStatus} />

    {view === 'borrower'
      ? <BorrowerWidgetView client={client} evidenceSource={runtimeMetadata?.evidenceSource ?? (runtimeRoute.mode === 'demo' ? 'demo-simulated' : 'fuji-unavailable')} />
      : <InstitutionalDashboardScreen client={client} />}
  </main>;
}

function BorrowerWidgetView({ client, evidenceSource }: { client: ReturnType<typeof createBovedaApiClient>; evidenceSource: RuntimeMetadata['evidenceSource'] }) {
  const journey = useBorrowerJourney(client);
  const wallet = useInjectedWallet();
  const [demoControls, dispatchDemoControls] = useReducer(demoControlsReducer, undefined, createInitialDemoControls);
  const loan = journey.state.selectedLoan;
  const demoView = loan ? deriveDemoView({
    loan,
    events: journey.state.events,
    risk: journey.state.risk ?? loan.riskAssessment,
    lastPayment: journey.state.lastPayment,
    lastLiquidation: journey.state.lastLiquidation
  }, demoControls) : null;
  const displayLoan = demoView?.loan ?? loan;
  const demoStep = demoControls.pathMode ? getCurrentDemoPathStep(demoControls) : null;
  const demoStage = demoStep?.eventType === 'DemoLoanRequested' ? 'request' : demoStep?.eventType === 'DemoRiskChecked' ? 'risk' : 'offer';
  const showLoanActivity = !demoControls.pathMode || !demoStep || ['DemoFiatDeposited', 'DemoCollateralPriceDropped', 'DemoGracePeriodExpired', 'DemoAllPaymentsCompleted', 'DemoCollateralReleased', 'DemoAutomaticLiquidation'].includes(demoStep.eventType);
  const walletAddress = wallet.connection.status === 'connected' ? wallet.connection.address : displayLoan?.borrower.walletAddress;
  const isLoading = journey.state.loadStatus === 'loading' || journey.state.loadStatus === 'idle';

  return <>
    <div className="borrower-actions">
      <button
        className="button button-secondary"
        onClick={journey.reload}
        aria-label="Refresh borrower data"
      >
        Refresh
      </button>
    </div>

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

    {displayLoan ? (
      <div className="borrower-layout">
        <aside className="borrower-sidebar" aria-label="Borrower context">
          <section className="sidebar-section">
            <span className="sidebar-title">Borrower profile</span>
            <p className="sidebar-name">{displayLoan.borrower.displayName}</p>
            <p className="address-line" title={walletAddress}>{walletAddress}</p>
          </section>
          <section className="sidebar-section">
            <span className="sidebar-title">Demo assets</span>
            <div className="asset-pill-row" aria-label="Borrower assets">
              <span className="asset-pill"><span className="asset-dot" aria-hidden="true">$</span>{displayLoan.principal.currency}</span>
              <span className="asset-pill"><span className="asset-dot" aria-hidden="true">◇</span>{displayLoan.collateral.token}</span>
              <span className="asset-pill"><span className="asset-dot" aria-hidden="true">⤫</span>USDC</span>
            </div>
          </section>
          <section className="sidebar-section">
            <span className="sidebar-title">Scenario</span>
            <p className="sidebar-name">{displayLoan.scenario.replaceAll('_', ' ')}</p>
            <p className="sidebar-description">Offer, wallet connection, collateral, receipt, payment attestation, margin call, and liquidation run through the local Batch 2 API.</p>
          </section>
          <DemoControlsPanel
            overrides={demoControls}
            onAction={dispatchDemoControls}
            onReset={() => {
              dispatchDemoControls({ type: 'reset' });
              void journey.reload();
            }}
          />
        </aside>

        <div className="borrower-main">
          <OfferRequestScreen
            loan={displayLoan}
            wallet={wallet.connection}
            quote={demoStage === 'offer' ? journey.state.quote : null}
            risk={demoStage === 'request' ? null : demoView?.risk ?? journey.state.risk ?? displayLoan.riskAssessment}
            action={journey.state.action}
            demoStage={demoStage}
            errors={journey.state.errors}
            onConnectWallet={wallet.connect}
            onCreateQuote={() => journey.createQuote(walletAddress)}
            onAssessRisk={() => journey.assessRisk(walletAddress)}
          />
        </div>

        <aside className="borrower-rail" aria-label="Loan activity and evidence">
          {showLoanActivity ? (
            <LoanActivityScreen
              loan={displayLoan}
              events={demoView?.events ?? journey.state.events}
              lastPayment={demoView?.lastPayment ?? journey.state.lastPayment}
              lastLiquidation={demoView?.lastLiquidation ?? journey.state.lastLiquidation}
              action={journey.state.action}
              errors={journey.state.errors}
              onDeposit={journey.depositCollateral}
              onActivate={journey.activateLoan}
              onAttestPayment={journey.attestPayment}
              onTriggerMarginCall={journey.triggerMarginCall}
              onLiquidate={journey.liquidateLoan}
              evidenceSource={evidenceSource}
            />
          ) : <PendingLoanActivity currentStep={demoStep?.label ?? 'Request loan'} />}
        </aside>
      </div>
    ) : null}
  </>;
}

function PendingLoanActivity({ currentStep }: { currentStep: string }) {
  return (
    <section className="screen-grid" aria-label="Pending loan activity">
      <article className="card">
        <span className="card-kicker">Execution rail</span>
        <h2>Loan activity pending</h2>
        <p>Current step: {currentStep}</p>
        <p className="muted">Receipt, payment evidence, collateral release, and liquidation outputs appear only after the path reaches loan activation or a terminal scenario.</p>
      </article>
    </section>
  );
}

export default App;
