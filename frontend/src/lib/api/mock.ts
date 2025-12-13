import type { FreeTextIntentParseResponse } from './intent-parse'
import type { ApiToken } from './types'

const fixedNowMs = 1_735_000_000_000

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

export async function mockGetTokens (): Promise<ApiToken[]> {
	return mockTokens
}


