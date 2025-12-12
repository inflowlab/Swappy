'use client'

import type { IntentStatus } from '@/lib/models/intent-status'
import { Badge } from '@/components/ui/badge'

type StatusConfig = {
	label: string
	tone: Parameters<typeof Badge>[0]['tone']
}

const statusConfig: Record<IntentStatus, StatusConfig> = {
	OPEN_ESCROWED: { label: 'Open (Escrowed)', tone: 'info' },
	BATCHED: { label: 'Batched', tone: 'warning' },
	SETTLED: { label: 'Settled', tone: 'success' },
	CANCELED: { label: 'Canceled', tone: 'neutral' },
	EXPIRED: { label: 'Expired', tone: 'neutral' },
	FAILED: { label: 'Failed', tone: 'danger' },
}

export function StatusBadge (props: { status: IntentStatus | string }) {
	const { status } = props
	const cfg = statusConfig[status as IntentStatus]

	if (!cfg) return <Badge tone='neutral'>Unknown</Badge>

	return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}


