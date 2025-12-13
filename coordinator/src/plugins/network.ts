import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { EnvConfig } from '../config/env.js';
import { httpError, sendHttpError } from '../errors/httpError.js';

function getPathname(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  const q = rawUrl.indexOf('?');
  return q === -1 ? rawUrl : rawUrl.slice(0, q);
}

export function registerNetworkEnforcement(
  app: FastifyInstance,
  env: EnvConfig
): void {
  const expected = env.networksSupported;
  const expectedSet = new Set(expected);

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const pathname = getPathname(request.raw.url);

    // Explicit exceptions:
    // - /health must always work without query params (readiness/liveness)
    // - OPTIONS is typically a CORS preflight and should not be blocked
    if (pathname === '/health') return;
    if (request.method === 'OPTIONS') return;

    const query = request.query as Record<string, unknown> | undefined;
    const networkRaw = query?.network;
    if (typeof networkRaw !== 'string' || networkRaw.trim() === '') {
      return sendHttpError(
        reply,
        400,
        httpError('Invalid network parameter.', 'INVALID_NETWORK', {
          expected
        })
      );
    }

    const network = networkRaw.trim().toLowerCase();
    if (!expectedSet.has(network)) {
      return sendHttpError(
        reply,
        400,
        httpError('Invalid network parameter.', 'INVALID_NETWORK', {
          expected
        })
      );
    }
  });
}


