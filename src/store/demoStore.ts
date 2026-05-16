import type { Loan, LoanScenario, LoanStatus, OnChainEvent, SeedFile } from '../domain/types.js';
import { buildSeedEvents } from './seedEvents.js';

type LoanFilter = {
  scenario?: LoanScenario;
  status?: LoanStatus;
};

type EventFilter = {
  loanId?: string;
};

export class DemoStore {
  private readonly loans: Loan[];
  private readonly events: OnChainEvent[];

  private constructor(seed: SeedFile) {
    this.loans = clone(seed.loans);
    this.events = buildSeedEvents(seed);
  }

  static fromSeed(seed: SeedFile): DemoStore {
    return new DemoStore(seed);
  }

  listLoans(filter: LoanFilter = {}): Loan[] {
    return clone(
      this.loans.filter((loan) => {
        return (!filter.scenario || loan.scenario === filter.scenario) &&
          (!filter.status || loan.status === filter.status);
      })
    );
  }

  getLoan(loanId: string): Loan | undefined {
    const loan = this.loans.find((candidate) => candidate.loanId === loanId);
    return loan ? clone(loan) : undefined;
  }

  listEvents(filter: EventFilter = {}): OnChainEvent[] {
    return clone(
      this.events.filter((event) => !filter.loanId || event.loanId === filter.loanId)
    );
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
