import { SuiClient } from '@mysten/sui/client'
import type { SuiNetwork } from '@/lib/network/types'
import { getNetworkConfig, shouldUseMockChain } from '@/lib/config/networks'
import { env } from '@/lib/env'

const clients: Partial<Record<SuiNetwork, SuiClient>> = {}

export function getSuiClient (network: SuiNetwork): SuiClient {
	const existing = clients[network]
	if (existing) return existing

	const { rpcUrl } = getNetworkConfig(network)
	// NOTE: We don't instantiate a real RPC client when using mock-chain or missing config.
	const client = new SuiClient({ url: rpcUrl || 'http://127.0.0.1:0' })
	clients[network] = client
	return client
}

export async function getRpcChainIdentifier (network: SuiNetwork): Promise<string> {
	if (env.useMockChain || shouldUseMockChain(network)) {
		// In mock-chain mode, pretend RPC is consistent with the expected chainIdentifier (if set),
		// otherwise return a stable placeholder.
		return getNetworkConfig(network).chainIdentifier || `MOCK_CHAIN_${network}`
	}
	const client = getSuiClient(network)
	return await client.getChainIdentifier()
}


