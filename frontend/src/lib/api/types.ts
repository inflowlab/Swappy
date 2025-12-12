import type { IntentStatus } from '@/lib/models/intent-status'

export type ApiIntent = {
	id: string
	owner: string
	status: IntentStatus | string
	pairLabel?: string
	sellAmount?: string
	sellSymbol?: string
	buySymbol?: string
	createdAtMs?: number
	// Allow backend to add fields without breaking the UI.
	extra?: Record<string, unknown>
}

export type ApiAuction = {
	id: string
	intentIds: string[]
	createdAtMs?: number
	// Allow backend to add fields without breaking the UI.
	extra?: Record<string, unknown>
}


