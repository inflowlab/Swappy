import { env } from '@/lib/env'
import type { ParsedIntentPreview } from '@/lib/api'

export type CreateIntentAndDepositResult = {
	digest: string
	intentId: string
}

export async function createIntentAndDeposit (
	parsed: ParsedIntentPreview,
): Promise<CreateIntentAndDepositResult> {
	// Foundation behavior:
	// - In demo/mock mode, simulate an on-chain tx result.
	// - In real mode, we require protocol tx-building details (argument schema, type args, etc).
	if (env.useMockBackend) {
		const intentId = `intent_${parsed.sellSymbol}_${parsed.buySymbol}`.replace(/[^a-zA-Z0-9_]/g, '_')
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

	// TODO(protocol): Implement real create_intent_and_deposit transaction building once the argument schema
	// is provided (Move module/function signature + required type args + object IDs + coin inputs).
	// Safety rule: never escrow funds without explicit wallet approval; all invariants are enforced on-chain.
	throw new Error(
		`create_intent_and_deposit is not implemented yet. Protocol package configured: ${env.protocolPackageId}`,
	)
}


