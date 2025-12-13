export type IntentErrorCode =
  | 'INVALID_INPUT'
  | 'UNPARSEABLE_INTENT'
  | 'PARSER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'IDEMPOTENCY_KEY_CONFLICT';

export class IntentError extends Error {
  public readonly code: IntentErrorCode;
  public readonly statusCode: number;
  public readonly safeMessage: string;
  public readonly details?: Record<string, unknown>;

  constructor(args: {
    code: IntentErrorCode;
    statusCode: number;
    safeMessage: string;
    details?: Record<string, unknown>;
  }) {
    super(args.safeMessage);
    this.code = args.code;
    this.statusCode = args.statusCode;
    this.safeMessage = args.safeMessage;
    this.details = args.details;
  }
}


