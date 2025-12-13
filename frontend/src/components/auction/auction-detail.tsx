'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ApiAuctionDetail, ApiAuctionIntentRow } from '@/lib/api'
import { getAuctionDetail } from '@/lib/api'
import { ErrorBanner, WarningBanner } from '@/components/ui/banner'
import { StatusBadge } from '@/components/status-badge'
import { getTxExplorerUrl } from '@/lib/explorer'

function shortId (id: string) {
	if (id.length <= 18) return id
	return `${id.slice(0, 10)}…${id.slice(-6)}`
}

function formatUtc (ms: number | undefined) {
	if (!ms) return '—'
	try {
		return new Date(ms).toUTCString()
	} catch {
		return String(ms)
	}
}

function isSettled (status: string) {
	return status === 'SETTLED'
}

export function AuctionDetail (props: { auctionId: string }) {
	const { auctionId } = props

	const [auction, setAuction] = useState<ApiAuctionDetail | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		setIsLoading(true)
		setError(null)
		try {
			const data = await getAuctionDetail(auctionId)
			if (!data) {
				setError('Auction not found.')
				setAuction(null)
				return
			}
			setAuction(data)
		} catch (err) {
			console.error('Auction fetch failed:', err)
			setError('Service temporarily unavailable. Please refresh to retry.')
			setAuction(null)
		} finally {
			setIsLoading(false)
		}
	}, [auctionId])

	useEffect(() => {
		// Fetch once per load (and when navigating to a different auction id).
		void load()
	}, [load])

	const status = auction?.status ? String(auction.status) : 'UNKNOWN'
	const intentCount = auction?.intents?.length ?? 0

	const settlementDigest = auction?.settlement?.settlementTxDigest ?? null
	const settlementUrl = settlementDigest ? getTxExplorerUrl(settlementDigest) : null

	const showMissingSettlementWarning = useMemo(() => {
		if (!auction) return false
		if (!isSettled(status)) return false
		return !auction.settlement || !auction.settlement.settlementTxDigest
	}, [auction, status])

	return (
		<div className='space-y-6'>
			<div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
				<div className='space-y-1'>
					<h1 className='text-2xl font-semibold tracking-tight'>Auction</h1>
					<p className='text-sm text-zinc-700'>
						Auction <code className='font-mono'>{shortId(auctionId)}</code>
					</p>
				</div>
				<Link
					href='/'
					className='inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50'
				>
					Back to Dashboard
				</Link>
			</div>

			{isLoading ? <div className='text-sm text-zinc-700'>Loading…</div> : null}
			{error ? <ErrorBanner title='Unable to load auction'>{error}</ErrorBanner> : null}

			{auction ? (
				<div className='space-y-6'>
					<div className='rounded-lg border border-zinc-200 bg-white p-4'>
						<div className='text-sm font-semibold'>Auction overview</div>
						<div className='mt-3 grid gap-3 sm:grid-cols-2'>
							<div className='rounded-md border border-zinc-200 p-3'>
								<div className='text-xs font-semibold text-zinc-700'>Auction ID</div>
								<div className='mt-1 font-mono text-xs text-zinc-950'>{auction.id}</div>
							</div>
							<div className='rounded-md border border-zinc-200 p-3'>
								<div className='text-xs font-semibold text-zinc-700'>Status</div>
								<div className='mt-1 text-sm text-zinc-950'>{status}</div>
							</div>
							<div className='rounded-md border border-zinc-200 p-3'>
								<div className='text-xs font-semibold text-zinc-700'>Created at</div>
								<div className='mt-1 text-sm text-zinc-950'>{formatUtc(auction.createdAtMs)}</div>
							</div>
							<div className='rounded-md border border-zinc-200 p-3'>
								<div className='text-xs font-semibold text-zinc-700'>Deadline</div>
								<div className='mt-1 text-sm text-zinc-950'>{formatUtc(auction.deadlineMs)}</div>
							</div>
							<div className='rounded-md border border-zinc-200 p-3'>
								<div className='text-xs font-semibold text-zinc-700'>Number of intents</div>
								<div className='mt-1 text-sm text-zinc-950'>{intentCount}</div>
							</div>
						</div>
					</div>

					{isSettled(status) ? null : (
						<div className='rounded-lg border border-zinc-200 bg-white p-4'>
							<div className='text-sm font-semibold'>Auction status</div>
							<p className='mt-2 text-sm text-zinc-700'>Auction open. Waiting for settlement.</p>
							<p className='mt-2 text-xs text-zinc-500'>
								Deadline: <span className='font-mono'>{formatUtc(auction.deadlineMs)}</span>
							</p>
						</div>
					)}

					<div className='space-y-3'>
						<div className='flex items-end justify-between gap-3'>
							<div className='text-sm font-semibold'>Intents in this auction</div>
							<div className='text-xs text-zinc-600'>≤ 10 intents</div>
						</div>
						<div className='overflow-hidden rounded-lg border border-zinc-200 bg-white'>
							<table className='w-full text-sm'>
								<thead className='bg-zinc-50 text-left text-xs font-semibold text-zinc-700'>
									<tr>
										<th className='px-4 py-3'>Intent</th>
										<th className='px-4 py-3'>Pair</th>
										<th className='px-4 py-3'>Sell</th>
										<th className='px-4 py-3'>Status</th>
										<th className='px-4 py-3'>Execution</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-zinc-200'>
									{auction.intents.map((row: ApiAuctionIntentRow) => (
										<tr key={row.intentId} className='text-zinc-900'>
											<td className='px-4 py-3 font-mono text-xs'>
												<Link
													href={`/intent/${encodeURIComponent(row.intentId)}`}
													className='underline hover:text-zinc-950'
												>
													{shortId(row.intentId)}
												</Link>
											</td>
											<td className='px-4 py-3'>{row.pairLabel ?? '—'}</td>
											<td className='px-4 py-3'>
												{row.sellAmount && row.sellSymbol ? `${row.sellAmount} ${row.sellSymbol}` : '—'}
											</td>
											<td className='px-4 py-3'>
												<StatusBadge status={row.status} />
											</td>
											<td className='px-4 py-3'>{row.executionType ?? '—'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>

					{isSettled(status) ? (
						<div className='space-y-3 rounded-lg border border-zinc-200 bg-white p-4'>
							<div className='text-sm font-semibold'>Settlement result</div>

							{showMissingSettlementWarning ? (
								<WarningBanner title='Settlement data missing'>
									Auction is marked SETTLED, but settlement proof data is missing.
								</WarningBanner>
							) : null}

							<div className='grid gap-3 sm:grid-cols-2'>
								<div className='rounded-md border border-zinc-200 p-3'>
									<div className='text-xs font-semibold text-zinc-700'>Winning solver</div>
									<div className='mt-1 text-sm text-zinc-950'>
										{auction.settlement?.winningSolver ?? '—'}
									</div>
								</div>
								<div className='rounded-md border border-zinc-200 p-3'>
									<div className='text-xs font-semibold text-zinc-700'>CoW matches</div>
									<div className='mt-1 text-sm text-zinc-950'>
										{typeof auction.settlement?.cowMatchesCount === 'number'
											? auction.settlement.cowMatchesCount
											: '—'}
									</div>
								</div>
								<div className='rounded-md border border-zinc-200 p-3'>
									<div className='text-xs font-semibold text-zinc-700'>Cetus swaps</div>
									<div className='mt-1 text-sm text-zinc-950'>
										{typeof auction.settlement?.cetusSwapsCount === 'number'
											? auction.settlement.cetusSwapsCount
											: '—'}
									</div>
								</div>
								<div className='rounded-md border border-zinc-200 p-3'>
									<div className='text-xs font-semibold text-zinc-700'>Total buy volume</div>
									<div className='mt-1 text-sm text-zinc-950'>
										{auction.settlement?.totalBuyVolume ?? '—'}
									</div>
								</div>
								<div className='rounded-md border border-zinc-200 p-3 sm:col-span-2'>
									<div className='text-xs font-semibold text-zinc-700'>Settlement tx digest</div>
									<div className='mt-1 text-sm text-zinc-950'>
										{settlementDigest ? (
											settlementUrl ? (
												<a
													href={settlementUrl}
													target='_blank'
													rel='noreferrer'
													className='underline'
												>
													<code className='font-mono'>{settlementDigest}</code>
												</a>
											) : (
												<code className='font-mono'>{settlementDigest}</code>
											)
										) : (
											'—'
										)}
									</div>
								</div>
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	)
}


