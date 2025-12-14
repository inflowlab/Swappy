import type { SuiClient } from '@mysten/sui/client'

export async function selectCoinObjectIds (args: {
	client: SuiClient
	owner: string
	coinType: string
	required: bigint
}): Promise<{ objectIds: string[]; total: bigint }> {
	const { client, owner, coinType, required } = args
	if (required <= BigInt(0)) throw new Error('Required amount must be positive.')

	const objectIds: string[] = []
	let total = BigInt(0)
	let cursor: string | null | undefined = null

	// Conservative pagination: select up to ~200 coin objects.
	for (let page = 0; page < 4; page++) {
		const res = await client.getCoins({
			owner,
			coinType,
			cursor: cursor ?? undefined,
			limit: 50,
		})
		for (const c of res.data) {
			if (!c.coinObjectId) continue
			const bal = BigInt(c.balance)
			if (bal <= BigInt(0)) continue
			objectIds.push(c.coinObjectId)
			total += bal
			if (total >= required) return { objectIds, total }
		}
		if (!res.hasNextPage) break
		cursor = res.nextCursor
	}

	throw new Error(`Insufficient balance for ${coinType}.`)
}


