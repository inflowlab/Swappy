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

export type ApiIntentDetail = ApiIntent & {
	minBuyAmount?: string
	expiresAtMs?: number

	// Status-specific optional metadata:
	auctionId?: string
	auctionDeadlineMs?: number

	settlementTxDigest?: string
	redeemTxDigest?: string

	solverUsed?: 'CoW' | 'Cetus' | 'Mixed' | string
	matchedViaCoW?: boolean
	routedViaCetus?: boolean
	finalReceivedAmount?: string
	failureReason?: string
}

export type ApiAuction = {
	id: string
	intentIds: string[]
	createdAtMs?: number
	// Allow backend to add fields without breaking the UI.
	extra?: Record<string, unknown>
}


