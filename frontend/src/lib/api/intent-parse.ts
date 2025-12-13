export type FreeTextIntentParseRequest = {
	text: string
}

export type ParsedIntentPreview = {
	// Canonical coin type strings (from coordinator + token registry)
	sellToken: string
	buyToken: string
	sellAmount: string
	minBuyAmount: string
	expiresAtMs: number
}

export type FreeTextIntentParseResponse = {
	rawText: string
	parsed: ParsedIntentPreview
}


