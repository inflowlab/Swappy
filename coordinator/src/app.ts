import Fastify, { type FastifyInstance } from 'fastify';

import { loadEnv, type EnvConfig } from './config/env.js';
import { internalServerErrorPayload, sendHttpError, httpError } from './errors/httpError.js';
import { registerCors } from './plugins/cors.js';
import { registerNetworkEnforcement } from './plugins/network.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerTokenRoutes } from './routes/tokens.js';
import { registerIntentFreeTextRoutes } from './routes/intentFreeText.js';
import { createOpenAiIntentClient, type IntentAiClient } from './intent/openaiIntentClient.js';

export type BuildAppOptions = {
  env?: EnvConfig;
  logger?: boolean;
  deps?: {
    openai?: IntentAiClient;
    nowMs?: () => number;
  };
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const env = options.env ?? loadEnv();
  const app = Fastify({ logger: options.logger ?? false });
  const nowMs = options.deps?.nowMs ?? (() => Date.now());
  const openai =
    options.deps?.openai ??
    (env.openaiApiKey ? createOpenAiIntentClient(env.openaiApiKey) : undefined);

  // Global middleware / plugins
  registerCors(app, env);
  registerNetworkEnforcement(app, env);

  // Routes
  registerHealthRoutes(app);
  registerTokenRoutes(app);
  registerIntentFreeTextRoutes(app, { env, openai, nowMs });

  // Canonical error handling (no raw Fastify errors leak)
  app.setNotFoundHandler((request, reply) => {
    sendHttpError(reply, 404, httpError('Not found.', 'NOT_FOUND', { path: request.url }));
  });

  app.setErrorHandler((err, _request, reply) => {
    if (reply.sent) return;

    // Fastify uses statusCode on many errors (validation, etc.)
    const statusCode =
      typeof (err as { statusCode?: unknown }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 500;

    if (statusCode >= 400 && statusCode < 500) {
      return sendHttpError(reply, statusCode, httpError('Bad request.', 'BAD_REQUEST'));
    }

    return sendHttpError(reply, 500, internalServerErrorPayload());
  });

  return app;
}


