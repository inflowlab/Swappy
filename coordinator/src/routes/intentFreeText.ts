import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

import type { EnvConfig } from '../config/env.js';
import { httpError, sendHttpError } from '../errors/httpError.js';
import type { IntentAiClient } from '../intent/openaiIntentClient.js';
import { IntentError } from '../intent/errors.js';
import { parseFreeTextIntent } from '../intent/parseFreeText.js';
import { getTokenRegistry } from '../tokens/tokenRegistry.js';
import { createFixedWindowRateLimiter, createTtlCache } from '../utils/cache.js';

export type RegisterIntentFreeTextRoutesDeps = {
  env: EnvConfig;
  openai: IntentAiClient | undefined;
  nowMs: () => number;
};

type CachedIntent = {
  textHash: string;
  response: unknown;
};

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function registerIntentFreeTextRoutes(
  app: FastifyInstance,
  deps: RegisterIntentFreeTextRoutesDeps
): void {
  const idempotencyCache = createTtlCache<string, CachedIntent>(
    deps.env.parserIdempotencyTtlMs
  );
  const rateLimiter = createFixedWindowRateLimiter({
    limit: deps.env.parserRateLimitPerMinute,
    windowMs: 60_000
  });

  app.post('/api/intent/free-text', async (request, reply) => {
    // Global network enforcement guarantees this exists + is valid.
    const query = request.query as Record<string, unknown> | undefined;
    const network = typeof query?.network === 'string' ? query.network : '';

    // Basic per-IP rate limiting (protects OpenAI usage)
    const ip = request.ip || 'unknown';
    const rate = rateLimiter.hit(`${network}:${ip}`, deps.nowMs());
    if (!rate.allowed) {
      return sendHttpError(reply, 429, httpError('Too many requests.', 'RATE_LIMITED'));
    }

    // Optional idempotency caching (success responses only)
    const idempotencyKeyRaw =
      (request.headers['idempotency-key'] as string | undefined) ?? undefined;
    const idempotencyKey = idempotencyKeyRaw?.trim() || undefined;

    const now = deps.nowMs();
    const bodyObj = request.body as Record<string, unknown> | undefined;
    const textValue = bodyObj?.text;
    const textHash = typeof textValue === 'string' ? sha256Hex(textValue) : '';

    if (idempotencyKey) {
      const cacheKey = `${network}:${idempotencyKey}`;
      const cached = idempotencyCache.get(cacheKey, now);
      if (cached) {
        if (cached.textHash !== textHash) {
          return sendHttpError(
            reply,
            409,
            httpError('Idempotency key conflict.', 'IDEMPOTENCY_KEY_CONFLICT')
          );
        }
        return reply.code(200).send(cached.response);
      }
    }

    try {
      const response = await parseFreeTextIntent({
        network,
        body: request.body,
        deps: {
          env: deps.env,
          openai: deps.openai,
          nowMs: deps.nowMs,
          getTokenRegistry
        }
      });

      if (idempotencyKey) {
        const cacheKey = `${network}:${idempotencyKey}`;
        idempotencyCache.set(cacheKey, { textHash, response }, now);
      }

      return reply.code(200).send(response);
    } catch (e) {
      if (e instanceof IntentError) {
        return sendHttpError(reply, e.statusCode, httpError(e.safeMessage, e.code, e.details));
      }
      return sendHttpError(
        reply,
        503,
        httpError('Intent parsing service temporarily unavailable.', 'PARSER_UNAVAILABLE')
      );
    }
  });
}


