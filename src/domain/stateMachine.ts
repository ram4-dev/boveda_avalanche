import type { LoanStatus } from './types.js';

const allowedTransitions: Record<LoanStatus, LoanStatus[]> = {
  Requested: ['Approved', 'Cancelled'],
  Approved: ['Active', 'Cancelled'],
  Active: ['MarginCall', 'Repaid', 'Defaulted'],
  MarginCall: ['Active', 'Defaulted', 'Liquidated', 'Repaid'],
  Defaulted: ['Liquidated'],
  Repaid: [],
  Liquidated: [],
  Cancelled: []
};

export function canTransition(from: LoanStatus, to: LoanStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function isTerminalStatus(status: LoanStatus): boolean {
  return allowedTransitions[status].length === 0;
}
