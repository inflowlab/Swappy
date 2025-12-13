import { IntentStatus } from '@/lib/models/intent-status'
import type { FreeTextIntentParseResponse } from './intent-parse'
import type { ApiAuction, ApiAuctionDetail, ApiIntent, ApiIntentDetail, ApiToken } from './types'

const fixedNowMs = 1_735_000_000_000

const baseIntents: Array<Omit<ApiIntent, 'owner'>> = [
	{
		id: 'intent_001',
		status: IntentStatus.OPEN_ESCROWED,
		pairLabel: 'SUI → USDC',
		sellAmount: '12.34',
		sellSymbol: 'SUI',
		buySymbol: 'USDC',
		createdAtMs: fixedNowMs - 60_000,
	},
	{
		id: 'intent_002',
		status: IntentStatus.BATCHED,
		pairLabel: 'USDC → SUI',
		sellAmount: '250.00',
		sellSymbol: 'USDC',
		buySymbol: 'SUI',
		createdAtMs: fixedNowMs - 5 * 60_000,
	},
	{
		id: 'intent_003',
		status: IntentStatus.SETTLED,
		pairLabel: 'SUI → USDC',
		sellAmount: '1.00',
		sellSymbol: 'SUI',
		buySymbol: 'USDC',
		createdAtMs: fixedNowMs - 60 * 60_000,
	},
	{
		id: 'intent_004',
		status: IntentStatus.CANCELED,
		pairLabel: 'SUI → USDC',
		sellAmount: '5.00',
		sellSymbol: 'SUI',
		buySymbol: 'USDC',
		createdAtMs: fixedNowMs - 2 * 60 * 60_000,
	},
	{
		id: 'intent_005',
		status: IntentStatus.FAILED,
		pairLabel: 'USDC → SUI',
		sellAmount: '75.00',
		sellSymbol: 'USDC',
		buySymbol: 'SUI',
		createdAtMs: fixedNowMs - 3 * 60 * 60_000,
	},
]

const mockAuctions: ApiAuction[] = [
	{
		id: 'auction_001',
		intentIds: ['intent_001', 'intent_002'],
		createdAtMs: fixedNowMs - 10 * 60_000,
	},
	{
		id: 'auction_002',
		intentIds: ['intent_003'],
		createdAtMs: fixedNowMs - 90 * 60_000,
	},
]

const mockTokens: ApiToken[] = [
	{
		id: '0x2::sui::SUI',
		symbol: 'SUI',
		decimals: 9,
		indicativePriceUsd: '2.50',
	},
	{
		id: '0xUSDC',
		symbol: 'USDC',
		decimals: 6,
		indicativePriceUsd: '1.00',
	},
]

export async function mockListIntents (owner: string): Promise<ApiIntent[]> {
	// deterministic "empty state" address: any owner ending in '0'
	if (owner.toLowerCase().endsWith('0')) return []
	return baseIntents.map((i) => ({ ...i, owner }))
}

export async function mockGetIntent (owner: string, intentId: string): Promise<ApiIntent | null> {
	const intents = await mockListIntents(owner)
	return intents.find((i) => i.id === intentId) ?? null
}

export async function mockListAuctions (): Promise<ApiAuction[]> {
	return mockAuctions
}

export async function mockGetAuction (auctionId: string): Promise<ApiAuction | null> {
	return mockAuctions.find((a) => a.id === auctionId) ?? null
}

export async function mockParseFreeTextIntent (text: string): Promise<FreeTextIntentParseResponse> {
	// NOTE: This is a demo-only mock. Real parsing is authoritative on the backend.
	const trimmed = text.trim()
	const expiresAtMs = fixedNowMs + 15 * 60_000

	const parsed: FreeTextIntentParseResponse['parsed'] =
		trimmed.toLowerCase().includes('usdc') && trimmed.toLowerCase().includes('sui')
			? {
					sellSymbol: trimmed.toLowerCase().includes('sell 200') ? 'USDC' : 'SUI',
					buySymbol: trimmed.toLowerCase().includes('sell 200') ? 'SUI' : 'USDC',
					sellAmount: trimmed.toLowerCase().includes('sell 200') ? '200' : '10',
					minBuyAmount: trimmed.toLowerCase().includes('sell 200') ? '9.9' : '24.5',
					expiresAtMs,
				}
			: {
					sellSymbol: 'SUI',
					buySymbol: 'USDC',
					sellAmount: '10',
					minBuyAmount: '24.5',
					expiresAtMs,
				}

	return {
		rawText: text,
		parsed,
	}
}

export async function mockGetIntentDetail (intentId: string): Promise<ApiIntentDetail | null> {
	// Use a deterministic placeholder owner for direct navigation demos.
	const owner = '0xDEMO_OWNER'
	const base = (await mockListIntents(owner)).find((i) => i.id === intentId)
	if (!base) return null

	// Add status-specific fields for the detail page UX.
	const detail: ApiIntentDetail = {
		...base,
		minBuyAmount: base.buySymbol === 'USDC' ? '24.5' : '9.9',
		expiresAtMs: fixedNowMs + 15 * 60_000,
	}

	if (base.status === IntentStatus.BATCHED) {
		detail.auctionId = 'auction_001'
		detail.auctionDeadlineMs = fixedNowMs + 5 * 60_000
	}

	if (base.status === IntentStatus.SETTLED) {
		detail.auctionId = 'auction_002'
		detail.auctionDeadlineMs = fixedNowMs + 5 * 60_000
		detail.settlementTxDigest = 'MOCK_SETTLE_TX_001'
		detail.solverUsed = 'Mixed'
		detail.matchedViaCoW = true
		detail.routedViaCetus = true
		detail.finalReceivedAmount = base.buySymbol ? `24.9 ${base.buySymbol}` : '24.9'
	}

	if (base.status === IntentStatus.CANCELED) {
		detail.redeemTxDigest = 'MOCK_REDEEM_TX_001'
	}

	if (base.status === IntentStatus.EXPIRED) {
		detail.redeemTxDigest = 'MOCK_REDEEM_TX_002'
	}

	if (base.status === IntentStatus.FAILED) {
		detail.failureReason = 'Mock failure: solver could not produce a valid plan.'
	}

	return detail
}

export async function mockGetAuctionDetail (auctionId: string): Promise<ApiAuctionDetail | null> {
	const base = mockAuctions.find((a) => a.id === auctionId)
	if (!base) return null

	const owner = '0xDEMO_OWNER'
	const intents = await mockListIntents(owner)
	const rows = base.intentIds
		.map((id) => intents.find((i) => i.id === id))
		.filter((i): i is ApiIntent => Boolean(i))
		.map((i) => {
			const executionType =
				auctionId === 'auction_002'
					? 'Cetus'
					: i.status === IntentStatus.OPEN_ESCROWED
						? 'Skipped'
						: 'CoW'
			return {
				intentId: i.id,
				pairLabel: i.pairLabel,
				sellAmount: i.sellAmount,
				sellSymbol: i.sellSymbol,
				status: i.status,
				executionType,
			}
		})

	const status: ApiAuctionDetail['status'] = auctionId === 'auction_002' ? 'SETTLED' : 'OPEN'
	const detail: ApiAuctionDetail = {
		id: auctionId,
		status,
		createdAtMs: fixedNowMs - 20 * 60_000,
		deadlineMs: fixedNowMs + 5 * 60_000,
		intents: rows.slice(0, 10),
	}

	if (status === 'SETTLED') {
		detail.settlement = {
			winningSolver: 'Mixed',
			cowMatchesCount: 1,
			cetusSwapsCount: 1,
			totalBuyVolume: '124.50 USDC',
			settlementTxDigest: 'MOCK_AUCTION_SETTLE_TX_001',
		}
	}

	return detail
}

export async function mockGetTokens (): Promise<ApiToken[]> {
	return mockTokens
}


