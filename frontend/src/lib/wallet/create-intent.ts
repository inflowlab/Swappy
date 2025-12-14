import { env } from '@/lib/env'
import type { ParsedIntentPreview } from '@/lib/api'
import type { SuiNetwork } from '@/lib/network/types'
import type { SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { getAuctionBookId, getIntentLinkType } from '@/lib/config/types'
import { getNetworkConfigIssuesStrict } from '@/lib/config/networks'
import { parseDecimalToBigInt, assertU64 } from '@/lib/utils/decimal'
import { selectCoinObjectIds } from '@/lib/sui/coin-selection'

export type CreateIntentAndDepositResult = {
	digest: string
	intentId: string
}

const SUI_TYPE = '0x2::sui::SUI'
const SUI_CLOCK_OBJECT_ID = '0x6'

function resolveCoinType (tokenId: string): string {
	const trimmed = tokenId.trim()
	if (trimmed === '0xUSDC') {
		// MVP placeholder in coordinator token registry; actual on-chain type lives in this package.
		if (!env.protocolPackageId) {
			throw new Error(
				'Token "0xUSDC" requires NEXT_PUBLIC_PROTOCOL_PACKAGE_ID to resolve to <package>::usdc_coin::USDC.',
			)
		}
		return `${env.protocolPackageId}::usdc_coin::USDC`
	}
	return trimmed
}

function chainIdForNetwork (network: SuiNetwork): string {
	return `sui:${network}` as const
}

function extractCreatedObjectId (args: {
	objectChanges: unknown
	targetStructType: string
}): string | null {
	const { objectChanges, targetStructType } = args
	if (!Array.isArray(objectChanges)) return null
	for (const ch of objectChanges) {
		if (!ch || typeof ch !== 'object') continue
		const rec = ch as Record<string, unknown>
		if (rec.type !== 'created') continue
		const objectType = typeof rec.objectType === 'string' ? rec.objectType : ''
		const objectId = typeof rec.objectId === 'string' ? rec.objectId : ''
		if (objectType === targetStructType && objectId) return objectId
	}
	return null
}

function readIntentIdFromObject (obj: unknown): string | null {
	if (!obj || typeof obj !== 'object') return null
	const rec = obj as Record<string, unknown>
	const data = rec.data && typeof rec.data === 'object' ? (rec.data as Record<string, unknown>) : null
	const content =
		data?.content && typeof data.content === 'object' ? (data.content as Record<string, unknown>) : null
	const fields =
		content?.fields && typeof content.fields === 'object'
			? (content.fields as Record<string, unknown>)
			: null
	if (!fields) return null
	const v = fields.intent_id ?? fields.intentId ?? fields.intentID
	if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') return String(v)
	return null
}

async function sharedObjectArg (tx: Transaction, client: SuiClient, objectId: string, mutable: boolean) {
	const res = await client.getObject({ id: objectId, options: { showOwner: true } })
	const rec = res as unknown as { error?: unknown; data?: { owner?: unknown } }
	if (rec.error) {
		throw new Error(`Object not found on-chain: ${objectId}`)
	}

	const owner = rec.data?.owner as unknown
	if (!owner || typeof owner !== 'object') {
		throw new Error(`Unable to resolve owner for object: ${objectId}`)
	}
	const ownerRec = owner as Record<string, unknown>
	const shared = ownerRec.Shared
	if (!shared || typeof shared !== 'object') {
		throw new Error(`Expected shared object but got non-shared owner for: ${objectId}`)
	}
	const sharedRec = shared as Record<string, unknown>
	const initial =
		(typeof sharedRec.initial_shared_version === 'string' || typeof sharedRec.initial_shared_version === 'number'
			? sharedRec.initial_shared_version
			: typeof sharedRec.initialSharedVersion === 'string' || typeof sharedRec.initialSharedVersion === 'number'
				? sharedRec.initialSharedVersion
				: null)
	if (initial === null) {
		throw new Error(`Missing initial shared version for: ${objectId}`)
	}

	return tx.sharedObjectRef({ objectId, initialSharedVersion: initial, mutable })
}

export async function createIntentAndDeposit (
	args: {
		parsed: ParsedIntentPreview
		network: SuiNetwork
		owner: string
		sellDecimals: number
		buyDecimals: number
		client: SuiClient
		signAndExecute: (tx: Transaction, chain: string) => Promise<{ digest: string; objectChanges?: unknown }>
	},
): Promise<CreateIntentAndDepositResult> {
	const { parsed, network, owner, sellDecimals, buyDecimals, client, signAndExecute } = args

	// Foundation behavior:
	// - In demo/mock tx mode, simulate an on-chain tx result.
	// - In real mode, we require protocol tx-building details (argument schema, type args, etc).
	if (env.useMockTx) {
		const intentId = `intent_${parsed.sellToken}_${parsed.buyToken}`.replace(/[^a-zA-Z0-9_]/g, '_')
		return {
			digest: `MOCK_TX_${intentId}`,
			intentId,
		}
	}

	if (!env.protocolPackageId) {
		throw new Error(
			'Missing NEXT_PUBLIC_PROTOCOL_PACKAGE_ID. Set it in frontend/.env.local before enabling real on-chain intent creation.',
		)
	}

	// Preflight: make sure package/module/function exist (helps catch wrong package id early).
	try {
		await client.getNormalizedMoveFunction({
			package: env.protocolPackageId,
			module: 'intent',
			function: 'create_intent_and_deposit',
		})
	} catch (e) {
		const msg = e instanceof Error ? e.message : ''
		throw new Error(
			`Protocol package/moveCall mismatch. Unable to read ${env.protocolPackageId}::intent::create_intent_and_deposit via RPC. ${msg}`,
		)
	}

	const issues = getNetworkConfigIssuesStrict(network)
	if (issues.length) {
		throw new Error(`Missing required env vars for ${network}: ${issues.join(', ')}`)
	}

	const sellType = resolveCoinType(parsed.sellToken)
	const buyType = resolveCoinType(parsed.buyToken)

	const sellAmountAtomic = parseDecimalToBigInt(parsed.sellAmount, sellDecimals)
	const minBuyAmountAtomic = parseDecimalToBigInt(parsed.minBuyAmount, buyDecimals)
	assertU64(sellAmountAtomic, 'sell amount')
	assertU64(minBuyAmountAtomic, 'min buy amount')

	const expirationMs = BigInt(Math.trunc(parsed.expiresAtMs))
	assertU64(expirationMs, 'expiration_ms')

	const auctionBookId = getAuctionBookId(network)
	if (!auctionBookId) {
		throw new Error(`Missing auction book object id for ${network}.`)
	}
	if (auctionBookId.includes('MOCK')) {
		throw new Error(
			`Auction book id for ${network} is a mock placeholder. Set NEXT_PUBLIC_AUCTION_BOOK_ID_${network.toUpperCase()} to the deployed AuctionBook object id.`,
		)
	}

	// Build transaction.
	const tx = new Transaction()

	// Shared inputs (must include initialSharedVersion)
	const auctionBookArg = await sharedObjectArg(tx, client, auctionBookId, true)
	const clockArg = await sharedObjectArg(tx, client, SUI_CLOCK_OBJECT_ID, false)

	// Coin input:
	let coinArg: unknown
	if (sellType === SUI_TYPE) {
		// For SUI, split from the gas coin.
		const [deposit] = tx.splitCoins(tx.gas, [tx.pure.u64(sellAmountAtomic)])
		coinArg = deposit
	} else {
		const { objectIds } = await selectCoinObjectIds({
			client,
			owner,
			coinType: sellType,
			required: sellAmountAtomic,
		})
		if (objectIds.length === 0) throw new Error('No coin objects available.')
		const primary = tx.object(objectIds[0])
		const rest = objectIds.slice(1).map((id) => tx.object(id))
		if (rest.length) tx.mergeCoins(primary, rest)
		coinArg = primary
	}

	tx.moveCall({
		target: `${env.protocolPackageId}::intent::create_intent_and_deposit`,
		typeArguments: [sellType, buyType],
		arguments: [
			auctionBookArg,
			clockArg,
			coinArg as never,
			tx.pure.u64(sellAmountAtomic),
			tx.pure.u64(minBuyAmountAtomic),
			tx.pure.u64(expirationMs),
		],
	})

	const chain = chainIdForNetwork(network)
	const result = await signAndExecute(tx, chain)

	// Extract intent_id via the created IntentRecordLink.
	const linkType = getIntentLinkType(network)
	const createdLinkId = extractCreatedObjectId({
		objectChanges: result.objectChanges,
		targetStructType: linkType,
	})
	if (!createdLinkId) {
		throw new Error('Transaction succeeded but could not locate created IntentRecordLink.')
	}

	const obj = await client.getObject({
		id: createdLinkId,
		options: { showContent: true },
	})
	const intentId = readIntentIdFromObject(obj)
	if (!intentId) {
		throw new Error('Transaction succeeded but could not decode intent_id from IntentRecordLink.')
	}

	return { digest: result.digest, intentId }
}


