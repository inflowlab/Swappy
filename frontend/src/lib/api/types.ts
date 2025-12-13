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

export type AuctionStatus = 'OPEN' | 'SETTLED' | string
export type ExecutionType = 'CoW' | 'Cetus' | 'Skipped' | string

export type ApiAuctionIntentRow = {
	intentId: string
	pairLabel?: string
	sellAmount?: string
	sellSymbol?: string
	status: IntentStatus | string
	executionType?: ExecutionType
}

export type ApiAuctionSettlement = {
	winningSolver?: string
	cowMatchesCount?: number
	cetusSwapsCount?: number
	totalBuyVolume?: string
	settlementTxDigest?: string
}

export type ApiAuctionDetail = {
	id: string
	status: AuctionStatus
	createdAtMs?: number
	deadlineMs?: number
	intents: ApiAuctionIntentRow[]
	settlement?: ApiAuctionSettlement
	// Allow backend to add fields without breaking the UI.
	extra?: Record<string, unknown>
}

export type ApiToken = {
	// Token identifier/address/coin type (canonical ID used across backend payloads)
	id: string
	symbol: string
	decimals: number
	// Optional mock price for preview-only contexts
	indicativePriceUsd?: string
	extra?: Record<string, unknown>
}


