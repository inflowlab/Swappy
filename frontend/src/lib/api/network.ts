import { getCurrentNetwork } from '@/lib/network/current'
import { getNetworkConfig } from '@/lib/config/networks'

export function withNetwork (url: string): string {
	const network = getCurrentNetwork()
	const chainIdentifier = getNetworkConfig(network).chainIdentifier
	const u = new URL(url, 'http://localhost')
	u.searchParams.set('network', network)
	u.searchParams.set('chainIdentifier', chainIdentifier)
	// Return only path+query if original looked relative; otherwise return full.
	if (url.startsWith('http://') || url.startsWith('https://')) return u.toString()
	return `${u.pathname}${u.search}`
}


