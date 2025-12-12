type PublicEnv = {
	backendBaseUrl: string | null
	suiExplorerBaseUrl: string | null
	useMockBackend: boolean
	protocolPackageId: string | null
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
	backendBaseUrl: readPublicString('NEXT_PUBLIC_BACKEND_BASE_URL'),
	suiExplorerBaseUrl: readPublicString('NEXT_PUBLIC_SUI_EXPLORER_BASE_URL'),
	useMockBackend: readPublicBoolean('NEXT_PUBLIC_USE_MOCK_BACKEND'),
	protocolPackageId: readPublicString('NEXT_PUBLIC_PROTOCOL_PACKAGE_ID'),
}


