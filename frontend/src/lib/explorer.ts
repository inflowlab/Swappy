import { env } from '@/lib/env'

export function getTxExplorerUrl (digest: string): string | null {
	if (!env.suiExplorerBaseUrl) return null
	const base = env.suiExplorerBaseUrl.replace(/\/+$/, '')
	return `${base}/txblock/${encodeURIComponent(digest)}`
}


