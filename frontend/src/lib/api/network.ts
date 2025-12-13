import { getCurrentNetwork } from '@/lib/network/current'

export function withNetwork (url: string): string {
	const network = getCurrentNetwork()
	const u = new URL(url, 'http://localhost')
	u.searchParams.set('network', network)
	// Return only path+query if original looked relative; otherwise return full.
	if (url.startsWith('http://') || url.startsWith('https://')) return u.toString()
	return `${u.pathname}${u.search}`
}


