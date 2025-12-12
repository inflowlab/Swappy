export enum IntentStatus {
	OPEN_ESCROWED = 'OPEN_ESCROWED',
	BATCHED = 'BATCHED',
	SETTLED = 'SETTLED',
	CANCELED = 'CANCELED',
	EXPIRED = 'EXPIRED',
	FAILED = 'FAILED',
}

export function isIntentStatus (value: string): value is IntentStatus {
	return (Object.values(IntentStatus) as string[]).includes(value)
}


