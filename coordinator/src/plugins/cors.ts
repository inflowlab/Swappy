import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

import type { EnvConfig } from '../config/env.js';

export function registerCors(app: FastifyInstance, env: EnvConfig): void {
  app.register(cors, {
    origin: env.corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    // Frontend uses Idempotency-Key for parse requests; include it to satisfy CORS preflight.
    allowedHeaders: ['Content-Type', 'Idempotency-Key']
  });
}


