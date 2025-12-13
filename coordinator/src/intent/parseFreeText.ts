import type { EnvConfig } from '../config/env.js';
import type { TokenRegistryEntry } from '../models/token.js';
import type { IntentAiClient } from './openaiIntentClient.js';
import type { IntentFreeTextSuccessResponse } from './types.js';
import type { IntentStructuredOutput } from './structuredOutput.js';
import { IntentError } from './errors.js';
import { formatBigIntToDecimal, parseDecimalToBigInt, parseUsdPriceToMicros } from '../utils/decimal.js';

export type ParseFreeTextDeps = {
  env: EnvConfig;
  openai: IntentAiClient | undefined;
  nowMs: () => number;
  getTokenRegistry: (network: string) => Promise<readonly TokenRegistryEntry[]>;
};

export async function postProcessStructuredIntent(args: {
  network: string;
  rawText: string;
  structured: IntentStructuredOutput;
  deps: ParseFreeTextDeps;
}): Promise<IntentFreeTextSuccessResponse> {
  const { deps } = args;
  const env = deps.env;

  assertValidStructuredOutput(args.structured);

  const sellSymbol = normalizeSymbol(args.structured.sell_symbol);
  const buySymbol = normalizeSymbol(args.structured.buy_symbol);
  if (sellSymbol === buySymbol) {
    throw new IntentError({
      statusCode: 422,
      code: 'UNPARSEABLE_INTENT',
      safeMessage: 'Unable to parse intent. Please rephrase.'
    });
  }

  // Supported pair check (MVP: SUI <-> USDC)
  const pair = `${sellSymbol}->${buySymbol}`;
  if (pair !== 'SUI->USDC' && pair !== 'USDC->SUI') {
    throw new IntentError({
      statusCode: 422,
      code: 'UNPARSEABLE_INTENT',
      safeMessage: 'Unable to parse intent. Please rephrase.'
    });
  }

  const registry = await deps.getTokenRegistry(args.network);
  const sellToken = pickTokenBySymbol(registry, sellSymbol);
  const buyToken = pickTokenBySymbol(registry, buySymbol);

  // Validate sell amount is a positive decimal at token precision
  const sellAtomic = parseDecimalToBigInt(args.structured.sell_amount, sellToken.decimals);
  if (sellAtomic <= 0n) {
    throw new IntentError({
      statusCode: 422,
      code: 'UNPARSEABLE_INTENT',
      safeMessage: 'Unable to parse intent. Please rephrase.'
    });
  }
  const sellAmount = formatBigIntToDecimal(sellAtomic, sellToken.decimals);

  const now = deps.nowMs();
  const expiresAtMs = computeExpiresAtMs(now, env, args.structured.expires_in_minutes);

  const minBuyAmount = computeMinBuyAmountDecimal({
    env,
    sellToken,
    buyToken,
    sellAmountDecimal: sellAmount,
    minBuyAmountDecimal: args.structured.min_buy_amount,
    maxSlippageBps: args.structured.max_slippage_bps
  });

  return {
    rawText: args.rawText,
    parsed: {
      sellToken: sellToken.id,
      buyToken: buyToken.id,
      sellAmount,
      minBuyAmount,
      expiresAtMs
    }
  };
}

function validateInputText(text: unknown, env: EnvConfig): string {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new IntentError({
      statusCode: 400,
      code: 'INVALID_INPUT',
      safeMessage: 'Invalid intent text.'
    });
  }
  if (text.length > env.maxIntentTextLen) {
    throw new IntentError({
      statusCode: 400,
      code: 'INVALID_INPUT',
      safeMessage: 'Invalid intent text.'
    });
  }
  return text;
}

function extractExplicitSymbolsFromText(text: string): string[] {
  // Deterministic, conservative extraction: only match symbols in common swap phrasing.
  // Examples:
  // - "Swap 10 SUI to USDC"
  // - "Sell 25 USDC for SUI"
  // - "min 1.9 USDC"
  const symbols: string[] = [];
  const amountSymbol = /\b(?:swap|sell)\s+\d+(?:\.\d+)?\s+([a-z]{2,10})\b/gi;
  const toFor = /\b(?:to|for)\s+([a-z]{2,10})\b/gi;
  const min = /\bmin\s+\d+(?:\.\d+)?\s+([a-z]{2,10})\b/gi;

  for (const m of text.matchAll(amountSymbol)) symbols.push(m[1] ?? '');
  for (const m of text.matchAll(toFor)) symbols.push(m[1] ?? '');
  for (const m of text.matchAll(min)) symbols.push(m[1] ?? '');

  return symbols.map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0);
}

function rejectUnsupportedTokenMentions(text: string): void {
  const allowed = new Set(['SUI', 'USDC']);
  const extracted = extractExplicitSymbolsFromText(text);
  for (const sym of extracted) {
    if (!allowed.has(sym)) {
      throw new IntentError({
        statusCode: 422,
        code: 'UNPARSEABLE_INTENT',
        safeMessage: 'Unable to parse intent. Please rephrase.'
      });
    }
  }
}

function normalizeSymbol(symbol: string): 'SUI' | 'USDC' {
  const s = symbol.trim().toUpperCase();
  if (s === 'SUI' || s === 'USDC') return s;
  // Should never happen if OpenAI output is schema-valid, but treat as unparseable.
  throw new IntentError({
    statusCode: 422,
    code: 'UNPARSEABLE_INTENT',
    safeMessage: 'Unable to parse intent. Please rephrase.'
  });
}

function pickTokenBySymbol(
  tokens: readonly TokenRegistryEntry[],
  symbol: string
): TokenRegistryEntry {
  const match = tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
  if (!match) {
    throw new IntentError({
      statusCode: 422,
      code: 'UNPARSEABLE_INTENT',
      safeMessage: 'Unable to parse intent. Please rephrase.'
    });
  }
  return match;
}

function assertValidStructuredOutput(o: IntentStructuredOutput): void {
  const hasMin = o.min_buy_amount !== null && o.min_buy_amount !== undefined;
  const hasSlip = o.max_slippage_bps !== null && o.max_slippage_bps !== undefined;
  if (hasMin && hasSlip) {
    throw new IntentError({
      statusCode: 422,
      code: 'UNPARSEABLE_INTENT',
      safeMessage: 'Unable to parse intent. Please rephrase.'
    });
  }
}

function computeExpiresAtMs(nowMs: number, env: EnvConfig, expiresInMinutes: number | null): number {
  const minutes = expiresInMinutes ?? env.defaultExpiryMinutes;
  if (minutes < 1 || minutes > 1440) {
    throw new IntentError({
      statusCode: 422,
      code: 'UNPARSEABLE_INTENT',
      safeMessage: 'Unable to parse intent. Please rephrase.'
    });
  }
  return nowMs + minutes * 60_000;
}

function computeMinBuyAmountDecimal(args: {
  env: EnvConfig;
  sellToken: TokenRegistryEntry;
  buyToken: TokenRegistryEntry;
  sellAmountDecimal: string;
  minBuyAmountDecimal: string | null;
  maxSlippageBps: number | null;
}): string {
  // Explicit min amount wins.
  if (args.minBuyAmountDecimal !== null && args.minBuyAmountDecimal !== undefined) {
    // Validate it is a parseable positive decimal at buy token precision.
    const minAtomic = parseDecimalToBigInt(args.minBuyAmountDecimal, args.buyToken.decimals);
    if (minAtomic <= 0n) {
      throw new IntentError({
        statusCode: 422,
        code: 'UNPARSEABLE_INTENT',
        safeMessage: 'Unable to parse intent. Please rephrase.'
      });
    }
    return formatBigIntToDecimal(minAtomic, args.buyToken.decimals);
  }

  const slippageBps = args.maxSlippageBps ?? args.env.defaultMaxSlippageBps;
  if (slippageBps < 0 || slippageBps > 5000) {
    throw new IntentError({
      statusCode: 422,
      code: 'UNPARSEABLE_INTENT',
      safeMessage: 'Unable to parse intent. Please rephrase.'
    });
  }

  const sellPriceUsd = args.sellToken.indicativePriceUsd;
  const buyPriceUsd = args.buyToken.indicativePriceUsd;
  if (!sellPriceUsd || !buyPriceUsd) {
    throw new IntentError({
      statusCode: 503,
      code: 'PARSER_UNAVAILABLE',
      safeMessage: 'Intent parsing service temporarily unavailable.'
    });
  }

  const sellAtomic = parseDecimalToBigInt(args.sellAmountDecimal, args.sellToken.decimals);
  if (sellAtomic <= 0n) {
    throw new IntentError({
      statusCode: 422,
      code: 'UNPARSEABLE_INTENT',
      safeMessage: 'Unable to parse intent. Please rephrase.'
    });
  }

  const sellPriceMicros = parseUsdPriceToMicros(sellPriceUsd);
  const buyPriceMicros = parseUsdPriceToMicros(buyPriceUsd);
  if (sellPriceMicros <= 0n || buyPriceMicros <= 0n) {
    throw new IntentError({
      statusCode: 503,
      code: 'PARSER_UNAVAILABLE',
      safeMessage: 'Intent parsing service temporarily unavailable.'
    });
  }

  // usdMicros = sellAtomic * sellPriceMicros / 10^sellDecimals
  const sellDecimalsPow = 10n ** BigInt(args.sellToken.decimals);
  const usdMicros = (sellAtomic * sellPriceMicros) / sellDecimalsPow;

  // expectedBuyAtomic = usdMicros * 10^buyDecimals / buyPriceMicros
  const buyDecimalsPow = 10n ** BigInt(args.buyToken.decimals);
  const expectedBuyAtomic = (usdMicros * buyDecimalsPow) / buyPriceMicros;

  const bpsFactor = BigInt(10_000 - slippageBps);
  const minBuyAtomic = (expectedBuyAtomic * bpsFactor) / 10_000n;
  if (minBuyAtomic <= 0n) {
    throw new IntentError({
      statusCode: 422,
      code: 'UNPARSEABLE_INTENT',
      safeMessage: 'Unable to parse intent. Please rephrase.'
    });
  }

  return formatBigIntToDecimal(minBuyAtomic, args.buyToken.decimals);
}

export async function parseFreeTextIntent(args: {
  network: string;
  body: unknown;
  deps: ParseFreeTextDeps;
}): Promise<IntentFreeTextSuccessResponse> {
  const { deps } = args;
  const env = deps.env;

  const bodyObj = args.body as Record<string, unknown> | undefined;
  const rawText = validateInputText(bodyObj?.text, env);
  rejectUnsupportedTokenMentions(rawText);

  if (!deps.openai || !env.openaiModel) {
    throw new IntentError({
      statusCode: 503,
      code: 'PARSER_UNAVAILABLE',
      safeMessage: 'Intent parsing service temporarily unavailable.'
    });
  }

  let structured: IntentStructuredOutput;
  try {
    structured = await deps.openai.parseIntentFromText({
      model: env.openaiModel,
      text: rawText,
      timeoutMs: env.parserTimeoutMs
    });
  } catch {
    throw new IntentError({
      statusCode: 503,
      code: 'PARSER_UNAVAILABLE',
      safeMessage: 'Intent parsing service temporarily unavailable.'
    });
  }

  try {
    return await postProcessStructuredIntent({
      network: args.network,
      rawText,
      structured,
      deps
    });
  } catch (e) {
    if (e instanceof IntentError) throw e;
    throw new IntentError({
      statusCode: 422,
      code: 'UNPARSEABLE_INTENT',
      safeMessage: 'Unable to parse intent. Please rephrase.'
    });
  }
}


