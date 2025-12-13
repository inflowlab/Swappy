import { env } from '@/lib/env'
import { getJson, postJson } from './http'
import { withNetwork } from './network'
import {
	mockGetAuction,
	mockGetAuctionDetail,
	mockGetIntent,
	mockGetIntentDetail,
	mockListAuctions,
	mockListIntents,
	mockParseFreeTextIntent,
	mockGetTokens,
} from './mock'
import type { FreeTextIntentParseRequest, FreeTextIntentParseResponse } from './intent-parse'
import type { ApiAuction, ApiAuctionDetail, ApiIntent, ApiIntentDetail, ApiToken } from './types'

function normalizeBaseUrl (baseUrl: string) {
	return baseUrl.replace(/\/+$/, '')
}

function shouldMockBackend (): boolean {
	return env.useMockBackend || !env.backendBaseUrl
}

export async function listIntentsByOwner (owner: string): Promise<ApiIntent[]> {
	if (shouldMockBackend()) return await mockListIntents(owner)
	const baseUrl = normalizeBaseUrl(env.backendBaseUrl as string)
	return await getJson<ApiIntent[]>(
		withNetwork(`${baseUrl}/intents?owner=${encodeURIComponent(owner)}`),
	)
}

export async function getIntentByOwner (owner: string, intentId: string): Promise<ApiIntent | null> {
	if (shouldMockBackend()) return await mockGetIntent(owner, intentId)
	const baseUrl = normalizeBaseUrl(env.backendBaseUrl as string)
	return await getJson<ApiIntent>(
		withNetwork(`${baseUrl}/intents/${encodeURIComponent(intentId)}?owner=${encodeURIComponent(owner)}`),
	)
}

export async function getIntentDetail (intentId: string): Promise<ApiIntentDetail | null> {
	if (shouldMockBackend()) return await mockGetIntentDetail(intentId)
	const baseUrl = normalizeBaseUrl(env.backendBaseUrl as string)
	return await getJson<ApiIntentDetail>(withNetwork(`${baseUrl}/intent/${encodeURIComponent(intentId)}`))
}

export async function listAuctions (): Promise<ApiAuction[]> {
	if (shouldMockBackend()) return await mockListAuctions()
	const baseUrl = normalizeBaseUrl(env.backendBaseUrl as string)
	return await getJson<ApiAuction[]>(withNetwork(`${baseUrl}/auctions`))
}

export async function getAuction (auctionId: string): Promise<ApiAuction | null> {
	if (shouldMockBackend()) return await mockGetAuction(auctionId)
	const baseUrl = normalizeBaseUrl(env.backendBaseUrl as string)
	return await getJson<ApiAuction>(withNetwork(`${baseUrl}/auctions/${encodeURIComponent(auctionId)}`))
}

export async function getAuctionDetail (auctionId: string): Promise<ApiAuctionDetail | null> {
	if (shouldMockBackend()) return await mockGetAuctionDetail(auctionId)
	const baseUrl = normalizeBaseUrl(env.backendBaseUrl as string)
	return await getJson<ApiAuctionDetail>(withNetwork(`${baseUrl}/auction/${encodeURIComponent(auctionId)}`))
}

export async function getTokens (): Promise<ApiToken[]> {
	if (shouldMockBackend()) return await mockGetTokens()
	const baseUrl = normalizeBaseUrl(env.backendBaseUrl as string)
	return await getJson<ApiToken[]>(withNetwork(`${baseUrl}/tokens`))
}

export async function parseFreeTextIntent (
	req: FreeTextIntentParseRequest,
): Promise<FreeTextIntentParseResponse> {
	if (shouldMockBackend()) return await mockParseFreeTextIntent(req.text)
	const baseUrl = normalizeBaseUrl(env.backendBaseUrl as string)
	return await postJson<FreeTextIntentParseResponse>(withNetwork(`${baseUrl}/intent/free-text`), req)
}


