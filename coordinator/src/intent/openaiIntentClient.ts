import {
  IntentStructuredOutputSchema,
  type IntentStructuredOutput
} from './structuredOutput.js';
import { INTENT_PARSER_SYSTEM_PROMPT } from './prompt.js';

export type IntentAiClient = {
  parseIntentFromText(args: {
    model: string;
    text: string;
    timeoutMs: number;
  }): Promise<IntentStructuredOutput>;
};

function createAbortSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  // Make sure timer doesn't keep the process alive
  (t as unknown as { unref?: () => void }).unref?.();
  return controller.signal;
}

export function createOpenAiIntentClient(apiKey: string): IntentAiClient {
  // Lazy-load OpenAI SDK only when actually used (keeps unit tests offline and avoids hard import-time failures).
  let clientPromise:
    | Promise<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any
      >
    | undefined;

  async function getClient() {
    if (!clientPromise) {
      clientPromise = import('openai').then((m) => new m.default({ apiKey }));
    }
    return clientPromise;
  }

  return {
    async parseIntentFromText({ model, text, timeoutMs }) {
      const client = await getClient();

      // Use strict tool calling (schema-constrained) without OpenAI Zod helpers.
      // We still validate tool arguments with Zod to treat model output as untrusted.
      const toolName = 'parse_intent';
      const toolSchema = {
        type: 'object',
        additionalProperties: false,
        required: [
          'sell_symbol',
          'buy_symbol',
          'sell_amount',
          'min_buy_amount',
          'max_slippage_bps',
          'expires_in_minutes'
        ],
        properties: {
          sell_symbol: { type: 'string', enum: ['SUI', 'USDC'] },
          buy_symbol: { type: 'string', enum: ['SUI', 'USDC'] },
          sell_amount: { type: 'string' },
          min_buy_amount: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          max_slippage_bps: {
            anyOf: [{ type: 'integer', minimum: 0, maximum: 5000 }, { type: 'null' }]
          },
          expires_in_minutes: {
            anyOf: [{ type: 'integer', minimum: 1, maximum: 1440 }, { type: 'null' }]
          }
        }
      } as const;

      const requestBase = {
        model,
        messages: [
          { role: 'system', content: INTENT_PARSER_SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: toolName,
              description: 'Parse swap intent text into a strict JSON object.',
              parameters: toolSchema
            }
          }
        ],
        tool_choice: {
          type: 'function',
          function: { name: toolName }
        }
      } as const;

      // Prefer determinism when supported.
      // Some models reject temperature overrides (e.g. gpt-5-nano-2025-08-07 only supports default=1).
      // In that case, retry without temperature while still enforcing schema/tool constraints.
      const startedAtMs = Date.now();

      function remainingMs(): number {
        const elapsed = Date.now() - startedAtMs;
        return Math.max(0, timeoutMs - elapsed);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let completion: any;
      try {
        const signal = createAbortSignal(remainingMs());
        completion = await client.chat.completions.create(
          { ...requestBase, temperature: 0 },
          { signal }
        );
      } catch (err) {
        const e = err as Record<string, unknown> | undefined;
        const status = typeof e?.status === 'number' ? e.status : undefined;
        const msg =
          typeof e?.message === 'string'
            ? e.message
            : err instanceof Error
              ? err.message
              : '';
        const looksLikeTempUnsupported =
          status === 400 &&
          msg.includes("Unsupported value: 'temperature'") &&
          msg.includes('Only the default');
        if (!looksLikeTempUnsupported) throw err;

        const rem = remainingMs();
        if (rem <= 0) {
          throw new Error(`Request was aborted.`);
        }
        const signal = createAbortSignal(rem);
        completion = await client.chat.completions.create(requestBase, { signal });
      }

      const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
      const argsJson = toolCall?.type === 'function' ? toolCall.function?.arguments : undefined;
      if (typeof argsJson !== 'string' || argsJson.trim() === '') {
        throw new Error('OpenAI returned no tool arguments.');
      }

      const parsedArgs = IntentStructuredOutputSchema.parse(JSON.parse(argsJson));
      return parsedArgs as IntentStructuredOutput;
    }
  };
}



