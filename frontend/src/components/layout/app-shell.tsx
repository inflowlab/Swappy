'use client'

import type { ReactNode } from 'react'
import { AppHeader } from '@/components/layout/app-header'
import { NetworkMismatchBanner } from '@/components/network/network-health'
import { TokenRegistryBanner } from '@/components/tokens/token-registry-banner'
import { CoordinatorHealthBanner } from '@/components/api/coordinator-health-banner'

export function AppShell (props: { children: ReactNode }) {
	const { children } = props

	return (
		<div className='min-h-dvh bg-zinc-50 text-zinc-950'>
			<AppHeader />
			<main className='mx-auto w-full max-w-5xl space-y-4 px-4 py-8'>
				<CoordinatorHealthBanner />
				<NetworkMismatchBanner />
				<TokenRegistryBanner />
				{children}
			</main>
		</div>
	)
}


