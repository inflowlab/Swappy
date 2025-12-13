import type { SuiNetwork } from '@/lib/network/types'
import type { ApiIntent, ApiIntentDetail } from '@/lib/api'
import { IntentStatus } from '@/lib/models/intent-status'
import { env } from '@/lib/env'
import { getAuctionBookDynamicFieldByU64 } from '@/lib/sui/dynamic-fields'
import { mockGetIntentRecord } from '@/lib/sui/mock'
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

function normalizeStatus (raw: string | null): string {
	if (!raw) return 'UNKNOWN'
	// If backend/chain uses integers or different labels, keep raw.
	return raw
}

function mapIntentRecordFieldsToDetail (args: {
	intentId: string
	owner?: string | null
	fields: Record<string, unknown> | null
}): ApiIntentDetail {
	const { intentId, owner, fields } = args

	const statusRaw =
		readString(fields, 'status') ??
		readString(fields, 'intent_status') ??
		readString(fields, 'intentStatus') ??
		null

	const auctionId = readString(fields, 'auction_id') ?? readString(fields, 'auctionId') ?? undefined

	const expiresAtMsRaw =
		readString(fields, 'expires_at_ms') ??
		readString(fields, 'expiresAtMs') ??
		readString(fields, 'expiry_ms') ??
		null

	const detail: ApiIntentDetail = {
		id: intentId,
		owner: owner ?? '—',
		status: normalizeStatus(statusRaw),
		sellSymbol: readString(fields, 'sell_symbol') ?? readString(fields, 'sellSymbol') ?? undefined,
		buySymbol: readString(fields, 'buy_symbol') ?? readString(fields, 'buySymbol') ?? undefined,
		sellAmount: readString(fields, 'sell_amount') ?? readString(fields, 'sellAmount') ?? undefined,
		minBuyAmount: readString(fields, 'min_buy_amount') ?? readString(fields, 'minBuyAmount') ?? undefined,
		expiresAtMs: expiresAtMsRaw ? Number(expiresAtMsRaw) : undefined,
		auctionId,
		auctionDeadlineMs: readString(fields, 'auction_deadline_ms')
			? Number(readString(fields, 'auction_deadline_ms'))
			: readString(fields, 'auctionDeadlineMs')
				? Number(readString(fields, 'auctionDeadlineMs'))
				: undefined,
		settlementTxDigest:
			readString(fields, 'settlement_tx_digest') ?? readString(fields, 'settlementTxDigest') ?? undefined,
		redeemTxDigest: readString(fields, 'redeem_tx_digest') ?? readString(fields, 'redeemTxDigest') ?? undefined,
		solverUsed: readString(fields, 'solver_used') ?? readString(fields, 'solverUsed') ?? undefined,
		finalReceivedAmount:
			readString(fields, 'final_received_amount') ?? readString(fields, 'finalReceivedAmount') ?? undefined,
		// boolean fields may be stored as "true"/"false" or 0/1; treat best-effort.
		matchedViaCoW:
			readString(fields, 'matched_via_cow') === 'true'
				? true
				: readString(fields, 'matched_via_cow') === 'false'
					? false
					: undefined,
		routedViaCetus:
			readString(fields, 'routed_via_cetus') === 'true'
				? true
				: readString(fields, 'routed_via_cetus') === 'false'
					? false
					: undefined,
		failureReason: readString(fields, 'failure_reason') ?? readString(fields, 'failureReason') ?? undefined,
	}

	// If status is represented as numeric enum, consider mapping here later.
	// For now, keep raw and allow UI to show Unknown + warnings.
	return detail
}

export async function getIntentRecord (args: {
	network: SuiNetwork
	intentId: string
	owner?: string | null
}): Promise<{ intent: ApiIntentDetail | null; warning?: string }> {
	const { network, intentId, owner } = args
	if (env.useMockChain || shouldUseMockChain(network)) return mockGetIntentRecord({ network, intentId, owner })
	const res = await getAuctionBookDynamicFieldByU64({ network, key: intentId })
	const rec = asRecord(res)
	const data = asRecord(rec?.data)
	const fields = readFields(data)
	if (!fields) {
		return {
			intent: null,
			warning: 'Intent record not available on-chain yet (dynamic field missing or unreadable).',
		}
	}

	return {
		intent: mapIntentRecordFieldsToDetail({ intentId, owner, fields }),
	}
}

export async function resolveIntentSummaries (args: {
	network: SuiNetwork
	owner: string
	intentIds: string[]
}): Promise<{ intents: ApiIntent[]; warnings: string[] }> {
	const { network, owner, intentIds } = args
	const warnings: string[] = []
	const intents: ApiIntent[] = []

	for (const id of intentIds) {
		const res = await getIntentRecord({ network, intentId: id, owner })
		if (!res.intent) {
			warnings.push(res.warning ?? `Missing intent record for intent_id=${id}`)
			intents.push({
				id,
				owner,
				status: IntentStatus.FAILED,
				pairLabel: '—',
				sellAmount: undefined,
				sellSymbol: undefined,
				buySymbol: undefined,
				createdAtMs: undefined,
				extra: { warning: res.warning ?? 'Missing intent record' },
			})
			continue
		}

		intents.push({
			id: res.intent.id,
			owner: res.intent.owner,
			status: res.intent.status,
			pairLabel:
				res.intent.sellSymbol && res.intent.buySymbol
					? `${res.intent.sellSymbol} → ${res.intent.buySymbol}`
					: undefined,
			sellAmount: res.intent.sellAmount,
			sellSymbol: res.intent.sellSymbol,
			buySymbol: res.intent.buySymbol,
			createdAtMs: res.intent.createdAtMs,
			extra: res.intent.extra,
		})
	}

	return { intents, warnings }
}


