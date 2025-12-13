import type { HttpError } from '@/lib/api'

export type UiErrorCategory = 'Wallet' | 'Backend' | 'Invariant' | 'UserInput' | 'Unknown'

export type UiErrorCode =
	| 'WALLET_UNAVAILABLE'
	| 'WALLET_USER_REJECTED'
	| 'WALLET_SUBMIT_FAILED'
	| 'BACKEND_UNAVAILABLE'
	| 'BACKEND_INVALID_RESPONSE'
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

export function toUiError (
	err: unknown,
	hint?: {
		area?: 'connect' | 'sign' | 'fetch' | 'parse'
	},
): UiError {
	const msg = (() => {
		if (typeof err === 'string') return err
		if (!err || typeof err !== 'object') return ''
		const rec = err as Record<string, unknown>
		return typeof rec.message === 'string' ? rec.message : ''
	})()

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


