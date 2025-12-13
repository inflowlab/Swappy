import { env } from '@/lib/env'
import type { SuiNetwork } from '@/lib/network/types'
import { isSuiNetwork } from '@/lib/network/types'

const STORAGE_KEY = 'swappy.network'

let current: SuiNetwork | null = null

function readDefault (): SuiNetwork {
	if (env.defaultNetwork && isSuiNetwork(env.defaultNetwork)) return env.defaultNetwork
	return 'testnet'
}

export function getCurrentNetwork (): SuiNetwork {
	if (current) return current

	// Client persisted selection:
	if (typeof window !== 'undefined') {
		const stored = window.localStorage.getItem(STORAGE_KEY)
		if (stored && isSuiNetwork(stored)) {
			current = stored
			return current
		}
	}

	current = readDefault()
	return current
}

export function setCurrentNetwork (network: SuiNetwork) {
	current = network
	if (typeof window !== 'undefined') {
		window.localStorage.setItem(STORAGE_KEY, network)
	}
}


