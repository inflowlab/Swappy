import { env } from '@/lib/env'
import { getJson } from './http'
import { mockGetAuction, mockGetIntent, mockListAuctions, mockListIntents } from './mock'
import type { ApiAuction, ApiIntent } from './types'

function normalizeBaseUrl (baseUrl: string) {
	return baseUrl.replace(/\/+$/, '')
}

function shouldMockBackend (): boolean {
	return env.useMockBackend || !env.backendBaseUrl
}

export async function listIntentsByOwner (owner: string): Promise<ApiIntent[]> {
	if (shouldMockBackend()) return await mockListIntents(owner)
	const baseUrl = normalizeBaseUrl(env.backendBaseUrl as string)
	return await getJson<ApiIntent[]>(`${baseUrl}/intents?owner=${encodeURIComponent(owner)}`)
}

export async function getIntentByOwner (owner: string, intentId: string): Promise<ApiIntent | null> {
	if (shouldMockBackend()) return await mockGetIntent(owner, intentId)
	const baseUrl = normalizeBaseUrl(env.backendBaseUrl as string)
	return await getJson<ApiIntent>(
		`${baseUrl}/intents/${encodeURIComponent(intentId)}?owner=${encodeURIComponent(owner)}`,
	)
}

export async function listAuctions (): Promise<ApiAuction[]> {
	if (shouldMockBackend()) return await mockListAuctions()
	const baseUrl = normalizeBaseUrl(env.backendBaseUrl as string)
	return await getJson<ApiAuction[]>(`${baseUrl}/auctions`)
}

export async function getAuction (auctionId: string): Promise<ApiAuction | null> {
	if (shouldMockBackend()) return await mockGetAuction(auctionId)
	const baseUrl = normalizeBaseUrl(env.backendBaseUrl as string)
	return await getJson<ApiAuction>(`${baseUrl}/auctions/${encodeURIComponent(auctionId)}`)
}


