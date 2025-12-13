import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { buildApp } from '../src/app.js';
import type { EnvConfig } from '../src/config/env.js';

describe('coordinator service', () => {
  const env: EnvConfig = {
    port: 0,
    host: '127.0.0.1',
    networksSupported: ['devnet', 'testnet', 'mainnet', 'localnet'],
    corsOrigin: true,
    maxIntentTextLen: 500,
    defaultExpiryMinutes: 15,
    defaultMaxSlippageBps: 100,
    parserTimeoutMs: 10_000,
    parserIdempotencyTtlMs: 10 * 60_000,
    parserRateLimitPerMinute: 30,
    openaiApiKey: undefined,
    openaiModel: 'gpt-4o-2024-08-06'
  };

  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    app = buildApp({ env, logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health returns 200 without network', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('network middleware blocks missing network on non-health routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tokens' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: 'Invalid network parameter.',
      code: 'INVALID_NETWORK',
      details: { expected: env.networksSupported }
    });
  });

  it('network middleware blocks invalid network', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tokens?network=bogus' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: 'Invalid network parameter.',
      code: 'INVALID_NETWORK',
      details: { expected: env.networksSupported }
    });
  });

  it('valid network reaches a real route', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tokens?network=devnet' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });
});


