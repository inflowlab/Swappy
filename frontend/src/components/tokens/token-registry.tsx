'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ApiToken } from '@/lib/api'
import { getTokens } from '@/lib/api'
import { formatTokenLabel, formatTokenAmount } from '@/lib/tokens/format'
import { logUiError, toUiError } from '@/lib/errors/ui-errors'

type TokenRegistryState = {
	tokens: ApiToken[] | null
	isLoading: boolean
	error: string | null
	getById: (id: string) => ApiToken | null
	getBySymbol: (symbol: string) => ApiToken | null
	formatLabel: (args: { tokenId?: string | null; symbol?: string | null }) => string
	formatAmount: (raw: string, decimals: number) => string
}

const TokenRegistryContext = createContext<TokenRegistryState | null>(null)

let cachedTokens: ApiToken[] | null = null
let inflight: Promise<ApiToken[]> | null = null

async function fetchTokensOnce (): Promise<ApiToken[]> {
	if (cachedTokens) return cachedTokens
	if (!inflight) inflight = getTokens()
	const tokens = await inflight
	cachedTokens = tokens
	return tokens
}

export function TokenRegistryProvider (props: { children: React.ReactNode }) {
	const { children } = props

	const [tokens, setTokens] = useState<ApiToken[] | null>(cachedTokens)
	const [isLoading, setIsLoading] = useState(!cachedTokens)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		if (cachedTokens) return
		setIsLoading(true)
		setError(null)
		try {
			const t = await fetchTokensOnce()
			setTokens(t)
		} catch (err) {
			const uiErr = toUiError(err, { area: 'fetch' })
			logUiError(uiErr, { op: 'getTokens' })
			setError('Token registry unavailable. Falling back to unknown token labels.')
			setTokens(null)
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void load()
	}, [load])

	const byId = useMemo(() => {
		const map = new Map<string, ApiToken>()
		for (const t of tokens ?? []) {
			map.set(t.id, t)
		}
		return map
	}, [tokens])

	const bySymbol = useMemo(() => {
		const map = new Map<string, ApiToken>()
		for (const t of tokens ?? []) {
			map.set(t.symbol.toUpperCase(), t)
		}
		return map
	}, [tokens])

	const value = useMemo<TokenRegistryState>(() => {
		return {
			tokens,
			isLoading,
			error,
			getById: (id: string) => byId.get(id) ?? null,
			getBySymbol: (symbol: string) => bySymbol.get(symbol.toUpperCase()) ?? null,
			formatLabel: (args) => formatTokenLabel({ id: args.tokenId ?? null, symbol: args.symbol ?? null }),
			formatAmount: (raw, decimals) => formatTokenAmount(raw, decimals),
		}
	}, [tokens, isLoading, error, byId, bySymbol])

	return <TokenRegistryContext.Provider value={value}>{children}</TokenRegistryContext.Provider>
}

export function useTokenRegistry () {
	const ctx = useContext(TokenRegistryContext)
	if (!ctx) throw new Error('useTokenRegistry must be used within TokenRegistryProvider')
	return ctx
}


