import type { HttpError } from '@/lib/api'
import { parseCoordinatorError } from '@/lib/api'

export type UiErrorCategory = 'Wallet' | 'Backend' | 'Invariant' | 'UserInput' | 'Unknown'

export type UiErrorCode =
	| 'WALLET_UNAVAILABLE'
	| 'WALLET_USER_REJECTED'
	| 'WALLET_SUBMIT_FAILED'
	| 'BACKEND_UNAVAILABLE'
	| 'BACKEND_INVALID_RESPONSE'
	| 'INVARIANT_NETWORK_MISMATCH'
	| 'INVARIANT_MISSING_TX_DIGEST'
	| 'INVARIANT_STATUS_CONTRADICTION'
	| 'USER_INPUT_UNPARSEABLE'
	| 'UNKNOWN'

export type UiError = {
	category: UiErrorCategory
	code: UiErrorCode
	userMessage: string
	debugMessage?: string
}

export function logUiError (err: UiError, extra?: Record<string, unknown>) {
	// Observability requirement: console logging is acceptable at this stage.
	console.error(`[ui-error] ${err.category}:${err.code} - ${err.userMessage}`, {
		debugMessage: err.debugMessage,
		...extra,
	})
}

function isHttpError (err: unknown): err is HttpError {
	if (!err || typeof err !== 'object') return false
	const rec = err as Record<string, unknown>
	return typeof rec.status === 'number' && typeof rec.message === 'string'
}

function looksLikeUserRejected (msg: string) {
	const s = msg.toLowerCase()
	return s.includes('user rejected') || s.includes('rejected') || s.includes('denied')
}

function looksLikeTimeoutOrOffline (err: unknown, msg: string): boolean {
	const rec = err as Record<string, unknown> | null
	const name = rec && typeof rec === 'object' ? String(rec.name ?? '') : ''
	const s = msg.toLowerCase()
	return (
		name === 'AbortError' ||
		s.includes('aborted') ||
		s.includes('timeout') ||
		s.includes('failed to fetch') ||
		s.includes('networkerror') ||
		s.includes('load failed')
	)
}

function describeError (err: unknown): string {
	if (typeof err === 'string') return err
	if (!err) return ''
	if (err instanceof Error) {
		const cause = (err as unknown as { cause?: unknown }).cause
		const causeMsg = cause ? describeError(cause) : ''
		return causeMsg ? `${err.message} (cause: ${causeMsg})` : err.message
	}
	if (typeof err === 'object') {
		const rec = err as Record<string, unknown>
		if (typeof rec.message === 'string') return rec.message
		if (typeof rec.error === 'string') return rec.error
		if (typeof rec.code === 'string' && typeof rec.details === 'string') return `${rec.code}: ${rec.details}`
		try {
			return JSON.stringify(err)
		} catch {
			return ''
		}
	}
	return ''
}

export function toUiError (
	err: unknown,
	hint?: {
		area?: 'connect' | 'sign' | 'fetch' | 'parse'
	},
): UiError {
	const msg = describeError(err)

	if (hint?.area === 'connect') {
		if (msg.toLowerCase().includes('no sui wallet')) {
			return {
				category: 'Wallet',
				code: 'WALLET_UNAVAILABLE',
				userMessage: 'Wallet unavailable. Please install a Sui wallet and try again.',
				debugMessage: msg,
			}
		}
		if (looksLikeUserRejected(msg)) {
			return {
				category: 'Wallet',
				code: 'WALLET_USER_REJECTED',
				userMessage: 'Wallet connection was rejected. Please try again.',
				debugMessage: msg,
			}
		}
		return {
			category: 'Wallet',
			code: 'WALLET_SUBMIT_FAILED',
			userMessage: 'Wallet failed to connect. Please try again.',
			debugMessage: msg,
		}
	}

	if (hint?.area === 'sign') {
		// Surface local configuration / unimplemented wiring clearly (don't blame the wallet).
		if (msg.includes('Missing NEXT_PUBLIC_PROTOCOL_PACKAGE_ID')) {
			return {
				category: 'Invariant',
				code: 'INVARIANT_STATUS_CONTRADICTION',
				userMessage: msg,
				debugMessage: msg,
			}
		}
		if (msg.toLowerCase().includes('not implemented yet')) {
			return {
				category: 'Invariant',
				code: 'INVARIANT_STATUS_CONTRADICTION',
				userMessage:
					'On-chain tx wiring is not implemented in the frontend yet. Enable NEXT_PUBLIC_USE_MOCK_TX=true for demo mode.',
				debugMessage: msg,
			}
		}
		if (looksLikeUserRejected(msg)) {
			return {
				category: 'Wallet',
				code: 'WALLET_USER_REJECTED',
				userMessage: 'Transaction was rejected in wallet.',
				debugMessage: msg,
			}
		}
		return {
			category: 'Wallet',
			code: 'WALLET_SUBMIT_FAILED',
			userMessage: 'Wallet failed to submit transaction.',
			debugMessage: msg,
		}
	}

	if (hint?.area === 'parse') {
		if (looksLikeTimeoutOrOffline(err, msg)) {
			return {
				category: 'Backend',
				code: 'BACKEND_UNAVAILABLE',
				userMessage: 'Parsing temporarily unavailable. Please try again later.',
				debugMessage: msg,
			}
		}
		if (isHttpError(err)) {
			const coord = parseCoordinatorError(err)
			if (coord?.code === 'UNPARSEABLE_INTENT') {
				return {
					category: 'UserInput',
					code: 'USER_INPUT_UNPARSEABLE',
					userMessage: 'Unable to parse that intent. Please rephrase and try again.',
					debugMessage: err.message,
				}
			}
			if (coord?.code === 'INVALID_INPUT') {
				return {
					category: 'UserInput',
					code: 'USER_INPUT_UNPARSEABLE',
					userMessage: 'Invalid intent text. Please edit and try again.',
					debugMessage: err.message,
				}
			}
			if (coord?.code === 'INVALID_NETWORK') {
				return {
					category: 'Invariant',
					code: 'INVARIANT_NETWORK_MISMATCH',
					userMessage: 'Network mismatch. Please check your selected network and try again.',
					debugMessage: err.message,
				}
			}
			if (coord?.code === 'RATE_LIMITED') {
				return {
					category: 'Backend',
					code: 'BACKEND_UNAVAILABLE',
					userMessage: 'Parsing is rate-limited. Please wait a moment and try again.',
					debugMessage: err.message,
				}
			}
			if (coord?.code === 'PARSER_UNAVAILABLE') {
				return {
					category: 'Backend',
					code: 'BACKEND_UNAVAILABLE',
					userMessage: 'Parsing temporarily unavailable. Please try again later.',
					debugMessage: err.message,
				}
			}
		}

		if (isHttpError(err) && err.status >= 400 && err.status < 500) {
			return {
				category: 'UserInput',
				code: 'USER_INPUT_UNPARSEABLE',
				userMessage: 'Unable to parse intent text. Please rephrase and try again.',
				debugMessage: err.message,
			}
		}
		if (isHttpError(err)) {
			return {
				category: 'Backend',
				code: 'BACKEND_UNAVAILABLE',
				userMessage: 'Service temporarily unavailable. Please try again later.',
				debugMessage: err.message,
			}
		}
		return {
			category: 'Unknown',
			code: 'UNKNOWN',
			userMessage: 'Unable to parse intent text. Please try again.',
			debugMessage: msg,
		}
	}

	if (hint?.area === 'fetch') {
		if (looksLikeTimeoutOrOffline(err, msg)) {
			return {
				category: 'Backend',
				code: 'BACKEND_UNAVAILABLE',
				userMessage: 'Service temporarily unavailable. Please try again later.',
				debugMessage: msg,
			}
		}
		if (isHttpError(err)) {
			return {
				category: 'Backend',
				code: 'BACKEND_UNAVAILABLE',
				userMessage: 'Service temporarily unavailable. Please try again later.',
				debugMessage: err.message,
			}
		}
		return {
			category: 'Backend',
			code: 'BACKEND_UNAVAILABLE',
			userMessage: 'Service temporarily unavailable. Please try again later.',
			debugMessage: msg,
		}
	}

	return {
		category: 'Unknown',
		code: 'UNKNOWN',
		userMessage: 'Something went wrong. Please try again.',
		debugMessage: msg,
	}
}


