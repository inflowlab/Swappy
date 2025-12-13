import type { SuiNetwork } from '@/lib/network/types'
import { getNetworkConfig } from '@/lib/config/networks'

export function getIntentLinkType (network: SuiNetwork): string {
	return getNetworkConfig(network).intentLinkType
}

export function getIntentType (network: SuiNetwork): string {
	return getNetworkConfig(network).intentType
}

export function getAuctionBookId (network: SuiNetwork): string {
	return getNetworkConfig(network).auctionBookId
}


