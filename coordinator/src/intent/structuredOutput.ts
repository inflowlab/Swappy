import { z } from 'zod';

// IMPORTANT: OpenAI structured outputs require optional fields to be nullable.
// This schema is internal only; it is never returned directly to callers.
export const IntentStructuredOutputSchema = z
  .object({
    sell_symbol: z.enum(['SUI', 'USDC']),
    buy_symbol: z.enum(['SUI', 'USDC']),
    // Decimal string (e.g. "10", "0.5", "25.0001")
    sell_amount: z.string(),
    min_buy_amount: z.string().nullable(),
    max_slippage_bps: z.number().int().min(0).max(5000).nullable(),
    expires_in_minutes: z.number().int().min(1).max(1440).nullable()
  })
  .strict();

export type IntentStructuredOutput = z.infer<typeof IntentStructuredOutputSchema>;


