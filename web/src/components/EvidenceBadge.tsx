import type { EvidenceSource } from '../api/types.js';
import { evidenceBadgeLabel } from '../runtime/evidence.js';

export function EvidenceBadge({ source }: { source: EvidenceSource }) {
  return <span className="pill" aria-label={evidenceBadgeLabel(source)}>{evidenceBadgeLabel(source)}</span>;
}
