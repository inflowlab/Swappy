export type EnvConfig = {
  port: number;
  host: string;
  networksSupported: string[];
  corsOrigin: true | string;

  // Intent parsing
  maxIntentTextLen: number;
  defaultExpiryMinutes: number;
  defaultMaxSlippageBps: number;
  parserTimeoutMs: number;
  parserIdempotencyTtlMs: number;
  parserRateLimitPerMinute: number;

  // OpenAI
  openaiApiKey?: string;
  openaiModel?: string;
};

function normalizeNetworkName(value: string): string {
  return value.trim().toLowerCase();
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 3000;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT: "${raw}". Expected an integer 1-65535.`);
  }
  return parsed;
}

function parseNetworksSupported(raw: string | undefined): string[] {
  const value = (raw ?? '').trim();
  if (value === '') {
    throw new Error(
      'Missing NETWORKS_SUPPORTED. Expected a comma-separated list (e.g. "mainnet,testnet,devnet,localnet").'
    );
  }
  const networks = value
    .split(',')
    .map((s) => normalizeNetworkName(s))
    .filter((s) => s.length > 0);
  const deduped = Array.from(new Set(networks));
  if (deduped.length === 0) {
    throw new Error(
      'Invalid NETWORKS_SUPPORTED. Expected at least one non-empty network name.'
    );
  }
  return deduped;
}

function parseCorsOrigin(raw: string | undefined): true | string {
  if (raw === undefined || raw.trim() === '') return true; // dev-friendly default
  if (raw.trim() === '*') return true;
  return raw.trim();
}

function parsePositiveInt(
  name: string,
  raw: string | undefined,
  defaultValue: number
): number {
  if (raw === undefined || raw.trim() === '') return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: "${raw}". Expected a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInt(
  name: string,
  raw: string | undefined,
  defaultValue: number
): number {
  if (raw === undefined || raw.trim() === '') return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}: "${raw}". Expected a non-negative integer.`);
  }
  return parsed;
}

function parseBps(
  name: string,
  raw: string | undefined,
  defaultValue: number
): number {
  const value = parseNonNegativeInt(name, raw, defaultValue);
  if (value < 0 || value > 5000) {
    throw new Error(`Invalid ${name}: "${raw}". Expected 0..5000.`);
  }
  return value;
}

export function loadEnv(
  processEnv: Record<string, string | undefined> = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ??
    {})
): EnvConfig {
  const port = parsePort(processEnv.PORT);
  const host = (processEnv.HOST ?? '0.0.0.0').trim() || '0.0.0.0';
  const networksSupported = parseNetworksSupported(processEnv.NETWORKS_SUPPORTED);
  const corsOrigin = parseCorsOrigin(processEnv.CORS_ORIGIN);

  const maxIntentTextLen = parsePositiveInt(
    'MAX_TEXT_LEN',
    processEnv.MAX_TEXT_LEN,
    500
  );
  const defaultExpiryMinutes = parsePositiveInt(
    'DEFAULT_EXPIRY_MINUTES',
    processEnv.DEFAULT_EXPIRY_MINUTES,
    15
  );
  if (defaultExpiryMinutes < 1 || defaultExpiryMinutes > 1440) {
    throw new Error(
      `Invalid DEFAULT_EXPIRY_MINUTES: "${defaultExpiryMinutes}". Expected 1..1440.`
    );
  }

  const defaultMaxSlippageBps = parseBps(
    'DEFAULT_MAX_SLIPPAGE_BPS',
    processEnv.DEFAULT_MAX_SLIPPAGE_BPS,
    100
  );

  const parserTimeoutMs = parsePositiveInt(
    'PARSER_TIMEOUT_MS',
    processEnv.PARSER_TIMEOUT_MS,
    10_000
  );
  const parserIdempotencyTtlMs = parsePositiveInt(
    'PARSER_IDEMPOTENCY_TTL_MS',
    processEnv.PARSER_IDEMPOTENCY_TTL_MS,
    10 * 60_000
  );
  const parserRateLimitPerMinute = parsePositiveInt(
    'PARSER_RATE_LIMIT_PER_MINUTE',
    processEnv.PARSER_RATE_LIMIT_PER_MINUTE,
    30
  );

  const openaiApiKey = processEnv.OPENAI_API_KEY?.trim() || undefined;
  const openaiModel = processEnv.OPENAI_MODEL?.trim() || undefined;

  return {
    port,
    host,
    networksSupported,
    corsOrigin,
    maxIntentTextLen,
    defaultExpiryMinutes,
    defaultMaxSlippageBps,
    parserTimeoutMs,
    parserIdempotencyTtlMs,
    parserRateLimitPerMinute,
    openaiApiKey,
    openaiModel
  };
}


