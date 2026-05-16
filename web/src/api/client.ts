import { ApiClientError } from './errors.js';
import type { ActivateLoanRequest, ApproveLoanRequest, CollateralDepositRequest, CollateralTopUpRequest, DashboardSummary, DataSourcesResponse, EventsResponse, LiquidationRequest, Loan, LoanScenario, LoansResponse, LoanStatus, MarginCallRequest, PaymentAttestationRequest, QuoteRequest, RiskAssessmentRequest } from './types.js';
export { ApiClientError } from './errors.js';
export type * from './types.js';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ClientOptions = { baseUrl?: string; fetch?: FetchLike };

export function resolveApiBaseUrl(env: Record<string, string | undefined> = (import.meta as unknown as { env?: Record<string, string> }).env ?? {}): string {
  return (env.VITE_BOVEDA_API_BASE_URL ?? '').replace(/\/$/, '');
}

export function createBovedaApiClient(options: ClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? resolveApiBaseUrl()).replace(/\/$/, '');
  const fetcher = options.fetch ?? fetch.bind(globalThis);

  return {
    getDashboardSummary: (): Promise<DashboardSummary> => request(fetcher, url(baseUrl, '/dashboard/summary'), { method: 'GET' }) as Promise<DashboardSummary>,
    listLoans: (filter?: { scenario?: LoanScenario; status?: LoanStatus }): Promise<LoansResponse> => request(fetcher, url(baseUrl, '/loans', filter), { method: 'GET' }) as Promise<LoansResponse>,
    getLoan: (loanId: string): Promise<Loan> => request(fetcher, url(baseUrl, `/loans/${encodePath(loanId)}`), { method: 'GET' }) as Promise<Loan>,
    createQuote: (input: QuoteRequest) => post(fetcher, url(baseUrl, '/quotes'), input),
    assessWalletRisk: (input: RiskAssessmentRequest) => post(fetcher, url(baseUrl, '/risk/wallet'), input),
    depositCollateral: (loanId: string, input: CollateralDepositRequest) => post(fetcher, url(baseUrl, `/loans/${encodePath(loanId)}/collateral/deposit`), input),
    topUpCollateral: (loanId: string, input: CollateralTopUpRequest) => post(fetcher, url(baseUrl, `/loans/${encodePath(loanId)}/collateral/top-up`), input),
    approveLoan: (loanId: string, input: ApproveLoanRequest) => post(fetcher, url(baseUrl, `/loans/${encodePath(loanId)}/approve`), input),
    activateLoan: (loanId: string, input: ActivateLoanRequest = {}) => post(fetcher, url(baseUrl, `/loans/${encodePath(loanId)}/activate`), input),
    attestPayment: (loanId: string, input: PaymentAttestationRequest) => post(fetcher, url(baseUrl, `/loans/${encodePath(loanId)}/payments/attest`), input),
    createMarginCall: (loanId: string, input: MarginCallRequest) => post(fetcher, url(baseUrl, `/loans/${encodePath(loanId)}/margin-call`), input),
    liquidateLoan: (loanId: string, input: LiquidationRequest) => post(fetcher, url(baseUrl, `/loans/${encodePath(loanId)}/liquidate`), input),
    listEvents: (filter?: { loanId?: string }): Promise<EventsResponse> => request(fetcher, url(baseUrl, '/events', filter), { method: 'GET' }) as Promise<EventsResponse>,
    getDashboardDataSources: (): Promise<DataSourcesResponse> => request(fetcher, url(baseUrl, '/dashboard/data-sources'), { method: 'GET' }) as Promise<DataSourcesResponse>
  };
}

export type BovedaApiClient = ReturnType<typeof createBovedaApiClient>;

function post(fetcher: FetchLike, endpoint: string, body: unknown) {
  return request(fetcher, endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function request(fetcher: FetchLike, endpoint: string, init: RequestInit) {
  const response = await fetcher(endpoint, init);
  const body = await parseResponse(response);
  if (!response.ok) {
    const canonical = isCanonicalError(body) ? body.error : null;
    throw new ApiClientError(response.status, canonical?.code ?? `HTTP_${response.status}`, canonical?.message ?? String(body || response.statusText || 'Request failed'));
  }
  return body;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return response.json();
  const text = await response.text();
  return text || response.statusText;
}

function isCanonicalError(body: unknown): body is { error: { code: string; message: string } } {
  return typeof body === 'object' && body !== null && 'error' in body && typeof (body as { error?: { code?: unknown; message?: unknown } }).error?.code === 'string' && typeof (body as { error?: { code?: unknown; message?: unknown } }).error?.message === 'string';
}

function url(baseUrl: string, path: string, query?: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return `${baseUrl}${path}${qs ? `?${qs}` : ''}`;
}

function encodePath(value: string): string {
  return encodeURIComponent(value);
}
