'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ApiIntentDetail } from '@/lib/api'
import { getIntentDetail } from '@/lib/api'
import { StatusBadge } from '@/components/status-badge'
import { ErrorBanner, WarningBanner } from '@/components/ui/banner'
import { InlineNotification } from '@/components/ui/notification'
import { getTxExplorerUrl } from '@/lib/explorer'
import { useTokenRegistry } from '@/components/tokens/token-registry'
import { cancelIntent } from '@/lib/wallet'
import { useWalletConnection } from '@/components/wallet/wallet-connection'
import { logUiError, toUiError } from '@/lib/errors/ui-errors'

function shortId (id: string) {
	if (id.length <= 18) return id
	return `${id.slice(0, 10)}…${id.slice(-6)}`
}

function shortAddress (address: string) {
	if (address.length <= 12) return address
	return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function formatUtc (ms: number | undefined) {
	if (!ms) return '—'
	try {
		return new Date(ms).toUTCString()
	} catch {
		return String(ms)
	}
}

function isTerminalStatus (status: string) {
	return status === 'SETTLED' || status === 'CANCELED' || status === 'EXPIRED' || status === 'FAILED'
}

export function IntentDetail (props: { intentId: string }) {
	const { intentId } = props
	const { connected } = useWalletConnection()
	const tokenRegistry = useTokenRegistry()

	const [intent, setIntent] = useState<ApiIntentDetail | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const [isCanceling, setIsCanceling] = useState(false)
	const [cancelError, setCancelError] = useState<string | null>(null)
	const [notification, setNotification] = useState<string | null>(null)

	const load = useCallback(async () => {
		setIsLoading(true)
		setError(null)
		try {
			const data = await getIntentDetail(intentId)
			if (!data) {
				setError('Intent not found.')
				setIntent(null)
				return
			}
			setIntent(data)
		} catch (err) {
			const uiErr = toUiError(err, { area: 'fetch' })
			logUiError(uiErr, { op: 'getIntentDetail', intentId })
			setError(uiErr.userMessage)
			setIntent(null)
		} finally {
			setIsLoading(false)
		}
	}, [intentId])

	useEffect(() => {
		// Fetch on mount only (and when navigating to a different intent id).
		void load()
	}, [load])

	const sellToken = useMemo(() => {
		const symbol = intent?.sellSymbol
		if (!symbol) return null
		return tokenRegistry.getBySymbol(symbol)
	}, [intent?.sellSymbol, tokenRegistry])

	const buyToken = useMemo(() => {
		const symbol = intent?.buySymbol
		if (!symbol) return null
		return tokenRegistry.getBySymbol(symbol)
	}, [intent?.buySymbol, tokenRegistry])

	const status = intent?.status ? String(intent.status) : 'UNKNOWN'

	const terminalDigest = useMemo(() => {
		if (!intent) return null
		if (status === 'SETTLED') return intent.settlementTxDigest ?? null
		if (status === 'CANCELED' || status === 'EXPIRED') return intent.redeemTxDigest ?? null
		return null
	}, [intent, status])

	const terminalDigestUrl = terminalDigest ? getTxExplorerUrl(terminalDigest) : null

	const showOnChainPendingWarning = useMemo(() => {
		if (!intent) return false
		if (!isTerminalStatus(status)) return false
		// Terminal states should include tx digest evidence; if missing, warn.
		return status !== 'FAILED' && !terminalDigest
	}, [intent, status, terminalDigest])

	const canCancel = status === 'OPEN_ESCROWED'

	return (
		<div className='space-y-6'>
			<div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
				<div className='space-y-1'>
					<h1 className='text-2xl font-semibold tracking-tight'>Intent</h1>
					<p className='text-sm text-zinc-700'>
						Intent <code className='font-mono'>{shortId(intentId)}</code>
					</p>
				</div>
				<Link
					href='/'
					className='inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50'
				>
					Back to Dashboard
				</Link>
			</div>

			{notification ? <InlineNotification tone='warning' message={notification} /> : null}

			{isLoading ? <div className='text-sm text-zinc-700'>Loading…</div> : null}
			{error ? <ErrorBanner title='Unable to load intent'>{error}</ErrorBanner> : null}

			{intent ? (
				<div className='space-y-6'>
					<div className='rounded-lg border border-zinc-200 bg-white p-4'>
						<div className='text-sm font-semibold'>Intent information</div>
						<div className='mt-3 grid gap-3 sm:grid-cols-2'>
							<div className='rounded-md border border-zinc-200 p-3'>
								<div className='text-xs font-semibold text-zinc-700'>Intent ID</div>
								<div className='mt-1 font-mono text-xs text-zinc-950'>{intent.id}</div>
							</div>
							<div className='rounded-md border border-zinc-200 p-3'>
								<div className='text-xs font-semibold text-zinc-700'>Owner</div>
								<div className='mt-1 text-sm text-zinc-950'>
									{intent.owner ? (
										<span className='font-mono text-xs'>{shortAddress(intent.owner)}</span>
									) : (
										'—'
									)}
								</div>
							</div>

							<div className='rounded-md border border-zinc-200 p-3'>
								<div className='text-xs font-semibold text-zinc-700'>Sell</div>
								<div className='mt-1 text-sm text-zinc-950'>
									{intent.sellAmount && (sellToken?.decimals ?? null) !== null
										? `${tokenRegistry.formatAmount(intent.sellAmount, sellToken?.decimals ?? 0)} ${tokenRegistry.formatLabel({ symbol: intent.sellSymbol })}`
										: intent.sellAmount
											? `${intent.sellAmount} ${tokenRegistry.formatLabel({ symbol: intent.sellSymbol })}`
											: '—'}
								</div>
							</div>
							<div className='rounded-md border border-zinc-200 p-3'>
								<div className='text-xs font-semibold text-zinc-700'>Buy (minimum)</div>
								<div className='mt-1 text-sm text-zinc-950'>
									{intent.minBuyAmount && (buyToken?.decimals ?? null) !== null
										? `${tokenRegistry.formatAmount(intent.minBuyAmount, buyToken?.decimals ?? 0)} ${tokenRegistry.formatLabel({ symbol: intent.buySymbol })}`
										: intent.minBuyAmount
											? `${intent.minBuyAmount} ${tokenRegistry.formatLabel({ symbol: intent.buySymbol })}`
											: '—'}
								</div>
							</div>

							<div className='rounded-md border border-zinc-200 p-3'>
								<div className='text-xs font-semibold text-zinc-700'>Expiration</div>
								<div className='mt-1 text-sm text-zinc-950'>{formatUtc(intent.expiresAtMs)}</div>
							</div>
							<div className='rounded-md border border-zinc-200 p-3'>
								<div className='text-xs font-semibold text-zinc-700'>Status</div>
								<div className='mt-1'>
									<StatusBadge status={intent.status} />
								</div>
							</div>
						</div>
					</div>

					{showOnChainPendingWarning ? (
						<WarningBanner title='Status pending on-chain confirmation'>
							Status is not finalized yet. The backend reported a terminal state but did not provide an
							on-chain transaction digest. Funds are not finalized until confirmed on-chain.
						</WarningBanner>
					) : null}

					{!intent.sellSymbol || !intent.buySymbol ? (
						<WarningBanner title='Partial intent data'>
							Some token metadata is missing from the backend response. Displayed fields may be incomplete.
						</WarningBanner>
					) : null}

					{/* Status-specific blocks (mutually exclusive) */}
					{status === 'OPEN_ESCROWED' ? (
						<div className='rounded-lg border border-zinc-200 bg-white p-4'>
							<div className='text-sm font-semibold'>Waiting for auction</div>
							<p className='mt-2 text-sm text-zinc-700'>
								Funds are escrowed and waiting for batch auction settlement.
							</p>
							<p className='mt-2 text-xs text-zinc-500'>
								Expiration: <span className='font-mono'>{formatUtc(intent.expiresAtMs)}</span>
							</p>
							<div className='mt-4 flex items-center gap-2'>
								<button
									type='button'
									disabled={!connected || !canCancel || isCanceling}
									onClick={() => {
										setIsCanceling(true)
										setCancelError(null)
										setNotification(null)
										console.log('Cancel intent attempt:', intent.id)
										void cancelIntent(intent.id)
											.then(() => {
												setNotification('Cancel submitted. Refreshing intent status…')
												// Refetch after user-initiated tx.
												setTimeout(() => void load(), 600)
											})
											.catch((err) => {
												const uiErr = toUiError(err, { area: 'sign' })
												logUiError(uiErr, { op: 'cancelIntent', intentId: intent.id })
												setCancelError(uiErr.userMessage)
											})
											.finally(() => setIsCanceling(false))
									}}
									className='inline-flex h-9 items-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300'
								>
									{isCanceling ? 'Canceling…' : 'Cancel Intent'}
								</button>
								{!connected ? (
									<span className='text-xs text-zinc-500'>Connect your wallet to cancel.</span>
								) : null}
							</div>
							{cancelError ? <ErrorBanner title='Cancel error'>{cancelError}</ErrorBanner> : null}
						</div>
					) : null}

					{status === 'BATCHED' ? (
						<div className='rounded-lg border border-zinc-200 bg-white p-4'>
							<div className='text-sm font-semibold'>Batched into an auction</div>
							<p className='mt-2 text-sm text-zinc-700'>Included in an auction and waiting for settlement.</p>
							<div className='mt-3 grid gap-3 sm:grid-cols-2'>
								<div className='rounded-md border border-zinc-200 p-3'>
									<div className='text-xs font-semibold text-zinc-700'>Auction ID</div>
									<div className='mt-1 font-mono text-xs'>
										{intent.auctionId ? (
											<Link
												href={`/auction/${encodeURIComponent(intent.auctionId)}`}
												className='underline hover:text-zinc-950'
											>
												{intent.auctionId}
											</Link>
										) : (
											'—'
										)}
									</div>
								</div>
								<div className='rounded-md border border-zinc-200 p-3'>
									<div className='text-xs font-semibold text-zinc-700'>Auction deadline</div>
									<div className='mt-1 text-sm'>{formatUtc(intent.auctionDeadlineMs)}</div>
								</div>
							</div>

							{intent.auctionId ? (
								<div className='mt-4'>
									<Link
										href={`/auction/${encodeURIComponent(intent.auctionId)}`}
										className='inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50'
									>
										View Auction
									</Link>
								</div>
							) : null}
						</div>
					) : null}

					{status === 'SETTLED' ? (
						<div className='rounded-lg border border-zinc-200 bg-white p-4'>
							<div className='text-sm font-semibold'>Settled</div>
							<p className='mt-2 text-sm text-zinc-700'>Your intent was settled successfully.</p>

							<div className='mt-3 space-y-2 text-sm'>
								<div>
									Auction:{' '}
									{intent.auctionId ? (
										<Link
											href={`/auction/${encodeURIComponent(intent.auctionId)}`}
											className='underline hover:text-zinc-950'
										>
											<code className='font-mono'>{intent.auctionId}</code>
										</Link>
									) : (
										'—'
									)}
								</div>
								<div>
									Settlement tx:{' '}
									{intent.settlementTxDigest ? (
										terminalDigestUrl ? (
											<a href={terminalDigestUrl} target='_blank' rel='noreferrer' className='underline'>
												<code className='font-mono'>{intent.settlementTxDigest}</code>
											</a>
										) : (
											<code className='font-mono'>{intent.settlementTxDigest}</code>
										)
									) : (
										'—'
									)}
								</div>
								<div>Solver used: {intent.solverUsed ?? '—'}</div>
								<div>
									Matched via CoW: {typeof intent.matchedViaCoW === 'boolean' ? (intent.matchedViaCoW ? 'Yes' : 'No') : '—'}
								</div>
								<div>
									Routed via Cetus:{' '}
									{typeof intent.routedViaCetus === 'boolean' ? (intent.routedViaCetus ? 'Yes' : 'No') : '—'}
								</div>
								<div>Final received amount: {intent.finalReceivedAmount ?? '—'}</div>
							</div>

							{intent.auctionId ? (
								<div className='mt-4'>
									<Link
										href={`/auction/${encodeURIComponent(intent.auctionId)}`}
										className='inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50'
									>
										View Auction
									</Link>
								</div>
							) : null}
						</div>
					) : null}

					{status === 'CANCELED' ? (
						<div className='rounded-lg border border-zinc-200 bg-white p-4'>
							<div className='text-sm font-semibold'>Canceled</div>
							<p className='mt-2 text-sm text-zinc-700'>Intent canceled. Funds returned to your wallet.</p>
							<div className='mt-3 text-sm'>
								Redeem tx:{' '}
								{intent.redeemTxDigest ? (
									terminalDigestUrl ? (
										<a href={terminalDigestUrl} target='_blank' rel='noreferrer' className='underline'>
											<code className='font-mono'>{intent.redeemTxDigest}</code>
										</a>
									) : (
										<code className='font-mono'>{intent.redeemTxDigest}</code>
									)
								) : (
									'—'
								)}
							</div>
						</div>
					) : null}

					{status === 'EXPIRED' ? (
						<div className='rounded-lg border border-zinc-200 bg-white p-4'>
							<div className='text-sm font-semibold'>Expired</div>
							<p className='mt-2 text-sm text-zinc-700'>Intent expired. Funds returned automatically.</p>
							<div className='mt-3 text-sm'>
								Redeem tx:{' '}
								{intent.redeemTxDigest ? (
									terminalDigestUrl ? (
										<a href={terminalDigestUrl} target='_blank' rel='noreferrer' className='underline'>
											<code className='font-mono'>{intent.redeemTxDigest}</code>
										</a>
									) : (
										<code className='font-mono'>{intent.redeemTxDigest}</code>
									)
								) : (
									'—'
								)}
							</div>
						</div>
					) : null}

					{status === 'FAILED' ? (
						<div className='rounded-lg border border-zinc-200 bg-white p-4'>
							<div className='text-sm font-semibold'>Failed</div>
							<p className='mt-2 text-sm text-zinc-700'>Intent failed to settle.</p>
							{intent.failureReason ? (
								<p className='mt-2 text-sm text-zinc-700'>Reason: {intent.failureReason}</p>
							) : null}
							<p className='mt-2 text-xs text-zinc-500'>No fund loss. Escrow safety is enforced on-chain.</p>
						</div>
					) : null}

					{status !== 'OPEN_ESCROWED' &&
					status !== 'BATCHED' &&
					status !== 'SETTLED' &&
					status !== 'CANCELED' &&
					status !== 'EXPIRED' &&
					status !== 'FAILED' ? (
						<WarningBanner title='Unknown status'>
							Backend returned an unknown status value: <code className='font-mono'>{status}</code>
						</WarningBanner>
					) : null}
				</div>
			) : null}
		</div>
	)
}


