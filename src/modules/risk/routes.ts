import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { WavyNodeAdapter } from '../../adapters/wavyNode.js';
import { hasJsonObjectBody, sendApiError, sendInvalidRequestBody } from '../../api/errors.js';
import { isLoanScenario } from '../../domain/types.js';
import type { RiskAssessmentRequest } from '../../domain/riskEngine.js';
import type { DemoStore } from '../../store/demoStore.js';

type RiskBody = Partial<RiskAssessmentRequest>;

export async function registerRiskRoutes(
  app: FastifyInstance,
  store: DemoStore,
  wavyNode: WavyNodeAdapter
): Promise<void> {
  app.post('/risk/wallet', async (request: FastifyRequest<{ Body: RiskBody }>, reply) => {
    const riskRequest = parseRiskRequest(request.body, reply);
    if (!riskRequest) {
      return reply;
    }

    const assessment = await wavyNode.assessWallet(riskRequest);
    store.saveRiskAssessment(assessment);
    return assessment;
  });
}

function parseRiskRequest(body: RiskBody | undefined, reply: FastifyReply): RiskAssessmentRequest | null {
  if (!hasJsonObjectBody(body)) {
    sendInvalidRequestBody(reply);
    return null;
  }

  if (!body.walletAddress || !body.collateralToken) {
    return invalid(reply, 'Missing walletAddress or collateralToken');
  }

  if (!isLoanScenario(body.scenario)) {
    return invalid(reply, 'Invalid or missing scenario');
  }

  return {
    walletAddress: body.walletAddress,
    scenario: body.scenario,
    collateralToken: body.collateralToken
  };
}

function invalid(reply: FastifyReply, message: string): null {
  sendApiError(reply, 400, 'INVALID_REQUEST', message);
  return null;
}
