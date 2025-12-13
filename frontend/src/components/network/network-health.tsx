'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNetwork } from '@/components/network/network-provider'
import { getNetworkConfig, getNetworkConfigIssues } from '@/lib/config/networks'
import { getRpcChainIdentifier } from '@/lib/sui/client'
import { WarningBanner } from '@/components/ui/banner'
import { env } from '@/lib/env'

export function useNetworkHealth () {
	const { network } = useNetwork()
	const [rpcChainId, setRpcChainId] = useState<string | null>(null)
	const [rpcError, setRpcError] = useState<string | null>(null)

	useEffect(() => {
		const issues = getNetworkConfigIssues(network)
		if (issues.length) return
		const expected = getNetworkConfig(network).chainIdentifier
		if (!expected) return
		let cancelled = false
		void getRpcChainIdentifier(network)
			.then((id) => {
				if (cancelled) return
				setRpcChainId(id)
			})
			.catch((err) => {
				if (cancelled) return
				console.error('Failed to read chainIdentifier from RPC:', err)
				setRpcError('Unable to verify RPC chainIdentifier.')
			})
		return () => {
			cancelled = true
		}
	}, [network])

	const configIssues = useMemo(() => getNetworkConfigIssues(network), [network])
	const expected = useMemo(() => getNetworkConfig(network).chainIdentifier, [network])
	const error = useMemo(() => {
		// In mock-chain mode (or implicit mock due to missing config) we do not enforce chainIdentifier/env checks.
		if (env.useMockChain) return null
		if (configIssues.length) return `Missing env vars for ${network}: ${configIssues.join(', ')}`
		if (rpcError) return rpcError
		if (rpcChainId && expected && rpcChainId !== expected) {
			return `RPC chainIdentifier mismatch. Expected ${expected}, got ${rpcChainId}.`
		}
		return null
	}, [configIssues, network, rpcError, rpcChainId, expected])

	const isMismatch = Boolean(rpcChainId) && Boolean(expected) && rpcChainId !== expected

	return {
		network,
		expectedChainIdentifier: expected,
		rpcChainIdentifier: rpcChainId,
		error,
		isMismatch,
	}
}

export function NetworkMismatchBanner () {
	const { error } = useNetworkHealth()

	// In mock-chain mode, mismatch checks are intentionally bypassed.
	// In real chain mode, show mismatch warnings and block writes elsewhere.
	if (!error) return null
	return (
		<WarningBanner title='Network mismatch'>
			<span suppressHydrationWarning>
				{error} Writes are blocked until networks match.
			</span>
		</WarningBanner>
	)
}


