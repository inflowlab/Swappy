import type { SuiNetwork } from '@/lib/network/types'
import type { ApiAuctionDetail, ApiIntentDetail } from '@/lib/api'
import { IntentStatus } from '@/lib/models/intent-status'

export type MockLink = { objectId: string; intentId: string }

const fixedNowMs = 1_735_000_000_000

const mockIntentIds = ['1', '2', '3']

export function mockListMyIntentLinks (args: { owner: string; network: SuiNetwork }) {
	const { owner, network: _network } = args
	// deterministic empty state: owner ending in '0'
	if (owner.toLowerCase().endsWith('0')) {
		return { links: [] as MockLink[], warnings: [] as string[] }
	}
	return {
		links: mockIntentIds.map((id) => ({ objectId: `0xMOCK_LINK_${_network}_${id}`, intentId: id })),
		warnings: [] as string[],
	}
}

export function mockGetIntentRecord (args: {
	network: SuiNetwork
	intentId: string
	owner?: string | null
}): { intent: ApiIntentDetail | null; warning?: string } {
	const { intentId, owner } = args

	if (!mockIntentIds.includes(intentId)) {
		return { intent: null, warning: 'Intent record not available on-chain yet.' }
	}

	const status =
		intentId === '1'
			? IntentStatus.OPEN_ESCROWED
			: intentId === '2'
				? IntentStatus.BATCHED
				: IntentStatus.SETTLED

	const base: ApiIntentDetail = {
		id: intentId,
		owner: owner ?? '0xDEMO_OWNER',
		status,
		sellSymbol: 'SUI',
		buySymbol: 'USDC',
		sellAmount: intentId === '1' ? '10' : intentId === '2' ? '5' : '1',
		minBuyAmount: '24.5',
		expiresAtMs: fixedNowMs + 15 * 60_000,
		createdAtMs: fixedNowMs - 60_000,
	}

	if (status === IntentStatus.BATCHED) {
		base.auctionId = '1'
		base.auctionDeadlineMs = fixedNowMs + 5 * 60_000
	}

	if (status === IntentStatus.SETTLED) {
		base.auctionId = '2'
		base.auctionDeadlineMs = fixedNowMs + 5 * 60_000
		base.settlementTxDigest = 'MOCK_SETTLE_TX_001'
		base.solverUsed = 'Mixed'
		base.matchedViaCoW = true
		base.routedViaCetus = true
		base.finalReceivedAmount = '24.9 USDC'
	}

	return { intent: base }
}

export function mockGetAuctionRecord (args: {
	network: SuiNetwork
	auctionId: string
}): { auction: ApiAuctionDetail | null; warning?: string } {
	const { auctionId } = args

	if (auctionId !== '1' && auctionId !== '2') {
		return { auction: null, warning: 'Auction record not available on-chain yet.' }
	}

	const status = auctionId === '2' ? 'SETTLED' : 'OPEN'
	const intents =
		auctionId === '2'
			? [{ intentId: '3', status: IntentStatus.SETTLED, executionType: 'Mixed' }]
			: [
					{ intentId: '1', status: IntentStatus.OPEN_ESCROWED, executionType: 'Skipped' },
					{ intentId: '2', status: IntentStatus.BATCHED, executionType: 'CoW' },
				]

	const auction: ApiAuctionDetail = {
		id: auctionId,
		status,
		createdAtMs: fixedNowMs - 20 * 60_000,
		deadlineMs: fixedNowMs + 5 * 60_000,
		intents,
	}

	if (status === 'SETTLED') {
		auction.settlement = {
			winningSolver: 'Mixed',
			cowMatchesCount: 1,
			cetusSwapsCount: 1,
			totalBuyVolume: '124.50 USDC',
			settlementTxDigest: 'MOCK_AUCTION_SETTLE_TX_001',
		}
	}

	return { auction }
}


