import { env } from '@/lib/env'
import { getJson, postJson } from './http'
import { withNetwork } from './network'
import {
	mockParseFreeTextIntent,
	mockGetTokens,
} from './mock'
import type { FreeTextIntentParseRequest, FreeTextIntentParseResponse } from './intent-parse'
import type { ApiToken } from './types'

function normalizeBaseUrl (baseUrl: string) {
	return baseUrl.replace(/\/+$/, '')
}

function shouldMockBackend (): boolean {
	return env.useMockBackend || !env.coordinatorUrl
}

export async function getTokens (): Promise<ApiToken[]> {
	if (shouldMockBackend()) return await mockGetTokens()
	const baseUrl = normalizeBaseUrl(env.coordinatorUrl as string)
	return await getJson<ApiToken[]>(withNetwork(`${baseUrl}/api/tokens`))
}

export async function parseFreeTextIntent (
	req: FreeTextIntentParseRequest,
	opts?: { idempotencyKey?: string },
): Promise<FreeTextIntentParseResponse> {
	if (shouldMockBackend()) return await mockParseFreeTextIntent(req.text)
	const baseUrl = normalizeBaseUrl(env.coordinatorUrl as string)
	return await postJson<FreeTextIntentParseResponse>(
		withNetwork(`${baseUrl}/api/intent/free-text`),
		req,
		{
			headers: {
				...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
			},
		},
	)
}


