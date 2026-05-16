import type { FastifyReply } from 'fastify';

export type ApiErrorCode =
  | 'INVALID_FILTER'
  | 'INVALID_REQUEST'
  | 'INVALID_TRANSITION'
  | 'RISK_ASSESSMENT_NOT_FOUND'
  | 'LOAN_NOT_FOUND'
  | 'WEB3_ACTION_FAILED';

export function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string
): FastifyReply {
  return reply.status(statusCode).send({ error: { code, message } });
}

export function hasJsonObjectBody<TBody>(body: TBody | null | undefined): body is TBody {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

export function sendInvalidRequestBody(reply: FastifyReply): FastifyReply {
  return sendApiError(reply, 400, 'INVALID_REQUEST', 'Request body must be a JSON object');
}
