type PublicEnv = {
	coordinatorUrl: string | null
	suiExplorerBaseUrl: string | null
	useMockBackend: boolean
	useMockChain: boolean
	protocolPackageId: string | null
	defaultNetwork: string | null
}

function readPublicString (key: string): string | null {
	const value = process.env[key]
	if (!value) return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

function readPublicBoolean (key: string): boolean {
	const value = readPublicString(key)
	if (!value) return false
	return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
}

export const env: PublicEnv = {
	coordinatorUrl: readPublicString('NEXT_PUBLIC_COORDINATOR_URL'),
	suiExplorerBaseUrl: readPublicString('NEXT_PUBLIC_SUI_EXPLORER_BASE_URL'),
	useMockBackend: readPublicBoolean('NEXT_PUBLIC_USE_MOCK_BACKEND'),
	useMockChain:
		readPublicBoolean('NEXT_PUBLIC_USE_MOCK_CHAIN') ||
		readPublicBoolean('NEXT_PUBLIC_USE_MOCK_BACKEND'),
	protocolPackageId: readPublicString('NEXT_PUBLIC_PROTOCOL_PACKAGE_ID'),
	defaultNetwork: readPublicString('NEXT_PUBLIC_DEFAULT_NETWORK'),
}


