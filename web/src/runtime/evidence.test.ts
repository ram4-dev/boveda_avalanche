import { describe, expect, it } from 'vitest';
import { buildFujiExplorerLink, evidenceBadgeLabel, EVIDENCE_A11Y_LABELS } from './evidence.js';

describe('runtime evidence helpers', () => {
  it('buildFujiExplorerLink returns urls only for fuji-live evidence', () => {
    const txHash = `0x${'a'.repeat(64)}`;
    const address = `0x${'b'.repeat(40)}`;

    expect(buildFujiExplorerLink('tx', txHash, 'fuji-live', 'https://testnet.snowtrace.io')).toBe(`https://testnet.snowtrace.io/tx/${txHash}`);
    expect(buildFujiExplorerLink('address', address, 'fuji-live', 'https://testnet.snowtrace.io')).toBe(`https://testnet.snowtrace.io/address/${address}`);
    expect(buildFujiExplorerLink('block', 12345, 'fuji-live', 'https://testnet.snowtrace.io')).toBe('https://testnet.snowtrace.io/block/12345');
  });

  it('never builds links for demo or unavailable evidence and rejects invalid values', () => {
    const txHash = `0x${'a'.repeat(64)}`;
    const address = `0x${'b'.repeat(40)}`;

    expect(buildFujiExplorerLink('tx', txHash, 'demo-simulated', 'https://testnet.snowtrace.io')).toBeNull();
    expect(buildFujiExplorerLink('address', address, 'fuji-unavailable', 'https://testnet.snowtrace.io')).toBeNull();
    expect(buildFujiExplorerLink('tx', '', 'fuji-live', 'https://testnet.snowtrace.io')).toBeNull();
    expect(buildFujiExplorerLink('tx', '0xabc123', 'fuji-live', 'https://testnet.snowtrace.io')).toBeNull();
    expect(buildFujiExplorerLink('address', '0xnot-an-address', 'fuji-live', 'https://testnet.snowtrace.io')).toBeNull();
    expect(buildFujiExplorerLink('block', -1, 'fuji-live', 'https://testnet.snowtrace.io')).toBeNull();
    expect(buildFujiExplorerLink('block', null, 'fuji-live', 'https://testnet.snowtrace.io')).toBeNull();
    expect(buildFujiExplorerLink('tx', txHash, 'fuji-live', null)).toBeNull();
  });

  it('exposes canonical labels and a11y names', () => {
    expect(evidenceBadgeLabel('fuji-live')).toBe('Fuji live evidence');
    expect(evidenceBadgeLabel('fuji-unavailable')).toBe('Fuji evidence pending/unavailable');
    expect(evidenceBadgeLabel('demo-simulated')).toBe('Simulated demo evidence');

    expect(EVIDENCE_A11Y_LABELS.tx).toBe('View Fuji tx');
    expect(EVIDENCE_A11Y_LABELS.address).toBe('View Fuji contract');
    expect(EVIDENCE_A11Y_LABELS.block).toBe('View Fuji block');
  });
});
