import type { SuiNetwork } from '@/lib/network/types'
import type { ApiAuctionDetail, ApiAuctionIntentRow } from '@/lib/api'
import { env } from '@/lib/env'
import { getAuctionBookDynamicFieldByU64 } from '@/lib/sui/dynamic-fields'
import { mockGetAuctionRecord } from '@/lib/sui/mock'
import { shouldUseMockChain } from '@/lib/config/networks'

function asRecord (value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function readString (rec: Record<string, unknown> | null, key: string): string | null {
	if (!rec) return null
	const v = rec[key]
	if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') return String(v)
	return null
}

function readFields (obj: unknown): Record<string, unknown> | null {
	const rec = asRecord(obj)
	const content = asRecord(rec?.content)
	const fields = asRecord(content?.fields)
	return fields
}

function readVecString (rec: Record<string, unknown> | null, key: string): string[] | null {
	if (!rec) return null
	const v = rec[key]
	if (!Array.isArray(v)) return null
	return v.map((x) => String(x))
}

export async function getAuctionRecord (args: {
	network: SuiNetwork
	auctionId: string
}): Promise<{ auction: ApiAuctionDetail | null; warning?: string }> {
	const { network, auctionId } = args
	if (env.useMockChain || shouldUseMockChain(network)) return mockGetAuctionRecord({ network, auctionId })
	const res = await getAuctionBookDynamicFieldByU64({ network, key: auctionId })
	const rec = asRecord(res)
	const data = asRecord(rec?.data)
	const fields = readFields(data)
	if (!fields) {
		return {
			auction: null,
			warning: 'Auction record not available on-chain yet (dynamic field missing or unreadable).',
		}
	}

	const status = readString(fields, 'status') ?? 'UNKNOWN'
	const intentsVec =
		readVecString(fields, 'intent_ids') ??
		readVecString(fields, 'intentIds') ??
		readVecString(fields, 'intents') ??
		[]

	const intents: ApiAuctionIntentRow[] = intentsVec.slice(0, 10).map((id) => ({
		intentId: id,
		status: 'UNKNOWN',
	}))

	const auction: ApiAuctionDetail = {
		id: auctionId,
		status,
		createdAtMs: readString(fields, 'created_at_ms') ? Number(readString(fields, 'created_at_ms')) : undefined,
		deadlineMs: readString(fields, 'deadline_ms') ? Number(readString(fields, 'deadline_ms')) : undefined,
		intents,
		// settlement is best-effort; field names may differ by contract
		settlement: readString(fields, 'settlement_tx_digest')
			? { settlementTxDigest: readString(fields, 'settlement_tx_digest') ?? undefined }
			: undefined,
	}

	return { auction }
}


