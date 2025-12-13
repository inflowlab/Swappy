export type SuiNetwork = 'mainnet' | 'testnet' | 'devnet' | 'localnet'

export const SUI_NETWORKS: SuiNetwork[] = ['mainnet', 'testnet', 'devnet', 'localnet']

export function isSuiNetwork (value: string): value is SuiNetwork {
	return (SUI_NETWORKS as string[]).includes(value)
}


