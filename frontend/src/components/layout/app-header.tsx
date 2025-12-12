'use client'

import Link from 'next/link'
import { useWalletConnection } from '@/components/wallet/wallet-connection'
import { cn } from '@/lib/utils/cn'

function shortAddress (address: string) {
	if (address.length <= 12) return address
	return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function AppHeader () {
	const { connected, address, connect, disconnect } = useWalletConnection()

	return (
		<header className='border-b border-zinc-200 bg-white'>
			<div className='mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4'>
				<div className='flex items-center gap-6'>
					<Link href='/' className='text-sm font-semibold tracking-tight'>
						Swappy
					</Link>
					<nav className='hidden items-center gap-4 text-sm text-zinc-700 sm:flex'>
						<Link href='/' className='hover:text-zinc-950'>
							Home
						</Link>
						<Link href='/intent/new' className='hover:text-zinc-950'>
							New Intent
						</Link>
					</nav>
				</div>

				<div className='flex items-center gap-3'>
					<div className='hidden text-xs text-zinc-600 sm:block'>
						{connected && address ? `Connected: ${shortAddress(address)}` : 'Wallet not connected'}
					</div>
					<button
						type='button'
						onClick={() => {
							if (connected) disconnect()
							else void connect()
						}}
						className={cn(
							'inline-flex h-9 items-center rounded-md px-3 text-sm font-medium',
							connected
								? 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
								: 'bg-zinc-900 text-white hover:bg-zinc-800',
						)}
					>
						{connected ? 'Disconnect' : 'Connect'}
					</button>
				</div>
			</div>
		</header>
	)
}


