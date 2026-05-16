import { describe, expect, it } from 'vitest';
import { resolveRuntimeRoute, runtimeModeLabel, runtimeModeMismatch } from './runtimeMode.js';

describe('runtime route mode', () => {
  it('maps / to Fuji mode and /demo to demo mode', () => {
    expect(resolveRuntimeRoute('/')).toMatchObject({ mode: 'fuji', pathPrefix: '/' });
    expect(resolveRuntimeRoute('/demo')).toMatchObject({ mode: 'demo', pathPrefix: '/demo' });
    expect(resolveRuntimeRoute('/demo/dashboard')).toMatchObject({ mode: 'demo', pathPrefix: '/demo' });
  });

  it('returns explicit operator labels for route modes and API metadata states', () => {
    expect(runtimeModeLabel({ routeMode: 'fuji' })).toBe('Fuji mode — verifying API runtime evidence.');
    expect(runtimeModeLabel({ routeMode: 'fuji', evidenceSource: 'fuji-live' })).toBe('Fuji live mode — Avalanche Fuji evidence enabled');
    expect(runtimeModeLabel({ routeMode: 'fuji', evidenceSource: 'fuji-unavailable' })).toBe('Fuji mode unavailable — live chain evidence pending. Use /demo for deterministic simulated evidence.');
    expect(runtimeModeLabel({ routeMode: 'fuji', evidenceSource: 'fuji-unavailable', fujiReadOnlyOk: true })).toBe('Fuji contracts reachable (read-only) — write adapter pending. Use /demo for deterministic simulated evidence.');
    expect(runtimeModeLabel({ routeMode: 'demo', evidenceSource: 'demo-simulated' })).toBe('Demo mode — simulated evidence only; no live Fuji finality.');
  });

  it('detects route/API mode mismatches', () => {
    expect(runtimeModeMismatch('demo', { mode: 'fuji', evidenceSource: 'fuji-live', prerequisites: 'ready' })).toMatch(/Route expects demo mode/);
    expect(runtimeModeMismatch('fuji', { mode: 'fuji', evidenceSource: 'fuji-live', prerequisites: 'ready' })).toBeNull();
    expect(runtimeModeMismatch('fuji', null)).toBeNull();
  });
});
