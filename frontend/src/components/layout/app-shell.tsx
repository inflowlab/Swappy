import type { ReactNode } from 'react'
import { AppHeader } from '@/components/layout/app-header'

export function AppShell (props: { children: ReactNode }) {
	const { children } = props

	return (
		<div className='min-h-dvh bg-zinc-50 text-zinc-950'>
			<AppHeader />
			<main className='mx-auto w-full max-w-5xl px-4 py-8'>{children}</main>
		</div>
	)
}


