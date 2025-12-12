'use client'

import { cn } from '@/lib/utils/cn'

export type NotificationTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const toneClassName: Record<NotificationTone, string> = {
	neutral: 'border-zinc-200 bg-white text-zinc-950',
	info: 'border-sky-200 bg-sky-50 text-sky-950',
	success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
	warning: 'border-amber-200 bg-amber-50 text-amber-950',
	danger: 'border-red-200 bg-red-50 text-red-950',
}

export function InlineNotification (props: {
	tone?: NotificationTone
	message: string
	details?: string
	className?: string
}) {
	const { tone = 'neutral', message, details, className } = props
	return (
		<div className={cn('rounded-lg border px-4 py-3', toneClassName[tone], className)}>
			<div className='text-sm font-medium'>{message}</div>
			{details ? <div className='mt-1 text-sm opacity-90'>{details}</div> : null}
		</div>
	)
}


