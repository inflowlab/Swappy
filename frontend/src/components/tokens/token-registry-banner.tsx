'use client'

import { WarningBanner } from '@/components/ui/banner'
import { useTokenRegistry } from '@/components/tokens/token-registry'

export function TokenRegistryBanner () {
	const { error } = useTokenRegistry()
	if (!error) return null
	return <WarningBanner title='Token metadata unavailable'>{error}</WarningBanner>
}


