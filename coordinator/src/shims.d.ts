// These shims exist to keep the repo type-checkable in-editor before dependencies are installed.
// When `npm install` is run in `coordinator/`, the real package typings take precedence.

declare module 'openai' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const OpenAI: any;
  export default OpenAI;
}

declare module 'openai/helpers/zod' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function zodResponseFormat(schema: any, name: string): any;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const describe: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const it: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const expect: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const beforeEach: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const afterEach: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const vi: any;
}

declare module 'vitest/config' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function defineConfig(config: any): any;
}

// Minimal globals for environments where node typings aren't loaded by the editor.
declare class AbortController {
  signal: AbortSignal;
  abort(reason?: unknown): void;
}

interface AbortSignal {
  aborted: boolean;
}

declare function setTimeout(
  handler: (...args: unknown[]) => void,
  timeout?: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
): unknown;

// Basic Node globals for editors before deps are installed.
declare const console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
declare const process: { env: Record<string, string | undefined>; argv: string[]; exitCode: number };


