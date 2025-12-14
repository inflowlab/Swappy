'use client'

import { useEffect, useMemo, useState } from 'react'
import { WarningBanner } from '@/components/ui/banner'
import { env } from '@/lib/env'

type HealthState =
	| { status: 'idle' }
	| { status: 'ok' }
	| { status: 'error'; message: string }

function normalizeBaseUrl (baseUrl: string) {
	return baseUrl.replace(/\/+$/, '')
}

export function CoordinatorHealthBanner () {
	const reason = useMemo(() => {
		if (env.useMockBackend) return 'NEXT_PUBLIC_USE_MOCK_BACKEND is enabled.'
		if (!env.coordinatorUrl) return 'NEXT_PUBLIC_COORDINATOR_URL is missing.'
		return null
	}, [])

	const [health, setHealth] = useState<HealthState>({ status: 'idle' })

	useEffect(() => {
		if (env.useMockBackend) return
		if (!env.coordinatorUrl) return

		let cancelled = false
		const baseUrl = normalizeBaseUrl(env.coordinatorUrl)
		void fetch(`${baseUrl}/health`)
			.then(async (r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`)
				return await r.json().catch(() => ({}))
			})
			.then((body) => {
				if (cancelled) return
				if (body && typeof body === 'object' && (body as { status?: unknown }).status === 'ok') {
					setHealth({ status: 'ok' })
				} else {
					setHealth({ status: 'error', message: 'Unexpected /health response.' })
				}
			})
			.catch((e) => {
				if (cancelled) return
				setHealth({ status: 'error', message: e instanceof Error ? e.message : 'Health check failed.' })
			})

		return () => {
			cancelled = true
		}
	}, [])

	// If everything is configured and healthy, don't show anything.
	if (!reason && health.status === 'ok') return null

	return (
		<WarningBanner title='Backend mode'>
			<div className='space-y-1'>
				<div>
					<strong>useMockBackend</strong>: {String(env.useMockBackend)}
				</div>
				<div>
					<strong>coordinatorUrl</strong>: {env.coordinatorUrl ?? '(unset)'}
				</div>
				{reason ? <div>{reason} The UI will use mock tokens + mock parsing.</div> : null}
				{!reason ? (
					<div>
						<strong>coordinator /health</strong>:{' '}
						{health.status === 'idle'
							? 'checking…'
							: health.status === 'ok'
								? 'ok'
								: `error (${health.message})`}
					</div>
				) : null}
				<div className='opacity-80'>
					Note: after changing <code className='font-mono'>frontend/.env.local</code>, fully restart{' '}
					<code className='font-mono'>npm run dev</code>.
				</div>
			</div>
		</WarningBanner>
	)
}


