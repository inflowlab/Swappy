import type { Intent } from './intent'

export type Auction = {
	id: string
	// Intents included in this auction batch (read-only, informational)
	intents?: Intent[]

	[key: string]: unknown
}


