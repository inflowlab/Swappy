function pow10BigInt (n: number): bigint {
	let v = BigInt(1)
	for (let i = 0; i < n; i++) v *= BigInt(10)
	return v
}

export function parseDecimalToBigInt (value: string, decimals: number): bigint {
	const trimmed = value.trim()
	if (!/^\d+(\.\d+)?$/.test(trimmed)) {
		throw new Error('Invalid decimal string.')
	}
	const [wholeStr, fracStrRaw] = trimmed.split('.')
	const fracStr = fracStrRaw ?? ''
	if (fracStr.length > decimals) {
		throw new Error('Too many fractional digits.')
	}
	const base = pow10BigInt(decimals)
	const whole = BigInt(wholeStr) * base
	const fracPadded = (fracStr + '0'.repeat(decimals)).slice(0, decimals)
	const frac = decimals === 0 ? BigInt(0) : BigInt(fracPadded)
	return whole + frac
}

const U64_MAX = BigInt('18446744073709551615') // 2^64 - 1

export function assertU64 (value: bigint, label: string): void {
	if (value < BigInt(0) || value > U64_MAX) {
		throw new Error(`Invalid ${label}: out of u64 range.`)
	}
}


