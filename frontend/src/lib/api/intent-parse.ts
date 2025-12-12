export type FreeTextIntentParseRequest = {
	text: string
}

export type ParsedIntentPreview = {
	sellSymbol: string
	buySymbol: string
	sellAmount: string
	minBuyAmount: string
	expiresAtMs: number
}

export type FreeTextIntentParseResponse = {
	rawText: string
	parsed: ParsedIntentPreview
}


