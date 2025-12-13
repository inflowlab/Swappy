'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import type { SuiNetwork } from '@/lib/network/types'
import { SUI_NETWORKS } from '@/lib/network/types'
import { getCurrentNetwork, setCurrentNetwork } from '@/lib/network/current'

type NetworkContextValue = {
	network: SuiNetwork
	setNetwork: (network: SuiNetwork) => void
	networks: readonly SuiNetwork[]
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

export function NetworkProvider (props: { children: React.ReactNode }) {
	const { children } = props
	const [network, setNetworkState] = useState<SuiNetwork>(() => getCurrentNetwork())

	const value = useMemo<NetworkContextValue>(() => {
		return {
			network,
			networks: SUI_NETWORKS,
			setNetwork: (n) => {
				setCurrentNetwork(n)
				setNetworkState(n)
			},
		}
	}, [network])

	return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetwork () {
	const ctx = useContext(NetworkContext)
	if (!ctx) throw new Error('useNetwork must be used within NetworkProvider')
	return ctx
}


