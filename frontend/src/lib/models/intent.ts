import type { IntentStatus } from './intent-status'
import type { Token } from './token'

export type Intent = {
	id: string
	status: IntentStatus | string

	// Minimal fields for future UX (placeholder only; backend contract is authoritative)
	offeredToken?: Token
	requestedToken?: Token

	[key: string]: unknown
}


