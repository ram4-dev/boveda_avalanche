import type { Loan, LoanScenario, LoanStatus, OnChainEvent, RiskAssessment, SeedFile } from '../domain/types.js';
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
  private readonly riskAssessments: Map<string, RiskAssessment>;

  private constructor(seed: SeedFile) {
    this.loans = clone(seed.loans);
    this.events = buildSeedEvents(seed);
    this.riskAssessments = new Map(seed.loans.map((loan) => [loan.riskAssessment.riskAssessmentId, clone(loan.riskAssessment)]));
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

  createLoan(loan: Loan): Loan {
    this.loans.push(clone(loan));
    return clone(loan);
  }

  replaceLoan(loan: Loan): Loan {
    const index = this.loans.findIndex((candidate) => candidate.loanId === loan.loanId);
    if (index === -1) {
      throw new Error(`Loan ${loan.loanId} was not found`);
    }
    this.loans[index] = clone(loan);
    return clone(loan);
  }

  listEvents(filter: EventFilter = {}): OnChainEvent[] {
    return clone(
      this.events.filter((event) => !filter.loanId || event.loanId === filter.loanId)
    );
  }

  appendEvent(event: Omit<OnChainEvent, 'eventId' | 'occurredAt'>): OnChainEvent {
    const nextIndex = this.events.length + 1;
    const occurredAt = new Date(Date.parse('2026-05-15T00:00:00.000Z') + (nextIndex - 1) * 1000).toISOString();
    const stored: OnChainEvent = {
      ...clone(event),
      eventId: `evt-${String(nextIndex).padStart(6, '0')}`,
      occurredAt
    };
    this.events.push(stored);
    return clone(stored);
  }

  saveRiskAssessment(assessment: RiskAssessment): void {
    this.riskAssessments.set(assessment.riskAssessmentId, clone(assessment));
  }

  getRiskAssessment(riskAssessmentId: string): RiskAssessment | undefined {
    const assessment = this.riskAssessments.get(riskAssessmentId);
    return assessment ? clone(assessment) : undefined;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
