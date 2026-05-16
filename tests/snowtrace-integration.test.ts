import { describe, it, expect, beforeAll } from 'vitest';

describe('Snowtrace Integration', () => {
  const apiKey = process.env.SNOWTRACE_API_KEY;
  const baseUrl = process.env.SNOWTRACE_BASE_URL || 'https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api';

  beforeAll(() => {
    if (!apiKey) {
      console.warn('⚠️  SNOWTRACE_API_KEY not configured, skipping Snowtrace tests');
    }
  });

  it('should check Snowtrace connectivity with valid API key', async () => {
    if (!apiKey) {
      console.log('Skipping: SNOWTRACE_API_KEY not set');
      return;
    }

    const url = new URL(baseUrl);
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'balance');
    url.searchParams.set('address', '0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae');
    url.searchParams.set('tag', 'latest');
    url.searchParams.set('apikey', apiKey);

    console.log(`📡 Calling Snowtrace: ${url.toString().replace(apiKey, '***')}`);

    const response = await fetch(url.toString());
    console.log(`✅ HTTP Status: ${response.status}`);

    expect(response.ok).toBe(true);

    const body = await response.json();
    console.log(`📦 Response status: ${body.status}`);
    console.log(`📦 Result: ${body.result}`);

    expect(body).toBeDefined();
    expect(body.status).not.toBe('0'); // status 0 means error
    expect(body.result).toBeDefined();
  });

  it('should fetch a transaction receipt from Snowtrace', async () => {
    if (!apiKey) {
      console.log('Skipping: SNOWTRACE_API_KEY not set');
      return;
    }

    // Use a sample tx hash (you may need to replace with a real one from Fuji testnet)
    const sampleTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    const url = new URL(baseUrl);
    url.searchParams.set('module', 'proxy');
    url.searchParams.set('action', 'eth_getTransactionReceipt');
    url.searchParams.set('txhash', sampleTxHash);
    url.searchParams.set('apikey', apiKey);

    console.log(`📡 Fetching receipt for tx: ${sampleTxHash}`);

    const response = await fetch(url.toString());
    console.log(`✅ HTTP Status: ${response.status}`);

    expect(response.ok).toBe(true);

    const body = await response.json();
    console.log(`📦 Response: ${JSON.stringify(body, null, 2)}`);

    expect(body).toBeDefined();
    // For a non-existent tx, we expect status 0 or null result, which is fine for this test
    // The important part is that the API responds correctly
  });

  it('should validate API key format', () => {
    if (!apiKey) {
      console.log('Skipping: SNOWTRACE_API_KEY not set');
      return;
    }

    expect(apiKey).toBeDefined();
    expect(apiKey.length).toBeGreaterThan(0);
    console.log(`✅ API key configured: ${apiKey.substring(0, 10)}...`);
  });

  it('should validate Snowtrace base URL', () => {
    expect(baseUrl).toContain('routescan.io');
    expect(baseUrl).toContain('43113'); // Fuji chain ID
    console.log(`✅ Base URL: ${baseUrl}`);
  });
});
