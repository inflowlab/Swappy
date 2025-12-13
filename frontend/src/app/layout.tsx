import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { WalletConnectionProvider } from '@/components/wallet/wallet-connection'
import { NetworkProvider } from '@/components/network/network-provider'
import { TokenRegistryProvider } from '@/components/tokens/token-registry'
import './globals.css'

export const metadata: Metadata = {
	title: 'Swappy',
	description: 'Intent-based trading UI for a Sui batch auction protocol',
}

export default function RootLayout (props: Readonly<{ children: React.ReactNode }>) {
	const { children } = props
	return (
		<html lang='en' suppressHydrationWarning>
			<body className='antialiased' suppressHydrationWarning>
				<NetworkProvider>
					<WalletConnectionProvider>
						<TokenRegistryProvider>
							<AppShell>{children}</AppShell>
						</TokenRegistryProvider>
					</WalletConnectionProvider>
				</NetworkProvider>
			</body>
		</html>
	)
}
