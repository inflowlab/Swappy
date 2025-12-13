import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type { EnvConfig } from '../src/config/env.js';
import type { IntentAiClient } from '../src/intent/openaiIntentClient.js';

describe('POST /api/intent/free-text', () => {
  const baseEnv: EnvConfig = {
    port: 0,
    host: '127.0.0.1',
    networksSupported: ['devnet'],
    corsOrigin: true,
    maxIntentTextLen: 50,
    defaultExpiryMinutes: 15,
    defaultMaxSlippageBps: 100,
    parserTimeoutMs: 10_000,
    parserIdempotencyTtlMs: 10 * 60_000,
    parserRateLimitPerMinute: 2,
    openaiApiKey: undefined,
    openaiModel: 'gpt-4o-2024-08-06'
  };

  const fixedNow = 1_700_000_000_000; // deterministic timestamp

  let app: ReturnType<typeof buildApp>;
  let openai: IntentAiClient;

  beforeEach(async () => {
    openai = {
      parseIntentFromText: vi.fn()
    };
    app = buildApp({
      env: baseEnv,
      logger: false,
      deps: { openai, nowMs: () => fixedNow }
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('400 INVALID_INPUT for missing text (and does not call OpenAI)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: {}
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Invalid intent text.', code: 'INVALID_INPUT' });
    expect(openai.parseIntentFromText).not.toHaveBeenCalled();
  });

  it('4xx UNPARSEABLE_INTENT for unsupported token mentions (and does not call OpenAI)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: { text: 'Swap 10 BTC to USDC' }
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(res.json()).toEqual({
      error: 'Unable to parse intent. Please rephrase.',
      code: 'UNPARSEABLE_INTENT'
    });
    expect(openai.parseIntentFromText).not.toHaveBeenCalled();
  });

  it('400 INVALID_INPUT for whitespace text (and does not call OpenAI)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: { text: '   ' }
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Invalid intent text.', code: 'INVALID_INPUT' });
    expect(openai.parseIntentFromText).not.toHaveBeenCalled();
  });

  it('400 INVALID_INPUT for overlong text (and does not call OpenAI)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: { text: 'x'.repeat(baseEnv.maxIntentTextLen + 1) }
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Invalid intent text.', code: 'INVALID_INPUT' });
    expect(openai.parseIntentFromText).not.toHaveBeenCalled();
  });

  it('200 parses "Swap 10 SUI to USDC" with deterministic defaults', async () => {
    (openai.parseIntentFromText as ReturnType<typeof vi.fn>).mockResolvedValue({
      sell_symbol: 'SUI',
      buy_symbol: 'USDC',
      sell_amount: '10',
      min_buy_amount: null,
      max_slippage_bps: null,
      expires_in_minutes: null
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: { text: 'Swap 10 SUI to USDC' }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      rawText: 'Swap 10 SUI to USDC',
      parsed: {
        sellToken: '0x2::sui::SUI',
        buyToken: '0xUSDC',
        sellAmount: '10',
        // With token config prices (SUI=3, USDC=1) and default slippage 1%:
        // expected buy = 30, min buy = 29.7
        minBuyAmount: '29.7',
        expiresAtMs: fixedNow + baseEnv.defaultExpiryMinutes * 60_000
      }
    });
  });

  it('200 uses explicit slippage and expiry when provided', async () => {
    (openai.parseIntentFromText as ReturnType<typeof vi.fn>).mockResolvedValue({
      sell_symbol: 'USDC',
      buy_symbol: 'SUI',
      sell_amount: '25',
      min_buy_amount: null,
      max_slippage_bps: 100,
      expires_in_minutes: 30
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: { text: 'Sell 25 USDC for SUI, 1% slippage, 30 minutes' }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.rawText).toBe('Sell 25 USDC for SUI, 1% slippage, 30 minutes');
    expect(body.parsed.sellToken).toBe('0xUSDC');
    expect(body.parsed.buyToken).toBe('0x2::sui::SUI');
    expect(body.parsed.sellAmount).toBe('25');
    expect(body.parsed.expiresAtMs).toBe(fixedNow + 30 * 60_000);
  });

  it('200 uses explicit min_buy_amount when provided', async () => {
    (openai.parseIntentFromText as ReturnType<typeof vi.fn>).mockResolvedValue({
      sell_symbol: 'SUI',
      buy_symbol: 'USDC',
      sell_amount: '1',
      min_buy_amount: '1.9',
      max_slippage_bps: null,
      expires_in_minutes: null
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: { text: 'Swap 1 SUI to USDC, min 1.9 USDC' }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().parsed.minBuyAmount).toBe('1.9');
  });

  it('4xx UNPARSEABLE_INTENT when sell_symbol === buy_symbol', async () => {
    (openai.parseIntentFromText as ReturnType<typeof vi.fn>).mockResolvedValue({
      sell_symbol: 'SUI',
      buy_symbol: 'SUI',
      sell_amount: '1',
      min_buy_amount: null,
      max_slippage_bps: null,
      expires_in_minutes: null
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: { text: 'Swap 1 SUI to SUI' }
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(res.json()).toEqual({
      error: 'Unable to parse intent. Please rephrase.',
      code: 'UNPARSEABLE_INTENT'
    });
  });

  it('4xx UNPARSEABLE_INTENT when amount is invalid/zero', async () => {
    (openai.parseIntentFromText as ReturnType<typeof vi.fn>).mockResolvedValue({
      sell_symbol: 'SUI',
      buy_symbol: 'USDC',
      sell_amount: '0',
      min_buy_amount: null,
      max_slippage_bps: null,
      expires_in_minutes: null
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: { text: 'Swap SUI to USDC' }
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(res.json()).toEqual({
      error: 'Unable to parse intent. Please rephrase.',
      code: 'UNPARSEABLE_INTENT'
    });
  });

  it('5xx PARSER_UNAVAILABLE on OpenAI failure', async () => {
    (openai.parseIntentFromText as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('timeout')
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: { text: 'Swap 10 SUI to USDC' }
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect(res.json()).toEqual({
      error: 'Intent parsing service temporarily unavailable.',
      code: 'PARSER_UNAVAILABLE'
    });
  });

  it('idempotency: same request + key returns cached response (no extra OpenAI call)', async () => {
    (openai.parseIntentFromText as ReturnType<typeof vi.fn>).mockResolvedValue({
      sell_symbol: 'SUI',
      buy_symbol: 'USDC',
      sell_amount: '10',
      min_buy_amount: null,
      max_slippage_bps: null,
      expires_in_minutes: null
    });

    const first = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      headers: { 'idempotency-key': 'abc' },
      payload: { text: 'Swap 10 SUI to USDC' }
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      headers: { 'idempotency-key': 'abc' },
      payload: { text: 'Swap 10 SUI to USDC' }
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.body).toBe(first.body);
    expect(openai.parseIntentFromText).toHaveBeenCalledTimes(1);
  });

  it('idempotency: different key results in a new OpenAI call', async () => {
    (openai.parseIntentFromText as ReturnType<typeof vi.fn>).mockResolvedValue({
      sell_symbol: 'SUI',
      buy_symbol: 'USDC',
      sell_amount: '10',
      min_buy_amount: null,
      max_slippage_bps: null,
      expires_in_minutes: null
    });

    await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      headers: { 'idempotency-key': 'k1' },
      payload: { text: 'Swap 10 SUI to USDC' }
    });
    await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      headers: { 'idempotency-key': 'k2' },
      payload: { text: 'Swap 10 SUI to USDC' }
    });

    expect(openai.parseIntentFromText).toHaveBeenCalledTimes(2);
  });

  it('429 RATE_LIMITED after exceeding per-minute limit', async () => {
    (openai.parseIntentFromText as ReturnType<typeof vi.fn>).mockResolvedValue({
      sell_symbol: 'SUI',
      buy_symbol: 'USDC',
      sell_amount: '10',
      min_buy_amount: null,
      max_slippage_bps: null,
      expires_in_minutes: null
    });

    const r1 = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: { text: 'Swap 10 SUI to USDC' }
    });
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: { text: 'Swap 10 SUI to USDC' }
    });
    const r3 = await app.inject({
      method: 'POST',
      url: '/api/intent/free-text?network=devnet',
      payload: { text: 'Swap 10 SUI to USDC' }
    });

    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r3.statusCode).toBe(429);
    expect(r3.json()).toEqual({ error: 'Too many requests.', code: 'RATE_LIMITED' });
  });
});


