'use client'

import { cn } from '@/lib/utils/cn'

type BannerTone = 'error' | 'warning'

const toneClassName: Record<BannerTone, string> = {
	error: 'border-red-200 bg-red-50 text-red-950',
	warning: 'border-amber-200 bg-amber-50 text-amber-950',
}

export function Banner (props: {
	tone: BannerTone
	title: string
	children?: React.ReactNode
	className?: string
}) {
	const { tone, title, children, className } = props
	return (
		<div className={cn('rounded-lg border px-4 py-3', toneClassName[tone], className)}>
			<div className='text-sm font-semibold'>{title}</div>
			{children ? <div className='mt-1 text-sm opacity-90'>{children}</div> : null}
		</div>
	)
}

export function ErrorBanner (props: {
	title?: string
	children?: React.ReactNode
	className?: string
}) {
	const { title = 'Something went wrong', children, className } = props
	return (
		<Banner tone='error' title={title} className={className}>
			{children}
		</Banner>
	)
}

export function WarningBanner (props: {
	title?: string
	children?: React.ReactNode
	className?: string
}) {
	const { title = 'Heads up', children, className } = props
	return (
		<Banner tone='warning' title={title} className={className}>
			{children}
		</Banner>
	)
}


