import type { FastifyInstance } from 'fastify';

import { sendHttpError, httpError } from '../errors/httpError.js';
import { getTokenRegistry } from '../tokens/tokenRegistry.js';

export function registerTokenRoutes(app: FastifyInstance): void {
  app.get('/api/tokens', async (request, reply) => {
    // Global network enforcement guarantees this exists + is valid.
    const query = request.query as Record<string, unknown> | undefined;
    const network = typeof query?.network === 'string' ? query.network : '';

    try {
      const tokens = await getTokenRegistry(network);
      reply.code(200).send(tokens);
    } catch {
      // Do not leak filesystem paths, JSON parse errors, or stack traces.
      return sendHttpError(
        reply,
        500,
        httpError('Token registry unavailable.', 'TOKEN_REGISTRY_UNAVAILABLE')
      );
    }
  });
}


