import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

import type { EnvConfig } from '../config/env.js';

export function registerCors(app: FastifyInstance, env: EnvConfig): void {
  app.register(cors, {
    origin: env.corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  });
}


