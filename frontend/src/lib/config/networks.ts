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

type NetworkEnv = {
	rpcUrl: string
	chainIdentifier: string
	auctionBookId: string
	intentLinkType: string
	intentType: string
}

function s (v: string | undefined): string {
	return (v ?? '').trim()
}

// IMPORTANT (Next.js): env vars must be referenced statically to be inlined into client bundles.
// This table enumerates known networks and their required NEXT_PUBLIC_* keys.
const byNetworkEnv: Record<SuiNetwork, NetworkEnv> = {
	devnet: {
		rpcUrl: s(process.env.NEXT_PUBLIC_SUI_RPC_DEVNET),
		chainIdentifier: s(process.env.NEXT_PUBLIC_CHAIN_IDENTIFIER_DEVNET),
		auctionBookId: s(process.env.NEXT_PUBLIC_AUCTION_BOOK_ID_DEVNET),
		intentLinkType: s(process.env.NEXT_PUBLIC_INTENT_LINK_TYPE_DEVNET),
		intentType: s(process.env.NEXT_PUBLIC_INTENT_TYPE_DEVNET),
	},
	testnet: {
		rpcUrl: s(process.env.NEXT_PUBLIC_SUI_RPC_TESTNET),
		chainIdentifier: s(process.env.NEXT_PUBLIC_CHAIN_IDENTIFIER_TESTNET),
		auctionBookId: s(process.env.NEXT_PUBLIC_AUCTION_BOOK_ID_TESTNET),
		intentLinkType: s(process.env.NEXT_PUBLIC_INTENT_LINK_TYPE_TESTNET),
		intentType: s(process.env.NEXT_PUBLIC_INTENT_TYPE_TESTNET),
	},
	mainnet: {
		rpcUrl: s(process.env.NEXT_PUBLIC_SUI_RPC_MAINNET),
		chainIdentifier: s(process.env.NEXT_PUBLIC_CHAIN_IDENTIFIER_MAINNET),
		auctionBookId: s(process.env.NEXT_PUBLIC_AUCTION_BOOK_ID_MAINNET),
		intentLinkType: s(process.env.NEXT_PUBLIC_INTENT_LINK_TYPE_MAINNET),
		intentType: s(process.env.NEXT_PUBLIC_INTENT_TYPE_MAINNET),
	},
	localnet: {
		rpcUrl: s(process.env.NEXT_PUBLIC_SUI_RPC_LOCALNET),
		chainIdentifier: s(process.env.NEXT_PUBLIC_CHAIN_IDENTIFIER_LOCALNET),
		auctionBookId: s(process.env.NEXT_PUBLIC_AUCTION_BOOK_ID_LOCALNET),
		intentLinkType: s(process.env.NEXT_PUBLIC_INTENT_LINK_TYPE_LOCALNET),
		intentType: s(process.env.NEXT_PUBLIC_INTENT_TYPE_LOCALNET),
	},
}

function requiredValuesMissing (network: SuiNetwork): boolean {
	const e = byNetworkEnv[network]
	return (
		!e.rpcUrl ||
		!e.chainIdentifier ||
		!e.auctionBookId ||
		!e.intentLinkType ||
		!e.intentType
	)
}

export function shouldUseMockChain (network: SuiNetwork): boolean {
	// Explicit mock flags:
	if (env.useMockChain || env.useMockBackend) return true

	// Implicit mock fallback: if required chain config is missing, avoid hard failures in demos/dev.
	// Real deployments should set all required vars; missing config should be treated as misconfiguration.
	return requiredValuesMissing(network)
}

export function getSelectedNetworkFromEnvOrDefault (): SuiNetwork {
	if (env.defaultNetwork && isSuiNetwork(env.defaultNetwork)) return env.defaultNetwork
	return 'testnet'
}

export function getNetworkConfigIssues (network: SuiNetwork): string[] {
	// If we're in mock-chain mode (explicit or implicit), don't surface env issues as blockers.
	if (shouldUseMockChain(network)) return []

	const e = byNetworkEnv[network]
	const issues: string[] = []
	if (!e.rpcUrl) issues.push(`NEXT_PUBLIC_SUI_RPC_${network.toUpperCase()}`)
	if (!e.chainIdentifier) issues.push(`NEXT_PUBLIC_CHAIN_IDENTIFIER_${network.toUpperCase()}`)
	if (!e.auctionBookId) issues.push(`NEXT_PUBLIC_AUCTION_BOOK_ID_${network.toUpperCase()}`)
	if (!e.intentLinkType) issues.push(`NEXT_PUBLIC_INTENT_LINK_TYPE_${network.toUpperCase()}`)
	if (!e.intentType) issues.push(`NEXT_PUBLIC_INTENT_TYPE_${network.toUpperCase()}`)
	return issues
}

// Strict variant: always report missing env for a network (even if mock flags are enabled).
export function getNetworkConfigIssuesStrict (network: SuiNetwork): string[] {
	const e = byNetworkEnv[network]
	const issues: string[] = []
	if (!e.rpcUrl) issues.push(`NEXT_PUBLIC_SUI_RPC_${network.toUpperCase()}`)
	if (!e.chainIdentifier) issues.push(`NEXT_PUBLIC_CHAIN_IDENTIFIER_${network.toUpperCase()}`)
	if (!e.auctionBookId) issues.push(`NEXT_PUBLIC_AUCTION_BOOK_ID_${network.toUpperCase()}`)
	if (!e.intentLinkType) issues.push(`NEXT_PUBLIC_INTENT_LINK_TYPE_${network.toUpperCase()}`)
	if (!e.intentType) issues.push(`NEXT_PUBLIC_INTENT_TYPE_${network.toUpperCase()}`)
	return issues
}

export function getNetworkConfig (network: SuiNetwork): NetworkConfig {
	const isMock = shouldUseMockChain(network)
	const e = byNetworkEnv[network]
	const rpcUrl = e.rpcUrl
	const chainIdentifier = e.chainIdentifier
	const auctionBookId = e.auctionBookId
	const intentLinkType = e.intentLinkType
	const intentType = e.intentType

	return {
		network,
		rpcUrl: rpcUrl || (isMock ? `mock://rpc/${network}` : ''),
		chainIdentifier: chainIdentifier || (isMock ? `MOCK_CHAIN_${network}` : ''),
		auctionBookId: auctionBookId || (isMock ? `0xMOCK_AUCTION_BOOK_${network}` : ''),
		intentLinkType: intentLinkType || (isMock ? `0xMOCK::link::IntentRecordLink` : ''),
		intentType: intentType || (isMock ? `0xMOCK::intent::IntentRecord` : ''),
	}
}


