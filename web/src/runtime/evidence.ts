import type { EvidenceSource } from '../api/types.js';

export type FujiExplorerEntity = 'tx' | 'address' | 'block';

export const EVIDENCE_BADGE_LABELS: Record<EvidenceSource, string> = {
  'demo-simulated': 'Simulated demo evidence',
  'fuji-live': 'Fuji live evidence',
  'fuji-unavailable': 'Fuji evidence pending/unavailable'
};

export const EVIDENCE_A11Y_LABELS: Record<FujiExplorerEntity, string> = {
  tx: 'View Fuji tx',
  address: 'View Fuji contract',
  block: 'View Fuji block'
};

export function evidenceBadgeLabel(source: EvidenceSource): string {
  return EVIDENCE_BADGE_LABELS[source];
}

export function buildFujiExplorerLink(entity: FujiExplorerEntity, value: string | number | null | undefined, evidenceSource: EvidenceSource, explorerBaseUrl?: string | null): string | null {
  if (evidenceSource !== 'fuji-live') return null;
  if (!explorerBaseUrl?.trim()) return null;
  if (value === null || value === undefined) return null;

  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!isValidFujiExplorerValue(entity, normalizedValue)) return null;

  const baseUrl = explorerBaseUrl.replace(/\/$/, '');
  return `${baseUrl}/${entity}/${normalizedValue}`;
}

function isValidFujiExplorerValue(entity: FujiExplorerEntity, value: string): boolean {
  if (entity === 'tx') return /^0x[a-fA-F0-9]{64}$/.test(value);
  if (entity === 'address') return /^0x[a-fA-F0-9]{40}$/.test(value);

  const blockNumber = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(blockNumber) && blockNumber >= 0;
}
