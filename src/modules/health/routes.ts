import type { FastifyInstance } from 'fastify';

export const HEALTH_RESPONSE = {
  ok: true,
  service: 'boveda-demo-api',
  version: '0.1.0-batch0'
} as const;

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => HEALTH_RESPONSE);

  app.get('/health/snowtrace', async () => {
    const apiKey = process.env.SNOWTRACE_API_KEY;
    const baseUrl = process.env.SNOWTRACE_BASE_URL || 'https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api';

    if (!apiKey) {
      return {
        ok: false,
        reason: 'SNOWTRACE_API_KEY not configured'
      };
    }

    try {
      const url = new URL(baseUrl);
      url.searchParams.set('module', 'account');
      url.searchParams.set('action', 'balance');
      url.searchParams.set('address', '0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae');
      url.searchParams.set('tag', 'latest');
      url.searchParams.set('apikey', apiKey);

      const response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });

      if (!response.ok) {
        return {
          ok: false,
          reason: `HTTP ${response.status}`,
          statusCode: response.status
        };
      }

      const body = await response.json();

      if (body.status === '0') {
        return {
          ok: false,
          reason: body.message || 'API returned error status',
          apiMessage: body.message
        };
      }

      return {
        ok: true,
        apiKey: apiKey.substring(0, 10) + '...',
        baseUrl,
        balance: body.result
      };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
        error: String(error)
      };
    }
  });
}
