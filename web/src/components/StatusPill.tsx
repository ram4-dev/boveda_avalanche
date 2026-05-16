import type { LoanStatus } from '../api/types.js';

export function StatusPill({ status }: { status: LoanStatus }) {
  return <span className={`status-pill status-${status.toLowerCase()}`}>{status}</span>;
}
