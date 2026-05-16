import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasJsonObjectBody, sendApiError, sendInvalidRequestBody } from '../../api/errors.js';
import { isLoanScenario } from '../../domain/types.js';
import { createQuote, type QuoteRequest } from '../../domain/quoteEngine.js';

type QuoteBody = Partial<QuoteRequest>;

export async function registerQuoteRoutes(app: FastifyInstance): Promise<void> {
  app.post('/quotes', async (request: FastifyRequest<{ Body: QuoteBody }>, reply) => {
    const quoteRequest = parseQuoteRequest(request.body, reply);
    if (!quoteRequest) {
      return reply;
    }

    return createQuote(quoteRequest);
  });
}

function parseQuoteRequest(body: QuoteBody | undefined, reply: FastifyReply): QuoteRequest | null {
  if (!hasJsonObjectBody(body)) {
    sendInvalidRequestBody(reply);
    return null;
  }

  if (!isLoanScenario(body.scenario)) {
    return invalid(reply, 'Invalid or missing scenario');
  }

  if (!body.requestedPrincipal?.amount || !body.requestedPrincipal.currency) {
    return invalid(reply, 'Invalid or missing requestedPrincipal');
  }

  if (!body.borrowerWallet || !body.collateralToken) {
    return invalid(reply, 'Missing borrowerWallet or collateralToken');
  }

  return {
    scenario: body.scenario,
    borrowerWallet: body.borrowerWallet,
    requestedPrincipal: body.requestedPrincipal,
    collateralToken: body.collateralToken,
    collateralValueUsd: body.collateralValueUsd
  };
}

function invalid(reply: FastifyReply, message: string): null {
  sendApiError(reply, 400, 'INVALID_REQUEST', message);
  return null;
}
