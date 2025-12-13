import type { HttpError } from '@/lib/api/http'

export type CoordinatorErrorCode =
	| 'UNPARSEABLE_INTENT'
	| 'PARSER_UNAVAILABLE'
	| 'INVALID_INPUT'
	| 'INVALID_NETWORK'
	| 'TOKEN_REGISTRY_UNAVAILABLE'
	| 'IDEMPOTENCY_KEY_CONFLICT'
	| 'RATE_LIMITED'
	| 'VALIDATION_ERROR'
	| string

export type CoordinatorErrorPayload = {
	error?: string
	code?: CoordinatorErrorCode
	details?: Record<string, unknown>
}

export function parseCoordinatorError (err: unknown): CoordinatorErrorPayload | null {
	const e = err as Partial<HttpError> | null
	const body = e && typeof e === 'object' ? (e as { bodyJson?: unknown }).bodyJson : undefined
	if (!body || typeof body !== 'object') return null
	const rec = body as Record<string, unknown>
	const code = typeof rec.code === 'string' ? rec.code : undefined
	const error = typeof rec.error === 'string' ? rec.error : undefined
	const details = rec.details && typeof rec.details === 'object' ? (rec.details as Record<string, unknown>) : undefined
	if (!code && !error) return null
	return { code, error, details }
}


