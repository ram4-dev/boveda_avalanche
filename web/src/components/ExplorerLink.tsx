import type { EvidenceSource } from '../api/types.js';
import { EVIDENCE_A11Y_LABELS, buildFujiExplorerLink, type FujiExplorerEntity } from '../runtime/evidence.js';

type ExplorerLinkProps = {
  entity: FujiExplorerEntity;
  value: string | number | null | undefined;
  source: EvidenceSource;
  explorerBaseUrl?: string | null;
};

export function ExplorerLink({ entity, value, source, explorerBaseUrl }: ExplorerLinkProps) {
  const href = buildFujiExplorerLink(entity, value, source, explorerBaseUrl);
  if (!href) return null;
  return <a href={href} target="_blank" rel="noreferrer" aria-label={EVIDENCE_A11Y_LABELS[entity]}>{EVIDENCE_A11Y_LABELS[entity]}</a>;
}
