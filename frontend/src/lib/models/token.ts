export type Token = {
	// Human-readable symbol (e.g. SUI, USDC)
	symbol: string
	// Number of decimals used for display formatting
	decimals: number
	// Coin type string (e.g. 0x2::sui::SUI)
	coinType: string
	// Allow backend to add fields without breaking the UI
	[key: string]: unknown
}


