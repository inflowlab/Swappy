import type { FastifyReply } from 'fastify';

export type HttpErrorDetails = Record<string, unknown>;

export type HttpErrorPayload = {
  error: string;
  code: string;
  details?: HttpErrorDetails;
};

export function httpError(
  error: string,
  code: string,
  details?: HttpErrorDetails
): HttpErrorPayload {
  return details ? { error, code, details } : { error, code };
}

export function sendHttpError(
  reply: FastifyReply,
  statusCode: number,
  payload: HttpErrorPayload
): void {
  reply.code(statusCode).send(payload);
}

export function internalServerErrorPayload(): HttpErrorPayload {
  return httpError('Internal server error.', 'INTERNAL_SERVER_ERROR');
}


