function shortTokenId (id: string) {
	if (id.length <= 14) return id
	return `${id.slice(0, 6)}…${id.slice(-4)}`
}

export function formatTokenLabel (args: { symbol?: string | null; id?: string | null }) {
	const symbol = args.symbol?.trim()
	if (symbol) return symbol.toUpperCase()
	const id = args.id?.trim()
	if (id) return shortTokenId(id)
	return 'Unknown Token'
}

export function formatTokenAmount (raw: string, decimals: number): string {
	// If the string already looks like a decimal, keep it as-is.
	const trimmed = raw.trim()
	if (trimmed.length === 0) return '—'
	if (trimmed.includes('.')) return trimmed

	// Otherwise treat as base-unit integer string and format with truncation.
	// Never throw; on invalid input, fall back to raw.
	if (!/^[0-9]+$/.test(trimmed)) return trimmed

	try {
		const negative = false
		const digits = trimmed.replace(/^0+/, '') || '0'
		const d = Math.max(0, Math.min(18, decimals))
		if (d === 0) return digits

		const pad = digits.length <= d ? '0'.repeat(d - digits.length + 1) + digits : digits
		const split = pad.length - d
		const whole = pad.slice(0, split)
		let frac = pad.slice(split)

		// Truncate to at most 6 decimals for display (no rounding).
		frac = frac.slice(0, 6).replace(/0+$/, '')
		const out = frac.length ? `${whole}.${frac}` : whole
		return negative ? `-${out}` : out
	} catch {
		return trimmed
	}
}


