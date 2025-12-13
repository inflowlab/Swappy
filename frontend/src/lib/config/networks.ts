import { env } from '@/lib/env'
import type { SuiNetwork } from '@/lib/network/types'
import { isSuiNetwork } from '@/lib/network/types'

export type NetworkConfig = {
	network: SuiNetwork
	rpcUrl: string
	chainIdentifier: string
	auctionBookId: string
	intentLinkType: string
	intentType: string
}

export function shouldUseMockChain (network: SuiNetwork): boolean {
	// Explicit mock flags:
	if (env.useMockChain || env.useMockBackend) return true

	// Implicit mock fallback: if required chain config is missing, avoid hard failures in demos/dev.
	// Real deployments should set all required vars; missing config should be treated as misconfiguration.
	const requiredKeys = [
		keyFor('NEXT_PUBLIC_SUI_RPC', network),
		keyFor('NEXT_PUBLIC_CHAIN_IDENTIFIER', network),
		keyFor('NEXT_PUBLIC_AUCTION_BOOK_ID', network),
		keyFor('NEXT_PUBLIC_INTENT_LINK_TYPE', network),
		keyFor('NEXT_PUBLIC_INTENT_TYPE', network),
	]
	return requiredKeys.some((k) => !(process.env[k] ?? '').trim())
}

function keyFor (prefix: string, network: SuiNetwork) {
	return `${prefix}_${network.toUpperCase()}`
}

function readByNetworkUnsafe (prefix: string, network: SuiNetwork): string {
	const key = keyFor(prefix, network)
	// Next.js exposes only NEXT_PUBLIC_ vars at runtime.
	return (process.env[key] ?? '').trim()
}

export function getSelectedNetworkFromEnvOrDefault (): SuiNetwork {
	if (env.defaultNetwork && isSuiNetwork(env.defaultNetwork)) return env.defaultNetwork
	return 'testnet'
}

export function getNetworkConfigIssues (network: SuiNetwork): string[] {
	// If we're in mock-chain mode (explicit or implicit), don't surface env issues as blockers.
	if (shouldUseMockChain(network)) return []

	const requiredKeys = [
		keyFor('NEXT_PUBLIC_SUI_RPC', network),
		keyFor('NEXT_PUBLIC_CHAIN_IDENTIFIER', network),
		keyFor('NEXT_PUBLIC_AUCTION_BOOK_ID', network),
		keyFor('NEXT_PUBLIC_INTENT_LINK_TYPE', network),
		keyFor('NEXT_PUBLIC_INTENT_TYPE', network),
	]

	return requiredKeys.filter((k) => !(process.env[k] ?? '').trim())
}

export function getNetworkConfig (network: SuiNetwork): NetworkConfig {
	const isMock = shouldUseMockChain(network)
	const rpcUrl = readByNetworkUnsafe('NEXT_PUBLIC_SUI_RPC', network)
	const chainIdentifier = readByNetworkUnsafe('NEXT_PUBLIC_CHAIN_IDENTIFIER', network)
	const auctionBookId = readByNetworkUnsafe('NEXT_PUBLIC_AUCTION_BOOK_ID', network)
	const intentLinkType = readByNetworkUnsafe('NEXT_PUBLIC_INTENT_LINK_TYPE', network)
	const intentType = readByNetworkUnsafe('NEXT_PUBLIC_INTENT_TYPE', network)

	return {
		network,
		rpcUrl: rpcUrl || (isMock ? `mock://rpc/${network}` : ''),
		chainIdentifier: chainIdentifier || (isMock ? `MOCK_CHAIN_${network}` : ''),
		auctionBookId: auctionBookId || (isMock ? `0xMOCK_AUCTION_BOOK_${network}` : ''),
		intentLinkType: intentLinkType || (isMock ? `0xMOCK::link::IntentRecordLink` : ''),
		intentType: intentType || (isMock ? `0xMOCK::intent::IntentRecord` : ''),
	}
}


