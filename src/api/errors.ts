import type { FastifyReply } from 'fastify';

export type ApiErrorCode = 'INVALID_FILTER' | 'LOAN_NOT_FOUND';

export function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string
): FastifyReply {
  return reply.status(statusCode).send({ error: { code, message } });
}
