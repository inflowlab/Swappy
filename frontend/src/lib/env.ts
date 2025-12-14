type PublicEnv = {
	coordinatorUrl: string | null
	suiExplorerBaseUrl: string | null
	useMockBackend: boolean
	useMockChain: boolean
	useMockTx: boolean
	protocolPackageId: string | null
	defaultNetwork: string | null
}

function readPublicStringValue (value: string | undefined): string | null {
	if (!value) return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

function readPublicBooleanValue (value: string | undefined): boolean {
	const v = readPublicStringValue(value)
	if (!v) return false
	return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes'
}

// IMPORTANT (Next.js): only statically-referenced NEXT_PUBLIC_* env vars are inlined into the client bundle.
// Do not use dynamic `process.env[key]` lookups here.
const coordinatorUrl = readPublicStringValue(process.env.NEXT_PUBLIC_COORDINATOR_URL)
const suiExplorerBaseUrl = readPublicStringValue(process.env.NEXT_PUBLIC_SUI_EXPLORER_BASE_URL)
const useMockBackend = readPublicBooleanValue(process.env.NEXT_PUBLIC_USE_MOCK_BACKEND)
const useMockChainExplicit = readPublicBooleanValue(process.env.NEXT_PUBLIC_USE_MOCK_CHAIN)
const useMockTxExplicit = readPublicBooleanValue(process.env.NEXT_PUBLIC_USE_MOCK_TX)
const protocolPackageId = readPublicStringValue(process.env.NEXT_PUBLIC_PROTOCOL_PACKAGE_ID)
const defaultNetwork = readPublicStringValue(process.env.NEXT_PUBLIC_DEFAULT_NETWORK)

// Back-compat: enabling mock backend implies mock chain.
const useMockChain = useMockChainExplicit || useMockBackend
// Back-compat: enabling mock backend implies mock tx.
const useMockTx = useMockTxExplicit || useMockBackend

export const env: PublicEnv = {
	coordinatorUrl,
	suiExplorerBaseUrl,
	useMockBackend,
	useMockChain,
	useMockTx,
	protocolPackageId,
	defaultNetwork,
}


