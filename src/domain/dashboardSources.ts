export type DashboardDataSourceType = 'api' | 'chain' | 'derived' | 'fallback';

export type DashboardSourceDefinition = {
  field: string;
  source: DashboardDataSourceType;
  dataPath: string;
  backend: string;
  explorer?: string;
  note: string;
};

export const DASHBOARD_SOURCE_MATRIX: DashboardSourceDefinition[] = [
  {
    field: 'dashboard.summary.activePrincipalUsd',
    source: 'derived',
    dataPath: 'buildDashboardSummary(loans, events).activePrincipalUsd',
    backend: 'Derived in backend from loan state and collateral valuation',
    explorer: 'Snowtrace / chain events for loan state and collateral deposits',
    note: 'Active principal is computed by the API from loan records and on-chain collateral value references.'
  },
  {
    field: 'dashboard.summary.activeVaults',
    source: 'derived',
    dataPath: 'buildDashboardSummary(loans, events).activeVaults',
    backend: 'Derived in backend from loan collateral.vaultAddress and active loan status',
    explorer: 'Snowtrace / chain contract state for vaults and loan activation',
    note: 'Counts loans with a linked vault address that are currently active or in margin call.'
  },
  {
    field: 'dashboard.summary.averageLtvBps',
    source: 'derived',
    dataPath: 'buildDashboardSummary(loans, events).averageLtvBps',
    backend: 'Derived in backend from loan current metrics and collateral values',
    explorer: 'Snowtrace / chain + price data used by backend',
    note: 'Average LTV is computed by the API from loan-level current metrics and collateral value.'
  },
  {
    field: 'dashboard.summary.loansInMarginCall',
    source: 'derived',
    dataPath: 'buildDashboardSummary(loans, events).loansInMarginCall',
    backend: 'Derived in backend from loan status values',
    explorer: 'Snowtrace / chain loan status events and state',
    note: 'Order is source-of-truth loan status provided by the API, ideally mirrored from on-chain state.'
  },
  {
    field: 'dashboard.summary.paymentsAttested',
    source: 'chain',
    dataPath: 'buildDashboardSummary(loans, events).paymentsAttested',
    backend: 'Count of InstallmentPaid events returned by API event source',
    explorer: 'Snowtrace / on-chain events for payment attestation',
    note: 'Payment attestation count should come from on-chain event records, returned through the backend.'
  },
  {
    field: 'dashboard.summary.liquidationsExecuted',
    source: 'chain',
    dataPath: 'buildDashboardSummary(loans, events).liquidationsExecuted',
    backend: 'Count of Liquidated events returned by API event source',
    explorer: 'Snowtrace / on-chain events for liquidation',
    note: 'Liquidation events must be sourced from chain event data exposed by the backend.'
  },
  {
    field: 'dashboard.summary.exposureByAsset',
    source: 'derived',
    dataPath: 'buildDashboardSummary(loans, events).exposureByAsset',
    backend: 'Derived in backend from collateral token and valueUsd fields on loans',
    explorer: 'Snowtrace / chain collateral token references',
    note: 'Asset exposure is calculated by the API against loan collateral value data from the backend.'
  },
  {
    field: 'dashboard.summary.recentEvents',
    source: 'chain',
    dataPath: 'store.listEvents()',
    backend: 'Event list served by API from chain-sourced events',
    explorer: 'Snowtrace / on-chain event history',
    note: 'Recent events must be provided by the backend from an on-chain event source or explorer aggregator.'
  },
  {
    field: 'loans',
    source: 'api',
    dataPath: 'store.listLoans()',
    backend: 'Loan list returned by backend store or chain indexer',
    explorer: 'Snowtrace / chain loan state when available',
    note: 'Loan data is delivered through the API; the backend is responsible for keeping it aligned with chain state.'
  },
  {
    field: 'events',
    source: 'chain',
    dataPath: 'store.listEvents()',
    backend: 'Events returned by backend from the chain or event indexer',
    explorer: 'Snowtrace / on-chain logs',
    note: 'Event history is only valid if the backend sources it from on-chain logs or explorer data.'
  }
];
