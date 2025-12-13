import { loadEnv } from '../src/config/env.js';
import { createOpenAiIntentClient } from '../src/intent/openaiIntentClient.js';
import { postProcessStructuredIntent } from '../src/intent/parseFreeText.js';
import { getTokenRegistry } from '../src/tokens/tokenRegistry.js';
import { IntentError } from '../src/intent/errors.js';

type Args = {
  network: string;
  text: string;
  timeoutMs?: number;
};

function getProcess(): { argv: string[]; exitCode: number; env: Record<string, string | undefined> } {
  const p = (globalThis as unknown as { process?: unknown }).process as
    | { argv: string[]; exitCode: number; env: Record<string, string | undefined> }
    | undefined;
  if (!p) throw new Error('This script must be run in Node.js (process is unavailable).');
  return p;
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  let network = '';
  let text = '';
  let timeoutMs: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--network') {
      network = String(args[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (a === '--text') {
      text = String(args[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (a === '--timeout-ms') {
      const raw = String(args[i + 1] ?? '');
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --timeout-ms: "${raw}". Expected a positive integer.`);
      }
      timeoutMs = parsed;
      i += 1;
      continue;
    }
  }

  if (!network.trim() || !text.trim()) {
    throw new Error(
      'Usage: npm run test:integration:openai -- --network <network> --text "<intent text>" [--timeout-ms <ms>]'
    );
  }

  return { network: network.trim(), text: text.trim(), timeoutMs };
}

async function main(): Promise<void> {
  const proc = getProcess();
  const { network, text, timeoutMs } = parseArgs(proc.argv);

  const env = loadEnv(proc.env);
  if (!env.openaiApiKey || !env.openaiModel) {
    throw new Error('Missing OPENAI_API_KEY or OPENAI_MODEL in environment.');
  }

  const openai = createOpenAiIntentClient(env.openaiApiKey);

  // Step 1: call OpenAI and surface REAL API errors (401/404/etc.) for integration debugging.
  let structured;
  const startedAt = Date.now();
  try {
    structured = await openai.parseIntentFromText({
      model: env.openaiModel,
      text,
      timeoutMs: timeoutMs ?? env.parserTimeoutMs
    });
  } catch (err) {
    const e = err as Record<string, unknown> | undefined;
    const status = typeof e?.status === 'number' ? e.status : undefined;
    const message = err instanceof Error ? err.message : String(err);
    const elapsedMs = Date.now() - startedAt;
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify(
        {
          error: 'OpenAI call failed.',
          status,
          message,
          elapsedMs,
          hint:
            message.includes('aborted') || message.includes('Abort')
              ? 'This looks like a timeout. Try --timeout-ms 20000 (integration-only) or increase PARSER_TIMEOUT_MS.'
              : undefined
        },
        null,
        2
      )
    );
    throw err;
  }

  // Step 2: deterministic post-processing (coinType mapping, slippage/minBuy, expiry)
  const response = await postProcessStructuredIntent({
    network,
    rawText: text,
    structured,
    deps: {
      env,
      openai,
      nowMs: () => Date.now(),
      getTokenRegistry
    }
  });

  // Prints the FINAL API-shaped response including sellToken/buyToken coinTypes.
  // Example fields:
  // - parsed.sellToken: "0x2::sui::SUI"
  // - parsed.buyToken:  "<USDC coinType>"
  // - parsed.sellAmount / minBuyAmount: decimal strings
  // - parsed.expiresAtMs: number
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(response, null, 2));
}

main().catch((err) => {
  if (err instanceof IntentError) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ error: err.safeMessage, code: err.code, details: err.details }, null, 2));
  } else {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err);
  }
  getProcess().exitCode = 1;
});


