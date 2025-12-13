import type { SuiNetwork } from '@/lib/network/types'
import { env } from '@/lib/env'
import { getSuiClient } from '@/lib/sui/client'
import { getIntentLinkType } from '@/lib/config/types'
import { mockListMyIntentLinks } from '@/lib/sui/mock'
import { shouldUseMockChain } from '@/lib/config/networks'

export type IntentLink = {
	objectId: string
	intentId: string
}

function readField (fields: unknown, key: string): string | null {
	if (!fields || typeof fields !== 'object') return null
	const rec = fields as Record<string, unknown>
	const v = rec[key]
	if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') return String(v)
	return null
}

function extractIntentId (content: unknown): string | null {
	if (!content || typeof content !== 'object') return null
	const rec = content as Record<string, unknown>
	const fields = rec.fields
	return (
		readField(fields, 'intent_id') ??
		readField(fields, 'intentId') ??
		readField(fields, 'intentID') ??
		null
	)
}

export async function listMyIntentLinks (args: {
	network: SuiNetwork
	owner: string
	limit?: number
}): Promise<{ links: IntentLink[]; warnings: string[] }> {
	const { network, owner, limit = 50 } = args

	if (env.useMockChain || shouldUseMockChain(network)) {
		const { links, warnings } = mockListMyIntentLinks({ owner, network })
		return { links: links.slice(0, limit), warnings }
	}

	const client = getSuiClient(network)

	const structType = getIntentLinkType(network)

	const res = await client.getOwnedObjects({
		owner,
		filter: {
			StructType: structType,
		},
		options: {
			showContent: true,
			showType: true,
		},
		limit,
	})

	const warnings: string[] = []
	const links: IntentLink[] = []

	for (const item of res.data) {
		const obj = item.data
		if (!obj?.objectId) continue
		const intentId = extractIntentId(obj.content)
		if (!intentId) {
			warnings.push(`Unable to decode intent_id from IntentRecordLink object ${obj.objectId}`)
			continue
		}
		links.push({ objectId: obj.objectId, intentId })
	}

	return { links, warnings }
}


