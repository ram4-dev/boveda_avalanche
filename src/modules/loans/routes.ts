import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loanScenarioValues, loanStatusValues } from '../../api/schemas.js';
import { sendApiError } from '../../api/errors.js';
import type { DemoStore } from '../../store/demoStore.js';
import { isLoanScenario, isLoanStatus, type LoanScenario, type LoanStatus } from '../../domain/types.js';

type ListLoansQuery = {
  scenario?: string;
  status?: string;
};

type LoanParams = {
  loanId: string;
};

export async function registerLoanRoutes(app: FastifyInstance, store: DemoStore): Promise<void> {
  app.get('/loans', async (request: FastifyRequest<{ Querystring: ListLoansQuery }>, reply) => {
    const filter = parseLoanFilter(request.query, reply);
    if (!filter) {
      return reply;
    }

    return { loans: store.listLoans(filter) };
  });

  app.get('/loans/:loanId', async (request: FastifyRequest<{ Params: LoanParams }>, reply) => {
    const loan = store.getLoan(request.params.loanId);
    if (!loan) {
      return sendApiError(reply, 404, 'LOAN_NOT_FOUND', `Loan ${request.params.loanId} was not found`);
    }

    return loan;
  });
}

function parseLoanFilter(query: ListLoansQuery, reply: FastifyReply): { scenario?: LoanScenario; status?: LoanStatus } | null {
  if (query.scenario !== undefined && !isLoanScenario(query.scenario)) {
    return invalidFilter(reply, 'scenario', query.scenario, loanScenarioValues);
  }

  if (query.status !== undefined && !isLoanStatus(query.status)) {
    return invalidFilter(reply, 'status', query.status, loanStatusValues);
  }

  return {
    scenario: query.scenario,
    status: query.status
  };
}

function invalidFilter(reply: FastifyReply, name: string, value: string, allowed: readonly string[]): null {
  sendApiError(
    reply,
    400,
    'INVALID_FILTER',
    `Invalid ${name} filter '${value}'. Allowed values: ${allowed.join(', ')}`
  );
  return null;
}
