import { describe, expect, it } from 'vitest';
import { buildFastifyApp } from '../src/app.js';

describe('GET /health', () => {
  it('returns the canonical health response', async () => {
    const app = buildFastifyApp();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: 'boveda-demo-api',
      version: '0.1.0-batch0'
    });
  });

  it('keeps the route ready and responds with JSON', async () => {
    const app = buildFastifyApp();
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
  });
});
