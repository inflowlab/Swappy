export type TokenInfo = {
	symbol: string
	decimals: number
	coinType?: string
}

const tokens: Record<string, TokenInfo> = {
	SUI: { symbol: 'SUI', decimals: 9, coinType: '0x2::sui::SUI' },
	USDC: { symbol: 'USDC', decimals: 6 },
}

export function getTokenInfo (symbol: string): TokenInfo | null {
	const key = symbol.trim().toUpperCase()
	return tokens[key] ?? null
}


