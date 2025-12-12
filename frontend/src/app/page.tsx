'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ApiIntent, HttpError } from '@/lib/api'
import { listIntentsByOwner } from '@/lib/api'
import { useWalletConnection } from '@/components/wallet/wallet-connection'
import { ErrorBanner, WarningBanner } from '@/components/ui/banner'
import { InlineNotification } from '@/components/ui/notification'
import { IntentTable } from '@/components/intent/intent-table'
import { env } from '@/lib/env'

function shortAddress (address: string) {
	if (address.length <= 12) return address
	return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function errorMessage (err: unknown): string {
	if (typeof err === 'string') return err
	if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
		return err.message
	}
	const httpErr = err as Partial<HttpError>
	if (httpErr?.status) return `Service temporarily unavailable (HTTP ${httpErr.status}).`
	return 'Service temporarily unavailable.'
}

export default function DashboardPage () {
	const { connected, address, connect } = useWalletConnection()

	const [intents, setIntents] = useState<ApiIntent[] | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [fetchError, setFetchError] = useState<string | null>(null)
	const [notification, setNotification] = useState<string | null>(null)

	const lastFetchedOwner = useRef<string | null>(null)

	const owner = address ?? null
	const hasWallet = connected && Boolean(owner)

	const canFetch = hasWallet && owner !== null

	const fetchIntents = useCallback(
		async (force?: boolean) => {
			if (!owner) return
			if (!force && lastFetchedOwner.current === owner) return

			setIsLoading(true)
			setFetchError(null)
			try {
				const data = await listIntentsByOwner(owner)
				setIntents(Array.isArray(data) ? data : [])
				lastFetchedOwner.current = owner
			} catch (err) {
				console.error('Intent fetch failed:', err)
				setFetchError(errorMessage(err))
				setIntents(null)
			} finally {
				setIsLoading(false)
			}
		},
		[owner],
	)

	useEffect(() => {
		// No backend calls before wallet connection.
		if (!canFetch) return
		void fetchIntents(false)
	}, [canFetch, fetchIntents])

	useEffect(() => {
		// Wallet disconnected mid-session: clear state safely.
		if (hasWallet) return
		lastFetchedOwner.current = null
		setIntents(null)
		setFetchError(null)
		setIsLoading(false)
	}, [hasWallet])

	const intentCountLabel = useMemo(() => {
		if (!hasWallet) return 'No wallet connected'
		if (isLoading) return 'Loading intents…'
		if (fetchError) return 'Unable to load intents'
		if (!intents) return 'Intents not loaded'
		return intents.length === 0 ? 'No intents' : `${intents.length} intent${intents.length === 1 ? '' : 's'}`
	}, [hasWallet, isLoading, fetchError, intents])

	return (
		<div className='space-y-6'>
			<div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
				<div className='space-y-1'>
					<h1 className='text-2xl font-semibold tracking-tight'>Dashboard</h1>
					<p className='text-sm text-zinc-700'>
						{hasWallet && owner ? `Connected: ${shortAddress(owner)}` : 'You are not connected.'}
					</p>
				</div>

				<div className='flex items-center gap-2'>
					<Link
						href='/intent/new'
						className='inline-flex h-9 items-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800'
					>
						Create Intent
					</Link>
					{hasWallet ? (
						<button
							type='button'
							onClick={() => void fetchIntents(true)}
							className='inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50'
						>
							Refresh
						</button>
					) : (
						<button
							type='button'
							onClick={() => {
								setNotification(null)
								void connect().catch((err) => {
									console.error('Wallet connect rejected/failed:', err)
									setNotification('Wallet connection was rejected or failed. Please try again.')
								})
							}}
							className='inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50'
						>
							Connect Wallet
						</button>
					)}
				</div>
			</div>

			{notification ? (
				<InlineNotification tone='warning' message={notification} />
			) : null}

			{!env.backendBaseUrl ? (
				<WarningBanner title='Backend URL not configured'>
					Set <code className='font-mono'>NEXT_PUBLIC_BACKEND_BASE_URL</code> (see
					<code className='ml-1 font-mono'>frontend/.env.example</code>).
				</WarningBanner>
			) : null}

			{!env.suiExplorerBaseUrl ? (
				<WarningBanner title='Sui Explorer URL not configured'>
					Set <code className='font-mono'>NEXT_PUBLIC_SUI_EXPLORER_BASE_URL</code> (see
					<code className='ml-1 font-mono'>frontend/.env.example</code>).
				</WarningBanner>
			) : null}

			<div className='rounded-lg border border-zinc-200 bg-white p-4'>
				<div className='flex items-center justify-between gap-3'>
					<div className='text-sm font-semibold'>Your intents</div>
					<div className='text-xs text-zinc-600'>{intentCountLabel}</div>
				</div>

				<div className='mt-4'>
					{!hasWallet ? (
						<div className='space-y-2'>
							<p className='text-sm text-zinc-700'>
								Connect your wallet to see your existing intents.
							</p>
							<p className='text-xs text-zinc-500'>No backend calls are made until you connect.</p>
						</div>
					) : fetchError ? (
						<ErrorBanner title='Service temporarily unavailable'>{fetchError}</ErrorBanner>
					) : isLoading ? (
						<div className='text-sm text-zinc-700'>Loading…</div>
					) : intents && intents.length === 0 ? (
						<div className='space-y-2'>
							<div className='text-sm text-zinc-700'>
								No intents yet. Create your first intent to get started.
							</div>
							<Link
								href='/intent/new'
								className='inline-flex h-9 items-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800'
							>
								Create Intent
							</Link>
						</div>
					) : intents ? (
						<IntentTable
							intents={intents}
							onCancelClick={(intent) => {
								// No signing logic in this milestone.
								setNotification(`Cancel not implemented yet (intent: ${intent.id}).`)
							}}
						/>
					) : (
						<div className='text-sm text-zinc-700'>Connect and refresh to load intents.</div>
					)}
				</div>
			</div>
		</div>
	)
}
