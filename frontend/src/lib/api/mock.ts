import { IntentStatus } from '@/lib/models/intent-status'
import type { ApiAuction, ApiIntent } from './types'

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


