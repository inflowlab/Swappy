'use client'

import { cn } from '@/lib/utils/cn'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const toneClassName: Record<BadgeTone, string> = {
	neutral: 'bg-zinc-100 text-zinc-900 ring-zinc-200',
	info: 'bg-sky-100 text-sky-900 ring-sky-200',
	success: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
	warning: 'bg-amber-100 text-amber-950 ring-amber-200',
	danger: 'bg-red-100 text-red-950 ring-red-200',
}

export function Badge (props: {
	children: React.ReactNode
	tone?: BadgeTone
	className?: string
}) {
	const { children, tone = 'neutral', className } = props
	return (
		<span
			className={cn(
				'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
				toneClassName[tone],
				className,
			)}
		>
			{children}
		</span>
	)
}


