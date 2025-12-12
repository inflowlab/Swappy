'use client'

import Link from 'next/link'
import type { ApiIntent } from '@/lib/api'
import { StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils/cn'

function shortId (id: string) {
	if (id.length <= 14) return id
	return `${id.slice(0, 8)}…${id.slice(-4)}`
}

export function IntentTable (props: {
	intents: ApiIntent[]
	onCancelClick: (intent: ApiIntent) => void
}) {
	const { intents, onCancelClick } = props

	return (
		<div className='overflow-hidden rounded-lg border border-zinc-200 bg-white'>
			<table className='w-full text-sm'>
				<thead className='bg-zinc-50 text-left text-xs font-semibold text-zinc-700'>
					<tr>
						<th className='px-4 py-3'>Intent</th>
						<th className='px-4 py-3'>Pair</th>
						<th className='px-4 py-3'>Sell</th>
						<th className='px-4 py-3'>Status</th>
						<th className='px-4 py-3 text-right'>Actions</th>
					</tr>
				</thead>
				<tbody className='divide-y divide-zinc-200'>
					{intents.map((intent) => {
						const canCancel = intent.status === 'OPEN_ESCROWED'
						return (
							<tr key={intent.id} className='text-zinc-900'>
								<td className='px-4 py-3 font-mono text-xs'>{shortId(intent.id)}</td>
								<td className='px-4 py-3'>{intent.pairLabel ?? '—'}</td>
								<td className='px-4 py-3'>
									{intent.sellAmount && intent.sellSymbol
										? `${intent.sellAmount} ${intent.sellSymbol}`
										: '—'}
								</td>
								<td className='px-4 py-3'>
									<StatusBadge status={intent.status} />
								</td>
								<td className='px-4 py-3'>
									<div className='flex items-center justify-end gap-2'>
										<Link
											href={`/intent/${encodeURIComponent(intent.id)}`}
											className='rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50'
										>
											View
										</Link>
										<button
											type='button'
											disabled={!canCancel}
											onClick={() => onCancelClick(intent)}
											className={cn(
												'rounded-md px-3 py-1.5 text-xs font-medium',
												canCancel
													? 'border border-zinc-200 hover:bg-zinc-50'
													: 'cursor-not-allowed border border-zinc-100 text-zinc-400',
											)}
										>
											Cancel
										</button>
									</div>
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}


