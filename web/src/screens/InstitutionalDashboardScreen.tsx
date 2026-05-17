import { useEffect, useMemo, useState } from 'react';
import { ApiClientError } from '../api/client.js';
import type { BovedaApiClient, Loan, OnChainEvent, RuntimeMetadata } from '../api/client.js';
import {
  createInitialInstitutionalDashboardState,
  loadInstitutionalDashboard,
  refreshInstitutionalDashboard
} from '../state/institutionalDashboard.js';

type DashboardReadClient = Pick<BovedaApiClient, 'getDashboardSummary' | 'listLoans' | 'listEvents' | 'getLoan'>;
type DashboardMutationClient = Partial<Pick<BovedaApiClient, 'getRuntime' | 'getFujiUsdcBalances' | 'depositCollateral' | 'activateLoan' | 'attestPayment' | 'createMarginCall' | 'liquidateLoan' | 'approveLoan' | 'cancelLoan' | 'createLoan' | 'assessWalletRisk' | 'resetDemo' | 'releaseAndReset'>>;

type Props = {
  client: DashboardReadClient & DashboardMutationClient;
};

type SimStep = 'ingest' | 'approve' | 'deposit' | 'payment' | 'default' | 'liquidate' | 'reset';
type RuntimeWithContracts = RuntimeMetadata & { contracts?: Array<{ name: string; address: string; abiArtifact?: string }>; explorerBaseUrl?: string | null };
type ActiveFilter = 'all' | 'healthy' | 'watch' | 'risk';
type WalletWatchRole = 'borrower' | 'boveda' | 'funding';
type WalletWatchRow = { role: WalletWatchRole; label: string; address: string | null };
type WalletBalanceState = { status: 'idle' | 'loading' | 'ready' | 'error'; balances: Record<string, string>; updatedAt: string | null; error: string | null };

const SIMULATOR_BORROWER_WALLET = '0x6f981Bf8d4fA751db294Bb62dDEB3d904514F2CF';

export function InstitutionalDashboardScreen({ client }: Props) {
  const [state, setState] = useState(createInitialInstitutionalDashboardState);
  const [runtime, setRuntime] = useState<RuntimeWithContracts | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [simStep, setSimStep] = useState<SimStep | null>(null);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [simulatedLoanId, setSimulatedLoanId] = useState<string | null>(null);
  const [simulatedLoanSnapshot, setSimulatedLoanSnapshot] = useState<Loan | null>(null);
  const [walletBalanceState, setWalletBalanceState] = useState<WalletBalanceState>({ status: 'idle', balances: {}, updatedAt: null, error: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [runtimeResult, dashboardState] = await Promise.allSettled([
        client.getRuntime ? client.getRuntime() as Promise<RuntimeWithContracts> : Promise.resolve(null),
        loadInstitutionalDashboard(client, createInitialInstitutionalDashboardState())
      ]);
      if (cancelled) return;
      if (runtimeResult.status === 'fulfilled') setRuntime(runtimeResult.value);
      if (dashboardState.status === 'fulfilled') setState(dashboardState.value);
    }
    void load();
    // Auto-refresh every 15s to keep KPIs and events up to date without manual sync
    const interval = setInterval(() => {
      if (!cancelled) void refresh();
    }, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const selectedLoan = useMemo(() => selectDemoDeal(state.loans), [state.loans]);
  const selectedEvents = useMemo(() => state.events.filter((event) => !selectedLoan || event.loanId === selectedLoan.loanId), [state.events, selectedLoan]);
  const evidenceSource = runtime?.evidenceSource ?? selectedEvents.find((event) => event.payload.evidence?.source)?.payload.evidence?.source ?? 'demo-simulated';
  const operatorName = selectedLoan?.originator.displayName ?? 'Operador';
  const operatorFirstName = operatorName.split(/\s+/)[0] ?? 'Operador';
  const networkName = runtime?.networkName ?? 'Avalanche Fuji';

  const pendingLoans = useMemo(() => state.loans.filter((loan) => loan.status === 'Requested' || loan.status === 'Approved'), [state.loans]);
  const activeLoans = useMemo(() => state.loans.filter((loan) => loan.status === 'Active' || loan.status === 'MarginCall'), [state.loans]);
  const activeGroups = useMemo(() => {
    const healthy = activeLoans.filter((loan) => loan.currentMetrics.currentLtvBps <= loan.terms.marginCallLtvBps * 0.9);
    const watch = activeLoans.filter((loan) => loan.currentMetrics.currentLtvBps > loan.terms.marginCallLtvBps * 0.9 && loan.currentMetrics.currentLtvBps <= loan.terms.marginCallLtvBps);
    const risk = activeLoans.filter((loan) => loan.currentMetrics.currentLtvBps > loan.terms.marginCallLtvBps);
    return { healthy, watch, risk };
  }, [activeLoans]);
  const filteredActiveLoans = activeFilter === 'all' ? activeLoans : activeGroups[activeFilter];

  const refresh = async () => {
    const next = await refreshInstitutionalDashboard(client, { ...state, action: 'refreshing' });
    setState(next);
    return next;
  };

  // simulatorLoan: ONLY the explicitly ingested loan. Null when no loan has been started by the user.
  // This ensures the stepper starts at step 1 on load, never inheriting seed loan status.
  const simulatorLoan = useMemo(() =>
    simulatedLoanId ? state.loans.find((loan) => loan.loanId === simulatedLoanId) ?? (simulatedLoanSnapshot?.loanId === simulatedLoanId ? simulatedLoanSnapshot : null) : null,
    [state.loans, simulatedLoanId, simulatedLoanSnapshot]
  );
  // simulatorTemplate: seed loan used as blueprint when creating a new loan via ingest.
  const simulatorTemplate = simulatorLoan ?? selectedLoan ?? state.loans[0] ?? null;
  const simulatorNext = nextSimulatorStep(simulatorLoan?.status ?? null);
  const watchedWallets = useMemo(() => buildWatchedWallets(simulatorTemplate), [simulatorTemplate]);
  const watchedAddressKey = useMemo(() => watchedWallets.map((wallet) => wallet.address).filter(Boolean).join(','), [watchedWallets]);
  const watchedTokenAddress = simulatorTemplate?.collateral.tokenAddress ?? null;

  useEffect(() => {
    if (!client.getFujiUsdcBalances || !watchedTokenAddress || !watchedAddressKey) {
      setWalletBalanceState({ status: 'idle', balances: {}, updatedAt: null, error: null });
      return;
    }

    let cancelled = false;
    const addresses = watchedAddressKey.split(',').filter(Boolean);
    const poll = async () => {
      setWalletBalanceState((current) => ({ ...current, status: current.updatedAt ? 'ready' : 'loading', error: null }));
      try {
        const result = await client.getFujiUsdcBalances!({ tokenAddress: watchedTokenAddress, addresses });
        if (cancelled) return;
        setWalletBalanceState({
          status: 'ready',
          balances: Object.fromEntries(result.balances.map((balance) => [balance.address.toLowerCase(), balance.formatted])),
          updatedAt: result.updatedAt,
          error: null
        });
      } catch (error) {
        if (cancelled) return;
        setWalletBalanceState((current) => ({
          ...current,
          status: 'error',
          error: error instanceof Error ? error.message : 'No se pudo leer balances Fuji'
        }));
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), 8_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [client, watchedAddressKey, watchedTokenAddress]);

  const runSim = async (step: SimStep, fn: () => Promise<string | void>) => {
    setSimStep(step);
    setSimError(null);
    setSimMessage(null);
    try {
      const msg = await fn();
      if (msg) setSimMessage(msg);
    } catch (error) {
      setSimError(error instanceof Error ? error.message : 'Simulator step failed');
    } finally {
      setSimStep(null);
    }
  };

  const ingestSimulatedLoan = async () => {
    if (!client.createLoan || !client.assessWalletRisk) throw new Error('La API de demo no expone createLoan / assessWalletRisk en este runtime.');
    const template = simulatorTemplate;
    if (!template) throw new Error('Sin loan base en el seed para clonar como solicitud demo.');
    if (client.resetDemo) {
      try { await client.resetDemo(); } catch { /* runtime sin /demo/reset, seguimos */ }
    }
    const borrower = normalizeRequiredWallet({ ...template.borrower, borrowerId: 'borrower-nova-labs-demo', displayName: 'Nova Labs DAO Services', walletAddress: SIMULATOR_BORROWER_WALLET });
    const originator = normalizeOptionalWallet(template.originator);
    const fundingPartner = normalizeOptionalWallet(template.fundingPartner);
    const principal = { ...template.principal, amount: '170', currency: 'MXN' };
    const terms = { ...template.terms, initialLtvBps: 5000 };
    const collateral = {
      ...template.collateral,
      amount: template.collateral.amount,
      tokenAddress: normalizeHexAddress(template.collateral.tokenAddress),
      vaultAddress: null,
      depositTxHash: null
    };
    const assessment = await client.assessWalletRisk({ walletAddress: borrower.walletAddress, scenario: template.scenario, collateralToken: template.collateral.token }) as { riskAssessmentId: string };
    const created = await client.createLoan({
      scenario: template.scenario,
      borrower,
      originator,
      fundingPartner,
      principal,
      collateral,
      terms,
      riskAssessmentId: assessment.riskAssessmentId
    });
    setSimulatedLoanId(created.loanId);
    setSimulatedLoanSnapshot(created);
    await refresh();
    return `Solicitud ${created.loanId} ingresada en Requested.`;
  };

  const approveSimulated = async () => {
    const loan = simulatorLoan;
    if (!loan) throw new Error('No hay solicitud activa para aprobar.');
    if (!client.approveLoan) throw new Error('La API no expone approveLoan en este runtime.');
    const approved = await client.approveLoan(loan.loanId, withLoanSnapshot({ approvedBy: loan.originator.originatorId, fiatDisbursementRef: loan.principal.disbursementRef ?? `demo-${Date.now()}` }, loan));
    setSimulatedLoanSnapshot(approved);
    await refresh();
    return `${loan.loanId} aprobado por ${loan.originator.displayName}.`;
  };

  const depositSimulated = async () => {
    const loan = simulatorLoan;
    if (!loan) throw new Error('No hay solicitud activa para depositar colateral.');
    if (!client.depositCollateral) throw new Error('La API no expone depositCollateral en este runtime.');
    const isFujiLive = runtime?.evidenceSource === 'fuji-live' && runtime?.prerequisites === 'ready';
    if (isFujiLive) {
      const deposited = await client.depositCollateral(loan.loanId, withLoanSnapshot({ token: loan.collateral.token, amount: collateralBaseUnits(loan) }, loan)) as Loan;
      setSimulatedLoanSnapshot(deposited);
      if (client.activateLoan) {
        const activated = await client.activateLoan(loan.loanId, withLoanSnapshot({}, deposited)) as Loan;
        setSimulatedLoanSnapshot(activated);
      }
      await refresh();
      return `${loan.loanId}: colateral depositado on-chain (approve + depositCollateral firmados por BORROWER).`;
    }
    const template = state.loans.find((entry) => entry.collateral.depositTxHash && entry.collateral.vaultAddress) ?? loan;
    const payload = {
      token: loan.collateral.token,
      amount: collateralBaseUnits(loan),
      txHash: template.collateral.depositTxHash ?? loan.collateral.depositTxHash ?? '',
      vaultAddress: template.collateral.vaultAddress ?? loan.collateral.vaultAddress ?? ''
    };
    if (!payload.txHash || !payload.vaultAddress) throw new Error('El demo necesita un tx hash + vault del seed para registrar el depósito.');
    const deposited = await client.depositCollateral(loan.loanId, withLoanSnapshot(payload, loan)) as Loan;
    setSimulatedLoanSnapshot(deposited);
    if (client.activateLoan) {
      const activated = await client.activateLoan(loan.loanId, withLoanSnapshot({}, deposited)) as Loan;
      setSimulatedLoanSnapshot(activated);
    }
    await refresh();
    return `Colateral verificado y vault activo para ${loan.loanId}.`;
  };

  const paymentSimulated = async () => {
    const loan = simulatorLoan;
    if (!loan) throw new Error('No hay préstamo activo para registrar el pago.');
    if (!client.attestPayment) throw new Error('La API no expone attestPayment en este runtime.');
    const payment = await client.attestPayment(loan.loanId, withLoanSnapshot(buildPaymentPayload(loan), loan)) as { status?: Loan['status']; remainingPrincipal?: string };
    setSimulatedLoanSnapshot({
      ...loan,
      status: payment.status ?? loan.status,
      currentMetrics: {
        ...loan.currentMetrics,
        outstandingPrincipal: payment.remainingPrincipal ?? loan.currentMetrics.outstandingPrincipal
      }
    });
    await refresh();
    return `Pago final atestado para ${loan.loanId}. Colateral liberado.`;
  };

  const defaultSimulated = async () => {
    const loan = simulatorLoan;
    if (!loan) throw new Error('No hay préstamo activo para forzar impago.');
    if (!client.createMarginCall) throw new Error('La API no expone createMarginCall en este runtime.');
    const marginCall = await client.createMarginCall(loan.loanId, withLoanSnapshot(buildMarginCallPayload(loan), loan)) as Loan;
    setSimulatedLoanSnapshot(marginCall);
    await refresh();
    return `${loan.loanId} marcado como margin call.`;
  };

  const liquidateSimulated = async () => {
    const loan = simulatorLoan;
    if (!loan) throw new Error('No hay préstamo en margin call para liquidar.');
    if (!client.liquidateLoan) throw new Error('La API no expone liquidateLoan en este runtime.');
    const liquidation = await client.liquidateLoan(loan.loanId, withLoanSnapshot(buildLiquidationPayload(loan), loan)) as { status?: Loan['status'] };
    setSimulatedLoanSnapshot({ ...loan, status: liquidation.status ?? 'Liquidated' });
    await refresh();
    return `${loan.loanId} liquidado. Distribución registrada.`;
  };

  const resetSimulated = async () => {
    // Prefer release-and-reset (returns USDC to borrower on-chain + clears store);
    // fall back to demo-only reset only on Not Found.
    if (client.releaseAndReset) {
      try {
        await client.releaseAndReset();
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404 && client.resetDemo) {
          await client.resetDemo();
        } else {
          throw error;
        }
      }
    } else if (client.resetDemo) {
      await client.resetDemo();
    }
    setSimulatedLoanId(null);
    setSimulatedLoanSnapshot(null);
    await refresh();
    const isFuji = runtime?.evidenceSource === 'fuji-live';
    return isFuji ? 'Vault liberado · USDC devueltos al borrower · historial limpiado.' : 'Demo reiniciada al seed inicial.';
  };

  const now = new Date();
  const headerSub = `${pendingLoans.length} solicitudes pendientes · ${activeLoans.length} préstamos en monitoreo · evidencia ${evidenceSource}`;
  const fundingPartnerName = selectedLoan?.fundingPartner.displayName ?? 'Fondeador';

  return <section className="boveda-ops" aria-label="Dashboard institucional">
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-word">Bóveda</span>
        <span className="crumb-sep" />
        <span className="crumb">{operatorName} <span className="dot">·</span> <span className="here">Resumen</span></span>
      </div>
      <label className="search" aria-label="Buscar en dashboard">
        <input placeholder="Buscar solicitud, wallet o tx hash" readOnly />
        <kbd className="kbd">⌘K</kbd>
      </label>
      <div className="top-right">
        <span className="net-pill"><span className="pulse-dot" />{networkName}</span>
        <button className="icon-btn" type="button" aria-label="Notificaciones"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" /><path d="M9 17a3 3 0 0 0 6 0" /></svg><span className="badge-dot" /></button>
        <button className="icon-btn" type="button" aria-label="Configuración"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.2a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5h.2a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.2a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></svg></button>
        <div className="me">
          <span className="avatar">{operatorName.slice(0, 1)}</span>
          <span className="me-meta"><span className="name">{operatorName}</span><span className="role">{evidenceSource}</span></span>
        </div>
      </div>
    </header>

    <div className="shell">
      <aside className="sidebar" aria-label="Navegación Bóveda">
        <span className="nav-label">Principal</span>
        <NavItem text="Resumen" active />
        <NavItem text="Solicitudes" count={pendingLoans.length} />
        <NavItem text="Préstamos" count={activeLoans.length} />
        <NavItem text="Colateral" />
        <NavItem text="Reportes" />
        <span className="nav-label">Operación</span>
        <NavItem text="Vaults" />
        <NavItem text="Eventos on-chain" />
        <div className="sidebar-foot">
          <div className="funder"><span className="gdot" /><div><div className="lbl">FONDEADOR</div><div className="name">{fundingPartnerName}</div></div></div>
          <div className="credit">
            <div className="row"><span>UTILIZACIÓN</span><b>{formatBps(state.summary?.averageLtvBps ?? 0)}</b></div>
            <div className="meter"><span className="fill" style={{ width: `${Math.min((state.summary?.averageLtvBps ?? 0) / 100, 100)}%` }} /></div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="section-head">
          <div>
            <div className="eyebrow">Resumen · {formatOpsDate(now)} · {networkName}</div>
            <h2 className="section-title">{`Buenas ${timeGreeting(now)}, ${operatorFirstName}.`}</h2>
            <p className="section-sub">{headerSub}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="button">Exportar</button>
            <button className="btn" type="button">Hoy · Semana · Mes</button>
          </div>
        </div>

        {state.status === 'loading' || state.status === 'idle' ? <StatusPanel title="Sincronizando…" body="Bóveda lee runtime, préstamos, eventos y resumen desde la API local." /> : null}
        {state.status === 'error' ? <StatusPanel title="Dashboard no disponible" body="La API no devolvió datos suficientes. Revisá el backend y sincronizá de nuevo." tone="danger" /> : null}
        {state.status === 'partial' ? <StatusPanel title="Evidencia parcial" body="Algunas secciones usan el último valor confirmado; las llamadas no disponibles aparecen en el log." tone="warning" /> : null}
        {state.errors.summary ? <StatusPanel title="Resumen no disponible" body={state.errors.summary.message} tone="warning" /> : null}
        {state.errors.loans ? <StatusPanel title="Préstamos no disponibles" body={state.errors.loans.message} tone="warning" /> : null}
        {state.errors.events ? <StatusPanel title="Eventos no disponibles" body={state.errors.events.message} tone="warning" /> : null}

        <section className="kpis" aria-label="KPIs portafolio">
          <Kpi label="Cartera activa" value={formatNumeric(state.summary?.activePrincipalUsd ?? '0', 6)} unit="USDC" gold detail={`evidencia ${evidenceSource}`} />
          <Kpi label="Vaults activos" value={String(state.summary?.activeVaults ?? 0)} detail="—" />
          <Kpi label="LTV promedio" value={formatBps(state.summary?.averageLtvBps ?? 0)} detail="—" />
          <Kpi label="Margin calls" value={String(state.summary?.loansInMarginCall ?? 0)} detail="—" />
        </section>

        <section className="portfolio-strip">
          <div className="ps-label">Salud del portafolio<b>{state.summary ? `${formatBps(state.summary.averageLtvBps)} LTV promedio` : 'Sin resumen'}</b></div>
          <div className="mono dim" style={{ textAlign: 'center' }}>Serie histórica no disponible · habilitá modo Fuji para registrar evidencia</div>
          <div className="ps-legend">{(state.summary?.exposureByAsset ?? []).map((exposure, index) => <span key={exposure.asset}><i style={{ background: ['#8B5E2A', '#71717A', '#E84142'][index % 3] }} />{exposure.asset}</span>)}</div>
        </section>

        <section className="panel gap-lg sim-panel" aria-label="Simulador end-to-end">
          <div className="panel-head">
            <div className="l">
              <h3 className="panel-title">Simulador end-to-end</h3>
              <span className="panel-sub">{simulatorLoan ? `${simulatorLoan.loanId} · ${simulatorLoan.status}` : 'Sin solicitud activa · listá una nueva para arrancar'}</span>
            </div>
            <div className="panel-actions" style={{ display: 'flex', gap: 8 }}>
              {simulatorLoan && simulatorLoan.status === 'Active' ? <button type="button" className="btn sm" disabled={simStep !== null || !client.createMarginCall} onClick={() => void runSim('default', defaultSimulated)}>{simStep === 'default' ? 'Marcando…' : 'Forzar margin call'}</button> : null}
              {simulatorLoan ? <button type="button" className="btn sm ghost" disabled={simStep !== null} onClick={() => void runSim('reset', resetSimulated)}>{simStep === 'reset' ? 'Reiniciando…' : 'Reset demo'}</button> : null}
            </div>
          </div>
          <div className="sim-body">
            <ol className="sim-stepper" aria-label="Etapas del ciclo de vida">
              {SIMULATOR_STAGES.map((stage) => <li key={stage.id} className={`sim-step ${simulatorStageState(simulatorLoan?.status ?? null, stage.id)}`}><span className="sim-step-dot" /><div><strong>{stage.label}</strong><small>{stage.detail}</small></div></li>)}
            </ol>
            <div className="sim-action-card">
              <span className="eyebrow">Acciones del ciclo</span>
              <strong>{simulatorLoan ? `${simulatorLoan.loanId} · ${simulatorLoan.status}` : 'Sin solicitud activa'}</strong>
              <p className="mono dim" style={{ marginTop: 4 }}>Cada botón dispara el endpoint correspondiente. En modo fuji-live, el backend firma la tx real con el signer del rol. En demo mode, registra eventos simulados.</p>
              <div className="sim-actions-grid">
                {SIMULATOR_ACTIONS.map((action) => {
                  const enabled = isSimActionEnabled(action.id, simulatorLoan?.status ?? null, client);
                  const busy = simStep === action.id;
                  const handler = simHandlers({
                    ingest: ingestSimulatedLoan,
                    approve: approveSimulated,
                    deposit: depositSimulated,
                    payment: paymentSimulated,
                    default: defaultSimulated,
                    liquidate: liquidateSimulated,
                    reset: resetSimulated
                  })[action.id];
                  return <button
                    key={action.id}
                    type="button"
                    className={`sim-action-btn ${action.tone === 'danger' ? 'danger' : action.tone === 'warn' ? 'warn' : 'primary'} ${enabled ? '' : 'is-disabled'}`}
                    disabled={!enabled || simStep !== null}
                    onClick={() => void runSim(action.id, handler)}
                    aria-label={action.label}
                    title={action.description}>
                    <span className="sim-action-step">{action.number}. {action.label}</span>
                    <span className="sim-action-detail">{busy ? 'Ejecutando…' : action.endpoint}</span>
                  </button>;
                })}
              </div>
              {simMessage ? <p className="sim-msg ok" role="status">{simMessage}</p> : null}
              {simError ? <p className="sim-msg err" role="alert">{simError}</p> : null}
              {!simulatorLoan ? <p className="mono dim" style={{ marginTop: 8 }}>Empezá por <b>1. Crear solicitud</b> para originar un loan nuevo. Los pasos posteriores se habilitan a medida que el loan cambia de estado.</p> : null}
            </div>
          </div>
          <WalletBalancesPanel rows={watchedWallets} balanceState={walletBalanceState} />
        </section>

        <section className="panel gap-lg">
          <div className="panel-head"><div className="l"><h3 className="panel-title">Solicitudes pendientes</h3><span className="panel-sub">{pendingLoans.length} esperando decisión</span></div></div>
          <table>
            <thead><tr><th>ID</th><th>Solicitante</th><th className="num">Monto solicitado</th><th>Colateral propuesto</th><th>LTV inicial</th><th>Risk</th><th>AML</th><th>Plazo</th><th className="num">Acción</th></tr></thead>
            <tbody>
              {pendingLoans.length === 0 ? <tr><td colSpan={9} className="mono dim">Sin solicitudes pendientes</td></tr> : pendingLoans.map((loan) => <tr key={loan.loanId}>
                <td className="id">{shortId(loan.loanId)}</td>
                <td className="applicant"><div className="name">{loan.borrower.displayName}</div><div className="rfc">{loan.borrower.borrowerType} · {shortAddress(loan.borrower.walletAddress)}</div></td>
                <td className="num"><span className="amount">{formatTokenAmount(loan.principal.amount, loan.principal.currency, loan.collateral.tokenDecimals)}</span></td>
                <td>{collateralCell(loan)}</td>
                <td><LtvMini value={loan.terms.initialLtvBps} /></td>
                <td>{riskPill(loan.riskAssessment.riskScore)}</td>
                <td>{amlPill(loan.riskAssessment.amlStatus)}</td>
                <td className="mono dim">{formatTenor(loan.terms.tenorDays)}</td>
                <td><div className="row-actions">
                    {loan.status === 'Requested' ? <>
                      <button type="button" className="btn sm" disabled={simStep !== null || !client.approveLoan} onClick={() => {
                        if (!client.approveLoan) return;
                        void runSim('approve', async () => {
                          const fiatDisbursementRef = `spei-${Date.now()}`;
                          const approved = await client.approveLoan!(loan.loanId, withLoanSnapshot({ approvedBy: loan.originator.originatorId, fiatDisbursementRef }, loan));
                          setSimulatedLoanSnapshot(approved);
                          setSimulatedLoanId(loan.loanId);
                          await refresh();
                          return `${loan.borrower.displayName} aprobado.`;
                        });
                      }}>Aceptar</button>
                      <button type="button" className="btn sm" style={{ color: 'var(--red,#DC2626)' }} disabled={simStep !== null || !client.cancelLoan} onClick={() => {
                        if (!client.cancelLoan) return;
                        void runSim('default', async () => {
                          await client.cancelLoan!(loan.loanId, { cancelledBy: loan.originator.originatorId, reason: 'operador-rechazó' });
                          await refresh();
                          return `Solicitud rechazada.`;
                        });
                      }}>Rechazar</button>
                    </> : <>
                      <button type="button" className="btn sm primary" disabled={simStep !== null} onClick={() => {
                        setSimulatedLoanId(loan.loanId);
                      }}>Gestionar</button>
                    </>}
                  </div></td>
              </tr>)}
            </tbody>
          </table>
        </section>

        <section className="split">
          <div className="col">
            <article className="panel">
              <div className="panel-head">
                <div className="l"><h3 className="panel-title">Préstamos activos</h3><span className="panel-sub">Monitoreo en vivo</span></div>
                <div className="filter-pills">
                  <button className={activeFilter === 'all' ? 'on' : ''} onClick={() => setActiveFilter('all')} type="button">Todos <span className="ct">{activeLoans.length}</span></button>
                  <button className={activeFilter === 'healthy' ? 'on' : ''} onClick={() => setActiveFilter('healthy')} type="button">Saludable <span className="ct">{activeGroups.healthy.length}</span></button>
                  <button className={activeFilter === 'watch' ? 'on' : ''} onClick={() => setActiveFilter('watch')} type="button">Watch <span className="ct">{activeGroups.watch.length}</span></button>
                  <button className={activeFilter === 'risk' ? 'on' : ''} onClick={() => setActiveFilter('risk')} type="button">At-risk <span className="ct">{activeGroups.risk.length}</span></button>
                </div>
              </div>
              <table>
                <thead><tr><th>Loan ID</th><th>Prestatario</th><th className="num">Saldo</th><th>Colateral</th><th>LTV actual</th><th>Próximo pago</th><th>Estado</th></tr></thead>
                <tbody>
                  {filteredActiveLoans.length === 0 ? <tr><td colSpan={7} className="mono dim">Sin préstamos activos</td></tr> : filteredActiveLoans.map((loan) => <tr key={loan.loanId}>
                    <td className="id">{shortId(loan.loanId)}</td>
                    <td className="applicant"><div className="name">{loan.borrower.displayName}</div><div className="rfc">{shortAddress(loan.borrower.walletAddress)}</div></td>
                    <td className="num"><span className="amount">{formatTokenAmount(loan.currentMetrics.outstandingPrincipal, loan.currentMetrics.outstandingCurrency, loan.collateral.tokenDecimals)}</span></td>
                    <td>{collateralCell(loan)}</td>
                    <td><LtvMini value={loan.currentMetrics.currentLtvBps} /></td>
                    <td className="pago"><div className="when">{loan.currentMetrics.nextPaymentDueAt ? formatDateShort(loan.currentMetrics.nextPaymentDueAt) : 'Sin fecha'}</div></td>
                    <td>{statePill(loan)}</td>
                  </tr>)}
                </tbody>
              </table>
            </article>
          </div>

          <div className="col">
            <article className="panel">
              <div className="panel-head"><div className="l"><h3 className="panel-title" style={{ fontSize: 18 }}>Eventos on-chain recientes</h3></div><span className="panel-sub"><span className="pulse-dot" /> en vivo <button type="button" className="btn sm ghost" style={{ marginLeft: 8 }} onClick={() => void refresh()}>Sync</button></span></div>
              <div className="feed" aria-live="polite">
                {[...state.events].reverse().slice(0, 7).map((event) => <EventRow key={event.eventId} event={event} explorerBaseUrl={runtime?.explorerBaseUrl ?? null} />)}
                {state.events.length === 0 ? <p className="ev-empty">Sin eventos registrados. Crea una solicitud para empezar.</p> : null}
              </div>
            </article>

            <article className="panel">
              <div className="panel-head"><div className="l"><h3 className="panel-title" style={{ fontSize: 18 }}>Fondeo · {fundingPartnerName}</h3></div></div>
              <div className="bk-body">
                <div className="bk-row"><span className="lbl">Vaults activos</span><span className="val">{state.summary?.activeVaults ?? 0}</span></div>
                <div className="bk-row"><span className="lbl">Principal activo USDC</span><span className="val gold">{formatTokenAmount(state.summary?.activePrincipalUsd ?? '0', 'USDC', 6)}</span></div>
                <div className="bk-progress"><div className="bar"><i style={{ width: `${Math.min((state.summary?.averageLtvBps ?? 0) / 100, 100)}%` }} /></div><div className="legend"><span>0</span><span>{formatBps(state.summary?.averageLtvBps ?? 0)}</span><span>100%</span></div></div>
                <div className="bk-row"><span className="lbl">LTV promedio</span><span className="val">{formatBps(state.summary?.averageLtvBps ?? 0)}</span></div>
                <div className="bk-row"><span className="lbl">Margin calls</span><span className="val">{state.summary?.loansInMarginCall ?? 0}</span></div>
              </div>
              <div className="bk-foot"><span className="verif">evidencia {evidenceSource} · sincronizado {now.toLocaleTimeString('es-MX')}</span></div>
            </article>
          </div>
        </section>

        <div className="footnote"><span>Bóveda · demo build · evidencia {evidenceSource} · runtime {runtime?.mode ?? 'demo'}</span><span>Última sincronización: {now.toLocaleTimeString('es-MX')}</span></div>
      </main>
    </div>
  </section>;
}

function NavItem({ text, count, active = false }: { text: string; count?: number; active?: boolean }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} type="button"><span className="ic">•</span><span>{text}</span><span className="grow" />{count !== undefined ? <span className="nav-badge">{count}</span> : null}</button>;
}

function StatusPanel({ title, body, tone = 'default' }: { title: string; body: string; tone?: 'default' | 'warning' | 'danger' }) {
  return <article className={`ops-panel ops-status ops-status-${tone}`}><h3>{title}</h3><p>{body}</p></article>;
}

function WalletBalancesPanel({ rows, balanceState }: { rows: WalletWatchRow[]; balanceState: WalletBalanceState }) {
  return <div className="wallet-watch" aria-label="Balances USDC Fuji">
    <div className="wallet-watch-head">
      <span>Wallets Fuji</span>
      <strong>USDC en tiempo real</strong>
      <small>{balanceState.status === 'loading' ? 'consultando...' : balanceState.updatedAt ? `sync ${formatEventTime(balanceState.updatedAt)}` : 'esperando RPC'}</small>
    </div>
    <div className="wallet-watch-grid">
      {rows.map((row) => {
        const balance = row.address ? balanceState.balances[row.address.toLowerCase()] : null;
        return <a key={row.role} className={`wallet-card ${!row.address ? 'is-disabled' : ''}`} href={row.address ? avalscanAddressUrl(row.address) : undefined} target="_blank" rel="noreferrer">
          <span className="wallet-role">{row.label}</span>
          <strong>{balanceState.status === 'error' ? '--' : balance ?? '...'} USDC</strong>
          <code>{row.address ? shortAddress(row.address) : 'sin wallet'}</code>
          <small>{row.address ? 'Abrir en AvalScan' : 'No configurada'}</small>
        </a>;
      })}
    </div>
    {balanceState.status === 'error' ? <p className="wallet-watch-error">{balanceState.error}</p> : null}
  </div>;
}

function Kpi({ label, value, detail, unit, gold = false }: { label: string; value: string; detail: string; unit?: string; gold?: boolean }) {
  return <article className="kpi"><div className="kpi-label">{label}</div><div className={`kpi-num ${gold ? 'gold' : ''}`}>{value}{unit ? <span className="unit">{unit}</span> : null}</div><div className="kpi-delta"><span>{detail}</span></div></article>;
}

function EventRow({ event, explorerBaseUrl }: { event: OnChainEvent; explorerBaseUrl: string | null }) {
  const tone = eventTone(event.eventType);
  const meta = eventMeta(event);
  return <div className={`ev ${tone}`}><span className="ico"><span className="d" /></span><span className="ts">{formatEventTime(event.occurredAt)}</span><div className="body"><span className="ttl">{eventLabel(event.eventType)}</span><div className="meta">{meta}{event.txHash ? <> · tx <span className="hash">{explorerBaseUrl ? <a href={`${explorerBaseUrl.replace(/\/$/, '')}/tx/${event.txHash}`}>{shortHash(event.txHash)}</a> : shortHash(event.txHash)}</span></> : null}</div></div></div>;
}

function eventTone(eventType: string): 'ok' | 'neu' | 'bad' | 'warn' {
  if (eventType === 'MarginCall') return 'warn';
  if (eventType === 'Liquidated') return 'bad';
  if (eventType === 'CollateralDeposited' || eventType === 'CollateralReleased' || eventType === 'InstallmentPaid') return 'ok';
  return 'neu';
}

function eventMeta(event: OnChainEvent): string {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.amount === 'string' && typeof payload.token === 'string') return `${payload.amount} ${payload.token}`;
  if (typeof payload.attestationHash === 'string') return `attestation ${shortHash(payload.attestationHash)}`;
  if (typeof payload.vaultAddress === 'string') return `vault ${shortAddress(payload.vaultAddress)}`;
  return event.loanId;
}

function collateralCell(loan: Loan) {
  const token = loan.collateral.token.toUpperCase();
  const tokenClass = token === 'USDC' ? 'usdc' : token === 'USDT' ? 'usdt' : token === 'BTC.B' ? 'btcb' : token === 'AVAX' ? 'avax' : 'multi';
  return <div className="col-coll"><span className={`tok ${tokenClass}`}>{tokenClass === 'usdc' ? '$' : tokenClass === 'usdt' ? '₮' : tokenClass === 'btcb' ? '₿' : tokenClass === 'avax' ? 'A' : '+'}</span><div><div className="coll-amt">{formatTokenAmount(collateralBaseUnits(loan), loan.collateral.token, loan.collateral.tokenDecimals)}</div><div className="coll-conv">≈ {formatTokenAmount(loan.collateral.valueUsd ?? '0', 'USD', 2)}</div></div></div>;
}

function LtvMini({ value }: { value: number }) {
  const pct = value / 100;
  const band = pct <= 60 ? 'green' : pct <= 70 ? 'amber' : 'red';
  return <div className="ltv"><div className="ltv-num">{pct.toFixed(1)}%</div><div className={`ltv-bar ${band}`}><i style={{ width: `${Math.min(pct, 100)}%` }} /></div></div>;
}

function riskPill(score: number) {
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : 'C';
  const cls = score >= 80 ? 'risk-a' : score >= 60 ? 'risk-b' : 'risk-c';
  return <span className={`pill ${cls}`}><span className="grade">{grade}</span><span className="score">· {score}/100</span></span>;
}

function amlPill(amlStatus: string) {
  const map: Record<string, { cls: string; text: string }> = { PASS: { cls: 'clean', text: 'Clean' }, REVIEW: { cls: 'review', text: 'Review' }, BLOCK: { cls: 'blocked', text: 'Blocked' } };
  const current = map[amlStatus] ?? { cls: '', text: amlStatus };
  return <span className={`aml ${current.cls}`}>{current.text}</span>;
}

function statePill(loan: Loan) {
  const current = loan.currentMetrics.currentLtvBps;
  const margin = loan.terms.marginCallLtvBps;
  const cls = current <= margin * 0.9 ? 'healthy' : current <= margin ? 'watch' : 'margin';
  const label = cls === 'healthy' ? 'Saludable' : cls === 'watch' ? 'Watch' : 'Margin call';
  return <span className={`state ${cls}`}><span className="d" />{label}</span>;
}

function formatTenor(days: number): string {
  if (days % 30 === 0) return `${days / 30} meses`;
  return `${days} días`;
}

function shortId(value: string): string { return value.length > 10 ? `${value.slice(0, 10)}…` : value; }

function formatBps(value: number): string { return `${(value / 100).toFixed(1)}%`; }
function formatOpsDate(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').toLowerCase();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} ${month} ${year} · ${time} CDMX`;
}
function timeGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'días';
  if (hour < 19) return 'tardes';
  return 'noches';
}
function formatEventTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
function formatDateShort(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}
function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    LoanCreated: 'Préstamo creado', LoanApproved: 'Aprobación registrada', CollateralDeposited: 'Colateral verificado', LoanActivated: 'Vault activo',
    ReceiptIssued: 'Receipt emitido', InstallmentPaid: 'Pago atestado', CollateralReleased: 'Colateral liberado', MarginCall: 'Margin call enviado', Liquidated: 'Liquidación ejecutada'
  };
  return labels[eventType] ?? eventType;
}

const SIMULATOR_STAGES: Array<{ id: SimStep; label: string; detail: string }> = [
  { id: 'ingest', label: 'Solicitud', detail: 'POST /loans → Requested' },
  { id: 'approve', label: 'Aprobación', detail: 'POST /approve → Approved' },
  { id: 'deposit', label: 'Colateral + vault', detail: 'POST /collateral/deposit + /activate → Active' },
  { id: 'payment', label: 'Pago final', detail: 'POST /payments/attest → Repaid + liberación' },
  { id: 'liquidate', label: 'Liquidación', detail: 'POST /liquidate (alt. impago)' }
];

type SimAction = { id: SimStep; number: number; label: string; description: string; endpoint: string; tone: 'primary' | 'warn' | 'danger' | 'ghost' };

const SIMULATOR_ACTIONS: SimAction[] = [
  { id: 'ingest', number: 1, label: 'Crear solicitud', description: 'POST /risk/wallet + POST /loans. En fuji-live firma LoanRegistry.createLoan con ORIGINATOR.', endpoint: 'POST /loans', tone: 'primary' },
  { id: 'approve', number: 2, label: 'Aprobar crédito', description: 'POST /loans/:id/approve. Off-chain, registra LoanApproved en el store.', endpoint: 'POST /loans/:id/approve', tone: 'primary' },
  { id: 'deposit', number: 3, label: 'Depositar colateral', description: 'POST /loans/:id/collateral/deposit. En fuji-live firma USDC.approve + CollateralVault.depositCollateral con BORROWER, después activa el vault.', endpoint: 'POST /collateral/deposit', tone: 'primary' },
  { id: 'payment', number: 4, label: 'Pago final (camino feliz)', description: 'POST /loans/:id/payments/attest con el monto total. Atesta + setLoanStatus(Repaid) + releaseCollateral.', endpoint: 'POST /payments/attest', tone: 'primary' },
  { id: 'default', number: 5, label: 'Forzar impago', description: 'POST /loans/:id/margin-call. Pasa el loan a MarginCall, dejando listo para liquidar.', endpoint: 'POST /margin-call', tone: 'warn' },
  { id: 'liquidate', number: 6, label: 'Liquidar', description: 'POST /loans/:id/liquidate. setLoanStatus(Defaulted) + canLiquidate + liquidateLoan. Distribuye 10/0.5/4.5 USDC.', endpoint: 'POST /liquidate', tone: 'danger' },
  { id: 'reset', number: 0, label: 'Reset demo', description: 'POST /demo/release-and-reset. Libera vault on-chain (fuji), devuelve USDC al borrower y limpia el historial.', endpoint: 'POST /demo/release-and-reset', tone: 'ghost' }
];

function isSimActionEnabled(id: SimStep, status: Loan['status'] | null, client: { createLoan?: unknown; approveLoan?: unknown; depositCollateral?: unknown; attestPayment?: unknown; createMarginCall?: unknown; liquidateLoan?: unknown; resetDemo?: unknown; releaseAndReset?: unknown }): boolean {
  if (id === 'ingest') return Boolean(client.createLoan);
  // reset works with either release-and-reset (fuji) or demo reset
  if (id === 'reset') return Boolean(client.releaseAndReset ?? client.resetDemo);
  if (!status) return false;
  if (id === 'approve') return status === 'Requested' && Boolean(client.approveLoan);
  if (id === 'deposit') return status === 'Approved' && Boolean(client.depositCollateral);
  if (id === 'payment') return (status === 'Active' || status === 'MarginCall') && Boolean(client.attestPayment);
  if (id === 'default') return status === 'Active' && Boolean(client.createMarginCall);
  if (id === 'liquidate') return (status === 'MarginCall' || status === 'Defaulted') && Boolean(client.liquidateLoan);
  return false;
}

function simHandlers(handlers: Record<SimStep, () => Promise<string | void>>): Record<SimStep, () => Promise<string | void>> {
  return handlers;
}

function simulatorStageState(status: Loan['status'] | null, stage: SimStep): 'done' | 'current' | 'todo' {
  const order: Record<SimStep, number> = { ingest: 0, approve: 1, deposit: 2, payment: 3, default: 3, liquidate: 4, reset: 5 };
  const positionByStatus: Record<NonNullable<Loan['status']>, number> = { Requested: 0, Approved: 1, Active: 2, MarginCall: 3, Defaulted: 3, Repaid: 4, Liquidated: 4, Cancelled: 4 };
  if (!status) return stage === 'ingest' ? 'current' : 'todo';
  const pos = positionByStatus[status] ?? 0;
  const stagePos = order[stage];
  if (stagePos < pos) return 'done';
  if (stagePos === pos) return 'current';
  return 'todo';
}

function nextSimulatorStep(status: Loan['status'] | null): { id: SimStep; label: string; description: string; tone?: 'primary' | 'danger' } | null {
  if (!status) return { id: 'ingest', label: 'Crear solicitud demo', description: 'POST /risk/wallet · POST /loans → deja la solicitud en Requested.', tone: 'primary' };
  if (status === 'Requested') return { id: 'approve', label: 'Aprobar crédito', description: 'POST /loans/:id/approve → registra LoanApproved.', tone: 'primary' };
  if (status === 'Approved') return { id: 'deposit', label: 'Depositar colateral + activar', description: 'POST /collateral/deposit + /activate → vault online.', tone: 'primary' };
  if (status === 'Active') return { id: 'payment', label: 'Atestar pago final', description: 'POST /payments/attest → marca Repaid y libera colateral.', tone: 'primary' };
  if (status === 'MarginCall' || status === 'Defaulted') return { id: 'liquidate', label: 'Liquidar', description: 'POST /loans/:id/liquidate → distribuye desde LiquidationEngine.', tone: 'danger' };
  if (status === 'Repaid' || status === 'Liquidated' || status === 'Cancelled') return { id: 'reset', label: 'Reiniciar demo', description: 'POST /demo/reset → restaura el seed.', tone: 'primary' };
  return null;
}

function normalizeHexAddress(value: string): string;
function normalizeHexAddress(value: string | null | undefined): string | null | undefined;
function normalizeHexAddress(value: string | null | undefined): string | null | undefined {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) ? value.toLowerCase() : value;
}
function normalizeRequiredWallet<T extends { walletAddress: string }>(entity: T): T { return { ...entity, walletAddress: normalizeHexAddress(entity.walletAddress) }; }
function normalizeOptionalWallet<T extends { walletAddress?: string | null }>(entity: T): T { return { ...entity, walletAddress: normalizeHexAddress(entity.walletAddress) }; }

function selectDemoDeal(loans: Loan[]): Loan | null { return loans.find((loan) => loan.loanId === 'loan-sample-arch') ?? loans.find((loan) => loan.scenario === 'WEB3_BRIDGE') ?? loans[0] ?? null; }
function buildWatchedWallets(loan: Loan | null): WalletWatchRow[] {
  return [
    { role: 'borrower', label: 'Borrower', address: SIMULATOR_BORROWER_WALLET },
    { role: 'boveda', label: 'Bóveda', address: loan?.originator.walletAddress ?? null },
    { role: 'funding', label: 'Funding', address: loan?.fundingPartner.walletAddress ?? null }
  ];
}
function avalscanAddressUrl(address: string): string {
  return `https://testnet.avascan.info/blockchain/c/address/${address}`;
}
function buildPaymentPayload(loan: Loan) { return { installmentId: `dashboard-final-${Date.now()}`, amount: loan.currentMetrics.outstandingPrincipal, currency: loan.currentMetrics.outstandingCurrency, paymentRail: loan.principal.fiatRail, paidAt: new Date().toISOString(), externalPaymentRef: 'dashboard-operator-final-payment' }; }
function buildMarginCallPayload(loan: Loan) { return { currentLtvBps: Math.max(loan.terms.liquidationLtvBps, loan.currentMetrics.currentLtvBps), reason: 'dashboard-liquidation-demo' }; }
function buildLiquidationPayload(loan: Loan) { return { reason: 'dashboard-liquidation-demo', proceedsAmount: loan.liquidationPreview.proceedsAmount, proceedsCurrency: 'USDC' as const }; }
function withLoanSnapshot<T extends Record<string, unknown>>(input: T, loan: Loan): T & { loanSnapshot: Loan } { return { ...input, loanSnapshot: loan }; }

function collateralBaseUnits(loan: Loan): string { return loan.collateral.amountBaseUnits ?? baseUnitsFor(loan.collateral.amount, loan.collateral.tokenDecimals); }
function baseUnitsFor(value: string, decimals = 6): string { return value.includes('.') ? String(Math.round(Number(value) * 10 ** decimals)) : value; }
function formatNumeric(value: string, decimals = 6): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const human = numeric >= 10 ** decimals && Number.isInteger(numeric) ? numeric / 10 ** decimals : numeric;
  return human.toLocaleString('es-MX', { maximumFractionDigits: decimals });
}

function formatTokenAmount(value: string, symbol = 'USDC', decimals = 6): string {
  const numeric = Number(value);
  const human = numeric >= 10 ** decimals && Number.isInteger(numeric) ? numeric / 10 ** decimals : numeric;
  return `${human.toLocaleString(undefined, { maximumFractionDigits: decimals })} ${symbol}`;
}
function shortAddress(value: string): string { if (!value || value.length < 12) return value; return `${value.slice(0, 5)}…${value.slice(-4)}`; }
function shortHash(value: string): string { if (!value || value.length < 12) return value; return `${value.slice(0, 5)}…${value.slice(-4)}`; }
