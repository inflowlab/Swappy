import type { SuiNetwork } from '@/lib/network/types'
import { getSuiClient } from '@/lib/sui/client'
import { getAuctionBookId } from '@/lib/config/types'

export async function getDynamicFieldByU64 (args: {
	network: SuiNetwork
	parentId: string
	key: string
}): Promise<unknown | null> {
	const { network, parentId, key } = args
	const client = getSuiClient(network)

	return await client.getDynamicFieldObject({
		parentId,
		name: {
			type: 'u64',
			value: key,
		},
	})
}

export async function getAuctionBookDynamicFieldByU64 (args: {
	network: SuiNetwork
	key: string
}): Promise<unknown | null> {
	const { network, key } = args
	return await getDynamicFieldByU64({
		network,
		parentId: getAuctionBookId(network),
		key,
	})
}


