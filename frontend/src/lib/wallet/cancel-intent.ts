import { env } from '@/lib/env'

export type CancelIntentResult = {
	digest: string
}

export async function cancelIntent (intentId: string): Promise<CancelIntentResult> {
	if (env.useMockBackend) {
		return { digest: `MOCK_CANCEL_${encodeURIComponent(intentId)}` }
	}

	if (!env.protocolPackageId) {
		throw new Error(
			'Missing NEXT_PUBLIC_PROTOCOL_PACKAGE_ID. Set it in frontend/.env.local before enabling real intent cancellation.',
		)
	}

	// TODO(protocol): Implement real cancel_intent transaction building once the argument schema
	// is provided (Move module/function signature + required object IDs).
	throw new Error(`cancel_intent is not implemented yet. Protocol package configured: ${env.protocolPackageId}`)
}


