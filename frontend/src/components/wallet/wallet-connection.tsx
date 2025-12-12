'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'
import {
	createNetworkConfig,
	SuiClientProvider,
	WalletProvider,
	useConnectWallet,
	useCurrentAccount,
	useDisconnectWallet,
	useWallets,
} from '@mysten/dapp-kit'
import { getFullnodeUrl } from '@mysten/sui/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@mysten/dapp-kit/dist/index.css'

type WalletConnection = {
	connected: boolean
	address: string | null
	connect: () => Promise<void>
	disconnect: () => void
}

const WalletConnectionContext = createContext<WalletConnection | null>(null)

const queryClient = new QueryClient()

const { networkConfig } = createNetworkConfig({
	testnet: {
		url: getFullnodeUrl('testnet'),
	},
})

function WalletConnectionState (props: { children: React.ReactNode }) {
	const { children } = props
	const wallets = useWallets()
	const account = useCurrentAccount()
	const { mutateAsync: connectWalletAsync } = useConnectWallet()
	const { mutate: disconnectWallet } = useDisconnectWallet()

	const connect = useCallback(async () => {
		if (account) return
		const firstWallet = wallets[0]
		if (!firstWallet) {
			const err = new Error('No Sui wallet detected. Please install a Sui wallet extension.')
			console.warn(err.message)
			throw err
		}

		await connectWalletAsync(
			{ wallet: firstWallet },
			{
				onError: (error) => console.error('Wallet connect failed:', error),
			},
		)
	}, [account, wallets, connectWalletAsync])

	const disconnect = useCallback(() => {
		if (!account) return
		disconnectWallet()
	}, [account, disconnectWallet])

	const value = useMemo<WalletConnection>(() => {
		return {
			connected: Boolean(account),
			address: account?.address ?? null,
			connect,
			disconnect,
		}
	}, [account, connect, disconnect])

	return <WalletConnectionContext.Provider value={value}>{children}</WalletConnectionContext.Provider>
}

export function WalletConnectionProvider (props: { children: React.ReactNode }) {
	const { children } = props

	return (
		<QueryClientProvider client={queryClient}>
			<SuiClientProvider networks={networkConfig} defaultNetwork='testnet'>
				<WalletProvider>
					<WalletConnectionState>{children}</WalletConnectionState>
				</WalletProvider>
			</SuiClientProvider>
		</QueryClientProvider>
	)
}

export function useWalletConnection () {
	const ctx = useContext(WalletConnectionContext)
	if (!ctx) throw new Error('useWalletConnection must be used within WalletConnectionProvider')
	return ctx
}


